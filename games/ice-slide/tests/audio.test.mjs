// filepath: games/ice-slide/tests/audio.test.mjs
// 音效合成测试：fake AudioContext 记录节点创建与参数，断言六音色各自合成到位、
// 静音零节点、无环境静默降级、构造失败永久降级、氛围开关可逆。
import { test } from "node:test";
import assert from "node:assert/strict";
import { createAudio } from "../js/audio.mjs";

function fakeContext() {
  const calls = [];
  const stamp = () => {
    calls.push(["tick"]);
    return ctx.now;
  };
  const connect = (target) => target;
  const param = (name) => ({
    setValueAtTime: (v) => calls.push(["param", name, v]),
    exponentialRampToValueAtTime: (v) => calls.push(["param-ramp", name, v]),
    linearRampToValueAtTime: (v) => calls.push(["param-ramp", name, v]),
    value: 0,
  });
  const ctx = {
    calls,
    now: 0,
    state: "suspended",
    resumed: 0,
    closed: false,
    sampleRate: 44100,
    destination: {},
    resume() {
      this.resumed += 1;
      this.state = "running";
    },
    close() {
      this.closed = true;
    },
    currentTime: 0,
    createOscillator() {
      const osc = {
        type: "sine",
        frequency: param("osc.frequency"),
        connect,
        start: () => calls.push(["osc-start"]),
        stop: () => calls.push(["osc-stop"]),
      };
      return osc;
    },
    createGain() {
      return { gain: param("gain"), connect };
    },
    createBiquadFilter() {
      return {
        type: "lowpass",
        frequency: param("filter.frequency"),
        Q: param("filter.Q"),
        connect,
      };
    },
    createBufferSource() {
      return {
        buffer: null,
        loop: false,
        connect,
        start: () => calls.push(["noise-start"]),
        stop: () => calls.push(["noise-stop"]),
      };
    },
    createBuffer(channels, len) {
      return { channels, length: len, getChannelData: () => new Float32Array(len) };
    },
  };
  return ctx;
}

/** 契约：options.Context 是"返回构造器的函数"（与 window.AudioContext 读取方式一致） */
function ctxProvider(ctx) {
  const Ctor = function FakeAudioContext() {
    return ctx;
  };
  return () => Ctor;
}

function armed() {
  const ctx = fakeContext();
  const audio = createAudio({ muted: false, Context: ctxProvider(ctx) });
  audio.unlock();
  return { ctx, audio };
}

test("audio: 环境没有 AudioContext 时整体静默降级，不抛异常", () => {
  const audio = createAudio({ muted: false, Context: () => null });
  assert.doesNotThrow(() => {
    audio.unlock();
    audio.slide(4);
    audio.hitWall();
    audio.push();
    audio.goal();
    audio.win();
    audio.click();
    audio.undo();
    audio.ambient(true);
    audio.ambient(false);
    audio.dispose();
  });
  assert.equal(audio.isMuted(), false);
});

test("audio: 静音时零发声节点，取消静音后恢复", () => {
  const ctx = fakeContext();
  const audio = createAudio({ muted: true, Context: ctxProvider(ctx) });
  audio.unlock();
  audio.slide(6);
  audio.hitWall();
  audio.win();
  audio.goal();
  assert.equal(ctx.calls.length, 0, "muted 时不得创建任何节点");

  audio.setMuted(false);
  audio.click();
  assert.ok(ctx.calls.length > 0, "取消静音后应恢复发声");
  audio.setMuted(true);
  assert.equal(audio.isMuted(), true);
});

test("audio: 首次 unlock 恢复被挂起的音频上下文", () => {
  const ctx = fakeContext();
  const audio = createAudio({ Context: ctxProvider(ctx) });
  audio.unlock();
  assert.equal(ctx.resumed, 1);
  audio.click();
  assert.ok(ctx.calls.some(([kind]) => kind === "osc-start"));
});

