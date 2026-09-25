// 盲盒竞拍 · WebAudio 程序化合成音效（零外部音频文件）
// 手势解锁：首次用户交互才创建 AudioContext；静音 / 不支持时静默降级。

let ctx = null;
let muted = false;

function ensure() {
  if (ctx) return true;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    return true;
  } catch (e) {
    return false;
  }
}

function tone(freq, duration, { type = "sine", gain = 0.15, delay = 0, slide = 0 } = {}) {
  if (!ctx || muted) return;
  try {
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + duration);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  } catch (e) {
    // ignore
  }
}

function arpeggio(notes, step = 0.09, gain = 0.12) {
  notes.forEach((f, i) => tone(f, 0.22, { type: "triangle", gain, delay: i * step }));
}

const BANKS = {
  ui: () => tone(660, 0.06, { type: "triangle", gain: 0.08 }),
  bid: () => tone(480, 0.05, { type: "square", gain: 0.07 }),
  skill: () => arpeggio([520, 660, 780], 0.05, 0.09),
  hammer: () => {
    tone(170, 0.09, { type: "triangle", gain: 0.2 });
    tone(90, 0.16, { type: "sine", gain: 0.18, delay: 0.02 });
  },
  snipe: () => {
    tone(220, 0.09, { type: "triangle", gain: 0.2 });
    tone(330, 0.12, { type: "triangle", gain: 0.16, delay: 0.07 });
  },
  openWin: () => arpeggio([523, 659, 784, 1047], 0.09, 0.14),
  openLose: () => tone(300, 0.22, { type: "sine", gain: 0.16, slide: -160 }),
  tick: () => tone(880, 0.04, { type: "square", gain: 0.06 }),
  done: () => arpeggio([392, 523, 659, 784], 0.11, 0.13),
  toast: () => tone(560, 0.07, { type: "triangle", gain: 0.09 }),
};

export function init() {
  ensure();
}

export function play(name) {
  const fn = BANKS[name];
  if (!fn) return;
  if (!ensure()) return;
  fn();
}

export function setMuted(value) {
  muted = Boolean(value);
}

export function isMuted() {
  return muted;
}
