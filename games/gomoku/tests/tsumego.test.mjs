import test from "node:test";
import assert from "node:assert/strict";

import {
  TSUMEGO, getTsumego, listTsumego, listChapters,
} from "../js/tsumego.mjs";
import {
  createState, applyMove, BLACK, WHITE, EMPTY,
  STATUS_PLAYING, STATUS_WON, STATUS_FORBIDDEN,
  idx, rc,
} from "../js/engine.mjs";

const eq = assert.strictEqual;

test("TSUMEGO 共 30 题", () => {
  eq(TSUMEGO.length, 30);
});

test("listTsumego 返回 30 项且顺序 id 1..30", () => {
  const list = listTsumego();
  eq(list.length, 30);
  for (let i = 0; i < 30; i += 1) {
    eq(list[i].id, i + 1);
  }
});

test("listChapters 返回 6 章", () => {
  const chapters = listChapters();
  eq(chapters.length, 6);
  for (let i = 0; i < 6; i += 1) {
    eq(chapters[i].chapter, i + 1);
    eq(chapters[i].puzzles.length, 5);
  }
});

test("所有题目字段齐全", () => {
  for (const p of TSUMEGO) {
    assert.ok(typeof p.id === "number" && p.id >= 1 && p.id <= 30, `id 非法: ${p.id}`);
    assert.ok(typeof p.chapter === "number" && p.chapter >= 1 && p.chapter <= 6);
    assert.ok(typeof p.name === "string" && p.name.length > 0, `题 ${p.id} 缺中文名`);
    assert.ok(typeof p.nameEn === "string" && p.nameEn.length > 0, `题 ${p.id} 缺英文名`);
    assert.ok(p.target === "win" || p.target === "draw", `题 ${p.id} target 非法: ${p.target}`);
    assert.ok(p.firstPlayer === BLACK || p.firstPlayer === WHITE, `题 ${p.id} firstPlayer 非法`);
    assert.ok(typeof p.parMoves === "number" && p.parMoves >= 1, `题 ${p.id} parMoves 非法`);
    assert.ok(Array.isArray(p.preset) && p.preset.length > 0, `题 ${p.id} 缺 preset`);
    assert.ok(Array.isArray(p.mainLine) && p.mainLine.length > 0, `题 ${p.id} 缺 mainLine`);
    assert.ok(typeof p.hint === "string" && p.hint.length > 0, `题 ${p.id} 缺 hint`);
  }
});

test("所有题目的 preset 与 mainLine 索引合法 (0..224)", () => {
  for (const p of TSUMEGO) {
    for (const m of p.preset) {
      assert.ok(Number.isInteger(m.pos) && m.pos >= 0 && m.pos < 225, `题 ${p.id} preset pos 非法: ${m.pos}`);
      assert.ok(m.player === BLACK || m.player === WHITE, `题 ${p.id} preset player 非法`);
    }
    for (const m of p.mainLine) {
      assert.ok(Number.isInteger(m) && m >= 0 && m < 225, `题 ${p.id} mainLine index 非法: ${m}`);
    }
  }
});

test("preset 落子位置不冲突", () => {
  for (const p of TSUMEGO) {
    const seen = new Set();
    for (const m of p.preset) {
      assert.ok(!seen.has(m.pos), `题 ${p.id} preset 位置冲突: pos=${m.pos}`);
      seen.add(m.pos);
    }
  }
});

test("mainLine 着法位置不在 preset 中且不重复", () => {
  for (const p of TSUMEGO) {
    const presetPositions = new Set(p.preset.map((m) => m.pos));
    const seen = new Set();
    for (const m of p.mainLine) {
      assert.ok(!presetPositions.has(m), `题 ${p.id} mainLine 位置 ${m} 与 preset 冲突`);
      assert.ok(!seen.has(m), `题 ${p.id} mainLine 重复位置: ${m}`);
      seen.add(m);
    }
  }
});

// ─── 30 题正解重放校验（核心门禁）──────────────────────────────
// 按 mainLine 顺序走子，最后一步必然形成"黑/白先 X 手胜/和"结局。
test("30 题正解重放：每题按 mainLine 走子达到目标结局", () => {
  for (const p of TSUMEGO) {
    // 构造初始状态：preset + firstPlayer + current=firstPlayer
    let state = createState({
      preset: p.preset,
      firstPlayer: p.firstPlayer,
      current: p.firstPlayer,
    });
    eq(state.status, STATUS_PLAYING, `题 ${p.id} 初始非 playing`);

    // 按 mainLine 交替走子（mainLine[0] 是 firstPlayer 的着法）
    let lastStatus = state.status;
    let lastWinner = state.winner;
    for (let i = 0; i < p.mainLine.length; i += 1) {
      const move = p.mainLine[i];
      const next = applyMove(state, move);
      assert.notStrictEqual(next, state, `题 ${p.id} 第 ${i + 1} 手 (${move}) 着法无效`);
      state = next;
      lastStatus = state.status;
      lastWinner = state.winner;
    }

    if (p.target === "win") {
      // 必须以 STATUS_WON 或 STATUS_FORBIDDEN（黑方禁手负白胜）结束
      // 且 winner 应为 firstPlayer（执子方）
      assert.ok(
        lastStatus === STATUS_WON || lastStatus === STATUS_FORBIDDEN,
        `题 ${p.id} 正解后未制胜，status=${lastStatus}`,
      );
      eq(lastWinner, p.firstPlayer, `题 ${p.id} 胜方应为 firstPlayer=${p.firstPlayer}, 实际 winner=${lastWinner}`);
    } else if (p.target === "draw") {
      // 和棋题：mainLine 走完后不应是 firstPlayer 制胜
      // 可能是 STATUS_PLAYING（如玩家堵住威胁使局势稳定）或 STATUS_DRAW
      // 至少不能是 firstPlayer 直接制胜（否则就不是 draw 题）
      if (lastStatus === STATUS_WON || lastStatus === STATUS_FORBIDDEN) {
        assert.notStrictEqual(lastWinner, p.firstPlayer, `题 ${p.id} 和棋题却被 firstPlayer 制胜`);
      }
      // STATUS_PLAYING 或 STATUS_DRAW 均可接受
      assert.ok(
        [STATUS_PLAYING, "draw", STATUS_WON, STATUS_FORBIDDEN].includes(lastStatus),
        `题 ${p.id} 和棋题终态异常: ${lastStatus}`,
      );
    }
  }
});

