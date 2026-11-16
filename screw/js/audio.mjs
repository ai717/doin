/**
 * @file games/screw/js/audio.mjs
 * WebAudio 程序化五金工坊音效，零外部音频文件。
 * 螺纹摩擦、塑料入盒、木板坠地、铰链吱呀、磁吸电流、马林巴胜利琶音。
 */

let audioCtx = null;
let isMuted = false;
let noiseBuffer = null;

function getAudioContext() {
  if (!audioCtx && typeof window !== 'undefined') {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function unlockAudio() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function setMuted(muted) {
  isMuted = Boolean(muted);
}

export function isAudioMuted() {
  return isMuted;
}

function getNoise(ctx) {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const length = Math.floor(ctx.sampleRate * 1.2);
  noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = last * 0.72 + white * 0.28;
    data[i] = last;
  }
  return noiseBuffer;
}

function noiseBurst(ctx, options) {
  const {
    duration = 0.18,
    gain = 0.12,
    type = 'bandpass',
    frequency = 1200,
    frequencyEnd = null,
    q = 1.2,
    delay = 0,
  } = options;
  const now = ctx.currentTime + delay;
  const source = ctx.createBufferSource();
  source.buffer = getNoise(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(frequency, now);
  if (frequencyEnd !== null) filter.frequency.exponentialRampToValueAtTime(Math.max(40, frequencyEnd), now + duration);
  filter.Q.setValueAtTime(q, now);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), now + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  source.connect(filter);
  filter.connect(amp);
  amp.connect(ctx.destination);
  const offset = Math.random() * 0.6;
  source.start(now, offset, Math.min(duration + 0.02, 1.18));
  source.stop(now + duration + 0.03);
}

function tone(ctx, options) {
  const {
    type = 'sine',
    frequency = 440,
    frequencyEnd = null,
    duration = 0.2,
    gain = 0.1,
    delay = 0,
    attack = 0.008,
    detune = 0,
  } = options;
  const now = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.detune.setValueAtTime(detune, now);
  osc.frequency.setValueAtTime(frequency, now);
  if (frequencyEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, frequencyEnd), now + duration);
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), now + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.03);
  return osc;
}

/** 螺栓旋出：细密螺纹摩擦 + 金属拔出声 */
export function playUnscrew() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  noiseBurst(ctx, { duration: 0.2, gain: 0.1, type: 'bandpass', frequency: 2600, frequencyEnd: 1200, q: 2.4 });
  for (let i = 0; i < 4; i += 1) {
    noiseBurst(ctx, {
      duration: 0.035,
      gain: 0.055,
      type: 'highpass',
      frequency: 3200,
      q: 1,
      delay: i * 0.045,
    });
  }
  tone(ctx, { type: 'triangle', frequency: 1320, frequencyEnd: 760, duration: 0.13, gain: 0.07, delay: 0.05 });
}

/** 螺栓入盒：硬塑料/木盒清脆啪嗒 */
export function playScrewIn() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  noiseBurst(ctx, { duration: 0.07, gain: 0.12, type: 'bandpass', frequency: 1500, frequencyEnd: 520, q: 1.4 });
  tone(ctx, { type: 'triangle', frequency: 220, frequencyEnd: 120, duration: 0.08, gain: 0.1 });
}

/** 满盒封盖：木盖啪合 + 传送带链条与马林巴提示 */
export function playBoxComplete() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  noiseBurst(ctx, { duration: 0.08, gain: 0.16, type: 'lowpass', frequency: 700, q: 0.9 });
  tone(ctx, { type: 'sine', frequency: 180, frequencyEnd: 90, duration: 0.16, gain: 0.13 });
  const notes = [523.25, 659.25, 783.99];
  notes.forEach((frequency, index) => {
    tone(ctx, {
      type: 'triangle',
      frequency,
      duration: 0.28,
      gain: 0.075,
      delay: 0.04 + index * 0.07,
    });
  });
  noiseBurst(ctx, { duration: 0.2, gain: 0.045, type: 'bandpass', frequency: 2400, frequencyEnd: 900, q: 3, delay: 0.02 });
}

/** 铰链摆动：金属轻微吱呀与低频摆动 */
export function playPlateSwing() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  noiseBurst(ctx, { duration: 0.34, gain: 0.055, type: 'bandpass', frequency: 900, frequencyEnd: 420, q: 8 });
  tone(ctx, { type: 'sine', frequency: 150, frequencyEnd: 96, duration: 0.36, gain: 0.045 });
}

/** 整板坠落：木板/金属板撞击并滑出屏幕的爽脆哗啦声 */
export function playPlateFall() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  noiseBurst(ctx, { duration: 0.42, gain: 0.2, type: 'lowpass', frequency: 1400, frequencyEnd: 240, q: 0.8 });
  tone(ctx, { type: 'triangle', frequency: 120, frequencyEnd: 42, duration: 0.32, gain: 0.17 });
  for (let i = 0; i < 4; i += 1) {
    noiseBurst(ctx, {
      duration: 0.075,
      gain: 0.09,
      type: 'bandpass',
      frequency: 900 + i * 420,
      frequencyEnd: 380,
      q: 1.6,
      delay: 0.05 + i * 0.055,
    });
  }
}

/** 无效操作：沉闷的阻拒声 */
export function playDeny() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  tone(ctx, { type: 'square', frequency: 150, frequencyEnd: 96, duration: 0.1, gain: 0.05 });
  noiseBurst(ctx, { duration: 0.06, gain: 0.05, type: 'lowpass', frequency: 500, q: 0.8 });
}

/** 磁吸：短促电流上升与金属吸附 */
export function playMagnet() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  tone(ctx, { type: 'sawtooth', frequency: 220, frequencyEnd: 920, duration: 0.22, gain: 0.06 });
  tone(ctx, { type: 'sine', frequency: 1800, frequencyEnd: 300, duration: 0.18, gain: 0.05, delay: 0.04 });
  noiseBurst(ctx, { duration: 0.24, gain: 0.06, type: 'bandpass', frequency: 1800, frequencyEnd: 600, q: 4 });
}

/** 胜利：FM 感马林巴大七和弦上行 */
export function playWin() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
  notes.forEach((frequency, index) => {
    tone(ctx, {
      type: 'triangle',
      frequency,
      duration: 0.55,
      gain: 0.085,
      delay: index * 0.085,
      attack: 0.01,
    });
    tone(ctx, {
      type: 'sine',
      frequency: frequency * 2.01,
      duration: 0.32,
      gain: 0.025,
      delay: index * 0.085,
    });
  });
}

/** 失败/死锁：低沉下行三音 */
export function playLose() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  [220, 174.61, 130.81].forEach((frequency, index) => {
    tone(ctx, {
      type: 'triangle',
      frequency,
      frequencyEnd: frequency * 0.92,
      duration: 0.4,
      gain: 0.07,
      delay: index * 0.13,
    });
  });
  noiseBurst(ctx, { duration: 0.3, gain: 0.035, type: 'lowpass', frequency: 400, q: 0.7 });
}
