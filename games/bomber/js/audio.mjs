// Bomber - procedural WebAudio. Material synthesis only: noise filtering, FM, detuned pairs.
// Every entry degrades silently when AudioContext is missing or muted.
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];

let ctx = null;
let master = null;
let muted = false;
let noise = null;

export function initAudioOnGesture() {
  if (ctx) return ctx;
  try {
    const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    noise = buildNoise(ctx, 1.2);
  } catch {
    ctx = null;
  }
  return ctx;
}

function buildNoise(context, seconds) {
  const length = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02; // a touch of brown weight
    data[i] = white * 0.7 + last * 1.6;
  }
  return buffer;
}

export function setMuted(value) {
  muted = Boolean(value);
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

export function toggleMuted() {
  return setMuted(!muted);
}

export function isMuted() {
  return muted;
}

function safePlay(fn) {
  if (muted) return;
  if (!ctx) initAudioOnGesture();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume();
    fn(ctx);
  } catch {
    /* never break gameplay on audio */
  }
}

function envGain(context, start, peak, attack, decay) {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(peak, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
  return gain;
}

function noiseSource(context, start, duration) {
  const src = context.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  src.start(start);
  src.stop(start + duration);
  return src;
}

function playPlace() {
  safePlay((context) => {
    const now = context.currentTime;
    const osc = context.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(58, now + 0.16);
    const gain = envGain(context, now, 0.5, 0.005, 0.16);
    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + 0.2);

    const src = noiseSource(context, now, 0.12);
    const lp = context.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 480;
    const ngain = envGain(context, now, 0.25, 0.004, 0.1);
    src.connect(lp).connect(ngain).connect(master);
  });
}

function playExplode() {
  safePlay((context) => {
    const now = context.currentTime;
    const src = noiseSource(context, now, 0.7);
    const lp = context.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(4200, now);
    lp.frequency.exponentialRampToValueAtTime(200, now + 0.55);
    const gain = envGain(context, now, 0.55, 0.006, 0.6);
    src.connect(lp).connect(gain).connect(master);

    // echo tail keeps the boom from sounding like a click
    const delay = context.createDelay(0.5);
    delay.delayTime.value = 0.16;
    const fb = context.createGain();
    fb.gain.value = 0.32;
    const wet = context.createGain();
    wet.gain.value = 0.3;
    gain.connect(delay).connect(fb).connect(delay);
    delay.connect(wet).connect(master);

    for (const [freq, detune] of [
      [92, -8],
      [96, 9],
    ]) {
      const osc = context.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq * 2.2, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.6, now + 0.4);
      osc.detune.value = detune;
      const og = envGain(context, now, 0.32, 0.008, 0.42);
      const sub = context.createBiquadFilter();
      sub.type = "lowpass";
      sub.frequency.value = 320;
      osc.connect(sub).connect(og).connect(master);
      osc.start(now);
      osc.stop(now + 0.5);
    }
  });
}

function playBrick() {
  safePlay((context) => {
    const now = context.currentTime;
    const src = noiseSource(context, now, 0.18);
    const bp = context.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2600;
    bp.Q.value = 1.4;
    const gain = envGain(context, now, 0.3, 0.003, 0.15);
    src.connect(bp).connect(gain).connect(master);
    for (let i = 0; i < 3; i++) {
      const at = now + 0.02 + i * 0.035;
      const click = context.createOscillator();
      click.type = "triangle";
      click.frequency.setValueAtTime(1800 + i * 420, at);
      const cg = envGain(context, at, 0.12, 0.002, 0.03);
      click.connect(cg).connect(master);
      click.start(at);
      click.stop(at + 0.06);
    }
  });
}

function fmNote(context, start, freq, ratio, index, peak, decay) {
  const carrier = context.createOscillator();
  carrier.type = "sine";
  carrier.frequency.value = freq;
  const mod = context.createOscillator();
  mod.type = "sine";
  mod.frequency.value = freq * ratio;
  const modGain = context.createGain();
  modGain.gain.setValueAtTime(freq * index, start);
  modGain.gain.exponentialRampToValueAtTime(freq * 0.2, start + decay);
  mod.connect(modGain).connect(carrier.frequency);
  const gain = envGain(context, start, peak, 0.006, decay);
  carrier.connect(gain).connect(master);
  carrier.start(start);
  carrier.stop(start + decay + 0.05);
  mod.start(start);
  mod.stop(start + decay + 0.05);
}

