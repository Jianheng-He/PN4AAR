import {
  laws,
  presets,
  sources,
  evaluate,
  geometry,
  norm,
  dot,
} from "./guidance.mjs";
import { createScene } from "./scene.mjs";
const $ = (id) => document.getElementById(id),
  clone = (x) => structuredClone(x);
let state = clone(presets.closing),
  selected = "RTPN",
  scene;
const options = {
  velocities: true,
  plane: false,
  compare: false,
  magnitude: false,
};
const fmt = (x, n = 3) =>
  Number.isFinite(x) ? (Math.abs(x) < 0.5 * 10 ** -n ? 0 : x).toFixed(n) : "—";
const vec = (a) => "[" + a.map((x) => fmt(x, 2)).join(", ") + "]";
const sourceKeys = Object.keys(sources);
for (const law of laws) {
  const b = document.createElement("button");
  b.className = "law-button";
  b.dataset.law = law.id;
  b.setAttribute("aria-pressed", "false");
  b.innerHTML = `<b>${law.id === "ZEM" ? "ZEM-PN" : law.id}</b><small>${law.name.replace("比例导引", "").replace("PN 的 ", "")}</small>`;
  b.addEventListener("click", () => selectLaw(law.id));
  $("law-list").append(b);
}
for (const [key, p] of Object.entries(presets)) {
  const o = document.createElement("option");
  o.value = key;
  o.textContent = p.name;
  $("scenario").append(o);
}
const vectorFields = [
  ["r", "相对位置 r / m"],
  ["u", "本机地速 vU / m·s⁻¹"],
  ["v", "相对速度 vᵣ / m·s⁻¹"],
  ["aT", "目标加速度 aT / m·s⁻²"],
  ["b", "外部偏置 b / m·s⁻²"],
];
for (const [key, text] of vectorFields) {
  const group = document.createElement("div");
  group.className = "vector-field";
  group.innerHTML = `<label>${text}</label><div class="vector-grid"></div>`;
  ["北 N", "东 E", "地 D"].forEach((axis, i) => {
    const input = document.createElement("input");
    input.type = "number";
    input.step = ".1";
    input.value = state[key][i];
    input.dataset.vector = key;
    input.dataset.axis = i;
    input.setAttribute("aria-label", text + " " + axis);
    input.addEventListener("input", () => {
      state[key][i] = input.value === "" ? NaN : Number(input.value);
      update();
    });
    group.lastElementChild.append(input);
  });
  $("vector-inputs").append(group);
}
function populate() {
  document
    .querySelectorAll("[data-vector]")
    .forEach(
      (el) => (el.value = state[el.dataset.vector][Number(el.dataset.axis)]),
    );
  $("gain").value = state.N;
  $("gain-value").value = state.N.toFixed(1);
  specialControls();
}
function specialControls() {
  const host = $("special-controls");
  host.replaceChildren();
  const addInput = (key, label, step, min, max) => {
    const row = document.createElement("div");
    row.className = "special-field";
    const labelEl = document.createElement("label");
    labelEl.className = "field-label";
    labelEl.htmlFor = "special-" + key;
    labelEl.textContent = label;
    const input = document.createElement("input");
    input.type = "number";
    input.id = "special-" + key;
    input.value = state[key];
    input.step = step;
    if (min !== undefined) input.min = min;
    if (max !== undefined) input.max = max;
    input.addEventListener("input", () => {
      state[key] = input.value === "" ? NaN : Number(input.value);
      update();
    });
    row.append(labelEl, input);
    host.append(row);
  };
  if (selected === "TPN") addInput("vc0", "固定初始闭合速度 Vc₀ / m·s⁻¹", ".1");
  if (selected === "GTPN")
    addInput("beta", "从 LOS 法向朝径向偏转 β / °", "1", -90, 90);
  if (["APN", "AIPN", "BPN", "BPPN"].includes(selected)) {
    const key = ["APN", "AIPN"].includes(selected) ? "aT" : "b";
    const box = document.createElement("div");
    box.className = "vector-field";
    box.innerHTML = `<label>${key === "aT" ? "目标加速度 aT" : "偏置 b"} [N, E, D] / m·s⁻²</label><div class="vector-grid"></div>`;
    ["北", "东", "地"].forEach((axis, i) => {
      const input = document.createElement("input");
      input.type = "number";
      input.step = ".1";
      input.value = state[key][i];
      input.dataset.specialVector = key;
      input.dataset.axis = i;
      input.setAttribute("aria-label", "当前导引 " + key + " " + axis);
      input.addEventListener("input", () => {
        state[key][i] = input.value === "" ? NaN : Number(input.value);
        const other = document.querySelector(
          `[data-vector="${key}"][data-axis="${i}"]`,
        );
        other.value = input.value;
        update();
      });
      box.lastElementChild.append(input);
    });
    host.append(box);
    const message = document.createElement("p");
    message.className = "special-message";
    message.textContent =
      key === "aT"
        ? "人工给定的理想机动输入；视觉二次微分不等于可靠测量。"
        : "偏置是外部给定示例；这里不保证末端方向。";
    host.append(message);
  }
}
function selectLaw(id) {
  selected = id;
  specialControls();
  update();
}
function update(refit = false) {
  const law = laws.find((x) => x.id === selected),
    g = geometry(state),
    out = evaluate(selected, state);
  document.querySelectorAll("[data-special-vector]").forEach((input) => {
    if (document.activeElement !== input)
      input.value = Number.isFinite(
        state[input.dataset.specialVector][Number(input.dataset.axis)],
      )
        ? state[input.dataset.specialVector][Number(input.dataset.axis)]
        : "";
  });
  document.querySelectorAll("[data-law]").forEach((el) => {
    el.classList.toggle("selected", el.dataset.law === selected);
    el.setAttribute("aria-pressed", String(el.dataset.law === selected));
  });
  $("scene-law").textContent = selected === "ZEM" ? "ZEM-PN" : selected;
  $("law-title").textContent = $("scene-law").textContent;
  $("law-tag").textContent = law.tag;
  $("law-name").textContent = law.name;
  $("formula").textContent = law.formula;
  $("law-description").textContent = law.description;
  $("law-inputs").textContent = law.inputs;
  $("law-reference").textContent = law.reference;
  $("law-notes").textContent = law.notes;
  $("law-sources").innerHTML = law.sources
    .map(
      (k) =>
        `<a href="${sources[k].url}" target="_blank" rel="noopener noreferrer">文献 [${sourceKeys.indexOf(k) + 1}] ↗</a>`,
    )
    .join("");
  $("metric-range").textContent = g.valid ? fmt(g.R, 2) : "—";
  $("metric-closing").textContent = g.valid ? fmt(g.vc, 2) : "—";
  $("metric-omega").textContent = g.valid ? fmt(norm(g.omega), 3) : "—";
  ["n", "e", "d"].forEach(
    (axis, i) =>
      ($("out-" + axis).textContent = out.valid ? fmt(out.a[i]) : "—"),
  );
  $("out-mag").textContent = out.valid ? fmt(out.magnitude) + " m/s²" : "—";
  $("base-value").textContent = out.valid ? vec(out.base) : "—";
  $("extra-value").textContent = out.valid ? vec(out.extra) : "—";
  let check = "";
  if (out.valid) {
    if (out.orthogonal && norm(out.orthogonal) > 1e-10)
      check = "✓ 公式校验：a 与参考方向正交";
    else if (selected === "AIPN") check = "✓ 公式校验：a − aT 与 vᵣ 正交";
    else if (selected === "GTPN") check = "✓ 指令位于所声明的瞬时 LOS 平面";
    else check = "○ 参考速度为零，方向未定义；指令为零。";
  } else check = "— " + out.reason;
  $("check-line").textContent = check;
  let warning = "";
  if (!out.valid) warning = out.reason;
  else if (g.vc <= 0)
    warning =
      "当前闭合速度 ≤ 0。公式保留符号；这不是正在接近的状态，不据此保证捕获。";
  else if (norm(state.v) < 1e-10)
    warning = "相对静止：基础 PN 为零，不能仅凭视线不转就认为正在对接。";
  $("scene-warning").hidden = !warning;
  $("scene-warning").textContent = warning;
  $("comparison-body").innerHTML = laws
    .map((l) => {
      const r = evaluate(l.id, state);
      return `<tr class="${l.id === selected ? "selected-row" : ""}"><td><button data-row="${l.id}">${l.id === "ZEM" ? "ZEM-PN" : l.id}</button></td><td>${l.tag}</td><td>${r.valid ? vec(r.a) : "不适用"}</td><td>${r.valid ? fmt(r.radial) : "—"}</td><td>${r.valid ? fmt(r.magnitude) : "—"}</td></tr>`;
    })
    .join("");
  $("comparison-body")
    .querySelectorAll("button")
    .forEach((b) =>
      b.addEventListener("click", () => selectLaw(b.dataset.row)),
    );
  $("scale-note").textContent = options.magnitude
    ? "位置按米绘制；同一状态下，加速度箭头共用比例、速度箭头另用比例。参考方向仍为单位示意，二者量纲不混比。"
    : "位置按米绘制；向量箭头仅表示方向，真实大小见数值。不同量纲不共用长度比例。";
  const finiteVectors = ["r", "u", "v", "aT", "b"].every((key) =>
    state[key].every(Number.isFinite),
  );
  $("viewport").style.opacity = finiteVectors ? "1" : ".3";
  if (scene && finiteVectors) scene.update(state, selected, options, refit);
  window.__PNLAB__ = {
    state: clone(state),
    selected,
    result: out,
    geometry: g,
    options: { ...options },
    selectLaw,
    evaluate,
    renderReady: !!scene,
  };
}
$("scenario").addEventListener("change", () => {
  state = clone(presets[$("scenario").value]);
  populate();
  update(true);
});
$("reset-state").addEventListener("click", () => {
  state = clone(presets[$("scenario").value]);
  populate();
  update(true);
});
$("gain").addEventListener("input", () => {
  state.N = Number($("gain").value);
  $("gain-value").value = state.N.toFixed(1);
  update();
});
for (const [id, key] of [
  ["show-velocities", "velocities"],
  ["show-plane", "plane"],
  ["show-compare", "compare"],
])
  $(id).addEventListener("change", () => {
    options[key] = $(id).checked;
    update();
  });
