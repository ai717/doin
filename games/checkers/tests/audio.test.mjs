// audio.test.mjs - pentatonic hop pitches / silent degradation / mute guards
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { hopPitch, isMuted, resetAudioForTests, setMuted, sfx } from "../js/audio.mjs";

class FakeParam {
  constructor(value = 0) { this.value = value; }
  setValueAtTime(v) { this.value = v; return this; }
  exponentialRampToValueAtTime(v) { this.value = v; return this; }
}

class FakeNode {
  constructor(owner, kind) {
    this.owner = owner;
    this.kind = kind;
    this.gain = new FakeParam(1);
    this.frequency = new FakeParam(440);
    this.Q = new FakeParam(1);
    this.type = "sine";
    this.buffer = null;
    owner.nodes.push(this);
  }
  connect(target) { return target; }
  start() { this.owner.started += 1; }
  stop() {}
}

class FakeAudioContext {
  constructor() {
    this.sampleRate = 44100;
    this.currentTime = 0;
    this.state = "running";
    this.nodes = [];
    this.started = 0;
    this.destination = new FakeNode(this, "destination");
  }
  createGain() { return new FakeNode(this, "gain"); }
  createOscillator() { return new FakeNode(this, "osc"); }
  createBiquadFilter() { return new FakeNode(this, "filter"); }
  createBufferSource() { return new FakeNode(this, "bufferSource"); }
  createBuffer(_channels, length) {
    return { getChannelData: () => new Float32Array(length) };
  }
}

let context = null;

function install() {
  context = new FakeAudioContext();
  globalThis.window = { AudioContext: function AudioContextStub() { return context; } };
  resetAudioForTests();
  return context;
}

beforeEach(() => {
  delete globalThis.window;
  setMuted(false);
  resetAudioForTests();
  context = null;
});

afterEach(() => {
  delete globalThis.window;
  setMuted(false);
  resetAudioForTests();
});

describe("audio: chain-hop scale", () => {
  it("one phrase rises, then steps up an octave, and stays bounded", () => {
    const firstFive = [0, 1, 2, 3, 4].map(hopPitch);
    for (let i = 1; i < firstFive.length; i += 1) {
      assert.ok(firstFive[i] > firstFive[i - 1]);
    }
    assert.equal(hopPitch(5), firstFive[0] * 2);
    assert.equal(hopPitch(9), firstFive[4] * 2);
    assert.equal(hopPitch(10), firstFive[0] * 4);
    assert.equal(hopPitch(99), firstFive[4] * 4, "two octaves is the hard ceiling");
    assert.equal(hopPitch(-3), firstFive[0]);
    assert.equal(hopPitch(NaN), firstFive[0]);
    assert.equal(hopPitch(2.9), firstFive[2]);
  });
});

describe("audio: runtime guards", () => {
  it("every cue is a no-op when WebAudio is unavailable", () => {
    for (const name of Object.keys(sfx)) {
      assert.doesNotThrow(() => sfx[name](3), `${name} threw without an AudioContext`);
    }
  });

  it("every cue schedules sound with a working context", () => {
    const c = install();
    for (const name of Object.keys(sfx)) {
      const before = c.started;
      assert.doesNotThrow(() => sfx[name](3), `${name} threw with an AudioContext`);
      assert.ok(c.started > before, `${name} scheduled no source`);
    }
    assert.ok(c.nodes.some((n) => n.kind === "bufferSource"), "noise path was never exercised");
    assert.ok(c.nodes.some((n) => n.gain.value !== 1), "envelopes were never applied");
  });

  it("muting suppresses all scheduling and persists until unmuted", () => {
    const c = install();
    setMuted(true);
    assert.equal(isMuted(), true);
    for (const name of Object.keys(sfx)) sfx[name](2);
    assert.equal(c.started, 0);
    setMuted(false);
    assert.equal(isMuted(), false);
    sfx.hop(0);
    assert.ok(c.started > 0);
  });

  it("a throwing AudioContext constructor degrades silently", () => {
    globalThis.window = {
      get AudioContext() { throw new Error("blocked by policy"); },
    };
    resetAudioForTests();
    assert.doesNotThrow(() => sfx.land());
  });
});
