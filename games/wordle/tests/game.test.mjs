// game.test.mjs —— 控制器：双轨三模式独立进度、双人轮换、存档恢复、Instant Play。
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../js/engine.mjs";
import { createGame } from "../js/game.mjs";
import { EN_ANSWERS, EN_EXTRA, CN_IDIOMS } from "../js/wordlists.mjs";

function fill(round, word) {
  for (const c of word) E.typeChar(round, c);
}

test("ensureCore：Instant Play —— 任意轨/模式切换立即有可玩盘面", () => {
  const g = createGame();
  for (const track of ["en", "cn"]) {
    for (const mode of ["daily", "practice", "duel"]) {
      const core = g.ensureCore(track, mode, "20261018");
      assert.equal(core.kind, mode);
      assert.equal(core.track, track);
      assert.ok(core.players.length >= 1);
      const round = core.players[0];
      assert.equal(round.status, E.STATUS.PLAYING);
      assert.equal(round.rows.length, 0);
    }
  }
});

test("ensureCore：daily 用日期种子，同日同题", () => {
  const g = createGame();
  const a = g.ensureCore("en", "daily", "20261018");
  const b = g.ensureCore("en", "daily", "20261018");
  assert.equal(a, b, "同日重复 ensure 返回同一局");
  assert.equal(a.answer, E.pickDaily(EN_ANSWERS, "20261018"));
  const cn = g.ensureCore("cn", "daily", "20261018");
  assert.equal(cn.answer, E.pickDaily(CN_IDIOMS, "20261018"));
});

test("三模式与双轨进度互不干扰（切换不重置）", () => {
  const g = createGame();
  g.state.track = "en";
  g.state.mode = "practice";
  const p = g.ensureCore("en", "practice");
  fill(p.players[0], "crane");
  E.submit(p.players[0]);
  const d = g.ensureCore("en", "daily", "20261018");
  fill(d.players[0], "sauce");
  E.submit(d.players[0]);
  // 切走再切回，进度原样保留
  assert.equal(g.ensureCore("en", "practice").players[0].rows.length, 1);
  assert.equal(g.ensureCore("en", "daily", "20261018").players[0].rows.length, 1);
});

test("submitGuess：solo 胜利即结束", () => {
  const g = createGame();
  g.state.track = "en";
  g.state.mode = "daily";
  const core = g.ensureCore("en", "daily", "20261018");
  fill(core.players[0], core.answer);
  const res = g.submitGuess();
  assert.equal(res.status, E.STATUS.WON);
  assert.equal(res.finished.won, true);
  assert.equal(res.finished.guesses, 1);
  assert.equal(g.submitGuess(), null, "终局后提交 no-op");
});

test("submitGuess：词不在库返回 null（不消耗机会）", () => {
  const g = createGame();
  g.state.track = "en";
  g.state.mode = "practice";
  const core = g.ensureCore("en", "practice");
  fill(core.players[0], "zzzzz");
  assert.equal(g.submitGuess(), null);
  assert.equal(core.players[0].rows.length, 0);
  assert.equal(core.players[0].draft.length, 5, "草稿保留给玩家改词");
});

test("duel：先中者胜，败方打满 7 行后轮换", () => {
  const g = createGame();
  g.state.track = "en";
  g.state.mode = "duel";
  const core = g.ensureCore("en", "duel", "20261018");
  assert.equal(core.players.length, 2);
  // 甲 7 行全败 -> 轮到乙
  const wrong = EN_EXTRA.find((w) => w !== core.answer);
  for (let row = 0; row < 7; row++) {
    fill(core.players[0], wrong);
    g.submitGuess();
  }
  assert.equal(core.players[0].status, E.STATUS.LOST);
  assert.equal(core.active, 1);
  assert.equal(core.done, false, "乙方仍在局中，未终局");
  // 乙第 1 行猜中 -> 乙胜
  fill(core.players[1], core.answer);
  const res = g.submitGuess();
  assert.equal(core.done, true);
  assert.equal(core.winner, 1);
  assert.equal(res.finished.winner, 1);
  assert.deepEqual(res.finished.turns, [7, 1]);
});

