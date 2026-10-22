// audio.mjs — WebAudio 程序化合成音效（零外部音频文件）

let ctx = null;
let muted = false;
let unlocked = false;

function ensure() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
  } catch (e) { ctx = null; }
  return ctx;
}

export function unlock() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume().then(() => { unlocked = true; });
}

export function setMuted(m) { muted = m; }
export function isMuted() { return muted; }

function playTone(freq, duration = 0.15, type = 'sine', volume = 0.15, delay = 0) {
  if (muted) return;
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

// 点击牌：短促的"嗒"
export function click() {
  playTone(600, 0.06, 'triangle', 0.08);
}

// 选中两张后浮出运算符面板：上扬短音
export function ready() {
  playTone(520, 0.08, 'sine', 0.1);
  playTone(780, 0.08, 'sine', 0.1, 0.06);
}

// 合并运算：两个音叠加，像"咔哒"一声
export function merge(op) {
  // 根据运算符给不同音色
  const base = { '+': 440, '-': 330, '*': 660, '/': 550 }[op] || 440;
  playTone(base, 0.09, 'square', 0.12);
  playTone(base * 1.5, 0.07, 'triangle', 0.08, 0.02);
}

// 胜利：上扬 5 音阶
export function win() {
  const notes = [523, 659, 784, 1046];
  notes.forEach((n, i) => playTone(n, 0.18, 'triangle', 0.12, i * 0.1));
}

// 失败：下沉音
export function lose() {
  playTone(440, 0.15, 'sawtooth', 0.1);
  playTone(220, 0.25, 'sawtooth', 0.1, 0.12);
}

// Hint：提示音
export function hint() {
  playTone(880, 0.08, 'sine', 0.1);
  playTone(660, 0.08, 'sine', 0.08, 0.07);
}

// Invalid 操作（除零、未选两张等）：低沉拒绝音
export function invalid() {
  playTone(180, 0.1, 'square', 0.08);
}
