// 疯狂扭螺丝 (nuts) — 螺母色彩排序
// 玩法：点螺杆取下顶端螺母，放入任意有空位的螺杆；每根螺杆只放同色即通关。
// 关卡由种子确定性生成：从已解状态反向乱序，再经有界 DFS 校验可解后才发布。

const SAVE_KEY = "doin.nuts.save.v1";
const REGULAR_COUNT = 20;
const EXTREME_COUNT = 5;
const SOLVER_NODE_BUDGET = 160000;
const SOLVER_TIME_MS = 260;

/* ---------------- RNG & seeding ---------------- */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mix32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ---------------- Level specs ---------------- */

// { colors, stack, empty } — rods = colors + empty
const REGULAR_SPECS = [
  { colors: 2, stack: 3, empty: 2 }, { colors: 3, stack: 3, empty: 2 },
  { colors: 3, stack: 4, empty: 2 }, { colors: 4, stack: 3, empty: 2 },
  { colors: 4, stack: 4, empty: 2 }, { colors: 5, stack: 3, empty: 2 },
  { colors: 5, stack: 4, empty: 2 }, { colors: 5, stack: 5, empty: 2 },
  { colors: 6, stack: 3, empty: 2 }, { colors: 6, stack: 4, empty: 2 },
  { colors: 6, stack: 5, empty: 2 }, { colors: 7, stack: 3, empty: 2 },
  { colors: 7, stack: 4, empty: 2 }, { colors: 7, stack: 5, empty: 2 },
  { colors: 8, stack: 3, empty: 2 }, { colors: 8, stack: 4, empty: 2 },
  { colors: 8, stack: 5, empty: 2 }, { colors: 8, stack: 4, empty: 1 },
  { colors: 8, stack: 5, empty: 1 }, { colors: 9, stack: 5, empty: 1 },
];

const EXTREME_SPECS = [
  { colors: 4, stack: 3, empty: 1 }, { colors: 5, stack: 4, empty: 1 },
  { colors: 6, stack: 4, empty: 1 }, { colors: 7, stack: 5, empty: 1 },
  { colors: 8, stack: 5, empty: 1 },
];

function levelSeed(pack, index, dateKey) {
  if (pack === "daily") return mix32(`nuts/daily/${dateKey}`);
  return mix32(`nuts/${pack}/${index}`);
}

function packLength(pack) {
  return pack === "regular" ? REGULAR_COUNT : pack === "extreme" ? EXTREME_COUNT : 1;
}

function specFor(pack, index) {
  if (pack === "regular") return REGULAR_SPECS[index];
  if (pack === "extreme") return EXTREME_SPECS[index];
  return { colors: 7, stack: 4, empty: 2 };
}

/* ---------------- Board rules ---------------- */

function cloneRods(rods) { return rods.map((r) => r.slice()); }

function rodMonoFull(rod, stack) {
  return rod.length === 0 || (rod.length === stack && rod.every((c) => c === rod[0]));
}

function isSolved(rods, stack) { return rods.every((r) => rodMonoFull(r, stack)); }

function canMove(rods, from, to, stack) {
  if (from === to) return false;
  return rods[from].length > 0 && rods[to].length < stack;
}

function doMove(rods, from, to) { rods[to].push(rods[from].pop()); }

function stateKey(rods) {
  return rods.map((r) => r.join("")).sort().join("|");
}

/* ---------------- Solvability check (bounded DFS) ---------------- */

function findSolution(rods0, stack, nodeBudget, timeBudgetMs) {
  const start = Date.now();
  const seen = new Set();
  let nodes = 0;

  function dfs(rods, path) {
    if (++nodes > nodeBudget || Date.now() - start > timeBudgetMs) return null;
    const key = stateKey(rods);
    if (seen.has(key)) return null;
    seen.add(key);
    const n = rods.length;
    for (let from = 0; from < n; from++) {
      const src = rods[from];
      if (!src.length) continue;
      const fullMono = src.length === stack && src.every((c) => c === src[0]);
      if (fullMono) continue; // 满杆单色已归位，移动它只会绕路
      const color = src[src.length - 1];
      let usedEmpty = false;
      for (let to = 0; to < n; to++) {
        if (to === from || rods[to].length >= stack) continue;
        const dst = rods[to];
        if (dst.length === 0) {
          if (usedEmpty) continue; // 空杆等价，只试一根
          usedEmpty = true;
        } else if (dst[dst.length - 1] !== color) {
          continue;
        }
        doMove(rods, from, to);
        path.push([from, to]);
        if (isSolved(rods, stack)) {
          const answer = path.slice();
          path.pop();
          doMove(rods, to, from);
          return answer;
        }
        const deep = dfs(rods, path);
        path.pop();
        doMove(rods, to, from);
        if (deep) return deep;
      }
    }
    return null;
  }

  return dfs(cloneRods(rods0), []);
}