test("audio: 滑行音 = 噪声 + 带通扫频，距离越远起音越高", () => {
  // 断言扫频目标（ramp）：带通截止频率随距离整体上移
  const sweepOf = (calls) =>
    calls.filter(([kind, name]) => kind === "param-ramp" && name === "filter.frequency").map(([, , v]) => v);
  const near = armed();
  near.audio.slide(2);
  const nearSweep = Math.max(...sweepOf(near.ctx.calls));

  const far = armed();
  far.audio.slide(12);
  const farSweep = Math.max(...sweepOf(far.ctx.calls));
  assert.ok(farSweep > nearSweep, `远距离滑行扫频应更高: ${nearSweep} vs ${farSweep}`);
  assert.ok(far.ctx.calls.some(([kind]) => kind === "noise-start"), "滑行必须走噪声缓冲");
});

test("audio: 撞墙音 = 低频木响 + 高频冰晶瞬态 + 碎冰茬", () => {
  const { ctx, audio } = armed();
  audio.hitWall();
  assert.ok(ctx.calls.some(([kind]) => kind === "noise-start"), "应有冰晶噪声瞬态");
  const oscTypes = ctx.calls.filter(([kind, name]) => kind === "param" && name === "osc.frequency");
  assert.ok(oscTypes.length >= 1, "应有低频木响振荡器");
  assert.ok(ctx.calls.filter(([kind]) => kind === "noise-start").length >= 4, "碎冰茬至少 3 段 + 主体 1 段");
});

test("audio: 推箱音 = 噪声低通扫频 + 低频垫音", () => {
  const { ctx, audio } = armed();
  audio.push();
  assert.ok(ctx.calls.some(([kind]) => kind === "noise-start"));
  const ramps = ctx.calls.filter(([kind, name]) => kind === "param-ramp" && name === "filter.frequency");
  assert.ok(ramps.length >= 1, "低通截止频率应扫频（咕噜感）");
});

test("audio: 灯标叮铃 = FM 编钟（倍频调制器接载波频率）", () => {
  const { ctx, audio } = armed();
  audio.goal();
  const modFreqs = ctx.calls.filter(([kind, name, v]) => kind === "param" && name === "osc.frequency");
  assert.ok(modFreqs.length >= 4, "双音编钟至少 2 载波 + 2 调制器");
  // 调制器频率应为载波的 2 倍（金属铃芯特征）
  const values = modFreqs.map(([, , v]) => v);
  assert.ok(values.includes(1046.5) && values.includes(2093), `FM 倍频关系缺失: ${values.join(",")}`);
});

test("audio: 通关音 = 大七和弦四音上行琶音 + 风声收束", () => {
  const { ctx, audio } = armed();
  audio.win();
  const freqs = ctx.calls.filter(([kind, name]) => kind === "param" && name === "osc.frequency").map(([, , v]) => v);
  for (const f of [523.25, 659.25, 783.99, 987.77]) {
    assert.ok(freqs.includes(f), `缺和弦音 ${f}`);
  }
  assert.ok(ctx.calls.filter(([kind]) => kind === "noise-start").length >= 1, "应有风声收束噪声");
});

test("audio: 氛围开关可逆，关闭后停掉所有循环节点", () => {
  const { ctx, audio } = armed();
  audio.ambient(true);
  assert.equal(audio.isAmbientOn(), true);
  const looped = ctx.calls.filter(([kind]) => kind === "noise-start").length;
  assert.ok(looped >= 1, "氛围风声应启动噪声循环");
  audio.ambient(false);
  assert.equal(audio.isAmbientOn(), false);
  assert.ok(ctx.calls.some(([kind]) => kind === "noise-stop"), "关闭氛围应停掉噪声源");
});

test("audio: 音频上下文构造失败时永久降级，不反复重试", () => {
  let attempts = 0;
  const audio = createAudio({
    Context: () => {
      attempts += 1;
      throw new Error("blocked by autoplay policy");
    },
  });
  assert.doesNotThrow(() => {
    audio.unlock();
    audio.slide(3);
    audio.win();
    audio.unlock();
  });
  assert.equal(attempts, 1, "构造失败后不得重试");
});
