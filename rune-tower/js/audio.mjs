// WebAudio 程序化音频合成系统（零外链依赖，纯代码合成音效）

class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  toggle(enabled) {
    this.enabled = typeof enabled === "boolean" ? enabled : !this.enabled;
    return this.enabled;
  }

  playTone(freq, type = "sine", duration = 0.15, gainVal = 0.1) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(gainVal, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch {
      // 忽略自动播放受限异常
    }
  }

  playTowerFire(type) {
    if (!this.enabled) return;
    switch (type) {
      case "arcane":
        this.playTone(680, "triangle", 0.08, 0.08);
        break;
      case "flame":
        this.playTone(180, "sawtooth", 0.18, 0.12);
        break;
      case "frost":
        this.playTone(820, "sine", 0.12, 0.07);
        break;
      case "storm":
        this.playTone(440, "square", 0.14, 0.09);
        break;
    }
  }

  playRelicDraft() {
    if (!this.enabled) return;
    this.playTone(523.25, "sine", 0.2, 0.12); // C5
    setTimeout(() => this.playTone(659.25, "sine", 0.25, 0.12), 100); // E5
    setTimeout(() => this.playTone(783.99, "sine", 0.35, 0.15), 200); // G5
  }

  playWaveStart() {
    if (!this.enabled) return;
    this.playTone(220, "sawtooth", 0.3, 0.14);
    setTimeout(() => this.playTone(330, "sawtooth", 0.4, 0.16), 120);
  }

  playCrystalHurt() {
    if (!this.enabled) return;
    this.playTone(130, "triangle", 0.25, 0.2);
  }

  playVictory() {
    if (!this.enabled) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, "triangle", 0.4, 0.15), idx * 140);
    });
  }

  playDefeat() {
    if (!this.enabled) return;
    const notes = [440, 415.3, 392, 349.23];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, "sawtooth", 0.5, 0.18), idx * 180);
    });
  }
}

export const sound = new SoundFX();
