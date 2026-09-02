// 积分系统单元测试：覆盖 score 算法、engine movesPlayed(撤回不减少)、storage 持久化/破纪录/总分累计
import test from "node:test";
import assert from "node:assert/strict";

// localStorage shim (同 storage.test.mjs)
const LS = new Map();
function installStorage(initial = null) {
  LS.clear();
  if (initial !== null) LS.setItem?.("override");
  const fake = {
    getItem(key) { return Object.hasOwn(fake.data, key) ? fake.data[key] : null; },
    setItem(key, val) { fake.data[key] = String(val); },
    removeItem(key) { delete fake.data[key]; },
    clear() { fake.data = {}; },
    data: initial !== null && typeof initial === "object" ? Object.fromEntries(Object.entries(initial).map(([k,v])=>[k, typeof v === "string" ? v : JSON.stringify(v)])) : initial === "string" ? {} : {},
  };
  if (typeof initial === "string" && initial.startsWith("{")) {
    fake.data = { "doin.orbit-sort.progress.v1": initial };
  }
  globalThis.localStorage = fake;
  return fake;
}
function freshStorage() { return installStorage(JSON.stringify({ version: 1, unlockedLevel: 1, bestByLevel: {}, bestScoresByLevel: {}, totalScore: 0, totalMoves: 0, currentGame: null })); }

// 被测试对象：
import {
  baseScoreFor, moveMax, moveScore, timeMax, timeScore,
  difficultyForLevel, starsFor, computeScore, dailyBonusScore,
  MOVE_SCORE_MIN, TIME_SCORE_MIN, SCORE_MAX_PER_DIM,
} from "../js/score.mjs?v=dev";
import { createState, extractOrb, canExtract, insertOrb, canInsert, undo, reset } from "../engine.mjs?v=dev";
import { isValidStoredState, loadProgress, recordCompletion, recordDailyCompletion } from "../js/storage.mjs?v=dev";

test("score 模块常量合理", () => {
  assert.equal(MOVE_SCORE_MIN, 20);
  assert.equal(TIME_SCORE_MIN, 20);
  assert.equal(SCORE_MAX_PER_DIM, 100);
  assert.equal(dailyBonusScore(), 200);
});

// —— 难度反查 difficultyForLevel ——
test("difficultyForLevel: D1 3x3 dock=2 → 1", () =>
  assert.equal(difficultyForLevel({ capacity: 3, colorCount: 3, dockCount: 2, tracks: [[0,0,0],[1,1,1],[2,2,2],[]] }), 1));
test("difficultyForLevel: D7 5x5 dock=2 → 7", () =>
  assert.equal(difficultyForLevel({ capacity: 5, colorCount: 5, dockCount: 2, tracks: Array.from({length:6}, () => []) }), 7));
test("difficultyForLevel: D2 3x3 dock=1 → 2", () =>
  assert.equal(difficultyForLevel({ capacity: 3, colorCount: 3, dockCount: 1, tracks: Array.from({length:4}, () => []) }), 2));

// —— 基础分 baseScore ——
test("baseScore D1=120 D2=160 D3=200 D7=360 线性递增", () => {
  assert.equal(baseScoreFor(1), 120);
  assert.equal(baseScoreFor(2), 160);
  assert.equal(baseScoreFor(3), 200);
  assert.equal(baseScoreFor(7), 360);
  assert.equal(baseScoreFor(8), 400);
});
test("baseScore 今日挑战 +200 基础分奖励（高分翻倍爽感）", () => {
  assert.equal(baseScoreFor(1, true), 120 + 200);
  assert.equal(baseScoreFor(7, true), 360 + 200);
});

