/**
 * 中华客栈 · 跑堂点菜 (Inn Master)
 * 拟真程序化 WebAudio 物理音效合成器 (零外部音频依赖)
 */

let audioCtx = null;
let soundEnabled = true;

function getAudioContext() {
  if (!audioCtx && typeof window !== "undefined") {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function setSoundEnabled(enabled) {
  soundEnabled = Boolean(enabled);
}

export function isSoundEnabled() {
  return soundEnabled;
}

function createNoiseBuffer(ctx, duration = 0.5) {
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/**
 * 1. 添茶：茶水入杯水流声 (带通滤波粉红噪声 + FM 水滴泛音)
 */
export function playPourTea() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const dur = 0.45;

  // 滤波噪声
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, dur);

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(650, now);
  filter.frequency.exponentialRampToValueAtTime(1400, now + dur);
  filter.Q.setValueAtTime(4.0, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.01, now);
  gain.gain.linearRampToValueAtTime(0.18, now + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + dur);

  // 水滴 FM 点缀
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(950, now + 0.15);
  osc.frequency.exponentialRampToValueAtTime(1300, now + 0.28);

  oscGain.gain.setValueAtTime(0.08, now + 0.15);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  osc.start(now + 0.15);
  osc.stop(now + 0.28);
}

/**
 * 2. 上菜：瓷盘落桌清脆共鸣 (短脉冲噪声 + 陶瓷双峰滤波)
 */
export function playServeDish() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const dur = 0.25;

  // 陶瓷撞击脉冲
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = "sine";
  osc2.type = "triangle";

  osc1.frequency.setValueAtTime(1240, now);
  osc1.frequency.exponentialRampToValueAtTime(820, now + dur);

  osc2.frequency.setValueAtTime(2480, now);
  osc2.frequency.exponentialRampToValueAtTime(1600, now + dur);

  gain.gain.setValueAtTime(0.22, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + dur);
  osc2.stop(now + dur);
}

/**
 * 3. 算盘拨珠：木珠撞击连响 (多重脉冲木质高 Q 滤波)
 */
export function playAbacusBead() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const beads = 2;

  for (let i = 0; i < beads; i++) {
    const t = now + i * 0.035;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(880 + Math.random() * 140, t);
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.04);

    gain.gain.setValueAtTime(0.24, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.045);
  }
}

/**
 * 4. 收银：铜钱入柜的清脆金属叮当 (失谐高频金属振荡 + 长余音)
 */
export function playCoinClink() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const freqs = [1760, 2640, 3520];

  for (let i = 0; i < freqs.length; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freqs[i] + (i * 24 - 12), now);

    gain.gain.setValueAtTime(0.12 / (i + 1), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.45);
  }
}

/**
 * 5. 客人满意/小费：木鱼与清脆风铃组合 (高饱和小调琶音)
 */
export function playHappyTip() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [659.25, 783.99, 1046.5]; // E5, G5, C6

  notes.forEach((freq, idx) => {
    const t = now + idx * 0.07;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.35);
  });
}

/**
 * 6. 客人离店：木椅拖动与顿足摩擦声
 */
export function playAngryWalkout() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const dur = 0.32;

  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, dur);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(320, now);
  filter.frequency.linearRampToValueAtTime(140, now + dur);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + dur);
}

/**
 * 7. 桌子擦拭声 (柔和抹布拂动)
 */
export function playCleanTable() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const dur = 0.28;

  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, dur);

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(800, now);
  filter.frequency.exponentialRampToValueAtTime(450, now + dur);
  filter.Q.setValueAtTime(1.5, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + dur);
}
