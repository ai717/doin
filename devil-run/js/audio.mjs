// 恶魔迷途 · 程序化 WebAudio 合成音效（零外部音频文件）
// 手势解锁；静音或不支持时静默降级，绝不抛错打断游戏。
//
// 音色设计基调：木质 + 玩具钢琴的「廉价滑稽感」，
// 让玩家的死亡听起来像被恶作剧，而不是被惩罚。

class SoundSystem {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (AudioContext) this.ctx = new AudioContext();
    } catch {
      // 降级：无音频
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
  }

  isMuted() {
    return this.muted;
  }

  tone({ type = "sine", freq = 440, freqEnd, dur = 0.1, gain = 0.12, delay = 0 }) {
    if (this.muted || !this.ctx) return;
    this.resume();
    try {
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch {
      // ignore
    }
  }

  // 噪声爆（用于碎裂、盖章等打击感）
  noise({ dur = 0.12, gain = 0.1, delay = 0, lowpass = 1800 }) {
    if (this.muted || !this.ctx) return;
    this.resume();
    try {
      const t0 = this.ctx.currentTime + delay;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(lowpass, t0);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.ctx.destination);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
    } catch {
      // ignore
    }
  }

  // ---- 玩家动作 ----

  playJump() {
    this.tone({ type: "square", freq: 300, freqEnd: 540, dur: 0.07, gain: 0.07 });
  }

  playLand() {
    this.noise({ dur: 0.05, gain: 0.05, lowpass: 900 });
  }

  // ---- 陷阱 ----

  // 前兆：轻微、克制的一声「嗯？」（木琴高位）
  playTelegraph() {
    this.tone({ type: "triangle", freq: 880, dur: 0.05, gain: 0.05 });
  }

  // 通用陷阱发动：木琴下行三音，滑稽感来源
  playTrapFire() {
    const notes = [740, 622, 494];
    notes.forEach((f, i) => {
      this.tone({ type: "triangle", freq: f, dur: 0.1, gain: 0.1, delay: i * 0.055 });
    });
  }

  playCollapse() {
    this.noise({ dur: 0.22, gain: 0.11, lowpass: 1200 });
    this.tone({ type: "sawtooth", freq: 200, freqEnd: 70, dur: 0.2, gain: 0.06 });
  }

  playSpike() {
    this.tone({ type: "square", freq: 1200, freqEnd: 1800, dur: 0.05, gain: 0.08 });
    this.noise({ dur: 0.06, gain: 0.06, lowpass: 4000 });
  }

  playCeiling() {
    this.noise({ dur: 0.3, gain: 0.13, lowpass: 700 });
    this.tone({ type: "sine", freq: 120, freqEnd: 55, dur: 0.3, gain: 0.1 });
  }

  playSpring() {
    this.tone({ type: "square", freq: 260, freqEnd: 1400, dur: 0.18, gain: 0.09 });
  }

  playVanish() {
    this.tone({ type: "sine", freq: 900, freqEnd: 200, dur: 0.18, gain: 0.07 });
  }

  playPortal() {
    this.tone({ type: "sine", freq: 480, freqEnd: 1100, dur: 0.14, gain: 0.09 });
    this.tone({ type: "sine", freq: 1100, freqEnd: 480, dur: 0.14, gain: 0.07, delay: 0.09 });
  }

  playGravityFlip() {
    // 上下颠倒：一个方向感的扫频
    this.tone({ type: "triangle", freq: 200, freqEnd: 700, dur: 0.22, gain: 0.1 });
    this.tone({ type: "triangle", freq: 700, freqEnd: 200, dur: 0.22, gain: 0.08, delay: 0.1 });
  }

  playReverse() {
    this.tone({ type: "sawtooth", freq: 420, freqEnd: 300, dur: 0.16, gain: 0.07 });
    this.tone({ type: "sawtooth", freq: 300, freqEnd: 420, dur: 0.16, gain: 0.07, delay: 0.08 });
  }

  playGoalGone() {
    this.tone({ type: "sine", freq: 660, freqEnd: 330, dur: 0.26, gain: 0.09 });
    this.tone({ type: "sine", freq: 330, freqEnd: 165, dur: 0.26, gain: 0.06, delay: 0.12 });
  }

  // ---- 死亡 / 重生 ----

  // 死亡：闷闷的一声「啵」，短促不刺耳（零惩罚心态）
  playDeath() {
    this.tone({ type: "sine", freq: 320, freqEnd: 80, dur: 0.16, gain: 0.1 });
    this.noise({ dur: 0.12, gain: 0.07, lowpass: 600 });
  }

  playRespawn() {
    this.tone({ type: "triangle", freq: 400, freqEnd: 700, dur: 0.1, gain: 0.07 });
  }

  // ---- 收集与结算 ----

  // 蜡烛：风铃上行，温柔
  playCandle() {
    const notes = [784, 988, 1175];
    notes.forEach((f, i) => {
      this.tone({ type: "sine", freq: f, dur: 0.16, gain: 0.1, delay: i * 0.07 });
    });
  }

  // 通关：四级上行琶音
  playWin() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => {
      this.tone({ type: "triangle", freq: f, dur: 0.18, gain: 0.12, delay: i * 0.09 });
    });
    this.tone({ type: "sine", freq: 1318, dur: 0.36, gain: 0.1, delay: 0.38 });
  }

  // 盖章：一声扎实的「咚」
  playSeal() {
    this.tone({ type: "sine", freq: 180, freqEnd: 120, dur: 0.16, gain: 0.14 });
    this.noise({ dur: 0.1, gain: 0.1, lowpass: 800 });
  }

  // 无伤印：更亮的加成音
  playFlawless() {
    this.tone({ type: "sine", freq: 1046, dur: 0.16, gain: 0.11 });
    this.tone({ type: "sine", freq: 1568, dur: 0.24, gain: 0.11, delay: 0.1 });
  }

  // 按钮
  playClick() {
    this.tone({ type: "square", freq: 620, dur: 0.04, gain: 0.05 });
  }
}

export const audio = new SoundSystem();
export default audio;
