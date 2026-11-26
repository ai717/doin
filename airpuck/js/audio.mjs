/**
 * @file games/airpuck/js/audio.mjs
 * WebAudio 赛博电玩球台程序化合成音效，零外链音频文件。
 * 驱动合金推球脆响、边框回弹、超音速扣杀爆裂、进球警报火花与胜利琶音。
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
 * 手柄击球撞击声（根据球速动态调制硬质合金音色与低音冲量）
 */
export function playHitSound(speed = 400, isDashing = false) {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // 基础音高随球速升高
  const baseFreq = Math.min(880, 260 + (speed / 1400) * 440);
  osc.type = isDashing ? 'sawtooth' : 'triangle';
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);

  const vol = isDashing ? 0.35 : Math.min(0.28, 0.12 + (speed / 1400) * 0.16);
  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + (isDashing ? 0.22 : 0.1));

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + (isDashing ? 0.22 : 0.12));

  // 突进扣杀时额外叠加极速低音冲撞重音 (Sub-bass Punch)
  if (isDashing) {
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(140, now);
    subOsc.frequency.exponentialRampToValueAtTime(35, now + 0.18);

    subGain.gain.setValueAtTime(0.3, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    subOsc.connect(subGain);
    subGain.connect(ctx.destination);

    subOsc.start(now);
    subOsc.stop(now + 0.2);
  }
}

/**
 * 边框弹性回弹微脆响
 */
export function playWallSound(speed = 300) {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.exponentialRampToValueAtTime(160, now + 0.06);

  const vol = Math.min(0.18, 0.06 + (speed / 1400) * 0.12);
  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.07);
}

/**
 * 突进扣杀喷气充能呼啸
 */
export function playDashSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(520, now + 0.14);

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.16);
}

/**
 * 中场电磁加速环雷霆加速声
 */
export function playBoosterSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.exponentialRampToValueAtTime(980, now + 0.16);

  gain.gain.setValueAtTime(0.16, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.18);
}

/**
 * 机关阻抗柱 Bumper 弹跳电铃
 */
export function playBumperSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(740, now);
  osc.frequency.exponentialRampToValueAtTime(420, now + 0.12);

  gain.gain.setValueAtTime(0.22, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.14);
}

/**
 * 破门爆裂得分警报与低音重击
 */
export function playGoalSound(scorer = 'p1') {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // 1. 低音破门轰鸣 (Boom)
  const boomOsc = ctx.createOscillator();
  const boomGain = ctx.createGain();
  boomOsc.type = 'triangle';
  boomOsc.frequency.setValueAtTime(110, now);
  boomOsc.frequency.exponentialRampToValueAtTime(25, now + 0.4);

  boomGain.gain.setValueAtTime(0.35, now);
  boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

  boomOsc.connect(boomGain);
  boomGain.connect(ctx.destination);

  boomOsc.start(now);
  boomOsc.stop(now + 0.45);

  // 2. 破门警报声 (Siren beep)
  const sirenOsc = ctx.createOscillator();
  const sirenGain = ctx.createGain();
  sirenOsc.type = 'sawtooth';
  sirenOsc.frequency.setValueAtTime(scorer === 'p1' ? 620 : 540, now + 0.05);
  sirenOsc.frequency.setValueAtTime(scorer === 'p1' ? 780 : 660, now + 0.2);

  sirenGain.gain.setValueAtTime(0.001, now);
  sirenGain.gain.setValueAtTime(0.18, now + 0.06);
  sirenGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

  sirenOsc.connect(sirenGain);
  sirenGain.connect(ctx.destination);

  sirenOsc.start(now + 0.05);
  sirenOsc.stop(now + 0.4);
}

/**
 * 终局胜利街机凯旋琶音 (Victory Fanfare)
 */
export function playWinFanfare() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const notes = [392.0, 523.25, 659.25, 783.99, 1046.5]; // G4, C5, E5, G5, C6
  notes.forEach((freq, idx) => {
    const now = ctx.currentTime + idx * 0.09;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.36);
  });
}