test("duel：双双败北判平局", () => {
  const g = createGame();
  g.state.track = "cn";
  g.state.mode = "duel";
  const core = g.ensureCore("cn", "duel", "20261018");
  const wrong = CN_IDIOMS.find((w) => w !== core.answer);
  for (let i = 0; i < 14 && !core.done; i++) {
    fill(core.players[core.active], wrong);
    g.submitGuess();
  }
  assert.equal(core.done, true);
  assert.equal(core.winner, -1);
});

test("restoreDaily：day 匹配重放、不匹配新建当日局", () => {
  const g = createGame();
  const answer = E.pickDaily(EN_ANSWERS, "20261018");
  const core = g.restoreDaily("en", "20261018", { day: "20261018", guesses: ["sauce", answer], won: null, recorded: false });
  assert.equal(core.day, "20261018");
  assert.equal(core.players[0].rows.length, 2);
  assert.equal(core.done, true, "猜中即恢复为已结束");
  const g2 = createGame();
  const core2 = g2.restoreDaily("en", "20261018", { day: "20260101", guesses: ["sauce"], won: null, recorded: false });
  assert.equal(core2.day, "20261018", "旧档不覆盖新关");
  assert.equal(core2.players[0].rows.length, 0);
});

test("restoreDuel：重放双方进度与轮次", () => {
  const g = createGame();
  g.state.mode = "duel";
  const core = g.restoreDuel("en", "20261018", {
    day: "20261018",
    players: [["sauce", "spite"], ["sauce"]],
    active: 1,
    done: false,
    winner: null,
  });
  assert.equal(core.players[0].rows.length, 2);
  assert.equal(core.players[1].rows.length, 1);
  assert.equal(core.active, 1);
  assert.equal(core.done, false);
  // 已结束的对抗档不恢复，开新局
  const core2 = g.restoreDuel("en", "20261018", { day: "20261018", players: [[], []], active: 0, done: true, winner: 0 });
  assert.equal(core2.done, false);
});

test("useHint：solo 可用一次；duel 禁用；恢复的进度携带提示", () => {
  const g = createGame();
  g.state.track = "en";
  g.state.mode = "practice";
  const core = g.ensureCore("en", "practice");
  fill(core.players[0], "zzzzz");
  g.submitGuess();
  const ch = g.useHint();
  assert.ok(ch !== null && core.answer.includes(ch), "练习局提示揭示答案字符");
  assert.equal(g.useHint(), null, "同局第二次提示不可用");
  // duel 禁用
  g.state.mode = "duel";
  g.ensureCore("en", "duel", "20261018");
  assert.equal(g.useHint(), null, "双人对抗没有提示");
  // 每日进度重放携带 hint（storage 往返已在 storage 套件覆盖）
  g.state.mode = "daily";
  const daily = g.ensureCore("en", "daily", "20261018");
  const firstGuess = EN_ANSWERS.find((w) => w !== daily.answer);
  fill(daily.players[0], firstGuess);
  g.submitGuess();
  const hint = g.useHint();
  assert.ok(hint !== null, "每日局提示可用");
  const restored = E.replayRound({ track: "en", answer: daily.answer, guesses: daily.players[0].rows.map((r) => r.guess.join("")), hint });
  assert.equal(restored.hint, hint, "重放后提示保留");
  assert.equal(restored.rows.length, 1);
});

test("newPractice：随机/种子两种出题", () => {
  const g = createGame();
  const a = g.newPractice("en", 777);
  assert.equal(a.answer, E.pickBySeed(EN_ANSWERS, 777));
  assert.equal(a.seed, 777);
  const b = g.newPractice("en");
  assert.ok(EN_ANSWERS.includes(b.answer));
  assert.equal(typeof b.seed, "number");
});

test("typeChar/backspace 意图作用于当前活动板", () => {
  const g = createGame();
  g.state.track = "en";
  g.state.mode = "practice";
  g.ensureCore("en", "practice");
  assert.equal(g.typeChar("c").ok, true);
  assert.equal(g.typeChar("1").ok, false, "EN 轨拒绝数字");
  assert.equal(g.backspace().ok, true);
  assert.equal(g.backspace().ok, false, "空草稿退格无效");
  assert.equal(g.activeRound().draft.length, 0);
});

test("switchTrack/switchMode 拒绝非法参数", () => {
  const g = createGame();
  assert.equal(g.switchTrack("fr"), false);
  assert.equal(g.switchMode(" ranked "), false);
  assert.equal(g.switchTrack("cn"), true);
  assert.equal(g.switchMode("duel"), true);
});
