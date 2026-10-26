import * as THREE from "three";
import { OrbitControls } from "./vendor/OrbitControls.js";
import {
  toScene,
  norm,
  unit,
  mul,
  add,
  geometry,
  evaluate,
} from "./guidance.mjs";
const colors = {
  los: 0x75879b,
  reference: 0x47c2b1,
  command: 0x4580ff,
  extra: 0xedaa50,
  velocity: 0x9babc1,
  targetVelocity: 0xbeb297,
  PPN: 0x9d82e6,
  IPN: 0xe487a8,
  TPN: 0xecc05b,
  RTPN: 0x4580ff,
};
export function createScene(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x111c2c);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  // 轨迹使用惯性 NED 世界坐标，远处轨迹不受雾效遮挡。
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 100000);
  camera.up.set(0, 1, 0);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.minDistance = 5;
  controls.maxDistance = 50000;
  controls.maxPolarAngle = Math.PI * 0.97;
  scene.add(new THREE.HemisphereLight(0xdceaff, 0x36415a, 2.7));
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.position.set(8, 25, 15);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x88bbff, 1.5);
  fill.position.set(-20, 4, -18);
  scene.add(fill);
  const grid = new THREE.GridHelper(180, 36, 0x35475f, 0x233247);
  grid.position.y = -5;
  grid.material.transparent = true;
  grid.material.opacity = 0.6;
  scene.add(grid);
  const dynamic = new THREE.Group();
  scene.add(dynamic);
  const actors = new THREE.Group(),
    tracks = new THREE.Group();
  scene.add(actors, tracks);
  let aircraftModel,
    drogueModel,
    trajectory = null,
    trackLines = [];
  let worldOffset = new THREE.Vector3();
  function setTrajectory(value) {
    tracks.children.forEach((o) => {
      o.geometry.dispose();
      o.material.dispose();
    });
    tracks.clear();
    trajectory = value;
    trackLines = [];
    if (value)
      for (const [key, color] of [
        ["pU", 0x4580ff],
        ["pT", 0xedaa50],
      ]) {
        const points = value.frames.map((f) => vector(f[key]));
        line(points, color, 0.22, tracks);
        trackLines.push(line(points, color, 1, tracks));
      }
  }
  let labels = [],
    lastState = null,
    lastOptions = null,
    lastLaw = null,
    view = "perspective";
  function vector(a) {
    return new THREE.Vector3(...toScene(a));
  }
  const material = (color, options = {}) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.48,
      metalness: 0.25,
      ...options,
    });
  function mesh(geo, mat, pos = [0, 0, 0], parent = dynamic) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    parent.add(m);
    return m;
  }
  function line(points, color, opacity = 1, parent = dynamic) {
    const g = new THREE.BufferGeometry().setFromPoints(points);
    const m = new THREE.Line(
      g,
      new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }),
    );
    parent.add(m);
    return m;
  }
  function triangle(points, mat, parent) {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(points.flat(), 3),
    );
    g.computeVertexNormals();
    return mesh(g, mat, [0, 0, 0], parent);
  }
  function aircraft(s) {
    const group = new THREE.Group();
    dynamic.add(group);
    const shell = material(0xe3eaf3),
      wing = material(0x9daec5, { side: THREE.DoubleSide }),
      accent = material(0x365fe3),
      dark = material(0x223a55, { metalness: 0.6 });
    const fus = mesh(
      new THREE.CylinderGeometry(0.26, 0.23, 3.3, 18),
      shell,
      [0, 0, 0],
      group,
    );
    fus.rotation.z = -Math.PI / 2;
    const nose = mesh(
      new THREE.ConeGeometry(0.26, 0.85, 18),
      shell,
      [2.075, 0, 0],
      group,
    );
    nose.rotation.z = -Math.PI / 2;
    const canopy = mesh(
      new THREE.SphereGeometry(0.37, 18, 12),
      dark,
      [0.7, 0.17, 0],
      group,
    );
    canopy.scale.set(1.7, 0.65, 0.65);
    triangle(
      [
        [0.65, 0, 0],
        [-0.8, 0, 2.7],
        [-1.05, 0, 0.15],
      ],
      wing,
      group,
    );
    triangle(
      [
        [0.65, 0, 0],
        [-1.05, 0, -0.15],
        [-0.8, 0, -2.7],
      ],
      wing,
      group,
    );
    triangle(
      [
        [-1.05, 0.03, 0],
        [-1.8, 0.03, 1.15],
        [-1.9, 0.03, 0],
      ],
      wing,
      group,
    );
    triangle(
      [
        [-1.05, 0.03, 0],
        [-1.9, 0.03, 0],
        [-1.8, 0.03, -1.15],
      ],
      wing,
      group,
    );
    triangle(
      [
        [-0.9, 0.1, 0],
        [-1.7, 1.1, 0],
        [-1.9, 0.1, 0],
      ],
      material(0x5278d9, { side: THREE.DoubleSide }),
      group,
    );
    const probe = mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.95, 8),
      shell,
      [2.9, -0.05, 0],
      group,
    );
    probe.rotation.z = -Math.PI / 2;
    mesh(new THREE.SphereGeometry(0.08, 8, 8), accent, [3.38, -0.05, 0], group);
    if (norm(s.u) > 1e-10)
      group.quaternion.setFromUnitVectors(
        new THREE.Vector3(1, 0, 0),
        vector(unit(s.u)),
      );
    return group;
  }
  function drogue(s, g) {
    const group = new THREE.Group();
    group.position.copy(vector(s.r));
    dynamic.add(group);
    const fabric = material(0xd9a253, {
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      metalness: 0.05,
    });
    const metal = material(0xe8c58c, { metalness: 0.55 });
    const skirt = mesh(
      new THREE.CylinderGeometry(0.28, 1.05, 1.7, 32, 1, true),
      fabric,
      [0.85, 0, 0],
      group,
    );
    skirt.rotation.z = -Math.PI / 2;
    const ring = mesh(
      new THREE.TorusGeometry(1.05, 0.065, 8, 40),
      metal,
      [0, 0, 0],
      group,
    );
    ring.rotation.y = Math.PI / 2;
    const neck = mesh(
      new THREE.TorusGeometry(0.28, 0.04, 8, 20),
      metal,
      [1.7, 0, 0],
      group,
    );
    neck.rotation.y = Math.PI / 2;
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8;
      line(
        [
          new THREE.Vector3(0, Math.cos(a) * 1.05, Math.sin(a) * 1.05),
          new THREE.Vector3(1.7, Math.cos(a) * 0.28, Math.sin(a) * 0.28),
        ],
        0xf3d6a8,
        0.8,
        group,
      );
    }
    const hoseCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(1.7, 0, 0),
      new THREE.Vector3(3.2, 0.1, 0),
      new THREE.Vector3(5.6, 0.7, 0),
      new THREE.Vector3(7, 0.9, 0),
    ]);
    mesh(
      new THREE.TubeGeometry(hoseCurve, 24, 0.09, 8, false),
      material(0x708098),
      [0, 0, 0],
      group,
    );
    mesh(
      new THREE.SphereGeometry(0.07, 10, 8),
      material(0xffc878),
      [0, 0, 0],
      group,
    );
    const forward = norm(g.vT) > 1e-10 ? g.vT : g.er;
    group.quaternion.setFromUnitVectors(
      new THREE.Vector3(1, 0, 0),
      vector(unit(forward)),
    );
    return group;
  }
  function label(text, position, color = "#dce8f9", offset = [0, 0]) {
    const el = document.createElement("div");
    el.className = "three-label";
    el.textContent = text;
    el.style.color = color;
    host.append(el);
    labels.push({ el, position, offset });
  }
  function arrow(origin, direction, length, color, labelText, offset = [0, 0]) {
    if (norm(direction) < 1e-10 || !(length > 1e-8)) return;
    const o = vector(origin),
      d = vector(unit(direction));
    const arrow = new THREE.ArrowHelper(
      d,
      o,
      length,
      color,
      Math.min(0.55, length * 0.18),
      Math.min(0.25, length * 0.08),
    );
    dynamic.add(arrow);
    if (labelText)
      label(
        labelText,
        o.clone().addScaledVector(d, length + 0.65),
        `#${color.toString(16).padStart(6, "0")}`,
        offset,
      );
  }
  function clear() {
    const geos = new Set(),
      mats = new Set();
    dynamic.traverse((o) => {
      if (o.geometry) geos.add(o.geometry);
      if (o.material)
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
          mats.add(m),
        );
    });
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
    dynamic.clear();
    labels.forEach((l) => l.el.remove());
    labels = [];
  }
  function fit(mode = view) {
    if (!lastState) return;
    view = mode;
    const g = geometry(lastState);
    const r = g.valid ? vector(lastState.r) : new THREE.Vector3(0, 0, -20);
    let target = r.clone().multiplyScalar(0.45).add(worldOffset);
    let extent = Math.max(r.length(), 15);
    if (trajectory) {
      const box = new THREE.Box3();
      for (const f of trajectory.frames)
        box.expandByPoint(vector(f.pU)).expandByPoint(vector(f.pT));
      target = box.getCenter(new THREE.Vector3());
      extent = Math.max(box.getSize(new THREE.Vector3()).length(), 15);
    }
    const R = extent * Math.max(1, 0.95 / camera.aspect);
    controls.target.copy(target);
    camera.up.set(0, 1, 0);
    if (mode === "top") {
      camera.position
        .copy(target)
        .add(new THREE.Vector3(0.001, R * 2.2, 0.001));
      camera.up.set(0, 0, -1);
    } else if (mode === "side")
      camera.position
        .copy(target)
        .add(new THREE.Vector3(R * 2.1, R * 0.06, 0.001));
    else
      camera.position
        .copy(target)
        .add(new THREE.Vector3(R * 1.1, R * 0.85, R * 1.25));
    camera.lookAt(target);
    controls.update();
  }
  function update(
    s,
    law,
    options,
    refit = false,
    frame = null,
    frameIndex = 0,
  ) {
    lastState = s;
    lastOptions = options;
    lastLaw = law;
    clear();
    let g = geometry(s),
      validGeometry = g.valid;
    if (!validGeometry) g = { R: 20, er: [1, 0, 0], vT: add(s.u, s.v) };
    // 模型复用；箭头与标签以当前无人机位置为共同平移原点。
    if (!aircraftModel) {
      aircraftModel = aircraft(s);
      drogueModel = drogue(s, g);
      actors.add(aircraftModel, drogueModel);
      mesh(
        new THREE.SphereGeometry(0.14, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0x47c2b1, depthTest: false }),
        [0, 0, 0],
        aircraftModel,
      ).renderOrder = 10;
    }
    worldOffset.copy(frame ? vector(frame.pU) : new THREE.Vector3());
    dynamic.position.copy(worldOffset);
    actors.position.copy(worldOffset);
    drogueModel.position.copy(vector(s.r));
    if (norm(s.u) > 1e-10)
      aircraftModel.quaternion.setFromUnitVectors(
        new THREE.Vector3(1, 0, 0),
        vector(unit(s.u)),
      );
    const forward = norm(g.vT) > 1e-10 ? g.vT : g.er;
    drogueModel.quaternion.setFromUnitVectors(
      new THREE.Vector3(1, 0, 0),
      vector(unit(forward)),
    );
    trackLines.forEach((l) => l.geometry.setDrawRange(0, frameIndex + 1));
    label(
      "无人机参考点 U",
      new THREE.Vector3(0, -1.4, 0),
      "#c6d5eb",
      [-16, 16],
    );
    label(
      "锥套目标点 T",
      vector(s.r).add(new THREE.Vector3(0, 1.8, 0)),
      "#efd0a0",
      [0, -4],
    );
    const range = Math.max(g.R, 8),
      arrowLen = Math.min(range * 0.28, 18),
      axisLength = Math.min(range * 0.22, 8),
      origin = [0, 0, 0];
    const axisOrigin = [-range * 0.2, -range * 0.35, 4];
    arrow(axisOrigin, [1, 0, 0], axisLength, 0x6d819b, "北 N");
    arrow(axisOrigin, [0, 1, 0], axisLength, 0x6d819b, "东 E");
    arrow(axisOrigin, [0, 0, 1], axisLength, 0x6d819b, "地 D");
    if (validGeometry) {
      const losLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([vector(origin), vector(s.r)]),
        new THREE.LineDashedMaterial({
          color: colors.los,
          dashSize: 0.5,
          gapSize: 0.3,
        }),
      );
      losLine.computeLineDistances();
      dynamic.add(losLine);
      label(
        "视线 r",
        vector(mul(s.r, 0.53)).add(new THREE.Vector3(0, 0.5, 0)),
        "#879db9",
        [0, -8],
      );
    }
    const result = evaluate(law, s),
      all = ["PPN", "TPN", "RTPN", "IPN"].map((id) => evaluate(id, s));
    const accelMax = Math.max(
      1,
      ...all.filter((x) => x.valid).map((x) => x.magnitude),
      result.valid ? result.magnitude : 0,
      result.valid ? norm(result.extra) : 0,
      result.valid ? norm(result.base) : 0,
    );
    const len = (a, type = "a") =>
      options.magnitude
        ? (arrowLen * norm(a)) /
          (type === "a"
            ? accelMax
            : Math.max(1, norm(s.u), norm(s.v), norm(g.vT)))
        : arrowLen;
    if (options.velocities) {
      arrow(origin, s.u, len(s.u, "v"), colors.velocity, "vU", [-10, 15]);
      arrow(s.r, g.vT, len(g.vT, "v"), colors.targetVelocity, "vT", [10, -9]);
      arrow(origin, s.v, len(s.v, "v") * 0.85, 0x93a8ca, "vᵣ", [12, 8]);
      if (["APN", "AIPN"].includes(law))
        arrow(s.r, s.aT, len(s.aT), colors.extra, "aT", [0, 12]);
    }
    if (result.valid) {
      const hasExtra = norm(result.extra) > 1e-10;
      if (norm(result.reference) > 1e-10) {
        arrow(
          origin,
          result.reference,
          arrowLen * 0.72,
          colors.reference,
          "参考",
          [0, 16],
        );
        if (options.plane) {
          const plane = mesh(
            new THREE.CircleGeometry(arrowLen * 0.65, 48),
            new THREE.MeshBasicMaterial({
              color: colors.reference,
              opacity: 0.07,
              transparent: true,
              side: THREE.DoubleSide,
              depthWrite: false,
            }),
          );
          plane.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            vector(unit(result.reference)),
          );
          const outline = [];
          const q = plane.quaternion;
          for (let i = 0; i <= 48; i++) {
            const a = (i / 48) * Math.PI * 2;
            outline.push(
              new THREE.Vector3(
                Math.cos(a) * arrowLen * 0.65,
                Math.sin(a) * arrowLen * 0.65,
                0,
              ).applyQuaternion(q),
            );
          }
          line(outline, colors.reference, 0.3);
        }
      }
      if (options.compare)
        all
          .filter((x) => x.valid && x.id !== law)
          .forEach((x, i) =>
            arrow(origin, x.a, len(x.a), colors[x.id], x.id, [
              i * 6 - 12,
              -8 - i * 9,
            ]),
          );
      if (hasExtra) {
        arrow(
          origin,
          result.base,
          len(result.base),
          0x87a7e8,
          "基座",
          [-12, -8],
        );
        arrow(
          origin,
          result.extra,
          len(result.extra),
          colors.extra,
          ["BPN", "BPPN"].includes(law)
            ? "偏置项"
            : law === "GTPN"
              ? "径向项"
              : "增强项",
          [9, 12],
        );
      }
      if (result.magnitude > 1e-10)
        arrow(
          origin,
          frame ? frame.applied : result.a,
          len(frame ? frame.applied : result.a),
          colors.command,
          (frame?.limited ? "执行 a · " : "a · ") + law,
          [6, -14],
        );
      else label("零加速度指令", new THREE.Vector3(0, 2.8, 0), "#8ab0ff");
    }
    if (refit) fit();
    positionLabels();
  }
  function positionLabels() {
    const w = host.clientWidth,
      h = host.clientHeight;
    for (const l of labels) {
      const p = l.position.clone().add(worldOffset).project(camera);
      const x = ((p.x + 1) * w) / 2 + l.offset[0],
        y = ((1 - p.y) * h) / 2 + l.offset[1];
      l.el.style.left = x + "px";
      l.el.style.top = y + "px";
      l.el.hidden =
        p.z > 1 || p.z < -1 || x < 12 || x > w - 12 || y < 92 || y > h - 42;
    }
  }
  function resize() {
    const w = host.clientWidth,
      h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (lastState) fit();
  }
  new ResizeObserver(resize).observe(host);
  resize();
  let running = true;
  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);
    controls.update();
    positionLabels();
    renderer.render(scene, camera);
  }
  animate();
  return {
    update,
    setTrajectory,
    focus() {
      const saved = trajectory;
      trajectory = null;
      fit();
      trajectory = saved;
    },
    fit,
    renderer,
    camera,
    controls,
    scene,
    dispose() {
      running = false;
      controls.dispose();
      renderer.dispose();
    },
  };
}
