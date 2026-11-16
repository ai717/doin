// 渲染与交互层：唯一碰 DOM / Canvas 的模块。
// 视窗隐喻「桌面上的微缩城市沙盘」：环形棋盘是微缩街区，中央公园放骰子与
// 城市快报，顶栏是资产仪表盘横幅，底部是下沉式实体操作托盘。拒绝左右双翼。

import {
  BOARD_SIZE,
  CARDS,
  GROUP_TILES,
  HAND_LIMIT,
  HOUSE_COST,
  MAX_HOUSE,
  PROP_GROUP,
  SHOP_PRICE,
  blockCandidates,
  priceOf,
  rentFor,
  swapMineCandidates,
  swapTheirsCandidates,
  tileInfo,
} from "./engine.mjs";
import { htmlLang, translate } from "./i18n.mjs";

const TILE_GRID = (() => {
  const map = [];
  for (let i = 0; i < BOARD_SIZE; i += 1) {
    if (i <= 6) map.push([7, i + 1]);
    else if (i <= 12) map.push([7 - (i - 6), 7]);
    else if (i <= 18) map.push([1, 7 - (i - 12)]);
    else map.push([1 + (i - 18), 1]);
  }
  return map;
})();

function tileNameKey(tile) {
  const info = tileInfo(tile);
  if (info.type === "prop") {
    const group = info.group;
    const index = GROUP_TILES[group].indexOf(tile);
    return `tile_p_${group}_${index + 1}`;
  }
  return `tile_${info.type}`;
}

function tileName(locale, tile) {
  return translate(locale, tileNameKey(tile));
}

