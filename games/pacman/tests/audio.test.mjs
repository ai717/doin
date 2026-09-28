// audio.test.mjs —— 音色层验收：静音零发声、无 AudioContext 静默降级、音高随档位真的在走。
//
// 坑（照抄前务必看）：
//   1) globalThis.AudioContext 是全局单例，每条用例都要换回原值，否则前一个假 context 会串到后一条。
//   2) 断言"确实排了发声节点"而不是"没抛异常"——后者在静音 bug 下也是绿的，属于假绿。
//   3) 每个音效方法都必须存在且可调用：main.mjs 按引擎事件名直接点用，缺一个就是运行时崩。

import test from "node:test";
import assert from "node:assert/strict";

import { createAudio } from "../js/audio.mjs";

/** 记录所有排程的最小 AudioContext 替身 */
function fakeContext() {
  const calls = [];
  const param = (tag) => ({
    setValueAtTime: (v) => calls.push([tag, v]),
    exponentialRampToValueAtTime: (v) => calls.push([`${tag}->`, v]),
  });
  const node = () => ({ connect: (t) => t });
  return {
    calls,
    state: "suspended",
    currentTime: 0,
    sampleRate: 48000,
    resumed: 0,
    resume() {
      this.resumed += 1;
      this.state = "running";
    },
    destination: {},
    createOscillator() {
      return {
        type: "sine",
        frequency: param("freq"),
        detune: param("detune"),
        connect: node().connect,
        start: (t) => calls.push(["start", t]),
        stop: () => {},
      };
    },
    createGain() {
      return { gain: param("gain"), connect: node().connect };
    },
    createBiquadFilter() {
      return { type: "", frequency: param("cutoff"), Q: { value: 0 }, connect: node().connect };
    },
    createBuffer(ch, frames) {
      return { getChannelData: () => new Float32Array(frames), length: frames };
    },
    createBufferSource() {
      return { buffer: null, connect: node().connect, start: () => calls.push(["noise", 1]), stop: () => {} };
    },
  };
}

function withContext(body) {
  const prev = Object.getOwnPropertyDescriptor(globalThis, "AudioContext");
  const prevWebkit = Object.getOwnPropertyDescriptor(globalThis, "webkitAudioContext");
  let ctx = null;
  Object.defineProperty(globalThis, "AudioContext", {
    value: function () {
      ctx = fakeContext();
      return ctx;
    },
    configurable: true,
    writable: true,
  });
  try {
    return body(() => ctx);
  } finally {
    if (prev) Object.defineProperty(globalThis, "AudioContext", prev);
    else delete globalThis.AudioContext;
    if (prevWebkit) Object.defineProperty(globalThis, "webkitAudioContext", prevWebkit);
    else delete globalThis.webkitAudioContext;
  }
}

/** main.mjs 会按引擎事件逐个点用的全部音效入口 */
const SFX = [
  "pellet",
  "pelletSyrup",
  "power",
  "eatGhost",
  "death",
  "lost",
  "beatSwitch",
  "heartbeat",
  "chainUp",
  "chainBreak",
  "release",
  "recharge",
  "suppress",
  "frightEnd",
  "gate",
  "fruit",
  "extraLife",
  "cleared",
  "setpieceClear",
  "click",
  "deny",
  "curtain",
];

test("音效入口齐全，全部可调用且都是函数", () => {
  const audio = createAudio({ muted: true });
  for (const name of SFX) {
    assert.equal(typeof audio[name], "function", `缺音效 ${name}`);
    assert.doesNotThrow(() => audio[name](), `${name} 调用抛异常`);
  }
  assert.equal(typeof audio.unlock, "function");
  assert.equal(typeof audio.setMuted, "function");
  assert.equal(typeof audio.isMuted, "function");
  assert.equal(typeof audio.bindUnlock, "function");
});

test("环境里根本没有 AudioContext 时整体静默降级，绝不抛异常", () => {
  const audio = createAudio({ muted: false });
  assert.doesNotThrow(() => {
    audio.unlock();
    for (const name of SFX) audio[name](1);
  });
  assert.equal(audio.isMuted(), false, "不支持音频不该被当成静音");
  assert.equal(audio.isReady(), false);
});

