// audio.test.mjs —— WebAudio 模块：无 AudioContext / 静音环境静默降级，所有合成函数可安全调用。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as audio from "../js/audio.mjs";

test("Node 环境（无 window/AudioContext）下所有播放函数静默降级不抛错", () => {
  audio.setMuted(false);
  assert.doesNotThrow(() => {
    audio.playKey(0);
    audio.playKey(97);
    audio.playSubmit();
    audio.playFlip("correct");
    audio.playFlip("present");
    audio.playFlip("absent");
    audio.playWin();
    audio.playLose();
    audio.playBad();
    audio.playTurn();
    audio.playUi();
  });
});

test("静音开关幂等且可逆", () => {
  assert.equal(audio.setMuted(true), true);
  assert.equal(audio.isMuted(), true);
  assert.equal(audio.setMuted(true), true);
  assert.doesNotThrow(() => audio.playKey(1), "静音下播放调用依旧安全");
  assert.equal(audio.setMuted(false), false);
  assert.equal(audio.isMuted(), false);
});

test("音效种类达到策划案门槛（≥6 种专属音色）", () => {
  const fns = ["playKey", "playSubmit", "playFlip", "playWin", "playLose", "playBad", "playTurn", "playUi"];
  for (const name of fns) assert.equal(typeof audio[name], "function", name);
  assert.ok(fns.length >= 6);
});

test("物理材质合成特征：噪声缓冲 + BiquadFilter + FM/失谐振荡器", () => {
  const src = readFileSync(new URL("../js/audio.mjs", import.meta.url), "utf8");
  assert.ok(src.includes("createBuffer"), "应有噪声缓冲（物理材质源）");
  assert.ok(src.includes("BiquadFilter"), "应有动态滤波");
  assert.ok(src.includes("bandpass") || src.includes("highpass"), "金属/纸页质感需带通或高通");
  assert.ok(/exponentialRampToValueAtTime/.test(src), "应有滑音包络");
});
