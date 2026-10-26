import { simulate } from "./simulation.mjs";
import assert from "node:assert/strict";

import {
  laws,
  presets,
  add,
  sub,
  mul,
  dot,
  cross,
  norm,
  unit,
  perpendicular,
  toScene,
  geometry,
  evaluate,
} from "./guidance.mjs";
let assertions = 0;
const near = (a, b, message) => {
  assert.ok(
    Math.abs(a - b) < 1e-8 * (1 + Math.abs(a) + Math.abs(b)),
    `${message}: ${a} vs ${b}`,
  );
  assertions++;
};
const vnear = (a, b, message) => a.forEach((x, i) => near(x, b[i], message));
const command = (id, s) => {
  const x = evaluate(id, s);
  assert.ok(x.valid, `${id}: ${x.reason}`);
  assertions++;
  return x.a;
};
let seed = 73829;
const rand = () =>
  (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
const rv = (scale) => [0, 0, 0].map(() => scale * (2 * rand() - 1));
const rotate = (v, axis, a) =>
  add(
    add(mul(v, Math.cos(a)), mul(cross(axis, v), Math.sin(a))),
    mul(axis, dot(axis, v) * (1 - Math.cos(a))),
  );
const numeric = structuredClone(presets.original);
vnear(command("RTPN", numeric), [0, 0.6, 0], "original RTPN");
vnear(command("IPN", numeric), [0.6, 0.6, 0], "original IPN");
vnear(command("PPN", numeric), [-1.5, 3, 0], "original PPN");
for (let i = 0; i < 200; i++) {
  const s = {
    ...structuredClone(presets.closing),
    r: rv(30),
    u: rv(15),
    v: rv(5),
    aT: rv(2),
    b: rv(2),
    N: 1 + rand() * 7,
    vc0: rand() * 6,
    beta: rand() * 160 - 80,
  };
  const g = geometry(s);
  near(dot(g.omega, s.r), 0, "omega perpendicular r");
  near(dot(g.omega, s.v), 0, "omega perpendicular vr");
  vnear(cross(g.omega, g.er), mul(g.vp, 1 / g.R), "LOS identity");
  for (const id of ["TPN", "RTPN", "APN", "BPN"])
    near(dot(command(id, s), g.er), 0, id + " LOS normal");
  for (const id of ["PPN", "BPPN"])
    near(dot(command(id, s), s.u), 0, id + " own-speed normal");
  near(dot(command("IPN", s), s.v), 0, "IPN relative normal");
  near(dot(sub(command("AIPN", s), s.aT), s.v), 0, "AIPN base relative normal");
  vnear(
    sub(command("IPN", s), command("RTPN", s)),
    mul(g.er, (s.N * norm(g.vp) ** 2) / g.R),
    "IPN radial difference",
  );
  vnear(
    command("TPN", { ...s, vc0: g.vc }),
    command("RTPN", s),
    "TPN=RTPN when speeds match",
  );
  vnear(command("GTPN", { ...s, beta: 0 }), command("RTPN", s), "GTPN beta0");
  near(dot(command("GTPN", s), g.omega), 0, "GTPN plane");
  near(
    dot(command("GTPN", s), g.er),
    s.N * g.vc * norm(g.omega) * Math.sin((s.beta * Math.PI) / 180),
    "GTPN signed radial",
  );
  for (const [variant, base, key] of [
    ["APN", "RTPN", "aT"],
    ["AIPN", "IPN", "aT"],
    ["BPN", "RTPN", "b"],
    ["BPPN", "PPN", "b"],
  ])
    vnear(
      command(variant, { ...s, [key]: [0, 0, 0] }),
      command(base, s),
      "zero augmentation " + variant,
    );
  const stationary = { ...s, v: mul(s.u, -1) };
  vnear(
    command("PPN", stationary),
    command("IPN", stationary),
    "stationary target PPN IPN",
  );
  if (g.vc > 1e-8) {
    vnear(command("ZEM", s), command("RTPN", s), "ZEM RTPN");
    const t = g.R / g.vc;
    const zem = add(add(s.r, mul(s.v, t)), mul(s.aT, 0.5 * t * t));
    vnear(
      command("APN", s),
      mul(perpendicular(zem, g.er), s.N / (t * t)),
      "APN augmented ZEM",
    );
  }
  const axis = unit(rv(1)),
    angle = rand() * 6;
  const rot = (v) => rotate(v, axis, angle);
  const rotated = {
    ...s,
    r: rot(s.r),
    u: rot(s.u),
    v: rot(s.v),
    aT: rot(s.aT),
    b: rot(s.b),
  };
  for (const law of laws) {
    const before = evaluate(law.id, s),
      after = evaluate(law.id, rotated);
    assert.equal(before.valid, after.valid);
    assertions++;
    if (before.valid) vnear(after.a, rot(before.a), "SO3 covariance " + law.id);
  }
  vnear(
    cross(toScene(s.r), toScene(s.v)),
    toScene(cross(s.r, s.v)),
    "right-handed renderer mapping",
  );
}
for (const preset of ["still", "radial"])
  for (const law of ["TPN", "RTPN", "PPN", "IPN", "GTPN"])
    vnear(command(law, presets[preset]), [0, 0, 0], preset + " " + law);
for (const law of laws) {
  assert.equal(evaluate(law.id, { ...numeric, r: [0, 0, 0] }).valid, false);
  assertions++;
  assert.equal(evaluate(law.id, { ...numeric, r: [NaN, 0, 0] }).valid, false);
  assertions++;
}
assert.equal(evaluate("ZEM", presets.opening).valid, false);
assertions++;
assert.equal(evaluate("ZEM", presets.sideways).valid, false);
assertions++;
vnear(
  command("PPN", { ...numeric, u: [0, 0, 0] }),
  [0, 0, 0],
  "PPN zero own speed",
);
assert.equal(evaluate("BPPN", { ...numeric, u: [0, 0, 0] }).valid, false);
assertions++;
vnear(
  command("RTPN", presets.opening),
  [0, -0.6, -0.15],
  "negative closing retained",
);
// 方向回归：目标在左前方但向右穿越，三种基础律均应给出向右分量。
for (const law of ["PPN", "RTPN", "IPN"]) {
  assert.ok(evaluate(law, presets.left_crossing).a[1] > 0);
  assertions++;
}
// 径向匀速接近的解析解：R = 20 - 2t，阈值 0.5 m 对应 9.75 s。
const radial = {
  ...presets.closing,
  r: [20, 0, 0],
  u: [10, 0, 0],
  v: [-2, 0, 0],
  aT: [0, 0, 0],
  b: [0, 0, 0],
};
for (const law of laws) {
  const run = simulate(law.id, radial, { dt: 0.2 });
  assert.equal(run.reason, "进入接近阈值");
  assert.ok(Math.abs(run.duration - 9.75) < 1e-7);
  assert.ok(Math.abs(run.minRange - 0.5) < 1e-7);
  assertions += 3;
}
// 三维曲线积分的速度不变量；禁止通过手工归一化速度掩盖积分误差。
for (const [law, speedKey] of [
  ["PPN", "u"],
  ["IPN", "v"],
]) {
  const run = simulate(law, presets.closing, { duration: 3 });
  const speed = norm(presets.closing[speedKey]);
  assert.ok(
    run.frames.every((f) => Math.abs(norm(f.state[speedKey]) - speed) < 1e-8),
  );
  assertions++;
}
// AIPN 完整补偿恒加速度目标后，相对运动应与匀速目标的 IPN 一致。
const baseline = simulate("IPN", presets.closing, { duration: 3 });
const acceleration = [0.2, 0.4, -0.3];
const augmented = simulate(
  "AIPN",
  { ...presets.closing, aT: acceleration },
  { duration: 3 },
);
const endBase = baseline.frames.at(-1),
  endAug = augmented.frames.at(-1);
for (let i = 0; i < 3; i++) {
  assert.ok(Math.abs(endBase.state.r[i] - endAug.state.r[i]) < 1e-8);
  assert.ok(Math.abs(endBase.state.v[i] - endAug.state.v[i]) < 1e-8);
  assert.ok(
    Math.abs(endAug.pU[i] - endBase.pU[i] - acceleration[i] * 4.5) < 1e-8,
  );
  assertions += 3;
}
// 总指令限幅、负闭合、起点在阈值内与非法输入边界。
const saturated = simulate("APN", presets.maneuver, {
  duration: 3,
  maxAcceleration: 0.1,
});
assert.ok(saturated.limited && saturated.maxApplied <= 0.1 + 1e-12);
assertions++;
assert.equal(simulate("IPN", radial, { radius: 25 }).frames.length, 1);
assertions++;
assert.equal(
  simulate("IPN", presets.opening, { duration: 1 }).reason,
  "达到设定时长",
);
assertions++;
assert.throws(() => simulate("IPN", radial, { dt: 0 }));
assertions++;
// 故意选低增益产生非零最近接近，检查事件前后闭合速度的零点。
const miss = simulate("RTPN", { ...presets.closing, N: 0 }, { dt: 0.2 });
assert.equal(miss.reason, "首次最近接近");
assert.ok(Math.abs(miss.frames.at(-1).closing) < 1e-7);
assertions += 2;
const result = {
  passed: true,
  assertions,
  randomStates: 200,
  laws: laws.length,
  scope:
    "公式恒等式、旋转协变、符号边界及闭环积分解析检查；不代表真实飞行验证。",
};
console.log(JSON.stringify(result));