// —— 步数分 moveScore ——
test("moveScore ≤ par 直接满分 100", () => {
  const par = 7;
  for (let m = 0; m <= par; m += 1) assert.equal(moveScore(par, m), 100, `m=${m}`);
});
test(`moveScore par=7, Mmax=${Math.ceil(7*1.5)}=11, 所以 11 也 100；12 才 99`, () => {
  assert.equal(moveMax(7), 11);
  assert.equal(moveScore(7, 11), 100);
  assert.equal(moveScore(7, 12), 99);
});
test("moveScore 超 1 步减 1 分，逐步递减", () => {
  const par = 7; const mmax = moveMax(par);
  assert.equal(moveScore(par, mmax + 10), 100 - 10); // 90
  assert.equal(moveScore(par, mmax + 80), 100 - 80); // 20
});
test(`moveScore 保底 20 分 (永远不会低于)`, () => {
  assert.equal(moveScore(7, 9999), MOVE_SCORE_MIN);
  assert.equal(moveScore(23, moveMax(23) + 500), MOVE_SCORE_MIN);
});
test("moveScore par=23(D6 真实关卡) Mmax=35，35=100，45=90", () => {
  assert.equal(moveMax(23), 35);
  assert.equal(moveScore(23, 35), 100);
  assert.equal(moveScore(23, 45), 90);
});
test("moveScore par 参数/负数等边界保护", () => {
  // 非法 par 最低=1；非法 moves 当 0
  assert.equal(moveScore(0, 0), 100);
  // par=-5 会被夹到 1；moves=3 (3>1). Mmax=ceil(1*1.5)=2. penalty=1 → 99
  assert.equal(moveScore(-5, 3), 99);
  // moves 负数被夹到 0，直接 ≤ par → 满分
  assert.equal(moveScore(7, -3), 100);
});

// —— 时间分 timeScore ——
test("timeMax D1=45s, D2=63s, D7=45+6*18=153s", () => {
  assert.equal(timeMax(1), 45);
  assert.equal(timeMax(2), 63);
  assert.equal(timeMax(7), 153);
});
test("timeScore ≤ Tmax 满分 100", () => {
  for (const D of [1, 3, 7, 10]) {
    const tmax = timeMax(D);
    assert.equal(timeScore(D, (tmax - 0.1) * 1000), 100);
    assert.equal(timeScore(D, tmax * 1000), 100);
  }
});
test("timeScore 每多 10 秒扣 1 分（向下取整）", () => {
  const D = 7; const tmax = timeMax(D);
  // 153 + 10 = 163 → 多 10s → 99
  assert.equal(timeScore(D, (tmax + 10) * 1000), 99);
  // 153 + 19.999 → floor(1.9999)=1 → 仍然 99
  assert.equal(timeScore(D, (tmax + 19) * 1000), 99);
  // 153 + 20 → floor(2)=2 → 98
  assert.equal(timeScore(D, (tmax + 20) * 1000), 98);
});
test("timeScore 保底 20 分", () => {
  const D = 7; const tmax = timeMax(D);
  // 扣 80 分 需要 800s over（总计 953s）：20
  assert.equal(timeScore(D, (tmax + 800) * 1000), 20);
  assert.equal(timeScore(D, 10_000_000), TIME_SCORE_MIN);
});
test("timeScore 边界：负数 elapsed 当 0", () => {
  assert.equal(timeScore(5, -10_000), 100);
});

// —— 三星 starsFor ——
test("starsFor: par内=3★, par+1~3内=2★, >par+3=1★", () => {
  assert.equal(starsFor(7, 0), 3);
  assert.equal(starsFor(7, 7), 3);
  assert.equal(starsFor(7, 8), 2);
  assert.equal(starsFor(7, 10), 2);
  assert.equal(starsFor(7, 11), 1);
});

// —— computeScore 综合 ——
test("computeScore: 完美通关 (满步数满时间) → D1 = 120+100+100 = 320，三星", () => {
  const level = { id: 1, par: 7, capacity: 3, colorCount: 3, dockCount: 2, tracks: Array.from({length:4},()=>[]) };
  const r = computeScore({ level, movesPlayed: 0, elapsedMs: 0 });
  assert.equal(r.base, 120);
  assert.equal(r.move, 100);
  assert.equal(r.time, 100);
  assert.equal(r.total, 320);
  assert.equal(r.stars, 3);
});
test("computeScore: D7 超 10 步 + 超 20 秒 = 360+99+98=557，2★", () => {
  const level = { id: 7, difficulty: 7, par: 26, capacity: 5, colorCount: 5, dockCount: 2, tracks: Array.from({length:6},()=>[]) };
  const par26Mmax = moveMax(26); // 39
  const moves = par26Mmax + 1; // 40 → 99
  const tmax = timeMax(7); // 153
  const elapsedMs = (tmax + 20) * 1000; // 98
  const r = computeScore({ level, movesPlayed: moves, elapsedMs });
  assert.equal(r.difficulty, 7);
  assert.equal(r.move, 99);
  assert.equal(r.time, 98);
  assert.equal(r.total, 360 + 99 + 98);
});

