// 叠叠乐 · 控制器测试（game.mjs 严格 DOM-free，可直接 Node 跑）
//   1. 极限塔：自动落位 / 手动选槽 / 取消抽块 / 目标达成与星级
//   2. 机关：承重块必倒、阵生效
//   3. 双人对决：换手、判负、三局两胜
//   4. 残局解谜：四选一、答错倒塌、答对推进、十题收工
//   5. 长跑：≥1000 步随机操作不崩、统考 ID 合法性

import test from "node:test";
import assert from "node:assert/strict";

import { JengaGame, safestSlot } from "../js/game.mjs";
import {
  STATUS, MODE, TOTAL_BLOCKS, PER_LAYER, START_LAYERS,
  pullableBlocks, towerBlocks, layerCount, towerStats, mulberry32
} from "../js/engine.mjs";
import { multiplierFor, MAX_MULTIPLIER } from "../js/score.mjs";
import { LEVELS, RIDDLE_QUESTIONS, DUEL_WIN_TARGET, findLevel } from "../js/levels.mjs";

function pieces(game) {
  return pullableBlocks(game.state);
}

function afterStack(game) {
  // 一次成功 indicate「抽 + 叠」后塔堆状态稳定，跑一小段物理
  for (let i = 0; i < 24; i += 1) game.step(1 / 120);
}

// 稳健策略：优先抽「仍是满层、层数最高」的那块，再落到 deformations 最小的槽位
function smartPick(list, state) {
  const full = list.filter((p) => state.layers[p.layer].slots.filter((x) => x != null).length === PER_LAYER);
  const pool = full.length ? full : list;
  return pool.sort((a, b) => b.layer - a.layer)[0];
}

// 走一手：抽一块并落到指定（或自动）槽位
function move(game, pickFn, slotFn) {
  const list = pieces(game);
  if (!list.length) return false;
  const pick = pickFn ? pickFn(list) : smartPick(list, game.state);
  const pulled = game.pull(pick.layer, pick.slot);
  if (!pulled) return false;
  if (game.state.status === STATUS.HOLDING) {
    const slots = game.availableSlots();
    if (!slots.length) return false;
    const slot = slotFn ? slotFn(slots) : safestSlot(game.state);
    return game.stack(slot >= 0 ? slot : slots[0]);
  }
  return true;
}

test("开局：标准 18 层 54 块，第 1 章是自动落位", () => {
  const game = new JengaGame({ levelIndex: 1 });
  assert.equal(game.mode, MODE.SPIRE);
  assert.equal(layerCount(game.state), START_LAYERS);
  assert.equal(towerBlocks(game.state).length, TOTAL_BLOCKS);
  assert.equal(game.state.status, STATUS.IDLE);
  assert.equal(game.level.autoStack, true);

  // 抽一块后不应该停在"手上有块"的状态 —— 第 1 章替玩家落位
  const before = game.state.stackCount;
  move(game);
  assert.equal(game.state.status, STATUS.IDLE);
  assert.equal(game.state.stackCount, before + 1);
  assert.equal(game.state.held, null);
});

test("第 2 章起改为手动选槽，且可选 street 只有三个槽位", () => {
  const game = new JengaGame({ levelIndex: 7 });
  assert.equal(game.level.autoStack, false);
  const first = pieces(game)[0];
  game.pull(first.layer, first.slot);
  assert.equal(game.state.status, STATUS.HOLDING);
  const slots = game.availableSlots();
  assert.ok(slots.length >= 1 && slots.length <= PER_LAYER);
  game.stack(slots[0]);
  assert.equal(game.state.status, STATUS.IDLE);
});

test("取消抽块：块原位塞回，不消耗一次抽叠", () => {
  const game = new JengaGame({ levelIndex: 7 });
  const before = { pull: game.state.pullCount, stack: game.state.stackCount, layers: layerCount(game.state) };
  const first = pieces(game)[0];
  game.pull(first.layer, first.slot);
  assert.equal(game.state.status, STATUS.HOLDING);
  assert.equal(game.cancelPull(), true);
  assert.equal(game.state.status, STATUS.IDLE);
  assert.equal(game.state.pullCount, before.pull, "取消要把抽块数还回去");
  assert.equal(game.state.stackCount, before.stack);
  assert.equal(layerCount(game.state), before.layers);
  assert.equal(towerBlocks(game.state).length, TOTAL_BLOCKS, "取消后块数仍守恒");
  assert.equal(game.cancelPull(), false, "手上没块时取消应 no-op");
});

test("达成目标结算：达标即结算，评级与 cleanMoves / 连击一致", () => {
  const game = new JengaGame({ levelIndex: 1 });
  const events = [];
  game.subscribe((ev) => events.push(ev.type));
  // 订阅后再开一次局，才能捕到装配期的 level_loaded
  game.startLevel(1);
  for (let i = 0; i < 20 && !game.finished; i += 1) {
    move(game);
    afterStack(game);
  }
  assert.equal(game.finished, true, "连续抽叠 5 块必须达标");
  assert.equal(game.result.won, true);
  assert.ok(game.result.stars >= 1 && game.result.stars <= 3);
  assert.ok(events.includes("level_loaded"));
  assert.ok(events.includes("streak"));
  assert.ok(events.includes("finished"));
  assert.equal(game.pull(0, 0), false, "结算后一切操作 no-op");
});

