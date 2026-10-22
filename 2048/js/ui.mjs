import { SIZE } from "./engine.mjs";
import { htmlLang, strings } from "./i18n.mjs";

const glyph = (paths) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const ICONS = {
  undo: glyph('<path d="M9 14 4 9l5-5"/><path d="M4 9h8.5a5.5 5.5 0 0 1 0 11H8"/>'),
  soundOn: glyph(
    '<path d="M4 9.5h3L11 6v12l-4-3.5H4z"/><path d="M15 9.2a4 4 0 0 1 0 5.6"/><path d="M17.5 6.8a7.5 7.5 0 0 1 0 10.4"/>',
  ),
  soundOff: glyph('<path d="M4 9.5h3L11 6v12l-4-3.5H4z"/><path d="M15.5 9.5l5 5"/><path d="M20.5 9.5l-5 5"/>'),
  sun: glyph(
    '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>',
  ),
  moon: glyph('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5z"/>'),
  help: glyph('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.4 2.4 0 1 1 3.4 2.2c-.7.35-1 .95-1 1.7"/><path d="M12 17h.01"/>'),
  restart: glyph('<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4.5V10h-5.5"/>'),
  up: glyph('<path d="M12 19V6"/><path d="M6 11l6-6 6 6"/>'),
  down: glyph('<path d="M12 5v13"/><path d="M6 13l6 6 6-6"/>'),
  left: glyph('<path d="M19 12H6"/><path d="M11 6l-6 6 6 6"/>'),
  right: glyph('<path d="M5 12h13"/><path d="M13 6l6 6-6 6"/>'),
};

const DIR_ICON = { up: ICONS.up, down: ICONS.down, left: ICONS.left, right: ICONS.right };
const DIR_LABEL = { up: "dirUp", down: "dirDown", left: "dirLeft", right: "dirRight" };
const TOP_CAP = 131072;