/* ---------------- Deterministic level generation ---------------- */

function scrambledRods(rng, colors, stack, empty, shuffles) {
  const rods = [];
  for (let c = 0; c < colors; c++) rods.push(Array(stack).fill(c));
  for (let e = 0; e < empty; e++) rods.push([]);
  let last = null;
  for (let s = 0; s < shuffles; s++) {
    const options = [];
    for (let from = 0; from < rods.length; from++) {
      if (!rods[from].length) continue;
      for (let to = 0; to < rods.length; to++) {
        if (!canMove(rods, from, to, stack)) continue;
        if (last && last[0] === to && last[1] === from) continue; // 不立刻撤销上一步
        options.push([from, to]);
      }
    }
    if (!options.length) break;
    const [from, to] = options[Math.floor(rng() * options.length)];
    doMove(rods, from, to);
    last = [from, to];
  }
  return rods;
}

// 多次换种子与乱序长度重试，直到得到「非预解 + 可解」的关卡
function buildLevel(pack, index, dateKey) {
  const spec = specFor(pack, index);
  const base = levelSeed(pack, index, dateKey);
  const scrambleBase = spec.colors * spec.stack * 2;
  for (let attempt = 0; attempt < 24; attempt++) {
    const rng = mulberry32((base + attempt * 7919) >>> 0);
    const shuffles = scrambleBase + Math.floor(rng() * spec.stack * 4);
    const rods = scrambledRods(rng, spec.colors, spec.stack, spec.empty, shuffles);
    if (isSolved(rods, spec.stack)) continue;
    const solution = findSolution(rods, spec.stack, SOLVER_NODE_BUDGET, SOLVER_TIME_MS);
    if (solution) {
      return { pack, index, spec, rods, par: solution.length };
    }
  }
  // 极端兜底：降低乱序强度，保证永远能发布一个可解关卡
  const rng = mulberry32((base + 99991) >>> 0);
  const rods = scrambledRods(rng, spec.colors, spec.stack, spec.empty, spec.colors * spec.stack);
  const solution = findSolution(rods, spec.stack, SOLVER_NODE_BUDGET * 2, SOLVER_TIME_MS * 2);
  return { pack, index, spec, rods, par: solution ? solution.length : spec.colors * spec.stack };
}

/* ---------------- Save / achievements ---------------- */

function defaultSave() {
  return {
    packs: {
      regular: { unlocked: 1, best: {} },
      daily: { clearedDates: [], best: {} },
      extreme: { unlocked: 1, best: {} },
    },
    streak: 0,
    lastClearedKey: null,
    resume: null,
  };
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw);
    if (!data || !data.packs || !data.packs.regular) return defaultSave();
    return Object.assign(defaultSave(), data);
  } catch {
    return defaultSave();
  }
}

function persistSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* 忽略隐私模式 */ }
}

/* ---------------- Game state ---------------- */

let save = loadSave();
let level = null;          // buildLevel() result
let rods = [];             // live board
let history = [];          // [from,to] moves
let picked = -1;
let moves = 0;
let elapsedMs = 0;
let timerStart = null;     // Date.now() while running
let timerId = null;
let won = false;

const $ = (id) => document.getElementById(id);
const boardEl = $("board");

function currentPack() { return level ? level.pack : "regular"; }
function packIndex() { return level ? level.index : 0; }
function levelKey(pack, index) { return pack === "daily" ? todayKey() : String(index); }

function extremeUnlocked() {
  return Math.min(EXTREME_COUNT, 1 + Math.floor(save.packs.regular.unlocked - 1) / 5);
}

function isUnlocked(pack, index) {
  if (pack === "regular") return index < save.packs.regular.unlocked;
  if (pack === "extreme") return index < extremeUnlocked();
  return true;
}

/* ---------------- Timer ---------------- */

function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function timerRunning() { return timerStart !== null; }
function currentElapsed() { return elapsedMs + (timerStart ? Date.now() - timerStart : 0); }

function startTimer() {
  if (timerRunning() || won) return;
  timerStart = Date.now();
  timerId = setInterval(() => { $("time").textContent = fmtTime(currentElapsed()); }, 500);
}
function pauseTimer() {
  if (!timerRunning()) return;
  elapsedMs = currentElapsed();
  timerStart = null;
  clearInterval(timerId);
  timerId = null;
}
function stopTimer() {
  if (timerRunning()) elapsedMs = currentElapsed();
  timerStart = null;
  clearInterval(timerId);
  timerId = null;
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden && moves > 0 && !won) {
    pauseTimer();
    $("time").textContent = fmtTime(elapsedMs);
  }
});

