// WebAudio 程序化合成音效：红木棋桌专属音色（零外部音频文件）。
//   place   落子笃 —— 低频木质敲击：正弦基频速降 + 噪声瞬态过低通
//   capture 吃子啪 —— 双段噪声脉冲过带通（木子相击的脆响）
//   check   将军叮 —— FM 调频铜铃
//   drag    拖动沙 —— 带通噪声扫频（棋子在木盘上的摩擦）
//   mate    杀棋钟 —— FM 编钟三连上行 + 低频木桌共鸣
//   ambience 茶室底噪 —— 失谐锯齿对 + LFO 微幅起伏（极低音量）
// 静音或不支持 WebAudio 时静默降级，绝不抛错。

let ctx = null;
let muted = false;
let ambienceNodes = null;
let noiseBuffer = null;

function audioCtx() {
  if (muted) return null;
  if (ctx) return ctx;
  try {
    const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

export function setMuted(value) {
  muted = Boolean(value);
  if (muted) stopAmbience();
}

export function isMuted() {
  return muted;
}

function makeNoiseBuffer(context) {
  if (noiseBuffer) return noiseBuffer;
  const length = Math.floor(context.sampleRate * 0.4);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 0x9e3779b9;
  for (let i = 0; i < length; i += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    data[i] = (seed / 2147483648) - 1;
  }
  noiseBuffer = buffer;
  return buffer;
}

function envGain(context, destination, attack, decay, peak = 1) {
  const gain = context.createGain();
  const now = context.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), now + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
  gain.connect(destination);
  return gain;
}

function noiseSource(context) {
  const source = context.createBufferSource();
  source.buffer = makeNoiseBuffer(context);
  return source;
}

// ─── 落子笃：木敲 ─────────────────────────────────────────────────
export function playPlace() {
  const context = audioCtx();
  if (!context) return;
  try {
    if (context.state === "suspended") context.resume();
    const bus = context.createGain();
    bus.gain.value = 0.9;
    bus.connect(context.destination);

    const osc = context.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(190, context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(72, context.currentTime + 0.09);
    const oscGain = envGain(context, bus, 0.004, 0.14, 0.7);
    osc.connect(oscGain);
    osc.start();
    osc.stop(context.currentTime + 0.2);

    const noise = noiseSource(context);
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    const noiseGain = envGain(context, bus, 0.002, 0.05, 0.5);
    noise.connect(filter);
    filter.connect(noiseGain);
    noise.start();
    noise.stop(context.currentTime + 0.08);
  } catch {
    // 静默降级
  }
}

// ─── 吃子啪：双段木子相击 ─────────────────────────────────────────
export function playCapture() {
  const context = audioCtx();
  if (!context) return;
  try {
    if (context.state === "suspended") context.resume();
    const bus = context.createGain();
    bus.gain.value = 0.85;
    bus.connect(context.destination);

    for (let n = 0; n < 2; n += 1) {
      const at = context.currentTime + n * 0.045;
      const noise = noiseSource(context);
      const filter = context.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(n === 0 ? 2100 : 1400, at);
      filter.Q.value = 1.4;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.75, at + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(bus);
      noise.start(at);
      noise.stop(at + 0.09);
    }
  } catch {
    // 静默降级
  }
}

// ─── 将军叮：FM 铜铃 ─────────────────────────────────────────────
export function playCheck() {
  const context = audioCtx();
  if (!context) return;
  try {
    if (context.state === "suspended") context.resume();
    const bus = context.createGain();
    bus.gain.value = 0.8;
    bus.connect(context.destination);

    const carrier = context.createOscillator();
    carrier.type = "sine";
    carrier.frequency.value = 880;
    const modulator = context.createOscillator();
    modulator.type = "sine";
    modulator.frequency.value = 880 * 2.4;
    const modGain = context.createGain();
    modGain.gain.setValueAtTime(500, context.currentTime);
    modGain.gain.exponentialRampToValueAtTime(1, context.currentTime + 0.5);
    modulator.connect(modGain);
    modGain.connect(carrier.frequency);
    const gain = envGain(context, bus, 0.005, 0.55, 0.5);
    carrier.connect(gain);
    carrier.start();
    modulator.start();
    carrier.stop(context.currentTime + 0.7);
    modulator.stop(context.currentTime + 0.7);
  } catch {
    // 静默降级
  }
}

// ─── 拖动沙：带通噪声扫频 ────────────────────────────────────────
export function playDrag() {
  const context = audioCtx();
  if (!context) return;
  try {
    if (context.state === "suspended") context.resume();
    const noise = noiseSource(context);
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 2.2;
    filter.frequency.setValueAtTime(420, context.currentTime);
    filter.frequency.linearRampToValueAtTime(1250, context.currentTime + 0.12);
    const gain = envGain(context, context.destination, 0.01, 0.12, 0.22);
    noise.connect(filter);
    filter.connect(gain);
    noise.start();
    noise.stop(context.currentTime + 0.16);
  } catch {
    // 静默降级
  }
}

// ─── 杀棋钟：FM 编钟三连上行 + 低频共鸣 ──────────────────────────
export function playMate() {
  const context = audioCtx();
  if (!context) return;
  try {
    if (context.state === "suspended") context.resume();
    const bus = context.createGain();
    bus.gain.value = 0.9;
    bus.connect(context.destination);

    // 五声音阶上行（宫商角清角），避开千篇一律大三和弦
    const freqs = [523.25, 587.33, 784];
    freqs.forEach((freq, n) => {
      const at = context.currentTime + n * 0.16;
      const carrier = context.createOscillator();
      carrier.type = "sine";
      carrier.frequency.value = freq;
      const modulator = context.createOscillator();
      modulator.type = "sine";
      modulator.frequency.value = freq * 3.01;
      const modGain = context.createGain();
      modGain.gain.setValueAtTime(freq * 0.8, at);
      modGain.gain.exponentialRampToValueAtTime(1, at + 0.4);
      modulator.connect(modGain);
      modGain.connect(carrier.frequency);
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.5, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.8);
      carrier.connect(gain);
      gain.connect(bus);
      carrier.start(at);
      modulator.start(at);
      carrier.stop(at + 0.9);
      modulator.stop(at + 0.9);
    });

    const bass = context.createOscillator();
    bass.type = "sine";
    bass.frequency.value = 65;
    const bassGain = envGain(context, bus, 0.01, 1.2, 0.45);
    bass.connect(bassGain);
    bass.start();
    bass.stop(context.currentTime + 1.4);
  } catch {
    // 静默降级
  }
}

// ─── 茶室底噪：失谐锯齿对 + LFO 微幅起伏（极低音量）──────────────
export function startAmbience() {
  const context = audioCtx();
  if (!context || ambienceNodes) return;
  try {
    if (context.state === "suspended") context.resume();
    const bus = context.createGain();
    bus.gain.value = 0.035;
    bus.connect(context.destination);

    const lfo = context.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.13;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 0.014;
    lfo.connect(lfoGain);
    lfoGain.connect(bus.gain);

    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 320;
    filter.connect(bus);

    const oscs = [];
    for (const [freq, detune] of [[110, -4], [110.8, 5]]) {
      const osc = context.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start();
      oscs.push(osc);
    }
    lfo.start();
    ambienceNodes = { bus, oscs, lfo };
  } catch {
    ambienceNodes = null;
  }
}

export function stopAmbience() {
  if (!ambienceNodes) return;
  try {
    for (const osc of ambienceNodes.oscs) osc.stop();
    ambienceNodes.lfo.stop();
  } catch {
    // 忽略
  }
  ambienceNodes = null;
}
