// audio.mjs - procedural WebAudio for a miniature servo workbench.
// No audio files, no external deps. Timbre: servo whirs (saw + band-pass
// noise), magnetic tile clicks, glass lamp chimes and a soft crate thud.
// Star chimes walk a pentatonic scale so a perfect clear sounds like one
// rising phrase instead of a single flat ding.

let ctx = null;
let master = null;
let muted = false;

const PENTATONIC = [587.33, 659.25, 783.99, 880.0, 1046.5];

// Frequency of the nth reward chime. Clamped to two octaves so a long run
// stays musical instead of turning into a whistle.
export function chimePitch(index) {
  const i = Math.max(0, Math.floor(Number(index) || 0));
  const octave = Math.min(2, Math.floor(i / PENTATONIC.length));
  return PENTATONIC[i % PENTATONIC.length] * 2 ** octave;
}

export function setMuted(value) {
  muted = Boolean(value);
}

export function isMuted() {
  return muted;
}

// Test-only: drop the cached context so a stub AudioContext can be injected.
export function resetAudioForTests() {
  ctx = null;
  master = null;
}

function audio() {
  if (ctx) return ctx;
  try {
    const Ctor = typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.4;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
    master = null;
  }
  return ctx;
}

function ready() {
  const c = audio();
  if (!c || muted) return null;
  if (c.state === "suspended" && typeof c.resume === "function") c.resume();
  return c;
}

function noiseBuffer(c, seconds) {
  const length = Math.max(1, Math.floor(c.sampleRate * seconds));
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 0x6d2b79f5;
  for (let i = 0; i < length; i += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    data[i] = (seed / 0xffffffff) * 2 - 1;
  }
  return buffer;
}

function noise(c, { duration, freq, q, gain, type = "bandpass" }) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, duration);
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const amp = c.createGain();
  const now = c.currentTime;
  amp.gain.setValueAtTime(gain, now);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  src.connect(filter).connect(amp).connect(master);
  src.start(now);
  src.stop(now + duration);
}

function tone(c, { freq, endFreq, type = "sine", duration = 0.16, gain = 0.18, delay = 0, attack = 0.005 }) {
  const osc = c.createOscillator();
  const amp = c.createGain();
  const now = c.currentTime + delay;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (endFreq && endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + duration);
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(gain, now + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(amp).connect(master);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function fm(c, { carrier, modulator, index, duration, gain, delay = 0 }) {
  const now = c.currentTime + delay;
  const car = c.createOscillator();
  const mod = c.createOscillator();
  const modGain = c.createGain();
  const amp = c.createGain();
  car.type = "sine";
  mod.type = "sine";
  car.frequency.value = carrier;
  mod.frequency.value = modulator;
  modGain.gain.value = index;
  mod.connect(modGain).connect(car.frequency);
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(gain, now + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  car.connect(amp).connect(master);
  car.start(now);
  mod.start(now);
  car.stop(now + duration + 0.02);
  mod.stop(now + duration + 0.02);
}

export const sfx = {
  // Snapping a tile into a slot: a small magnetic "tick".
  pick() {
    const c = ready();
    if (!c) return;
    noise(c, { duration: 0.045, freq: 2600, q: 1.8, gain: 0.09 });
    tone(c, { freq: 1480, endFreq: 1760, type: "triangle", duration: 0.07, gain: 0.07 });
  },

  // Taking a tile back out: the same click, falling in pitch.
  remove() {
    const c = ready();
    if (!c) return;
    noise(c, { duration: 0.05, freq: 1500, q: 1.4, gain: 0.08 });
    tone(c, { freq: 980, endFreq: 620, type: "triangle", duration: 0.09, gain: 0.07 });
  },

  // Spin-up of the servo before a run.
  run() {
    const c = ready();
    if (!c) return;
    tone(c, { freq: 120, endFreq: 420, type: "sawtooth", duration: 0.28, gain: 0.08 });
    noise(c, { duration: 0.26, freq: 900, q: 0.8, gain: 0.05, type: "bandpass" });
  },

  // One executed instruction: a short geared whir.
  step() {
    const c = ready();
    if (!c) return;
    noise(c, { duration: 0.06, freq: 1250, q: 1.6, gain: 0.06 });
    tone(c, { freq: 330, endFreq: 250, type: "square", duration: 0.07, gain: 0.045 });
  },

  // Turning in place: a ratchet with two teeth.
  turn() {
    const c = ready();
    if (!c) return;
    noise(c, { duration: 0.03, freq: 2200, q: 2.2, gain: 0.07 });
    noise(c, { duration: 0.03, freq: 1900, q: 2.2, gain: 0.05 });
    tone(c, { freq: 520, endFreq: 470, type: "triangle", duration: 0.06, gain: 0.05 });
  },

  // Leaping a step: a spring release.
  jump() {
    const c = ready();
    if (!c) return;
    tone(c, { freq: 280, endFreq: 760, type: "sine", duration: 0.18, gain: 0.11 });
    noise(c, { duration: 0.09, freq: 1200, q: 1, gain: 0.04 });
  },

  // Lighting a lamp: a warm glass chime.
  light(index = 0) {
    const c = ready();
    if (!c) return;
    const p = chimePitch(index);
    fm(c, { carrier: p, modulator: p * 2.01, index: 160, duration: 0.42, gain: 0.1 });
    tone(c, { freq: p * 2, duration: 0.16, gain: 0.035, delay: 0.01 });
  },

  // A crate sliding one cell onto a switch.
  push() {
    const c = ready();
    if (!c) return;
    noise(c, { duration: 0.16, freq: 380, q: 0.7, gain: 0.09, type: "lowpass" });
    tone(c, { freq: 165, endFreq: 96, type: "sine", duration: 0.2, gain: 0.12 });
  },

  // Blocked / loop / stack fault: a flat buzz.
  error() {
    const c = ready();
    if (!c) return;
    tone(c, { freq: 196, type: "square", duration: 0.18, gain: 0.07 });
    tone(c, { freq: 147, type: "square", duration: 0.22, gain: 0.06, delay: 0.1 });
    noise(c, { duration: 0.12, freq: 300, q: 1, gain: 0.05, type: "lowpass" });
  },

  // Stage clear fanfare.
  win() {
    const c = ready();
    if (!c) return;
    [587.33, 783.99, 987.77, 1174.66].forEach((f, i) => {
      fm(c, { carrier: f, modulator: f * 2, index: 170, duration: 0.6, gain: 0.09, delay: i * 0.1 });
    });
  },

  // One star of the result tally; the caller passes the star index.
  star(index = 0) {
    const c = ready();
    if (!c) return;
    const p = chimePitch(index);
    fm(c, { carrier: p, modulator: p * 3, index: 190, duration: 0.34, gain: 0.09 });
    tone(c, { freq: p * 1.5, duration: 0.14, gain: 0.03, delay: 0.03 });
  },
};
