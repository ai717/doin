// audio.mjs - procedural WebAudio for the rosewood / glass-marble board.
// No audio files, no external deps. Timbre: FM bell chimes + soft wood knocks
// + band-passed noise. Chain hops walk a pentatonic scale, so a long leap
// sounds like one ascending phrase instead of repeated identical pings.

let ctx = null;
let master = null;
let muted = false;

const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0];

// Frequency of the nth hop in a chain. Clamped to two octaves so an 8-hop
// leap stays musical instead of turning into a piercing whistle.
export function hopPitch(index) {
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
    master.gain.value = 0.45;
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
  let seed = 0x9e3779b9;
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

function tone(c, { freq, endFreq, type = "sine", duration = 0.18, gain = 0.2, delay = 0, attack = 0.005 }) {
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
  // Lifting a marble: a light glass "ding" with a soft water-drop tail.
  select() {
    const c = ready();
    if (!c) return;
    fm(c, { carrier: 1180, modulator: 1770, index: 220, duration: 0.16, gain: 0.1 });
    tone(c, { freq: 1560, endFreq: 2100, duration: 0.12, gain: 0.05, delay: 0.02 });
  },

  // Single adjacent step: a dry, shallow rosewood tap.
  step() {
    const c = ready();
    if (!c) return;
    noise(c, { duration: 0.07, freq: 520, q: 1.4, gain: 0.08, type: "lowpass" });
    tone(c, { freq: 210, endFreq: 130, type: "triangle", duration: 0.12, gain: 0.09 });
  },

  // One link of a chain hop. The caller passes the hop index.
  hop(index = 0) {
    const c = ready();
    if (!c) return;
    const p = hopPitch(index);
    fm(c, { carrier: p, modulator: p * 2.01, index: 150, duration: 0.19, gain: 0.1 });
    tone(c, { freq: p * 2, duration: 0.1, gain: 0.035, delay: 0.01 });
  },

  // Settling into a hole: warm, solid wooden "thud".
  land() {
    const c = ready();
    if (!c) return;
    tone(c, { freq: 175, endFreq: 92, type: "sine", duration: 0.2, gain: 0.14 });
    noise(c, { duration: 0.1, freq: 340, q: 0.9, gain: 0.07, type: "lowpass" });
  },

  undo() {
    const c = ready();
    if (!c) return;
    tone(c, { freq: 760, endFreq: 400, type: "triangle", duration: 0.15, gain: 0.09 });
  },

  blocked() {
    const c = ready();
    if (!c) return;
    noise(c, { duration: 0.09, freq: 190, q: 1.2, gain: 0.1, type: "lowpass" });
    tone(c, { freq: 110, endFreq: 74, type: "square", duration: 0.1, gain: 0.05 });
  },

  win() {
    const c = ready();
    if (!c) return;
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      fm(c, { carrier: f, modulator: f * 2, index: 190, duration: 0.75, gain: 0.1, delay: i * 0.11 });
    });
  },

  lose() {
    const c = ready();
    if (!c) return;
    tone(c, { freq: 320, endFreq: 82, type: "sawtooth", duration: 0.8, gain: 0.12 });
    noise(c, { duration: 0.5, freq: 230, q: 1, gain: 0.08, type: "lowpass" });
  },
};
