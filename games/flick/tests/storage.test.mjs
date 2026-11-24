import test from "node:test";
import assert from "node:assert/strict";

import {
  STORAGE_KEY,
  bestRecord,
  defaultProgress,
  load,
  normalize,
  recordMatch,
  rememberSettings,
  resetBackendForTests,
  save,
  setBackendForTests,
} from "../js/storage.mjs";

function fakeBackend(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

const baseState = {
  mode: "solo",
  difficulty: "ai_novice",
  boardId: "board_1gate",
  humanSide: "south",
  round: 12,
  time: 48.5,
  reason: "cleared",
};

test("存档：键统一且默认结构完整", () => {
  assert.equal(STORAGE_KEY, "doin.flick.v1");
  const base = defaultProgress();
  assert.equal(base.version, 1);
  assert.deepEqual(base.settings, {
    mode: "solo",
    difficulty: "ai_novice",
    boardId: "board_1gate",
    humanSide: "south",
  });
  assert.deepEqual(base.stats, { played: 0, wins: 0, losses: 0, draws: 0 });
  assert.deepEqual(base.best, {});
});

test("存档：坏数据归一化为默认值", () => {
  assert.deepEqual(normalize(null), defaultProgress());
  assert.deepEqual(normalize("oops"), defaultProgress());
  assert.deepEqual(normalize({ settings: 3, stats: 5, best: 9 }).stats, {
    played: 0,
    wins: 0,
    losses: 0,
    draws: 0,
  });
  const clean = normalize({
    settings: { mode: "duel", difficulty: "nope", boardId: "x", humanSide: "east" },
    best: {
      "solo_ai_novice_board_1gate_south": { rounds: 99, time: -3 },
      "bad-key": { rounds: 4, time: 9 },
    },
  });
  assert.deepEqual(clean.settings, {
    mode: "duel",
    difficulty: "ai_novice",
    boardId: "board_1gate",
    humanSide: "south",
  });
  assert.equal(clean.best["solo_ai_novice_board_1gate_south"].rounds, 60);
  assert.equal(clean.best["solo_ai_novice_board_1gate_south"].time, 0);
  assert.equal(clean.best["bad-key"], undefined);
});

test("存档：保存后可原样读回", () => {
  resetBackendForTests();
  const base = defaultProgress();
  base.settings.boardId = "board_2gate";
  base.stats.played = 3;
  base.best["solo_ai_novice_board_2gate_south"] = { rounds: 18, time: 65.2 };
  assert.equal(save(base), true);
  const loaded = load();
  assert.equal(loaded.settings.boardId, "board_2gate");
  assert.equal(loaded.stats.played, 3);
  assert.equal(loaded.best["solo_ai_novice_board_2gate_south"].rounds, 18);
  resetBackendForTests();
});

test("存档：损坏 JSON 静默回退默认", () => {
  setBackendForTests(fakeBackend({ [STORAGE_KEY]: "{not json" }));
  assert.deepEqual(load(), defaultProgress());
  resetBackendForTests();
});

test("存档：单人胜负平正确累计，双人不计入胜负", () => {
  const base = defaultProgress();
  const win = recordMatch(base, { ...baseState, winner: "south" });
  assert.equal(win.progress.stats.played, 1);
  assert.equal(win.progress.stats.wins, 1);
  assert.equal(win.newBest, true);

  const lose = recordMatch(win.progress, { ...baseState, winner: "north", round: 15 });
  assert.equal(lose.progress.stats.losses, 1);
  assert.equal(lose.newBest, false);

  const draw = recordMatch(lose.progress, { ...baseState, winner: "draw", reason: "limit", round: 60 });
  assert.equal(draw.progress.stats.draws, 1);
  assert.equal(draw.newBest, false);

  const duel = recordMatch(draw.progress, { ...baseState, mode: "duel", winner: "south" });
  assert.equal(duel.progress.stats.played, 4);
  assert.equal(duel.progress.stats.wins, 1);
});

test("存档：最佳纪录只取更好成绩", () => {
  const first = recordMatch(defaultProgress(), { ...baseState, winner: "south", round: 20, time: 70 });
  const key = "solo_ai_novice_board_1gate_south";
  assert.deepEqual(first.progress.best[key], { rounds: 20, time: 70 });

  const slower = recordMatch(first.progress, { ...baseState, winner: "south", round: 20, time: 55 });
  assert.deepEqual(slower.progress.best[key], { rounds: 20, time: 55 });
  assert.equal(slower.newBest, true);

  const worse = recordMatch(slower.progress, { ...baseState, winner: "south", round: 25, time: 30 });
  assert.deepEqual(worse.progress.best[key], { rounds: 20, time: 55 });
  assert.equal(worse.newBest, false);
});

test("存档：记住设置并支持查询最佳纪录", () => {
  const base = defaultProgress();
  rememberSettings(base, { mode: "duel", difficulty: "ai_master", boardId: "board_3gate", humanSide: "north" });
  assert.equal(base.settings.mode, "duel");
  assert.equal(base.settings.boardId, "board_3gate");
  assert.equal(bestRecord(base, base.settings), null);
  base.best["duel_duel_board_3gate_north"] = { rounds: 9, time: 12 };
  assert.deepEqual(bestRecord(base, base.settings), { rounds: 9, time: 12 });
});

test("存档：localStorage 不可用时降级内存", () => {
  resetBackendForTests();
  const base = defaultProgress();
  base.stats.played = 2;
  assert.equal(save(base), true);
  assert.equal(load().stats.played, 2);
  resetBackendForTests();
});