// —— engine movesPlayed & startedAt（撤回不减少）——
function makeInitial() {
  // 最小化 3x3+2+1empty 起始局面：每个轨道装满，颜色 0/1/2 各有 3 个
  return createState({
    levelId: 1, capacity: 3, dockCount: 2, levelSeed: "x",
    tracks: [[0,0,0],[1,1,1],[2,2,2],[]],
  });
}
test("engine: 初始 state.stats = {startedAt:0, movesPlayed:0}", () => {
  const s = makeInitial();
  assert.equal(s.stats.movesPlayed, 0);
  assert.equal(s.stats.startedAt, 0);
  assert.equal(s.moves, 0);
});

test("engine: extract 成功 → movesPlayed +1，startedAt 设置为非零", () => {
  const s0 = makeInitial();
  const s1 = extractOrb(s0, 0);
  assert.equal(s1.moves, 1);
  assert.equal(s1.stats.movesPlayed, 1);
  assert.ok(s1.stats.startedAt > 0);
});

test("engine: select-dock/clear 不计入 movesPlayed (提取→放入循环累计，每次一对 movesPlayed 加个数等于 extract 次数)", () => {
  // 做 3 对 (extract 某轨道 → 放入空轨道)。总共 3 次 extract → movesPlayed=3
  // 注：insert 不加 moves，所以 moves 和 movesPlayed 都只有 extract 次数
  let s = makeInitial();
  const empty = s.tracks.find((t) => t.orbs.length === 0);
  for (let i = 0; i < 3; i += 1) {
    const from = s.tracks.find((t) => t.orbs.length > 0 && canExtract(s, t.id));
    if (!from) break;
    s = extractOrb(s, from.id);
    // 取出后，必须有一个 dock 选中携带 orb
    const usedDock = s.docks.find((d) => d.orb);
    if (usedDock && canInsert(s, usedDock.id, empty.id)) {
      s = insertOrb(s, usedDock.id, empty.id);
    }
  }
  // 循环 3 次：3 extracts + 3 inserts, moves==3 (只有 extract 算)
  assert.equal(s.moves, 3, "engine moves counter should equal extract count");
  assert.equal(s.stats.movesPlayed, 3, "movesPlayed also = extract count (inserts not counted, matches moves)");
});

test("engine: undo 1 次，moves 回退但 movesPlayed 不减少", () => {
  let s = makeInitial();
  const track0 = s.tracks.find((t) => t.orbs.length > 0 && canExtract(s, t.id));
  const s1 = extractOrb(s, track0.id);
  assert.equal(s1.moves, 1);
  assert.equal(s1.stats.movesPlayed, 1);
  const u1 = undo(s1);
  // 撤回 1 步后 moves=0 但 movesPlayed 保持 1 (只增不减)
  assert.equal(u1.moves, 0, "undo moves should go back");
  assert.equal(u1.stats.movesPlayed, 1, "undo should not reduce movesPlayed");
  assert.ok(u1.stats.startedAt > 0, "startedAt preserved");
});

test("engine: undo N 次 → movesPlayed 永远保持当前最大值", () => {
  let s = makeInitial();
  const empty = s.tracks.find((t) => t.orbs.length === 0);
  // 做 5 对 extract+insert
  for (let i = 0; i < 5; i += 1) {
    const from = s.tracks.find((x) => x.orbs.length > 0 && canExtract(s, x.id));
    if (!from) break;
    s = extractOrb(s, from.id);
    const d = s.docks.find((x) => x.orb);
    if (d && canInsert(s, d.id, empty.id)) s = insertOrb(s, d.id, empty.id);
  }
  const peakMoves = s.stats.movesPlayed;
  // 每次 extract 都会 moves+1，所以至少 3 个 extract 成功且没有 dock 资源耗尽
  assert.ok(peakMoves >= 3, `peakMoves should be at least 3, got ${peakMoves}`);
  // undo 3 次 (history 保存的是每次 extract 之前的快照)
  for (let i = 0; i < 3; i += 1) s = undo(s);
  assert.equal(s.stats.movesPlayed, peakMoves, "movesPlayed still at peak");
});

