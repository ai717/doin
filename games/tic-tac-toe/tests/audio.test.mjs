import test from "node:test";
import assert from "node:assert/strict";
import { createAudio } from "../js/audio.mjs";

// 一个最小可用的 AudioContext 替身，用来断言"确实发出了声音"而不必真的发声
function fakeContext() {
  const calls = [];
  const node = () => ({
    connect(target) {
      return target;
    },
  });
  return {
    calls,
    state: "suspended",
    currentTime: 0,
    resumed: 0,
    resume() {
      this.resumed += 1;
      this.state = "running";
    },
    destination: {},
    createOscillator() {
      const osc = {
        type: "sine",
        frequency: { setValueAtTime: (v) => calls.push(["freq", v]), exponentialRampToValueAtTime: () => {} },
        connect: node().connect,
        start: (t) => calls.push(["start", t]),
        stop: () => {},
      };
      return osc;
    },
    createGain() {
      return {
        gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: (v) => calls.push(["gain", v]) },
        connect: node().connect,
      };
    },
  };
}

test("环境没有 AudioContext 时整体静默降级，不抛异常", () => {
  const audio = createAudio({ muted: false });
  assert.doesNotThrow(() => {
    audio.unlock();
    audio.place(1);
    audio.place(2);
    audio.win();
    audio.lose();
    audio.draw();
    audio.undo();
    audio.click();
  });
  assert.equal(audio.isMuted(), false);
});

test("静音开关生效，且静音时不创建任何发声节点", () => {
  const ctx = fakeContext();
  globalThis.AudioContext = function () {
    return ctx;
  };
  const audio = createAudio({ muted: true });
  audio.place(1);
  audio.win();
  assert.equal(ctx.calls.length, 0, "muted audio must not schedule oscillators");

  audio.setMuted(false);
  audio.place(1);
  assert.ok(ctx.calls.length > 0);
  audio.setMuted(true);
  assert.equal(audio.isMuted(), true);
  delete globalThis.AudioContext;
});

test("落子音会解锁被挂起的音频上下文并排程一次发声", () => {
  const ctx = fakeContext();
  globalThis.AudioContext = function () {
    return ctx;
  };
  const audio = createAudio();
  audio.place(1);
  assert.equal(ctx.resumed, 1, "suspended context must be resumed on first sound");
  assert.ok(ctx.calls.some(([kind]) => kind === "start"));
  delete globalThis.AudioContext;
});

test("X 与 O 使用不同音高，四个结局音效都能触发", () => {
  const ctx = fakeContext();
  globalThis.AudioContext = function () {
    return ctx;
  };
  const audio = createAudio();

  audio.place(1);
  const xTone = ctx.calls.find(([kind]) => kind === "freq")[1];
  ctx.calls.length = 0;
  audio.place(2);
  const oTone = ctx.calls.find(([kind]) => kind === "freq")[1];
  assert.notEqual(xTone, oTone);

  for (const name of ["win", "lose", "draw", "undo", "click"]) {
    ctx.calls.length = 0;
    audio[name]();
    assert.ok(ctx.calls.length > 0, name + " produced no sound");
  }
  delete globalThis.AudioContext;
});

test("音频上下文构造失败时永久降级，不反复重试", () => {
  globalThis.AudioContext = function () {
    throw new Error("blocked by autoplay policy");
  };
  const audio = createAudio();
  assert.doesNotThrow(() => {
    audio.win();
    audio.win();
  });
  delete globalThis.AudioContext;
});
