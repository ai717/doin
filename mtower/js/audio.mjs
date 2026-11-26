/**
 * @file games/mtower/js/audio.mjs
 * WebAudio 复古暗黑地牢与兵刃碰撞合成音效，零外链音频文件。
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

export function isAudioMuted() {
  return isMuted;
}

/**
 * 石板脚步轻响
 */
export function playMoveSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.exponentialRampToValueAtTime(45, now + 0.05);

  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.06);
}

/**
 * 宝物与钥匙拾取（清脆激昂八度音符）
 */
export function playItemSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  [523.25, 659.25, 783.99].forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.04);

    gain.gain.setValueAtTime(0.12, now + idx * 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.04);
    osc.stop(now + idx * 0.04 + 0.14);
  });
}

/**
 * 攻击与防御宝石强化（红宝石激昂升调，蓝宝石沉稳金石鸣）
 */
export function playGemSound(isDef = false) {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = isDef ? 'triangle' : 'square';
  const startF = isDef ? 220 : 440;
  const endF = isDef ? 440 : 880;

  osc.frequency.setValueAtTime(startF, now);
  osc.frequency.exponentialRampToValueAtTime(endF, now + 0.12);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.15);
}

/**
 * 魔法门与铁门轰鸣开启
 */
export function playDoorSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(60, now + 0.18);

  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.22);
}

/**
 * 剑刃交击肉搏战斗（带金属火花爆破感）
 */
export function playAttackSound(isBoss = false) {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = isBoss ? 'sawtooth' : 'triangle';
  osc.frequency.setValueAtTime(isBoss ? 260 : 480, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + (isBoss ? 0.25 : 0.12));

  gain.gain.setValueAtTime(isBoss ? 0.28 : 0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + (isBoss ? 0.26 : 0.13));

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + (isBoss ? 0.28 : 0.15));
}

/**
 * 楼梯穿梭层级音
 */
export function playStairsSound(isUp = true) {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = isUp ? [330, 440, 554] : [554, 440, 330];

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.05);

    gain.gain.setValueAtTime(0.12, now + idx * 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.05);
    osc.stop(now + idx * 0.05 + 0.12);
  });
}

/**
 * 圣水与十字架神圣洗礼和弦
 */
export function playHolySound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.55);
  });
}

/**
 * 通关登顶胜利圣歌
 */
export function playWinFanfare() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const melody = [523.25, 523.25, 523.25, 659.25, 783.99, 1046.5];
  const times = [0, 0.14, 0.28, 0.44, 0.62, 0.85];

  melody.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + times[idx]);

    gain.gain.setValueAtTime(0.2, now + times[idx]);
    gain.gain.exponentialRampToValueAtTime(0.001, now + times[idx] + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + times[idx]);
    osc.stop(now + times[idx] + 0.4);
  });
}
