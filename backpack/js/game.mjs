// game.mjs — 背包竞技场 DOM-free 状态控制器
// 职责：编排 远征 / 残局 / 镜像 三模式；接收 UI 意图 → 调度 engine → 派发事件。
// 铁律：不碰 DOM；不直接改动 engine 内部状态；终局一律 no-op；无效意图返回 null 静默忽略。

import {
  mulberry32, makeGrid, cellKey, tryMove, trySwap, tryRemove, expandGrid,
  computeBuild, makeEnemy, createBattle, stepBattle as engineStep, settleCrafts,
  generateShop, expansionCost, solvePuzzle, layoutWins, synergyOf,
} from "./engine.mjs";
import {
  ITEMS, CLASSES, ENEMIES, EXPEDITION, enemyForRound, PUZZLES, MIRROR, CLASS_ORDER,
} from "./data.mjs";
import { puzzleStars as computeStars } from "./score.mjs";

// ---------------- 种子码 ----------------
// 种子码 → 32 位哈希 → mulberry32。整场远征的商店/战斗全部由它派生，可复现。
export function hashSeed(code) {
  const text = String(code ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (!text) return null;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const SEED_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function randomSeedCode() {
  const rng = mulberry32(Math.floor(Math.random() * 0xffffffff) >>> 0);
  let code = "BACKPACK-";
  for (let i = 0; i < 4; i += 1) code += SEED_ALPHABET[Math.floor(rng() * SEED_ALPHABET.length)];
  return code;
}

export function normalizeSeedCode(raw) {
  if (!raw) return null;
  const code = String(raw).toUpperCase().replace(/\s+/g, "").slice(0, 24);
  return code ? code : null;
}

// ---------------- 小工具 ----------------
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

let nextUid = 1;
function freshUid() {
  nextUid += 1;
  return nextUid;
}

function itemAt(items, uid) {
  return items.find((it) => it.uid === uid) ?? null;
}

// ---------------- 控制器 ----------------
export function createController({ lang, savedState, savedRun }) {
  const listeners = [];
  const t = (key) => key; // 文案由 UI 层取；控制器不接触 i18n 表格

  let state = {
    mode: "menu", // menu | expedition | puzzle | mirror
    lang,
    progress: savedState?.progress ?? null,
    run: null, // 远征状态
    puzzle: null, // 残局状态
    mirror: null, // 镜像状态
    toasts: [],
  };

  function emit(type, payload = {}) {
    for (const fn of listeners) {
      try {
        fn(type, payload);
      } catch (error) {
        // 监听器异常不得影响控制器
      }
    }
  }

  function update(patch) {
    state = { ...state, ...patch };
    emit("update", state);
    return state;
  }

  function toast(message) {
    emit("toast", { message });
  }

  // ---------------- 远征 ----------------
  function buildStarterItems(classId, bag) {
    const cls = CLASSES[classId];
    const ids = bag === "B" ? cls.startersB : cls.startersA;
    return ids.map((id) => ({ id, uid: freshUid(), x: -1, y: -1, rot: 0 }));
  }

  function createRun({ classId, bag, seed }) {
    const cls = CLASSES[classId];
    const grid = makeGrid(cls.grid.cols, cls.grid.rows, cls.grid.blocked ?? []);
    const items = buildStarterItems(classId, bag);
    // 起步自动摆放：逐件找第一个可放位（左上优先），保证开局一定有布局
    for (const item of items) {
      const placed = items.filter((it) => it.uid !== item.uid && it.x >= 0);
      let best = null;
      for (let y = 0; y < grid.rows && !best; y += 1) {
        for (let x = 0; x < grid.cols && !best; x += 1) {
          for (const rot of [0, 1]) {
            if (tryMove(grid, [...items.map((it) => ({ ...it })), item], item.uid, x, y, rot)) {
              best = { x, y, rot };
              break;
            }
          }
        }
      }
      if (best) Object.assign(item, best);
    }
    const rng = mulberry32(seed ?? 424242);
    const round = 1;
    const shopIds = generateShop(classId, round, rng, items.filter((it) => it.x >= 0));
    return {
      mode: "expedition",
      classId,
      bag,
      grid,
      items,
      rack: [], // 已购买待摆放
      gold: cls.starterGold,
      round,
      wins: 0,
      losses: 0,
      shop: shopIds.map((id) => ({ id, cost: ITEMS[id].cost })),
      expansionCount: 0,
      seed: seed ?? 424242,
      seedCode: seedCodeOf(seed),
      finished: false,
      battle: null,
      lastResult: null,
    };
  }

  function seedCodeOf(seed) {
    // 展示用种子码：用 32 位 seed 派生一个可回显的码
    const rng = mulberry32(seed);
    let code = "BACKPACK-";
    for (let i = 0; i < 4; i += 1) code += SEED_ALPHABET[Math.floor(rng() * SEED_ALPHABET.length)];
    return code;
  }

  function normalizeRun(raw) {
    if (!raw || raw.mode !== "expedition") return null;
    const cls = CLASSES[raw.classId];
    if (!cls) return null;
    const bag = raw.bag === "B" ? "B" : "A";
    const run = {
      mode: "expedition",
      classId: raw.classId,
      bag,
      grid: makeGrid(Number(raw.grid?.cols) || cls.grid.cols, Number(raw.grid?.rows) || cls.grid.rows, Array.isArray(raw.grid?.blocked) ? raw.grid.blocked : []),
      items: [],
      rack: [],
      gold: Number(raw.gold) || 0,
      round: Math.max(1, Math.min(EXPEDITION.maxRounds, Number(raw.round) || 1)),
      wins: Math.max(0, Number(raw.wins) || 0),
      losses: Math.max(0, Number(raw.losses) || 0),
      shop: Array.isArray(raw.shop) ? raw.shop.filter((s) => ITEMS[s.id]).map((s) => ({ id: s.id, cost: ITEMS[s.id].cost })) : [],
      expansionCount: Math.max(0, Number(raw.expansionCount) || 0),
      seed: Number(raw.seed) || 424242,
      seedCode: raw.seedCode || seedCodeOf(Number(raw.seed) || 424242),
      finished: Boolean(raw.finished),
      battle: null,
      lastResult: raw.lastResult ?? null,
    };
    for (const it of Array.isArray(raw.items) ? raw.items : []) {
      if (!ITEMS[it.id]) continue;
      const x = Math.trunc(Number(it.x) ?? -1);
      const y = Math.trunc(Number(it.y) ?? -1);
      const valid = it.x !== undefined && it.y !== undefined && x >= 0 && y >= 0 &&
        !run.items.some((other) => other.x === x && other.y === y);
      run.items.push({ id: it.id, uid: freshUid(), x: valid ? x : -1, y: valid ? y : -1, rot: Math.trunc(Number(it.rot) || 0) % 4 });
    }
    for (const it of Array.isArray(raw.rack) ? raw.rack : []) {
      if (ITEMS[it.id]) run.rack.push({ id: it.id, uid: freshUid(), rot: Math.trunc(Number(it.rot) || 0) % 4 });
    }
    return run;
  }

  function persistRun() {
    // 由控制器统一持有存档唯一口径（storage.mjs 提供快照通道）
    if (state.run) {
      const snapshot = clone(state.run);
      delete snapshot.battle;
      emit("persist", snapshot);
    }
  }

  function incomeOf(round) {
    return Math.min(EXPEDITION.incomeBase + round, EXPEDITION.incomeCap);
  }

  function refreshShop(run) {
    const rng = mulberry32(run.seed ^ Math.imul(run.round + 1, 0x9e3779b1));
    const ids = generateShop(run.classId, run.round, rng, run.items.filter((it) => it.x >= 0));
    run.shop = ids.map((id) => ({ id, cost: ITEMS[id].cost }));
  }

  function enemyOf(run) {
    return makeEnemy(enemyForRound(run.round), run.round);
  }

  function afterBoardChange(run) {
    // 自动合成结算：相邻配方/同色宝石 → 合并
    const placed = run.items.filter((it) => it.x >= 0);
    const { items, crafted } = settleCrafts(placed);
    if (crafted > 0) {
      // 找出新增合成物名（对比前后 id 集合）
      const before = new Set(placed.map((it) => it.id));
      const added = items.filter((it) => !before.has(it.id) && it.x >= 0);
      run.items = run.items.filter((it) => it.x < 0).concat(items);
      for (const it of added) {
        toast(`${it.id}`); // 具体名称由 UI 层按 id 取双语名
        emit("craft", { itemId: it.id });
      }
    } else {
      run.items = run.items.filter((it) => it.x < 0).concat(items);
    }
    if (state.mode === "expedition") refreshShop(run);
    persistRun();
  }

  // 远征：开始
  function startExpedition({ classId, bag = "A", seed = null }) {
    if (!CLASSES[classId]) return null;
    const run = createRun({ classId, bag, seed: seed ?? Math.floor(Math.random() * 0xffffffff) >>> 0 });
    update({ mode: "expedition", run });
    persistRun();
    emit("mode", { mode: "expedition" });
    return run;
  }

  // 远征：续玩
  function resumeExpedition() {
    if (!savedRun) return false;
    const run = normalizeRun(savedRun);
    if (!run || run.finished) return false;
    if (run.wins >= EXPEDITION.winsNeeded || run.losses >= EXPEDITION.lossesOut) run.finished = true;
    update({ mode: "expedition", run });
    emit("mode", { mode: "expedition" });
    return true;
  }

  function buyItem(slotIndex) {
    const run = state.run;
    if (!run || run.finished) return null;
    const offer = run.shop[slotIndex];
    if (!offer) return null;
    if (run.gold < offer.cost) {
      toast("gold-short");
      return null;
    }
    run.gold -= offer.cost;
    run.shop.splice(slotIndex, 1);
    run.rack.push({ id: offer.id, uid: freshUid(), rot: 0 });
    emit("buy", { itemId: offer.id, cost: offer.cost });
    persistRun();
    update({});
    return offer;
  }

  function sellItem(uid) {
    const run = state.run;
    if (!run || run.finished) return null;
    const onBoard = itemAt(run.items, uid);
    if (onBoard && onBoard.x >= 0) {
      const value = Math.max(1, Math.floor(ITEMS[onBoard.id].cost * 0.7));
      run.gold += value;
      run.items = tryRemove(run.items, uid) ?? run.items;
      emit("sell", { itemId: onBoard.id, value });
      afterBoardChange(run);
      return value;
    }
    const inRack = run.rack.find((it) => it.uid === uid);
    if (inRack) {
      const value = Math.max(1, Math.floor(ITEMS[inRack.id].cost * 0.7));
      run.gold += value;
      run.rack = run.rack.filter((it) => it.uid !== uid);
      emit("sell", { itemId: inRack.id, value });
      persistRun();
      return value;
    }
    return null;
  }

  function placeFromRack(uid, x, y, rot) {
    const run = state.run;
    if (!run || run.finished) return null;
    const idx = run.rack.findIndex((it) => it.uid === uid);
    if (idx < 0) return null;
    const item = run.rack[idx];
    const placed = run.items.filter((it) => it.x >= 0);
    let next = tryMove(run.grid, placed.concat(item), item.uid, x, y, rot);
    if (!next) {
      // 尝试自动换向
      next = tryMove(run.grid, placed.concat(item), item.uid, x, y, (rot + 1) % 2);
    }
    if (!next) {
      toast("full");
      return null;
    }
    run.rack.splice(idx, 1);
    run.items = run.items.filter((it) => it.uid !== item.uid).concat(next.find((it) => it.uid === item.uid));
    emit("place", { itemId: item.id });
    afterBoardChange(run);
    return item;
  }

  function moveItem(uid, x, y, rot) {
    const run = state.run;
    if (!run || run.finished) return null;
    const item = itemAt(run.items, uid);
    if (!item || item.x < 0) return null;
    const next = tryMove(run.grid, run.items, uid, x, y, rot);
    if (!next) return null;
    run.items = next;
    emit("move", { itemId: item.id });
    afterBoardChange(run);
    return next;
  }

  function swapItems(aUid, bUid) {
    const run = state.run;
    if (!run || run.finished) return null;
    const next = trySwap(run.grid, run.items, aUid, bUid);
    if (!next) return null;
    run.items = next;
    emit("swap", { aUid, bUid });
    afterBoardChange(run);
    return next;
  }

  function rotateItem(uid) {
    const run = state.run;
    if (!run || run.finished) return null;
    const onBoard = itemAt(run.items, uid);
    if (onBoard && onBoard.x >= 0) {
      const next = tryMove(run.grid, run.items, uid, onBoard.x, onBoard.y, (onBoard.rot + 1) % 4);
      if (!next) return null;
      run.items = next;
      afterBoardChange(run);
      return next;
    }
    const inRack = run.rack.find((it) => it.uid === uid);
    if (inRack) {
      inRack.rot = (inRack.rot + 1) % 4;
      persistRun();
      return run.rack;
    }
    return null;
  }

  function buyExpansion() {
    const run = state.run;
    if (!run || run.finished) return null;
    const cost = expansionCost(run.expansionCount);
    if (cost === null) return null;
    if (run.gold < cost) {
      toast("gold-short");
      return null;
    }
    run.gold -= cost;
    run.grid = expandGrid(run.grid, run.expansionCount);
    run.expansionCount += 1;
    emit("expand", { cost });
    afterBoardChange(run);
    return run.grid;
  }

  // 远征：开战（返回 battle 状态供 UI 动画驱动）
  function beginBattle() {
    const run = state.run;
    if (!run || run.finished || run.battle) return null;
    const playerSpec = computeBuild(run.items.filter((it) => it.x >= 0), run.classId, run.grid);
    const enemy = enemyOf(run);
    const seed = Math.floor(run.seed ^ Math.imul(run.round, 0x51ed270b)) >>> 0;
    const battle = createBattle(playerSpec, enemy.spec, seed);
    run.battle = { state: battle, enemy, seed };
    emit("battle-start", { round: run.round, enemyId: enemy.archetype.id });
    update({});
    return battle;
  }

  function stepBattle(dt = 0.1) {
    const run = state.run;
    if (!run || !run.battle) return false;
    const result = engineStep(run.battle.state, dt);
    emit("battle-step", { battle: run.battle.state, events: result.events, ended: result.ended });
    if (result.ended) {
      emit("battle-end", { battle: run.battle.state });
    }
    return result.ended;
  }

  function settleBattle() {
    const run = state.run;
    if (!run || !run.battle || !run.battle.state.ended) return null;
    const battle = run.battle.state;
    const won = battle.winner === 0;
    const hpPct = battle.sides[0].hp / battle.sides[0].spec.maxHp;
    if (won) run.wins += 1; else run.losses += 1;
    const over = run.wins >= EXPEDITION.winsNeeded || run.losses >= EXPEDITION.lossesOut || run.round >= EXPEDITION.maxRounds;
    const result = {
      won,
      hpPct,
      time: battle.time,
      round: run.round,
      endReason: battle.endReason,
      wins: run.wins,
      losses: run.losses,
      over,
      gold: run.gold,
      items: run.items.filter((it) => it.x >= 0).length,
    };
    run.lastResult = result;
    run.battle = null;
    if (over) {
      run.finished = true;
      // 段位结算
      const prog = progressAfterRun(run);
      emit("expedition-end", { result, progress: prog });
      emit("persist", null);
    } else {
      run.round += 1;
      run.gold += incomeOf(run.round);
      refreshShop(run);
      persistRun();
    }
    emit("settle", { result });
    update({});
    return result;
  }

  function progressAfterRun(run) {
    const { promoted, partial, wins } = rankProgress(run.wins, run.losses);
    return { promoted, partial, wins };
  }

  function rankProgress(wins, losses) {
    // 与 score.mjs 口径一致：10 胜晋级 +1；6 胜记半程
    const promoted = wins >= 10 ? 1 : 0;
    const partial = wins >= 6 ? 0.5 : 0;
    return { promoted, partial, wins };
  }

  function abandonRun() {
    if (state.run && !state.run.finished) {
      emit("expedition-end", { result: state.run.lastResult, progress: progressAfterRun(state.run), abandoned: true });
      emit("persist", null);
    }
    update({ mode: "menu", run: null });
  }

  // ---------------- 残局 ----------------
  function startPuzzle(puzzleId) {
    const puzzle = PUZZLES.find((p) => p.id === puzzleId);
    if (!puzzle) return null;
    const tray = [];
    for (const entry of puzzle.tray) {
      for (let i = 0; i < entry.qty; i += 1) tray.push({ id: entry.id, uid: freshUid(), rot: 0 });
    }
    state.puzzle = {
      id: puzzle.id,
      chapter: puzzle.chapter,
      starTime: puzzle.starTime,
      grid: makeGrid(puzzle.grid.cols, puzzle.grid.rows, puzzle.grid.blocked ?? []),
      tray,
      placed: [],
      enemy: puzzle.enemy,
      result: null,
      hint: null,
    };
    update({ mode: "puzzle", puzzle: state.puzzle });
    emit("mode", { mode: "puzzle" });
    return state.puzzle;
  }

  function placePuzzleItem(uid, x, y, rot) {
    const puzzle = state.puzzle;
    if (!puzzle || puzzle.result) return null;
    const idx = puzzle.tray.findIndex((it) => it.uid === uid);
    if (idx < 0) return null;
    const item = puzzle.tray[idx];
    let next = tryMove(puzzle.grid, puzzle.placed.concat(item), item.uid, x, y, rot);
    if (!next) next = tryMove(puzzle.grid, puzzle.placed.concat(item), item.uid, x, y, (rot + 1) % 2);
    if (!next) {
      toast("full");
      return null;
    }
    puzzle.tray.splice(idx, 1);
    puzzle.placed = puzzle.placed.concat(next.find((it) => it.uid === item.uid));
    emit("place", { itemId: item.id });
    update({});
    return item;
  }

  function movePuzzleItem(uid, x, y, rot) {
    const puzzle = state.puzzle;
    if (!puzzle || puzzle.result) return null;
    const next = tryMove(puzzle.grid, puzzle.placed, uid, x, y, rot);
    if (!next) return null;
    puzzle.placed = next;
    emit("move", {});
    update({});
    return next;
  }

  function removePuzzleItem(uid) {
    const puzzle = state.puzzle;
    if (!puzzle || puzzle.result) return null;
    const item = itemAt(puzzle.placed, uid);
    if (!item) return null;
    puzzle.placed = puzzle.placed.filter((it) => it.uid !== uid);
    puzzle.tray.push({ id: item.id, uid, rot: item.rot });
    update({});
    return puzzle.tray;
  }

  function puzzleEnemySpec(puzzle) {
    const enemy = ENEMIES[puzzle.enemy];
    return computeBuild(
      enemy.items.map((it, index) => ({ ...it, uid: index })),
      null,
      makeGrid(enemy.grid.cols, enemy.grid.rows),
      { hp: enemy.hp ?? 100 },
    );
  }

  function beginPuzzleBattle() {
    const puzzle = state.puzzle;
    if (!puzzle || puzzle.result) return null;
    const playerSpec = computeBuild(puzzle.placed, null, puzzle.grid);
    const enemySpec = puzzleEnemySpec(puzzle);
    const battle = createBattle(playerSpec, enemySpec, 12345);
    puzzle.battle = battle;
    emit("battle-start", { round: null, enemyId: puzzle.enemy, puzzle: true });
    update({});
    return battle;
  }

  function stepPuzzleBattle(dt = 0.1) {
    const puzzle = state.puzzle;
    if (!puzzle || !puzzle.battle) return false;
    const result = engineStep(puzzle.battle, dt);
    emit("battle-step", { battle: puzzle.battle, events: result.events, ended: result.ended });
    if (result.ended) emit("battle-end", { battle: puzzle.battle });
    return result.ended;
  }

  function settlePuzzleBattle() {
    const puzzle = state.puzzle;
    if (!puzzle || !puzzle.battle || !puzzle.battle.ended) return null;
    const battle = puzzle.battle;
    const hpPct = battle.sides[0].hp / battle.sides[0].spec.maxHp;
    const won = battle.winner === 0;
    const stars = won ? starsForPuzzle(puzzle, hpPct, battle.time) : 0;
    puzzle.result = { won, hpPct, time: battle.time, stars, endReason: battle.endReason };
    puzzle.battle = null;
    emit("puzzle-end", { puzzleId: puzzle.id, stars, won });
    update({});
    return puzzle.result;
  }

  function starsForPuzzle(puzzle, hpPct, time) {
    let stars = 1;
    if (hpPct * 100 >= 50) stars = 2;
    if (hpPct * 100 >= 50 && time <= puzzle.starTime) stars = 3;
    return stars;
  }

  function requestHint() {
    const puzzle = state.puzzle;
    if (!puzzle || puzzle.result) return null;
    const data = PUZZLES.find((p) => p.id === puzzle.id);
    let sol = null;
    try {
      sol = solvePuzzle(data, { beam: 320 });
    } catch (error) {
      sol = null;
    }
    puzzle.hint = sol ? sol.items : null;
    emit("hint", { puzzleId: puzzle.id, found: Boolean(sol) });
    update({});
    return puzzle.hint;
  }

  function exitPuzzle() {
    update({ mode: "menu", puzzle: null });
    emit("mode", { mode: "menu" });
  }

  // ---------------- 镜像 ----------------
  function startMirror() {
    // 镜像 = 当前远征布局（无远征则用狂战士开局模板）
    let source = null;
    if (state.run && !state.run.finished) {
      source = {
        classId: state.run.classId,
        items: state.run.items.filter((it) => it.x >= 0).map((it) => ({ ...it })),
        grid: state.run.grid,
      };
    }
    if (!source) {
      const cls = CLASSES.berserker;
      source = { classId: "berserker", items: buildStarterItems("berserker", "A").map((it) => ({ ...it, x: it.x >= 0 ? it.x : 0, y: it.y >= 0 ? it.y : 0 })), grid: makeGrid(cls.grid.cols, cls.grid.rows) };
    }
    const mirror = {
      floor: 1,
      source,
      result: null,
      battle: null,
      damage: 0,
    };
    update({ mode: "mirror", mirror });
    emit("mode", { mode: "mirror" });
    return mirror;
  }

  function mirrorSpec(source, floor) {
    const base = computeBuild(source.items, source.classId, source.grid);
    const growth = Math.pow(MIRROR.growthHp, floor - 1);
    const dmgMul = Math.pow(MIRROR.growthDmg, floor - 1);
    return {
      ...base,
      maxHp: Math.round(base.maxHp * growth),
      weapons: base.weapons.map((w) => ({
        ...w,
        dmg: [Math.round(w.dmg[0] * dmgMul), Math.round(w.dmg[1] * dmgMul)],
      })),
    };
  }

  function beginMirrorBattle() {
    const mirror = state.mirror;
    if (!mirror || mirror.result) return null;
    const playerSpec = computeBuild(mirror.source.items, mirror.source.classId, mirror.source.grid);
    const enemySpec = mirrorSpec(mirror.source, mirror.floor);
    const battle = createBattle(playerSpec, enemySpec, 777 + mirror.floor);
    mirror.battle = battle;
    emit("battle-start", { round: mirror.floor, enemyId: "mirror", mirror: true });
    update({});
    return battle;
  }

  function stepMirrorBattle(dt = 0.1) {
    const mirror = state.mirror;
    if (!mirror || !mirror.battle) return false;
    const result = engineStep(mirror.battle, dt);
    emit("battle-step", { battle: mirror.battle, events: result.events, ended: result.ended });
    if (result.ended) emit("battle-end", { battle: mirror.battle });
    return result.ended;
  }

  function settleMirrorBattle() {
    const mirror = state.mirror;
    if (!mirror || !mirror.battle || !mirror.battle.ended) return null;
    const won = mirror.battle.winner === 0;
    mirror.damage += Math.max(0, Math.round(mirror.battle.sides[0].spec.maxHp - mirror.battle.sides[0].hp));
    const result = { won, floor: mirror.floor, damage: mirror.damage };
    if (won) {
      mirror.floor += 1;
      mirror.result = null;
      mirror.battle = null;
      emit("mirror-win", { floor: mirror.floor });
    } else {
      mirror.result = result;
      mirror.battle = null;
      emit("mirror-end", { result });
    }
    update({});
    return result;
  }

  function exitMirror() {
    update({ mode: "menu", mirror: null });
    emit("mode", { mode: "menu" });
  }

  // ---------------- 公共 ----------------
  function setLang(lang) {
    update({ lang });
  }

  function selectedItemStats(uid) {
    const run = state.run;
    const item = (run && itemAt(run.items, uid)) || (state.puzzle && itemAt(state.puzzle.placed, uid));
    if (!item) return null;
    const grid = state.mode === "expedition" ? run.grid : state.puzzle.grid;
    const placed = state.mode === "expedition" ? run.items.filter((it) => it.x >= 0) : state.puzzle.placed;
    const bonus = synergyOf(grid, placed, item);
    return { item, synergy: bonus };
  }

  function toastSeen() {
    emit("toast-seen");
  }

  return {
    getState: () => state,
    on: (type, fn) => {
      // 兼容两种用法：on(callback) 与 on(type, fn)，listeners 统一存完整回调
      const handler = typeof fn === "function" ? fn : type;
      listeners.push(handler);
      return () => {
        const i = listeners.indexOf(handler);
        if (i >= 0) listeners.splice(i, 1);
      };
    },
    startExpedition,
    resumeExpedition,
    buyItem,
    sellItem,
    placeFromRack,
    moveItem,
    swapItems,
    rotateItem,
    buyExpansion,
    beginBattle,
    stepBattle,
    settleBattle,
    abandonRun,
    startPuzzle,
    placePuzzleItem,
    movePuzzleItem,
    removePuzzleItem,
    beginPuzzleBattle,
    stepPuzzleBattle,
    settlePuzzleBattle,
    requestHint,
    exitPuzzle,
    startMirror,
    beginMirrorBattle,
    stepMirrorBattle,
    settleMirrorBattle,
    exitMirror,
    setLang,
    selectedItemStats,
    toastSeen,
  };
}
