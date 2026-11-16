// audio.mjs —— WebAudio 程序化合成音效（零外部音频文件）：FM 木琴蜜滴、噪声滤波蜜流、
// 失谐双振荡器蜂王浆金标大七和弦。静音或不支持时静默降级。

let ctx = null;
let master = null;
let muted = false;
let broken = false;

function ensure() {
  if (broken) return null;
  if (ctx) return ctx;
  try {
    const AC = typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;
    if (!AC) { broken = true; return null; }
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.3;
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
  try { if (c.state === "suspended") c.resume(); } catch { /* ignore */ }
}

export function setMuted(value) {
  muted = value === true;
  if (master) master.gain.value = muted ? 0 : 0.3;
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

function tone({ freq = 440, type = "sine", dur = 0.2, peak = 0.4, sweep = 0 } = {}) {
  const c = ensure();
  if (!c || muted) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t + dur);
  envelope(osc, { attack: 0.012, hold: dur * 0.35, release: dur * 0.6, peak });
  osc.start(t);
  osc.stop(t + dur + 0.4);
}

/** FM 木琴蜜滴：温润短促的琥珀玻音 */
function fmPop({ base = 520, dur = 0.22, peak = 0.42, glide = -120 } = {}) {
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

/** 蜜蜡落位：软蜡「噗」——低频 + 短噪声瞬态 */
export function playPlace() {
  fmPop({ base: 320, dur: 0.16, peak: 0.38, glide: -80 });
  noiseBurst({ dur: 0.06, peak: 0.12, filterType: "lowpass", freq: 600 });
}

/** 蜜流消除：琥珀蜜流「咕噜」滑落，噪声 + 低频 sweep 随行数音高上行 */
export function playClear(rows = 1) {
  const base = 180 + Math.min(rows, 8) * 40;
  noiseBurst({ dur: 0.3, peak: 0.22, filterType: "lowpass", freq: base * 3, sweepTo: base });
  tone({ freq: base, type: "sine", dur: 0.28, peak: 0.18, sweep: base * 0.6 });
}

/** 蜜滴迸溅：多枚短 FM 玻音，密度随行数 */
export function playPop(rows = 1) {
  const n = Math.min(rows, 6);
  for (let i = 0; i < n; i += 1) {
    setTimeout(() => fmPop({ base: 680 + i * 90, dur: 0.14, peak: 0.3, glide: 60 }), i * 55);
  }
}

/** 连击音阶：FM 木琴五声音阶逐级上行 */
export function playCombo(combo = 1) {
  const scale = [523, 587, 659, 784, 880, 988, 1047, 1175];
  const freq = scale[Math.min(combo, scale.length - 1)];
  fmPop({ base: freq, dur: 0.18, peak: 0.32, glide: 40 });
}

/** 蜂王浆金标：失谐双振荡器下潜 + 上行琶音 + 高频暖光扫频（大七和弦） */
export function playRoyal() {
  const c = ensure();
  if (!c || muted) return;
  const t = c.currentTime;
  [0, 14].forEach((detune) => {
    const osc = c.createOscillator();
    osc.type = "sawtooth";
    osc.detune.value = detune;
    osc.frequency.setValueAtTime(196, t);
    osc.frequency.exponentialRampToValueAtTime(523, t + 0.5);
    envelope(osc, { attack: 0.01, hold: 0.1, release: 0.5, peak: 0.32 });
    osc.start(t);
    osc.stop(t + 0.9);
  });
  // 大七和弦琶音
  [523, 659, 784, 988].forEach((f, i) => {
    setTimeout(() => tone({ freq: f, type: "triangle", dur: 0.3, peak: 0.22 }), i * 90);
  });
  setTimeout(() => noiseBurst({ dur: 0.5, peak: 0.18, filterType: "highpass", freq: 2000, sweepTo: 6000 }), 120);
}

/** 蜜流狂潮触发：上扬扫频 */
export function playRush() {
  tone({ freq: 330, type: "sawtooth", dur: 0.4, peak: 0.22, sweep: 660 });
  setTimeout(() => tone({ freq: 660, type: "triangle", dur: 0.3, peak: 0.2, sweep: 440 }), 80);
}

/** 放置非法回弹：低沉短促 */
export function playReject() {
  tone({ freq: 140, type: "sawtooth", dur: 0.12, peak: 0.18 });
}

/** 蜂鸣氛围：花园蜜蜂低嗡，随连击强度升调（失谐锯齿波 + LFO） */
export function playHum() {
  tone({ freq: 110, type: "sawtooth", dur: 0.5, peak: 0.05, sweep: 20 });
}

export function playUi() {
  tone({ freq: 640, type: "square", dur: 0.05, peak: 0.1 });
}

export function playWin() {
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone({ freq: f, type: "triangle", dur: 0.25, peak: 0.25 }), i * 110));
}

export function playLose() {
  [392, 311, 247].forEach((f, i) => setTimeout(() => tone({ freq: f, type: "sine", dur: 0.28, peak: 0.22 }), i * 130));
}
