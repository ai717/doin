// Material sound design for Flick Duel: fingertip wood flick, sliding friction,
// puck clacks, rail knocks, a copper gate ping and a wooden closing flourish.
// All voices are synthesised with WebAudio; no external audio files.

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
      master.gain.value = muted ? 0 : 0.42;
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
    filter.frequency.setValueAtTime(frequency, start);
    filter.Q.value = q;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + decay);
    source.connect(filter).connect(amp).connect(master);
    source.start(start);
    source.stop(start + seconds);
  }

  function tone(freq, duration, gain, type = "sine", delay = 0, glide = 0.5) {
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * glide), start + duration);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.006);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp).connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  // Two slightly detuned partials give a wooden puck its body.
  function woodKnock(freq, duration, gain, delay = 0) {
    const start = ctx.currentTime + delay;
    [1, 1.58, 2.41].forEach((ratio, index) => {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = index === 0 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freq * ratio, start);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * ratio * 0.62), start + duration);
      amp.gain.setValueAtTime(0.0001, start);
      amp.gain.exponentialRampToValueAtTime(gain / (index + 1.4), start + 0.004);
      amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(amp).connect(master);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    });
  }

  // FM ping with an inharmonic tail, like a wooden puck clipping a copper ring.
  function gatePing(freq, delay = 0) {
    const start = ctx.currentTime + delay;
    const carrier = ctx.createOscillator();
    const modulator = ctx.createOscillator();
    const modGain = ctx.createGain();
    const amp = ctx.createGain();
    carrier.type = "sine";
    carrier.frequency.value = freq;
    modulator.type = "sine";
    modulator.frequency.value = freq * 2.76;
    modGain.gain.setValueAtTime(freq * 1.4, start);
    modGain.gain.exponentialRampToValueAtTime(freq * 0.05, start + 0.5);
    modulator.connect(modGain).connect(carrier.frequency);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(0.06, start + 0.005);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);
    carrier.connect(amp).connect(master);
    carrier.start(start);
    modulator.start(start);
    carrier.stop(start + 0.6);
    modulator.stop(start + 0.6);
  }

  const oneShot = {
    // Nail flicking a wooden disc: a dry transient plus a tiny body knock.
    flick() {
      noise(0.05, "bandpass", 3400, 1.1, 0.11, 0.045);
      noise(0.09, "highpass", 5200, 0.8, 0.05, 0.08);
      woodKnock(430, 0.1, 0.09);
    },
    // Wood sliding on a table: a short filtered hiss, played while moving.
    slide() {
      noise(0.18, "lowpass", 1900, 0.7, 0.035, 0.17);
      noise(0.08, "bandpass", 900, 1.3, 0.025, 0.07, 0.03);
    },
    // Puck on puck: woody clack with a brief bright edge.
    clack() {
      noise(0.06, "bandpass", 2100, 1.6, 0.09, 0.055);
      woodKnock(560, 0.12, 0.12);
    },
    // Rail or seam post: low muted thud.
    knock() {
      noise(0.1, "lowpass", 620, 0.9, 0.09, 0.1);
      tone(128, 0.16, 0.12, "sine", 0, 0.55);
    },
    // Clean gate crossing: metal ring ping with a confirm tick.
    gate() {
      gatePing(1180);
      gatePing(790, 0.03);
      noise(0.05, "highpass", 4200, 1, 0.05, 0.04);
    },
    // End of a match: pucks swept together plus a short wooden drum.
    win() {
      noise(0.5, "highpass", 1300, 0.6, 0.06, 0.46);
      noise(0.3, "lowpass", 2400, 0.9, 0.05, 0.28, 0.08);
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
        gatePing(freq * 0.72, 0.12 + index * 0.1);
      });
      tone(104, 0.34, 0.16, "sine", 0.02, 0.6);
    },
    click() {
      noise(0.035, "bandpass", 2400, 1.4, 0.04, 0.03);
    },
    page() {
      noise(0.16, "highpass", 1700, 0.7, 0.04, 0.15);
    },
    turn() {
      woodKnock(320, 0.1, 0.06);
      noise(0.04, "bandpass", 1600, 1.2, 0.025, 0.035);
    },
  };

  return {
    play(name) {
      if (muted) return;
      if (!oneShot[name]) return;
      try {
        if (ctx && ctx.state === "suspended") ctx.resume();
        oneShot[name]();
      } catch {
        // audio must never break gameplay
      }
    },
    setMuted(next) {
      muted = Boolean(next);
      if (master && ctx) master.gain.value = muted ? 0 : 0.42;
    },
    isMuted() {
      return muted;
    },
    unlock() {
      const audio = ensure();
      if (audio && audio.state === "suspended") audio.resume().catch(() => {});
    },
    stopAll() {
      // Every voice is a short one-shot, so nothing sustained needs stopping.
    },
  };
}
