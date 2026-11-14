// Tank Assault - procedural WebAudio.
// Material synthesis only: filtered noise, FM, detuned pairs, LFO sirens. No sample files,
// no bare beeps. Every entry degrades silently when AudioContext is missing or muted.

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
    master.gain.value = 0.45;
    master.connect(ctx.destination);
    noise = buildNoise(ctx, 1.4);
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
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02; // a touch of brown weight
    data[i] = white * 0.7 + last * 1.4;
  }
  return buffer;
}

export function setMuted(value) {
  muted = Boolean(value);
  if (master) master.gain.value = muted ? 0 : 0.45;
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

// A two-operator FM voice. ratio 1 : 1.41 is deliberately inharmonic: it is what makes
// struck steel sound like steel instead of a bell.
function fmVoice(context, start, carrier, ratio, index, peak, attack, decay) {
  const car = context.createOscillator();
  car.type = "sine";
  car.frequency.setValueAtTime(carrier, start);
  const mod = context.createOscillator();
  mod.type = "sine";
  mod.frequency.setValueAtTime(carrier * ratio, start);
  const modGain = context.createGain();
  modGain.gain.setValueAtTime(carrier * index, start);
  modGain.gain.exponentialRampToValueAtTime(0.5, start + attack + decay);
  const gain = envGain(context, start, peak, attack, decay);
  mod.connect(modGain).connect(car.frequency);
  car.connect(gain).connect(master);
  mod.start(start);
  mod.stop(start + attack + decay + 0.05);
  car.start(start);
  car.stop(start + attack + decay + 0.05);
  return car;
}

function tone(context, start, type, freq, peak, attack, decay, endFreq) {
  const osc = context.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + attack + decay);
  const gain = envGain(context, start, peak, attack, decay);
  osc.connect(gain).connect(master);
  osc.start(start);
  osc.stop(start + attack + decay + 0.05);
  return osc;
}

/* ------------------------------------------------------------------ 1. cannon */

function playFire(star = 1) {
  safePlay((context) => {
    const now = context.currentTime;
    // low noise blast = muzzle blast
    const src = noiseSource(context, now, 0.3);
    const bp = context.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(760, now);
    bp.frequency.exponentialRampToValueAtTime(240, now + 0.22);
    bp.Q.value = 1.6;
    const ng = envGain(context, now, 0.5, 0.004, 0.24);
    src.connect(bp).connect(ng).connect(master);

    // downward triangle = the shell leaving the barrel
    tone(context, now, "triangle", 260 + star * 18, 0.34, 0.005, 0.2, 70);

    // metal cavity ring of the turret
    fmVoice(context, now + 0.006, 404, 2.71, 0.9, 0.16, 0.004, 0.22);
  });
}

/* -------------------------------------------------------------- 2. brick chip */

function playBrick() {
  safePlay((context) => {
    const now = context.currentTime;
    const src = noiseSource(context, now, 0.16);
    const hp = context.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(1900, now);
    hp.frequency.exponentialRampToValueAtTime(700, now + 0.14);
    const ng = envGain(context, now, 0.34, 0.003, 0.13);
    src.connect(hp).connect(ng).connect(master);

    // three randomised terracotta shards
    for (let i = 0; i < 3; i += 1) {
      const f = 900 + Math.random() * 1500;
      fmVoice(context, now + i * 0.012, f, 3.13, 0.5, 0.09, 0.003, 0.09);
    }
  });
}

/* ---------------------------------------------- 3. ricochet (the signature cue) */

function playRicochet() {
  safePlay((context) => {
    const now = context.currentTime;
    // a hard metallic strike ...
    fmVoice(context, now, 1180, 1.41, 2.4, 0.3, 0.003, 0.34);
    fmVoice(context, now, 1760, 1.41, 1.6, 0.14, 0.003, 0.26);

    // ... then the shell screaming away: high Q bandpass sweeping down
    const src = noiseSource(context, now, 0.42);
    const bp = context.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(4200, now);
    bp.frequency.exponentialRampToValueAtTime(620, now + 0.36);
    bp.Q.value = 14;
    const ng = envGain(context, now, 0.34, 0.01, 0.36);
    src.connect(bp).connect(ng).connect(master);

    // a short glide so the deflection reads as motion, not a blip
    tone(context, now + 0.02, "sawtooth", 1500, 0.07, 0.01, 0.3, 420);
  });
}

/* ----------------------------------------------------------------- 4. explode */

function playExplode(armored = false) {
  safePlay((context) => {
    const now = context.currentTime;
    const src = noiseSource(context, now, 0.8);
    const lp = context.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(3600, now);
    lp.frequency.exponentialRampToValueAtTime(180, now + 0.6);
    const ng = envGain(context, now, 0.52, 0.006, 0.62);
    src.connect(lp).connect(ng).connect(master);

    tone(context, now, "sine", 120, 0.4, 0.008, 0.5, 40);

    // debris crackle a beat later
    const src2 = noiseSource(context, now + 0.2, 0.3);
    const hp2 = context.createBiquadFilter();
    hp2.type = "highpass";
    hp2.frequency.value = 2300;
    const ng2 = envGain(context, now + 0.2, 0.16, 0.004, 0.26);
    src2.connect(hp2).connect(ng2).connect(master);

    // heavy tanks leave a sinking tail
    if (armored) tone(context, now + 0.26, "triangle", 180, 0.2, 0.02, 0.6, 48);
  });
}

/* ------------------------------------------------------------------ 5. pickup */

