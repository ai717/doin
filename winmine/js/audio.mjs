// WebAudio 程序化合成音效：零外部音频文件，手势解锁，静音或不支持时静默降级。
// 契合 WinMine 的清脆"卡哒"手感。

let ctx = null;
let muted = false;

function ensureCtx() {
  if (ctx) return ctx;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    return null;
  }
  return ctx;
}

export function setMuted(value) {
  muted = Boolean(value);
}

export function isMuted() {
  return muted;
}

// 首次用户手势时解锁 AudioContext（浏览器自动播放策略）。
export function unlock() {
  const c = ensureCtx();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

function tone(freq, duration, type = "square", gain = 0.05, when = 0) {
  if (muted) return;
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const sfx = {
  reveal() {
    tone(520, 0.04, "square", 0.03);
  },
  flag() {
    tone(880, 0.05, "square", 0.04);
    tone(660, 0.05, "square", 0.03, 0.03);
  },
  question() {
    tone(440, 0.04, "square", 0.03);
  },
  chord() {
    tone(600, 0.04, "square", 0.03);
    tone(720, 0.04, "square", 0.03, 0.03);
  },
  explode() {
    tone(120, 0.5, "sawtooth", 0.12);
    tone(80, 0.6, "sawtooth", 0.1, 0.05);
  },
  win() {
    tone(523, 0.09, "square", 0.05);
    tone(659, 0.09, "square", 0.05, 0.09);
    tone(784, 0.14, "square", 0.05, 0.18);
  },
};