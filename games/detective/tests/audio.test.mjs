import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";

/** AudioParam 桩：只有 value 可写，节点上的同名属性是只读 getter。 */
function makeParam(initial = 0) {
  return {
    value: initial,
    _events: [],
    setValueAtTime(value, when) {
      this._events.push(["set", value, when]);
      return this;
    },
    linearRampToValueAtTime(value, when) {
      this._events.push(["linear", value, when]);
      return this;
    },
    exponentialRampToValueAtTime(value, when) {
      if (value === 0) throw new Error("exponentialRampToValueAtTime 不接受 0");
      this._events.push(["exp", value, when]);
      return this;
    },
    cancelScheduledValues() {
      return this;
    },
  };
}

function createStubAudio() {
  const made = { oscillator: 0, gain: 0, filter: 0, source: 0, buffer: 0 };
  const ctx = {
    currentTime: 1,
    sampleRate: 8000,
    state: "running",
    destination: { name: "dest" },
    resumeCalled: 0,
    resume() {
      ctx.resumeCalled += 1;
      return Promise.resolve();
    },
    suspend() {
      return Promise.resolve();
    },
    createBuffer(channels, length) {
      made.buffer += 1;
      const data = new Float32Array(length);
      return { getChannelData: () => data, length };
    },
    createGain() {
      made.gain += 1;
      const gain = makeParam(1);
      return {
        get gain() {
          return gain;
        },
        connect(target) {
          return target;
        },
      };
    },
    createOscillator() {
      made.oscillator += 1;
      const frequency = makeParam(440);
      const detune = makeParam(0);
      return {
        type: "sine",
        get frequency() {
          return frequency;
        },
        get detune() {
          return detune;
        },
        connect(target) {
          return target;
        },
        start() {},
        stop() {},
      };
    },
    createBiquadFilter() {
      made.filter += 1;
      const frequency = makeParam(350);
      const q = makeParam(1);
      return {
        type: "lowpass",
        get frequency() {
          return frequency;
        },
        get Q() {
          return q;
        },
        connect(target) {
          return target;
        },
      };
    },
    createBufferSource() {
      made.source += 1;
      return {
        buffer: null,
        loop: false,
        connect(target) {
          return target;
        },
        start() {},
        stop() {},
      };
    },
  };
  return { ctx, made };
}

const { ctx, made } = createStubAudio();
globalThis.window = { AudioContext: function StubAudioContext() { return ctx; } };

const audio = await import("../js/audio.mjs");

beforeEach(() => {
  audio.setEnabled(true);
  made.oscillator = 0;
  made.gain = 0;
  made.filter = 0;
  made.source = 0;
});

test("接上 AudioContext 后七种音效都真的建了节点且不抛错", () => {
  audio.setEnabled(true);
  const sounds = [
    ["stamp", () => audio.stamp()],
    ["paper", () => audio.paper()],
    ["clip", () => audio.clip()],
    ["jolt", () => audio.jolt()],
    ["eureka", () => audio.eureka()],
    ["fanfare", () => audio.fanfare()],
    ["click", () => audio.click()],
    ["stretch", () => audio.stretch(0.8)],
  ];
  for (const [name, run] of sounds) {
    assert.doesNotThrow(run, `${name} 抛错了`);
  }
  assert.ok(made.gain > 0, "应创建增益节点");
  assert.ok(made.oscillator > 0, "应创建振荡器");
  assert.ok(made.filter > 0, "应创建滤波器");
  assert.ok(made.source > 0, "应创建噪声源");
  assert.ok(made.buffer > 0, "应生成噪声缓冲");
});

test("只读 AudioParam 陷阱：直接给节点属性赋值必须抛错", () => {
  const filter = ctx.createBiquadFilter();
  assert.throws(() => {
    filter.Q = 6;
  }, TypeError);
  assert.throws(() => {
    ctx.createOscillator().frequency = 220;
  }, TypeError);
  assert.doesNotThrow(() => {
    filter.Q.value = 6;
  });
});

test("静音时不建任何节点", () => {
  audio.setEnabled(false);
  assert.equal(audio.isEnabled(), false);
  audio.stamp();
  audio.eureka();
  audio.fanfare();
  assert.equal(made.oscillator, 0);
  assert.equal(made.gain, 0);
});

test("重复触发换案纸声会被节流", () => {
  audio.setEnabled(true);
  audio.stretch(1);
  const first = made.source;
  audio.stretch(1);
  audio.stretch(1);
  assert.equal(made.source, first, "0.18 秒内的重复纸声应被吞掉");
});

test("没有 AudioContext 时静默降级，绝不抛错", () => {
  const saved = globalThis.window;
  globalThis.window = {};
  try {
    audio.setEnabled(true);
    for (const run of [audio.stamp, audio.paper, audio.clip, audio.jolt, audio.eureka, audio.fanfare, audio.click]) {
      assert.doesNotThrow(() => run());
    }
    assert.doesNotThrow(() => audio.unlock());
  } finally {
    globalThis.window = saved;
  }
});

test("调制指数与频率都走 .value，不会产生指数斜坡到 0 的爆音", () => {
  audio.setEnabled(true);
  assert.doesNotThrow(() => audio.stamp());
  assert.doesNotThrow(() => audio.fanfare());
  assert.doesNotThrow(() => audio.eureka());
});