test("engine: reset 不减少 movesPlayed 与 startedAt", () => {
  const init = makeInitial();
  let s = extractOrb(init, 0);
  const started = s.stats.startedAt;
  assert.ok(started > 0);
  const r = reset(s, init);
  assert.equal(r.stats.movesPlayed, 1);
  assert.equal(r.stats.startedAt, started);
});

// —— storage 积分持久化 ——
test("storage: 主线关 recordCompletion（旧签名 moves 整数）向后兼容", () => {
  freshStorage();
  let p = loadProgress();
  const level = { id: 1, par: 5 };
  ({ progress: p } = recordCompletion(p, level, 4));
  assert.equal(p.bestByLevel[1].stars, 3);
  assert.equal(p.bestByLevel[1].moves, 4);
});

function makeScoreDetail(overrides = {}) {
  return {
    scoreDetail: { total: 320, base: 120, move: 100, time: 100, par: 7, difficulty: 1, stars: 3 },
    movesPlayed: 5,
    elapsedMs: 5000,
    moves: 5,
    ...overrides,
  };
}

test("storage: recordCompletion（新签名：含 scoreDetail）写入 bestScoresByLevel & totalScore 累计", () => {
  freshStorage();
  let p = loadProgress();
  const level = { id: 1, par: 7, difficulty: 1, capacity: 3, colorCount: 3, dockCount: 2, tracks: Array.from({length:4},()=>[]) };
  ({ progress: p } = recordCompletion(p, level, makeScoreDetail()));
  assert.ok(p.bestScoresByLevel[1]);
  assert.equal(p.bestScoresByLevel[1].score, 320);
  assert.equal(p.totalScore, 320);
  assert.equal(p.totalMoves, 5);
});

test("storage: 同一关玩两次，最高分保留，低分不替换，totalScore 只加 max", () => {
  freshStorage();
  let p = loadProgress();
  const level = { id: 1, par: 7, difficulty: 1, capacity: 3, colorCount: 3, dockCount: 2, tracks: Array.from({length:4},()=>[]) };
  // 第一次：320
  ({ progress: p } = recordCompletion(p, level, makeScoreDetail()));
  assert.equal(p.totalScore, 320);
  assert.equal(p.bestScoresByLevel[1].score, 320);
  // 第二次：更低分 (300) → 不替换
  ({ progress: p } = recordCompletion(p, level, makeScoreDetail({
    scoreDetail: { total: 300, base: 120, move: 90, time: 90, par: 7, difficulty: 1, stars: 2 },
    movesPlayed: 30, elapsedMs: 600_000, moves: 30,
  })));
  assert.equal(p.bestScoresByLevel[1].score, 320, "高分应当保留，低不替换");
  assert.equal(p.totalScore, 320);
  // 第三次：更高分 360 → 替换
  ({ progress: p } = recordCompletion(p, level, makeScoreDetail({
    scoreDetail: { total: 360, base: 120, move: 100, time: 140, par: 7, difficulty: 1, stars: 3 }, // time 分应该 20-100 但为了高分测试只看 total
    movesPlayed: 2, elapsedMs: 1000, moves: 2,
  })));
  assert.equal(p.bestScoresByLevel[1].score, 360);
  assert.equal(p.totalScore, 360);
});

test("storage: recordCompletion 主线第 7 关 → totalScore 正确反映单关最高分", () => {
  freshStorage();
  let p = loadProgress();
  for (const id of [1,2,3,4,5,6,7]) {
    const total = 300 + id * 10;
    ({ progress: p } = recordCompletion(p, { id, par: 10 }, {
      scoreDetail: { total, base: 100, move: 100, time: total-200, par: 10, difficulty: id, stars: 3 },
      movesPlayed: 5, elapsedMs: 5000, moves: 5,
    }));
  }
  // Σ (310 + 320 + ... + 370) = 7 * (310+370)/2 = 2380
  assert.equal(p.totalScore, 2380);
});

test("storage: recordDailyCompletion 今日挑战用 dateKey 入 bestScoresByLevel，且含 daily bonus (+200 基础分 + 步数/时间满分 150)", () => {
  freshStorage();
  let p = loadProgress();
  const dateKey = "2026-09-05";
  // daily 满分：base=320 (D1 120+200 dailyBonus) + move=150 + time=150 = 620
  ({ progress: p } = recordDailyCompletion(p, dateKey, {
    scoreDetail: { total: 620, base: 320, move: 150, time: 150, par: 7, difficulty: 1, stars: 3 },
    movesPlayed: 5, elapsedMs: 8000, moves: 5,
  }));
  assert.ok(p.bestScoresByLevel[`daily:${dateKey}`]);
  assert.equal(p.bestScoresByLevel[`daily:${dateKey}`].score, 620);
  assert.equal(p.daily.bestScore.score, 620);
  assert.equal(p.totalScore, 620);
  assert.equal(p.daily.completed, true);
  assert.equal(p.daily.dateKey, dateKey);
});

