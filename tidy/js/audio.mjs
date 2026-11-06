/**
 * @file games/tidy/js/audio.mjs
 * 考究入微的 ASMR 物理声学程序化合成音频模块，严格零外部音频资源依赖。
 * 基于 WebAudio 拟真合成木质轻磕、磁吸搭扣、金属咬合、布料软扑与治愈拍立得定格音。
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
 * 拾起物件：轻柔微风悬浮微响
 */
export function playPickSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(260, now);
  osc.frequency.exponentialRampToValueAtTime(380, now + 0.08);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(800, now);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.1);
}

/**
 * 旋转物件：清脆棘轮刻度卡嗒声
 */
export function playRotateSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(640, now);
  osc.frequency.exponentialRampToValueAtTime(320, now + 0.04);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.05);
}

/**
 * 吸附卡入专属材质音效 (ASMR 核心)
 * @param {string} material 'wood' | 'plastic' | 'metal' | 'fabric' | 'food'
 */
export function playSnapSound(material = 'wood') {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  if (material === 'wood') {
    // 1. 原木温润轻磕声：带通滤波 + 沉稳硬木敲击
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.08);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(420, now);
    filter.Q.setValueAtTime(3.5, now);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.13);
  } else if (material === 'plastic') {
    // 2. 磁吸口红/化妆盒闭合声：双次微短沉稳咔嗒 (Ka-Chunk)
    [0, 0.025].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(idx === 0 ? 320 : 180, now + offset);
      gain.gain.setValueAtTime(idx === 0 ? 0.2 : 0.35, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.05);
    });
  } else if (material === 'metal') {
    // 3. 高亢清脆金属叮声：双振荡器高频泛音
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(1420, now);
    osc2.frequency.setValueAtTime(2840, now);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.2);
    osc2.stop(now + 0.2);
  } else if (material === 'fabric') {
    // 4. 柔软布料/羊毛大衣：松弛低频入槽声
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.linearRampToValueAtTime(70, now + 0.12);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(280, now);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  } else {
    // 5. 便当美食：饱满圆润 Q 弹水滴音 (Bloop)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.1);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }
}

/**
 * 吸附失败微弹回声：柔和温润的波波声 (零挫败感)
 */
export function playRejectSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(260, now);
  osc.frequency.exponentialRampToValueAtTime(180, now + 0.09);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.11);
}

/**
 * 透视微光提示音：晶莹闪烁水晶音
 */
export function playHintSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
  notes.forEach((freq, idx) => {
    const noteTime = ctx.currentTime + idx * 0.06;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, noteTime);

    gain.gain.setValueAtTime(0.001, noteTime);
    gain.gain.linearRampToValueAtTime(0.1, noteTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(noteTime);
    osc.stop(noteTime + 0.25);
  });
}

/**
 * 通关合盖与拍立得烫金定格全景音
 */
export function playClearSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  // 1. 舒缓治愈的八音盒大和弦琵音 (F - A - C - E - G)
  const arpeggio = [349.23, 440.0, 523.25, 659.25, 783.99, 1046.5];
  arpeggio.forEach((freq, idx) => {
    const noteTime = ctx.currentTime + idx * 0.08;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, noteTime);

    gain.gain.setValueAtTime(0.001, noteTime);
    gain.gain.linearRampToValueAtTime(0.18, noteTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(noteTime);
    osc.stop(noteTime + 0.5);
  });

  // 2. 拍立得快门与玻璃合盖啪嗒声
  const latchTime = ctx.currentTime + 0.65;
  const oscL = ctx.createOscillator();
  const gainL = ctx.createGain();
  oscL.type = 'sine';
  oscL.frequency.setValueAtTime(160, latchTime);
  oscL.frequency.exponentialRampToValueAtTime(60, latchTime + 0.1);
  gainL.gain.setValueAtTime(0.28, latchTime);
  gainL.gain.exponentialRampToValueAtTime(0.001, latchTime + 0.12);
  oscL.connect(gainL);
  gainL.connect(ctx.destination);
  oscL.start(latchTime);
  oscL.stop(latchTime + 0.13);
}
