import test from "node:test";
import assert from "node:assert/strict";
import { createAudio } from "../js/audio.mjs";

// AudioParam is a getter-only object in browsers: direct assignment throws in ESM.
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
    detune: readonlyParam(0),
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
    createBuffer(channels, length) {
      return { getChannelData: () => new Float32Array(length) };
    }
    resume() { return Promise.resolve(); }
  }
  return { Ctx, count: () => created };
}

function installCtx(Ctx) {
  const original = globalThis.AudioContext;
  Object.defineProperty(globalThis, "AudioContext", { value: Ctx, configurable: true });
  return () => Object.defineProperty(globalThis, "AudioContext", { value: original, configurable: true });
}

test("all five voices fire against read-only AudioParams without throwing", () => {
  const { Ctx, count } = fakeContext();
  const restore = installCtx(Ctx);
  try {
    const audio = createAudio();
    audio.unlock();
    assert.equal(count(), 1);
    assert.doesNotThrow(() => audio.linkUp(0));
    assert.doesNotThrow(() => audio.linkDown(1));
    assert.doesNotThrow(() => audio.reject());
    assert.doesNotThrow(() => audio.paper());
    assert.doesNotThrow(() => audio.win(9));
    assert.equal(count(), 1, "context is lazily created once");
  } finally {
    restore();
  }
});

test("muted audio creates no nodes and reports state", () => {
  const { Ctx, count } = fakeContext();
  const restore = installCtx(Ctx);
  try {
    const audio = createAudio();
    assert.equal(audio.setMuted(true), true);
    assert.equal(audio.isMuted(), true);
    audio.linkUp(0);
    audio.linkDown(0);
    audio.win(9);
    assert.equal(count(), 0, "no AudioContext is built while muted");
    assert.equal(audio.setMuted(false), false);
    audio.linkUp(0);
    assert.equal(count(), 1);
  } finally {
    restore();
  }
});

test("missing WebAudio support degrades silently", () => {
  const restore = installCtx(undefined);
  try {
    const audio = createAudio();
    assert.doesNotThrow(() => { audio.unlock(); audio.linkUp(0); audio.win(9); });
  } finally {
    restore();
  }
});