/* ---------------- Rendering ---------------- */

function renderBoard(dropRod = -1) {
  boardEl.classList.toggle("is-won", won);
  boardEl.innerHTML = "";
  boardEl.style.setProperty("--cap", level.spec.stack);
  rods.forEach((rod, i) => {
    const rodEl = document.createElement("div");
    rodEl.className = "rod" + (i === picked ? " is-picked" : "");
    rodEl.style.setProperty("--cap", level.spec.stack);
    rodEl.dataset.rod = i;
    rodEl.setAttribute("role", "button");
    rodEl.setAttribute("aria-label", `螺杆 ${i + 1}`);
    const base = document.createElement("span");
    base.className = "rod-base";
    rodEl.appendChild(base);
    rod.forEach((color, j) => {
      const nut = document.createElement("span");
      nut.className = `nut c${color}`;
      if (i === picked && j === rod.length - 1) nut.classList.add("is-lift");
      if (i === dropRod && j === rod.length - 1) nut.classList.add("is-drop");
      rodEl.appendChild(nut);
    });
    boardEl.appendChild(rodEl);
  });
}

function renderHUD() {
  $("level-label").textContent = currentPack() === "daily" ? "DAILY" : "LEVEL";
  $("level-num").textContent = currentPack() === "daily" ? todayKey().slice(5) : String(packIndex() + 1);
  $("moves").textContent = String(moves);
  $("par").textContent = level.par > 0 ? String(level.par) : "--";
  $("undo").disabled = history.length === 0 || won;
}

/* ---------------- Level lifecycle ---------------- */

function startLevel(pack, index, resumeSnapshot = null) {
  stopTimer();
  elapsedMs = 0;
  moves = 0;
  history = [];
  picked = -1;
  won = false;
  level = buildLevel(pack, index, todayKey());
  rods = resumeSnapshot ? cloneRods(resumeSnapshot.rods) : cloneRods(level.rods);
  if (resumeSnapshot) {
    moves = resumeSnapshot.moves || 0;
    history = (resumeSnapshot.history || []).slice();
    elapsedMs = resumeSnapshot.elapsedMs || 0;
    if (moves > 0) startTimer();
  }
  persistResume();
  renderBoard();
  renderHUD();
  $("time").textContent = fmtTime(elapsedMs);
  $("win-overlay").hidden = true;
}

function persistResume() {
  save.resume = {
    pack: currentPack(), index: packIndex(), dateKey: todayKey(),
    rods, moves, history, elapsedMs: currentElapsed(),
  };
  persistSave();
}

function clearResume() { save.resume = null; persistSave(); }

function resumeOrDefault() {
  const r = save.resume;
  if (r && (r.pack !== "daily" || r.dateKey === todayKey()) && Array.isArray(r.rods)) {
    startLevel(r.pack, r.index, r);
    return;
  }
  clearResume();
  startLevel("regular", Math.min(save.packs.regular.unlocked - 1, REGULAR_COUNT - 1));
}

/* ---------------- Interaction ---------------- */

function tapRod(i) {
  if (won) return;
  if (picked === -1) {
    if (!rods[i].length) return shake(i);
    picked = i;
    renderBoard();
    return;
  }
  if (picked === i) { picked = -1; renderBoard(); return; }
  if (!canMove(rods, picked, i, level.spec.stack)) {
    shake(i);
    return;
  }
  const from = picked;
  doMove(rods, from, i);
  history.push([from, i]);
  picked = -1;
  moves++;
  if (moves === 1) startTimer();
  renderBoard(i);
  renderHUD();
  persistResume();
  if (isSolved(rods, level.spec.stack)) onWin();
}

function shake(i) {
  renderBoard();
  const el = boardEl.children[i];
  if (el) {
    el.classList.add("is-shake");
    el.addEventListener("animationend", () => el.classList.remove("is-shake"), { once: true });
  }
}

function undo() {
  if (!history.length || won) return;
  const [from, to] = history.pop();
  doMove(rods, to, from);
  picked = -1;
  moves++;
  renderBoard();
  renderHUD();
  persistResume();
}

function restart() { startLevel(currentPack(), packIndex()); }

/* ---------------- Win & achievements ---------------- */

function starsFor(movesUsed, par) {
  if (par <= 0) return 2;
  if (movesUsed <= par) return 3;
  if (movesUsed <= par + 3) return 2;
  return 1;
}

