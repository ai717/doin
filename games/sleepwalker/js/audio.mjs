/**
 * @file games/sleepwalker/js/audio.mjs
 * WebAudio 拟真物理材质与 FM 程序化合成音色。
 * 包含木屐漫步、黄铜机关咬合、卡通弹簧、玻璃梦境泡泡、滑稽坠落滑音、温馨打鼾与胜出和弦。
 * 无外部音频依赖，静音或不支持时静默降级。
 */

let ctx = null;
let enabled = true;

/**
 * 确保 AudioContext 激活
 */
function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!ctx) {
    ctx = new AudioContextClass();
  }
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

export function setSoundEnabled(val) {
  enabled = Boolean(val);
}

export function isSoundEnabled() {
  return enabled;
}

/**
 * 生成一段短白噪声缓冲 (用于打击材质和摩擦沙沙声)
 */
function createNoiseBuffer(ac, duration = 0.2) {
  const bufferSize = Math.floor(ac.sampleRate * duration);
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const output = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/**
 * 1. 拖鞋小步伐轻触声 (物理木质微响)
 */
export function playStepSound() {
  if (!enabled) return;
  const ac = getAudioContext();
  if (!ac) return;

  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const filter = ac.createBiquadFilter();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(140 + Math.random() * 20, now);
  osc.frequency.exponentialRampToValueAtTime(70, now + 0.06);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(400, now);

  gain.gain.setValueAtTime(0.06, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);

  osc.start(now);
  osc.stop(now + 0.07);
}

/**
 * 2. 黄铜机关啮合咔哒声 (金属脆响)
 */
export function playGadgetClickSound() {
  if (!enabled) return;
  const ac = getAudioContext();
  if (!ac) return;

  const now = ac.currentTime;

  // 极短高通金属撞击
  const noise = ac.createBufferSource();
  noise.buffer = createNoiseBuffer(ac, 0.05);
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(2600, now);
  filter.Q.setValueAtTime(6.0, now);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);

  // 辅以金属微谐音
  const osc = ac.createOscillator();
  const oscGain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1280, now);
  osc.frequency.exponentialRampToValueAtTime(640, now + 0.08);

  oscGain.gain.setValueAtTime(0.12, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  osc.connect(oscGain);
  oscGain.connect(ac.destination);

  noise.start(now);
  osc.start(now);
  osc.stop(now + 0.09);
}

/**
 * 3. 卡通雨棚/弹簧鞋弹跳声 (经典卡通 Twang 音效)
 */
export function playBounceSound() {
  if (!enabled) return;
  const ac = getAudioContext();
  if (!ac) return;

  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(560, now + 0.16);

  // 加上快速弹簧颤音
  const lfo = ac.createOscillator();
  const lfoGain = ac.createGain();
  lfo.frequency.setValueAtTime(24, now);
  lfoGain.gain.setValueAtTime(40, now);
  lfo.connect(osc.frequency);

  gain.gain.setValueAtTime(0.22, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

  osc.connect(gain);
  gain.connect(ac.destination);

  lfo.start(now);
  osc.start(now);
  lfo.stop(now + 0.29);
  osc.stop(now + 0.29);
}

/**
 * 4. 梦境金泡泡晶莹拾取声 (FM 调频合成水晶编钟)
 */
export function playBubbleSound() {
  if (!enabled) return;
  const ac = getAudioContext();
  if (!ac) return;

  const now = ac.currentTime;
  const carrier = ac.createOscillator();
  const modulator = ac.createOscillator();
  const modGain = ac.createGain();
  const mainGain = ac.createGain();

  const baseFreq = 987.77; // B5

  carrier.type = 'sine';
  carrier.frequency.setValueAtTime(baseFreq, now);

  modulator.type = 'sine';
  modulator.frequency.setValueAtTime(baseFreq * 2.5, now);

  modGain.gain.setValueAtTime(baseFreq * 1.5, now);
  modGain.gain.exponentialRampToValueAtTime(1.0, now + 0.35);

  mainGain.gain.setValueAtTime(0.18, now);
  mainGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

  modulator.connect(carrier.frequency);
  carrier.connect(mainGain);
  mainGain.connect(ac.destination);

  modulator.start(now);
  carrier.start(now);
  modulator.stop(now + 0.46);
  carrier.stop(now + 0.46);
}

/**
 * 5. 滑稽惊醒与失足下落 (滑稽卡通铜管乐下滑音)
 */
export function playScareSound() {
  if (!enabled) return;
  const ac = getAudioContext();
  if (!ac) return;

  const now = ac.currentTime;
  const osc1 = ac.createOscillator();
  const osc2 = ac.createOscillator();
  const gain = ac.createGain();

  // 失谐双振荡器带来夸张铜管管风
  osc1.type = 'sawtooth';
  osc2.type = 'triangle';

  osc1.frequency.setValueAtTime(580, now);
  osc1.frequency.exponentialRampToValueAtTime(110, now + 0.55);

  osc2.frequency.setValueAtTime(584, now);
  osc2.frequency.exponentialRampToValueAtTime(108, now + 0.55);

  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1400, now);
  filter.frequency.exponentialRampToValueAtTime(300, now + 0.55);

  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.62);
  osc2.stop(now + 0.62);
}

/**
 * 6. 温暖打呼噜音效 (入梦与终点)
 */
export function playSnoreSound() {
  if (!enabled) return;
  const ac = getAudioContext();
  if (!ac) return;

  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const filter = ac.createBiquadFilter();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(80, now);
  osc.frequency.exponentialRampToValueAtTime(105, now + 0.4);
  osc.frequency.exponentialRampToValueAtTime(75, now + 0.8);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(260, now);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.12, now + 0.35);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);

  osc.start(now);
  osc.stop(now + 0.88);
}

/**
 * 7. 5 秒倒带音频回溯 (磁带倒带风)
 */
export function playRewindSound() {
  if (!enabled) return;
  const ac = getAudioContext();
  if (!ac) return;

  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(160, now);
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.22);

  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(600, now);
  filter.Q.setValueAtTime(4.0, now);

  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);

  osc.start(now);
  osc.stop(now + 0.25);
}

/**
 * 8. 通关梦幻礼花和弦 (Maj9 梦幻琶音)
 */
export function playWinSound() {
  if (!enabled) return;
  const ac = getAudioContext();
  if (!ac) return;

  const notes = [261.63, 329.63, 392.0, 493.88, 587.33, 783.99]; // C, E, G, B, D, G (Cmaj9)
  notes.forEach((freq, idx) => {
    const noteTime = ac.currentTime + idx * 0.08;
    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, noteTime);

    gain.gain.setValueAtTime(0.12, noteTime);
    gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.7);

    osc.connect(gain);
    gain.connect(ac.destination);

    osc.start(noteTime);
    osc.stop(noteTime + 0.72);
  });
}