function playPickup(kind = "star") {
  safePlay((context) => {
    const now = context.currentTime;
    const base = kind === "extra_life" ? 392 : kind === "clock" ? 349.2 : 523.25;
    const steps = kind === "grenade" ? [0, 4, 7] : [0, 4, 9];
    steps.forEach((semi, i) => {
      const f = base * Math.pow(2, semi / 12);
      fmVoice(context, now + i * 0.07, f, 1, 0.6, 0.22, 0.006, 0.3);
    });
    // levelling up stacks a clean fifth on top
    if (kind === "star") fmVoice(context, now + 0.2, base * 1.5, 1, 0.4, 0.18, 0.008, 0.4);
  });
}

/* ------------------------------------------------------------- 6. HQ siren * */

function playAlarm() {
  safePlay((context) => {
    const now = context.currentTime;
    for (let i = 0; i < 2; i += 1) {
      const start = now + i * 0.34;
      const osc = context.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(220, start);
      osc.frequency.exponentialRampToValueAtTime(150, start + 0.3);

      // 6 Hz tremolo makes it a siren rather than a buzz
      const lfo = context.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 6;
      const lfoGain = context.createGain();
      lfoGain.gain.value = 0.4;
      const gate = context.createGain();
      gate.gain.value = 0.6;
      lfo.connect(lfoGain).connect(gate.gain);

      const gain = envGain(context, start, 0.22, 0.01, 0.3);
      osc.connect(gate).connect(gain).connect(master);
      lfo.start(start);
      lfo.stop(start + 0.36);
      osc.start(start);
      osc.stop(start + 0.36);
    }
  });
}

/* ------------------------------------------------------- 7. orders + telegraph */

function playOrder() {
  safePlay((context) => {
    const now = context.currentTime;
    // telegraph key: two crisp dots
    for (let i = 0; i < 2; i += 1) {
      tone(context, now + i * 0.09, "square", 1500, 0.1, 0.002, 0.05);
    }
    // rising major triad = the order is away
    [523.25, 659.25, 783.99].forEach((f, i) => {
      tone(context, now + 0.18 + i * 0.07, "triangle", f, 0.16, 0.008, 0.34);
    });
  });
}

function playWin() {
  safePlay((context) => {
    const now = context.currentTime;
    const notes = [392, 523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      tone(context, now + i * 0.09, "square", f, 0.14, 0.006, 0.2);
      fmVoice(context, now + i * 0.09, f, 1, 0.35, 0.1, 0.006, 0.3);
    });
    // paper feed of the telegraph tape
    const src = noiseSource(context, now + 0.4, 0.5);
    const bp = context.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2600;
    bp.Q.value = 3;
    const ng = envGain(context, now + 0.4, 0.1, 0.08, 0.4);
    src.connect(bp).connect(ng).connect(master);
  });
}

/* ------------------------------------------------------------------ 8. extras */

function playDeath() {
  safePlay((context) => {
    const now = context.currentTime;
    tone(context, now, "sawtooth", 300, 0.3, 0.01, 0.7, 55);
    const src = noiseSource(context, now, 0.6);
    const lp = context.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(2200, now);
    lp.frequency.exponentialRampToValueAtTime(160, now + 0.55);
    const ng = envGain(context, now, 0.4, 0.008, 0.55);
    src.connect(lp).connect(ng).connect(master);
  });
}

function playClick() {
  safePlay((context) => {
    const now = context.currentTime;
    const src = noiseSource(context, now, 0.05);
    const bp = context.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1800;
    bp.Q.value = 6;
    const ng = envGain(context, now, 0.16, 0.002, 0.04);
    src.connect(bp).connect(ng).connect(master);
    tone(context, now, "square", 640, 0.05, 0.002, 0.05);
  });
}

function playSpawn() {
  safePlay((context) => {
    const now = context.currentTime;
    tone(context, now, "triangle", 180, 0.1, 0.02, 0.24, 620);
  });
}

// A non-lethal hit: metal plate taking a ping, nowhere near as loud as a kill.
function playHit() {
  safePlay((context) => {
    const now = context.currentTime;
    fmVoice(context, now, 620, 1.41, 1.1, 0.12, 0.003, 0.14);
  });
}

/* ------------------------------------------------------------------- dispatch */

const TABLE = {
  fire: (arg) => playFire(Number(arg) || 1),
  brick: () => playBrick(),
  ricochet: () => playRicochet(),
  explode: (arg) => playExplode(arg === true || arg === "armor" || arg === "armored"),
  pickup: (arg) => playPickup(String(arg ?? "star")),
  alarm: () => playAlarm(),
  order: () => playOrder(),
  win: () => playWin(),
  death: () => playDeath(),
  click: () => playClick(),
  spawn: () => playSpawn(),
  hit: () => playHit(),
};

export function play(name, arg) {
  const fn = TABLE[name];
  if (fn) fn(arg);
}

const CELL_BRICK = 1;
const CELL_STEEL = 2;

export function playForEvent(event) {
  if (!event || typeof event !== "object") return;
  switch (event.type) {
    case "shot":
      if (event.owner === "player") play("fire", 1);
      break;
    case "destroy":
      if (event.was === CELL_BRICK || event.was === CELL_STEEL) play("brick");
      break;
    case "ricochet":
      play("ricochet");
      break;
    case "hit":
      play("hit");
      break;
    case "kill":
      play("explode", event.kind === "armor");
      break;
    case "playerDown":
      play("death");
      break;
    case "baseHit":
      play("alarm");
      break;
    case "pickup":
      play("pickup", event.kind);
      break;
    case "order":
      play("order");
      break;
    case "spawn":
      play("spawn");
      break;
    case "cleared":
      play("win");
      break;
    default:
      break;
  }
}
