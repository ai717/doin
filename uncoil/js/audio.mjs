// 倒退贪吃蛇 Uncoil · 程序化音效（WebAudio 合成，零外部音频文件）
// 静音或环境不支持时全部静默降级，绝不抛错。

export class UncoilAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  setEnabled(on) {
    this.enabled = !!on;
  }

  ensure() {
    if (!this.enabled) return null;
    try {
      if (!this.ctx) {
        const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
      }
      if (this.ctx.state === "suspended") this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  tone({ freq = 440, to = null, dur = 0.12, type = "sine", gain = 0.12, delay = 0 }) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  step() {
    this.tone({ freq: 320, to: 380, dur: 0.07, type: "triangle", gain: 0.07 });
  }

  eat() {
    this.tone({ freq: 780, to: 1180, dur: 0.1, type: "sine", gain: 0.12 });
    this.tone({ freq: 1180, to: 720, dur: 0.14, type: "triangle", gain: 0.08, delay: 0.06 });
  }

  blocked() {
    this.tone({ freq: 150, dur: 0.06, type: "square", gain: 0.05 });
  }

  undo() {
    this.tone({ freq: 520, to: 300, dur: 0.09, type: "sine", gain: 0.07 });
  }

  win() {
    [523, 659, 784, 1046].forEach((f, i) => {
      this.tone({ freq: f, dur: 0.16, type: "sine", gain: 0.11, delay: i * 0.09 });
    });
  }

  stuck() {
    this.tone({ freq: 260, to: 90, dur: 0.5, type: "sawtooth", gain: 0.09 });
  }
}