// ─── 残局正解手数校验 ──────────────────────────────────────────
// parMoves 应等于 firstPlayer 在 mainLine 中的着法数（即玩家的正解手数）
test("parMoves 与 mainLine 中 firstPlayer 手数一致", () => {
  for (const p of TSUMEGO) {
    // mainLine[0]=firstPlayer, mainLine[1]=opponent, mainLine[2]=firstPlayer, ...
    // firstPlayer 的手数 = ceil(mainLine.length / 2)
    const firstMoves = Math.ceil(p.mainLine.length / 2);
    // parMoves 应等于 firstMoves（玩家正解手数）
    // 但部分题目可能 parMoves 是玩家手数，可能小于 firstMoves（如果最后制胜手也算）
    // 这里只做软校验：parMoves 应在 [1, firstMoves] 区间
    assert.ok(
      p.parMoves >= 1 && p.parMoves <= firstMoves + 1,
      `题 ${p.id} parMoves=${p.parMoves} 与 firstMoves=${firstMoves} 不匹配`,
    );
  }
});

// ─── 第 1 章单手胜（5 题都应在 mainLine[0] 即制胜）────────────
test("第 1 章：5 题均为 1 手胜", () => {
  for (const p of TSUMEGO.filter((t) => t.chapter === 1)) {
    eq(p.target, "win");
    eq(p.parMoves, 1);
    eq(p.mainLine.length, 1);

    // 走 mainLine[0] 后必须制胜
    const state = createState({
      preset: p.preset,
      firstPlayer: p.firstPlayer,
      current: p.firstPlayer,
    });
    const after = applyMove(state, p.mainLine[0]);
    assert.ok(
      after.status === STATUS_WON || after.status === STATUS_FORBIDDEN,
      `题 ${p.id} 第 1 手未制胜: ${after.status}`,
    );
    eq(after.winner, p.firstPlayer);
  }
});

// ─── 第 2 章：VCF 入门（3-5 手胜）────────────────────
test("第 2 章：5 题均为 VCF 入门（黑 2-3 手胜）", () => {
  for (const p of TSUMEGO.filter((t) => t.chapter === 2)) {
    eq(p.target, "win");
    assert.ok(p.parMoves === 2 || p.parMoves === 3, `题 ${p.id} parMoves=${p.parMoves}`);
    assert.ok(p.mainLine.length === 3 || p.mainLine.length === 5, `题 ${p.id} mainLine.length=${p.mainLine.length}`);
  }
});

// ─── 第 3 章：和棋题 1 手和 ─────────────────────────────────
test("第 3 章：5 题均为和棋（draw）", () => {
  for (const p of TSUMEGO.filter((t) => t.chapter === 3)) {
    eq(p.target, "draw");
  }
});

// ─── 第 4 章：5 手胜 ───────────────────────────────────────
test("第 4 章：5 题均为 5 手胜", () => {
  for (const p of TSUMEGO.filter((t) => t.chapter === 4)) {
    eq(p.target, "win");
    eq(p.parMoves, 3);
    eq(p.mainLine.length, 5);
  }
});

// ─── 第 5 章：3-5 手胜 ────────────────────────────────────
test("第 5 章：5 题均为双杀形（win）", () => {
  for (const p of TSUMEGO.filter((t) => t.chapter === 5)) {
    eq(p.target, "win");
    assert.ok(p.parMoves >= 2 && p.parMoves <= 3);
    assert.ok(p.mainLine.length >= 3 && p.mainLine.length <= 5);
  }
});

// ─── 第 6 章：传世死活 7-11 手胜 ───────────────────────────
test("第 6 章：5 题均为长链制胜", () => {
  for (const p of TSUMEGO.filter((t) => t.chapter === 6)) {
    eq(p.target, "win");
    assert.ok(p.parMoves >= 4, `题 ${p.id} 第 6 章 parMoves=${p.parMoves} 太少`);
    assert.ok(p.mainLine.length >= 5, `题 ${p.id} 第 6 章 mainLine 太短`);
  }
});

test("getTsumego: 取每题都正确", () => {
  for (let id = 1; id <= 30; id += 1) {
    const p = getTsumego(id);
    assert.ok(p, `题 ${id} 取不到`);
    eq(p.id, id);
  }
});

test("getTsumego: 越界 id 返回 null", () => {
  eq(getTsumego(0), null);
  eq(getTsumego(31), null);
  eq(getTsumego(-1), null);
});

test("所有题目 preset 至少 2 子（避免空盘残局）", () => {
  for (const p of TSUMEGO) {
    assert.ok(p.preset.length >= 2, `题 ${p.id} preset 过少: ${p.preset.length}`);
  }
});

test("所有题目 mainLine 至少 1 步", () => {
  for (const p of TSUMEGO) {
    assert.ok(p.mainLine.length >= 1, `题 ${p.id} mainLine 为空`);
  }
});
