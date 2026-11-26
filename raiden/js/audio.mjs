// Arcade sound design: detuned pulse shots, FM pings, filtered noise bursts and a charge hum.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let enabled = true;
  let chargeNodes = null;

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
      master.gain.value = muted ? 0 : 0.5;
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
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.007);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + decay);
    source.connect(filter).connect(amp).connect(master);
    source.start(start);
    source.stop(start + seconds);
  }

  function ping(freq, duration, gain, delay = 0) {
    const start = ctx.currentTime + delay;
    const carrier = ctx.createOscillator();
    const modulator = ctx.createOscillator();
    const modGain = ctx.createGain();
    const amp = ctx.createGain();
    carrier.type = "sine";
    carrier.frequency.value = freq;
    modulator.type = "sine";
    modulator.frequency.value = freq * 2.4;
    modGain.gain.setValueAtTime(freq * 0.5, start);
    modGain.gain.exponentialRampToValueAtTime(1, start + duration);
    modulator.connect(modGain).connect(carrier.frequency);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    carrier.connect(amp).connect(master);
    carrier.start(start);
    modulator.start(start);
    carrier.stop(start + duration + 0.04);
    modulator.stop(start + duration + 0.04);
  }

  function pulse(freq, duration, gain, type = "square", detune = 0) {
    const start = ctx.currentTime;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    osc.detune.value = detune;
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.006);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp).connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  function thump(freq, duration, gain) {
    const start = ctx.currentTime;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(28, freq * 0.4), start + duration);
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp).connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  const oneShot = {
    shot() {
      if (!ensure()) return;
      pulse(880, 0.05, 0.045, "square", -18);
    },
    laser() {
      if (!ensure()) return;
      thump(160, 0.28, 0.2);
      noise(0.32, "highpass", 2400, 0.8, 0.11, 0.3);
      pulse(1200, 0.22, 0.06, "sawtooth", 22);
    },
    explode(size = 1) {
      if (!ensure()) return;
      const weight = size >= 3 ? 1.4 : size >= 2 ? 1 : 0.7;
      noise(0.34, "lowpass", 620, 0.9, 0.16 * weight, 0.3);
      noise(0.18, "highpass", 2600, 0.7, 0.07 * weight, 0.16);
      thump(120, 0.22, 0.12 * weight);
      pulse(220, 0.16, 0.05 * weight, "sawtooth", -30);
    },
    graze() {
      if (!ensure()) return;
      ping(1760, 0.12, 0.05);
    },
    bomb() {
      if (!ensure()) return;
      thump(78, 0.5, 0.25);
      noise(0.55, "lowpass", 420, 0.8, 0.18, 0.5);
      noise(0.3, "highpass", 3200, 0.7, 0.06, 0.26);
      pulse(90, 0.4, 0.08, "sawtooth", 14);
    },
    hurt() {
      if (!ensure()) return;
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(420, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.4);
      amp.gain.setValueAtTime(0.16, ctx.currentTime);
      amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.42);
      osc.connect(amp).connect(master);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
      noise(0.3, "lowpass", 520, 0.8, 0.12, 0.28);
    },
    item() {
      if (!ensure()) return;
      ping(1046.5, 0.2, 0.07);
      ping(1568, 0.28, 0.06, 0.07);
    },
    power() {
      if (!ensure()) return;
      ping(1318.5, 0.24, 0.07);
      ping(1760, 0.3, 0.05, 0.08);
    },
    ready() {
      if (!ensure()) return;
      ping(880, 0.2, 0.06);
      ping(1320, 0.26, 0.05, 0.09);
    },
    boss() {
      if (!ensure()) return;
      thump(70, 0.6, 0.2);
      noise(0.5, "bandpass", 320, 0.9, 0.09, 0.45);
      pulse(140, 0.5, 0.05, "sawtooth", -22);
    },
    clear() {
      if (!ensure()) return;
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((freq, index) => ping(freq, 0.45, 0.08, index * 0.08));
      noise(0.4, "highpass", 3600, 0.6, 0.05, 0.35, 0.2);
    },
    click() {
      if (!ensure()) return;
      noise(0.05, "bandpass", 2100, 1.5, 0.05, 0.04);
    },
    page() {
      if (!ensure()) return;
      noise(0.22, "highpass", 1400, 0.6, 0.06, 0.2);
    },
  };

  function startCharge() {
    if (!ensure() || chargeNodes) return;
    try {
      const carrier = ctx.createOscillator();
      const sub = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const amp = ctx.createGain();
      carrier.type = "sawtooth";
      sub.type = "triangle";
      carrier.frequency.value = 180;
      sub.frequency.value = 90;
      filter.type = "lowpass";
      filter.frequency.value = 900;
      amp.gain.setValueAtTime(0.0001, ctx.currentTime);
      amp.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.08);
      carrier.connect(filter);
      sub.connect(filter);
      filter.connect(amp).connect(master);
      carrier.start();
      sub.start();
      chargeNodes = { carrier, sub, filter, amp };
    } catch {
      chargeNodes = null;
    }
  }

  function updateCharge(level) {
    if (!chargeNodes || !ctx) return;
    const ratio = Math.max(0, Math.min(1, level));
    chargeNodes.carrier.frequency.value = 180 + ratio * 360;
    chargeNodes.sub.frequency.value = 90 + ratio * 160;
    chargeNodes.filter.frequency.value = 700 + ratio * 1500;
    chargeNodes.amp.gain.value = 0.03 + ratio * 0.05;
  }

  function stopCharge() {
    if (!chargeNodes || !ctx) return;
    const nodes = chargeNodes;
    chargeNodes = null;
    try {
      nodes.amp.gain.cancelScheduledValues(ctx.currentTime);
      nodes.amp.gain.setValueAtTime(Math.max(0.0001, nodes.amp.gain.value), ctx.currentTime);
      nodes.amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
      nodes.carrier.stop(ctx.currentTime + 0.1);
      nodes.sub.stop(ctx.currentTime + 0.1);
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
    charge(active, level = 0) {
      if (muted || !active) stopCharge();
      else {
        startCharge();
        updateCharge(level);
      }
    },
    setMuted(next) {
      muted = Boolean(next);
      if (master && ctx) master.gain.value = muted ? 0 : 0.5;
      if (muted) stopCharge();
    },
    isMuted() {
      return muted;
    },
    unlock() {
      const audio = ensure();
      if (audio && audio.state === "suspended") audio.resume().catch(() => {});
    },
    stopAll() {
      stopCharge();
    },
  };
}
