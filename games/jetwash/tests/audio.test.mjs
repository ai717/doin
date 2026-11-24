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
  let started = 0;
  const node = () => ({
    gain: readonlyParam(1),
    frequency: readonlyParam(440),
    detune: readonlyParam(0),
    Q: readonlyParam(1),
    type: "sine",
    connect() {},
    start() { started += 1; },
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
  return { Ctx, count: () => created, started: () => started };
}

function installCtx(Ctx) {
  const original = globalThis.AudioContext;
  Object.defineProperty(globalThis, "AudioContext", { value: Ctx, configurable: true });
  return () => Object.defineProperty(globalThis, "AudioContext", { value: original, configurable: true });
}

test("all six voices fire against read-only AudioParams without throwing", () => {
  const { Ctx, count, started } = fakeContext();
  const restore = installCtx(Ctx);
  try {
    const audio = createAudio();
    assert.doesNotThrow(() => audio.jet(true, 0.6));
    assert.equal(count(), 1, "context lazily created once");
    assert.ok(started() > 0, "sustained water bed starts");
    assert.doesNotThrow(() => audio.jet(false));
    assert.doesNotThrow(() => audio.foam());
    assert.doesNotThrow(() => audio.brush());
    assert.doesNotThrow(() => audio.squeegee());
    assert.doesNotThrow(() => audio.droplet());
    assert.doesNotThrow(() => audio.finish());
    assert.doesNotThrow(() => audio.suspend());
    assert.equal(count(), 1, "no extra contexts for one-shots");
    assert.equal(audio.ready, true);
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
    assert.equal(audio.muted, true);
    audio.jet(true, 0.5);
    audio.foam();
    audio.finish();
    assert.equal(count(), 0, "no AudioContext built while muted");
    assert.equal(audio.setMuted(false), false);
    audio.jet(true, 0.5);
    assert.equal(count(), 1);
  } finally {
    restore();
  }
});

test("missing WebAudio support degrades silently", () => {
  const restore = installCtx(undefined);
  try {
    const audio = createAudio();
    assert.doesNotThrow(() => {
      audio.jet(true, 0.5); audio.foam(); audio.brush();
      audio.squeegee(); audio.droplet(); audio.finish(); audio.suspend();
    });
    assert.equal(audio.ready, false);
  } finally {
    restore();
  }
});