test("storage: recordDailyCompletion 重玩今日，低总分不覆盖高总分", () => {
  freshStorage();
  let p = loadProgress();
  const dk = "2026-09-10";
  const payload = (total) => ({
    scoreDetail: { total, base: 320, move: 150, time: total - 320 - 150, par: 7, difficulty: 1, stars: 3 },
    movesPlayed: 5, elapsedMs: 10_000, moves: 5,
  });
  ({ progress: p } = recordDailyCompletion(p, dk, payload(620)));
  ({ progress: p } = recordDailyCompletion(p, dk, payload(500)));
  assert.equal(p.daily.bestScore.score, 620); // 高分保持
  assert.equal(p.totalScore, 620);
  ({ progress: p } = recordDailyCompletion(p, dk, payload(700))); // 新纪录 700>620 → 更新
  assert.equal(p.daily.bestScore.score, 700);
  assert.equal(p.totalScore, 700);
});

test("storage: loadProgress 从 localStorage 正确加载并自动 recompute totalScore/totalMoves", () => {
  const fake = installStorage();
  fake.setItem("doin.orbit-sort.progress.v1", JSON.stringify({
    version: 1, unlockedLevel: 3,
    bestByLevel: { 1: { stars: 3, moves: 7 } },
    bestScoresByLevel: {
      1: { score: 320, base: 120, move: 100, time: 100, stars: 3, movesPlayed: 7, elapsedMs: 5000 },
      2: { score: 360, base: 160, move: 100, time: 100, stars: 3, movesPlayed: 6, elapsedMs: 3000 },
    },
    totalScore: 99999, // 损坏值 → loadProgress 会重新计算覆盖
    totalMoves: 0,
    currentGame: null,
    daily: { dateKey: null, completed: false, streak: 0, bestStreak: 0, lastCompletedDate: null, bestMoves: null, currentGame: null, bestScore: null },
  }));
  const p = loadProgress();
  assert.equal(p.totalScore, 320 + 360);
  assert.equal(p.totalMoves, 7 + 6);
});

test("storage: 今日挑战+主线关并存，totalScore 正确求和", () => {
  freshStorage();
  let p = loadProgress();
  ({ progress: p } = recordCompletion(p, { id: 1, par: 7 }, {
    scoreDetail: { total: 320, base: 120, move: 100, time: 100, par: 7, difficulty: 1, stars: 3 },
    movesPlayed: 5, elapsedMs: 5000, moves: 5,
  }));
  ({ progress: p } = recordDailyCompletion(p, "2026-01-01", {
    scoreDetail: { total: 620, base: 320, move: 150, time: 150, par: 7, difficulty: 1, stars: 3 },
    movesPlayed: 4, elapsedMs: 3000, moves: 4,
  }));
  assert.equal(p.totalScore, 320 + 620);
  assert.equal(p.totalMoves, 5 + 4);
});

test("storage: recordCompletion 返回 isNewHighScore / isNewBest 标识正确", () => {
  freshStorage();
  let p = loadProgress();
  const level = { id: 1, par: 7 };
  let r = recordCompletion(p, level, {
    scoreDetail: { total: 320, base: 120, move: 100, time: 100, par: 7, difficulty: 1, stars: 3 },
    movesPlayed: 5, elapsedMs: 5000, moves: 5,
  });
  assert.equal(r.isNewBest, true, "首次 → stars 新纪录");
  assert.equal(r.isNewHighScore, true, "首次 → score 新纪录");
  p = r.progress;
  // 同 score 320 再次 → 都 false
  r = recordCompletion(p, level, {
    scoreDetail: { total: 320, base: 120, move: 100, time: 100, par: 7, difficulty: 1, stars: 3 },
    movesPlayed: 5, elapsedMs: 5000, moves: 5,
  });
  assert.equal(r.isNewBest, false);
  assert.equal(r.isNewHighScore, false);
});
