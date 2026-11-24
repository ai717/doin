// Material sound design for Oracle Glyph Match: carved bone, paper rubbing, bronze bells and a scroll unfurl.
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
      master.gain.value = muted ? 0 : 0.46;
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
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + decay);
    source.connect(filter).connect(amp).connect(master);
    source.start(start);
    source.stop(start + seconds);
  }

  function thump(freq, duration, gain, delay = 0) {
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * 0.45), start + duration);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp).connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  // FM bronze bell: a long, slightly inharmonic tail like a small bianzhong.
  function bell(freq, duration, gain, delay = 0) {
    const start = ctx.currentTime + delay;
    const carrier = ctx.createOscillator();
    const modulator = ctx.createOscillator();
    const modGain = ctx.createGain();
    const amp = ctx.createGain();
    carrier.type = "sine";
    carrier.frequency.value = freq;
    modulator.type = "sine";
    modulator.frequency.value = freq * 3.01;
    modGain.gain.setValueAtTime(freq * 1.6, start);
    modGain.gain.exponentialRampToValueAtTime(freq * 0.08, start + duration);
    modulator.connect(modGain).connect(carrier.frequency);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.006);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    carrier.connect(amp).connect(master);
    carrier.start(start);
    modulator.start(start);
    carrier.stop(start + duration + 0.05);
    modulator.stop(start + duration + 0.05);
  }

  function wood(freq, duration, gain, delay = 0) {
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.5), start + duration);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.004);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp).connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  const oneShot = {
    // Carving a bone: a crisp chisel tick over a tiny bone knock.
    carve() {
      if (!ensure()) return;
      noise(0.07, "bandpass", 3200, 5.5, 0.15, 0.06);
      noise(0.04, "highpass", 5200, 1.2, 0.06, 0.035);
      wood(210, 0.08, 0.1);
    },
    // Rubbing ink onto paper: a soft paper swish plus a low press.
    rub() {
      if (!ensure()) return;
      noise(0.26, "lowpass", 1500, 0.7, 0.11, 0.24);
      noise(0.12, "bandpass", 2600, 1.1, 0.05, 0.1, 0.04);
      thump(132, 0.16, 0.1);
    },
    // A bronze bell for the evolution ribbon.
    bell() {
      if (!ensure()) return;
      bell(659.25, 1.35, 0.075);
      bell(987.77, 1.05, 0.035, 0.04);
    },
    // A wrong link: a low wooden knock, not an alarm.
    tap() {
      if (!ensure()) return;
      wood(300, 0.14, 0.14);
      noise(0.09, "bandpass", 780, 2.2, 0.05, 0.08);
    },
    // Unfurling the scroll on level clear: paper sweep into a bell arpeggio.
    scroll() {
      if (!ensure()) return;
      noise(0.6, "highpass", 1100, 0.6, 0.08, 0.55);
      noise(0.34, "lowpass", 2200, 0.8, 0.06, 0.3, 0.1);
      thump(96, 0.4, 0.12, 0.02);
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => bell(freq, 1.1, 0.05, 0.16 + index * 0.1));
    },
    click() {
      if (!ensure()) return;
      noise(0.04, "bandpass", 2200, 1.6, 0.045, 0.035);
    },
    page() {
      if (!ensure()) return;
      noise(0.2, "highpass", 1600, 0.7, 0.05, 0.18);
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
      if (master && ctx) master.gain.value = muted ? 0 : 0.46;
    },
    isMuted() {
      return muted;
    },
    unlock() {
      const audio = ensure();
      if (audio && audio.state === "suspended") audio.resume().catch(() => {});
    },
    stopAll() {
      // All voices are short one-shots, so nothing sustained needs stopping.
    },
  };
}
