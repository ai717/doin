// 音效契约：十种专属音色都必须真的排程了对应的合成节点。
// 用记录型 AudioContext 替身，断言的是"发出了什么"，而不是"没抛异常"——
// 后者挡不住"十个音效全调用同一个正弦 beep"这种明显的偷工。

import test from "node:test";
import assert from "node:assert/strict";

import {
  createAudio, flipTone, cascadeDelayMs, PENTATONIC, FLIP_STEP_MS,
} from "../js/audio.mjs";

const eq = assert.strictEqual;
const de = assert.deepStrictEqual;

function param(log, kind) {
  const writes = [];
  const record = (mode) => (value, time) => writes.push([mode, value, time]);
  return {
    writes,
    kind,
    setValueAtTime: record("set"),
    linearRampToValueAtTime: record("linear"),
    exponentialRampToValueAtTime: record("exp"),
    cancelScheduledValues: record("cancel"),
  };
}

// 记录型 AudioContext：每个节点把关键参数写进 log，测试据此断言合成配方。
function recorder() {
  const log = { osc: [], biquad: [], noise: [], gain: [], buffers: [] };
  const ctx = {
    log,
    state: "suspended",
    currentTime: 0,
    sampleRate: 48000,
    destination: { name: "destination" },
    resumed: 0,
    resume() {
      this.resumed += 1;
      this.state = "running";
    },
    createGain() {
      const gain = param(log, "gain");
      const node = { gain, connect: (target) => target };
      log.gain.push(node);
      return node;
    },
    createOscillator() {
      const frequency = param(log, "frequency");
      const detune = param(log, "detune");
      const node = {
        type: "sine",
        frequency,
        detune,
        connect: (target) => target,
        start(when) { this.startedAt = when; },
        stop(when) { this.stoppedAt = when; },
      };
      log.osc.push(node);
      return node;
    },
    createBiquadFilter() {
      const node = {
        type: "lowpass",
        frequency: param(log, "biquadFrequency"),
        Q: param(log, "q"),
        connect: (target) => target,
      };
      log.biquad.push(node);
      return node;
    },
    createBufferSource() {
      const node = {
        buffer: null,
        connect: (target) => target,
        start(...args) { this.startArgs = args; },
        stop(when) { this.stoppedAt = when; },
      };
      log.noise.push(node);
      return node;
    },
    createBuffer(channels, length, rate) {
      const data = new Float32Array(length);
      const buffer = { numberOfChannels: channels, length, sampleRate: rate, getChannelData: () => data };
      log.buffers.push({ buffer, data });
      return buffer;
    },
  };
  return ctx;
}

function withContext(handler) {
  const ctx = recorder();
  const previous = globalThis.AudioContext;
  globalThis.AudioContext = function AudioContextShim() {
    return ctx;
  };
  try {
    handler(ctx);
  } finally {
    if (previous === undefined) delete globalThis.AudioContext;
    else globalThis.AudioContext = previous;
  }
}

function freqOf(node) {
  return node.frequency.writes[0][1];
}

function firstWrite(node, kind, mode = "set") {
  const hit = node[kind].writes.find((entry) => entry[0] === mode);
  return hit ? hit[1] : undefined;
}

function lastWrite(node, kind, mode = "set") {
  const hits = node[kind].writes.filter((entry) => entry[0] === mode);
  return hits.length ? hits[hits.length - 1][1] : undefined;
}

// 第 0 个增益节点永远是总线（ensure() 里最先创建），做音色断言时要跳过它。
function voiceGains(ctx) {
  return ctx.log.gain.slice(1);
}

// ─── 波次翻转音阶的数学 ───────────────────────────────────────────
test("flipTone：第 k 枚 = 五声音阶第 k 级，超过五级继续升八度", () => {
  eq(FLIP_STEP_MS, 45);
  de([...PENTATONIC], [261.63, 293.66, 329.63, 392, 440]);
  for (let k = 1; k <= 5; k += 1) eq(flipTone(k), PENTATONIC[k - 1]);
  eq(flipTone(6), PENTATONIC[0] * 2);
  eq(flipTone(10), PENTATONIC[4] * 2);
  eq(flipTone(11), PENTATONIC[0] * 4);
  // 音高随翻转序号严格递增：这正是"翻得越多、音阶越长越高"的来源
  for (let k = 2; k <= 12; k += 1) assert.ok(flipTone(k) > flipTone(k - 1), `第 ${k} 级不高于第 ${k - 1} 级`);
  eq(flipTone(0), PENTATONIC[0]);
  eq(flipTone(-3), PENTATONIC[0]);
  eq(flipTone("x"), PENTATONIC[0]);
  eq(flipTone(2.9), PENTATONIC[1]);
});

