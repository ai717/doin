// 机台音色：噪声滤波 + FM 调频 + 失谐振荡器。全部程序化合成，零外部资源。
// 不支持 WebAudio 或用户静音时静默降级。

let context = null;
let master = null;
let noiseBuffer = null;
let enabled = true;
let lastLockAt = 0;

function supports() {
  return typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
}

function makeNoise(ctx) {
  const seconds = 1.2;
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
    master.gain.value = 0.26;
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
  if (master) master.gain.value = enabled ? 0.26 : 0;
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

function tone({ freq = 440, type = "sine", dur = 0.2, gain = 0.3, slideTo = null, delay = 0, detune = 0, highpass = 0 }) {
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
  if (highpass > 0) {
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = highpass;
    osc.connect(hp);
    hp.connect(amp);
  } else {
    osc.connect(amp);
  }
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
      case "ui":
        tone({ freq: 760, type: "square", dur: 0.035, gain: 0.08 });
        break;
      case "move":
        noise({ dur: 0.035, type: "highpass", freq: 1800, gain: 0.05 });
        break;
      case "rotate":
        tone({ freq: 540, type: "triangle", dur: 0.05, gain: 0.1, slideTo: 760 });
        noise({ dur: 0.03, type: "bandpass", freq: 1600, q: 2, gain: 0.06 });
        break;
      case "hold":
        noise({ dur: 0.09, type: "bandpass", freq: 900, q: 1.4, gain: 0.1, sweepTo: 1500 });
        break;
      case "lock": {
        const now = context.currentTime;
        if (now - lastLockAt < 0.035) return;
        lastLockAt = now;
        noise({ dur: 0.11, type: "lowpass", freq: 240, gain: 0.3 });
        tone({ freq: 88, type: "sine", dur: 0.13, gain: 0.24, slideTo: 52 });
        break;
      }
      case "clear": {
        const lines = options.lines ?? 1;
        tone({ freq: 420 + lines * 90, type: "triangle", dur: 0.16, gain: 0.2, slideTo: 780 });
        ping({ freq: 620 + lines * 110, dur: 0.18, gain: 0.18, delay: 0.03 });
        noise({ dur: 0.16, type: "highpass", freq: 2400, gain: 0.1, delay: 0.02 });
        break;
      }
      case "tetris":
        noise({ dur: 0.5, type: "lowpass", freq: 700, gain: 0.38, sweepTo: 180 });
        tone({ freq: 62, type: "sawtooth", dur: 0.5, gain: 0.32, slideTo: 44 });
        tone({ freq: 220, type: "square", dur: 0.32, gain: 0.18, slideTo: 660, delay: 0.04 });
        ping({ freq: 880, dur: 0.35, gain: 0.15, delay: 0.12 });
        break;
      case "tspin":
        ping({ freq: 1050, dur: 0.24, gain: 0.22, ratio: 2.4 });
        noise({ dur: 0.22, type: "bandpass", freq: 2600, q: 3, gain: 0.18 });
        tone({ freq: 300, type: "triangle", dur: 0.2, gain: 0.12, slideTo: 620 });
        break;
      case "cancel":
        ping({ freq: 760, dur: 0.16, gain: 0.18 });
        noise({ dur: 0.12, type: "highpass", freq: 2000, gain: 0.12 });
        break;
      case "garbage":
        tone({ freq: 46, type: "sawtooth", dur: 0.38, gain: 0.26, slideTo: 38 });
        noise({ dur: 0.4, type: "bandpass", freq: 340, q: 1.2, gain: 0.3, sweepTo: 160 });
        break;
      case "alarm":
        tone({ freq: 880, type: "square", dur: 0.09, gain: 0.14 });
        tone({ freq: 660, type: "square", dur: 0.09, gain: 0.14, delay: 0.12 });
        break;
      case "laser":
        noise({ dur: 0.34, type: "highpass", freq: 900, gain: 0.24, sweepTo: 3200 });
        tone({ freq: 1500, type: "sawtooth", dur: 0.32, gain: 0.2, slideTo: 240 });
        tone({ freq: 720, type: "triangle", dur: 0.28, gain: 0.16, slideTo: 1400, delay: 0.02 });
        break;
      case "ko":
        noise({ dur: 0.6, type: "lowpass", freq: 900, gain: 0.4, sweepTo: 120 });
        tone({ freq: 160, type: "sawtooth", dur: 0.6, gain: 0.3, slideTo: 40 });
        ping({ freq: 480, dur: 0.4, gain: 0.2, delay: 0.08, ratio: 2.1 });
        break;
      case "win":
        [523, 659, 784, 1047].forEach((freq, i) => {
          tone({ freq, type: "triangle", dur: 0.24, gain: 0.2, delay: i * 0.1, slideTo: freq * 1.04 });
        });
        break;
      case "lose":
        [392, 330, 262].forEach((freq, i) => {
          tone({ freq, type: "triangle", dur: 0.3, gain: 0.18, delay: i * 0.13, slideTo: freq * 0.96 });
        });
        break;
      case "pause":
        noise({ dur: 0.24, type: "bandpass", freq: 700, q: 1.2, gain: 0.16, sweepTo: 1400 });
        break;
      case "unpause":
        noise({ dur: 0.22, type: "bandpass", freq: 1400, q: 1.2, gain: 0.14, sweepTo: 600 });
        break;
      default:
        break;
    }
  } catch {
    /* 任何音频异常不得影响对局 */
  }
}