test("谨防「无招胜有招」：目标未达成时不结算", () => {
  const game = new JengaGame({ levelIndex: 24 }); // 25 层 + ×27 连击，很难一次达标
  let guard = 0;
  while (!game.finished && guard < 60) {
    guard += 1;
    move(game, null, (slots) => slots[slots.length - 1]);
    afterStack(game);
  }
  if (game.result?.won) {
    assert.ok(game.state.bestStreak >= 3, "第 4 章达标必须打出 ×27");
  } else {
    // 没达标就必须是塔倒了
    assert.equal(game.state.status === STATUS.COLLAPSE || game.state.status === STATUS.LOST, true);
    assert.equal(game.result.stars, 0);
  }
});

test("机关：承重块抽了必倒，并在同一 pot 里一并结算 rounds", () => {
  const level = findLevel(13);
  assert.ok(level.loadMarks > 0);
  const game = new JengaGame({ levelIndex: level.index });
  assert.equal(game.marked.size, level.loadMarks);
  // 承重块不能落在最底三层或最顶三层，否则开局即死
  const layers = game.state.layers.length;
  for (const id of game.marked) {
    const block = game.state.blocks[id];
    assert.ok(block.layer >= 3 && block.layer < layers - 3, "承重块必须落在塔身中段");
  }
  // 手动抽出一块承重块
  const target = [...game.marked][0];
  const block = game.state.blocks[target];
  let sawLoad = false;
  game.subscribe((ev) => {
    if (ev.type === "load_pull") sawLoad = true;
  });
  game.pull(block.layer, block.slot);
  assert.equal(sawLoad, true);
  assert.equal(game.state.status, STATUS.COLLAPSE);
  assert.equal(game.result.won, false);
  assert.equal(game.result.stars, 0);
});

test("机关：阵风机周期性给塔身施加侧向外力", () => {
  const level = findLevel(13);
  const game = new JengaGame({ levelIndex: level.index });
  assert.equal(game.state.gust.enabled, true);
  // 无Referencias情况下风 enable/disable 都由关卡数据决定，且推进不抛错
  for (let i = 0; i < 1200; i += 1) game.step(1 / 120);
  assert.ok(Number.isFinite(game.state.sway.tx) && Number.isFinite(game.state.sway.tz));
  // 无风局不得出现风
  const calm = new JengaGame({ levelIndex: 1 });
  assert.equal(calm.state.gust.enabled, false);
});

test("双人对决：轮流换手、弄倒者输本局、三局两胜", () => {
  const game = new JengaGame({ mode: MODE.DUEL });
  game.setMode(MODE.DUEL);
  assert.equal(game.duel.round, 1);
  assert.equal(game.duel.active, 0);

  let handovers = 0;
  game.subscribe((ev) => {
    if (ev.type === "handover") handovers += 1;
  });

  // 轮流传一手，直到有人弄倒这座塔
  let guard = 0;
  while (!game.duel.seriesOver && guard < 400) {
    move(game, (list) => list[list.length - 1], (slots) => slots[0]);
    afterStack(game);
    if (game.state.status === STATUS.COLLAPSE || game.state.status === STATUS.LOST) {
      // 等塔落定
      for (let i = 0; i < 600 && game.state.status !== STATUS.LOST; i += 1) game.step(1 / 120);
      break;
    }
  }
  assert.ok(handovers >= 1, "每次成功都要换手");
  const played = game.duel.wins[0] + game.duel.wins[1];
  if (played > 0) {
    assert.equal(game.duel.round, played + 1);
    if (Math.max(...game.duel.wins) >= DUEL_WIN_TARGET) {
      assert.equal(game.duel.seriesOver, true);
      assert.equal(game.finished, true);
    } else {
      assert.equal(game.nextDuelRound(), true, "未分胜负就重摆一座新塔");
      assert.equal(game.state.status, STATUS.IDLE);
      assert.equal(towerBlocks(game.state).length, TOTAL_BLOCKS);
    }
  }
});

