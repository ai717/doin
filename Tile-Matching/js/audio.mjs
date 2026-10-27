export class AudioManager {
  constructor(enabled = true) {
    this.enabled = enabled;
    this.ctx = null;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    } catch {
      this.ctx = null;
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  playTone(freq, type = 'sine', duration = 0.12, gainVal = 0.15) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // 安全静音降级
    }
  }

  playSelect() {
    this.playTone(520, 'sine', 0.05, 0.08);
  }

  playSwap() {
    this.playTone(360, 'triangle', 0.08, 0.1);
  }

  playMatch(combo = 1) {
    const base = 420;
    const freq = base * Math.pow(1.12, Math.min(combo, 10));
    this.playTone(freq, 'sine', 0.16, 0.18);
  }

  playRocket() {
    this.playTone(280, 'sawtooth', 0.25, 0.15);
  }

  playBomb() {
    this.playTone(140, 'triangle', 0.35, 0.25);
  }

  playRainbow() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 'sine', 0.2, 0.12), idx * 60);
    });
  }

  playInvalid() {
    this.playTone(180, 'sawtooth', 0.09, 0.08);
  }

  playWin() {
    [523, 659, 783, 1046, 1318].forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 'triangle', 0.22, 0.15), idx * 90);
    });
  }

  playDefeat() {
    [392, 349, 311, 261].forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 'sine', 0.25, 0.16), idx * 120);
    });
  }
}
