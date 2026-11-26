/**
 * Procedural WebAudio sound generator for Tenpai King · Wait Finder (雀神听牌王 · 听牌速判)
 * Pure synthesis with BiquadFilter, FM synthesis, and resonant noise buffers.
 * Zero external audio files.
 */

let audioCtx = null;
let isMuted = false;

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

export function setMuted(muted) {
  isMuted = Boolean(muted);
}

export function getMuted() {
  return isMuted;
}

/**
 * Tile Clack: Melamine/ivory collision sound.
 */
export function playTileClack() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const bufferSize = Math.floor(ctx.sampleRate * 0.04);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.006));
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1800, now);
  filter.Q.setValueAtTime(4.0, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.45, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.038);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
}

/**
 * Tile Select / Tap: Satisfying tactile click.
 */
export function playTileSelect() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.exponentialRampToValueAtTime(220, now + 0.05);

  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.055);
}

/**
 * Target Set: Bright high chime when designating target wait.
 */
export function playTargetSet() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const freqs = [880, 1318.51];
  freqs.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.04);

    gain.gain.setValueAtTime(0.25, now + idx * 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.04);
    osc.stop(now + idx * 0.04 + 0.22);
  });
}

/**
 * Wooden Temple Block (木鱼) Tick.
 * Accelerates pitch when remaining seconds <= 5.
 */
export function playTimerTick(isUrgent = false) {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  const baseFreq = isUrgent ? 680 : 480;
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.6, now + 0.04);

  gain.gain.setValueAtTime(isUrgent ? 0.35 : 0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.045);
}

/**
 * Correct answer celebration: FM bell chime.
 */
export function playRevealCorrect() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const carrier = ctx.createOscillator();
  const modulator = ctx.createOscillator();
  const modGain = ctx.createGain();
  const masterGain = ctx.createGain();

  carrier.type = 'sine';
  carrier.frequency.setValueAtTime(587.33, now); // D5

  modulator.type = 'sine';
  modulator.frequency.setValueAtTime(587.33 * 2.76, now);

  modGain.gain.setValueAtTime(587.33 * 1.5, now);
  modGain.gain.exponentialRampToValueAtTime(1.0, now + 0.3);

  masterGain.gain.setValueAtTime(0.35, now);
  masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

  modulator.connect(modGain);
  modGain.connect(carrier.frequency);
  carrier.connect(masterGain);
  masterGain.connect(ctx.destination);

  carrier.start(now);
  modulator.start(now);
  carrier.stop(now + 0.46);
  modulator.stop(now + 0.46);
}

/**
 * Missed / wrong answer: gentle low descend.
 */
export function playRevealWrong() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(260, now);
  osc.frequency.exponentialRampToValueAtTime(130, now + 0.18);

  gain.gain.setValueAtTime(0.28, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.19);
}

/**
 * Hu / Grand Fanfare: Resonant gong.
 */
export function playHuFanfare() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const freqs = [329.63, 440.00, 554.37, 659.25, 880.00];

  freqs.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.05);

    gain.gain.setValueAtTime(0.3, now + idx * 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.05);
    osc.stop(now + idx * 0.05 + 0.62);
  });
}
