/**
 * 程序化合成音效 (WebAudio，零外部音频资源)
 */

let ctx = null;
let isEnabled = true;

function getContext() {
  if (!ctx && typeof window !== "undefined") {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      ctx = new AudioContext();
    }
  }
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

export function setAudioEnabled(enabled) {
  isEnabled = Boolean(enabled);
}

export function getAudioEnabled() {
  return isEnabled;
}

/**
 * 木质滑块单次推击声
 */
export function playSlideSound() {
  if (!isEnabled) return;
  const audio = getContext();
  if (!audio) return;

  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  const filter = audio.createBiquadFilter();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(140, now);
  osc.frequency.exponentialRampToValueAtTime(45, now + 0.07);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(600, now);
  filter.frequency.exponentialRampToValueAtTime(120, now + 0.07);

  gain.gain.setValueAtTime(0.35, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audio.destination);

  osc.start(now);
  osc.stop(now + 0.08);
}

/**
 * 跨格多块连推级联音
 */
export function playCascadeSound(count = 2) {
  if (!isEnabled) return;
  const audio = getContext();
  if (!audio) return;

  const n = Math.min(count, 4);
  for (let i = 0; i < n; i++) {
    const delay = i * 0.035;
    const now = audio.currentTime + delay;
    const osc = audio.createOscillator();
    const gain = audio.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(180 + i * 40, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.05);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(audio.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  }
}

/**
 * 滑块入位清脆微响
 */
export function playTileHomeSound() {
  if (!isEnabled) return;
  const audio = getContext();
  if (!audio) return;

  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.exponentialRampToValueAtTime(1200, now + 0.09);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

  osc.connect(gain);
  gain.connect(audio.destination);

  osc.start(now);
  osc.stop(now + 0.1);
}

/**
 * 通关大调和弦鸣响
 */
export function playVictorySound() {
  if (!isEnabled) return;
  const audio = getContext();
  if (!audio) return;

  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
  notes.forEach((freq, idx) => {
    const now = audio.currentTime + idx * 0.09;
    const osc = audio.createOscillator();
    const gain = audio.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(audio.destination);

    osc.start(now);
    osc.stop(now + 0.48);
  });
}
