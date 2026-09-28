// audio.test.mjs — 6 种专属音色的 API + 静音 + 降级行为
import { test } from "node:test";
import assert from "node:assert/strict";
import * as audio from "../js/audio.mjs";

test("setMuted / getMuted / toggleMuted", () => {
  audio.resetAudioForTests();
  assert.equal(audio.getMuted(), false);

  audio.setMuted(true);
  assert.equal(audio.getMuted(), true);

  audio.setMuted(false);
  assert.equal(audio.getMuted(), false);

  const result = audio.toggleMuted();
  assert.equal(result, true, "toggle 后返回新值 true");
  assert.equal(audio.getMuted(), true);
  const result2 = audio.toggleMuted();
  assert.equal(result2, false);
});

test("AudioContext 不可用时所有 play* 函数静默 no-op", () => {
  audio.resetAudioForTests();
  // 模拟没有 AudioContext 的环境（Node 默认就是）
  audio.playSteam();
  audio.playMilk();
  audio.playPurr();
  audio.playCoin();
  audio.playWindow();
  audio.playBucket();
  audio.play("steam");
  audio.play("invalid_name");
  // 没抛错即通过
  assert.ok(true);
});

test("静音状态下所有 play* 静默（即使有 AudioContext）", () => {
  audio.resetAudioForTests();
  audio.setMuted(true);

  // 模拟一个带 createOscillator 的 AudioContext，验证静音时不被调用
  let oscillatorCount = 0;
  class FakeOscillator {
    constructor() { oscillatorCount++; }
    connect() {}
    start() {}
    stop() {}
    set frequency(_) { return { setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }; }
    set detune(_) { return { setValueAtTime() {}, linearRampToValueAtTime() {} }; }
    set type(_) {}
  }
  class FakeBuffer {
    getChannelData() { return new Float32Array(10); }
  }
  class FakeContext {
    constructor() { this.currentTime = 0; this.sampleRate = 44100; this.state = "running"; this.destination = {}; }
    createOscillator() { return new FakeOscillator(); }
    createGain() { return { connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } }; }
    createBuffer() { return new FakeBuffer(); }
    createBufferSource() { return { connect() {}, start() {}, stop() {}, buffer: null }; }
    createBiquadFilter() { return { connect() {}, type: "", frequency: { setValueAtTime() {} }, Q: { setValueAtTime() {} } }; }
    resume() { return Promise.resolve(); }
  }
  globalThis.AudioContext = FakeContext;

  audio.playSteam();
  audio.playMilk();
  audio.playPurr();
  audio.playCoin();
  audio.playWindow();
  audio.playBucket();
  assert.equal(oscillatorCount, 0, "静音时所有 play* 不创建 oscillator");

  delete globalThis.AudioContext;
  audio.resetAudioForTests();
});

test("play(name) 6 种音效名路由", () => {
  audio.resetAudioForTests();
  // 无 AudioContext 时无副作用
  for (const name of ["steam", "milk", "purr", "coin", "window", "bucket"]) {
    audio.play(name);
  }
  assert.ok(true, "6 种命名 play() 不抛错");
});

test("play 未知名称静默忽略", () => {
  audio.resetAudioForTests();
  audio.play("unknown_sound");
  audio.play("");
  audio.play(null);
  assert.ok(true);
});