test("cascadeDelayMs：第 k 枚延后 (k−1)×45ms", () => {
  eq(cascadeDelayMs(1), 0);
  eq(cascadeDelayMs(2), 45);
  eq(cascadeDelayMs(3), 90);
  eq(cascadeDelayMs(8), 315);
  eq(cascadeDelayMs(0), 0);
  eq(cascadeDelayMs(undefined), 0);
});

// ─── 降级与开关 ───────────────────────────────────────────────────
const EFFECTS = [
  ["place", []],
  ["flip", [3]],
  ["corner", []],
  ["trap", []],
  ["hint", []],
  ["passTurn", []],
  ["balance", []],
  ["tilt", []],
  ["press", []],
  ["settle", [true]],
  ["settle", [false]],
  ["perfect", []],
  ["comboBreak", []],
];

test("环境没有 AudioContext 时全部静默降级，不抛异常", () => {
  const previous = globalThis.AudioContext;
  delete globalThis.AudioContext;
  try {
    const audio = createAudio();
    assert.doesNotThrow(() => {
      audio.unlock();
      for (const [name, args] of EFFECTS) audio[name](...args);
    });
    eq(audio.isMuted(), false);
    eq(audio.getVolume(), 0.8);
  } finally {
    if (previous !== undefined) globalThis.AudioContext = previous;
  }
});

test("接口契约：十种音效与总控方法齐备", () => {
  const audio = createAudio();
  const expected = [
    "unlock", "setMuted", "isMuted", "setVolume", "getVolume",
    "place", "flip", "corner", "trap", "hint", "passTurn",
    "balance", "tilt", "press", "settle", "perfect", "comboBreak",
  ];
  for (const name of expected) eq(typeof audio[name], "function", `缺方法 ${name}`);
});

test("静音时不创建任何节点，取消静音后恢复发声", () => {
  withContext((ctx) => {
    const audio = createAudio({ muted: true });
    for (const [name, args] of EFFECTS) audio[name](...args);
    eq(ctx.log.osc.length, 0);
    eq(ctx.log.noise.length, 0);
    eq(ctx.log.biquad.length, 0);
    eq(ctx.log.gain.length, 0);

    audio.setMuted(false);
    audio.place();
    assert.ok(ctx.log.osc.length > 0);
    audio.setMuted(true);
    eq(audio.isMuted(), true);
    const frozen = ctx.log.osc.length;
    audio.corner();
    eq(ctx.log.osc.length, frozen);
  });
});

test("被挂起的上下文在第一次发声时解锁，且只解锁一次", () => {
  withContext((ctx) => {
    const audio = createAudio();
    audio.place();
    eq(ctx.resumed, 1);
    audio.place();
    eq(ctx.resumed, 1);
  });
});

test("AudioContext 构造抛错时永久降级，不反复重试", () => {
  const previous = globalThis.AudioContext;
  let attempts = 0;
  globalThis.AudioContext = function Broken() {
    attempts += 1;
    throw new Error("blocked by autoplay policy");
  };
  try {
    const audio = createAudio();
    assert.doesNotThrow(() => {
      audio.place();
      audio.corner();
      audio.perfect();
    });
    eq(attempts, 1);
  } finally {
    globalThis.AudioContext = previous;
  }
});

test("每种音效都真的排程了发声节点（拒绝「十个音效同一个 beep」）", () => {
  for (const [name, args] of EFFECTS) {
    withContext((ctx) => {
      const audio = createAudio();
      audio[name](...args);
      const nodes = ctx.log.osc.length + ctx.log.noise.length;
      assert.ok(nodes > 0, `${name} 没有排程任何发声节点`);
      if (name !== "hint") assert.ok(ctx.log.biquad.length + ctx.log.osc.length > 1, `${name} 过于单薄`);
    });
  }
});

// ─── 逐条核对 PRD §4.3 的合成配方 ─────────────────────────────────
test("1 落子：低通 600 的噪声脉冲 + 150Hz 正弦体 + 绒布拖尾", () => {
  withContext((ctx) => {
    createAudio().place();
    const lowpass = ctx.log.biquad.map((f) => [f.type, freqOf(f)]);
    assert.ok(lowpass.some(([type, f]) => type === "lowpass" && f === 600), "缺 600Hz 低通噪声");
    assert.ok(lowpass.some(([type, f]) => type === "lowpass" && f === 900), "缺绒布拖尾");
    const body = ctx.log.osc.map(freqOf);
    assert.ok(body.includes(150), "缺 150Hz 正弦体");
    assert.ok(ctx.log.noise.length >= 2, "噪声脉冲数量不足");
  });
});

