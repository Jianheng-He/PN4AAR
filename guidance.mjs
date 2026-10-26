// All physical vectors use right-handed NED; positions m, velocities m/s, accelerations m/s².
export const add = (a, b) => a.map((x, i) => x + b[i]);
export const sub = (a, b) => a.map((x, i) => x - b[i]);
export const mul = (a, s) => a.map((x) => x * s);
export const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const norm = (a) => Math.hypot(...a);
export const unit = (a) => (norm(a) > 1e-10 ? mul(a, 1 / norm(a)) : [0, 0, 0]);
export const perpendicular = (a, e) => sub(a, mul(e, dot(a, e)));
export const toScene = (a) => [a[1], -a[2], -a[0]];
export const sources = {
  palumbo: {
    name: "Palumbo et al. · Basic Principles of Homing Guidance (2010, rev. 2018)",
    url: "https://secwww.jhuapl.edu/techdigest/content/techdigest/pdf/V29-N01/29-01-Palumbo_Principles_Rev2018.pdf",
  },
  shukla: {
    name: "Shukla & Mahapatra · The Proportional Navigation Dilemma—Pure or True? (1990)",
    url: "https://doi.org/10.1109/7.53445",
  },
  li: {
    name: "Li, Zhang & Chen · Ideal Proportional Navigation for Exoatmospheric Interception (2013)",
    url: "https://doi.org/10.1016/j.cja.2013.06.007",
  },
  ghose: {
    name: "Ghose · On the Generalization of True Proportional Navigation (1994)",
    url: "https://doi.org/10.1109/7.272277",
  },
  nptel: {
    name: "Ghose · NPTEL Guidance of Missiles, Lecture 38, §13.1.3–4",
    url: "https://archive.nptel.ac.in/content/storage2/courses/101108054/module12/lecture38.pdf",
  },
  aipn: {
    name: "Mehrandezh et al. · Robotic Interception of Moving Objects Using an Augmented Ideal Proportional Navigation Guidance Technique (2000)",
    url: "https://doi.org/10.1109/3468.844351",
  },
  bias: {
    name: "Su et al. · A Novel Biased Proportional Navigation Guidance Law for Close Approach Phase (2016)",
    url: "https://doi.org/10.1016/j.cja.2015.12.014",
  },
};
export const laws = [
  {
    id: "RTPN",
    name: "实时真比例导引",
    group: "基础",
    tag: "实时闭合速度",
    formula: "a = N Vc (ω × eᵣ)",
    base: "实时 LOS 法向 PN",
    inputs: "r、vᵣ、导航系数 N",
    reference: "视线 eᵣ",
    description:
      "让加速度垂直于当前视线，并用实时闭合速度缩放。距离没有缩小时，代数公式仍可计算，但常用接近条件不再成立。",
    notes:
      "本文将实时 Vc 版本称为 RTPN；部分文献也简称 TPN。闭合速度保留正负号，不暗中截成零。",
    sources: ["shukla", "li"],
  },
  {
    id: "TPN",
    name: "真比例导引",
    group: "基础",
    tag: "固定初始闭合速度",
    formula: "a = N Vc₀ (ω × eᵣ)",
    base: "固定尺度 LOS 法向 PN",
    inputs: "r、vᵣ、固定 Vc₀、N",
    reference: "视线 eᵣ",
    description:
      "方向同样垂直于视线，但速度尺度冻结为初始闭合速度。改变当前相对速度时，Vc₀ 不随之变化。",
    notes:
      "这是经典固定尺度约定。与 RTPN 比较时，要同时看 Vc₀ 与当前 Vc；不能只看缩写。预设给出的 Vc₀ 是明确的参数。",
    sources: ["shukla"],
  },
  {
    id: "PPN",
    name: "纯比例导引",
    group: "基础",
    tag: "自身速度法向",
    formula: "a = N (ω × vU)",
    base: "自身速度法向 PN",
    inputs: "r、vᵣ、无人机地速 vU、N",
    reference: "自身速度 vU",
    description:
      "加速度垂直于无人机自身速度。若净运动加速度能被理想执行，瞬时不改变自身速率，而是改变速度方向。",
    notes:
      "这里 vU 为惯性系/地速向量，未用空速替代。模型机头沿地速显示，仅作几何示意。",
    sources: ["palumbo", "shukla"],
  },
  {
    id: "IPN",
    name: "理想比例导引",
    group: "基础",
    tag: "相对速度法向",
    formula: "a = N (vᵣ × ω)",
    base: "相对速度法向 PN",
    inputs: "r、vᵣ、N",
    reference: "相对速度 −vᵣ",
    description:
      "加速度垂直于相对速度。目标匀速且指令理想执行时，保持相对速率并改变相对运动方向。",
    notes:
      "r = pT − pU，vᵣ = vT − vU，因此叉乘顺序是 vᵣ × ω。目标加速时，不能再宣称相对速率保持不变。",
    sources: ["li"],
  },
  {
    id: "APN",
    name: "增广比例导引",
    group: "增强",
    tag: "经典横向近似",
    formula: "a = N Vc (ω × eᵣ) + (N/2) Pᵣ aT",
    base: "RTPN",
    inputs: "r、vᵣ、目标加速度 aT、N",
    reference: "视线 eᵣ",
    description:
      "在 RTPN 上增加目标横向加速度前馈。目标突然侧向机动时，即使视线暂未明显转动，也能产生修正。",
    notes:
      "采用经典小偏差、近似恒定目标横向加速度推导的 N/2 系数，并用 LOS 正交投影作三维实现。这不是任意机动下的全局最优律，也不等于完整 aT 补偿。",
    sources: ["nptel"],
  },
  {
    id: "AIPN",
    name: "增广理想比例导引",
    group: "增强",
    tag: "全加速度补偿版本",
    formula: "a = N (vᵣ × ω) + aT",
    base: "IPN",
    inputs: "r、vᵣ、目标加速度 aT、N",
    reference: "基座：相对速度 −vᵣ",
    description:
      "采用完整目标加速度补偿。若加速度估计与执行均精确，相对加速度中的目标机动项被抵消。",
    notes:
      "这是本文明确选定的 AIPN 版本；总指令通常不再垂直于相对速度。仅基座满足正交关系。真实视觉输入若没有可靠 aT，就不具备该版本的完整输入。",
    sources: ["aipn"],
  },
  {
    id: "BPN",
    name: "偏置比例导引",
    group: "偏置",
    tag: "LOS 法向家族示例",
    formula: "a = N Vc (ω × eᵣ) + Pᵣ b",
    base: "RTPN",
    inputs: "r、vᵣ、外部偏置 b、N",
    reference: "视线 eᵣ",
    description:
      "在基础 PN 上叠加一个明确给出的偏置。本页先把用户输入的 b 投影到视线法平面，再与基座相加。",
    notes:
      "BPN 是一个家族。这里仅演示偏置如何改变指令，没有设计末端角误差反馈或偏置时序，因此不保证末端方向。末角约束文献需配套完整的偏置设计。",
    sources: ["bias"],
  },
  {
    id: "BPPN",
    name: "偏置纯比例导引",
    group: "偏置",
    tag: "速度法向家族示例",
    formula: "a = N (ω × vU) + PU b",
    base: "PPN",
    inputs: "r、vᵣ、vU、外部偏置 b、N",
    reference: "自身速度 vU",
    description:
      "将外部偏置投影到本机速度法平面后，叠加在 PPN 上。本页总指令仍与本机速度垂直。",
    notes:
      "这是用于比较方向的显式家族实例，不是所有 BPPN 文献的统一公式，也不自动实现末端角约束。vU = 0 时投影方向未定义。",
    sources: ["bias", "palumbo"],
  },
  {
    id: "GTPN",
    name: "广义真比例导引",
    group: "推广",
    tag: "局部平面示例",
    formula: "a = N Vc |ω| (cosβ eₜ + sinβ eᵣ)",
    base: "cosβ × RTPN",
    inputs: "r、vᵣ、偏转角 β、N",
    reference: "视线 eᵣ（允许径向分量）",
    description:
      "在瞬时 LOS 旋转平面内，让指令从视线法向偏转 β；正 β 增加朝向目标的分量（Vc > 0 时）。",
    notes:
      "GTPN/GPN 命名不唯一。此处明确选用实时 Vc、瞬时旋转平面及非负 |ω| 的三维推广；不是历史固定尺度二维公式的逐字复现。β = 0 恢复 RTPN；ω = 0 时定义为零指令。",
    sources: ["ghose"],
  },
  {
    id: "ZEM",
    name: "PN 的 ZEM 表述",
    group: "推广",
    tag: "等价表述",
    formula: "a = (N/tgo²) Pᵣ (r + vᵣ tgo)",
    base: "RTPN 的代数重写",
    inputs: "r、vᵣ、N；tgo = R/Vc",
    reference: "视线 eᵣ",
    description:
      "用“若不再加速会产生的横向脱靶量”表达 PN。采用 tgo = R/Vc 时，此式与 RTPN 代数等价。",
    notes:
      "只在 Vc > 0 时采用该正的剩余时间估计。这里不是新的性能方案，也不是精确到达时间预测。若加入 ½ aT tgo²，投影后得到本页 APN。",
    sources: ["nptel"],
  },
];
export const presets = {
  closing: {
    name: "三维接近 · 同时横向漂移",
    r: [20, 6, -3],
    u: [10, 5, -0.4],
    v: [-2, 2, 0.3],
    aT: [0, 0, 0],
    b: [0, 0.8, -0.3],
    N: 3,
    vc0: 2,
    beta: 20,
  },
  maneuver: {
    name: "锥套机动 · 横向与垂向加速",
    r: [20, 6, -3],
    u: [10, 5, -0.4],
    v: [-2, 2, 0.3],
    aT: [0.1, 0.7, -0.35],
    b: [0, 0.8, -0.3],
    N: 3,
    vc0: 2,
    beta: 20,
  },
  original: {
    name: "原图复现 · 北东平面",
    r: [20, 0, 0],
    u: [10, 5, 0],
    v: [-2, 2, 0],
    aT: [0, 0, 0],
    b: [0, 0.8, 0],
    N: 3,
    vc0: 2,
    beta: 20,
  },
  sideways: {
    name: "零闭合速度 · 仅横向漂移",
    r: [20, 0, 0],
    u: [10, 5, -0.4],
    v: [0, 2, 0.5],
    aT: [0, 0, 0],
    b: [0, 0.8, -0.3],
    N: 3,
    vc0: 2,
    beta: 20,
  },
  still: {
    name: "相对静止 · 仍有位置偏差",
    r: [20, 6, -3],
    u: [10, 5, -0.4],
    v: [0, 0, 0],
    aT: [0, 0, 0],
    b: [0, 0.8, -0.3],
    N: 3,
    vc0: 2,
    beta: 20,
  },
  radial: {
    name: "视线不转 · 沿视线接近",
    r: [20, 0, 0],
    u: [10, 5, -0.4],
    v: [-2, 0, 0],
    aT: [0, 0, 0],
    b: [0, 0.8, -0.3],
    N: 3,
    vc0: 2,
    beta: 20,
  },
  opening: {
    name: "正在远离 · 负闭合速度",
    r: [20, 0, 0],
    u: [10, 5, -0.4],
    v: [2, 2, 0.5],
    aT: [0, 0, 0],
    b: [0, 0.8, -0.3],
    N: 3,
    vc0: 2,
    beta: 20,
  },
};
export function geometry(s) {
  const entries = [...s.r, ...s.u, ...s.v, ...s.aT, ...s.b, s.N, s.vc0, s.beta];
  if (!entries.every(Number.isFinite))
    return { valid: false, reason: "输入必须为有限数值。" };
  const R = norm(s.r);
  if (R < 1e-6)
    return { valid: false, reason: "位置重合：视线方向未定义，停止计算 PN。" };
  const er = mul(s.r, 1 / R),
    omega = mul(cross(s.r, s.v), 1 / (R * R)),
    vc = -dot(er, s.v),
    vp = perpendicular(s.v, er);
  return {
    valid: true,
    R,
    er,
    omega,
    vc,
    vp,
    et: unit(vp),
    uHat: unit(s.u),
    vHat: unit(s.v),
    vT: add(s.u, s.v),
  };
}
export function evaluate(id, s) {
  const g = geometry(s);
  if (!g.valid) return { ...g, id };
  const zero = [0, 0, 0],
    rtpn = mul(cross(g.omega, g.er), s.N * g.vc),
    ppn = mul(cross(g.omega, s.u), s.N),
    ipn = mul(cross(s.v, g.omega), s.N);
  let base = zero,
    extra = zero,
    reference = g.er,
    orthogonal = null;
  switch (id) {
    case "TPN":
      base = mul(cross(g.omega, g.er), s.N * s.vc0);
      orthogonal = g.er;
      break;
    case "RTPN":
      base = rtpn;
      orthogonal = g.er;
      break;
    case "PPN":
      base = ppn;
      reference = g.uHat;
      orthogonal = g.uHat;
      break;
    case "IPN":
      base = ipn;
      reference = mul(g.vHat, -1);
      orthogonal = g.vHat;
      break;
    case "APN":
      base = rtpn;
      extra = mul(perpendicular(s.aT, g.er), s.N / 2);
      orthogonal = g.er;
      break;
    case "AIPN":
      base = ipn;
      extra = [...s.aT];
      reference = mul(g.vHat, -1);
      break;
    case "BPN":
      base = rtpn;
      extra = perpendicular(s.b, g.er);
      orthogonal = g.er;
      break;
    case "BPPN":
      if (norm(s.u) < 1e-10)
        return {
          valid: false,
          id,
          reason: "本机速度为零，速度法向偏置投影未定义。",
        };
      base = ppn;
      extra = perpendicular(s.b, g.uHat);
      reference = g.uHat;
      orthogonal = g.uHat;
      break;
    case "GTPN": {
      const beta = (s.beta * Math.PI) / 180;
      base = mul(rtpn, Math.cos(beta));
      extra = mul(g.er, s.N * g.vc * norm(g.omega) * Math.sin(beta));
      break;
    }
    case "ZEM": {
      if (g.vc <= 1e-8)
        return {
          valid: false,
          id,
          reason: "Vc ≤ 0：本页 tgo = R/Vc 的正剩余时间近似不适用。",
        };
      const tgo = g.R / g.vc;
      base = mul(
        perpendicular(add(s.r, mul(s.v, tgo)), g.er),
        s.N / (tgo * tgo),
      );
      orthogonal = g.er;
      break;
    }
    default:
      return { valid: false, id, reason: "未知导引律。" };
  }
  const a = add(base, extra);
  return {
    valid: true,
    id,
    g,
    a,
    base,
    extra,
    reference,
    orthogonal,
    magnitude: norm(a),
    radial: dot(a, g.er),
    normal: norm(perpendicular(a, g.er)),
  };
}