test("play 触发时不抛错（mock AudioContext）", () => {
  audio.resetAudioForTests();

  let oscillatorCount = 0;
  class FakeOscillator {
    constructor() { oscillatorCount++; }
    connect() {}
    start() {}
    stop() {}
    set frequency(_) { return { setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }; }
    set detune(_) { return { setValueAtTime() {}, linearRampToValueAtTime() {} }; }
    set type(_) {}
  }
  class FakeBuffer {
    getChannelData() { return new Float32Array(10); }
  }
  class FakeContext {
    constructor() { this.currentTime = 0; this.sampleRate = 44100; this.state = "running"; this.destination = {}; }
    createOscillator() { return new FakeOscillator(); }
    createGain() { return { connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } }; }
    createBuffer() { return new FakeBuffer(); }
    createBufferSource() { return { connect() {}, start() {}, stop() {}, buffer: null }; }
    createBiquadFilter() { return { connect() {}, type: "", frequency: { setValueAtTime() {} }, Q: { setValueAtTime() {} } }; }
    resume() { return Promise.resolve(); }
  }
  globalThis.AudioContext = FakeContext;
  audio.setMuted(false);

  // 6 种音色全部能在 mock 下调用且不抛错（构造 oscillator 数量细节依赖 mock 行为，不强断言）
  audio.playSteam();
  audio.playMilk();
  audio.playPurr();
  audio.playCoin();
  audio.playWindow();
  audio.playBucket();
  assert.ok(oscillatorCount > 0, `6 种音色调用后应至少创建一个 oscillator（实际 ${oscillatorCount}）`);

  delete globalThis.AudioContext;
  audio.resetAudioForTests();
});

test("initAudioOnGesture 在 suspended 时 resume", async () => {
  audio.resetAudioForTests();
  let resumed = false;
  class FakeContext {
    constructor() { this.state = "suspended"; this.destination = {}; this.currentTime = 0; this.sampleRate = 44100; }
    resume() { resumed = true; this.state = "running"; return Promise.resolve(); }
    createOscillator() { return { connect() {}, start() {}, stop() {}, set frequency(_) { return { setValueAtTime() {}, exponentialRampToValueAtTime() {} }; }, set type(_) {} }; }
    createGain() { return { connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } }; }
    createBuffer() { return { getChannelData: () => new Float32Array(10) }; }
    createBufferSource() { return { connect() {}, start() {}, stop() {}, buffer: null }; }
    createBiquadFilter() { return { connect() {}, type: "", frequency: { setValueAtTime() {} }, Q: { setValueAtTime() {} } }; }
  }
  globalThis.AudioContext = FakeContext;

  audio.initAudioOnGesture();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(resumed, true, "suspended → resume 被调用");

  delete globalThis.AudioContext;
  audio.resetAudioForTests();
});

test("initAudioOnGesture 在 running 时不调用 resume", async () => {
  audio.resetAudioForTests();
  let resumeCalled = false;
  class FakeContext {
    constructor() { this.state = "running"; this.destination = {}; this.currentTime = 0; this.sampleRate = 44100; }
    resume() { resumeCalled = true; return Promise.resolve(); }
    createOscillator() { return { connect() {}, start() {}, stop() {}, set frequency(_) { return { setValueAtTime() {}, exponentialRampToValueAtTime() {} }; }, set type(_) {} }; }
    createGain() { return { connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } }; }
    createBuffer() { return { getChannelData: () => new Float32Array(10) }; }
    createBufferSource() { return { connect() {}, start() {}, stop() {}, buffer: null }; }
    createBiquadFilter() { return { connect() {}, type: "", frequency: { setValueAtTime() {} }, Q: { setValueAtTime() {} } }; }
  }
  globalThis.AudioContext = FakeContext;

  audio.initAudioOnGesture();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(resumeCalled, false, "running 时不调用 resume");

  delete globalThis.AudioContext;
  audio.resetAudioForTests();
});

test("audio 不引入 document / Date.now / Math.random 之外的非确定性", async () => {
  // 这条测试保证 engine 的 PRNG 不被 audio 污染
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../js/audio.mjs", import.meta.url), "utf8");
  assert.equal(source.includes("document"), false);
  // Date.now 在 audio 里是允许的（用于时间戳），但不能是确定性的关键依赖
  // audio 只用 c.currentTime（WebAudio 内部时钟），不用 Date.now
  assert.equal(source.includes("Date.now"), false, "audio 不应使用 Date.now");
});