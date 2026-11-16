// audio.mjs — 矿坑竖井专属 WebAudio 合成音色。
// 物理撞击用噪声缓冲 + BiquadFilter 动态滤波；弹簧与胜利反馈用 FM 调频；
// 全部程序化生成，零外部音频文件；不支持或被静音时静默降级。

export function createAudio() {
  let ctx = null;
  let enabled = true;
  let noise = null;
  let wind = null;

  function ensure() {
    if (typeof window === "undefined") return null;
    if (ctx) return ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function unlock() {
    const ac = ensure();
    if (!ac) return;
    if (ac.state === "suspended") {
      try {
        ac.resume();
      } catch {
        // 静默
      }
    }
  }

  function now() {
    return ctx ? ctx.currentTime : 0;
  }

  function noiseBuffer() {
    const ac = ensure();
    if (!ac) return null;
    if (noise) return noise;
    const seconds = 2;
    const length = Math.max(1, Math.floor(ac.sampleRate * seconds));
    const buffer = ac.createBuffer(1, length, ac.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 0x51a1f7;
    for (let i = 0; i < length; i += 1) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[i] = (seed / 4294967296) * 2 - 1;
    }
    noise = buffer;
    return noise;
  }

  function ready() {
    if (!enabled) return null;
    const ac = ensure();
    if (!ac || ac.state === "suspended") return null;
    return ac;
  }

  /** 噪声通道：材质撞击、刮擦、碎裂都走这一条。 */
  function noiseHit({ type = "lowpass", frequency = 400, q = 0.9, gain = 0.4, decay = 0.12, delay = 0 }) {
    const ac = ready();
    if (!ac) return;
    const buffer = noiseBuffer();
    if (!buffer) return;
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ac.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const amp = ac.createGain();
    const t = now() + delay;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(filter).connect(amp).connect(ac.destination);
    src.start(t);
    src.stop(t + decay + 0.02);
  }

  /** FM 调频：马林巴/编钟/金属簧片质感。 */
  function fmTone({ carrier = 420, mod = 1260, ratio = 3, gain = 0.12, decay = 0.32, delay = 0, bend = 0 }) {
    const ac = ready();
    if (!ac) return;
    const t = now() + delay;
    const osc = ac.createOscillator();
    const modulator = ac.createOscillator();
    const modGain = ac.createGain();
    const amp = ac.createGain();
    osc.type = "triangle";
    modulator.type = "sine";
    osc.frequency.setValueAtTime(carrier, t);
    if (bend) osc.frequency.linearRampToValueAtTime(carrier + bend, t + decay);
    modulator.frequency.value = carrier * ratio;
    modGain.gain.value = mod;
    osc.connect(amp).connect(ac.destination);
    modulator.connect(modGain).connect(osc.frequency);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.start(t);
    modulator.start(t);
    osc.stop(t + decay + 0.02);
    modulator.stop(t + decay + 0.02);
  }

  function tone({ frequency = 220, type = "sine", gain = 0.1, decay = 0.2, delay = 0, endFrequency = null }) {
    const ac = ready();
    if (!ac) return;
    const t = now() + delay;
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, t);
    if (endFrequency !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), t + decay);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.connect(amp).connect(ac.destination);
    osc.start(t);
    osc.stop(t + decay + 0.02);
  }

  return {
    unlock,
    setEnabled(value) {
      enabled = !!value;
      if (!enabled) this.wind(false);
    },
    get enabled() {
      return enabled;
    },
    click() {
      noiseHit({ type: "highpass", frequency: 2400, gain: 0.16, decay: 0.05 });
      tone({ frequency: 520, type: "triangle", gain: 0.05, decay: 0.05 });
    },
    land() {
      noiseHit({ type: "lowpass", frequency: 300, q: 0.7, gain: 0.42, decay: 0.13 });
      tone({ frequency: 72, type: "sine", gain: 0.22, decay: 0.16 });
    },
    heal() {
      fmTone({ carrier: 620, mod: 480, ratio: 2, gain: 0.1, decay: 0.3 });
      fmTone({ carrier: 880, mod: 300, ratio: 1.5, gain: 0.07, decay: 0.24, delay: 0.06 });
    },
    spike() {
      noiseHit({ type: "highpass", frequency: 2800, q: 1.4, gain: 0.34, decay: 0.09 });
      noiseHit({ type: "bandpass", frequency: 1200, q: 2.2, gain: 0.2, decay: 0.18, delay: 0.04 });
      tone({ frequency: 180, type: "square", gain: 0.1, decay: 0.12, endFrequency: 90 });
    },
    spring() {
      fmTone({ carrier: 300, mod: 900, ratio: 4, gain: 0.16, decay: 0.34, bend: 260 });
      tone({ frequency: 460, type: "sawtooth", gain: 0.06, decay: 0.26, endFrequency: 980 });
    },
    crumble() {
      noiseHit({ type: "bandpass", frequency: 1500, q: 2.4, gain: 0.3, decay: 0.1 });
      noiseHit({ type: "bandpass", frequency: 900, q: 2, gain: 0.22, decay: 0.12, delay: 0.08 });
      noiseHit({ type: "highpass", frequency: 2600, q: 1.2, gain: 0.18, decay: 0.2, delay: 0.16 });
    },
    conveyor() {
      noiseHit({ type: "lowpass", frequency: 900, q: 1.1, gain: 0.24, decay: 0.1 });
      tone({ frequency: 240, type: "square", gain: 0.06, decay: 0.1 });
    },
    ceiling() {
      tone({ frequency: 58, type: "square", gain: 0.16, decay: 0.16 });
      tone({ frequency: 58, type: "square", gain: 0.12, decay: 0.14, delay: 0.18 });
      noiseHit({ type: "lowpass", frequency: 220, gain: 0.2, decay: 0.24 });
    },
    floorTick() {
      fmTone({ carrier: 740, mod: 220, ratio: 2, gain: 0.06, decay: 0.14 });
    },
    win() {
      fmTone({ carrier: 523, mod: 380, ratio: 2.5, gain: 0.12, decay: 0.42 });
      fmTone({ carrier: 659, mod: 420, ratio: 2.5, gain: 0.11, decay: 0.4, delay: 0.12 });
      fmTone({ carrier: 880, mod: 520, ratio: 2.5, gain: 0.12, decay: 0.55, delay: 0.24 });
      noiseHit({ type: "highpass", frequency: 3200, gain: 0.12, decay: 0.4, delay: 0.1 });
    },
    lose() {
      tone({ frequency: 220, type: "sawtooth", gain: 0.16, decay: 0.55, endFrequency: 55 });
      tone({ frequency: 214, type: "sawtooth", gain: 0.12, decay: 0.6, endFrequency: 48 });
      noiseHit({ type: "lowpass", frequency: 260, gain: 0.3, decay: 0.6, delay: 0.1 });
    },
    wind(on) {
      const ac = ready();
      if (!ac) {
        if (!on) {
          try {
            wind?.source.stop();
          } catch {
            // 已停止
          }
          wind = null;
        }
        return;
      }
      if (on) {
        if (wind) return;
        const buffer = noiseBuffer();
        if (!buffer) return;
        const src = ac.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        const filter = ac.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 1400;
        filter.Q.value = 1.2;
        const amp = ac.createGain();
        amp.gain.setValueAtTime(0.0001, now());
        amp.gain.linearRampToValueAtTime(0.05, now() + 0.18);
        src.connect(filter).connect(amp).connect(ac.destination);
        src.start();
        wind = { src, amp };
        return;
      }
      if (!wind) return;
      const { src, amp } = wind;
      const t = now();
      try {
        amp.gain.linearRampToValueAtTime(0.0001, t + 0.14);
        src.stop(t + 0.18);
      } catch {
        // 已停止
      }
      wind = null;
    },
  };
}
