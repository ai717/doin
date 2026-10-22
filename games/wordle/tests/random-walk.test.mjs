// random-walk.test.mjs —— 确定性随机游走 ≥1000 步：状态机在任意合法输入流下不抛错、不变式守恒。
import { test } from "node:test";
import assert from "node:assert/strict";
import * as E from "../js/engine.mjs";
import { createGame } from "../js/game.mjs";
import * as S from "../js/storage.mjs";
import { CN_TRAY, EN_ANSWERS, EN_EXTRA, CN_IDIOMS, CN_EXTRA } from "../js/wordlists.mjs";

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rand, list) {
  return list[Math.floor(rand() * list.length)];
}

test("引擎级随机游走：150 回合 x 随机输入流，不变式守恒", () => {
  const rand = mulberry32(20261018);
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const tray = [...CN_TRAY];
  let steps = 0;
  for (let roundIdx = 0; roundIdx < 150; roundIdx++) {
    const track = rand() < 0.5 ? "en" : "cn";
    const answer = E.randomAnswer(track, Math.floor(rand() * 4294967296));
    const round = E.createRound({ track, answer });
    const len = round.length;
    for (let step = 0; step < 80; step++) {
      steps++;
      const roll = rand();
      if (roll < 0.55) {
        const ch = track === "en" ? letters[Math.floor(rand() * 26)] : pick(rand, tray);
        const before = round.draft.length;
        const ok = E.typeChar(round, ch);
        if (ok) assert.equal(round.draft.length, before + 1);
        else assert.ok(round.status !== E.STATUS.PLAYING || before >= len || (track === "en" && !/^[a-z]$/.test(ch)));
      } else if (roll < 0.7) {
        const before = round.draft.length;
        const ok = E.backspace(round);
        if (ok) assert.equal(round.draft.length, before - 1);
        else assert.ok(before === 0 || round.status !== E.STATUS.PLAYING);
      } else {
        const res = E.submit(round);
        if (res) {
          assert.equal(round.rows.length, res.rowIndex + 1);
          assert.equal(res.guess.length, round.length);
          if (res.status === E.STATUS.WON) {
            assert.ok(res.fb.every((f) => f === E.FB.CORRECT));
            assert.deepEqual(res.guess, [...answer]);
          }
          if (res.status === E.STATUS.LOST) assert.equal(round.rows.length, E.MAX_ROWS);
        } else {
          assert.ok(round.status !== E.STATUS.PLAYING || round.draft.length !== len || !E.isValidWord(track, round.draft.join("")));
        }
      }
      // 通用不变式
      assert.ok(round.rows.length <= E.MAX_ROWS);
      assert.ok(round.draft.length <= len);
      assert.ok(round.draft.every((ch) => E.isTrayChar(track, ch)));
      if (round.status === E.STATUS.PLAYING) assert.ok(round.rows.length < E.MAX_ROWS);
      if (round.status === E.STATUS.WON) assert.ok(round.rows.at(-1).fb.every((f) => f === E.FB.CORRECT));
      if (round.status === E.STATUS.LOST) {
        assert.equal(round.rows.length, E.MAX_ROWS);
        assert.ok(round.rows.every((r) => !r.fb.every((f) => f === E.FB.CORRECT)));
      }
      if (round.status !== E.STATUS.PLAYING) break;
    }
  }
  assert.ok(steps >= 1000, `实际步数 ${steps} < 1000`);
});

