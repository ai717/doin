// 纯规则引擎测试：洗牌、翻牌、连击、四大行动 (Flip/Scout/Steal/Lock)、胜负判定与 1000 步随机游走
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  applyFlipCard,
  applyEndExposure,
  applyScout,
  applySteal,
  applyLock,
  checkWinCondition,
  derangementShuffle,
  createRng,
} from "../js/engine.mjs";

test("derangementShuffle 无不动点打乱测试", () => {
  const list = Array.from({ length: 20 }, (_, i) => ({ originalIndex: i, val: i }));
  const rng = createRng(42);
  const shuffled = derangementShuffle(list, rng);
  assert.equal(shuffled.length, 20);
  // 确保没有元素停留在 originalIndex
  for (let i = 0; i < shuffled.length; i++) {
    assert.notEqual(shuffled[i].originalIndex, i, `位置 ${i} 出现不动点`);
  }
});

test("createGame 初始状态不变量", () => {
  const game = createGame({ pairCount: 10, targetPairs: 5, startingSp: 5, seed: 100 });
  assert.equal(game.board.length, 20);
  assert.equal(game.targetPairs, 5);
  assert.equal(game.activePlayer, "player");
  assert.equal(game.turnPhase, "action_select");
  assert.equal(game.players.player.sp, 5);
  assert.equal(game.players.opponent.sp, 5);
  assert.equal(game.players.player.pairs, 0);
  assert.equal(game.players.opponent.pairs, 0);
  assert.equal(game.winner, null);
});

test("翻开第一张与中途点击同一张取消翻牌", () => {
  const game = createGame({ pairCount: 10, seed: 200 });
  const { state: s1, action: a1 } = applyFlipCard(game, 0);
  assert.equal(a1.type, "flip_first");
  assert.equal(s1.turnPhase, "first_flipped");
  assert.equal(s1.selectedFirstIndex, 0);
  assert.equal(s1.board[0].state, "revealed");

  // 再次点击同一张 0：取消翻牌并盖回
  const { state: s2, action: a2 } = applyFlipCard(s1, 0);
  assert.equal(a2.type, "flip_cancel");
  assert.equal(s2.turnPhase, "action_select");
  assert.equal(s2.selectedFirstIndex, null);
  assert.equal(s2.board[0].state, "hidden");
});

test("两张翻牌配对成功：获得完整对并保留连击权", () => {
  const game = createGame({ pairCount: 10, seed: 300 });
  // 找到成对的两个索引
  const totem = game.board[0].totem;
  const matchIndex = game.board.findIndex((c, i) => i !== 0 && c.totem === totem);
  assert.ok(matchIndex > 0);

  const { state: s1 } = applyFlipCard(game, 0);
  const { state: s2, action: a2 } = applyFlipCard(s1, matchIndex);

  assert.equal(a2.type, "match_success");
  assert.equal(s2.players.player.pairs, 1);
  assert.equal(s2.comboCount, 1);
  assert.equal(s2.activePlayer, "player"); // 保持连击
  assert.equal(s2.turnPhase, "action_select");
  assert.equal(s2.board[0].state, "removed");
  assert.equal(s2.board[matchIndex].state, "removed");
});

test("两张翻牌配对失败：进入暴露窗口，随后换手", () => {
  const game = createGame({ pairCount: 10, seed: 400 });
  const firstTotem = game.board[0].totem;
  const diffIndex = game.board.findIndex((c, i) => i !== 0 && c.totem !== firstTotem);

  const { state: s1 } = applyFlipCard(game, 0);
  const { state: s2, action: a2 } = applyFlipCard(s1, diffIndex);

  assert.equal(a2.type, "match_fail");
  assert.equal(s2.turnPhase, "exposure_window");
  assert.equal(s2.players.player.mistakes, 1);

  // 结束暴露窗口
  const { state: s3, action: a3 } = applyEndExposure(s2);
  assert.equal(a3.type, "end_exposure");
  assert.equal(s3.activePlayer, "opponent"); // 换手
  assert.equal(s3.turnPhase, "action_select");
  assert.equal(s3.board[0].state, "hidden");
  assert.equal(s3.board[diffIndex].state, "hidden");
});

test("侦察行动 (Scout)：消耗 1 SP 并换手", () => {
  const game = createGame({ pairCount: 10, seed: 500 });
  const { state: s1, action: a1 } = applyScout(game, 2);
  assert.equal(a1.type, "scout");
  assert.equal(s1.players.player.sp, 4);
  assert.equal(s1.board[2].scoutedBy.player, true);
  assert.equal(s1.board[2].scoutedBy.opponent, false);
  assert.equal(s1.activePlayer, "opponent");
});

