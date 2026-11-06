// 盲盒记忆牌 — WebAudio 物理/FM 程序化合成音效
// 题材：潮玩盲盒工坊·咯哒车间；纸盒盖弹开摩擦 + FM 木琴 + 木质咯哒轮转
// 静音或不支持 WebAudio 时静默降级；永不抛错。

let ctx = null;
let muted = false;

function audioCtx() {
  if (ctx) return ctx;
  if (typeof window === "undefined") return null;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  } catch { return null; }
}

export function setMuted(v) { muted = !!v; }
export function isMuted() { return muted; }

/** 解锁音频上下文（首次用户交互后调用） */
export function unlock() {
  const c = audioCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
}

/** 短脉冲白噪 + 高通滤波 + 快速衰减 = 纸盒盖弹开摩擦声 */
export function sfxFlip() {
  if (muted) return;
  const c = audioCtx();
  if (!c) return;
  const now = c.currentTime;
  const bufferSize = 0.09 * c.sampleRate;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const noise = c.createBufferSource();
  noise.buffer = buffer;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1800;
  const g = c.createGain();
  g.gain.setValueAtTime(0.18, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
  noise.connect(hp).connect(g).connect(c.destination);
  noise.start(now);
  noise.stop(now + 0.09);
}

/** FM 三振荡器 + 慢 Attack = 治愈木琴"叮"；每连击 +1 半音 */
export function sfxMatch(combo = 0) {
  if (muted) return;
  const c = audioCtx();
  if (!c) return;
  const now = c.currentTime;
  const baseFreq = 523.25 * Math.pow(2, (combo % 12) / 12); // C5 起，每连击 +1 半音
  const carrier = c.createOscillator();
  carrier.type = "sine";
  carrier.frequency.value = baseFreq;
  const mod = c.createOscillator();
  mod.type = "sine";
  mod.frequency.value = baseFreq * 3;
  const modGain = c.createGain();
  modGain.gain.value = baseFreq * 1.5;
  mod.connect(modGain).connect(carrier.frequency);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.22, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  carrier.connect(g).connect(c.destination);
  carrier.start(now);
  mod.start(now);
  carrier.stop(now + 0.5);
  mod.stop(now + 0.5);
}

/** 短低频余响 + 短噪声闷响 = 纸盒闷盖"啪" */
export function sfxMismatch() {
  if (muted) return;
  const c = audioCtx();
  if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
  const g = c.createGain();
  g.gain.setValueAtTime(0.18, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc.connect(g).connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.08);
  // 短噪声叠加
  const bufferSize = 0.06 * c.sampleRate;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) * 0.6;
  }
  const noise = c.createBufferSource();
  noise.buffer = buffer;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 800;
  const ng = c.createGain();
  ng.gain.value = 0.12;
  noise.connect(lp).connect(ng).connect(c.destination);
  noise.start(now);
  noise.stop(now + 0.06);
}

/**
 * 木质"咯哒"轮转音：每个邻位错位 30ms 木质声，按顺时针方向依次响起。
 * n 个邻位 = n 声短踢，串成一串。
 */
export function sfxRotate(positionsCount = 4) {
  if (muted || positionsCount <= 0) return;
  const c = audioCtx();
  if (!c) return;
  const now = c.currentTime;
  for (let i = 0; i < positionsCount; i += 1) {
    const t0 = now + i * 0.03;
    const osc = c.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(380 + i * 35, t0);
    osc.frequency.exponentialRampToValueAtTime(140, t0 + 0.025);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.003);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.028);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.03);
  }
}

/** 象限整体旋转：低频 sine + 阻尼余响 300ms + 一串更长 8 拍木格声 */
export function sfxGear() {
  if (muted) return;
  const c = audioCtx();
  if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.exponentialRampToValueAtTime(70, now + 0.3);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc.connect(g).connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.3);
  // 8 拍木格声
  for (let i = 0; i < 8; i += 1) {
    const t0 = now + i * 0.035;
    const o = c.createOscillator();
    o.type = "square";
    o.frequency.setValueAtTime(280 + i * 25, t0);
    o.frequency.exponentialRampToValueAtTime(120, t0 + 0.03);
    const og = c.createGain();
    og.gain.setValueAtTime(0.0001, t0);
    og.gain.exponentialRampToValueAtTime(0.1, t0 + 0.003);
    og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.03);
    o.connect(og).connect(c.destination);
    o.start(t0);
    o.stop(t0 + 0.03);
  }
}

/** 通关：风铃琶音（C-E-G-C 上行）+ 纸屑沙沙声 */
export function sfxWin() {
  if (muted) return;
  const c = audioCtx();
  if (!c) return;
  const now = c.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((f, i) => {
    const t0 = now + i * 0.12;
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.6);
  });
  // 纸屑沙沙声
  const bufferSize = 0.5 * c.sampleRate;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) * 0.4;
  }
  const noise = c.createBufferSource();
  noise.buffer = buffer;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 3000;
  const ng = c.createGain();
  ng.gain.value = 0.08;
  noise.connect(hp).connect(ng).connect(c.destination);
  noise.start(now);
  noise.stop(now + 0.5);
}

/** 零错彩蛋：风铃 + 木琴合奏 1.2 秒加花 */
export function sfxFlawless() {
  if (muted) return;
  const c = audioCtx();
  if (!c) return;
  const now = c.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1046.5, 1318.51, 1567.98];
  notes.forEach((f, i) => {
    const t0 = now + i * 0.13;
    const osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = f;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.7);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.7);
  });
}

/** 失败：低沉下行 */
export function sfxLose() {
  if (muted) return;
  const c = audioCtx();
  if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(70, now + 0.8);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 600;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.16, now + 0.05);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
  osc.connect(lp).connect(g).connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.8);
}