$("length-mode").addEventListener("change", () => {
  options.magnitude = $("length-mode").value === "magnitude";
  update();
});
document.querySelectorAll("[data-view]").forEach((b) =>
  b.addEventListener("click", () => {
    scene?.fit(b.dataset.view);
    document.querySelectorAll("[data-view]").forEach((x) => {
      x.classList.toggle("active", x === b);
      x.setAttribute("aria-pressed", String(x === b));
    });
  }),
);
$("fit-view").addEventListener("click", () => scene?.fit());
$("expand-view").addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $("scene-shell").requestFullscreen();
  } catch {
    $("scene-warning").hidden = false;
    $("scene-warning").textContent =
      "当前浏览器不支持全屏；可继续拖动与缩放场景。";
  }
});
$("reference-list").innerHTML = sourceKeys
  .map(
    (key, i) =>
      `<a href="${sources[key].url}" target="_blank" rel="noopener noreferrer"><span>[${i + 1}]</span>${sources[key].name} ↗</a>`,
  )
  .join("");
try {
  scene = createScene($("viewport"));
} catch (error) {
  $("viewport").innerHTML =
    '<div class="error-fallback">当前浏览器无法创建 WebGL 3D 场景。请开启硬件加速后刷新；公式、参数与数值比较仍可使用。</div>';
  console.error(error);
}
populate();
update(true);
