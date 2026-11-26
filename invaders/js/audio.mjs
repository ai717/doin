// Procedural WebAudio kit for Starport Siege. Every cue is synthesised from
// oscillators and noise buffers - no audio files, no beep-only cues.
let ctx = null;
let master = null;
let muted = false;
let noise = null;

const AUDIO_MIN_INTERVAL = 0.05;
const lastPlayed = new Map();

function ensureContext() {
  if (ctx) return ctx;
  const Ctor = typeof globalThis.AudioContext !== "undefined" ? globalThis.AudioContext : null;
  const Legacy = typeof globalThis.webkitAudioContext !== "undefined" ? globalThis.webkitAudioContext : null;
  const Impl = Ctor ?? Legacy;
  if (!Impl) return null;
  try {
    ctx = new Impl();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

export function initAudioOnGesture() {
  const context = ensureContext();
  if (context && context.state === "suspended" && context.resume) {
    try {
      context.resume();
    } catch {
      // autoplay policy: stay silent until the next gesture
    }
  }
  return Boolean(context);
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = Boolean(value);
  return muted;
}

export function toggleMuted() {
  muted = !muted;
  return muted;
}

function noiseBuffer(context) {
  if (noise) return noise;
  const length = Math.floor(context.sampleRate * 1.2);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = 0.72 * last + 0.28 * white; // pinkish noise, less harsh than white
    data[i] = last * 1.4;
  }
  noise = buffer;
  return buffer;
}

function noiseSource(context, playbackRate = 1) {
  const source = context.createBufferSource();
  source.buffer = noiseBuffer(context);
  source.playbackRate.value = playbackRate;
  source.loop = true;
  return source;
}

function envelope(context, peak, attack, decay, at) {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  return gain;
}

function tone(context, { type = "sine", freq, freqTo, at = 0, attack = 0.005, decay = 0.2, peak = 0.3, detune = 0, filter = null }) {
  const osc = context.createOscillator();
  osc.type = type;
  osc.detune.value = detune;
  const start = context.currentTime + at;
  osc.frequency.setValueAtTime(freq, start);
  if (typeof freqTo === "number") {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqTo), start + attack + decay);
  }
  let node = osc;
  if (filter) {
    const biquad = context.createBiquadFilter();
    biquad.type = filter.type ?? "lowpass";
    biquad.frequency.setValueAtTime(filter.freq, start);
    if (typeof filter.freqTo === "number") {
      biquad.frequency.exponentialRampToValueAtTime(Math.max(40, filter.freqTo), start + attack + decay);
    }
    biquad.Q.value = filter.q ?? 1;
    node.connect(biquad);
    node = biquad;
  }
  const gain = envelope(context, peak, attack, decay, start);
  node.connect(gain);
  gain.connect(master);
  osc.start(start);
  osc.stop(start + attack + decay + 0.05);
  return osc;
}

function burst(context, { at = 0, attack = 0.003, decay = 0.15, peak = 0.25, filter = {}, rate = 1 }) {
  const source = noiseSource(context, rate);
  const biquad = context.createBiquadFilter();
  const start = context.currentTime + at;
  biquad.type = filter.type ?? "bandpass";
  biquad.frequency.setValueAtTime(filter.freq ?? 2000, start);
  if (typeof filter.freqTo === "number") {
    biquad.frequency.exponentialRampToValueAtTime(Math.max(40, filter.freqTo), start + attack + decay);
  }
  biquad.Q.value = filter.q ?? 1;
  const gain = envelope(context, peak, attack, decay, start);
  source.connect(biquad);
  biquad.connect(gain);
  gain.connect(master);
  source.start(start);
  source.stop(start + attack + decay + 0.05);
}

function distortionCurve(amount = 40) {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + amount) * x * 20 * Math.PI) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

function throttled(name, now) {
  const prev = lastPlayed.get(name) ?? -1;
  if (now - prev < AUDIO_MIN_INTERVAL) return false;
  lastPlayed.set(name, now);
  return true;
}