export function createUi(actions) {
  const board = document.getElementById("board");
  const grid = document.getElementById("board-grid");
  const layer = document.getElementById("tiles");
  const overlay = document.getElementById("overlay");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const gainEl = document.getElementById("score-gain");
  const announceEl = document.getElementById("announce");
  const statEls = {
    games: document.getElementById("stat-games"),
    wins: document.getElementById("stat-wins"),
    top: document.getElementById("stat-top"),
  };
  const undoBtn = document.getElementById("undo");
  const muteBtn = document.getElementById("mute");
  const themeBtn = document.getElementById("theme");
  const helpBtn = document.getElementById("help");
  const newBtn = document.getElementById("new-game");
  const newIcon = document.getElementById("new-game-icon");
  const langBtn = document.getElementById("lang");
  const padButtons = Array.from(document.querySelectorAll(".btn-pad"));

  const nodes = new Map();
  let copy = strings("zh");
  let theme = "light";
  let muted = false;
  let overlayKind = "none";

  for (let i = 0; i < SIZE * SIZE; i++) grid.append(document.createElement("span"));
  undoBtn.innerHTML = ICONS.undo;
  helpBtn.innerHTML = ICONS.help;
  newIcon.innerHTML = ICONS.restart;
  muteBtn.innerHTML = ICONS.soundOn;
  themeBtn.innerHTML = ICONS.moon;

  for (const button of padButtons) {
    button.innerHTML = DIR_ICON[button.dataset.dir];
    button.addEventListener("click", () => actions.move(button.dataset.dir));
  }
  undoBtn.addEventListener("click", () => actions.undo());
  muteBtn.addEventListener("click", () => actions.toggleMute());
  themeBtn.addEventListener("click", () => actions.toggleTheme());
  helpBtn.addEventListener("click", () => actions.toggleHelp());
  newBtn.addEventListener("click", () => actions.requestRestart());
  langBtn.addEventListener("click", () => actions.toggleLocale());

  function paintLabels() {
    undoBtn.setAttribute("aria-label", copy.undo);
    undoBtn.setAttribute("title", copy.undo);
    muteBtn.setAttribute("aria-label", muted ? copy.unmute : copy.mute);
    muteBtn.setAttribute("title", muted ? copy.unmute : copy.mute);
    themeBtn.setAttribute("aria-label", theme === "dark" ? copy.themeToLight : copy.themeToDark);
    themeBtn.setAttribute("title", theme === "dark" ? copy.themeToLight : copy.themeToDark);
    helpBtn.setAttribute("aria-label", copy.howToTitle);
    helpBtn.setAttribute("title", copy.howToTitle);
    langBtn.setAttribute("aria-label", copy.langLabel);
    langBtn.setAttribute("title", copy.langLabel);
    for (const button of padButtons) {
      const label = copy[DIR_LABEL[button.dataset.dir]];
      button.setAttribute("aria-label", label);
      button.setAttribute("title", label);
    }
  }

  function ensureNode(tile) {
    const existing = nodes.get(tile.id);
    if (existing) return existing;
    const root = document.createElement("div");
    root.className = "tile";
    const face = document.createElement("div");
    face.className = "tile-face";
    root.append(face);
    layer.append(root);
    const node = { root, face };
    nodes.set(tile.id, node);
    return node;
  }

  function place(node, tile) {
    node.root.style.setProperty("--r", tile.row);
    node.root.style.setProperty("--c", tile.col);
    const value = String(tile.value);
    if (node.root.dataset.value !== value) {
      node.root.dataset.value = value;
      node.root.dataset.v = String(Math.min(tile.value, TOP_CAP));
      node.root.dataset.digits = value.length;
      node.face.textContent = value;
    }
    node.face.dataset.kind = tile.kind ?? "idle";
  }

  function render(state, extra = {}) {
    const absorbed = extra.absorbed ?? [];
    const alive = new Set();

    for (const tile of absorbed) {
      alive.add(tile.id);
      const node = ensureNode(tile);
      node.root.classList.add("is-ghost");
      place(node, tile);
    }
    for (const tile of state.tiles) {
      alive.add(tile.id);
      const node = ensureNode(tile);
      node.root.classList.remove("is-ghost");
      place(node, tile);
    }
    for (const [id, node] of nodes) {
      if (alive.has(id)) continue;
      node.root.remove();
      nodes.delete(id);
    }

    scoreEl.textContent = state.score;
    bestEl.textContent = state.best;
    if (extra.gain > 0) {
      gainEl.textContent = "+" + extra.gain;
      gainEl.classList.remove("is-on");
      void gainEl.offsetWidth;
      gainEl.classList.add("is-on");
    }
  }

  function releaseGhosts() {
    for (const [id, node] of nodes) {
      if (!node.root.classList.contains("is-ghost")) continue;
      node.root.remove();
      nodes.delete(id);
    }
  }

  function setStats(stats) {
    statEls.games.textContent = stats.games;
    statEls.wins.textContent = stats.wins;
    statEls.top.textContent = stats.bestTile || "—";
  }

  function setOverlay(kind) {
    overlayKind = kind;
    overlay.replaceChildren();
    overlay.removeAttribute("aria-labelledby");

    if (kind === "none") {
      overlay.hidden = true;
      overlay.removeAttribute("data-kind");
      return;
    }

    const specs = {
      win: {
        title: copy.winTitle,
        body: copy.winBody,
        large: true,
        buttons: [
          { label: copy.keepGoing, primary: true, onClick: actions.continueGame },
          { label: copy.retry, onClick: actions.restartNow },
        ],
      },
      lose: {
        title: copy.loseTitle,
        body: copy.loseBody,
        large: true,
        buttons: [{ label: copy.retry, primary: true, onClick: actions.restartNow }],
      },
      confirm: {
        title: copy.confirmTitle,
        body: copy.confirmBody,
        buttons: [
          { label: copy.confirmCancel, onClick: actions.cancelRestart },
          { label: copy.confirmOk, primary: true, onClick: actions.restartNow },
        ],
      },
      help: {
        title: copy.howToTitle,
        body: copy.howToBody,
        buttons: [{ label: copy.howToOk, primary: true, onClick: actions.toggleHelp }],
      },
    };
    const spec = specs[kind];
    if (!spec) return;

    overlay.hidden = false;
    overlay.dataset.kind = kind;

    const title = document.createElement("p");
    title.className = spec.large ? "overlay-title is-large" : "overlay-title";
    title.id = "overlay-title";
    title.textContent = spec.title;

    const body = document.createElement("p");
    body.className = "overlay-body";
    body.textContent = spec.body;

    const row = document.createElement("div");
    row.className = "overlay-actions";
    for (const item of spec.buttons) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = item.primary ? "btn btn-primary" : "btn";
      button.textContent = item.label;
      button.addEventListener("click", item.onClick);
      row.append(button);
    }

    overlay.append(title, body, row);
    overlay.setAttribute("aria-labelledby", "overlay-title");
  }

  function applyLocale(next) {
    copy = strings(next);
    document.documentElement.lang = htmlLang(next);
    document.title = copy.docTitle;
    document.querySelector('meta[name="description"]')?.setAttribute("content", copy.lede);
    for (const node of document.querySelectorAll("[data-i18n]")) {
      const text = copy[node.dataset.i18n];
      if (text) node.textContent = text;
    }
    board.setAttribute("aria-label", copy.boardLabel);
    paintLabels();
    if (overlayKind !== "none") setOverlay(overlayKind);
  }

  function applyTheme(next) {
    theme = next;
    document.documentElement.dataset.theme = next;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content",
      next === "dark" ? "#171410" : "#f6f1e6",
    );
    themeBtn.innerHTML = next === "dark" ? ICONS.sun : ICONS.moon;
    paintLabels();
  }

  return {
    render,
    releaseGhosts,
    setStats,
    setOverlay,
    applyLocale,
    applyTheme,
    announce(text) {
      announceEl.textContent = text;
    },
    setMuted(flag) {
      muted = flag;
      muteBtn.innerHTML = flag ? ICONS.soundOff : ICONS.soundOn;
      paintLabels();
    },
    setUndoEnabled(flag) {
      undoBtn.disabled = !flag;
    },
    get overlayKind() {
      return overlayKind;
    },
  };
}
