import { add, sub, mul, norm, dot, evaluate } from "./guidance.mjs";

// 积分状态为惯性 NED 下的 [pU, vU, pT, vT]；加速度是净运动加速度。
export function stateFromVector(initial, x) {
  return {
    ...initial,
    r: sub(x.slice(6, 9), x.slice(0, 3)),
    u: x.slice(3, 6),
    v: sub(x.slice(9, 12), x.slice(3, 6)),
  };
}

export function command(law, state, maxAcceleration = 0) {
  const result = evaluate(law, state);
  if (!result.valid || !result.a.every(Number.isFinite))
    throw new Error(result.reason || "加速度超出数值范围");
  const magnitude = norm(result.a);
  const scale =
    maxAcceleration > 0 && magnitude > maxAcceleration
      ? maxAcceleration / magnitude
      : 1;
  return { raw: result.a, applied: mul(result.a, scale), limited: scale < 1 };
}

// 每个 RK4 子阶段都重新计算相对状态、导引指令及总指令饱和。
function rk4(x, h, derivative) {
  const shifted = (k, factor) => x.map((v, i) => v + factor * k[i]);
  const k1 = derivative(x),
    k2 = derivative(shifted(k1, h / 2));
  const k3 = derivative(shifted(k2, h / 2)),
    k4 = derivative(shifted(k3, h));
  return x.map((v, i) => v + (h * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])) / 6);
}

export function simulate(law, initial, settings = {}) {
  const config = {
    duration: 20,
    dt: 0.02,
    radius: 0.5,
    maxAcceleration: 0,
    ...settings,
  };
  const { duration, dt, radius, maxAcceleration } = config;
  if (
    ![duration, dt, radius, maxAcceleration].every(Number.isFinite) ||
    duration <= 0 ||
    duration > 60 ||
    dt < 0.005 ||
    dt > 0.2 ||
    radius < 0.01 ||
    maxAcceleration < 0
  )
    throw new Error(
      "参数范围：时长 (0,60] s，步长 [0.005,0.2] s，阈值 ≥ 0.01 m，限幅 ≥ 0。",
    );
  if (
    !["r", "u", "v", "aT", "b"].every((key) =>
      initial[key].every(Number.isFinite),
    )
  )
    throw new Error("请填写有限的三轴输入。");
  let x = [0, 0, 0, ...initial.u, ...initial.r, ...add(initial.u, initial.v)],
    t = 0;
  const frames = [];
  const sample = (value, time) => {
    const state = stateFromVector(initial, value),
      R = norm(state.r);
    // 起点已在阈值内时不再求含 1/R 的导引公式。
    const cmd =
      R < 1e-6
        ? { raw: [0, 0, 0], applied: [0, 0, 0], limited: false }
        : command(law, state, maxAcceleration);
    return {
      t: time,
      pU: value.slice(0, 3),
      pT: value.slice(6, 9),
      state,
      R,
      closing: R > 0 ? -dot(state.r, state.v) / R : 0,
      ...cmd,
    };
  };
  const derivative = (value) => {
    const state = stateFromVector(initial, value);
    return [
      ...state.u,
      ...command(law, state, maxAcceleration).applied,
      ...value.slice(9, 12),
      ...initial.aT,
    ];
  };
  let current = sample(x, t),
    reason = "达到设定时长";
  frames.push(current);
  if (current.R <= radius) reason = "起点已在接近阈值内";
  else
    for (let step = 0; t < duration - 1e-10; step++) {
      if (step >= 20000) {
        reason = "达到积分步数上限";
        break;
      }
      // 限制一步的相对位移及加速度影响，防止跨过阈值球或接近 R=0 奇点。
      const relativeAcceleration = norm(sub(initial.aT, current.applied));
      let h = Math.min(
        dt,
        duration - t,
        (0.1 * current.R) / Math.max(norm(current.state.v), 1e-9),
        Math.sqrt((0.02 * current.R) / Math.max(relativeAcceleration, 1e-9)),
      );
      if (h < 1e-8) {
        reason = "步长过小，停止积分";
        break;
      }
      let nextX, next;
      try {
        nextX = rk4(x, h, derivative);
        if (
          !nextX.every(Number.isFinite) ||
          nextX.some((v) => Math.abs(v) > 1e8)
        )
          throw new Error("状态超出数值范围");
        next = sample(nextX, t + h);
        const entered = next.R <= radius;
        const closest = current.closing > 0 && next.closing <= 0;
        if (entered || closest) {
          // 二分定位步内事件；最近接近点仍在阈值内时，优先定位首次进入阈值。
          const locate = (predicate, upper) => {
            let lo = 0,
              hi = upper;
            for (let i = 0; i < 40 && hi - lo > 1e-9; i++) {
              const mid = (lo + hi) / 2;
              const frame = sample(rk4(x, mid, derivative), t + mid);
              if (predicate(frame)) hi = mid;
              else lo = mid;
            }
            return hi;
          };
          let eventH = closest ? locate((f) => f.closing <= 0, h) : h;
          const atClosest = sample(rk4(x, eventH, derivative), t + eventH);
          const reachesRadius = entered || atClosest.R <= radius;
          if (reachesRadius) eventH = locate((f) => f.R <= radius, eventH);
          h = eventH;
          nextX = rk4(x, h, derivative);
          next = sample(nextX, t + h);
          reason = reachesRadius ? "进入接近阈值" : "首次最近接近";
        }
      } catch (error) {
        reason = "积分停止：" + error.message;
        break;
      }
      x = nextX;
      t += h;
      current = next;
      frames.push(current);
      if (reason !== "达到设定时长") break;
    }
  return {
    law,
    config,
    frames,
    reason,
    duration: t,
    minRange: Math.min(...frames.map((f) => f.R)),
    maxApplied: Math.max(...frames.map((f) => norm(f.applied))),
    limited: frames.some((f) => f.limited),
    finalRelativeSpeed: norm(current.state.v),
  };
}
