import test from "node:test";
import assert from "node:assert/strict";
import { createAudio } from "../js/audio.mjs";

// AudioParam is getter-only in browsers: direct assignment throws in ESM.
function readonlyParam(initial = 0) {
  return {
    get value() { return initial; },
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime() {},
  };
}

function fakeContext() {
  let created = 0;
  const node = () => ({
    gain: readonlyParam(1),
    frequency: readonlyParam(440),
    Q: readonlyParam(1),
    type: "sine",
    connect() {},
    start() {},
    stop() {},
    loop: false,
    buffer: null,
  });
  class Ctx {
    constructor() {
      created += 1;
      this.state = "running";
      this.currentTime = 0;
      this.sampleRate = 44100;
      this.destination = node();
    }
    createGain() { return node(); }
    createOscillator() { return node(); }
    createBiquadFilter() { return node(); }
    createBufferSource() { return node(); }
    createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
    suspend() { this.state = "suspended"; return Promise.resolve(); }
    resume() { this.state = "running"; return Promise.resolve(); }
  }
  return { Ctx, count: () => created };
}

function installCtx(Ctx) {
  const original = globalThis.AudioContext;
  Object.defineProperty(globalThis, "AudioContext", { value: Ctx, configurable: true });
  return () => Object.defineProperty(globalThis, "AudioContext", { value: original, configurable: true });
}

test("all six stadium voices fire against read-only AudioParams", () => {
  const { Ctx, count } = fakeContext();
  const restore = installCtx(Ctx);
  try {
    const audio = createAudio();
    audio.unlock();
    assert.equal(count(), 1);
    assert.doesNotThrow(() => audio.steps());
    assert.doesNotThrow(() => audio.kick("tap"));
    assert.doesNotThrow(() => audio.kick("drive"));
    assert.doesNotThrow(() => audio.kick("blast"));
    assert.doesNotThrow(() => audio.net());
    assert.doesNotThrow(() => audio.save());
    assert.doesNotThrow(() => audio.wide());
    assert.doesNotThrow(() => audio.crowd(true));
    assert.doesNotThrow(() => audio.crowd(false));
    assert.equal(count(), 1, "the context is lazily created once");
  } finally {
    restore();
  }
});

test("muting avoids context creation and reports state", () => {
  const { Ctx, count } = fakeContext();
  const restore = installCtx(Ctx);
  try {
    const audio = createAudio();
    assert.equal(audio.setMuted(true), true);
    assert.equal(audio.muted, true);
    audio.steps();
    audio.kick("blast");
    audio.net();
    audio.crowd(true);
    assert.equal(count(), 0, "silent while muted");
    assert.equal(audio.setMuted(false), false);
    audio.steps();
    assert.equal(count(), 1);
  } finally {
    restore();
  }
});

test("suspend and resume are paired and tolerate missing support", () => {
  const { Ctx } = fakeContext();
  const restore = installCtx(Ctx);
  try {
    const audio = createAudio();
    assert.doesNotThrow(() => { audio.suspend(); audio.resume(); audio.unlock(); audio.suspend(); audio.resume(); });
    assert.equal(audio.muted, false);
  } finally {
    restore();
  }
});

test("missing WebAudio degrades silently", () => {
  const restore = installCtx(undefined);
  try {
    const audio = createAudio();
    assert.doesNotThrow(() => {
      audio.unlock();
      audio.steps();
      audio.kick("drive");
      audio.net();
      audio.save();
      audio.wide();
      audio.crowd(true);
      audio.suspend();
      audio.resume();
    });
  } finally {
    restore();
  }
});
