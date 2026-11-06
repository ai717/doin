/**
 * @file games/bumper/js/audio.mjs
 * WebAudio 专属程序化物理拟真与 FM 合成音色。
 * 拒绝单调蜂鸣器，包含引擎喷射、合金保险杠碰撞“Duang”、轮胎急刹急停与坠崖回音。
 */

let audioCtx = null;
let soundEnabled = true;

function getAudioContext() {
  if (!audioCtx && typeof window !== 'undefined') {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function setSoundEnabled(enabled) {
  soundEnabled = !!enabled;
}

export function isSoundEnabled() {
  return soundEnabled;
}

/**
 * 引擎喷气冲刺短促咆哮
 */
export function playThrustSound() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(110, now);
  osc.frequency.linearRampToValueAtTime(170, now + 0.12);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(380, now);

  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.15);
}

/**
 * 合金保险杠硬核碰撞声 ("Duang!" 金属冲击 + 低音鼓)
 */
export function playCollisionSound(impact = 100) {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // 1. 低音咚冲击
  const kick = ctx.createOscillator();
  const kickGain = ctx.createGain();
  kick.type = 'triangle';
  kick.frequency.setValueAtTime(190, now);
  kick.frequency.exponentialRampToValueAtTime(40, now + 0.15);

  const vol = Math.min(0.4, 0.15 + (impact / 300) * 0.25);
  kickGain.gain.setValueAtTime(vol, now);
  kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

  kick.connect(kickGain);
  kickGain.connect(ctx.destination);
  kick.start(now);
  kick.stop(now + 0.19);

  // 2. 金属清脆咬合高频
  const metal = ctx.createOscillator();
  const metalGain = ctx.createGain();
  metal.type = 'sine';
  metal.frequency.setValueAtTime(840, now);
  metal.frequency.exponentialRampToValueAtTime(260, now + 0.08);

  metalGain.gain.setValueAtTime(vol * 0.6, now);
  metalGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

  metal.connect(metalGain);
  metalGain.connect(ctx.destination);
  metal.start(now);
  metal.stop(now + 0.1);
}

/**
 * 轮胎急刹啸叫 (双击急刹神技)
 */
export function playBrakeSound() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const bufferSize = ctx.sampleRate * 0.16;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.4;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1200, now);
  filter.frequency.linearRampToValueAtTime(2200, now + 0.06);
  filter.frequency.linearRampToValueAtTime(800, now + 0.16);
  filter.Q.value = 6.0;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + 0.17);
}

/**
 * 弹球保险柱高弹钟鸣音 (Act 3 Pegs)
 */
export function playPegSound() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(660, now);
  osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);

  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.23);
}

/**
 * 赛车跌落悬崖下坠音
 */
export function playFallSound() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.exponentialRampToValueAtTime(55, now + 0.55);

  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.56);
}

/**
 * 比赛获胜通关大胜琶音
 */
export function playWinSound() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5 (A大调凯旋)

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const startTime = now + idx * 0.09;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.01, startTime);
    gain.gain.linearRampToValueAtTime(0.28, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + 0.5);
  });
}
