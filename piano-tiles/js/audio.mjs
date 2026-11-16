// Piano Tiles — WebAudio 程序化合成音效（零外部文件）
// 命中 = 清脆叮声，音阶随连击爬升；失误 = 走调哔

let audioCtx = null;
let masterGain = null;
let unlocked = false;
let muted = false;

// 不同连击档位对应的音阶频率（C4 起，上升音阶）
const SCALE = [
  261.63, // C4
  293.66, // D4
  329.63, // E4
  349.23, // F4
  392.00, // G4
  440.00, // A4
  493.88, // B4
  523.25, // C5
  587.33, // D5
  659.25, // E5
  698.46, // F5
  783.99, // G5
  880.00, // A5
  987.77, // B5
  1046.50, // C6
];

function ensureCtx() {
  if (audioCtx) return audioCtx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.35;
    masterGain.connect(audioCtx.destination);
    return audioCtx;
  } catch {
    return null;
  }
}

export function unlockAudio() {
  const ctx = ensureCtx();
  if (!ctx) return false;
  if (ctx.state === "suspended") ctx.resume();
  unlocked = true;
  return true;
}

export function setMuted(value) {
  muted = Boolean(value);
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.35;
}

export function isMuted() {
  return muted;
}

/**
 * 命中黑块音效
 * combo: 当前连击数 — 决定音阶位置
 * quality: 'perfect' | 'good' — PERFECT 加高频泛音
 */
export function playHit(combo = 0, quality = "good") {
  if (!unlocked || muted) return;
  const ctx = ensureCtx();
  if (!ctx) return;

  // 根据连击选取音阶
  const idx = Math.min(Math.floor(combo / 2), SCALE.length - 1);
  const freq = SCALE[idx];

  const now = ctx.currentTime;

  // 主音：三角形波 + 快速 ADSR
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = freq;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.5, now + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

  osc.connect(g).connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.25);

  // PERFECT 加泛音
  if (quality === "perfect") {
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = freq * 2;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0, now);
    g2.gain.linearRampToValueAtTime(0.25, now + 0.005);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc2.connect(g2).connect(masterGain);
    osc2.start(now);
    osc2.stop(now + 0.2);
  }
}

/** 失误音效：走调方波 + 低频噪声感 */
export function playMiss() {
  if (!unlocked || muted) return;
  const ctx = ensureCtx();
  if (!ctx) return;

  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.linearRampToValueAtTime(120, now + 0.18);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.35, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

  osc.connect(g).connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.22);
}

/** 段位晋升音效：上升琶音 */
export function playRankUp() {
  if (!unlocked || muted) return;
  const ctx = ensureCtx();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6

  notes.forEach((freq, i) => {
    const t = now + i * 0.07;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(g).connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.2);
  });
}