test("残局解谜：四选一恰有一块安全，答错就真塌，答对推进，十题收工", () => {
  const game = new JengaGame({ mode: MODE.RIDDLE });
  game.startRiddle();
  assert.equal(game.riddle.candidates.length, 4);
  const risky = game.riddle.candidates.filter((c) => c.risky);
  assert.equal(risky.length, 3, "必须恰有一块抽了不塌");
  const safe = game.riddle.candidates.find((c) => !c.risky);
  assert.equal(safe.layer, game.riddle.safe.layer);
  assert.equal(safe.slot, game.riddle.safe.slot);

  // 第一次答对
  assert.equal(game.pull(safe.layer, safe.slot), true);
  assert.equal(game.riddle.correct, 1);
  assert.equal(game.riddle.answered, true);
  // 答完后不得重复作答
  assert.equal(game.pull(safe.layer, safe.slot), false);

  let questions = 1;
  while (!game.riddle.done && questions < RIDDLE_QUESTIONS + 3) {
    questions += 1;
    game.nextRiddle();
    if (game.riddle.done) break;
    const wrong = game.riddle.candidates.find((c) => c.risky);
    game.pull(wrong.layer, wrong.slot);
    assert.equal(game.state.status, STATUS.COLLAPSE, "答错必须让这座塔当场倒塌");
  }
  assert.equal(game.riddle.done, true);
  assert.equal(game.riddle.index, RIDDLE_QUESTIONS);
  assert.ok(game.result.correct + game.result.wrong === RIDDLE_QUESTIONS);
  game.nextRiddle();
  assert.equal(game.riddle.index, RIDDLE_QUESTIONS, "收工后不得再出题");
});

test("自动落位挑的是最稳槽位（safestSlot 确定性可重现）", () => {
  const game = new JengaGame({ levelIndex: 7 });
  const first = pieces(game)[0];
  game.pull(first.layer, first.slot);
  const slotA = safestSlot(game.state);
  const slotB = safestSlot(game.state);
  assert.equal(slotA, slotB, "同一个局面两次求值必须一致");
  assert.ok(slotA >= 0 && slotA < PER_LAYER);
});

test("长跑：≥1000 步随机合法操作不崩、状态合法、倍率恒为 3 的幂", () => {
  const game = new JengaGame({ levelIndex: 12 });
  const rnd = mulberry32(20261009);
  let steps = 0;
  let attempts = 0;
  let rounds = 0;

  while (steps < 1000 && attempts < 24000) {
    attempts += 1;
    if (game.finished || game.state.status === STATUS.LOST) {
      rounds += 1;
      game.restart();
      continue;
    }
    const list = pieces(game);
    if (!list.length) {
      game.restart();
      continue;
    }
    const pick = list[Math.floor(rnd() * list.length)];
    const ok = game.pull(pick.layer, pick.slot);
    if (!ok) continue;
    if (game.state.status === STATUS.HOLDING) {
      const slots = game.availableSlots();
      game.stack(slots[Math.floor(rnd() * slots.length)]);
    }
    steps += 1;
    for (let i = 0; i < 6; i += 1) game.step(1 / 120);

    const stats = towerStats(game.state);
    assert.ok(stats.danger >= 0 && stats.danger <= 1);
    // 塌落演出期间木块已全部脱离塔体，"塔内 + 手上"守恒不再适用（那是塌落的定义）
    if (game.state.status === STATUS.IDLE || game.state.status === STATUS.HOLDING) {
      const live = towerBlocks(game.state).length + (game.state.held == null ? 0 : 1);
      assert.equal(live, TOTAL_BLOCKS, "块数守恒必须始终成立");
    }
    const mult = multiplierFor(stats.streak);
    assert.ok(mult >= 1 && mult <= MAX_MULTIPLIER, `倍率越界 ${mult}`);
    let probe = mult;
    while (probe > 1) {
      assert.equal(probe % 3, 0, `${mult} 不是 3 的幂次`);
      probe /= 3;
    }
  }
  assert.ok(steps >= 1000, `随机游走步数不足：${steps}`);
  assert.ok(rounds >= 1, "至少要跑完过一座塔");
});

test("模式切换：三种模式各自重建，不能互相污染", () => {
  const game = new JengaGame({ levelIndex: 3 });
  assert.equal(game.mode, MODE.SPIRE);
  game.setMode(MODE.DUEL);
  assert.equal(game.mode, MODE.DUEL);
  assert.equal(game.level.id, "level_duel");
  assert.equal(game.duel.wins.length, 2);
  game.setMode(MODE.RIDDLE);
  assert.equal(game.mode, MODE.RIDDLE);
  assert.equal(game.level.id, "level_riddle");
  assert.equal(game.riddle.candidates.length, 4);
  game.setMode(MODE.SPIRE);
  assert.equal(game.mode, MODE.SPIRE);
  assert.ok(LEVELS.some((lv) => lv.id === game.level.id));
});

test("暂停：物理冻结且不吞操作（paused 期间抽块被静默忽略）", () => {
  const game = new JengaGame({ levelIndex: 7 });
  game.togglePause();
  assert.equal(game.paused, true);
  const first = pieces(game)[0];
  assert.equal(game.pull(first.layer, first.slot), false);
  const t = game.state.time;
  for (let i = 0; i < 60; i += 1) game.step(1 / 60);
  assert.equal(game.state.time, t, "暂停时物理不得推进");
  game.togglePause();
  game.step(1 / 60);
  assert.ok(game.state.time > t, "恢复后时钟继续走");
});