test("控制器级随机游走：1200 步模式/轨道/输入混流 + 存档往返", () => {
  const rand = mulberry32(987654321);
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const tray = [...CN_TRAY];
  const validWords = {
    en: [...EN_ANSWERS, ...EN_EXTRA],
    cn: [...CN_IDIOMS, ...CN_EXTRA],
  };
  const g = createGame();
  const store = S.normalize(null);
  const dayKey = "20261018";
  let steps = 0;
  let duelFinished = 0;
  let soloFinished = 0;
  for (let step = 0; step < 1200; step++) {
    steps++;
    if (!g.core()) g.ensureCore(g.track(), g.mode(), dayKey);
    const roll = rand();
    const core = g.core();
    const round = g.activeRound();
    if (roll < 0.05) {
      g.switchTrack(rand() < 0.5 ? "en" : "cn");
    } else if (roll < 0.1) {
      g.switchMode(pick(rand, ["daily", "practice", "duel"]));
      g.ensureCore(g.track(), g.mode(), dayKey);
    } else if (roll < 0.35) {
      const ch = g.track() === "en" ? letters[Math.floor(rand() * 26)] : pick(rand, tray);
      g.typeChar(ch);
    } else if (roll < 0.42) {
      g.backspace();
    } else {
      // 提交意图：清掉残稿，键入一个合法词（25% 概率直接键入真答案，压测胜利路径），随后提交
      const track = g.track();
      if (round.draft.length > 0) {
        while (g.backspace().ok) steps++;
      }
      const word = rand() < 0.25 ? [...core.answer] : [...pick(rand, validWords[track])];
      for (const ch of word) {
        steps++;
        g.typeChar(ch);
      }
      const playerIdx = core.active;
      const res = g.submitGuess();
      if (res) {
        assert.ok(res.core.players.every((r) => r.rows.length <= E.MAX_ROWS));
        assert.ok(res.core.players.every((r) => r.draft.length <= r.length));
        assert.ok(res.core.players.every((r) => r.status !== E.STATUS.PLAYING || r.rows.length < E.MAX_ROWS));
        if (res.finished) {
          if (res.finished.kind === E.MODES.DUEL) {
            duelFinished++;
            assert.ok([-1, 0, 1].includes(res.finished.winner));
            S.recordDuel(store, g.track(), res.finished.winner);
            S.clearDuelState(store, g.track());
            g.ensureCore(g.track(), g.mode(), dayKey); // 对抗一次性：立即开新局
          } else {
            soloFinished++;
            S.recordPractice(store, g.track(), res.finished.won, res.finished.guesses);
            g.newPractice(g.track());
          }
        } else if (res.core.kind === E.MODES.DUEL) {
          assert.ok([0, 1].includes(res.core.active), "对抗轮次始终在双方之间");
          if (res.core.players[playerIdx].status === E.STATUS.LOST) assert.equal(res.core.active, 1 - playerIdx);
        }
      }
    }
    // 通用不变式：任意时刻三轨三模式都保持合法状态
    for (const track of ["en", "cn"]) {
      for (const mode of ["daily", "practice", "duel"]) {
        const c = g.coreOf(track, mode);
        if (!c) continue;
        assert.ok(c.players.length === 1 || (c.kind === "duel" && c.players.length === 2));
        for (const r of c.players) {
          assert.ok(r.rows.length <= E.MAX_ROWS);
          assert.ok(r.draft.length <= r.length);
        }
      }
    }
  }
  assert.ok(steps >= 1000);
  // 压力下必须真实产生终局（验证游走深度，而非浅层空转）
  assert.ok(soloFinished + duelFinished >= 30, `终局数不足: solo=${soloFinished} duel=${duelFinished}`);
  // 存档不变式：practice 计数与实际 solo 终局一一对应
  const enP = store.en.practice;
  const cnP = store.cn.practice;
  assert.equal(enP.count + cnP.count, soloFinished);
  assert.ok(enP.wins <= enP.count && cnP.wins <= cnP.count);
  // 答案词必然在合法词库内（每日/练习出题口径）
  for (const track of ["en", "cn"]) {
    for (const mode of ["daily", "practice"]) {
      const c = g.coreOf(track, mode);
      if (!c) continue;
      assert.ok((track === "en" ? EN_ANSWERS : CN_IDIOMS).includes(c.answer));
    }
  }
});
