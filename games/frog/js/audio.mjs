// WebAudio 程序化合成音效：零外部音频文件。手势解锁后在用户手势中触发；
// 静音 / 不支持时静默降级。

let ctx = null;
let unlocked = false;

function ensureCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function unlock() {
  ensureCtx();
  unlocked = true;
}

function tone(freq, duration, type = "square", gainValue = 0.04, when = 0) {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(gainValue, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function noise(duration, gainValue = 0.03) {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const buffer = c.createBuffer(1, Math.floor(c.sampleRate * duration), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const gain = c.createGain();
  gain.gain.setValueAtTime(gainValue, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 800;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  src.start(t0);
}

const muted = () => globalThis.__frogMuted === true;

function play(fn) {
  if (!unlocked || muted()) return;
  try {
    fn();
  } catch (error) {
    // 静默降级
  }
}

export const sfx = {
  hop() { play(() => { tone(620, 0.06, "square", 0.04); tone(880, 0.05, "square", 0.03, 0.03); }); },
  home() { play(() => { tone(523, 0.08, "triangle", 0.05); tone(784, 0.10, "triangle", 0.05, 0.07); tone(1046, 0.12, "triangle", 0.05, 0.14); }); },
  fly() { play(() => { tone(660, 0.06, "sine", 0.05); tone(990, 0.08, "sine", 0.05, 0.05); tone(1320, 0.10, "sine", 0.05, 0.10); }); },
  hit() { play(() => { noise(0.15, 0.06); tone(120, 0.18, "sawtooth", 0.05); }); },
  drown() { play(() => { tone(500, 0.4, "sine", 0.05); tone(300, 0.4, "sine", 0.03, 0.05); }); },
  win() { play(() => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.14, "triangle", 0.05, i * 0.1)); }); },
  lose() { play(() => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.18, "triangle", 0.05, i * 0.12)); }); },
  record() { play(() => { [880, 1108, 1318, 1760].forEach((f, i) => tone(f, 0.12, "square", 0.04, i * 0.08)); }); },
};

export function setMuted(value) {
  globalThis.__frogMuted = Boolean(value);
}