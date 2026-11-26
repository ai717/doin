/**
 * Procedural WebAudio sound generator for TileStack (千层瓦片 · 叠叠消)
 * Pure synthesis with BiquadFilter, FM synthesis, noise buffers, and detuned oscillators.
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
 * Procedural Wood Tap: Filtered white noise with sudden decay.
 */
export function playTileTap() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const bufferSize = Math.floor(ctx.sampleRate * 0.05);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.008));
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1400, now);
  filter.Q.setValueAtTime(3.5, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.4, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
}

/**
 * Tray Land: Detuned twin oscillators with rapid pitch drop for a satisfying wooden click.
 */
export function playTrayLand() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'triangle';
  osc2.type = 'sine';

  osc1.frequency.setValueAtTime(380, now);
  osc1.frequency.exponentialRampToValueAtTime(140, now + 0.06);

  osc2.frequency.setValueAtTime(520, now);
  osc2.frequency.exponentialRampToValueAtTime(180, now + 0.06);

  gain.gain.setValueAtTime(0.35, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.07);
  osc2.stop(now + 0.07);
}

/**
 * Match Chime: FM Bell synthesis (crystal clear porcelain chime).
 */
export function playMatchChime(comboLevel = 1) {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  
  // Pentatonic scale base pitches based on combo
  const scale = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66];
  const baseFreq = scale[Math.min(scale.length - 1, comboLevel - 1)];

  // Carrier oscillator
  const carrier = ctx.createOscillator();
  carrier.type = 'sine';
  carrier.frequency.setValueAtTime(baseFreq, now);

  // Modulator oscillator for FM bell tone
  const modulator = ctx.createOscillator();
  modulator.type = 'sine';
  modulator.frequency.setValueAtTime(baseFreq * 3.5, now);

  const modGain = ctx.createGain();
  modGain.gain.setValueAtTime(baseFreq * 1.8, now);
  modGain.gain.exponentialRampToValueAtTime(1.0, now + 0.35);

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.4, now);
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
 * Ice Shatter: Crisp crackle noise for frosted tiles.
 */
export function playIceShatter() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const bufferSize = Math.floor(ctx.sampleRate * 0.12);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.02));
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(2600, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.4, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
}

/**
 * Key Unlock: Bright metallic glockenspiel ping.
 */
export function playKeyUnlock() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const freqs = [1046.50, 1318.51, 1567.98];
  
  freqs.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.04);

    gain.gain.setValueAtTime(0.2, now + idx * 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.04);
    osc.stop(now + idx * 0.04 + 0.26);
  });
}

/**
 * Tray Warning: Subtle low frequency ambient pulse when tray has 6 tiles.
 */
export function playTrayWarning() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.linearRampToValueAtTime(90, now + 0.25);

  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.29);
}

/**
 * Win celebration fanfare.
 */
export function playLevelWin() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.07);

    gain.gain.setValueAtTime(0.28, now + idx * 0.07);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.07);
    osc.stop(now + idx * 0.07 + 0.42);
  });
}

/**
 * Loss sound: Soft gentle descend.
 */
export function playLevelLoss() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [440, 392, 349.23, 293.66];

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + idx * 0.09);

    gain.gain.setValueAtTime(0.2, now + idx * 0.09);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.09);
    osc.stop(now + idx * 0.09 + 0.32);
  });
}
