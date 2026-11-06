// filepath: games/klotski/js/audio.mjs
// 音效：纯 Web Audio 振荡器合成，零外部音频文件。
// 首次用户手势时才创建/解锁 AudioContext；静音或环境不支持时全部安全降级为无声。

let ctx = null;
let master = null;
let muted = false;
let unlocked = false;
let failed = false;

const TONES = {
  move: { type: "triangle", freq: 420, to: 520, dur: 0.09, gain: 0.16 },
  slide: { type: "sine", freq: 300, to: 380, dur: 0.12, gain: 0.14 },
  blocked: { type: "square", freq: 150, to: 110, dur: 0.1, gain: 0.08 },
  undo: { type: "sine", freq: 380, to: 260, dur: 0.12, gain: 0.14 },
  click: { type: "triangle", freq: 660, to: 660, dur: 0.05, gain: 0.12 },
  win: { type: "triangle", freq: 523, to: 784, dur: 0.22, gain: 0.18 },
  star: { type: "sine", freq: 880, to: 1320, dur: 0.18, gain: 0.14 },
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

/** 结算时的三连上行音，star 数量决定音阶数 */
export function playWin(stars = 1) {
  if (muted || failed) return;
  play("win");
  const count = Math.max(1, Math.min(3, stars | 0));
  for (let i = 0; i < count; i++) {
    try {
      if (!ctx) return;
      const delay = 140 + i * 130;
      const now = ctx.currentTime + delay / 1000;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(660 * Math.pow(1.26, i), now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.13, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + 0.24);
    } catch {
      return;
    }
  }
}

/** 供测试与页面卸载时释放资源 */
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