test("2 翻转：带通 1600/Q3 的「啪」+ 第 k 级 FM 铃音，且按 45ms 递延", () => {
  withContext((ctx) => {
    createAudio().flip(3);
    const band = ctx.log.biquad.find((f) => f.type === "bandpass");
    eq(band ? freqOf(band) : null, 1600);
    eq(firstWrite(band, "Q"), 3);
    // 载波 = 第 3 级（角 329.63），调制器 = 载波 × 2（调制比 2:1）
    const carriers = ctx.log.osc.filter((node) => freqOf(node) === flipTone(3));
    eq(carriers.length, 1, "缺第 3 级载波");
    eq(carriers[0].startedAt, 0.09, "第 3 枚必须延后 90ms");
    const modulator = ctx.log.osc.find((node) => freqOf(node) === flipTone(3) * 2);
    assert.ok(modulator, "缺调制器（调制比 2:1）");
    // 调制深度 = 指数 × 调制频率，且必须衰减（否则只是刺耳噪声）
    const depths = voiceGains(ctx).map((node) => firstWrite(node, "gain"));
    eq(depths.includes(2.6 * flipTone(3) * 2), true);
  });
});

test("2 翻转：第 1 枚不递延，第 6 枚音高翻八度且延后 225ms", () => {
  withContext((ctx) => {
    const audio = createAudio();
    audio.flip(1);
    const first = ctx.log.osc.find((node) => freqOf(node) === PENTATONIC[0]);
    eq(first.startedAt, 0);

    ctx.log.osc.length = 0;
    audio.flip(6);
    const sixth = ctx.log.osc.find((node) => freqOf(node) === PENTATONIC[0] * 2);
    assert.ok(sixth, "第 6 枚应升八度");
    eq(sixth.startedAt, 225 / 1000);
  });
});

test("3 得角：载波 220 的 FM 编钟（调制 220×1.41，指数 6 → 0.5，1.4s）", () => {
  withContext((ctx) => {
    createAudio().corner();
    const carrier = ctx.log.osc.find((node) => node.type === "sine" && freqOf(node) === 220);
    assert.ok(carrier, "缺 220Hz 载波");
    const modulator = ctx.log.osc.find((node) => freqOf(node) === 220 * 1.41);
    assert.ok(modulator, "缺 220×1.41 调制器");
    const depth = voiceGains(ctx).find((node) => firstWrite(node, "gain") === 6 * 220 * 1.41);
    assert.ok(depth, "调制指数起点不是 6");
    const decay = depth.gain.writes.find(([mode, value]) => mode === "exp" && Math.abs(value - 0.5 * 220 * 1.41) < 1e-6);
    assert.ok(decay, "调制指数未衰减到 0.5");
    eq(decay[2], 1.4, "编钟时长应为 1.4s");
  });
});

test("4 陷阱：440 → 415 的下行小二度，且都过 1200 低通", () => {
  withContext((ctx) => {
    createAudio().trap();
    const freqs = ctx.log.osc.map(freqOf);
    de(freqs, [440, 415]);
    for (const node of ctx.log.osc) eq(node.type, "triangle");
    for (const filter of ctx.log.biquad) eq(freqOf(filter), 1200);
    eq(ctx.log.osc[1].startedAt, 0.06);
  });
});

test("5 合法落点提示：高通噪声 + 1800Hz 点音，音量克制", () => {
  withContext((ctx) => {
    createAudio().hint();
    const highpass = ctx.log.biquad.find((f) => f.type === "highpass");
    eq(highpass ? freqOf(highpass) : null, 4000);
    assert.ok(ctx.log.osc.some((node) => freqOf(node) === 1800));
    const peaks = voiceGains(ctx).map((node) => firstWrite(node, "gain"));
    assert.ok(peaks.every((value) => value <= 0.04), "提示音应当极轻");
  });
});

test("6 Pass：1046 + 1568 双正弦，错开 40ms", () => {
  withContext((ctx) => {
    createAudio().passTurn();
    const a = ctx.log.osc.find((node) => freqOf(node) === 1046);
    const b = ctx.log.osc.find((node) => freqOf(node) === 1568);
    assert.ok(a && b, "缺风铃双音");
    eq(a.startedAt, 0);
    eq(b.startedAt, 0.04);
  });
});

