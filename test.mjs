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
const result = {
  passed: true,
  assertions,
  randomStates: 200,
  laws: laws.length,
  scope:
    "Formula identities, SO(3) covariance, signed and singular boundary cases. Not flight validation.",
};
console.log(JSON.stringify(result));
