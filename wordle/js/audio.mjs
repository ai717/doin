// audio.mjs —— WebAudio 程序化合成音效（铅字排印台专属音色，无外链音频）。
// 物理材质拟真：金属铅字敲击（噪声+带通谐振）、印刷机压印（低频噪声+滑音）、纸页翻色（高通脆响）、
// FM 编钟报捷、失谐双振荡器败局低鸣。静音或不支持时静默降级，绝不阻塞。

let ctx = null;
let master = null;
let noiseBuf = null;
let broken = false;
let muted = false;

function ensure() {
  if (broken || muted) return null;
  if (ctx) {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      broken = true;
      return null;
    }
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    // 白噪声缓冲（金属/纸页/压印的物理材质源）
    const len = ctx.sampleRate | 0;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    return ctx;
  } catch {
    broken = true;
    return null;
  }
}

function noise(dur) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  src.start(0);
  src.stop(ctx.currentTime + dur);
  return src;
}
function env(gainNode, peak, attack, decay) {
  const g = gainNode.gain;
  const t0 = ctx.currentTime;
  g.setValueAtTime(0.0001, t0);
  g.linearRampToValueAtTime(peak, t0 + attack);
  g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
}

// 金属铅字敲击：噪声带通谐振 + 短促方波叮声（字码微移音高，敲起来粒粒分明）
export function playKey(code = 0) {
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2300 + (code % 5) * 140;
  bp.Q.value = 9;
  const ng = c.createGain();
  env(ng, 0.16, 0.002, 0.05);
  noise(0.07).connect(bp).connect(ng).connect(master);
  const osc = c.createOscillator();
  osc.type = "square";
  osc.frequency.value = 1750 + (code % 9) * 55;
  const og = c.createGain();
  env(og, 0.05, 0.001, 0.035);
  osc.connect(og).connect(master);
  osc.start(t0);
  osc.stop(t0 + 0.05);
}

// 印刷机压印：低频噪声 + 正弦下滑，厚重一压
export function playSubmit() {
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 620;
  const ng = c.createGain();
  env(ng, 0.32, 0.004, 0.1);
  noise(0.12).connect(lp).connect(ng).connect(master);
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(165, t0);
  osc.frequency.exponentialRampToValueAtTime(88, t0 + 0.1);
  const og = c.createGain();
  env(og, 0.4, 0.004, 0.11);
  osc.connect(og).connect(master);
  osc.start(t0);
  osc.stop(t0 + 0.14);
}

// 纸页翻色：高通脆响 + 按反馈状态变色的短音（correct 最亮）
export function playFlip(state = "absent") {
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 3200;
  const ng = c.createGain();
  env(ng, 0.1, 0.001, 0.03);
  noise(0.04).connect(hp).connect(ng).connect(master);
  const freq = state === "correct" ? 990 : state === "present" ? 740 : 330;
  const osc = c.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, t0);
  const og = c.createGain();
  env(og, 0.07, 0.002, 0.09);
  osc.connect(og).connect(master);
  osc.start(t0);
  osc.stop(t0 + 0.12);
}

// FM 编钟报捷：C5-E5-G5-C6 上行琶音
export function playWin() {
  const c = ensure();
  if (!c) return;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => {
    const t0 = c.currentTime + i * 0.13;
    const carrier = c.createOscillator();
    carrier.frequency.value = f;
    const mod = c.createOscillator();
    mod.frequency.value = f * 3.0;
    const modGain = c.createGain();
    modGain.gain.setValueAtTime(f * 1.4, t0);
    modGain.gain.exponentialRampToValueAtTime(1, t0 + 0.5);
    mod.connect(modGain).connect(carrier.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.18, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
    carrier.connect(g).connect(master);
    carrier.start(t0);
    mod.start(t0);
    carrier.stop(t0 + 0.6);
    mod.stop(t0 + 0.6);
  });
}

// 失谐双振荡器败局低鸣：缓降 + 低通收窄
export function playLose() {
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(900, t0);
  lp.frequency.exponentialRampToValueAtTime(240, t0 + 0.8);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(0.12, t0 + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.85);
  lp.connect(g).connect(master);
  for (const det of [0, 7]) {
    const osc = c.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(196 + det, t0);
    osc.frequency.exponentialRampToValueAtTime(148 + det, t0 + 0.8);
    osc.connect(lp);
    osc.start(t0);
    osc.stop(t0 + 0.9);
  }
}

// 词不在库：低哑短哼
export function playBad() {
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 420;
  const osc = c.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(185, t0);
  osc.frequency.exponentialRampToValueAtTime(140, t0 + 0.09);
  const g = c.createGain();
  env(g, 0.14, 0.004, 0.1);
  osc.connect(lp).connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + 0.13);
}

// 对抗轮换轻点
export function playTurn() {
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 520;
  const g = c.createGain();
  env(g, 0.07, 0.003, 0.05);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + 0.08);
}

// 面板/按钮软点
export function playUi() {
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 780;
  const g = c.createGain();
  env(g, 0.045, 0.002, 0.04);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + 0.06);
}

export function setMuted(v) {
  muted = v === true;
  return muted;
}
export function isMuted() {
  return muted;
}