test("7 天平：归位是「叮」+「咔」，倾覆再叠一记 90Hz 低音下潜", () => {
  withContext((ctx) => {
    const audio = createAudio();
    audio.balance();
    assert.ok(ctx.log.osc.some((node) => freqOf(node) === 1200 && node.type === "triangle"));
    assert.ok(ctx.log.biquad.some((f) => f.type === "bandpass" && freqOf(f) === 2500));
    const before = ctx.log.osc.length;

    audio.tilt();
    const added = ctx.log.osc.slice(before).map(freqOf);
    assert.ok(added.includes(1200) && added.includes(90), "倾覆音缺低音下潜");

    ctx.log.osc.length = 0;
    audio.press();
    assert.ok(ctx.log.osc.length > 0, "黄铜按键音缺失");
  });
});

test("8 终局结算：马林巴四音，胜方上行、负方下行，收尾一记长钟", () => {
  withContext((ctx) => {
    createAudio().settle(true);
    const win = ctx.log.osc.map(freqOf).filter((f) => PENTATONIC.includes(f));
    de(win, [PENTATONIC[0], PENTATONIC[1], PENTATONIC[2], PENTATONIC[3]]);
    assert.ok(ctx.log.osc.some((node) => freqOf(node) === 220), "缺收尾长钟");
  });
  withContext((ctx) => {
    createAudio().settle(false);
    const lose = ctx.log.osc.map(freqOf).filter((f) => f >= 100 && f <= 300);
    eq(lose.length >= 4, true);
    for (let i = 1; i < lose.length - 1; i += 1) {
      assert.ok(lose[i] <= lose[i - 1], "负方结算必须下行");
    }
  });
});

test("9 完美局：失谐双锯齿上行 + 60Hz Kick + 五声琶音", () => {
  withContext((ctx) => {
    createAudio().perfect();
    const saws = ctx.log.osc.filter((node) => node.type === "sawtooth");
    eq(saws.length, 2, "应为失谐双振荡器");
    de(saws.map((node) => firstWrite(node, "detune")), [-8, 8]);
    for (const node of saws) {
      eq(firstWrite(node, "frequency"), 220);
      const slide = node.frequency.writes.find(([mode]) => mode === "exp");
      eq(slide[1], 880);
    }
    const kick = ctx.log.osc.find((node) => node.type === "sine" && firstWrite(node, "frequency") === 60);
    assert.ok(kick, "缺低音 Kick");
    const arpeggio = ctx.log.osc.filter((node) => PENTATONIC.includes(freqOf(node)));
    eq(arpeggio.length, 5);
  });
});

test("10 连击断：三音下行 + 低通扫频 2000 → 600", () => {
  withContext((ctx) => {
    createAudio().comboBreak();
    de(ctx.log.osc.map(freqOf), [523, 392, 262]);
    for (const node of ctx.log.osc) eq(node.type, "sawtooth");
    const sweeps = ctx.log.biquad.filter((f) => firstWrite(f, "frequency") === 2000);
    eq(sweeps.length, 3);
    for (const filter of sweeps) {
      const hit = filter.frequency.writes.find(([mode]) => mode === "exp");
      eq(hit[1], 600);
    }
  });
});

// ─── 音量总控与确定性噪声 ─────────────────────────────────────────
test("音量总控：初始值生效、可调、越界夹到 0..1", () => {
  withContext((ctx) => {
    const audio = createAudio({ volume: 0.5 });
    audio.place();
    eq(firstWrite(ctx.log.gain[0], "gain"), 0.5); // 第 0 个增益节点就是总线
    eq(audio.getVolume(), 0.5);

    audio.setVolume(1.4);
    eq(audio.getVolume(), 1);
    eq(lastWrite(ctx.log.gain[0], "gain"), 1);

    audio.setVolume(-2);
    eq(audio.getVolume(), 0);
    audio.setVolume("x");
    eq(audio.getVolume(), 0);
  });
});

test("噪声缓冲是确定性填充的：两次会话的噪声波形逐点相同", () => {
  const capture = () => {
    let data = null;
    withContext((ctx) => {
      const audio = createAudio();
      audio.place();
      data = ctx.log.buffers[0].data;
    });
    return data;
  };
  const a = capture();
  const b = capture();
  assert.ok(a.length > 1000);
  let identical = true;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      identical = false;
      break;
    }
  }
  eq(identical, true, "噪声必须是确定性 LCG，不能依赖 Math.random");
  assert.ok(a.some((value) => value !== 0), "噪声缓冲不应全为零");
  assert.ok(a.every((value) => value >= -1 && value <= 1), "噪声必须落在 [-1, 1]");
});

test("噪声缓冲只建一次（64 枚棋子的连续翻转不该反复分配内存）", () => {
  withContext((ctx) => {
    const audio = createAudio();
    for (let k = 1; k <= 12; k += 1) audio.flip(k);
    eq(ctx.log.buffers.length, 1);
    eq(ctx.log.noise.length, 12);
  });
});
