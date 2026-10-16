// 零资源音效：WebAudio 实时合成，专属光学实验台音色。
// - 转动元件：金属旋钮咔哒（噪声缓冲 + 带通滤波）
// - 命中感光核：FM 调频水滴玻音（五声音阶上行）
// - 全靶点亮：失谐双振荡器 + 滑音包络，低音下潜
// - 撤销/重置：轻柔机械回卷（噪声滤波）
// 环境不支持 AudioContext 时静默降级。

const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];

export function createAudio(options = {}) {
  let context = null;
  let muted = Boolean(options.muted);
  let failed = false;

  function ensure() {
    if (context || failed) return context;
    try {
      const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Ctor) {
        failed = true;
        return null;
      }
      context = new Ctor();
    } catch (error) {
      failed = true;
      context = null;
    }
    return context;
  }

  function noiseBuffer(ctx, duration = 0.2) {
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // 金属旋钮咔哒：短噪声 burst 经过带通滤波
  function click() {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    try {
      if (ctx.state === "suspended" && typeof ctx.resume === "function") ctx.resume();
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx, 0.06);
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1800, t);
      filter.Q.value = 6;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start(t);
    } catch (error) {
      // 音频永远不该打断游戏
    }
  }

  // FM 水滴玻音：命中一个感光核，音高随已点亮数抬升
  function hit(litCount) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    try {
      if (ctx.state === "suspended" && typeof ctx.resume === "function") ctx.resume();
      const t = ctx.currentTime;
      const freq = PENTATONIC[Math.min(litCount, PENTATONIC.length - 1)];
      const carrier = ctx.createOscillator();
      const modulator = ctx.createOscillator();
      const modGain = ctx.createGain();
      const gain = ctx.createGain();
      carrier.type = "sine";
      carrier.frequency.value = freq;
      modulator.type = "sine";
      modulator.frequency.value = freq * 1.5;
      modGain.gain.value = freq * 0.6;
      modulator.connect(modGain).connect(carrier.frequency);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      carrier.connect(gain).connect(ctx.destination);
      carrier.start(t);
      modulator.start(t);
      carrier.stop(t + 0.45);
      modulator.stop(t + 0.45);
    } catch (error) {
      // 静默
    }
  }

  // 全靶点亮：失谐双振荡器 + 低音下潜 + 五声阶琶音
  function win() {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    try {
      if (ctx.state === "suspended" && typeof ctx.resume === "function") ctx.resume();
      const t = ctx.currentTime;
      // 低音下潜 kick
      const kick = ctx.createOscillator();
      const kickGain = ctx.createGain();
      kick.type = "sine";
      kick.frequency.setValueAtTime(160, t);
      kick.frequency.exponentialRampToValueAtTime(48, t + 0.25);
      kickGain.gain.setValueAtTime(0.0001, t);
      kickGain.gain.exponentialRampToValueAtTime(0.28, t + 0.02);
      kickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      kick.connect(kickGain).connect(ctx.destination);
      kick.start(t);
      kick.stop(t + 0.35);
      // 五声阶琶音（失谐双振荡器）
      PENTATONIC.slice(0, 5).forEach((freq, i) => {
        const tt = t + 0.15 + i * 0.09;
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        const g = ctx.createGain();
        o1.type = "triangle";
        o2.type = "triangle";
        o1.frequency.value = freq;
        o2.frequency.value = freq * 1.007;
        g.gain.setValueAtTime(0.0001, tt);
        g.gain.exponentialRampToValueAtTime(0.12, tt + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.4);
        o1.connect(g);
        o2.connect(g);
        g.connect(ctx.destination);
        o1.start(tt);
        o2.start(tt);
        o1.stop(tt + 0.45);
        o2.stop(tt + 0.45);
      });
    } catch (error) {
      // 静默
    }
  }

  // 撤销/重置：轻柔机械回卷（低通噪声）
  function rewind() {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    try {
      if (ctx.state === "suspended" && typeof ctx.resume === "function") ctx.resume();
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx, 0.15);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(900, t);
      filter.frequency.exponentialRampToValueAtTime(200, t + 0.15);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.1, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start(t);
    } catch (error) {
      // 静默
    }
  }

  return {
    isMuted: () => muted,
    setMuted(value) {
      muted = Boolean(value);
    },
    unlock() {
      const ctx = ensure();
      if (ctx && ctx.state === "suspended" && typeof ctx.resume === "function") ctx.resume();
    },
    click,
    hit,
    win,
    rewind,
  };
}
