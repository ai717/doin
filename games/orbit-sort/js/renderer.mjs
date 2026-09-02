import { canExtract, canInsert } from "../engine.mjs?v=dev";

const NS = "http://www.w3.org/2000/svg";
const CENTER = { x: 500, y: 500 };
const COLORS = ["#ff6e78", "#6b9cff", "#68d69b", "#c18bff", "#ffad62", "#e6d36f"];
const PLANET_SHADOWS = ["#8e253f", "#24428d", "#1d7b62", "#5b2e9f", "#9a4d29", "#9d8326"];

function svg(name, attributes = {}) {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function pointAt(angle, radius) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: CENTER.x + Math.cos(radians) * radius,
    y: CENTER.y + Math.sin(radians) * radius * 0.86,
  };
}

function setPosition(node, point) {
  node.setAttribute("transform", `translate(${point.x} ${point.y})`);
}

function labelForTrack(track, capacity) {
  const top = track.orbs.at(-1);
  const mode = track.mode === "normal" ? "" : `，${track.mode}`;
  return `轨道 ${track.id + 1}${mode}，${top ? `入口颜色 ${top.color + 1}` : "空"}，共 ${track.orbs.length} 颗，容量 ${capacity}`;
}

function pressFeedback(node) {
  node.addEventListener("pointerdown", () => node.classList.add("is-pressed"));
  for (const type of ["pointerup", "pointerleave", "pointercancel"]) {
    node.addEventListener(type, () => node.classList.remove("is-pressed"));
  }
}

