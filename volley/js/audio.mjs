// Volley Bombard — siege soundscape. All procedural WebAudio: FM, detuned
// oscillators, noise-buffer + BiquadFilter. Zero external assets; silent
// fallback when WebAudio is unavailable or muted. Tympana: bowstring, cannon,
// wind, timber collapse, thud impact, victory horn.

let context = null;
let master = null;
let noiseBuffer = null;
let enabled = true;

function supports() {
  return typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
}

function makeNoise(ctx) {
  const seconds = 1.4;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function ensure() {
  if (context) return context;
  if (!supports()) return null;
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    context = new Ctor();
    master = context.createGain();
    master.gain.value = 0.28;
    master.connect(context.destination);
    noiseBuffer = makeNoise(context);
    return context;
  } catch {
    context = null;
    return null;
  }
}

export function unlock() {
  const ctx = ensure();
  if (!ctx) return false;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  return true;
}

export function setEnabled(value) {
  enabled = Boolean(value);
  if (master) master.gain.value = enabled ? 0.28 : 0;
  return enabled;
}

export function isEnabled() {
  return enabled;
}

function envGain(ctx, gainValue, attack, decay) {
  const gain = ctx.createGain();
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), t + Math.max(0.005, attack));
  gain.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack + 0.01, decay));
  return gain;
}

function tone({ freq = 440, type = "sine", dur = 0.2, gain = 0.3, slideTo = null, delay = 0, detune = 0 }) {
  const ctx = ensure();
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (detune) osc.detune.setValueAtTime(detune, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + Math.min(0.04, dur * 0.25));
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp);
  amp.connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise({ dur = 0.2, type = "lowpass", freq = 400, q = 1, gain = 0.25, delay = 0, sweepTo = null }) {
  const ctx = ensure();
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(freq, t);
  filter.Q.value = q;
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t + dur);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter);
  filter.connect(amp);
  amp.connect(master);
  src.start(t);
  src.stop(t + dur + 0.02);
}

// FM ping — marimba-like timber knock for UI and flag events.
function ping({ freq = 520, dur = 0.22, gain = 0.25, delay = 0, ratio = 1.7 }) {
  const ctx = ensure();
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const carrier = ctx.createOscillator();
  const mod = ctx.createOscillator();
  const modGain = ctx.createGain();
  const amp = ctx.createGain();
  carrier.type = "sine";
  mod.type = "triangle";
  carrier.frequency.value = freq;
  mod.frequency.value = freq * ratio;
  modGain.gain.value = freq * 0.9;
  mod.connect(modGain);
  modGain.connect(carrier.frequency);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  carrier.connect(amp);
  amp.connect(master);
  carrier.start(t);
  mod.start(t);
  carrier.stop(t + dur + 0.02);
  mod.stop(t + dur + 0.02);
}

function guard() {
  if (!enabled) return false;
  return Boolean(ensure());
}

export function play(name, options = {}) {
  if (!guard()) return;
  try {
    switch (name) {
      // bowstring draw: FM upward chirp while charging (pitch tracks power)
      case "charge": {
        const power = Math.max(0, Math.min(1, options.power ?? 0));
        const base = 180 + power * 320;
        ping({ freq: base, dur: 0.07, gain: 0.1 + power * 0.08, ratio: 2.2 });
        noise({ dur: 0.05, type: "bandpass", freq: 900 + power * 1600, q: 2, gain: 0.05 });
        break;
      }
      // cannon: detuned dual oscillator + low noise burst
      case "fire": {
        tone({ freq: 120, type: "sawtooth", dur: 0.3, gain: 0.3, slideTo: 46 });
        tone({ freq: 123, type: "square", dur: 0.28, gain: 0.2, slideTo: 49, detune: 18 });
        noise({ dur: 0.34, type: "lowpass", freq: 900, gain: 0.34, sweepTo: 140 });
        break;
      }
      // shell wind whistle: sweeping band-passed noise through flight
      case "whoosh":
        noise({ dur: options.dur ?? 0.6, type: "bandpass", freq: 500, q: 3, gain: 0.14, sweepTo: 1700 });
        break;
      // timber collapse: staggered woody knocks (filtered noise + low sine)
      case "collapse": {
        const knocks = Math.max(2, Math.min(8, options.blocks ?? 4));
        for (let i = 0; i < knocks; i += 1) {
          const delay = i * 0.075;
          noise({ dur: 0.09, type: "bandpass", freq: 420 - i * 22, q: 1.6, gain: 0.22, delay });
          tone({ freq: 96 - i * 5, type: "sine", dur: 0.11, gain: 0.2, slideTo: 60, delay });
        }
        break;
      }
      // dull impact thud
      case "thud":
        noise({ dur: 0.12, type: "lowpass", freq: 300, gain: 0.26 });
        tone({ freq: 82, type: "sine", dur: 0.14, gain: 0.24, slideTo: 50 });
        break;
      // explosion: deep thump + bright crackle
      case "boom":
        tone({ freq: 56, type: "sawtooth", dur: 0.42, gain: 0.3, slideTo: 34 });
        noise({ dur: 0.5, type: "lowpass", freq: 1400, gain: 0.36, sweepTo: 160 });
        noise({ dur: 0.24, type: "highpass", freq: 2200, gain: 0.12, delay: 0.03 });
        break;
      // flag topples — ceremonial gong
      case "flagdown":
        ping({ freq: 320, dur: 0.6, gain: 0.26, ratio: 1.35 });
        noise({ dur: 0.4, type: "bandpass", freq: 260, q: 1.1, gain: 0.2, sweepTo: 120, delay: 0.05 });
        break;
      // victory horn: FM brassy triad
      case "win": {
        [392, 494, 587, 784].forEach((freq, i) => {
          tone({ freq, type: "sawtooth", dur: 0.34, gain: 0.16, delay: i * 0.13, slideTo: freq * 1.02 });
          ping({ freq: freq * 2, dur: 0.3, gain: 0.08, delay: i * 0.13, ratio: 1.4 });
        });
        break;
      }
      case "lose":
        [330, 262, 196].forEach((freq, i) => {
          tone({ freq, type: "triangle", dur: 0.32, gain: 0.16, delay: i * 0.15, slideTo: freq * 0.94 });
        });
        break;
      case "ui":
        tone({ freq: 720, type: "triangle", dur: 0.05, gain: 0.09 });
        break;
      case "aim":
        noise({ dur: 0.04, type: "highpass", freq: 1600, gain: 0.05 });
        break;
      case "pause":
        noise({ dur: 0.2, type: "bandpass", freq: 800, q: 1.2, gain: 0.14, sweepTo: 1500 });
        break;
      case "unpause":
        noise({ dur: 0.18, type: "bandpass", freq: 1500, q: 1.2, gain: 0.12, sweepTo: 700 });
        break;
      case "turn":
        ping({ freq: 540, dur: 0.14, gain: 0.14, ratio: 1.8 });
        break;
      default:
        break;
    }
  } catch {
    /* any audio failure must never affect the match */
  }
}
