// 线装书专属音色：毛笔落纸、编钟、翻页、木鱼、古琴，全部程序化合成。
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let enabled = true;

  function ensure() {
    if (ctx || !enabled) return ctx;
    try {
      const AudioCtor = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioCtor) {
        enabled = false;
        return null;
      }
      ctx = new AudioCtor();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.6;
      master.connect(ctx.destination);
    } catch {
      enabled = false;
      ctx = null;
    }
    return ctx;
  }

  function noiseBuffer(seconds) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function noise(seconds, type, frequency, q, gain, decay) {
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(seconds);
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + 0.006);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + decay);
    source.connect(filter).connect(amp).connect(master);
    source.start();
    source.stop(ctx.currentTime + seconds);
  }

  function pluck(freq, duration, gain, type = "triangle") {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1800;
    osc.connect(filter).connect(amp).connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  function bell(freq, duration, gain) {
    const carrier = ctx.createOscillator();
    const modulator = ctx.createOscillator();
    const modGain = ctx.createGain();
    const amp = ctx.createGain();
    carrier.type = "sine";
    carrier.frequency.value = freq;
    modulator.type = "sine";
    modulator.frequency.value = freq * 1.41;
    modGain.gain.setValueAtTime(freq * 0.9, ctx.currentTime);
    modGain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + duration);
    modulator.connect(modGain).connect(carrier.frequency);
    amp.gain.setValueAtTime(0.0001, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    carrier.connect(amp).connect(master);
    carrier.start();
    modulator.start();
    carrier.stop(ctx.currentTime + duration + 0.03);
    modulator.stop(ctx.currentTime + duration + 0.03);
  }

  const scales = [523.25, 587.33, 659.25, 783.99, 880.0];

  const play = {
    ink() {
      if (!ensure()) return;
      noise(0.16, "bandpass", 1250, 0.9, 0.16, 0.13);
      pluck(392, 0.09, 0.05, "sine");
    },
    chime(count = 1) {
      if (!ensure()) return;
      const base = scales[Math.min(scales.length - 1, Math.max(0, count - 1))];
      bell(base * 2, 0.85, 0.15);
      bell(base * 3, 0.6, 0.05);
    },
    page() {
      if (!ensure()) return;
      noise(0.3, "highpass", 900, 0.6, 0.14, 0.26);
      noise(0.22, "bandpass", 2400, 0.8, 0.08, 0.18);
    },
    wood() {
      if (!ensure()) return;
      const now = ctx.currentTime;
      for (const [freq, gain] of [[212, 0.11], [224, 0.08]]) {
        const osc = ctx.createOscillator();
        const amp = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        amp.gain.setValueAtTime(gain, now);
        amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
        osc.connect(amp).connect(master);
        osc.start(now);
        osc.stop(now + 0.14);
      }
      noise(0.09, "bandpass", 620, 1.2, 0.08, 0.07);
    },
    guqin() {
      if (!ensure()) return;
      const notes = [261.63, 329.63, 392.0];
      notes.forEach((freq, index) => {
        const delay = index * 0.12;
        const osc = ctx.createOscillator();
        const amp = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
        osc.frequency.linearRampToValueAtTime(freq * 0.992, ctx.currentTime + delay + 0.7);
        filter.type = "lowpass";
        filter.frequency.value = 2200;
        amp.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
        amp.gain.exponentialRampToValueAtTime(0.13, ctx.currentTime + delay + 0.01);
        amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.9);
        osc.connect(filter).connect(amp).connect(master);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 1);
      });
    },
    hint() {
      if (!ensure()) return;
      bell(1046.5, 0.35, 0.09);
    },
    click() {
      if (!ensure()) return;
      noise(0.06, "bandpass", 1800, 1.4, 0.06, 0.04);
    },
    erase() {
      if (!ensure()) return;
      noise(0.12, "bandpass", 520, 1.1, 0.09, 0.09);
    },
  };

  return {
    play(name, arg) {
      if (muted) return;
      if (!play[name]) return;
      try {
        if (ctx && ctx.state === "suspended") ctx.resume();
        play[name](arg);
      } catch {
        // 音频异常不影响游戏。
      }
    },
    setMuted(next) {
      muted = Boolean(next);
      if (master && ctx) master.gain.value = muted ? 0 : 0.6;
    },
    isMuted() {
      return muted;
    },
    unlock() {
      const audio = ensure();
      if (audio && audio.state === "suspended") audio.resume().catch(() => {});
    },
  };
}