export function createBoardRenderer(board, { onTrack, onDock }) {
  board.setAttribute("overflow", "visible");
  const layers = Object.fromEntries(
    [...board.querySelectorAll("[data-layer]")].map((node) => [node.dataset.layer, node]),
  );
  const trackNodes = new Map();
  const orbNodes = new Map();
  const dockNodes = new Map();
  let trackCount = 0;
  let capacity = 0;

  function buildStructure(state) {
    for (const layer of Object.values(layers)) layer.replaceChildren();
    trackNodes.clear();
    orbNodes.clear();
    dockNodes.clear();
    trackCount = state.tracks.length;
    capacity = state.capacity;

    const defs = svg("defs");
    COLORS.forEach((color, index) => {
      const gradient = svg("radialGradient", {
        id: `planet-gradient-${index}`,
        cx: "32%",
        cy: "26%",
        r: "76%",
      });
      gradient.append(
        svg("stop", { offset: "0%", "stop-color": "#ffffff", "stop-opacity": ".78" }),
        svg("stop", { offset: "24%", "stop-color": color, "stop-opacity": "1" }),
        svg("stop", { offset: "100%", "stop-color": PLANET_SHADOWS[index], "stop-opacity": "1" }),
      );
      defs.append(gradient);
    });
    const nebula = svg("radialGradient", { id: "space-nebula", cx: "50%", cy: "48%", r: "82%" });
    nebula.append(
      svg("stop", { offset: "0%", "stop-color": "#2b4597", "stop-opacity": ".26" }),
      svg("stop", { offset: "38%", "stop-color": "#212a7a", "stop-opacity": ".12" }),
      svg("stop", { offset: "72%", "stop-color": "#0c1344", "stop-opacity": ".05" }),
      svg("stop", { offset: "100%", "stop-color": "#000000", "stop-opacity": "0" }),
    );
    defs.append(nebula);
    const nebula2 = svg("radialGradient", { id: "space-nebula-purple", cx: "50%", cy: "48%", r: "82%" });
    nebula2.append(
      svg("stop", { offset: "0%", "stop-color": "#6a2f9f", "stop-opacity": ".22" }),
      svg("stop", { offset: "42%", "stop-color": "#3a1c75", "stop-opacity": ".10" }),
      svg("stop", { offset: "78%", "stop-color": "#0d0840", "stop-opacity": ".04" }),
      svg("stop", { offset: "100%", "stop-color": "#000000", "stop-opacity": "0" }),
    );
    defs.append(nebula2);
    const nebulaBlur = svg("filter", { id: "nebula-blur", x: "-60%", y: "-60%", width: "220%", height: "220%" });
    nebulaBlur.append(svg("feGaussianBlur", { stdDeviation: 20 }));
    defs.append(nebulaBlur);
    const glow = svg("radialGradient", { id: "space-glow", cx: "50%", cy: "50%", r: "50%" });
    glow.append(
      svg("stop", { offset: "0%", "stop-color": "#ffffff", "stop-opacity": ".03" }),
      svg("stop", { offset: "60%", "stop-color": "#ffffff", "stop-opacity": ".008" }),
      svg("stop", { offset: "100%", "stop-color": "#ffffff", "stop-opacity": "0" }),
    );
    defs.append(glow);
    layers.background.append(
      defs,
      // 星云完全扩散超出 SVG viewBox 1000×1000 边界 → 与 game-shell 外层星云无缝对接，零硬切割
      svg("ellipse", { class: "nebula-cloud", cx: CENTER.x, cy: CENTER.y, rx: 820, ry: 740, fill: "url(#space-nebula)", filter: "url(#nebula-blur)" }),
      svg("ellipse", { class: "nebula-cloud nebula-cloud-purple", cx: CENTER.x + 200, cy: CENTER.y + 140, rx: 720, ry: 640, fill: "url(#space-nebula-purple)", filter: "url(#nebula-blur)", opacity: ".7" }),
      svg("ellipse", { class: "space-glow", cx: CENTER.x, cy: CENTER.y, rx: 700, ry: 700, fill: "url(#space-glow)" }),
      // 用路径画出 3 条弯曲星云流束（远远超出 viewBox，左右两端都延伸出画面）
      svg("path", { class: "nebula-wisp nebula-wisp-blue", d: "M -220 222 C -6 60, 160 206, 336 130 S 680 12, 1260 208" }),
      svg("path", { class: "nebula-wisp nebula-wisp-violet", d: "M -260 642 C -40 444, 168 612, 346 492 S 736 340, 1280 556" }),
      svg("path", { class: "nebula-wisp nebula-wisp-cyan", d: "M -120 30 C 124 234, 292 210, 454 308 S 784 420, 1150 332" }),
      ...[
        [48, 74, 1.2], [116, 132, .7], [188, 62, .9], [274, 118, .55], [352, 42, 1.1],
        [438, 92, .65], [526, 54, .8], [612, 136, 1.15], [704, 78, .6], [786, 152, .85],
        [846, 58, .5], [92, 286, .65], [216, 334, .45], [674, 294, .7], [824, 342, .55],
        [58, 486, .8], [164, 566, .5], [302, 526, .7], [586, 548, .55], [748, 492, .75],
      ].map(([cx, cy, r]) => svg("circle", { class: "star-dust", cx, cy, r })),
      ...[
        [82, 156], [244, 92], [392, 238], [566, 116], [734, 204], [884, 102],
        [144, 430], [328, 368], [612, 432], [822, 378], [914, 594], [266, 662],
      ].map(([cx, cy]) => svg("circle", { class: "star-speck", cx, cy, r: 2 })),
      ...[
        [210, 178, 3], [684, 152, 3.4], [780, 566, 2.8],
      ].map(([cx, cy, r]) => {
        const gid = `bg_${cx}_${cy}`;
        return svg("g", {}, [
          svg("radialGradient", { id: gid, cx: "50%", cy: "50%", r: "50%" }, [
            svg("stop", { offset: "0%", "stop-color": "#ffffff", "stop-opacity": 1 }),
            svg("stop", { offset: "42%", "stop-color": "#e3f0ff", "stop-opacity": .48 }),
            svg("stop", { offset: "100%", "stop-color": "#9ec5ff", "stop-opacity": 0 }),
          ]),
          svg("circle", { class: "bright-star-core", cx, cy, r: r * 2.4, fill: `url(#${gid})` }),
          svg("circle", { class: "bright-star-point", cx, cy, r, fill: "#ffffff" }),
        ]);
      }),
      svg("ellipse", { cx: CENTER.x, cy: CENTER.y, rx: 322, ry: 274, fill: "none", stroke: "#1b2f61", "stroke-width": 3, "stroke-dasharray": "6 12" }),
    );

    state.tracks.forEach((track, index) => {
      const angle = -90 + index * (360 / trackCount);
      const mouth = pointAt(angle, 150);
      const far = pointAt(angle, 430);
      const group = svg("g", { class: "track", tabindex: 0, role: "button" });
      const hit = svg("path", { class: "track-hit", d: `M ${mouth.x} ${mouth.y} L ${far.x} ${far.y}`, "stroke-width": 92 });
      const glow = svg("path", { class: "track-glow", d: `M ${mouth.x} ${mouth.y} L ${far.x} ${far.y}` });
      const rail = svg("path", { class: "track-rail", d: `M ${mouth.x} ${mouth.y} L ${far.x} ${far.y}` });
      const inner = svg("path", { class: "track-inner", d: `M ${mouth.x} ${mouth.y} L ${far.x} ${far.y}` });
      // 轨道内部一条平滑的"中点虚线"（代替每个座位画虚线小圆，消除内部锯齿）
      const seatStart = pointAt(angle, 178);
      const seatEnd = pointAt(angle, 430);
      const seatLine = svg("path", { class: "track-seat-line", d: `M ${seatStart.x} ${seatStart.y} L ${seatEnd.x} ${seatEnd.y}` });
      // 小锚点：每个座位位置一个不显眼的小实心点（对齐球的真实落点，辅助视觉感知空位）
      const step = (430 - 178) / Math.max(1, capacity - 1);
      const seatMarkers = Array.from({ length: capacity }, (_, slot) => {
        const p = pointAt(angle, 178 + slot * step);
        return svg("circle", { class: "track-seat-dot", cx: p.x, cy: p.y, r: 2.6 });
      });
      const mouthMarker = svg("circle", { class: "track-mouth", cx: mouth.x, cy: mouth.y, r: 17 });
      const farMarker = svg("circle", { class: "track-end", cx: far.x, cy: far.y, r: 10 });
      const symbol = svg("text", { class: "track-symbol", x: far.x, y: far.y + 9, "text-anchor": "middle" });
      group.append(hit, glow, rail, inner, seatLine, ...seatMarkers, mouthMarker, farMarker, symbol);
      group.addEventListener("click", () => onTrack(track.id));
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onTrack(track.id);
        }
      });
      pressFeedback(group);
      layers.tracks.append(group);
      trackNodes.set(track.id, { group, symbol, angle });
    });

    const core = svg("g");
    core.append(
      svg("circle", { class: "core-shell", cx: CENTER.x, cy: CENTER.y, r: 126 }),
      svg("circle", { class: "core-orbit", cx: CENTER.x, cy: CENTER.y, r: 105 }),
      svg("circle", { class: "core-ring", cx: CENTER.x, cy: CENTER.y, r: 75 }),
      svg("circle", { class: "core-beacon", cx: CENTER.x, cy: CENTER.y, r: 9 }),
    );
    state.docks.forEach((dock, index) => {
      // Layout: 1 dock → exact center. 2+ docks → evenly spaced on the
      // horizontal centerline. 164 px centre-to-centre keeps two docks
      // (r=43) inside the 126-px core-shell outer ring and clear of the
      // track mouths at radius 150.
      const spacing = state.docks.length === 1 ? 0 : 164;
      const x = CENTER.x + (index - (state.docks.length - 1) / 2) * spacing;
      const y = CENTER.y;
      const group = svg("g", { class: "dock", tabindex: 0, role: "button" });
      // 黑洞风格：外吸积盘光晕 + 4 臂对数螺旋漩涡 + 扁椭圆薄吸积盘 + 事件视界 + 引力透镜
      const halo = svg("ellipse", { class: "dock-halo", cx: x, cy: y, rx: 74, ry: 74 });
      // 漩涡：4 条对数螺旋臂（r = a*e^(bθ)），顺时针旋转 4 圈，从 r=14 渐涨到 r=58
      (function buildVortex() {
        function spiralArm(cx, cy, turns, phase, width) {
          const steps = 220, b = 0.07, a = 2;
          let d = "";
          for (let i = 0; i <= steps; i++) {
            const t = (i / steps) * turns * Math.PI * 2 + phase;
            const r = a * Math.exp(b * t);
            if (r > 58) break;
            const px = cx + Math.cos(t) * r;
            const py = cy + Math.sin(t) * r * 0.62; // 略微扁化模拟俯视倾角
            d += (i === 0 ? "M" : "L") + Number(px.toFixed(2)) + "," + Number(py.toFixed(2)) + " ";
          }
          return svg("path", { class: "dock-vortex-arm", d: d, stroke: "rgba(145, 205, 255, " + width + ")", "stroke-width": (2.6 + parseFloat(width) * 3).toFixed(2), fill: "none", "stroke-linecap": "round" });
        }
        const arms = svg("g", { class: "dock-vortex", transform: "translate(0 0)" });
        arms.append(
          spiralArm(x, y, 3.2, 0, .32),
          spiralArm(x, y, 3.2, Math.PI / 2, .22),
          spiralArm(x, y, 3.2, Math.PI, .18),
          spiralArm(x, y, 3.2, 3 * Math.PI / 2, .14),
        );
        // 漩涡内部反向旋转的小内环（模拟帧拖拽）
        const inner = svg("g", { class: "dock-vortex-inner" });
        for (let i = 0; i < 3; i++) {
          const p = (i / 3) * Math.PI * 2;
          const rr = 10 + i * 2.2;
          inner.append(svg("circle", { class: "dock-vortex-mote", cx: x + Math.cos(p) * rr, cy: y + Math.sin(p) * rr * 0.6, r: 1.6 + i * 0.2, fill: `rgba(${i === 0 ? "255,216,170" : i === 1 ? "162,219,255" : "212,184,255"},.${64 - i * 16})` }));
        }
        // 事件视界：纯黑 + 径向光晕（外面暗蓝 → 内部纯黑）
        const horizonGrad = svg("radialGradient", { id: `dock-black-${x}-${y}`, cx: "50%", cy: "50%", r: "50%", spreadMethod: "pad" });
        horizonGrad.append(
          svg("stop", { offset: "0%", "stop-color": "#000000", "stop-opacity": "1" }),
          svg("stop", { offset: "58%", "stop-color": "#000005", "stop-opacity": "1" }),
          svg("stop", { offset: "76%", "stop-color": "#030a2a", "stop-opacity": ".95" }),
          svg("stop", { offset: "100%", "stop-color": "rgba(45, 88, 212, 0)", "stop-opacity": "0" }),
        );
        // 光帧拖拽环：外圈极细的相对论光束
        const ring = svg("circle", { class: "dock-photon-ring", cx: x, cy: y, r: 41 });
        const ringThin = svg("circle", { class: "dock-photon-ring dock-photon-ring-thin", cx: x, cy: y, r: 35 });
        defs.append(horizonGrad);
        // 按正确的后层 → 前层的绘制顺序全部插到 group 里（halo 已在最末尾 append，这里先不装）
        group.append(arms, inner, ring, ringThin);
      })();
      const disk = svg("ellipse", { class: "dock-disk", cx: x, cy: y, rx: 52, ry: 18, transform: `rotate(-14 ${x} ${y})` });
      const diskInner = svg("ellipse", { class: "dock-disk dock-disk-inner", cx: x, cy: y, rx: 34, ry: 10, transform: `rotate(-14 ${x} ${y})` });
      const base = svg("circle", { class: "dock-base", cx: x, cy: y, r: 43 });
      const horizon = svg("circle", { class: "dock-horizon", cx: x, cy: y, r: 30 });
      horizon.setAttribute("fill", `url(#dock-black-${x}-${y})`);
      const lense = svg("circle", { class: "dock-lense", cx: x, cy: y - 3, r: 28 });
      // 层序：halo (最底层光晕) → disk (吸积盘) → base (外圈壳) → horizon(黑洞视界) → lense(透镜)
      // 漩涡 arms/inner/光子环 已经在最底层 append，顺序正确
      group.prepend(halo);
      group.append(disk, diskInner, base, horizon, lense);
      group.addEventListener("click", () => onDock(dock.id));
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onDock(dock.id);
        }
      });
      pressFeedback(group);
      core.append(group);
      dockNodes.set(dock.id, { group, x, y });
    });
    layers.core.append(core);
  }

  function ensureOrb(orb) {
    let node = orbNodes.get(orb.id);
    if (node) return node;
    node = svg("g", { class: "orb", tabindex: -1, "data-color": orb.color });
    const color = COLORS[orb.color] ?? COLORS[0];
    const aura = svg("circle", { class: "orb-aura", r: 40, fill: color });
    const surface = svg("g", { class: "orb-surface" });
    const shape = svg("circle", { class: "orb-shape", r: 34, fill: `url(#planet-gradient-${orb.color ?? 0})` });
    const atmosphere = svg("circle", { class: "orb-atmosphere", r: 31, fill: "none" });
    const cloud = svg("ellipse", { class: "orb-cloud", cx: -2, cy: 7, rx: 25, ry: 5, transform: "rotate(-18)" });
    const glint = svg("ellipse", { class: "orb-glint", cx: -12, cy: -14, rx: 10, ry: 6, transform: "rotate(-28)" });
    const ring = svg("ellipse", { class: "orb-ring", cx: 0, cy: 1, rx: 27, ry: 10, transform: "rotate(-18)" });
    surface.append(shape, atmosphere, cloud, glint, ring);
    node.append(aura, surface);
    layers.orbs.append(node);
    orbNodes.set(orb.id, node);
    return node;
  }

  function render(state) {
    if (state.tracks.length !== trackCount || state.capacity !== capacity) buildStructure(state);
    board.dataset.phase = state.selectedDockId === null ? "picking" : "placing";
    const visibleOrbIds = new Set();

    state.tracks.forEach((track) => {
      const record = trackNodes.get(track.id);
      const hasSelectedDock = state.selectedDockId !== null;
      const legal = hasSelectedDock
        ? canInsert(state, state.selectedDockId, track.id)
        : canExtract(state, track.id);
      record.group.dataset.legal = String(legal);
      record.group.dataset.completed = String(track.completed);
      record.group.dataset.mode = track.mode;
      record.group.setAttribute("aria-label", labelForTrack(track, state.capacity));
      record.symbol.textContent = track.mode === "in-only" ? "↓" : track.mode === "out-only" ? "↑" : track.mode === "frozen" ? "❄" : "";

      const gap = (430 - 178) / Math.max(1, state.capacity - 1);
      track.orbs.forEach((orb, index) => {
        const node = ensureOrb(orb);
        node.dataset.completed = String(track.completed);
        node.dataset.selected = "false";
        node.setAttribute("aria-label", `颜色 ${orb.color + 1} 的星球`);
        // The engine stores [far end, ..., mouth]. Remaining orbs must pack
        // against the mouth, so index 0 is not always the far-end position.
        setPosition(node, pointAt(record.angle, 178 + (track.orbs.length - 1 - index) * gap));
        visibleOrbIds.add(orb.id);
      });
    });

    state.docks.forEach((dock) => {
      const record = dockNodes.get(dock.id);
      record.group.dataset.selected = String(state.selectedDockId === dock.id);
      record.group.dataset.occupied = String(Boolean(dock.orb));
      const orbHint = dock.orb
        ? "颜色 " + String(dock.orb.color + 1)
        : "空，可点击后继续调入";
      const selectHint = state.selectedDockId === dock.id ? "，已选中" : "";
      const ariaText = "中转槽 " + String(dock.id + 1) + "，" + orbHint + selectHint;
      record.group.setAttribute("aria-label", ariaText);
      if (dock.orb) {
        const node = ensureOrb(dock.orb);
        node.dataset.completed = "false";
        node.dataset.selected = String(state.selectedDockId === dock.id);
        setPosition(node, { x: record.x, y: record.y });
        visibleOrbIds.add(dock.orb.id);
      }
    });

    for (const [orbId, node] of orbNodes) {
      if (!visibleOrbIds.has(orbId)) {
        node.remove();
        orbNodes.delete(orbId);
      }
    }
  }

  function flash(node, className) {
    if (!node) return;
    node.classList.remove(className);
    void node.getBoundingClientRect();
    node.classList.add(className);
    window.setTimeout(() => node.classList.remove(className), 240);
  }

  function addBurst(trackId, className, radius) {
    const record = trackNodes.get(trackId);
    if (!record) return;
    const point = pointAt(record.angle, radius);
    const burst = svg("circle", { class: className, cx: point.x, cy: point.y, r: 30 });
    layers["overlay-effects"].append(burst);
    window.setTimeout(() => burst.remove(), className === "completion-burst" ? 760 : 500);
  }

  function showTransfer({ fromTrackId, fromDockId, toTrackId, toDockId }) {
    const fromTrack = trackNodes.get(fromTrackId);
    const toTrack = trackNodes.get(toTrackId);
    const fromDock = dockNodes.get(fromDockId);
    const toDock = dockNodes.get(toDockId);
    const from = fromTrack ? pointAt(fromTrack.angle, 236) : fromDock ? { x: fromDock.x, y: fromDock.y } : null;
    const to = toTrack ? pointAt(toTrack.angle, 236) : toDock ? { x: toDock.x, y: toDock.y } : null;
    if (!from || !to) return;
    const trail = svg("path", { class: "transfer-trail", d: `M ${from.x} ${from.y} L ${to.x} ${to.y}` });
    layers["track-effects"].append(trail);
    window.setTimeout(() => trail.remove(), 300);
  }

  return {
    render,
    flashTrack(trackId) {
      flash(trackNodes.get(trackId)?.group, "is-illegal");
    },
    flashDock(dockId) {
      flash(dockNodes.get(dockId)?.group, "is-illegal");
    },
    showCompletion(trackId) {
      const record = trackNodes.get(trackId);
      addBurst(trackId, "completion-burst", 286);
      if (!record) return;
      const point = pointAt(record.angle, 286);
      for (let index = 0; index < 10; index += 1) {
        const angle = (Math.PI * 2 * index) / 10;
        const distance = 104 + (index % 3) * 28;
        const spark = svg("circle", {
          class: "completion-spark",
          cx: point.x,
          cy: point.y,
          r: 7 - (index % 3) * 2,
          style: `--dx:${(Math.cos(angle) * distance).toFixed(1)}px;--dy:${(Math.sin(angle) * distance).toFixed(1)}px`,
        });
        layers["overlay-effects"].append(spark);
        window.setTimeout(() => spark.remove(), 800);
      }
    },
    showUnfreeze(trackId) {
      addBurst(trackId, "unfreeze-burst", 154);
    },
    highlightTrack(trackId) {
      for (const record of trackNodes.values()) record.group.classList.remove("is-hint");
      trackNodes.get(trackId)?.group.classList.add("is-hint");
    },
    clearHint() {
      for (const record of trackNodes.values()) record.group.classList.remove("is-hint");
    },
    showGuide(trackId) {
      const record = trackNodes.get(trackId);
      if (!record) return;
      record.group.classList.add("is-guide");
    },
    clearGuide() {
      for (const record of trackNodes.values()) record.group.classList.remove("is-guide");
    },
    showTransfer,
  };
}
