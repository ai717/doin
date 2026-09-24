// filepath: games/sokoban/js/audio.mjs
// 音效：纯 Web Audio 振荡器合成，零外部音频文件。
// 首次用户手势时才创建/解锁 AudioContext；静音或环境不支持时全部安全降级为无声。

let ctx = null;
let master = null;
let muted = false;
let unlocked = false;
let failed = false;

const TONES = {
  move: { type: "triangle", freq: 300, to: 330, dur: 0.08, gain: 0.1 },
  push: { type: "triangle", freq: 200, to: 250, dur: 0.12, gain: 0.2 },
  blocked: { type: "square", freq: 140, to: 105, dur: 0.1, gain: 0.07 },
  undo: { type: "sine", freq: 380, to: 250, dur: 0.12, gain: 0.13 },
  click: { type: "triangle", freq: 640, to: 640, dur: 0.05, gain: 0.11 },
  hint: { type: "sine", freq: 660, to: 990, dur: 0.16, gain: 0.11 },
  win: { type: "triangle", freq: 523, to: 784, dur: 0.24, gain: 0.16 },
  star: { type: "sine", freq: 880, to: 1320, dur: 0.18, gain: 0.12 },
};

function Ctor() {
  if (typeof window === "undefined") return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

/** 在第一次真实用户手势里调用；重复调用无副作用 */
export function unlock() {
  if (failed || unlocked) return !!ctx;
  const AudioCtor = Ctor();
  if (!AudioCtor) {
    failed = true;
    return false;
  }
  try {
    ctx = new AudioCtor();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    unlocked = true;
  } catch {
    ctx = null;
    master = null;
    failed = true;
    return false;
  }
  try {
    if (ctx.state === "suspended") ctx.resume();
  } catch {
    /* 某些浏览器需要更晚的时机恢复，忽略 */
  }
  return true;
}

export function setMuted(value) {
  muted = value === true;
}

export function isMuted() {
  return muted;
}

export function play(name) {
  if (muted || !unlocked || !ctx || !master) return;
  const tone = TONES[name];
  if (!tone) return;
  try {
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tone.type;
    osc.frequency.setValueAtTime(tone.freq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, tone.to), t0 + tone.dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(tone.gain, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + tone.dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + tone.dur + 0.02);
  } catch {
    /* 合成失败静默降级 */
  }
}

/** 胜利音：主音 + 星音快速上行 */
export function playWin(stars) {
  play("win");
  const count = Math.max(1, Math.min(3, stars || 1));
  for (let i = 0; i < count; i++) {
    window.setTimeout(() => play("star"), 180 + i * 160);
  }
}

export function dispose() {
  if (ctx) {
    try { ctx.close(); } catch { /* 忽略 */ }
    ctx = null;
    master = null;
    unlocked = false;
  }
}
