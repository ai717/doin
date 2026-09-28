// audio.mjs — WebAudio 纯程序化合成音效（零外部音频文件）。
// 手势解锁：首次用户交互才创建 AudioContext；静音或不支持时静默降级。

let ctx = null;
let master = null;
let muted = false;
let lastBladePitch = 0;

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = Boolean(value);
  if (master && ctx) {
    master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.02);
  }
}

/** 手势解锁：在任何用户交互后调用 */
export function unlock() {
  if (ctx) {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
}

function now() {
  return ctx ? ctx.currentTime : 0;
}

function tone({ freq = 440, endFreq, type = "sine", dur = 0.12, gain = 0.2, delay = 0, slide = 0 }) {
  if (!ctx || muted) return;
  const t0 = now() + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
  if (slide) {
    osc.detune.setValueAtTime(0, t0);
    osc.detune.linearRampToValueAtTime(slide, t0 + dur);
  }
}

function noise({ dur = 0.12, gain = 0.18, freq = 1200, delay = 0, filterType = "bandpass" }) {
  if (!ctx || muted) return;
  const t0 = now() + delay;
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = freq;
  filter.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

const SFX = {
  ui: () => {
    tone({ freq: 660, endFreq: 520, type: "triangle", dur: 0.07, gain: 0.12 });
  },
  kill: (combo = 0) => {
    noise({ dur: 0.06, gain: 0.16, freq: 900 + Math.min(1600, combo * 18) });
    tone({ freq: 300 + Math.min(700, combo * 8), endFreq: 160, type: "square", dur: 0.08, gain: 0.08 });
  },
  nectar: () => {
    tone({ freq: 880, endFreq: 1320, type: "sine", dur: 0.09, gain: 0.1 });
  },
  rose: () => {
    tone({ freq: 660, endFreq: 990, type: "sine", dur: 0.14, gain: 0.12 });
    tone({ freq: 990, endFreq: 1320, type: "sine", dur: 0.16, gain: 0.1, delay: 0.05 });
  },
  levelUp: () => {
    tone({ freq: 523, type: "triangle", dur: 0.1, gain: 0.14 });
    tone({ freq: 659, type: "triangle", dur: 0.1, gain: 0.14, delay: 0.07 });
    tone({ freq: 784, type: "triangle", dur: 0.14, gain: 0.16, delay: 0.14 });
  },
  choose: () => {
    tone({ freq: 784, endFreq: 988, type: "triangle", dur: 0.12, gain: 0.16 });
  },
  evolve: () => {
    tone({ freq: 523, type: "square", dur: 0.12, gain: 0.12 });
    tone({ freq: 659, type: "square", dur: 0.12, gain: 0.12, delay: 0.09 });
    tone({ freq: 784, type: "square", dur: 0.12, gain: 0.12, delay: 0.18 });
    tone({ freq: 1047, type: "square", dur: 0.24, gain: 0.14, delay: 0.27 });
    noise({ dur: 0.3, gain: 0.1, freq: 2400, delay: 0.27 });
  },
  burst: () => {
    noise({ dur: 0.5, gain: 0.24, freq: 420, filterType: "lowpass" });
    tone({ freq: 120, endFreq: 60, type: "sine", dur: 0.5, gain: 0.28 });
    tone({ freq: 440, endFreq: 880, type: "triangle", dur: 0.28, gain: 0.1, delay: 0.12 });
  },
  emergency: () => {
    noise({ dur: 0.3, gain: 0.2, freq: 900, filterType: "bandpass" });
    tone({ freq: 500, endFreq: 980, type: "triangle", dur: 0.24, gain: 0.14 });
  },
  mowReady: () => {
    tone({ freq: 880, endFreq: 1760, type: "sine", dur: 0.16, gain: 0.14 });
  },
  hit: () => {
    noise({ dur: 0.16, gain: 0.22, freq: 300, filterType: "lowpass" });
    tone({ freq: 180, endFreq: 90, type: "sawtooth", dur: 0.16, gain: 0.14 });
  },
  checkpoint: () => {
    tone({ freq: 784, type: "sine", dur: 0.12, gain: 0.12 });
    tone({ freq: 1047, type: "sine", dur: 0.16, gain: 0.12, delay: 0.09 });
  },
  bossSpawn: () => {
    noise({ dur: 0.9, gain: 0.24, freq: 180, filterType: "lowpass" });
    tone({ freq: 90, endFreq: 45, type: "sine", dur: 0.9, gain: 0.3 });
    for (let i = 0; i < 3; i += 1) tone({ freq: 220, type: "square", dur: 0.14, gain: 0.1, delay: 0.2 + i * 0.22 });
  },
  bossCharge: () => {
    tone({ freq: 330, endFreq: 660, type: "sawtooth", dur: 0.3, gain: 0.12 });
  },
  bossSummon: () => {
    noise({ dur: 0.2, gain: 0.14, freq: 600 });
    tone({ freq: 200, endFreq: 140, type: "square", dur: 0.2, gain: 0.1 });
  },
  win: () => {
    const seq = [523, 659, 784, 1047, 1319];
    seq.forEach((f, i) => tone({ freq: f, type: "triangle", dur: 0.22, gain: 0.16, delay: i * 0.13 }));
    noise({ dur: 0.8, gain: 0.12, freq: 3000, delay: 0.5 });
  },
  lose: () => {
    const seq = [440, 349, 262, 196];
    seq.forEach((f, i) => tone({ freq: f, type: "triangle", dur: 0.3, gain: 0.14, delay: i * 0.16 }));
    noise({ dur: 0.5, gain: 0.14, freq: 200, filterType: "lowpass", delay: 0.1 });
  },
};

export function play(name, detail) {
  if (!ctx || muted) return;
  const fn = SFX[name];
  if (fn) fn(detail);
}

/** 割草机持续刀片声（低频嗡鸣，等级越高音调越高）——短促循环，非长驻音源 */
export function bladeHum(level = 1) {
  if (!ctx || muted) return;
  const target = 70 + level * 6;
  if (Math.abs(target - lastBladePitch) < 4) return;
  lastBladePitch = target;
  tone({ freq: target, endFreq: target, type: "sawtooth", dur: 0.18, gain: 0.05 });
}