test("偷牌行动 (Steal)：消耗 2 SP，拆散对手未上锁对，自己得 1 张散牌", () => {
  const game = createGame({ pairCount: 10, seed: 600 });
  // 先给予对手 1 个未上锁对
  game.players.opponent.pairs = 1;
  game.players.opponent.lockedPairs = 0;

  const { state: s1, action: a1 } = applySteal(game);
  assert.equal(a1.type, "steal");
  assert.equal(s1.players.player.sp, 3); // 5 - 2 = 3
  assert.equal(s1.players.opponent.pairs, 0); // 拆散
  assert.equal(s1.players.player.looseCards, 1); // 散牌 +1
  assert.equal(s1.activePlayer, "opponent");

  // 尝试在对手没有未上锁对时再偷：应返回 action null
  const { action: a2 } = applySteal(s1);
  assert.equal(a2, null);
});

test("上锁行动 (Lock)：消耗 1 SP，为自己完整对上锁", () => {
  const game = createGame({ pairCount: 10, seed: 700 });
  game.players.player.pairs = 2;
  game.players.player.lockedPairs = 0;

  const { state: s1, action: a1 } = applyLock(game);
  assert.equal(a1.type, "lock");
  assert.equal(s1.players.player.sp, 4);
  assert.equal(s1.players.player.lockedPairs, 1);
  assert.equal(s1.activePlayer, "opponent");
});

test("胜负判定：达到目标对数立即获胜", () => {
  const game = createGame({ targetPairs: 5 });
  game.players.player.pairs = 5;
  const win = checkWinCondition(game);
  assert.equal(win.winner, "player");
  assert.equal(win.reason, "target_reached");
});

test("终态操作铁律：游戏分出胜负后任何操作为 no-op", () => {
  const game = createGame({ targetPairs: 5 });
  game.winner = "player";
  assert.equal(applyFlipCard(game, 0).action, null);
  assert.equal(applyScout(game, 0).action, null);
  assert.equal(applySteal(game).action, null);
  assert.equal(applyLock(game).action, null);
  assert.equal(applyEndExposure(game).action, null);
});

test("1000 步随机游走测试：验证状态机绝不抛错、不卡死、不变式不破", () => {
  const rng = createRng(99999);
  let state = createGame({ pairCount: 10, targetPairs: 5, seed: rng });

  for (let step = 0; step < 1000; step++) {
    if (state.winner) {
      // 重新开局继续游走
      state = createGame({ pairCount: 10, targetPairs: 5, seed: rng });
      continue;
    }

    const phase = state.turnPhase;
    if (phase === "exposure_window") {
      const res = applyEndExposure(state);
      assert.ok(res.state);
      state = res.state;
      continue;
    }

    if (phase === "first_flipped") {
      // 随机翻第二张
      const hiddenIndices = state.board
        .map((c, i) => (c.state === "hidden" ? i : -1))
        .filter((i) => i >= 0);
      if (hiddenIndices.length === 0) continue;
      const target = hiddenIndices[Math.floor(rng() * hiddenIndices.length)];
      const res = applyFlipCard(state, target);
      assert.ok(res.state);
      state = res.state;
      continue;
    }

    // action_select 阶段：随机在 4 个行动中选择合法的一项
    const choice = Math.floor(rng() * 4);
    if (choice === 0) {
      // Flip
      const hiddenIndices = state.board
        .map((c, i) => (c.state === "hidden" ? i : -1))
        .filter((i) => i >= 0);
      if (hiddenIndices.length > 0) {
        const target = hiddenIndices[Math.floor(rng() * hiddenIndices.length)];
        const res = applyFlipCard(state, target);
        assert.ok(res.state);
        state = res.state;
      }
    } else if (choice === 1) {
      // Scout
      const hiddenIndices = state.board
        .map((c, i) => (c.state === "hidden" ? i : -1))
        .filter((i) => i >= 0);
      if (hiddenIndices.length > 0 && state.players[state.activePlayer].sp >= 1) {
        const target = hiddenIndices[Math.floor(rng() * hiddenIndices.length)];
        const res = applyScout(state, target);
        assert.ok(res.state);
        state = res.state;
      }
    } else if (choice === 2) {
      // Steal
      const victim = state.activePlayer === "player" ? "opponent" : "player";
      if (state.players[state.activePlayer].sp >= 2 && state.players[victim].pairs > state.players[victim].lockedPairs) {
        const res = applySteal(state);
        assert.ok(res.state);
        state = res.state;
      }
    } else if (choice === 3) {
      // Lock
      const actor = state.activePlayer;
      if (state.players[actor].sp >= 1 && state.players[actor].pairs > state.players[actor].lockedPairs) {
        const res = applyLock(state);
        assert.ok(res.state);
        state = res.state;
      }
    }

    // 验证不变式：双方已锁对数必须 <= 完整对数
    assert.ok(state.players.player.lockedPairs <= state.players.player.pairs);
    assert.ok(state.players.opponent.lockedPairs <= state.players.opponent.pairs);
    // 验证 SP 非负
    assert.ok(state.players.player.sp >= 0);
    assert.ok(state.players.opponent.sp >= 0);
  }
});
