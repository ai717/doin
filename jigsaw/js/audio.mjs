// filepath: games/jigsaw/js/audio.mjs
// 音效：纯 Web Audio 振荡器合成，零外部音频文件。
// 首次用户手势时才创建/解锁 AudioContext；静音或环境不支持时全部安全降级为无声。

let ctx = null;
let master = null;
let muted = false;
let unlocked = false;
let failed = false;

const TONES = {
  pick: { type: "sine", freq: 520, to: 600, dur: 0.06, gain: 0.1 },
  swap: { type: "triangle", freq: 620, to: 380, dur: 0.11, gain: 0.13 },
  lock: { type: "triangle", freq: 780, to: 780, dur: 0.07, gain: 0.16 },
  reshuffle: { type: "sawtooth", freq: 320, to: 720, dur: 0.22, gain: 0.09 },
  blocked: { type: "square", freq: 170, to: 130, dur: 0.09, gain: 0.07 },
  click: { type: "triangle", freq: 660, to: 660, dur: 0.05, gain: 0.1 },
  win: { type: "triangle", freq: 523, to: 784, dur: 0.24, gain: 0.17 },
  best: { type: "sine", freq: 988, to: 1319, dur: 0.2, gain: 0.14 },
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

export function isReady() {
  return !failed && !!ctx && !muted;
}

/** 播放一个合成音；任何异常都吞掉，绝不打断游戏 */
export function play(name) {
  if (muted || failed) return;
  if (!unlocked) unlock();
  if (!ctx || !master) return;
  const tone = TONES[name];
  if (!tone) return;
  try {
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tone.type;
    osc.frequency.setValueAtTime(tone.freq, now);
    if (tone.to !== tone.freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, tone.to), now + tone.dur);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(tone.gain, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + tone.dur + 0.02);
  } catch {
    /* 音频失败永远不影响玩法 */
  }
}

/** 结算：五声音阶上行琶音；破纪录时再补一声高音叮 */
export function playWin({ isNewBest = false, notes = 5 } = {}) {
  if (muted || failed) return;
  play("win");
  const steps = Math.max(1, Math.min(5, notes | 0));
  const scale = [523.25, 587.33, 659.25, 783.99, 880];
  for (let i = 0; i < steps; i++) {
    try {
      if (!ctx || !master) return;
      const now = ctx.currentTime + (120 + i * 110) / 1000;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(scale[i], now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + 0.26);
    } catch {
      return;
    }
  }
  if (isNewBest) {
    try {
      if (!ctx || !master) return;
      const now = ctx.currentTime + 0.78;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1318.51, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.13, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + 0.34);
    } catch {
      /* 忽略 */
    }
  }
}

/** 供页面卸载时释放资源 */
export function dispose() {
  try {
    if (ctx && typeof ctx.close === "function") ctx.close();
  } catch {
    /* 忽略 */
  }
  ctx = null;
  master = null;
  unlocked = false;
}
