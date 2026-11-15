/**
 * Procedural WebAudio sound generator for Luban Lock · Mortise Puzzle (巧解鲁班锁 · 榫卯拆解)
 * Pure synthesis with BiquadFilter, FM synthesis, and noise buffers.
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
 * Wood Slide: Sandpaper/timber friction slide sound.
 */
export function playWoodSlide() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const bufferSize = Math.floor(ctx.sampleRate * 0.16);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.05));
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(800, now);
  filter.frequency.linearRampToValueAtTime(1400, now + 0.15);
  filter.Q.setValueAtTime(3.0, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.35, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
}

/**
 * Wood Thud: Blocked block collision sound.
 */
export function playWoodThud() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'triangle';
  osc2.type = 'sine';

  osc1.frequency.setValueAtTime(180, now);
  osc1.frequency.exponentialRampToValueAtTime(80, now + 0.1);

  osc2.frequency.setValueAtTime(140, now);
  osc2.frequency.exponentialRampToValueAtTime(60, now + 0.1);

  gain.gain.setValueAtTime(0.4, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.12);
  osc2.stop(now + 0.12);
}

/**
 * Tenon Clack: Crisp mortise disengagement and landing in tray.
 */
export function playTenonClack() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(640, now);
  osc.frequency.exponentialRampToValueAtTime(320, now + 0.06);

  gain.gain.setValueAtTime(0.45, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.07);
}

/**
 * View Rotate Swish: Subtle airy woosh.
 */
export function playViewRotate() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const bufferSize = Math.floor(ctx.sampleRate * 0.08);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(600, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
}

/**
 * Hint Chime: Warm marimba chime.
 */
export function playHintChime() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const freqs = [523.25, 659.25, 783.99];

  freqs.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + idx * 0.05);

    gain.gain.setValueAtTime(0.25, now + idx * 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.05);
    osc.stop(now + idx * 0.05 + 0.24);
  });
}

/**
 * Win Fanfare: Wood mallet taps + resonant gong.
 */
export function playLevelWin() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  // Two wooden mallet taps
  [0, 0.1].forEach((delay) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, now + delay);
    osc.frequency.exponentialRampToValueAtTime(180, now + delay + 0.05);
    gain.gain.setValueAtTime(0.4, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + delay);
    osc.stop(now + delay + 0.06);
  });

  // Resonant bronze bell chime
  const carrier = ctx.createOscillator();
  const modulator = ctx.createOscillator();
  const modGain = ctx.createGain();
  const masterGain = ctx.createGain();

  const bellFreq = 587.33; // D5
  carrier.type = 'sine';
  carrier.frequency.setValueAtTime(bellFreq, now + 0.22);

  modulator.type = 'sine';
  modulator.frequency.setValueAtTime(bellFreq * 2.76, now + 0.22);

  modGain.gain.setValueAtTime(bellFreq * 1.5, now + 0.22);
  modGain.gain.exponentialRampToValueAtTime(1.0, now + 0.6);

  masterGain.gain.setValueAtTime(0.4, now + 0.22);
  masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

  modulator.connect(modGain);
  modGain.connect(carrier.frequency);
  carrier.connect(masterGain);
  masterGain.connect(ctx.destination);

  carrier.start(now + 0.22);
  modulator.start(now + 0.22);
  carrier.stop(now + 0.86);
  modulator.stop(now + 0.86);
}
