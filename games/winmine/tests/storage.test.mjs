import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultState,
  normalize,
  qualifies,
  recordResult,
  bestRecord,
  MAX_RECORDS,
  load,
  save,
  resetBackendForTests,
} from "../js/storage.mjs";

test("normalize 坏值回退默认", () => {
  assert.deepEqual(normalize(null), defaultState());
  assert.deepEqual(normalize("garbage"), defaultState());
  assert.equal(normalize({ prefs: { difficulty: "nope" } }).prefs.difficulty, "beginner");
});

test("normalize 归一化非法成绩（负时间丢弃、超长名字截断）", () => {
  const s = normalize({
    prefs: { difficulty: "expert", muted: true },
    records: {
      beginner: [
        { name: "abc", timeMs: 5000, date: "2026-01-01" },
        { name: "x".repeat(50), timeMs: -3, date: "" }, // 负时间 → 丢弃
        {},
        "junk",
      ],
    },
  });
  assert.equal(s.prefs.difficulty, "expert");
  assert.equal(s.prefs.muted, true);
  assert.equal(s.records.beginner.length, 1);
  assert.equal(s.records.beginner[0].timeMs, 5000);
});

test("qualifies：榜未满进，榜满需快过榜尾", () => {
  const few = [{ name: "a", timeMs: 1000, date: "" }];
  assert.equal(qualifies(few, 5000), true);
  const full = [];
  for (let i = 0; i < MAX_RECORDS; i += 1) full.push({ name: String(i), timeMs: 10000 + i * 10, date: "" });
  assert.equal(qualifies(full, 10005), true); // 快过榜尾 10090
  assert.equal(qualifies(full, 99999), false);
});

test("recordResult 插入后按用时升序、截断到前 N 名", () => {
  let state = defaultState();
  let res = recordResult(state, { won: true, difficulty: "beginner", timeMs: 9000, name: "slow" });
  assert.equal(res.isNewRecord, true);
  res = recordResult(res.state, { won: true, difficulty: "beginner", timeMs: 3000, name: "fast" });
  assert.equal(res.isNewRecord, true);
  const list = res.state.records.beginner;
  assert.equal(list.length, 2);
  assert.equal(list[0].timeMs, 3000);
  assert.equal(list[0].name, "fast");
  assert.deepEqual(bestRecord(res.state, "beginner"), list[0]);
});

test("recordResult：未胜局不进榜", () => {
  const res = recordResult(defaultState(), { won: false, difficulty: "beginner", timeMs: 1000 });
  assert.equal(res.isNewRecord, false);
  assert.deepEqual(res.state.records.beginner, []);
});

test("save/load 内存降级 roundtrip", () => {
  resetBackendForTests();
  const s = normalize({
    prefs: { difficulty: "intermediate", muted: false },
    records: { beginner: [{ name: "p", timeMs: 2500, date: "2026-09-23" }] },
  });
  save(s);
  const loaded = normalize(load());
  assert.equal(loaded.prefs.difficulty, "intermediate");
  assert.equal(loaded.records.beginner[0].timeMs, 2500);
  resetBackendForTests();
});