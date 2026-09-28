// audio.mjs: 云朵合成程序化合成音效库（WebAudio 零外部音频文件）
// 手势解锁，静音或不支持时静默降级。

let ctx = null;
let isMuted = false;

function getContext() {
  if (isMuted) return null;
  if (!ctx && typeof window !== "undefined") {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      try {
        ctx = new AudioCtx();
      } catch {
        ctx = null;
      }
    }
  }
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

export function setMuted(muted) {
  isMuted = !!muted;
}

export function playDrop() {
  const c = getContext();
  if (!c) return;
  try {
    const now = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(c.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  } catch {}
}

export function playMerge(level = 2, chain = 1) {
  const c = getContext();
  if (!c) return;
  try {
    const now = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();

    const baseFreq = 260 + level * 42 + Math.min(chain, 8) * 35;
    osc.type = "triangle";
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.35, now + 0.15);

    const volume = Math.min(0.24, 0.14 + (chain - 1) * 0.02);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(c.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  } catch {}
}

export function playRain() {
  const c = getContext();
  if (!c) return;
  try {
    const now = c.currentTime;
    // 柔和白噪声模拟雨声
    const bufferSize = c.sampleRate * 0.4;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.05;
    }

    const noise = c.createBufferSource();
    noise.buffer = buffer;

    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(800, now);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);

    noise.start(now);
    noise.stop(now + 0.4);
  } catch {}
}

export function playThunder() {
  const c = getContext();
  if (!c) return;
  try {
    const now = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.45);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(c.destination);

    osc.start(now);
    osc.stop(now + 0.45);
  } catch {}
}

export function playRainbow() {
  const c = getContext();
  if (!c) return;
  try {
    const now = c.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C 大三和弦
    notes.forEach((freq, idx) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      const startTime = now + idx * 0.06;

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.12, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(c.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.35);
    });
  } catch {}
}

export function playGameOver() {
  const c = getContext();
  if (!c) return;
  try {
    const now = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.4);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(c.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  } catch {}
}