const PICKUP_NOTES = {
  fire: [523, 659],
  bomb: [392, 784],
  speed: [587, 698],
  kick: [440, 554],
  remote: [659, 880],
  pierce: [494, 740],
  shield: [349, 523],
  curse: [300, 220],
};

function playPickup(kind = "fire") {
  safePlay((context) => {
    const now = context.currentTime;
    const notes = PICKUP_NOTES[kind] ?? PICKUP_NOTES.fire;
    notes.forEach((freq, i) => fmNote(context, now + i * 0.09, freq, 3.01, 1.6, 0.3, 0.28));
  });
}

function playKill(chainIndex = 0) {
  safePlay((context) => {
    const now = context.currentTime;
    const step = PENTATONIC[Math.min(PENTATONIC.length - 1, chainIndex)] ?? 0;
    const base = 420 * Math.pow(2, step / 12);
    for (const detune of [-12, 11]) {
      const osc = context.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(base * 1.6, now);
      osc.frequency.exponentialRampToValueAtTime(base * 0.7, now + 0.16);
      osc.detune.value = detune;
      const gain = envGain(context, now, 0.2, 0.004, 0.17);
      const lp = context.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2400;
      osc.connect(lp).connect(gain).connect(master);
      osc.start(now);
      osc.stop(now + 0.22);
    }
    const src = noiseSource(context, now, 0.09);
    const bp = context.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1200;
    const ng = envGain(context, now, 0.18, 0.002, 0.07);
    src.connect(bp).connect(ng).connect(master);
  });
}

function playDeath() {
  safePlay((context) => {
    const now = context.currentTime;
    const osc = context.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.7);
    const gain = envGain(context, now, 0.3, 0.01, 0.7);
    const lp = context.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(2200, now);
    lp.frequency.exponentialRampToValueAtTime(300, now + 0.6);
    osc.connect(lp).connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + 0.8);
    const src = noiseSource(context, now, 0.5);
    const ng = envGain(context, now, 0.2, 0.005, 0.45);
    src.connect(ng).connect(master);
  });
}

function playWin() {
  safePlay((context) => {
    const now = context.currentTime;
    [523, 659, 784, 1047].forEach((freq, i) => fmNote(context, now + i * 0.11, freq, 2.0, 1.2, 0.26, 0.34));
    const src = noiseSource(context, now + 0.2, 0.5);
    const hp = context.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 3800;
    const ng = envGain(context, now + 0.2, 0.12, 0.05, 0.4);
    src.connect(hp).connect(ng).connect(master);
  });
}

function playClick() {
  safePlay((context) => {
    const now = context.currentTime;
    const osc = context.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(660, now);
    const gain = envGain(context, now, 0.14, 0.002, 0.05);
    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + 0.08);
  });
}

function playCurse() {
  safePlay((context) => {
    const now = context.currentTime;
    for (const [freq, detune] of [
      [220, -30],
      [233, 28],
    ]) {
      const osc = context.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.linearRampToValueAtTime(freq * 0.75, now + 0.5);
      osc.detune.value = detune;
      const gain = envGain(context, now, 0.18, 0.02, 0.5);
      osc.connect(gain).connect(master);
      osc.start(now);
      osc.stop(now + 0.6);
    }
  });
}

function playFuse() {
  safePlay((context) => {
    const now = context.currentTime;
    const src = noiseSource(context, now, 0.2);
    const bp = context.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(2600, now);
    bp.frequency.exponentialRampToValueAtTime(5200, now + 0.18);
    bp.Q.value = 6;
    const gain = envGain(context, now, 0.1, 0.01, 0.18);
    src.connect(bp).connect(gain).connect(master);
  });
}

const ROUTES = {
  place: playPlace,
  explode: playExplode,
  brick: playBrick,
  kill: playKill,
  death: playDeath,
  win: playWin,
  click: playClick,
  curse: playCurse,
  fuse: playFuse,
};

export function play(name, arg) {
  if (name === "pickup") {
    playPickup(arg);
    return;
  }
  const fn = ROUTES[name];
  if (fn) fn(arg);
}
