// audio.mjs — 背包竞技场：WebAudio 程序化合成音效（零外部音频文件）
// 手势解锁：首次用户交互后 resume；静音或不支持时静默降级。
// 偏好：读取 doin.backpack.v1 中的 muted 由 storage 层提供；这里只负责播放与开关。

let ctx = null;
let muted = false;

function ensureCtx() {
  if (!ctx) {
    try {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") {
    try {
      ctx.resume();
    } catch {
      // 忽略
    }
  }
  return ctx;
}

function tone({ freq = 440, endFreq, type = "sine", dur = 0.12, gain = 0.12, when = 0, attack = 0.004 }) {
  const c = ensureCtx();
  if (!c || muted) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.09, gain = 0.08, freq = 1200, when = 0, type = "highpass" }) {
  const c = ensureCtx();
  if (!c || muted) return;
  const t0 = c.currentTime + when;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buffer = c.createBuffer(1, len, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(c.destination);
  src.start(t0);
}

function click() {
  tone({ freq: 620, endFreq: 480, type: "triangle", dur: 0.06, gain: 0.07 });
}
function buy() {
  tone({ freq: 520, endFreq: 880, type: "triangle", dur: 0.14, gain: 0.11 });
  tone({ freq: 780, endFreq: 1180, type: "sine", dur: 0.12, gain: 0.06, when: 0.05 });
}
function sell() {
  tone({ freq: 760, endFreq: 480, type: "triangle", dur: 0.11, gain: 0.09 });
}
function rotate() {
  tone({ freq: 330, endFreq: 300, type: "square", dur: 0.045, gain: 0.035 });
}
function place() {
  tone({ freq: 440, endFreq: 560, type: "sine", dur: 0.07, gain: 0.06 });
}
function invalid() {
  tone({ freq: 180, endFreq: 120, type: "sawtooth", dur: 0.09, gain: 0.06 });
}
function craft() {
  tone({ freq: 660, endFreq: 1320, type: "triangle", dur: 0.16, gain: 0.11 });
  tone({ freq: 990, endFreq: 1760, type: "sine", dur: 0.14, gain: 0.07, when: 0.07 });
}
function gem() {
  tone({ freq: 1046, endFreq: 1568, type: "sine", dur: 0.14, gain: 0.08 });
  tone({ freq: 1568, endFreq: 2093, type: "sine", dur: 0.12, gain: 0.05, when: 0.06 });
}
function expand() {
  tone({ freq: 200, endFreq: 420, type: "triangle", dur: 0.18, gain: 0.1 });
  noise({ dur: 0.14, gain: 0.05, freq: 500 });
}
function hit() {
  noise({ dur: 0.05, gain: 0.05, freq: 900 });
}
function crit() {
  noise({ dur: 0.08, gain: 0.09, freq: 700 });
  tone({ freq: 880, endFreq: 660, type: "square", dur: 0.06, gain: 0.05 });
}
function burn() {
  noise({ dur: 0.12, gain: 0.05, freq: 300, type: "lowpass" });
  tone({ freq: 140, endFreq: 90, type: "sawtooth", dur: 0.14, gain: 0.05 });
}
function heal() {
  tone({ freq: 520, endFreq: 700, type: "sine", dur: 0.1, gain: 0.06 });
}
function fatigue() {
  tone({ freq: 180, endFreq: 90, type: "sawtooth", dur: 0.4, gain: 0.09 });
  noise({ dur: 0.3, gain: 0.05, freq: 200, type: "lowpass" });
}
function victory() {
  tone({ freq: 523, dur: 0.12, gain: 0.1 });
  tone({ freq: 659, dur: 0.12, gain: 0.1, when: 0.11 });
  tone({ freq: 784, dur: 0.12, gain: 0.1, when: 0.22 });
  tone({ freq: 1046, dur: 0.3, gain: 0.12, when: 0.33 });
}
function defeat() {
  tone({ freq: 392, endFreq: 370, type: "triangle", dur: 0.18, gain: 0.08 });
  tone({ freq: 330, endFreq: 310, type: "triangle", dur: 0.18, gain: 0.08, when: 0.16 });
  tone({ freq: 262, endFreq: 220, type: "triangle", dur: 0.36, gain: 0.09, when: 0.32 });
}
function toast() {
  tone({ freq: 700, endFreq: 980, type: "sine", dur: 0.08, gain: 0.05 });
}

// 同时以命名空间对象与独立命名导出，兼容 `import * as SFX` 与 `import { SFX }` 两种用法。
export const SFX = { click, buy, sell, rotate, place, invalid, craft, gem, expand, hit, crit, burn, heal, fatigue, victory, defeat, toast };
export { click, buy, sell, rotate, place, invalid, craft, gem, expand, hit, crit, burn, heal, fatigue, victory, defeat, toast };

export function setMuted(value) {
  muted = Boolean(value);
}

export function isMuted() {
  return muted;
}

// 手势解锁：任何用户交互时调用
export function unlock() {
  ensureCtx();
}
