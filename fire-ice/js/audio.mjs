// 森林冰火人 · 程序化 WebAudio 合成音效（零外部音频依赖）
// 手势解锁；静音或不支持时静默降级

class SoundSystem {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    } catch {
      // 降级
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

  tone({ type = "sine", freq = 440, freqEnd, dur = 0.1, gain = 0.15, delay = 0 }) {
    if (this.muted || !this.ctx) return;
    this.resume();
    try {
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (freqEnd) {
        osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
      }
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

  playJump() {
    this.tone({ type: "square", freq: 320, freqEnd: 520, dur: 0.07, gain: 0.08 });
  }

  playPlate() {
    this.tone({ type: "triangle", freq: 180, freqEnd: 120, dur: 0.09, gain: 0.14 });
  }

  playDoor(open) {
    if (open) {
      this.tone({ type: "sine", freq: 240, freqEnd: 380, dur: 0.18, gain: 0.1 });
    } else {
      this.tone({ type: "sine", freq: 300, freqEnd: 200, dur: 0.12, gain: 0.08 });
    }
  }

  playGem(kind, count = 0) {
    // 三音风铃上行，音高随收集数微升
    const base = kind === "red" ? 620 : kind === "blue" ? 560 : 700;
    const step = Math.min(8, count) * 14;
    this.tone({ type: "sine", freq: base + step, dur: 0.12, gain: 0.12 });
    this.tone({ type: "sine", freq: (base + step) * 1.33, dur: 0.12, gain: 0.09, delay: 0.06 });
    this.tone({ type: "sine", freq: (base + step) * 1.5, dur: 0.16, gain: 0.09, delay: 0.12 });
  }

  playDeath() {
    this.tone({ type: "sawtooth", freq: 260, freqEnd: 90, dur: 0.28, gain: 0.1 });
  }

  playPortal() {
    this.tone({ type: "sine", freq: 500, freqEnd: 900, dur: 0.16, gain: 0.1 });
    this.tone({ type: "sine", freq: 900, freqEnd: 500, dur: 0.16, gain: 0.08, delay: 0.1 });
  }

  playFreeze() {
    this.tone({ type: "triangle", freq: 900, freqEnd: 1400, dur: 0.2, gain: 0.12 });
  }

  playWin() {
    // 双声部合声：火色琶音 + 冰色清音
    const fire = [440, 554, 659];
    const ice = [523, 659, 784];
    fire.forEach((f, idx) => {
      this.tone({ type: "triangle", freq: f, dur: 0.2, gain: 0.13, delay: idx * 0.11 });
    });
    ice.forEach((f, idx) => {
      this.tone({ type: "sine", freq: f, dur: 0.22, gain: 0.1, delay: idx * 0.11 + 0.05 });
    });
    this.tone({ type: "sine", freq: 880, dur: 0.4, gain: 0.14, delay: 0.36 });
  }

  playStar() {
    this.tone({ type: "sine", freq: 1046, dur: 0.18, gain: 0.12 });
    this.tone({ type: "sine", freq: 1318, dur: 0.22, gain: 0.12, delay: 0.08 });
  }
}

export const audio = new SoundSystem();
