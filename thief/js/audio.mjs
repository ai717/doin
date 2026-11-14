// audio.mjs - programmatic heist foley. No files, no CDN.
// Rubber creak and cloth whoosh come from filtered noise; the pillar clack and
// the loot sparkle are FM voices; the alarm is a detuned square buzz.

let ctx = null;
let master = null;
let enabled = true;
let lastCreak = 0;

const now = () => (ctx ? ctx.currentTime : 0);

function ensure() {
  if (ctx) return ctx;
  try {
    const Ctor = typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

export function setEnabled(on) {
  enabled = Boolean(on);
  if (master && ctx) master.gain.setTargetAtTime(enabled ? 0.55 : 0, ctx.currentTime, 0.02);
}

export function isEnabled() {
  return enabled;
}

export function unlock() {
  const c = ensure();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

function noiseBuffer(seconds) {
  const c = ensure();
  if (!c) return null;
  const frames = Math.max(1, Math.floor(c.sampleRate * seconds));
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 0x9e3779b9;
  for (let i = 0; i < frames; i += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    data[i] = (seed / 4294967296) * 2 - 1;
  }
  return buffer;
}

function noiseSource(seconds) {
  const c = ensure();
  const buffer = noiseBuffer(seconds);
  if (!c || !buffer) return null;
  const src = c.createBufferSource();
  src.buffer = buffer;
  return src;
}

function env(gain, peak, attack, decay, at = now()) {
  gain.gain.cancelScheduledValues(at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
}

function uiReady() {
  return enabled && ensure() !== null;
}

// Long rubber creak while the arm stretches.
export function stretch(intensity = 0.5) {
  if (!uiReady()) return;
  const t = now();
  if (t - lastCreak < 0.085) return;
  lastCreak = t;
  const c = ctx;
  const src = noiseSource(0.22);
  if (!src) return;
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 6;
  band.frequency.setValueAtTime(520 + intensity * 420, t);
  band.frequency.linearRampToValueAtTime(880 + intensity * 620, t + 0.18);
  const gain = c.createGain();
  env(gain, 0.05 + intensity * 0.05, 0.02, 0.16, t);
  src.connect(band).connect(gain).connect(master);
  src.start(t);
  src.stop(t + 0.22);

  const osc = c.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(120 + intensity * 60, t);
  osc.frequency.linearRampToValueAtTime(168 + intensity * 80, t + 0.16);
  const og = c.createGain();
  env(og, 0.012, 0.02, 0.14, t);
  osc.connect(og).connect(master);
  osc.start(t);
  osc.stop(t + 0.18);
}

// The cord hooks a pillar: tight FM clack.
export function anchor() {
  if (!uiReady()) return;
  const t = now();
  const c = ctx;
  const carrier = c.createOscillator();
  const mod = c.createOscillator();
  const modGain = c.createGain();
  carrier.type = "triangle";
  mod.type = "square";
  carrier.frequency.setValueAtTime(880, t);
  carrier.frequency.exponentialRampToValueAtTime(560, t + 0.09);
  mod.frequency.value = 1720;
  modGain.gain.setValueAtTime(420, t);
  modGain.gain.exponentialRampToValueAtTime(20, t + 0.09);
  mod.connect(modGain).connect(carrier.frequency);
  const gain = c.createGain();
  env(gain, 0.14, 0.004, 0.1, t);
  carrier.connect(gain).connect(master);
  carrier.start(t);
  mod.start(t);
  carrier.stop(t + 0.12);
  mod.stop(t + 0.12);

  const src = noiseSource(0.06);
  if (!src) return;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 2600;
  const ng = c.createGain();
  env(ng, 0.07, 0.002, 0.05, t);
  src.connect(hp).connect(ng).connect(master);
  src.start(t);
  src.stop(t + 0.06);
}

// Slip off a pillar.
export function slip() {
  if (!uiReady()) return;
  const t = now();
  const c = ctx;
  const src = noiseSource(0.12);
  if (!src) return;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 3;
  bp.frequency.setValueAtTime(1500, t);
  bp.frequency.exponentialRampToValueAtTime(420, t + 0.1);
  const gain = c.createGain();
  env(gain, 0.05, 0.004, 0.1, t);
  src.connect(bp).connect(gain).connect(master);
  src.start(t);
  src.stop(t + 0.12);
}

// Loot grabbed: cloth whoosh plus a bright sparkle.
export function grab() {
  if (!uiReady()) return;
  const t = now();
  const c = ctx;
  const src = noiseSource(0.34);
  if (src) {
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(2400, t);
    bp.frequency.exponentialRampToValueAtTime(520, t + 0.3);
    const gain = c.createGain();
    env(gain, 0.16, 0.01, 0.3, t);
    src.connect(bp).connect(gain).connect(master);
    src.start(t);
    src.stop(t + 0.34);
  }
  [880, 1320, 1760].forEach((freq, index) => {
    const osc = c.createOscillator();
    osc.type = "sine";
    const at = t + 0.04 + index * 0.05;
    osc.frequency.setValueAtTime(freq, at);
    const gain = c.createGain();
    env(gain, 0.07, 0.006, 0.26, at);
    osc.connect(gain).connect(master);
    osc.start(at);
    osc.stop(at + 0.3);
  });
}

// Success whistle: two-note slide plus a coin bell.
export function win() {
  if (!uiReady()) return;
  const t = now();
  const c = ctx;
  const whistle = c.createOscillator();
  const vib = c.createOscillator();
  const vibGain = c.createGain();
  whistle.type = "sine";
  vib.type = "sine";
  vib.frequency.value = 6.5;
  vibGain.gain.value = 12;
  vib.connect(vibGain).connect(whistle.frequency);
  whistle.frequency.setValueAtTime(760, t);
  whistle.frequency.linearRampToValueAtTime(1040, t + 0.16);
  whistle.frequency.linearRampToValueAtTime(880, t + 0.42);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.11, t + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);
  whistle.connect(gain).connect(master);
  whistle.start(t);
  vib.start(t);
  whistle.stop(t + 0.64);
  vib.stop(t + 0.64);

  [1046, 1568].forEach((freq, i) => {
    const bell = c.createOscillator();
    const mod = c.createOscillator();
    const modGain = c.createGain();
    const at = t + 0.18 + i * 0.12;
    bell.type = "sine";
    mod.type = "sine";
    bell.frequency.value = freq;
    mod.frequency.value = freq * 2.01;
    modGain.gain.setValueAtTime(freq * 0.4, at);
    modGain.gain.exponentialRampToValueAtTime(1, at + 0.4);
    mod.connect(modGain).connect(bell.frequency);
    const g = c.createGain();
    env(g, 0.05, 0.006, 0.5, at);
    bell.connect(g).connect(master);
    bell.start(at);
    mod.start(at);
    bell.stop(at + 0.56);
    mod.stop(at + 0.56);
  });
}

// Getting caught: mains buzz and a descending groan.
export function shock() {
  if (!uiReady()) return;
  const t = now();
  const c = ctx;
  for (const freq of [58, 61.5, 122]) {
    const osc = c.createOscillator();
    osc.type = "square";
    osc.frequency.value = freq;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.055, t + 0.01);
    gain.gain.setValueAtTime(0.055, t + 0.34);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + 0.52);
  }
  const src = noiseSource(0.5);
  if (!src) return;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.setValueAtTime(3200, t);
  hp.frequency.exponentialRampToValueAtTime(900, t + 0.45);
  const gain = c.createGain();
  env(gain, 0.09, 0.005, 0.45, t);
  src.connect(hp).connect(gain).connect(master);
  src.start(t);
  src.stop(t + 0.5);
}

// Hound wakes up.
export function bark() {
  if (!uiReady()) return;
  const t = now();
  const c = ctx;
  for (let i = 0; i < 2; i += 1) {
    const at = t + i * 0.14;
    const src = noiseSource(0.14);
    if (!src) return;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.6;
    bp.frequency.setValueAtTime(700, at);
    bp.frequency.exponentialRampToValueAtTime(240, at + 0.12);
    const gain = c.createGain();
    env(gain, 0.16, 0.01, 0.12, at);
    src.connect(bp).connect(gain).connect(master);
    src.start(at);
    src.stop(at + 0.14);
  }
}

export function click() {
  if (!uiReady()) return;
  const t = now();
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(1400, t);
  osc.frequency.exponentialRampToValueAtTime(700, t + 0.04);
  const gain = ctx.createGain();
  env(gain, 0.05, 0.003, 0.05, t);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + 0.07);
}

export function lever() {
  if (!uiReady()) return;
  const t = now();
  const c = ctx;
  const osc = c.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(300, t);
  osc.frequency.exponentialRampToValueAtTime(150, t + 0.12);
  const gain = c.createGain();
  env(gain, 0.07, 0.004, 0.14, t);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + 0.16);
  const src = noiseSource(0.1);
  if (!src) return;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1900;
  const ng = c.createGain();
  env(ng, 0.06, 0.003, 0.08, t);
  src.connect(bp).connect(ng).connect(master);
  src.start(t);
  src.stop(t + 0.1);
}
