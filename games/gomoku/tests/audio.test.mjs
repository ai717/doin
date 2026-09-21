import test from "node:test";
import assert from "node:assert/strict";

import { createAudio } from "../js/audio.mjs";

test("createAudio: 不抛错且返回对象", () => {
  const a = createAudio({ muted: true });
  assert.ok(typeof a === "object");
  assert.ok(typeof a.unlock === "function");
  assert.ok(typeof a.setMuted === "function");
  assert.ok(typeof a.placeBlack === "function");
});

test("createAudio: muted=true 时所有方法不抛错", () => {
  const a = createAudio({ muted: true });
  assert.doesNotThrow(() => a.unlock());
  assert.doesNotThrow(() => a.placeBlack());
  assert.doesNotThrow(() => a.placeWhite());
  assert.doesNotThrow(() => a.threatThree());
  assert.doesNotThrow(() => a.threatFour());
  assert.doesNotThrow(() => a.threatOpenFour());
  assert.doesNotThrow(() => a.winBlack());
  assert.doesNotThrow(() => a.winWhite());
  assert.doesNotThrow(() => a.forbidden());
  assert.doesNotThrow(() => a.puzzleSolved());
  assert.doesNotThrow(() => a.wrongMove());
  assert.doesNotThrow(() => a.starLight());
  assert.doesNotThrow(() => a.click());
});

test("createAudio: muted=false 且无 AudioContext 时不抛错（静默降级）", () => {
  // node 环境无 AudioContext，应静默降级
  const a = createAudio({ muted: false });
  assert.doesNotThrow(() => a.unlock());
  assert.doesNotThrow(() => a.placeBlack());
  assert.doesNotThrow(() => a.puzzleSolved());
  assert.doesNotThrow(() => a.winBlack());
});

test("createAudio: 接口契约（必要方法名）", () => {
  const a = createAudio();
  const expected = [
    "unlock", "setMuted",
    "placeBlack", "placeWhite",
    "threatThree", "threatFour", "threatOpenFour",
    "winBlack", "winWhite", "forbidden",
    "aiThinking", "puzzleSolved", "wrongMove", "starLight", "click",
  ];
  for (const name of expected) {
    assert.ok(typeof a[name] === "function", `缺方法 ${name}`);
  }
});
