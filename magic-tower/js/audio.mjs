// 魔塔：勇者登顶 · 复古地牢音色（WebAudio 程序化合成，零外部音频文件）
//
// 音色设计取向：地牢石质 + 黄铜机械 + FM 木琴/编钟
//   door    噪声爆发 + 带通 + 迅速下坠的金属摩擦（钥匙入锁）
//   battle  噪声斩击 + 低频冲击（刀剑铮鸣）
//   atkGem  FM 升调金属「锵」
//   defGem  低三角波 + 微颤的钝盾「嗡」
//   potion  上滑正弦 + 滤波噪声（咕嘟）
//   coin    双音 FM 铜币
//   stairs  低沉石阶脚步
//   win/lose  FM 五度和弦 / 下坠滑音

let ctx = null;
let master = null;
let muted = false;

function audio() {
  if (ctx) return ctx;
  try {
    const Ctor = typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

function ready() {
  const c = audio();
  if (!c || muted) return null;
  if (c.state === "suspended" && typeof c.resume === "function") c.resume();
  return c;
}

export function setMuted(value) {
  muted = Boolean(value);
}

export function isMuted() {
  return muted;
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
  return { src, filter, amp };
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
  door() {
    const c = ready();
    if (!c) return;
    noise(c, { duration: 0.16, freq: 900, q: 6, gain: 0.22 });
    tone(c, { freq: 220, endFreq: 90, type: "square", duration: 0.12, gain: 0.07 });
    tone(c, { freq: 1400, endFreq: 620, type: "triangle", duration: 0.09, gain: 0.05, delay: 0.04 });
  },

  battle() {
    const c = ready();
    if (!c) return;
    noise(c, { duration: 0.09, freq: 2600, q: 1.2, gain: 0.3 });
    noise(c, { duration: 0.22, freq: 380, q: 1.6, gain: 0.18 });
    tone(c, { freq: 180, endFreq: 70, type: "sawtooth", duration: 0.16, gain: 0.1 });
    fm(c, { carrier: 1150, modulator: 1730, index: 260, duration: 0.12, gain: 0.06, delay: 0.02 });
  },

  atkGem() {
    const c = ready();
    if (!c) return;
    fm(c, { carrier: 880, modulator: 1320, index: 420, duration: 0.24, gain: 0.16 });
    fm(c, { carrier: 1320, modulator: 1980, index: 320, duration: 0.2, gain: 0.09, delay: 0.07 });
  },

  defGem() {
    const c = ready();
    if (!c) return;
    tone(c, { freq: 196, endFreq: 208, type: "triangle", duration: 0.3, gain: 0.16 });
    tone(c, { freq: 294, endFreq: 300, type: "sine", duration: 0.26, gain: 0.08, delay: 0.02 });
    noise(c, { duration: 0.12, freq: 520, q: 3, gain: 0.05 });
  },

  potion() {
    const c = ready();
    if (!c) return;
    tone(c, { freq: 300, endFreq: 620, type: "sine", duration: 0.22, gain: 0.12 });
    noise(c, { duration: 0.2, freq: 700, q: 4, gain: 0.06, type: "lowpass" });
  },

  coin() {
    const c = ready();
    if (!c) return;
    fm(c, { carrier: 1560, modulator: 2340, index: 300, duration: 0.1, gain: 0.1 });
    fm(c, { carrier: 2080, modulator: 3120, index: 260, duration: 0.12, gain: 0.07, delay: 0.06 });
  },

  stairs() {
    const c = ready();
    if (!c) return;
    noise(c, { duration: 0.18, freq: 240, q: 0.9, gain: 0.16, type: "lowpass" });
    tone(c, { freq: 120, endFreq: 60, type: "sine", duration: 0.18, gain: 0.12 });
  },

  buy() {
    const c = ready();
    if (!c) return;
    fm(c, { carrier: 660, modulator: 990, index: 340, duration: 0.14, gain: 0.1 });
    sfx.coin();
  },

  blocked() {
    const c = ready();
    if (!c) return;
    noise(c, { duration: 0.1, freq: 180, q: 1.4, gain: 0.14, type: "lowpass" });
    tone(c, { freq: 90, endFreq: 62, type: "square", duration: 0.09, gain: 0.06 });
  },

  undo() {
    const c = ready();
    if (!c) return;
    tone(c, { freq: 720, endFreq: 380, type: "triangle", duration: 0.14, gain: 0.1 });
  },

  win() {
    const c = ready();
    if (!c) return;
    [523, 659, 784, 1047].forEach((f, i) => {
      fm(c, { carrier: f, modulator: f * 2, index: 180, duration: 0.7, gain: 0.12, delay: i * 0.12 });
    });
  },

  lose() {
    const c = ready();
    if (!c) return;
    tone(c, { freq: 300, endFreq: 70, type: "sawtooth", duration: 0.9, gain: 0.16 });
    noise(c, { duration: 0.7, freq: 200, q: 1, gain: 0.1, type: "lowpass" });
  },

  step() {
    const c = ready();
    if (!c) return;
    noise(c, { duration: 0.05, freq: 420, q: 2, gain: 0.05, type: "lowpass" });
  },
};
