// audio.mjs — WebAudio procedural sound synthesis with zero external files

let ctx = null;
let isMuted = false;

function getContext() {
  if (ctx) return ctx;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      ctx = new AudioContextClass();
    }
  } catch {
    ctx = null;
  }
  return ctx;
}

export function initAudioOnGesture() {
  const c = getContext();
  if (c && c.state === "suspended") {
    c.resume().catch(() => {});
  }
}

export function setMuted(muted) {
  isMuted = Boolean(muted);
}

export function getMuted() {
  return isMuted;
}

export function toggleMuted() {
  setMuted(!isMuted);
  return isMuted;
}

export function playClick() {
  if (isMuted) return;
  const c = getContext();
  if (!c) return;
  try {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const t = c.currentTime;

    osc.type = "sine";
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.04);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.045);
  } catch {}
}

export function playCoin() {
  if (isMuted) return;
  const c = getContext();
  if (!c) return;
  try {
    const t = c.currentTime;
    const osc1 = c.createOscillator();
    const osc2 = c.createOscillator();
    const gain = c.createGain();

    osc1.type = "triangle";
    osc2.type = "sine";

    osc1.frequency.setValueAtTime(987.77, t); // B5
    osc1.frequency.setValueAtTime(1318.51, t + 0.06); // E6

    osc2.frequency.setValueAtTime(1975.53, t); // B6
    osc2.frequency.setValueAtTime(2637.02, t + 0.06); // E7

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(c.destination);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.26);
    osc2.stop(t + 0.26);
  } catch {}
}

export function playUpgrade() {
  if (isMuted) return;
  const c = getContext();
  if (!c) return;
  try {
    const t = c.currentTime;
    const notes = [329.63, 440, 554.37, 659.25]; // E4, A4, C#5, E5
    notes.forEach((freq, idx) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      const st = t + idx * 0.05;

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, st);

      gain.gain.setValueAtTime(0.12, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.18);

      osc.connect(gain);
      gain.connect(c.destination);

      osc.start(st);
      osc.stop(st + 0.2);
    });
  } catch {}
}

export function playUnlock() {
  if (isMuted) return;
  const c = getContext();
  if (!c) return;
  try {
    const t = c.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      const st = t + idx * 0.08;

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, st);

      gain.gain.setValueAtTime(0.15, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.35);

      osc.connect(gain);
      gain.connect(c.destination);

      osc.start(st);
      osc.stop(st + 0.38);
    });
  } catch {}
}

export function playSteam() {
  if (isMuted) return;
  const c = getContext();
  if (!c) return;
  try {
    const t = c.currentTime;
    const bufferSize = c.sampleRate * 0.2;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.2;
    }

    const noise = c.createBufferSource();
    noise.buffer = buffer;

    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1200, t);
    filter.Q.setValueAtTime(1.5, t);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);

    noise.start(t);
  } catch {}
}

export function playPrestige() {
  if (isMuted) return;
  const c = getContext();
  if (!c) return;
  try {
    const t = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 1.2);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);

    osc.connect(gain);
    gain.connect(c.destination);

    osc.start(t);
    osc.stop(t + 1.55);
  } catch {}
}