function onWin() {
  stopTimer();
  won = true;
  const pack = currentPack();
  const index = packIndex();
  const key = levelKey(pack, index);
  const timeMs = elapsedMs;
  const stars = starsFor(moves, level.par);
  const badges = [];

  const packSave = save.packs[pack];
  const prev = packSave.best[key];
  const better = !prev || moves < prev.moves || (moves === prev.moves && timeMs < prev.timeMs);
  const perfect = level.par > 0 && moves <= level.par;
  packSave.best[key] = {
    moves: prev ? Math.min(prev.moves, moves) : moves,
    timeMs: prev ? Math.min(prev.timeMs, timeMs) : timeMs,
    perfect: Boolean(prev && prev.perfect) || perfect,
    stars: prev ? Math.max(prev.stars || 0, stars) : stars,
  };
  if (perfect) badges.push("PERFECT ★ 最少步通关");

  // 连胜只统计首次通关
  if (!prev) {
    if (pack === "regular") {
      save.packs.regular.unlocked = Math.max(save.packs.regular.unlocked, index + 2);
      if (index + 2 > 0 && (index + 1) % 5 === 0 && extremeUnlocked() > save.packs.extreme.unlocked) {
        save.packs.extreme.unlocked = extremeUnlocked();
        badges.push("极限关解锁 +1");
      }
    }
    if (save.lastClearedKey !== key) save.streak += 1;
    if (save.streak >= 3) badges.push(`连胜 ×${save.streak}`);
    save.lastClearedKey = key;
    if (pack === "daily" && !packSave.clearedDates.includes(key)) packSave.clearedDates.push(key);
  }

  clearResume();
  persistSave();

  $("win-title").textContent = perfect ? "PERFECT!" : "CLEAR!";
  $("win-stars").innerHTML = "★".repeat(stars) + `<span class="off">${"★".repeat(3 - stars)}</span>`;
  $("win-moves").textContent = String(moves);
  $("win-time").textContent = fmtTime(timeMs);
  $("win-badges").innerHTML = badges.join("<br>");
  const hasNext = pack !== "daily" && index + 1 < packLength(pack) && isUnlocked(pack, index + 1);
  $("next-level").hidden = !hasNext;
  $("win-overlay").hidden = false;
  renderBoard();
  renderHUD();
}

function nextLevel() {
  $("win-overlay").hidden = true;
  startLevel(currentPack(), packIndex() + 1);
}

/* ---------------- Level selector ---------------- */

function openLevels() {
  const grid = $("level-grid");
  grid.innerHTML = "";
  const pack = currentPack();
  const len = packLength(pack);
  for (let i = 0; i < len; i++) {
    const unlocked = isUnlocked(pack, i);
    const key = levelKey(pack, i);
    const best = save.packs[pack].best[key];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lvl" + (unlocked ? "" : " is-locked") + (i === packIndex() ? " is-cur" : "");
    const label = pack === "daily" ? todayKey().slice(5) : String(i + 1);
    const stars = best ? "★".repeat(best.stars || (best.perfect ? 3 : 1)) : "";
    const rec = best ? `${best.moves}步` : (unlocked ? "" : "🔒");
    btn.innerHTML = `<span>${label}</span><span class="stars">${stars}</span><span class="rec">${rec}</span>`;
    if (unlocked) btn.addEventListener("click", () => {
      $("levels-overlay").hidden = true;
      startLevel(pack, i);
    });
    grid.appendChild(btn);
  }
  $("levels-overlay").hidden = false;
}

/* ---------------- Tabs & wiring ---------------- */

function switchPack(pack) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("is-on", t.dataset.pack === pack));
  const index = pack === "regular"
    ? Math.min(save.packs.regular.unlocked - 1, REGULAR_COUNT - 1)
    : pack === "extreme"
      ? Math.min(save.packs.extreme.unlocked - 1, EXTREME_COUNT - 1)
      : 0;
  startLevel(pack, index);
}

boardEl.addEventListener("pointerdown", (e) => {
  const rodEl = e.target.closest(".rod");
  if (!rodEl) return;
  e.preventDefault();
  tapRod(Number(rodEl.dataset.rod));
});
document.addEventListener("keydown", (e) => {
  if (e.key >= "1" && e.key <= "9") tapRod(Number(e.key) - 1);
  if (e.key === "Escape") {
    picked = -1;
    renderBoard();
  }
});

$("undo").addEventListener("click", undo);
$("restart").addEventListener("click", restart);
$("levels").addEventListener("click", openLevels);
$("close-levels").addEventListener("click", () => { $("levels-overlay").hidden = true; });
$("next-level").addEventListener("click", nextLevel);
$("replay-level").addEventListener("click", () => {
  $("win-overlay").hidden = true;
  startLevel(currentPack(), packIndex());
});
$("tabs").addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (tab) switchPack(tab.dataset.pack);
});

resumeOrDefault();
