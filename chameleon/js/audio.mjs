// audio.mjs —— WebAudio 程序化合成音效（零外部音频文件）：FM 软胶啵音、滤波扫探滴声、
// 噪声波纹 sweep、失谐双振荡器抓获爆发；静音或不支持时静默降级。

let ctx = null;
let master = null;
let muted = false;
let broken = false;

function ensure() {
  if (broken) return null;
  if (ctx) return ctx;
  try {
    const AC = typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;
    if (!AC) {
      broken = true;
      return null;
    }
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
  } catch {
    broken = true;
    ctx = null;
  }
  return ctx;
}

export function unlock() {
  const c = ensure();
  if (!c) return;
  try {
    if (c.state === "suspended") c.resume();
  } catch {
    // 静默
  }
}

export function setMuted(value) {
  muted = value === true;
  if (master) master.gain.value = muted ? 0 : 0.32;
}

export function isMuted() {
  return muted;
}

function envelope(node, { attack = 0.008, hold = 0.05, release = 0.2, peak = 0.5 } = {}) {
  const c = ensure();
  if (!c) return null;
  const t = c.currentTime;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.setValueAtTime(Math.max(0.0002, peak), t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  node.connect(g);
  g.connect(master);
  return g;
}

function tone({ freq = 440, type = "sine", dur = 0.2, peak = 0.4, sweep = 0, pan = 0 } = {}) {
  const c = ensure();
  if (!c || muted) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t + dur);
  const panner = c.createStereoPanner ? c.createStereoPanner() : null;
  envelope(osc, { attack: 0.012, hold: dur * 0.35, release: dur * 0.6, peak });
  if (panner) {
    osc.disconnect();
    osc.connect(panner);
    panner.connect(master);
    panner.pan.value = Math.max(-1, Math.min(1, pan));
  }
  osc.start(t);
  osc.stop(t + dur + 0.4);
}

/** FM 软胶「啵」：调制波下潜 + 圆润包络，像水珠滴入 */
function fmPop({ base = 420, dur = 0.22, peak = 0.45, glide = -160 } = {}) {
  const c = ensure();
  if (!c || muted) return;
  const t = c.currentTime;
  const carrier = c.createOscillator();
  carrier.type = "sine";
  const mod = c.createOscillator();
  mod.type = "sine";
  const modGain = c.createGain();
  modGain.gain.value = base * 0.5;
  carrier.frequency.setValueAtTime(base, t);
  carrier.frequency.exponentialRampToValueAtTime(Math.max(60, base + glide), t + dur);
  mod.frequency.setValueAtTime(base * 0.5, t);
  mod.connect(modGain);
  modGain.connect(carrier.frequency);
  envelope(carrier, { attack: 0.006, hold: dur * 0.2, release: dur * 0.6, peak });
  carrier.start(t);
  mod.start(t);
  carrier.stop(t + dur + 0.4);
  mod.stop(t + dur + 0.4);
}

function noiseBurst({ dur = 0.12, peak = 0.25, filterType = "bandpass", freq = 800, sweepTo = 0 } = {}) {
  const c = ensure();
  if (!c || muted) return;
  const frames = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(freq, c.currentTime);
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), c.currentTime + dur);
  filter.Q.value = 0.8;
  src.connect(filter);
  envelope(filter, { attack: 0.005, hold: dur * 0.2, release: dur * 0.8, peak });
  src.start();
}

/** 变色：湿润软胶啵音（FM 调频 + 低频滑音） */
export function playRecolor() {
  fmPop({ base: 430, dur: 0.2, peak: 0.42, glide: -150 });
}

/** 精调：更贴服的温润上滑啵音 */
export function playRefine() {
  fmPop({ base: 340, dur: 0.26, peak: 0.4, glide: 90 });
}

/** 移动：轻微噪声沙沙（像树丛里挪动） */
export function playMove() {
  noiseBurst({ dur: 0.09, peak: 0.16, filterType: "highpass", freq: 1600 });
}

/** 荧光脉冲：柔和三角波 + 大七和弦底色的呼吸氛围 */
export function playPulse() {
  tone({ freq: 220, type: "triangle", dur: 0.4, peak: 0.1, sweep: 20 });
}

/** 扫探：带通短脉冲，热度越高音越亮 */
export function playScan(heat = 50) {
  const base = 560 + Math.max(0, Math.min(100, heat)) * 3.2;
  noiseBurst({ dur: 0.07, peak: 0.2, filterType: "bandpass", freq: base });
  tone({ freq: base, type: "sine", dur: 0.1, peak: 0.16, sweep: 120 });
}

/** 波纹显影：噪声缓冲 + 高通扫频，像水面涟漪粼粼 */
export function playRipple() {
  noiseBurst({ dur: 0.26, peak: 0.2, filterType: "highpass", freq: 900, sweepTo: 3200 });
}

/** 抓获：失谐双振荡器下潜 + 急促滑音 + Spark */
export function playCaught() {
  const c = ensure();
  if (!c || muted) return;
  const t = c.currentTime;
  [0, 12].forEach((detune) => {
    const osc = c.createOscillator();
    osc.type = "sawtooth";
    osc.detune.value = detune;
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(52, t + 0.32);
    envelope(osc, { attack: 0.006, hold: 0.06, release: 0.3, peak: 0.4 });
    osc.start(t);
    osc.stop(t + 0.6);
  });
  setTimeout(() => fmPop({ base: 1180, dur: 0.24, peak: 0.32, glide: -320 }), 40);
}

/** 指错：下行双音低鸣 */
export function playMiss() {
  [392, 311, 247].forEach((f, i) => setTimeout(() => tone({ freq: f, type: "sine", dur: 0.24, peak: 0.3 }), i * 110));
}

/** 幕布落下「唰」：噪声宽频 sweep 收束 */
export function playCurtain() {
  noiseBurst({ dur: 0.34, peak: 0.22, filterType: "lowpass", freq: 2600, sweepTo: 220 });
}

export function playUi() {
  tone({ freq: 640, type: "square", dur: 0.05, peak: 0.12 });
}

export function playReject() {
  tone({ freq: 150, type: "sawtooth", dur: 0.1, peak: 0.18 });
}