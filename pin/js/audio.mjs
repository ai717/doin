/**
 * @file games/pin/js/audio.mjs
 * 钟表工坊机械声学程序化合成音频模块，严格零外部音频资源依赖。
 * 基于 WebAudio 拟真合成击锤释放、金石交鸣入木声（连击升调）、金属撞瘪与擒纵滴答音。
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
 * 击发瞬间：发条弹簧击锤释放的干脆啪嗒声
 */
export function playLaunchSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(520, now);
  osc.frequency.exponentialRampToValueAtTime(140, now + 0.04);

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.05);
}

/**
 * 命中扎入：金石交鸣清脆磬音，伴随连击数呈五声音阶递增 (C5 - D5 - E5 - G5 - A5 - C6)
 */
export function playHitSound(combo = 1) {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]; // C5, D5, E5, G5, A5, C6
  const noteIdx = Math.min(scale.length - 1, Math.max(0, (combo - 1) % scale.length));
  const baseFreq = scale[noteIdx];

  // FM 调频合成水晶/金石清脆击声
  const carrier = ctx.createOscillator();
  const modulator = ctx.createOscillator();
  const modGain = ctx.createGain();
  const mainGain = ctx.createGain();

  carrier.type = 'sine';
  carrier.frequency.setValueAtTime(baseFreq, now);

  modulator.type = 'triangle';
  modulator.frequency.setValueAtTime(baseFreq * 2.5, now);

  modGain.gain.setValueAtTime(baseFreq * 1.2, now);
  modGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  mainGain.gain.setValueAtTime(0.32, now);
  mainGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

  modulator.connect(modGain);
  modGain.connect(carrier.frequency);
  carrier.connect(mainGain);
  mainGain.connect(ctx.destination);

  modulator.start(now);
  carrier.start(now);
  modulator.stop(now + 0.25);
  carrier.stop(now + 0.25);
}

/**
 * 碰撞失败：金属针尖撞击剧烈炸裂声
 */
export function playCollisionSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'sawtooth';
  osc2.type = 'square';
  osc1.frequency.setValueAtTime(180, now);
  osc1.frequency.linearRampToValueAtTime(60, now + 0.14);
  osc2.frequency.setValueAtTime(220, now);
  osc2.frequency.linearRampToValueAtTime(50, now + 0.14);

  gain.gain.setValueAtTime(0.4, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.2);
  osc2.stop(now + 0.2);
}

/**
 * 通关胜利：金色机械报时大和弦琶音
 */
export function playWinSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const arpeggio = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C大和弦
  arpeggio.forEach((freq, idx) => {
    const noteTime = ctx.currentTime + idx * 0.08;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, noteTime);

    gain.gain.setValueAtTime(0.001, noteTime);
    gain.gain.linearRampToValueAtTime(0.2, noteTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(noteTime);
    osc.stop(noteTime + 0.45);
  });
}