const ICONS = {
  start: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v18M7 4h11l-3.5 4L18 12H7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  rest: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9h11v5a5 5 0 0 1-10 0zM16 10h2.6a2.4 2.4 0 0 1 0 4.8H16M8 5.5V4M11.5 6V4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  shop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5 12.5 3H21v8.5L12.5 20z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="16.6" cy="7.4" r="1.6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  bank: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 10 12 4l8.5 6M5.5 10v8M9.7 10v8M14.3 10v8M18.5 10v8M3.5 20h17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chance: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="9" r="1.5" fill="currentColor"/><circle cx="15" cy="15" r="1.5" fill="currentColor"/><circle cx="15" cy="9" r="1.5" fill="currentColor"/><circle cx="9" cy="15" r="1.5" fill="currentColor"/></svg>',
  fate: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l1.9 5.4 5.6 2.1-5.6 2.1L12 20.5l-1.9-7.4-5.6-2.1 5.6-2.1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  trap: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.6 4.5h4.8l3 14.5H6.6zM8 12h8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const PIP_LAYOUT = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const DICE_TRANSFORM = {
  1: [0, 0],
  2: [0, -90],
  3: [-90, 0],
  4: [90, 0],
  5: [0, 90],
  6: [0, 180],
};

const PLAYER_COLORS = { p1: "#ffb454", p2: "#59c8f2", p3: "#7ce6b6" };

const CARD_COLORS = {
  card_rentfree: "#7ce6b6",
  card_roadblock: "#f2a65e",
  card_dice: "#59c8f2",
  card_tax: "#e57373",
  card_equal: "#b48ce6",
  card_swap: "#ffd978",
};

export function createUI({ game, actions, locale: initialLocale }) {
  let locale = initialLocale;
  const el = (id) => document.getElementById(id);

  const refs = {};
  const tokenEls = new Map();
  const visualPos = new Map();
  const tileEls = new Map();
  let particles = [];
  let fxRunning = false;
  let hopQueue = 0;
  let currentDice = null;
  let diceTimer = null;
  let bannerTimer = null;
  let overlayMode = null; // "block" | "swap-mine" | "swap-theirs" | "dice" | null
  let pickerContext = null;
  let resultOpen = false;

  function $(id) {
    return el(id);
  }

  function t(key, params) {
    return translate(locale, key, params);
  }

  function money(n) {
    return `$${Math.round(Number(n) || 0)}`;
  }

  // ------------------------------------------------------------ 静态骨架

  function buildBoard() {
    const board = $("board");
    board.querySelectorAll(".tile").forEach((node) => node.remove());
    tileEls.clear();
    for (let tile = 0; tile < BOARD_SIZE; tile += 1) {
      const info = tileInfo(tile);
      const [row, col] = TILE_GRID[tile];
      const node = document.createElement("div");
      node.className = `tile t-${info.type}`;
      if (info.type === "prop") node.classList.add(`g-${info.group}`);
      node.style.gridArea = `${row} / ${col}`;
      node.dataset.tile = String(tile);

      if (info.type === "prop") {
        node.innerHTML = `
          <span class="tile-band"></span>
          <span class="tile-name"></span>
          <span class="tile-price"></span>
          <span class="tile-houses"></span>
          <span class="tile-flag"></span>
          <span class="tile-mortgage"></span>`;
      } else if (info.type === "start") {
        node.innerHTML = `
          <span class="tile-icon">${ICONS.start}</span>
          <span class="tile-name"></span>
          <span class="tile-salary"></span>`;
      } else {
        node.innerHTML = `
          <span class="tile-icon">${ICONS[info.type] ?? ""}</span>
          <span class="tile-name"></span>`;
      }
      board.appendChild(node);
      tileEls.set(tile, node);
      node.addEventListener("click", () => {
        if (overlayMode === "block" || overlayMode === "swap-mine" || overlayMode === "swap-theirs") {
          if (node.classList.contains("pickable")) {
            actions.pickTile(tile);
          }
        }
      });
    }
  }

  function buildDice() {
    const die = $("die");
    die.innerHTML = "";
    const faces = [
      [1, "front"],
      [2, "right"],
      [3, "top"],
      [4, "bottom"],
      [5, "left"],
      [6, "back"],
    ];
    for (const [value, className] of faces) {
      const face = document.createElement("div");
      face.className = `die-face df-${className}`;
      const pips = PIP_LAYOUT[value] ?? [];
      for (let cell = 0; cell < 9; cell += 1) {
        const dot = document.createElement("span");
        if (pips.includes(cell)) dot.className = "pip on";
        face.appendChild(dot);
      }
      die.appendChild(face);
    }
  }

  function ensureTokens() {
    const layer = $("token-layer");
    layer.innerHTML = "";
    tokenEls.clear();
    hopQueue = 0;
    const state = game.state;
    if (!state) return;
    for (const player of state.players) {
      const token = document.createElement("div");
      token.className = `token tk-${player.id}`;
      token.innerHTML = `<span class="token-figure"><span class="token-head"></span><span class="token-collar"></span><span class="token-body"></span><span class="token-pedestal"></span></span><span class="token-shadow"></span>`;
      layer.appendChild(token);
      tokenEls.set(player.id, token);
      visualPos.set(player.id, player.pos);
      placeToken(player.id, player.pos, true);
    }
  }

  function tileCenter(tile) {
    const node = tileEls.get(tile);
    const board = $("board");
    if (!node || !board) return { x: 0, y: 0 };
    const nb = board.getBoundingClientRect();
    const tb = node.getBoundingClientRect();
    return { x: tb.left - nb.left + tb.width / 2, y: tb.top - nb.top + tb.height / 2 };
  }

  function placeToken(playerId, tile, instant = false) {
    const token = tokenEls.get(playerId);
    if (!token) return;
    const { x, y } = tileCenter(tile);
    const dwellers = [...tokenEls.keys()].filter((id) => visualPos.get(id) === tile && game.state?.players.find((p) => p.id === id)?.alive);
    const index = Math.max(0, dwellers.indexOf(playerId));
    const spread = dwellers.length > 1 ? (index - (dwellers.length - 1) / 2) * 16 : 0;
    visualPos.set(playerId, tile);
    if (instant) token.classList.add("no-anim");
    token.style.transform = `translate(${x - 16 + spread}px, ${y - 36}px)`;
    token.style.zIndex = String(20 + index);
    if (instant) {
      void token.offsetWidth;
      token.classList.remove("no-anim");
    }
  }

  function snapAllTokens() {
    const state = game.state;
    if (!state) return;
    for (const player of state.players) {
      tokenEls.get(player.id)?.classList.toggle("dead", !player.alive);
      if (hopQueue > 0) continue; // 行进动画中，交给 hop 事件逐步推进
      const visual = visualPos.get(player.id);
      if (visual !== player.pos) placeToken(player.id, player.pos, true);
    }
  }

  // ------------------------------------------------------------ Canvas 粒子

  function fxCanvas() {
    return $("fx");
  }

  function ensureCanvas() {
    const canvas = fxCanvas();
    const felt = $("table-felt");
    if (!canvas || !felt) return;
    const rect = felt.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawnCoins(fromTile, playerId, amount) {
    const canvas = fxCanvas();
    if (!canvas) return;
    const from = fromTile !== null && fromTile !== undefined ? tileCenter(fromTile) : { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 };
    const target = playerId ? hudCenter(playerId) : { x: canvas.clientWidth / 2, y: canvas.clientHeight * 0.4 };
    if (!target) return;
    const count = Math.min(9, 3 + Math.round(Math.min(300, Math.abs(amount)) / 60));
    for (let i = 0; i < count; i += 1) {
      particles.push({
        kind: "coin",
        x: from.x + (Math.random() - 0.5) * 18,
        y: from.y + (Math.random() - 0.5) * 12,
        tx: target.x + (Math.random() - 0.5) * 22,
        ty: target.y + (Math.random() - 0.5) * 10,
        t: 0,
        speed: 0.55 + Math.random() * 0.5,
        delay: i * 0.05,
        size: 5 + Math.random() * 3,
      });
    }
    startFx();
  }

  function hudCenter(playerId) {
    const card = document.querySelector(`.hud-card[data-player="${playerId}"]`);
    if (!card) return null;
    const felt = $("table-felt");
    if (!felt) return null;
    const cr = felt.getBoundingClientRect();
    const r = card.getBoundingClientRect();
    return { x: r.left - cr.left + r.width / 2, y: r.top - cr.top + r.height / 2 };
  }

  function spawnConfetti() {
    const canvas = fxCanvas();
    if (!canvas) return;
    for (let i = 0; i < 90; i += 1) {
      particles.push({
        kind: "confetti",
        x: Math.random() * canvas.clientWidth,
        y: -20 - Math.random() * canvas.clientHeight * 0.4,
        vx: (Math.random() - 0.5) * 60,
        vy: 120 + Math.random() * 180,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 8,
        t: 0,
        color: ["#ffb454", "#59c8f2", "#7ce6b6", "#f4739b", "#ffe08a"][Math.floor(Math.random() * 5)],
        size: 6 + Math.random() * 6,
      });
    }
    startFx();
  }

  function startFx() {
    if (fxRunning) return;
    fxRunning = true;
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const canvas = fxCanvas();
      if (!canvas) {
        fxRunning = false;
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!game.paused) {
        ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
        particles = particles.filter((p) => updateParticle(p, dt));
        for (const p of particles) drawParticle(ctx, p);
        if (!particles.length) {
          fxRunning = false;
          return;
        }
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function updateParticle(p, dt) {
    if (p.kind === "coin") {
      if (p.delay > 0) {
        p.delay -= dt;
        return true;
      }
      p.t += dt * p.speed;
      if (p.t >= 1) return false;
      return true;
    }
    p.t += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 260 * dt;
    p.rot += p.vr * dt;
    return p.y < canvasHeight() + 30;
  }

  function canvasHeight() {
    const canvas = fxCanvas();
    return canvas ? canvas.clientHeight : 600;
  }

  function drawParticle(ctx, p) {
    if (p.kind === "coin") {
      const ease = p.t * p.t * (3 - 2 * p.t);
      const x = p.x + (p.tx - p.x) * ease;
      const arc = Math.sin(Math.PI * ease) * 46;
      const y = p.y + (p.ty - p.y) * ease - arc;
      ctx.beginPath();
      ctx.fillStyle = "#ffd978";
      ctx.ellipse(x, y, p.size, p.size * 0.78, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(140, 90, 10, 0.55)";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      return;
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
    ctx.restore();
  }

  // ------------------------------------------------------------ HUD 仪表盘

  function buildHud() {
    const hud = $("hud");
    hud.innerHTML = "";
    const state = game.state;
    if (!state) return;
    for (const player of state.players) {
      const card = document.createElement("div");
      card.className = `hud-card hc-${player.id}`;
      card.dataset.player = player.id;
      card.innerHTML = `
        <div class="hud-top">
          <span class="hud-dot"></span>
          <span class="hud-name"></span>
          <span class="hud-tag"></span>
        </div>
        <div class="hud-cash"></div>
        <div class="hud-sub">
          <span class="hud-worth"></span>
          <span class="hud-props"></span>
        </div>
        <div class="hud-hand"></div>
        <div class="hud-status"></div>`;
      hud.appendChild(card);
    }
  }

  function nameOf(player) {
    if (player.ai) {
      const key = player.ai === "novice" ? "name_ahcai" : player.ai === "skilled" ? "name_abacus" : "name_landking";
      return t(key);
    }
    if (game.state?.mode === "2p") return t(player.id === "p1" ? "name_p1" : "name_p2");
    return t("name_you");
  }

  function renderHud() {
    const state = game.state;
    if (!state) return;
    for (const player of state.players) {
      const card = document.querySelector(`.hud-card[data-player="${player.id}"]`);
      if (!card) continue;
      card.style.setProperty("--pc", PLAYER_COLORS[player.id] ?? "#ccc");
      card.querySelector(".hud-dot").style.background = PLAYER_COLORS[player.id] ?? "#ccc";
      card.querySelector(".hud-name").textContent = nameOf(player);
      const tag = card.querySelector(".hud-tag");
      if (player.ai) {
        tag.textContent = t(`aiTag_${player.ai}`);
        tag.hidden = false;
      } else if (state.mode === "2p") {
        tag.textContent = t("humanTag");
        tag.hidden = false;
      } else {
        tag.hidden = true;
      }
      card.querySelector(".hud-cash").textContent = money(player.cash);
      card.querySelector(".hud-worth").textContent = `${t("hudWorth")} ${money(netWorthLocal(player.id))}`;
      card.querySelector(".hud-props").textContent = `${t("hudProps")} ×${propsCount(player.id)}`;
      const hand = card.querySelector(".hud-hand");
      hand.innerHTML = "";
      for (let i = 0; i < HAND_LIMIT; i += 1) {
        const dot = document.createElement("span");
        dot.className = "hand-slot" + (player.cards[i] ? " filled" : "");
        hand.appendChild(dot);
      }
      const status = card.querySelector(".hud-status");
      status.innerHTML = "";
      if (!player.alive) {
        const badge = document.createElement("span");
        badge.className = "status-badge bankrupt";
        badge.textContent = t("tagBankrupt");
        status.appendChild(badge);
      } else if (player.stopTurns > 0) {
        const badge = document.createElement("span");
        badge.className = "status-badge halt";
        badge.textContent = `${t("hudStop")} ×${player.stopTurns}`;
        status.appendChild(badge);
      }
      card.classList.toggle("active", state.turn === state.players.indexOf(player) && !state.over);
      card.classList.toggle("is-thinking", state.turn === state.players.indexOf(player) && Boolean(player.ai) && !state.over);
      card.classList.toggle("out", !player.alive);
    }
  }

  function netWorthLocal(playerId) {
    const state = game.state;
    if (!state) return 0;
    const player = state.players.find((entry) => entry.id === playerId);
    let worth = player ? player.cash : 0;
    for (const tile of Object.keys(state.lands).map(Number)) {
      const land = state.lands[tile];
      if (land.owner !== playerId) continue;
      const price = priceOf(tile);
      worth += land.mortgaged ? Math.round((price + land.level * HOUSE_COST) / 2) : price + land.level * HOUSE_COST;
    }
    return worth;
  }

  function propsCount(playerId) {
    const state = game.state;
    if (!state) return 0;
    let count = 0;
    for (const tile of Object.keys(state.lands).map(Number)) {
      if (state.lands[tile].owner === playerId) count += 1;
    }
    return count;
  }

  // ------------------------------------------------------------ 棋盘格刷新

  function renderTiles() {
    const state = game.state;
    if (!state) return;
    for (const [tile, node] of tileEls) {
      const info = tileInfo(tile);
      const nameEl = node.querySelector(".tile-name");
      if (nameEl) nameEl.textContent = tileName(locale, tile);
      if (info.type !== "prop") {
        const extra = node.querySelector(".tile-salary");
        if (extra) extra.textContent = info.type === "start" ? "+$200" : "";
        continue;
      }
      const land = state.lands[tile];
      const price = priceOf(tile);
      node.style.setProperty("--owner", land.owner ? PLAYER_COLORS[land.owner] ?? "transparent" : "transparent");
      node.classList.toggle("owned", Boolean(land.owner));
      node.classList.toggle("mortgaged", land.mortgaged);
      const priceEl = node.querySelector(".tile-price");
      if (priceEl) priceEl.textContent = money(price);
      const houses = node.querySelector(".tile-houses");
      if (houses) {
        houses.innerHTML = "";
        for (let i = 0; i < land.level; i += 1) {
          const house = document.createElement("span");
          house.className = "mini-house";
          houses.appendChild(house);
        }
        if (land.level === MAX_HOUSE) houses.classList.add("maxed");
        else houses.classList.remove("maxed");
      }
      const flag = node.querySelector(".tile-flag");
      if (flag) {
        flag.className = `tile-flag${land.owner ? " has-owner" : ""}`;
        flag.style.background = land.owner ? PLAYER_COLORS[land.owner] ?? "transparent" : "transparent";
      }
      const mortgage = node.querySelector(".tile-mortgage");
      if (mortgage) mortgage.textContent = land.mortgaged ? t("mortgageTag") : "";
    }
    // 路障标记
    boardBlockLayer();
    // 拾取高亮
    renderPickables();
  }

  function boardBlockLayer() {
    const state = game.state;
    if (!state) return;
    for (const [, node] of tileEls) {
      node.classList.remove("has-block");
    }
    for (const block of state.blocks) {
      tileEls.get(block.tile)?.classList.add("has-block");
    }
  }

  function renderPickables() {
    const state = game.state;
    for (const [, node] of tileEls) node.classList.remove("pickable");
    if (!state || !overlayMode) return;
    const player = state.players[state.turn];
    if (!player || !player.human) return;
    let tiles = [];
    if (overlayMode === "block") tiles = blockCandidates(state, player.id);
    else if (overlayMode === "swap-mine") tiles = swapMineCandidates(state, player.id);
    else if (overlayMode === "swap-theirs") tiles = swapTheirsCandidates(state, player.id);
    for (const tile of tiles) tileEls.get(tile)?.classList.add("pickable");
  }

  // ------------------------------------------------------------ 骰子

  function showDice(value, rolling = false) {
    const die = $("die");
    if (!die) return;
    currentDice = value;
    die.classList.toggle("rolling", rolling);
    if (diceTimer) {
      clearTimeout(diceTimer);
      diceTimer = null;
    }
    if (rolling) return;
    const [rx, ry] = DICE_TRANSFORM[value] ?? [0, 0];
    die.style.setProperty("--rx", `${rx}deg`);
    die.style.setProperty("--ry", `${ry}deg`);
  }

  function rollDiceVisual(value) {
    const die = $("die");
    if (!die) return;
    const [rx, ry] = DICE_TRANSFORM[value] ?? [0, 0];
    die.style.setProperty("--rx", `${rx}deg`);
    die.style.setProperty("--ry", `${ry}deg`);
    void die.offsetWidth;
    showDice(value, true);
    diceTimer = setTimeout(() => showDice(value, false), 650);
  }

  // ------------------------------------------------------------ 日志与回合

  function renderPark() {
    const state = game.state;
    if (!state) return;
    const roundEl = $("round-label");
    if (roundEl) roundEl.textContent = t("roundLabel", { n: Math.min(state.round, 30), m: 30 });
    const logBox = $("log-ticker");
    if (logBox) {
      logBox.innerHTML = "";
      const recent = state.log.slice(-3);
      for (const entry of recent) {
        const line = document.createElement("div");
        line.className = "log-line";
        line.textContent = formatLog(entry);
        logBox.appendChild(line);
      }
      logBox.scrollTop = logBox.scrollHeight;
    }
  }

  function playerNameById(id) {
    const state = game.state;
    const player = state?.players.find((entry) => entry.id === id);
    return player ? nameOf(player) : id;
  }

  function tileDisplay(tile) {
    return tileName(locale, tile);
  }

  function formatLog(entry) {
    const params = { ...entry.params };
    for (const key of ["name", "owner", "target"]) {
      if (params[key] !== undefined) params[key] = playerNameById(params[key]);
    }
    if (params.tile !== undefined) params.tile = tileDisplay(params.tile);
    if (params.n !== undefined) params.n = money(params.n);
    return t(entry.key, params);
  }

  // ------------------------------------------------------------ 操作托盘

  function renderDock() {
    const zone = $("action-zone");
    const handBox = $("hand-cards");
    if (!zone || !handBox) return;
    const state = game.state;
    zone.innerHTML = "";
    handBox.innerHTML = "";
    if (!state || state.over) {
      zone.appendChild(elButton(t("dockWaiting"), "ghost", () => {}));
      return;
    }
    const player = state.players[state.turn];
    const pausedNow = game.paused;
    renderHand(handBox, player, state);

    if (pausedNow) {
      zone.appendChild(elButton(t("dockPaused"), "ghost"));
      return;
    }

    if (state.phase === "pre" && player?.human) {
      const roll = elButton(t("dockRoll"), "primary big", () => actions.roll());
      roll.id = "btn-roll";
      zone.appendChild(roll);
      zone.appendChild(hintLine(t("dockYourTurn")));
      return;
    }
    if (state.phase === "pre") {
      zone.appendChild(hintLine(t("dockWaiting")));
      return;
    }
    if (state.phase === "moving") {
      zone.appendChild(hintLine(t("dockMoving")));
      return;
    }
    if (["blockPick", "swapMine", "swapTheirs"].includes(state.phase)) {
      const titles = { blockPick: "blockPickTitle", swapMine: "swapMineTitle", swapTheirs: "swapTheirsTitle" };
      zone.appendChild(hintLine(t(titles[state.phase])));
      zone.appendChild(elButton(t("pickCancel"), "ghost", () => actions.cancelCard()));
      return;
    }
    if (state.phase === "act") {
      const pending = state.pending;
      if (!pending) {
        zone.appendChild(hintLine(player?.human ? t("dockYourTurn") : t("dockWaiting")));
        return;
      }
      if (!player?.human) {
        zone.appendChild(hintLine(t("dockWaiting")));
        return;
      }
      renderPending(zone, pending, player);
      return;
    }
    zone.appendChild(hintLine(t("dockWaiting")));
  }

  function renderHand(handBox, player, state) {
    if (!player) return;
    const myTurn = player.human && state.turn === state.players.indexOf(player) && !game.paused;
    for (let i = 0; i < HAND_LIMIT; i += 1) {
      const card = player.cards[i];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hand-card";
      btn.dataset.slot = String(i + 1);
      if (!card) {
        btn.classList.add("empty");
        btn.disabled = true;
        handBox.appendChild(btn);
        continue;
      }
      btn.innerHTML = `
        <span class="card-glyph" style="background:${CARD_COLORS[card] ?? "#ccc"}"></span>
        <span class="card-label">${t(`card_${card.split("_")[1]}`)}</span>
        <span class="card-key">${i + 1}</span>`;
      const usable = myTurn && state.phase === "pre" && !state.cardUsed && CARDS[card] !== "passive";
      btn.disabled = !usable;
      if (usable) btn.addEventListener("click", () => actions.useCard(card));
      handBox.appendChild(btn);
    }
    if (!player.cards.length) {
      const empty = document.createElement("span");
      empty.className = "hand-empty";
      empty.textContent = t("handEmpty");
      handBox.appendChild(empty);
    } else if (state.cardUsed && player.human && myTurn) {
      const note = document.createElement("span");
      note.className = "hand-empty";
      note.textContent = t("cardUsedNote");
      handBox.appendChild(note);
    }
  }

  function renderPending(zone, pending, player) {
    if (pending.kind === "buy") {
      const tile = pending.tile;
      zone.appendChild(summaryLine(`${t("dockYourTurn")} · ${tileDisplay(tile)}`));
      const buy = elButton(t("buyBtn", { n: money(priceOf(tile)) }), "primary big", () => actions.decide("buy"));
      buy.id = "btn-buy";
      zone.appendChild(buy);
      zone.appendChild(elButton(t("skipBtn"), "ghost", () => actions.decide("skip")));
      const info = rentPreview(tile);
      zone.appendChild(hintLine(info));
      return;
    }
    if (pending.kind === "upgrade") {
      zone.appendChild(summaryLine(`${tileDisplay(pending.tile)} · Lv${stateLevel(pending.tile)}→${stateLevel(pending.tile) + 1}`));
      const build = elButton(t("upgradeBtn", { n: money(HOUSE_COST) }), "primary big", () => actions.decide("upgrade"));
      build.id = "btn-upgrade";
      zone.appendChild(build);
      zone.appendChild(elButton(t("skipBtn"), "ghost", () => actions.decide("skip")));
      zone.appendChild(hintLine(rentPreview(pending.tile)));
      return;
    }
    if (pending.kind === "redeem") {
      zone.appendChild(summaryLine(`${tileDisplay(pending.tile)} · ${t("mortgageTag")}`));
      zone.appendChild(elButton(t("redeemBtn", { n: money(pending.n) }), "primary big", () => actions.decide("redeem")));
      zone.appendChild(elButton(t("skipBtn"), "ghost", () => actions.decide("skip")));
      return;
    }
    if (pending.kind === "shop") {
      zone.appendChild(summaryLine(t("shopTitle")));
      const grid = document.createElement("div");
      grid.className = "shop-grid";
      for (const card of pending.cards) {
        const btn = elButton(`${t(`card_${card.split("_")[1]}`)} ${money(SHOP_PRICE[card])}`, "shop-item", () => actions.shopBuy(card));
        grid.appendChild(btn);
      }
      zone.appendChild(grid);
      zone.appendChild(hintLine(t("shopHint")));
      zone.appendChild(elButton(t("skipBtn"), "ghost", () => actions.decide("skip")));
      return;
    }
    zone.appendChild(elButton(t("skipBtn"), "ghost", () => actions.decide("skip")));
  }

  function stateLevel(tile) {
    return game.state?.lands[tile]?.level ?? 0;
  }

  function rentPreview(tile) {
    const state = game.state;
    if (!state) return "";
    const land = state.lands[tile];
    const price = priceOf(tile);
    const owner = land.owner;
    const setBonus = GROUP_TILES[PROP_GROUP[tile]].every((entry) => state.lands[entry].owner === owner) ? 2 : 1;
    const current = Math.round(price * 0.2 * (1 + land.level) * setBonus);
    const next = Math.round(price * 0.2 * (2 + land.level) * setBonus);
    return `${tileName(locale, tile)} · ${t("rentShort")} ${money(current)} → ${money(next)}`;
  }

  function elButton(text, kind = "ghost", onClick = null) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `rm-btn ${kind}`;
    btn.textContent = text;
    if (onClick) btn.addEventListener("click", onClick);
    return btn;
  }

  function hintLine(text) {
    const node = document.createElement("p");
    node.className = "dock-hint";
    node.textContent = text;
    return node;
  }

  function summaryLine(text) {
    const node = document.createElement("p");
    node.className = "dock-summary";
    node.textContent = text;
    return node;
  }

  // ------------------------------------------------------------ 弹层

  function closeAllOverlays() {
    for (const id of ["mode-drawer", "help", "pause-layer", "result", "confirm-modal", "picker-modal"]) {
      el(id)?.setAttribute("hidden", "");
    }
    overlayMode = null;
    pickerContext = null;
    resultOpen = false;
    renderPickables();
  }

  function openOverlay(id) {
    el(id)?.removeAttribute("hidden");
  }

  function openMode() {
    renderModeDrawer();
    openOverlay("mode-drawer");
  }

  function renderModeDrawer() {
    const list = $("mode-list");
    const progress = actions.getProgress();
    if (list) {
      list.innerHTML = "";
      const modes = [
        ["quick", "mode_quick", "mode_quickDesc"],
        ["duo", "mode_duo", "mode_duoDesc"],
        ["2p", "mode_2p", "mode_2pDesc"],
      ];
      const selected = actions.getSelected();
      for (const [mode, titleKey, descKey] of modes) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "mode-item" + (selected.mode === mode ? " selected" : "");
        item.innerHTML = `<strong>${t(titleKey)}</strong><span>${t(descKey)}</span>`;
        item.addEventListener("click", () => {
          actions.selectMode(mode);
          renderModeDrawer();
        });
        list.appendChild(item);
      }
    }
    const aiBox = $("ai-levels");
    if (aiBox) {
      aiBox.innerHTML = "";
      const selected = actions.getSelected();
      const hidden = selected.mode === "2p";
      aiBox.hidden = hidden;
      if (!hidden) {
        const title = document.createElement("p");
        title.className = "ai-title";
        title.textContent = t("aiTitle");
        aiBox.appendChild(title);
        for (const level of ["novice", "skilled", "master"]) {
          const unlocked = actions.aiUnlocked(level);
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "ai-item" + (selected.ai === level ? " selected" : "") + (unlocked ? "" : " locked");
          btn.disabled = !unlocked;
          btn.innerHTML = unlocked
            ? `<strong>${t(`ai_${level}`)}</strong><span>${t(`ai_${level}Desc`)}</span>`
            : `<strong>🔒 ${t(`ai_${level}`)}</strong><span>${t("lockedHint", { n: level === "skilled" ? 1 : 3 })}</span>`;
          if (unlocked) {
            btn.addEventListener("click", () => {
              actions.selectAi(level);
              renderModeDrawer();
            });
          }
          aiBox.appendChild(btn);
        }
      }
    }
    const record = $("record-line");
    if (record) {
      record.textContent = t("recordLabel", { w: progress.wins, l: progress.losses });
    }
    const startBtn = $("start-match");
    if (startBtn) startBtn.textContent = t("startMatch");
    const modeHint = $("mode-hint");
    if (modeHint) modeHint.textContent = t("modeHint");
  }

  function openHelp() {
    openOverlay("help");
  }

  function openPause() {
    if (game.over) return;
    openOverlay("pause-layer");
  }

  function closePause() {
    if (!resultOpen) el("pause-layer")?.setAttribute("hidden", "");
  }

  function showResult(payload) {
    resultOpen = true;
    closeAllOverlays();
    resultOpen = true;
    const title = $("result-title");
    const sub = $("result-sub");
    const humans = payload.players.filter((entry) => entry.human);
    const iWon = payload.winner && humans.some((entry) => entry.id === payload.winner);
    const draw = payload.reason === "draw";
    if (title) title.textContent = draw ? t("resultDrawTitle") : iWon ? t("resultWinTitle") : t("resultLoseTitle");
    if (sub) {
      if (draw) sub.textContent = t("reason_draw");
      else {
        const winner = payload.players.find((entry) => entry.id === payload.winner);
        sub.textContent = `${t("resultWinner", { name: winner ? playerNameOfResult(winner, payload) : "" })} · ${t(`reason_${payload.reason}`)}`;
      }
    }
    const table = $("result-table");
    if (table) {
      table.innerHTML = "";
      const head = document.createElement("div");
      head.className = "rt-head rt-row";
      head.innerHTML = ["tablePlayer", "tableCash", "tableProps", "tableHouses", "tableWorth"]
        .map((key) => `<span>${t(key)}</span>`)
        .join("");
      table.appendChild(head);
      for (const entry of payload.players) {
        const row = document.createElement("div");
        row.className = "rt-row" + (entry.id === payload.winner ? " win" : "") + (entry.alive ? "" : " out");
        row.innerHTML = `
          <span class="rt-name"><i style="background:${PLAYER_COLORS[entry.id]}"></i>${playerNameOfResult(entry, payload)}</span>
          <span>${money(entry.cash)}</span>
          <span>×${entry.props}</span>
          <span>×${entry.houses}</span>
          <span><b>${money(entry.worth)}</b></span>`;
        table.appendChild(row);
      }
    }
    const extras = $("result-extras");
    if (extras) {
      extras.innerHTML = "";
      const bestRent = payload.players.reduce((a, b) => (b.maxRent > (a?.maxRent ?? 0) ? b : a), null);
      if (bestRent && bestRent.maxRent > 0) {
        const line = document.createElement("p");
        line.textContent = `${t("statMaxRent")}: ${playerNameOfResult(bestRent, payload)} · ${money(bestRent.maxRent)}`;
        extras.appendChild(line);
      }
      const sets = payload.players.reduce((a, b) => (b.sets > (a?.sets ?? 0) ? b : a), null);
      if (sets && sets.sets > 0) {
        const line = document.createElement("p");
        line.textContent = `${t("statSets")}: ${playerNameOfResult(sets, payload)} ×${sets.sets}`;
        extras.appendChild(line);
      }
      const rounds = document.createElement("p");
      rounds.textContent = `${t("statRounds")}: ${payload.rounds}`;
      extras.appendChild(rounds);
    }
    const flip = $("result-flip");
    if (flip) {
      flip.textContent = payload.flipRound ? t("flipNote", { n: payload.flipRound }) : "";
      flip.hidden = !payload.flipRound;
    }
    const recs = $("result-recs");
    if (recs) {
      recs.innerHTML = "";
      const title = document.createElement("p");
      title.className = "rec-title";
      title.textContent = t("recTitle");
      recs.appendChild(title);
      const holder = document.createElement("div");
      holder.className = "rec-list";
      holder.id = "rec-list";
      recs.appendChild(holder);
      actions.loadRecommendations(holder);
    }
    openOverlay("result");
  }

  function playerNameOfResult(entry, payload) {
    if (entry.ai) {
      const key = entry.ai === "novice" ? "name_ahcai" : entry.ai === "skilled" ? "name_abacus" : "name_landking";
      return t(key);
    }
    if (payload.mode === "2p") return t(entry.id === "p1" ? "name_p1" : "name_p2");
    return t("name_you");
  }

  function hideResult() {
    el("result")?.setAttribute("hidden", "");
    resultOpen = false;
  }

  function openConfirm({ title, body, onOk, okLabel }) {
    const modal = $("confirm-modal");
    if (!modal) return;
    $("confirm-title").textContent = title;
    $("confirm-body").textContent = body;
    const box = $("confirm-actions");
    box.innerHTML = "";
    box.appendChild(elButton(okLabel ?? t("confirmOk"), "primary", () => {
      closeConfirm();
      onOk?.();
    }));
    box.appendChild(elButton(t("cancelBtn"), "ghost", () => closeConfirm()));
    openOverlay("confirm-modal");
  }

  function closeConfirm() {
    el("confirm-modal")?.setAttribute("hidden", "");
  }

  function openPicker({ title, options, onPick, onCancel }) {
    const modal = $("picker-modal");
    if (!modal) return;
    $("picker-title").textContent = title;
    const list = $("picker-list");
    list.innerHTML = "";
    for (const option of options) {
      const btn = elButton(option.label, option.kind ?? "ghost", () => {
        closePicker();
        onPick(option.value);
      });
      list.appendChild(btn);
    }
    const cancel = $("picker-cancel");
    cancel.textContent = t("pickCancel");
    cancel.onclick = () => {
      closePicker();
      onCancel?.();
    };
    openOverlay("picker-modal");
  }

  function closePicker() {
    el("picker-modal")?.setAttribute("hidden", "");
    pickerContext = null;
    overlayMode = null;
    renderPickables();
  }

  function showToast(text, tone = "info") {
    const toast = $("toast");
    if (!toast) return;
    toast.textContent = text;
    toast.className = `toast show ${tone}`;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toast.classList.remove("show");
    }, 1900);
  }

  function showCallout(text, playerId = null) {
    const pill = $("callout-pill");
    if (!pill) return;
    pill.textContent = text;
    if (playerId && PLAYER_COLORS[playerId]) {
      pill.style.borderColor = PLAYER_COLORS[playerId];
    } else {
      pill.style.borderColor = "";
    }
    pill.classList.remove("pop");
    void pill.offsetWidth;
    pill.classList.add("pop");
  }

  function showEventBanner(text, tone = "special") {
    const banner = $("event-banner");
    if (!banner) return;
    banner.textContent = text;
    banner.className = `event-banner show tone-${tone}`;
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => {
      banner.classList.remove("show");
    }, 2400);
  }

  function spawnFloater(text, tone = "gain", tileOrPlayerId = null) {
    const layer = $("floater-layer");
    if (!layer) return;
    let pos = null;
    if (typeof tileOrPlayerId === "number") {
      pos = tileCenter(tileOrPlayerId);
    } else if (typeof tileOrPlayerId === "string") {
      pos = hudCenter(tileOrPlayerId);
    }
    if (!pos) {
      const felt = $("table-felt");
      pos = felt ? { x: felt.clientWidth / 2, y: felt.clientHeight * 0.4 } : { x: 200, y: 200 };
    }
    const floater = document.createElement("div");
    floater.className = `board-floater ${tone}`;
    floater.textContent = text;
    floater.style.left = `${pos.x}px`;
    floater.style.top = `${pos.y}px`;
    layer.appendChild(floater);
    setTimeout(() => floater.remove(), 1350);
  }

  function updateTurnCallout() {
    const state = game.state;
    if (!state || state.over) return;
    const player = state.players[state.turn];
    if (!player) return;
    if (state.phase === "pre") {
      if (player.human) {
        showCallout(t("callout_turn_you"), player.id);
      } else if (player.ai) {
        showCallout(t("callout_turn_ai", { name: nameOf(player) }), player.id);
      } else if (state.mode === "2p") {
        showCallout(t("callout_turn_p2", { name: nameOf(player) }), player.id);
      }
    } else if (state.phase === "act") {
      const tile = player.pos;
      const info = tileInfo(tile);
      tileEls.get(tile)?.classList.add("landed");
      setTimeout(() => tileEls.get(tile)?.classList.remove("landed"), 900);
      if (info.type === "prop") {
        const land = state.lands[tile];
        if (!land.owner) {
          showCallout(t("callout_landed_prop_empty", { tile: tileDisplay(tile) }), player.id);
        } else if (land.owner !== player.id) {
          showCallout(t("callout_landed_prop_rent", { owner: playerNameById(land.owner), tile: tileDisplay(tile), n: rentFor(state, tile) }), player.id);
        } else {
          showCallout(t("callout_landed_prop_own", { tile: tileDisplay(tile) }), player.id);
        }
      } else {
        showCallout(t("callout_landed_special", { tile: tileDisplay(tile) }), player.id);
      }
    }
  }

  // ------------------------------------------------------------ 事件路由

  function onGameEvent(event) {
    const state = game.state;
    switch (event.type) {
      case "dice":
        hopQueue = event.value;
        rollDiceVisual(event.value);
        showCallout(t("callout_roll_result", { name: playerNameById(event.player), n: event.value }), event.player);
        break;
      case "hop": {
        hopQueue = Math.max(0, hopQueue - 1);
        placeToken(event.player, event.tile);
        const token = tokenEls.get(event.player);
        if (token) {
          token.classList.remove("is-hopping");
          void token.offsetWidth;
          token.classList.add("is-hopping");
        }
        const tileNode = tileEls.get(event.tile);
        if (tileNode) {
          tileNode.style.setProperty("--step-color", PLAYER_COLORS[event.player] ?? "#ffd978");
          tileNode.classList.add("stepping");
          setTimeout(() => tileNode.classList.remove("stepping"), 240);
        }
        break;
      }
      case "teleport":
        hopQueue = 0;
        placeToken(event.player, event.tile, true);
        break;
      case "chainMove":
        hopQueue = event.tiles;
        break;
      case "gain":
        if (event.reason === "salary") {
          spawnCoins(null, event.who, event.amount);
          spawnFloater(t("floater_gain", { n: event.amount }), "gain", event.who);
          showEventBanner(t("banner_start", { name: playerNameById(event.who), n: event.amount }), "gain");
        } else if (event.reason === "start") {
          spawnCoins(null, event.who, event.amount);
          spawnFloater(t("floater_gain", { n: event.amount }), "gain", event.who);
          showEventBanner(t("banner_start_bonus", { name: playerNameById(event.who), n: event.amount }), "gain");
        } else if (event.reason === "bank") {
          spawnCoins(null, event.who, event.amount);
          spawnFloater(t("floater_gain", { n: event.amount }), "gain", event.who);
          showEventBanner(t("banner_bank", { name: playerNameById(event.who), n: event.amount }), "gain");
        } else if (event.reason === "event") {
          spawnCoins(null, event.who, event.amount);
          spawnFloater(t("floater_gain", { n: event.amount }), "gain", event.who);
        }
        break;
      case "pay":
        if (event.to) {
          spawnCoins(currentTileOf(event.from), event.to, event.amount);
        } else {
          spawnFloater(t("floater_pay", { n: event.amount }), "pay", event.from);
        }
        break;
      case "rent":
        spawnCoins(event.tile, event.to, event.amount);
        spawnFloater(t("floater_gain", { n: event.amount }), "gain", event.to);
        spawnFloater(t("floater_pay", { n: event.amount }), "pay", event.from);
        showEventBanner(t("banner_rent", { from: playerNameById(event.from), to: playerNameById(event.to), n: event.amount }), "pay");
        break;
      case "stamp":
        tileEls.get(event.tile)?.classList.add("stamped");
        spawnFloater(t("floater_buy"), "gain", event.tile);
        showEventBanner(t("banner_buy", { name: playerNameById(event.owner), tile: tileDisplay(event.tile), n: priceOf(event.tile) }), "gain");
        setTimeout(() => tileEls.get(event.tile)?.classList.remove("stamped"), 700);
        break;
      case "build":
        tileEls.get(event.tile)?.classList.add("stamped");
        spawnFloater(t("floater_upgrade"), "gain", event.tile);
        showEventBanner(t("banner_upgrade", { name: playerNameById(game.state?.lands[event.tile]?.owner), tile: tileDisplay(event.tile), lv: event.level }), "gain");
        setTimeout(() => tileEls.get(event.tile)?.classList.remove("stamped"), 700);
        break;
      case "blockHit":
        spawnFloater(t("floater_block_hit"), "warning", event.tile);
        showEventBanner(t("banner_block_hit", { name: playerNameById(event.player), tile: tileDisplay(event.tile) }), "special");
        break;
      case "trap":
        spawnFloater(t("floater_block_hit"), "warning", event.tile);
        showEventBanner(t("banner_trap", { name: playerNameById(game.state?.players[game.state.turn]?.id) }), "special");
        break;
      case "cardUsed":
        if (event.card === "card_rentfree") {
          showEventBanner(t("banner_rentfree", { name: playerNameById(event.player) }), "gain");
        }
        break;
      case "bankrupt":
        showEventBanner(t("banner_bankrupt", { name: playerNameById(event.who) }), "pay");
        break;
      case "event":
        if (event.kind === "chance") {
          showEventBanner(t("banner_chance", { name: playerNameById(game.state?.players[game.state.turn]?.id) }), "special");
        } else if (event.kind === "fate") {
          showEventBanner(t("banner_fate", { name: playerNameById(game.state?.players[game.state.turn]?.id) }), "special");
        }
        break;
      case "over":
        if (state?.winner && state.players.find((entry) => entry.id === state.winner)?.human) spawnConfetti();
        break;
      case "prompt":
        break;
      default:
        break;
    }
  }

  function currentTileOf(playerId) {
    return game.state?.players.find((entry) => entry.id === playerId)?.pos ?? null;
  }

  // ------------------------------------------------------------ 同步

  function sync() {
    const state = game.state;
    if (!state) return;
    renderHud();
    renderTiles();
    renderPark();
    renderDock();
    snapAllTokens();
    updateTurnCallout();
    // 卡片选取弹层跟随引擎阶段
    syncPickerPhase();
  }

  function syncPickerPhase() {
    const state = game.state;
    if (!state) return;
    const player = state.players[state.turn];
    if (!player || !player.human) return;
    if (state.phase === "blockPick" && overlayMode !== "block") {
      overlayMode = "block";
      renderPickables();
      openPicker({
        title: t("blockPickTitle"),
        options: blockCandidates(state, player.id).map((tile) => ({
          label: `${tileDisplay(tile)}${priceOf(tile) ? ` · ${money(priceOf(tile))}` : ""}`,
          value: tile,
        })),
        onPick: (tile) => actions.pickTile(tile),
        onCancel: () => actions.cancelCard(),
      });
      return;
    }
    if (state.phase === "swapMine" && overlayMode !== "swap-mine") {
      overlayMode = "swap-mine";
      renderPickables();
      openPicker({
        title: t("swapMineTitle"),
        options: swapMineCandidates(state, player.id).map((tile) => ({ label: tileDisplay(tile), value: tile })),
        onPick: (tile) => actions.pickTile(tile),
        onCancel: () => actions.cancelCard(),
      });
      return;
    }
    if (state.phase === "swapTheirs" && overlayMode !== "swap-theirs") {
      overlayMode = "swap-theirs";
      renderPickables();
      openPicker({
        title: t("swapTheirsTitle"),
        options: swapTheirsCandidates(state, player.id).map((tile) => ({ label: tileDisplay(tile), value: tile })),
        onPick: (tile) => actions.pickTile(tile),
        onCancel: () => actions.cancelCard(),
      });
      return;
    }
    if (["pre", "act", "moving"].includes(state.phase) && overlayMode && ["block", "swap-mine", "swap-theirs"].includes(overlayMode)) {
      closePicker();
    }
  }

  function openDicePicker(card) {
    openPicker({
      title: t("dicePickTitle"),
      options: [1, 2, 3, 4, 5, 6].map((value) => ({ label: `🎲 ${value}`, value, kind: "dice" })),
      onPick: (value) => actions.useCardWithValue(card, value),
      onCancel: () => {},
    });
  }

  function confirmCard(card) {
    openConfirm({
      title: t(`card_${card.split("_")[1]}`),
      body: t(`card_${card.split("_")[1]}Desc`),
      onOk: () => {
        if (card === "card_dice") openDicePicker(card);
        else actions.useCard(card);
      },
    });
  }

  function setLocale(next) {
    locale = next;
    const lang = htmlLang(locale);
    document.documentElement.lang = lang;
    document.title = t("docTitle");
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      const key = node.getAttribute("data-i18n");
      if (t(key) !== key) node.textContent = t(key);
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((node) => {
      const key = node.getAttribute("data-i18n-aria");
      node.setAttribute("aria-label", t(key));
    });
    const langBtn = $("btn-lang");
    if (langBtn) langBtn.textContent = locale === "en" ? "中文" : "EN";
    renderTiles();
    renderPark();
    renderDock();
    renderHud();
    updateTurnCallout();
    if (!$("mode-drawer")?.hidden) renderModeDrawer();
  }

  function setSound(on) {
    const btn = $("btn-sound");
    if (btn) {
      btn.textContent = on ? "♪" : "♪̸";
      btn.classList.toggle("muted", !on);
    }
  }

  function bindInternals() {
    $("btn-mode")?.addEventListener("click", () => {
      actions.clickSound();
      openMode();
    });
    $("btn-help")?.addEventListener("click", () => {
      actions.clickSound();
      openHelp();
    });
    $("mode-close")?.addEventListener("click", () => {
      el("mode-drawer").setAttribute("hidden", "");
    });
    $("help-close")?.addEventListener("click", () => {
      el("help").setAttribute("hidden", "");
    });
    $("pause-resume")?.addEventListener("click", () => actions.resume());
    $("pause-restart")?.addEventListener("click", () => {
      actions.restart();
      el("pause-layer").setAttribute("hidden", "");
    });
    $("pause-mode")?.addEventListener("click", () => {
      el("pause-layer").setAttribute("hidden", "");
      openMode();
    });
    $("result-again")?.addEventListener("click", () => {
      hideResult();
      actions.restart();
    });
    $("result-mode")?.addEventListener("click", () => {
      hideResult();
      openMode();
    });
    $("start-match")?.addEventListener("click", () => actions.startMatch());
    window.addEventListener("resize", () => {
      ensureCanvas();
      const state = game.state;
      if (state) {
        for (const player of state.players) {
          const visual = visualPos.get(player.id);
          placeToken(player.id, visual ?? player.pos, true);
        }
      }
    });
  }

  buildBoard();
  buildDice();
  bindInternals();
  ensureCanvas();
  setLocale(locale);

  return {
    sync,
    onGameEvent,
    showResult,
    hideResult,
    openPause,
    closePause,
    openHelp,
    openMode,
    setLocale,
    setSound,
    confirmCard,
    showToast,
    ensureTokens,
    buildHud,
    ensureCanvas,
    snapAllTokens,
    get locale() {
      return locale;
    },
    get resultOpen() {
      return resultOpen;
    },
    get overlayOpen() {
      return Boolean(document.querySelector("#mode-drawer:not([hidden]), #help:not([hidden]), #picker-modal:not([hidden]), #confirm-modal:not([hidden])"));
    },
    get diceVisual() {
      return currentDice;
    },
    t,
    money,
    playerNameById,
  };
}
