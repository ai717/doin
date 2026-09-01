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

export function createBoardRenderer(board, { onTrack, onDock }) {
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
    const nebula = svg("radialGradient", { id: "space-nebula", cx: "50%", cy: "48%", r: "68%" });
    nebula.append(
      svg("stop", { offset: "0%", "stop-color": "#3859bd", "stop-opacity": ".3" }),
      svg("stop", { offset: "55%", "stop-color": "#242d87", "stop-opacity": ".13" }),
      svg("stop", { offset: "100%", "stop-color": "#080d2c", "stop-opacity": "0" }),
    );
    defs.append(nebula);
    const nebulaBlur = svg("filter", { id: "nebula-blur", x: "-30%", y: "-30%", width: "160%", height: "160%" });
    nebulaBlur.append(svg("feGaussianBlur", { stdDeviation: 24 }));
    defs.append(nebulaBlur);
    layers.background.append(
      defs,
      svg("ellipse", { class: "space-disc", cx: CENTER.x, cy: CENTER.y, rx: 454, ry: 390, fill: "#081131", stroke: "#23386f", "stroke-width": 8 }),
      svg("ellipse", { class: "nebula-cloud", cx: CENTER.x, cy: CENTER.y, rx: 410, ry: 350, fill: "url(#space-nebula)" }),
      svg("path", { class: "nebula-wisp nebula-wisp-blue", d: "M 18 276 C 178 116, 302 244, 418 152 S 690 78, 984 218" }),
      svg("path", { class: "nebula-wisp nebula-wisp-violet", d: "M -20 638 C 158 470, 292 588, 424 478 S 726 376, 1020 536" }),
      svg("path", { class: "nebula-wisp nebula-wisp-cyan", d: "M 126 70 C 262 210, 394 194, 520 278 S 776 358, 930 286" }),
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
        [210, 178], [684, 152], [780, 566],
      ].map(([cx, cy]) => svg("path", { class: "bright-star", d: `M ${cx - 12} ${cy} H ${cx + 12} M ${cx} ${cy - 12} V ${cy + 12}` })),
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
      const mouthMarker = svg("circle", { class: "track-mouth", cx: mouth.x, cy: mouth.y, r: 17 });
      const farMarker = svg("circle", { class: "track-end", cx: far.x, cy: far.y, r: 10 });
      const ticks = [220, 290, 360].map((radius) => {
        const point = pointAt(angle, radius);
        return svg("circle", { class: "track-tick", cx: point.x, cy: point.y, r: 3 });
      });
      const symbol = svg("text", { class: "track-symbol", x: far.x, y: far.y + 9, "text-anchor": "middle" });
      group.append(hit, glow, rail, inner, mouthMarker, farMarker, ...ticks, symbol);
      group.addEventListener("click", () => onTrack(track.id));
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onTrack(track.id);
        }
      });
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
      const x = CENTER.x + (index - (state.docks.length - 1) / 2) * 108;
      const group = svg("g", { class: "dock", tabindex: 0, role: "button" });
      const base = svg("circle", { class: "dock-base", cx: x, cy: CENTER.y, r: 43 });
      const label = svg("text", { class: "dock-label", x, y: CENTER.y + 8 });
      group.append(base, label);
      group.addEventListener("click", () => onDock(dock.id));
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onDock(dock.id);
        }
      });
      core.append(group);
      dockNodes.set(dock.id, { group, x, label });
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
      record.group.setAttribute("aria-label", `中转槽 ${dock.id + 1}，${dock.orb ? `颜色 ${dock.orb.color + 1}` : "空，可点击后继续调入"}${state.selectedDockId === dock.id ? "，已选中" : ""}`);
      record.label.textContent = String(dock.id + 1);
      if (dock.orb) {
        const node = ensureOrb(dock.orb);
        node.dataset.completed = "false";
        node.dataset.selected = String(state.selectedDockId === dock.id);
        setPosition(node, { x: record.x, y: CENTER.y });
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
    const from = fromTrack ? pointAt(fromTrack.angle, 236) : fromDock ? { x: fromDock.x, y: CENTER.y } : null;
    const to = toTrack ? pointAt(toTrack.angle, 236) : toDock ? { x: toDock.x, y: CENTER.y } : null;
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
      addBurst(trackId, "completion-burst", 286);
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
