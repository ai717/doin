// Winter arcade sound design: noise-filtered snow, FM mallets and detuned impacts.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let enabled = true;
  let sprayNodes = null;
  let rollNodes = null;

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
      master.gain.value = muted ? 0 : 0.55;
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

  function noise(seconds, type, frequency, q, gain, decay, delay = 0) {
    const start = ctx.currentTime + delay;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(seconds);
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + decay);
    source.connect(filter).connect(amp).connect(master);
    source.start(start);
    source.stop(start + seconds);
  }

  function mallet(freq, duration, gain, delay = 0) {
    const start = ctx.currentTime + delay;
    const carrier = ctx.createOscillator();
    const modulator = ctx.createOscillator();
    const modGain = ctx.createGain();
    const amp = ctx.createGain();
    carrier.type = "sine";
    carrier.frequency.value = freq;
    modulator.type = "sine";
    modulator.frequency.value = freq * 2.01;
    modGain.gain.setValueAtTime(freq * 0.35, start);
    modGain.gain.exponentialRampToValueAtTime(1, start + duration);
    modulator.connect(modGain).connect(carrier.frequency);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    carrier.connect(amp).connect(master);
    carrier.start(start);
    modulator.start(start);
    carrier.stop(start + duration + 0.04);
    modulator.stop(start + duration + 0.04);
  }

  function thump(freq, duration, gain) {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * 0.45), ctx.currentTime + duration);
    amp.gain.setValueAtTime(gain, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(amp).connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.03);
  }

  function impact(gain = 0.2) {
    const now = ctx.currentTime;
    for (const detune of [-12, 7, 19]) {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(180 + detune, now);
      osc.frequency.exponentialRampToValueAtTime(70 + detune, now + 0.18);
      amp.gain.setValueAtTime(gain / 3, now);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      osc.connect(amp).connect(master);
      osc.start(now);
      osc.stop(now + 0.24);
    }
    noise(0.18, "lowpass", 520, 0.8, gain, 0.16);
  }

  const pentatonic = [587.33, 659.25, 783.99, 880.0, 1046.5];

  const oneShot = {
    jump() {
      if (!ensure()) return;
      mallet(520, 0.18, 0.1);
      mallet(780, 0.12, 0.04, 0.04);
    },
    land() {
      if (!ensure()) return;
      noise(0.16, "lowpass", 360, 0.9, 0.12, 0.14);
    },
    freeze() {
      if (!ensure()) return;
      noise(0.22, "highpass", 2600, 0.9, 0.09, 0.2);
      mallet(1174.66, 0.3, 0.07, 0.02);
    },
    push() {
      if (!ensure()) return;
      noise(0.18, "bandpass", 420, 1.1, 0.13, 0.16);
      thump(150, 0.16, 0.12);
    },
    hit() {
      if (!ensure()) return;
      impact(0.24);
      noise(0.24, "highpass", 2100, 0.7, 0.08, 0.22);
    },
    bounce() {
      if (!ensure()) return;
      noise(0.12, "bandpass", 760, 1.2, 0.1, 0.1);
    },
    chain(count = 3) {
      if (!ensure()) return;
      const steps = Math.max(2, Math.min(5, Math.floor(count)));
      for (let i = 0; i < steps; i += 1) {
        mallet(pentatonic[Math.min(pentatonic.length - 1, i)], 0.32, 0.1, i * 0.06);
      }
    },
    clear() {
      if (!ensure()) return;
      pentatonic.forEach((freq, index) => mallet(freq, 0.5, 0.11, index * 0.09));
      mallet(1567.98, 0.6, 0.06, 0.5);
      noise(0.5, "highpass", 3400, 0.6, 0.05, 0.45);
    },
    hurt() {
      if (!ensure()) return;
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(330, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.4);
      amp.gain.setValueAtTime(0.16, ctx.currentTime);
      amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.42);
      osc.connect(amp).connect(master);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
      noise(0.3, "lowpass", 480, 0.8, 0.12, 0.28);
    },
    item() {
      if (!ensure()) return;
      mallet(1046.5, 0.35, 0.09);
      mallet(1318.51, 0.4, 0.08, 0.08);
    },
    brick() {
      if (!ensure()) return;
      noise(0.28, "highpass", 1800, 0.7, 0.14, 0.26);
      noise(0.16, "bandpass", 900, 1, 0.08, 0.12);
    },
    spring() {
      if (!ensure()) return;
      mallet(392, 0.2, 0.1);
      mallet(659.25, 0.22, 0.08, 0.07);
    },
    boss() {
      if (!ensure()) return;
      impact(0.3);
      thump(90, 0.3, 0.16);
    },
    throw() {
      if (!ensure()) return;
      noise(0.1, "bandpass", 1400, 1.4, 0.05, 0.08);
    },
    click() {
      if (!ensure()) return;
      noise(0.06, "bandpass", 1900, 1.5, 0.05, 0.04);
    },
    page() {
      if (!ensure()) return;
      noise(0.24, "highpass", 1200, 0.6, 0.08, 0.22);
    },
  };

  function startSpray() {
    if (!ensure() || sprayNodes) return;
    try {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(1);
      source.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1500;
      filter.Q.value = 0.7;
      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0.0001, ctx.currentTime);
      amp.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 0.06);
      source.connect(filter).connect(amp).connect(master);
      source.start();
      sprayNodes = { source, amp, filter };
    } catch {
      sprayNodes = null;
    }
  }

  function stopSpray() {
    if (!sprayNodes || !ctx) return;
    const nodes = sprayNodes;
    sprayNodes = null;
    try {
      nodes.amp.gain.cancelScheduledValues(ctx.currentTime);
      nodes.amp.gain.setValueAtTime(Math.max(0.0001, nodes.amp.gain.value), ctx.currentTime);
      nodes.amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
      nodes.source.stop(ctx.currentTime + 0.1);
    } catch {
      // already stopped
    }
  }

  function startRoll() {
    if (!ensure() || rollNodes) return;
    try {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(1);
      source.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 420;
      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0.0001, ctx.currentTime);
      amp.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 0.1);
      const hum = ctx.createOscillator();
      hum.type = "triangle";
      hum.frequency.value = 74;
      const humGain = ctx.createGain();
      humGain.gain.value = 0.02;
      source.connect(filter).connect(amp).connect(master);
      hum.connect(humGain).connect(master);
      source.start();
      hum.start();
      rollNodes = { source, filter, amp, hum, humGain };
    } catch {
      rollNodes = null;
    }
  }

  function updateRoll(speed) {
    if (!rollNodes || !ctx) return;
    const ratio = Math.max(0, Math.min(1, Math.abs(speed) / 700));
    rollNodes.filter.frequency.value = 300 + ratio * 700;
    rollNodes.hum.frequency.value = 60 + ratio * 70;
    rollNodes.amp.gain.value = 0.03 + ratio * 0.07;
  }

  function stopRoll() {
    if (!rollNodes || !ctx) return;
    const nodes = rollNodes;
    rollNodes = null;
    try {
      nodes.amp.gain.cancelScheduledValues(ctx.currentTime);
      nodes.amp.gain.setValueAtTime(Math.max(0.0001, nodes.amp.gain.value), ctx.currentTime);
      nodes.amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1);
      nodes.source.stop(ctx.currentTime + 0.12);
      nodes.hum.stop(ctx.currentTime + 0.12);
    } catch {
      // already stopped
    }
  }

  return {
    play(name, arg) {
      if (muted) return;
      if (!oneShot[name]) return;
      try {
        if (ctx && ctx.state === "suspended") ctx.resume();
        oneShot[name](arg);
      } catch {
        // audio must never break gameplay
      }
    },
    spray(active) {
      if (muted || !active) stopSpray();
      else startSpray();
    },
    roll(active, speed = 0) {
      if (muted) {
        stopRoll();
        return;
      }
      if (!active) stopRoll();
      else {
        startRoll();
        updateRoll(speed);
      }
    },
    setMuted(next) {
      muted = Boolean(next);
      if (master && ctx) master.gain.value = muted ? 0 : 0.55;
      if (muted) {
        stopSpray();
        stopRoll();
      }
    },
    isMuted() {
      return muted;
    },
    unlock() {
      const audio = ensure();
      if (audio && audio.state === "suspended") audio.resume().catch(() => {});
    },
    stopAll() {
      stopSpray();
      stopRoll();
    },
  };
}
