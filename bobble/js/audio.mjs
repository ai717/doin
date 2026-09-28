// 泡泡射手 · WebAudio 程序化合成音效（零外部音频文件，手势解锁，静默降级）

let ctx = null;
let master = null;
let enabled = true;

export function initAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.3;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return true;
  } catch {
    return false;
  }
}

export function setAudioEnabled(on) {
  enabled = Boolean(on);
  if (master) master.gain.value = on ? 0.3 : 0;
}

export function isAudioEnabled() {
  return enabled;
}

function tone(freq, type, dur, gain = 0.4, slideTo = null) {
  if (!ctx || !master || !enabled) return;
  try {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  } catch {
    /* 音频失败静默 */
  }
}

function noise(dur, gain = 0.16, filterFreq = 2600) {
  if (!ctx || !master || !enabled) return;
  try {
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  } catch {
    /* 音频失败静默 */
  }
}

const SEMITONE = (base, n) => base * Math.pow(2, n / 12);

export function playEvent(type, event = {}) {
  if (!enabled) return;
  switch (type) {
    case "shoot":
      tone(320, "sine", 0.12, 0.3, 620);
      break;
    case "bounce":
      tone(900 - Math.min(6, event.bounces ?? 1) * 60, "triangle", 0.05, 0.16);
      break;
    case "land":
      tone(220, "sine", 0.09, 0.22, 180);
      break;
    case "pop":
      tone(SEMITONE(520, Math.min(14, (event.chain ?? 3) - 3)), "square", 0.12, 0.22);
      break;
    case "drop":
      noise(0.22 + Math.min(0.3, (event.dropped ?? 1) * 0.03), 0.2, 1800);
      tone(180, "sawtooth", 0.28, 0.18, 90);
      break;
    case "avalanche":
      tone(660, "square", 0.16, 0.26, 1320);
      noise(0.4, 0.22, 1200);
      break;
    case "press":
      tone(90, "sawtooth", 0.32, 0.3, 60);
      noise(0.18, 0.12, 700);
      break;
    case "rescue":
      tone(880, "sine", 0.18, 0.24, 1320);
      break;
    case "pick":
      noise(0.24, 0.24, 3400);
      tone(300, "square", 0.14, 0.2, 140);
      break;
    case "swap":
      tone(500, "triangle", 0.08, 0.16, 700);
      break;
    case "win":
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => setTimeout(() => tone(f, "triangle", 0.22, 0.26), i * 90));
      break;
    case "lose":
      [392, 349.23, 293.66].forEach((f, i) => setTimeout(() => tone(f, "sine", 0.3, 0.24), i * 130));
      break;
    default:
      break;
  }
}
