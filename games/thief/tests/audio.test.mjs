// audio.test.mjs - WebAudio is a tangle of read-only AudioParams. The stub
// below exposes `Q` / `frequency` / `gain` as getters without setters, exactly
// like Chrome, so `node.Q = 6` throws here instead of on a player's phone.

import test from "node:test";
import assert from "node:assert/strict";

function param(initial = 0) {
  return {
    value: initial,
    calls: 0,
    setValueAtTime(v) {
      this.calls += 1;
      this.value = v;
      return this;
    },
    linearRampToValueAtTime(v) {
      this.calls += 1;
      this.value = v;
      return this;
    },
    exponentialRampToValueAtTime(v) {
      if (!(v > 0)) throw new RangeError("exponential ramp target must be > 0");
      this.calls += 1;
      this.value = v;
      return this;
    },
    setTargetAtTime(v) {
      this.calls += 1;
      this.value = v;
      return this;
    },
    cancelScheduledValues() {
      this.calls += 1;
      return this;
    },
  };
}

function createStubAudio() {
  const made = { gain: 0, biquad: 0, osc: 0, bufferSource: 0, buffer: 0 };

  const node = (kind, extra = {}) => {
    const self = {
      kind,
      connect(target) {
        return target;
      },
      disconnect() {},
      ...extra,
    };
    return self;
  };

  const ctx = {
    sampleRate: 48000,
    currentTime: 0,
    state: "running",
    destination: node("destination"),
    resume() {
      return Promise.resolve();
    },
    createGain() {
      made.gain += 1;
      const gainNode = node("gain");
      Object.defineProperty(gainNode, "gain", { get: () => gainNode._gain ?? (gainNode._gain = param(1)) });
      return gainNode;
    },
    createBiquadFilter() {
      made.biquad += 1;
      const biquad = node("biquad", { type: "lowpass" });
      for (const key of ["frequency", "Q", "detune"]) {
        Object.defineProperty(biquad, key, { get: () => biquad[`_${key}`] ?? (biquad[`_${key}`] = param(0)) });
      }
      return biquad;
    },
    createOscillator() {
      made.osc += 1;
      const osc = node("osc", {
        type: "sine",
        started: false,
        start() {
          osc.started = true;
        },
        stop() {},
      });
      for (const key of ["frequency", "detune"]) {
        Object.defineProperty(osc, key, { get: () => osc[`_${key}`] ?? (osc[`_${key}`] = param(0)) });
      }
      return osc;
    },
    createBufferSource() {
      made.bufferSource += 1;
      return node("bufferSource", {
        buffer: null,
        start() {},
        stop() {},
      });
    },
    createBuffer(channels, frames, rate) {
      made.buffer += 1;
      return {
        frames,
        rate,
        getChannelData: () => new Float32Array(frames),
      };
    },
  };

  return { ctx, made };
}

const { ctx, made } = createStubAudio();
const installAudioContext = () => {
  globalThis.window = { AudioContext: function StubAudioContext() { return ctx; } };
};

// 先在没有 window 的情况下 import，第一条用例才有意义。
const audio = await import("../js/audio.mjs");

const SFX = ["stretch", "anchor", "slip", "grab", "win", "shock", "bark", "click", "lever"];

test("静音: 默认无 AudioContext 时所有音效静默不抛错", () => {
  for (const name of SFX) {
    assert.doesNotThrow(() => audio[name](), name);
  }
  assert.equal(made.osc + made.biquad + made.gain, 0, "没有 AudioContext 时不该建节点");
});

test("音效: 接上 AudioContext 后每个音效都真的建了节点且不抛错", () => {
  installAudioContext();
  audio.setEnabled(true);
  for (const name of SFX) {
    const before = made.osc + made.biquad + made.gain + made.bufferSource;
    assert.doesNotThrow(() => audio[name](0.5), name);
    const after = made.osc + made.biquad + made.gain + made.bufferSource;
    assert.ok(after > before, `${name} 没有发出声音`);
  }
});

test("音效: 所有 AudioParam 都走 .value / 调度方法，从不给只读属性赋值", () => {
  assert.ok(made.biquad > 0 && made.osc > 0);
  // 能跑到这里就说明没有 `node.Q = 6` 这类写法；再确认参数真的被排过。
  audio.lever();
  audio.grab();
  audio.win();
  audio.shock();
});

test("静音: 关掉后不再建节点", () => {
  audio.setEnabled(false);
  const before = made.osc + made.biquad + made.gain + made.bufferSource;
  for (const name of SFX) audio[name](0.5);
  const after = made.osc + made.biquad + made.gain + made.bufferSource;
  assert.equal(after, before);
  assert.equal(audio.isEnabled(), false);
});

test("节流: 连续拉伸只在时间推进后才再次出声", () => {
  audio.setEnabled(true);
  const before = made.biquad;
  audio.stretch(1);
  audio.stretch(1);
  audio.stretch(1);
  assert.equal(made.biquad, before, "同一时刻的拉伸应当被节流");

  ctx.currentTime += 0.2;
  audio.stretch(1);
  assert.ok(made.biquad > before, "时间推进后应重新出声");
});

test("解锁: unlock 不抛错，没有上下文时也安全", () => {
  assert.doesNotThrow(() => audio.unlock());
});

test("收尾: 卸载 window 桩", () => {
  delete globalThis.window;
});