const CUES = {
  // Formation heartbeat: tempo is driven by the caller (march interval).
  march(context, opts = {}) {
    const interval = Math.max(0.1, Math.min(0.95, opts.interval ?? 0.9));
    const speed = 1 - (interval - 0.1) / 0.85;
    const freq = 86 + speed * 46;
    tone(context, { type: "sawtooth", freq, freqTo: freq * 0.72, attack: 0.004, decay: 0.16, peak: 0.22, filter: { type: "lowpass", freq: 520, freqTo: 220, q: 6 } });
    tone(context, { type: "sawtooth", freq, detune: 9, freqTo: freq * 0.72, attack: 0.004, decay: 0.16, peak: 0.16, filter: { type: "lowpass", freq: 520, freqTo: 220, q: 6 } });
    tone(context, { type: "sine", freq: 52, freqTo: 42, attack: 0.006, decay: 0.22, peak: 0.3 });
  },
  shot(context) {
    burst(context, { decay: 0.09, peak: 0.16, filter: { type: "bandpass", freq: 3200, freqTo: 900, q: 3 } });
    tone(context, { type: "sine", freq: 780, freqTo: 1380, attack: 0.004, decay: 0.1, peak: 0.16 });
  },
  rail(context) {
    tone(context, { type: "triangle", freq: 130, freqTo: 900, attack: 0.02, decay: 0.5, peak: 0.22, filter: { type: "lowpass", freq: 2400, q: 2 } });
    tone(context, { type: "sine", freq: 62, freqTo: 40, attack: 0.004, decay: 0.45, peak: 0.36 });
    burst(context, { at: 0.02, decay: 0.3, peak: 0.12, filter: { type: "highpass", freq: 1800, q: 1 } });
  },
  hit(context) {
    burst(context, { decay: 0.12, peak: 0.2, filter: { type: "bandpass", freq: 2600, q: 6 } });
    tone(context, { type: "sine", freq: 1650, freqTo: 1200, attack: 0.002, decay: 0.09, peak: 0.1 });
  },
  headon(context) {
    const shaper = context.createWaveShaper();
    shaper.curve = distortionCurve(60);
    shaper.connect(master);
    const saw = context.createOscillator();
    saw.type = "sawtooth";
    saw.frequency.setValueAtTime(240, context.currentTime);
    saw.frequency.exponentialRampToValueAtTime(90, context.currentTime + 0.24);
    const gain = envelope(context, 0.34, 0.004, 0.26, context.currentTime);
    saw.connect(gain);
    gain.connect(shaper);
    saw.start(context.currentTime);
    saw.stop(context.currentTime + 0.35);
    const saw2 = context.createOscillator();
    saw2.type = "sawtooth";
    saw2.detune.value = 14;
    saw2.frequency.setValueAtTime(238, context.currentTime);
    saw2.frequency.exponentialRampToValueAtTime(88, context.currentTime + 0.24);
    const gain2 = envelope(context, 0.22, 0.004, 0.26, context.currentTime);
    saw2.connect(gain2);
    gain2.connect(shaper);
    saw2.start(context.currentTime);
    saw2.stop(context.currentTime + 0.35);
    tone(context, { type: "sine", freq: 60, freqTo: 38, attack: 0.004, decay: 0.3, peak: 0.4 });
    burst(context, { decay: 0.22, peak: 0.16, filter: { type: "highpass", freq: 1200, q: 1 } });
  },
  dive(context) {
    tone(context, { type: "sawtooth", freq: 720, freqTo: 180, attack: 0.02, decay: 0.85, peak: 0.16, filter: { type: "lowpass", freq: 2200, freqTo: 500, q: 4 } });
    burst(context, { decay: 0.9, peak: 0.1, filter: { type: "lowpass", freq: 900, freqTo: 300, q: 1 }, rate: 0.8 });
  },
  dash(context) {
    burst(context, { decay: 0.28, peak: 0.14, filter: { type: "bandpass", freq: 1400, freqTo: 2600, q: 2 } });
  },
  mship(context) {
    const osc = context.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 224;
    const lfo = context.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 6;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 0.4;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.6);
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    osc.connect(gain);
    gain.connect(master);
    osc.start(context.currentTime);
    lfo.start(context.currentTime);
    osc.stop(context.currentTime + 1.7);
    lfo.stop(context.currentTime + 1.7);
  },
  chip(context) {
    burst(context, { decay: 0.14, peak: 0.14, filter: { type: "lowpass", freq: 700, q: 1 } });
    tone(context, { type: "sine", freq: 96, freqTo: 70, attack: 0.003, decay: 0.12, peak: 0.14 });
  },
  crash(context) {
    burst(context, { decay: 0.34, peak: 0.24, filter: { type: "lowpass", freq: 1400, freqTo: 240, q: 1 } });
    tone(context, { type: "sawtooth", freq: 150, freqTo: 60, attack: 0.004, decay: 0.3, peak: 0.2, filter: { type: "lowpass", freq: 900, q: 2 } });
  },
  overheat(context) {
    burst(context, { decay: 0.65, peak: 0.2, filter: { type: "lowpass", freq: 6000, freqTo: 700, q: 1 }, rate: 1.2 });
    tone(context, { type: "square", freq: 880, attack: 0.004, decay: 0.08, peak: 0.1 });
    tone(context, { type: "square", freq: 880, at: 0.16, attack: 0.004, decay: 0.08, peak: 0.1 });
  },
  cooled(context) {
    tone(context, { type: "sine", freq: 420, freqTo: 700, attack: 0.01, decay: 0.16, peak: 0.1 });
  },
  hull(context) {
    tone(context, { type: "sawtooth", freq: 320, freqTo: 285, attack: 0.01, decay: 0.34, peak: 0.24, filter: { type: "lowpass", freq: 1600, q: 2 } });
    tone(context, { type: "sine", freq: 70, freqTo: 48, attack: 0.006, decay: 0.4, peak: 0.3 });
  },
  blocked(context) {
    tone(context, { type: "triangle", freq: 620, freqTo: 940, attack: 0.004, decay: 0.22, peak: 0.16 });
    burst(context, { decay: 0.18, peak: 0.1, filter: { type: "highpass", freq: 2200, q: 1 } });
  },
  mod(context) {
    tone(context, { type: "sine", freq: 660, freqTo: 990, attack: 0.01, decay: 0.3, peak: 0.16 });
    tone(context, { type: "sine", freq: 990, at: 0.08, attack: 0.01, decay: 0.3, peak: 0.12 });
  },
  wave(context) {
    tone(context, { type: "triangle", freq: 300, freqTo: 450, attack: 0.02, decay: 0.35, peak: 0.14 });
  },
  win(context) {
    const notes = [392, 440, 523, 587, 784];
    notes.forEach((freq, index) => {
      tone(context, { type: "sine", freq, at: index * 0.11, attack: 0.01, decay: 0.32, peak: 0.2 });
      tone(context, { type: "sine", freq: freq * 2, at: index * 0.11, attack: 0.01, decay: 0.2, peak: 0.06 });
    });
    tone(context, { type: "sawtooth", freq: 220, at: 0.5, attack: 0.08, decay: 0.9, peak: 0.14, filter: { type: "lowpass", freq: 1200, q: 1 } });
  },
  lose(context) {
    const notes = [392, 330, 262, 196];
    notes.forEach((freq, index) => {
      tone(context, { type: "sawtooth", freq, at: index * 0.16, attack: 0.02, decay: 0.42, peak: 0.18, filter: { type: "lowpass", freq: 1100, q: 1 } });
    });
    tone(context, { type: "sine", freq: 90, freqTo: 40, at: 0.5, attack: 0.05, decay: 0.9, peak: 0.3 });
  },
};

export function play(name, opts = {}) {
  if (muted) return false;
  const context = ensureContext();
  if (!context || !master) return false;
  const cue = CUES[name];
  if (!cue) return false;
  const now = context.currentTime;
  if (!opts.force && !throttled(name, now)) return false;
  try {
    cue(context, opts);
    return true;
  } catch {
    return false;
  }
}

export const CUE_NAMES = Object.keys(CUES);
