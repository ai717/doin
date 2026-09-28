const MASTER_LEVEL = 0.18;
const FLOOR = 0.0001;

let ctx = null;
let master = null;
let muted = false;
let unavailable = false;

function ensure() {
  if (unavailable) return null;
  if (ctx) return ctx;
  const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!Ctor) {
    unavailable = true;
    return null;
  }
  try {
    ctx = new Ctor({ latencyHint: "interactive" });
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_LEVEL;
    master.connect(ctx.destination);
  } catch {
    unavailable = true;
    ctx = null;
    master = null;
  }
  return ctx;
}

export function unlock() {
  const audio = ensure();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume();
}

export function setMuted(next) {
  muted = next === true;
  if (!ctx || !master) return;
  master.gain.setTargetAtTime(muted ? 0 : MASTER_LEVEL, ctx.currentTime, 0.02);
}

export function isMuted() {
  return muted;
}

function blip({ freq, glide = 0, type = "sine", duration = 0.12, gain = 0.06, delay = 0 }) {
  const audio = ctx;
  if (!audio || !master || muted) return;
  const start = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const env = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(glide, 1), start + duration);
  env.gain.setValueAtTime(Math.max(gain, FLOOR), start);
  env.gain.exponentialRampToValueAtTime(FLOOR, start + duration);
  osc.connect(env);
  env.connect(master);
  osc.start(start);
  osc.stop(start + duration + 0.02);
  osc.onended = () => {
    osc.disconnect();
    env.disconnect();
  };
}

export function playMove() {
  unlock();
  blip({ freq: 168, glide: 132, type: "triangle", duration: 0.07, gain: 0.05 });
}

export function playMerge(value) {
  unlock();
  const step = Math.min(11, Math.max(1, Math.round(Math.log2(Math.max(value, 2))) - 1));
  const base = 196 * Math.pow(2, step / 7);
  blip({ freq: base, type: "sine", duration: 0.13, gain: 0.07 });
  blip({ freq: base * 2, type: "triangle", duration: 0.09, gain: 0.03, delay: 0.02 });
}

export function playWin() {
  unlock();
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
    blip({ freq, type: "sine", duration: 0.24, gain: 0.075, delay: index * 0.085 });
  });
}

export function playLose() {
  unlock();
  [311.13, 261.63, 196.0].forEach((freq, index) => {
    blip({ freq, type: "triangle", duration: 0.26, gain: 0.055, delay: index * 0.115 });
  });
}