test("静音时不排任何发声节点，取消静音后立刻恢复", () => {
  withContext((get) => {
    const audio = createAudio({ muted: true });
    audio.pellet(0);
    audio.power();
    audio.eatGhost(2);
    audio.cleared();
    assert.equal(get(), null, "静音时连 AudioContext 都不该创建");

    audio.setMuted(false);
    audio.pellet(0);
    const ctx = get();
    assert.ok(ctx, "取消静音后应创建 context");
    assert.ok(ctx.calls.length > 0, "取消静音后必须真的排程发声节点");

    const before = ctx.calls.length;
    audio.setMuted(true);
    audio.pellet(0);
    assert.equal(ctx.calls.length, before, "重新静音后不再排新节点");
  });
});

test("每个音效都真的发声（不是空实现）", () => {
  withContext((get) => {
    const audio = createAudio({ muted: false });
    // 先触发一次拿到 context：context 是懒创建的，想在循环里比对必须先让它存在
    audio.click();
    const ctx = get();
    assert.ok(ctx, "首次发声应创建 context");
    for (const name of SFX) {
      const before = ctx.calls.length;
      audio[name](1);
      assert.ok(ctx.calls.length > before, `${name} 没有排任何发声节点，是空实现`);
    }
  });
});

test("豆链升档与连吞升档：音高必须真的往上走", () => {
  withContext((get) => {
    const audio = createAudio({ muted: false });
    audio.click();
    const ctx = get();
    const topFreq = () => {
      const freqs = ctx.calls.filter((c) => c[0] === "freq").map((c) => c[1]);
      return freqs.length ? Math.max(...freqs) : 0;
    };
    const pelletAt = (level) => {
      ctx.calls.length = 0;
      audio.pellet(level);
      return topFreq();
    };
    const low = pelletAt(0);
    const high = pelletAt(3);
    assert.ok(high > low, `豆链高档(${high}) 应比低档(${low}) 更高`);

    const eat = (combo) => {
      ctx.calls.length = 0;
      audio.eatGhost(combo);
      return topFreq();
    };
    assert.ok(eat(3) > eat(0), "连吞第四只应比第一只更高");
  });
});

test("节拍切换：猎杀比巡游更低沉，闭着眼也能分辨", () => {
  withContext((get) => {
    const audio = createAudio({ muted: false });
    audio.click();
    const ctx = get();
    ctx.calls.length = 0;
    audio.beatSwitch("scatter");
    const scatter = Math.min(...ctx.calls.filter((c) => c[0] === "freq").map((c) => c[1]));
    ctx.calls.length = 0;
    audio.beatSwitch("chase");
    const chase = Math.min(...ctx.calls.filter((c) => c[0] === "freq").map((c) => c[1]));
    assert.ok(chase < scatter, `猎杀(${chase}) 应比巡游(${scatter}) 更低沉`);
  });
});

test("脏参数不炸：undefined / 负数 / 超大档位都当 0 或封顶处理", () => {
  withContext(() => {
    const audio = createAudio({ muted: false });
    assert.doesNotThrow(() => {
      audio.pellet(undefined);
      audio.pellet(-5);
      audio.pellet(999);
      audio.eatGhost(undefined);
      audio.eatGhost(-1);
      audio.eatGhost(99);
      audio.chainUp(undefined);
      audio.chainUp(NaN);
      audio.beatSwitch(undefined);
      audio.beatSwitch("nonsense");
      audio.gate(undefined);
    });
  });
});

test("unlock：恢复挂起的 context；bindUnlock 只绑一次", () => {
  withContext((get) => {
    const audio = createAudio({ muted: false });
    audio.unlock();
    const ctx = get();
    assert.ok(ctx, "unlock 应创建 context");
    assert.equal(ctx.resumed, 1);
    assert.equal(ctx.state, "running");

    const handlers = [];
    const target = {
      addEventListener(type) {
        handlers.push(type);
      },
    };
    audio.bindUnlock(target);
    audio.bindUnlock(target);
    assert.deepEqual(handlers, ["pointerdown", "keydown"], "重复绑定只会白白占用监听器");

    assert.doesNotThrow(() => audio.bindUnlock(null), "没有可绑目标时静默跳过");
  });
});
