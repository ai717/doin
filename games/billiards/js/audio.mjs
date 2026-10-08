// Procedural club-room audio. Everything is synthesised at runtime:
// wooden cue knock, resin clack, cushioned rail thud, brass pocket drop,
// restrained foul alarm and FM marimba runs. No external files.

const CLICK_MAX = 0.9;

function noiseSource(ctx, seconds) {
  const frames = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < frames; i += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.22 * white) / 1.22;
    data[i] = white * 0.7 + last * 0.6;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  return src;
}

function gainRamp(ctx, node, peak, attack, decay, startAt) {
  const g = node.gain;
  g.cancelScheduledValues(startAt);
  g.setValueAtTime(0.0001, startAt);
  g.exponentialRampToValueAtTime(Math.max(0.0002, peak), startAt + attack);
  g.exponentialRampToValueAtTime(0.0001, startAt + attack + decay);
}

export function createAudio() {
  let ctx = null;
  let master = null;
  let enabled = true;
  let failed = false;

  function ensure() {
    if (ctx || failed) return ctx;
    try {
      const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Ctor) {
        failed = true;
        return null;
      }
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      failed = true;
      ctx = null;
    }
    return ctx;
  }

  function ready() {
    if (!enabled) return null;
    const c = ensure();
    if (!c) return null;
    if (c.state === "suspended") {
      try { c.resume(); } catch { /* ignore */ }
    }
    return c;
  }

  function bus(c, vol) {
    const g = c.createGain();
    g.gain.value = vol;
    g.connect(master);
    return g;
  }

  function play(fn) {
    const c = ready();
    if (!c) return;
    try { fn(c, c.currentTime); } catch { /* silent degrade */ }
  }

  return {
    setEnabled(value) {
      enabled = Boolean(value);
      if (!enabled && ctx) {
        try { master.gain.value = 0; } catch { /* ignore */ }
      } else if (master) {
        try { master.gain.value = 0.5; } catch { /* ignore */ }
      }
      return enabled;
    },
    isEnabled() { return enabled; },
    unlock() { play(() => {}); },

    /** Wooden cue knock: noise transient through a woody band. */
    strike(power = 0.6) {
      play((c, now) => {
        const out = bus(c, 0.5 + power * 0.4);
        const band = c.createBiquadFilter();
        band.type = "bandpass";
        band.frequency.value = 620 + power * 520;
        band.Q.value = 3.2;
        const body = c.createBiquadFilter();
        body.type = "peaking";
        body.frequency.value = 820;
        body.Q.value = 1.1;
        body.gain.value = 8;
        const amp = c.createGain();
        amp.gain.value = 0;
        const src = noiseSource(c, 0.08);
        gainRamp(c, amp, 0.42 + power * 0.42, 0.004, 0.05 + power * 0.03, now);
        src.connect(band).connect(body).connect(amp).connect(out);
        src.start(now);
        src.stop(now + 0.12);

        const woody = c.createOscillator();
        woody.type = "triangle";
        woody.frequency.setValueAtTime(240 + power * 90, now);
        woody.frequency.exponentialRampToValueAtTime(120, now + 0.09);
        const wg = c.createGain();
        gainRamp(c, wg, 0.18 + power * 0.2, 0.003, 0.07, now);
        woody.connect(wg).connect(out);
        woody.start(now);
        woody.stop(now + 0.12);
      });
    },

    /** Resin clack: bright transient whose level tracks impact speed. */
    clack(speed = 20) {
      const norm = Math.min(1, speed / 90);
      play((c, now) => {
        const out = bus(c, 0.25 + norm * 0.55);
        const osc = c.createOscillator();
        osc.type = "triangle";
        const base = 1750 + norm * 780;
        osc.frequency.setValueAtTime(base, now);
        osc.frequency.exponentialRampToValueAtTime(base * 0.55, now + 0.045);
        const g = c.createGain();
        gainRamp(c, g, Math.min(CLICK_MAX, 0.12 + norm * 0.5), 0.002, 0.045, now);
        osc.connect(g).connect(out);
        osc.start(now);
        osc.stop(now + 0.07);

        const noise = noiseSource(c, 0.03);
        const hp = c.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 2600;
        const ng = c.createGain();
        gainRamp(c, ng, 0.06 + norm * 0.16, 0.001, 0.024, now);
        noise.connect(hp).connect(ng).connect(out);
        noise.start(now);
        noise.stop(now + 0.04);
      });
    },

    /** Rail thud: low body plus damped noise, 120 ms tail. */
    rail(speed = 20) {
      const norm = Math.min(1, speed / 90);
      play((c, now) => {
        const out = bus(c, 0.2 + norm * 0.4);
        const osc = c.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(190, now);
        osc.frequency.exponentialRampToValueAtTime(96, now + 0.11);
        const g = c.createGain();
        gainRamp(c, g, 0.2 + norm * 0.35, 0.004, 0.11, now);
        osc.connect(g).connect(out);
        osc.start(now);
        osc.stop(now + 0.14);

        const noise = noiseSource(c, 0.09);
        const lp = c.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 480;
        const ng = c.createGain();
        gainRamp(c, ng, 0.1 + norm * 0.18, 0.003, 0.08, now);
        noise.connect(lp).connect(ng).connect(out);
        noise.start(now);
        noise.stop(now + 0.1);
      });
    },

    /** Pocket drop: descending glide then a brass bell. */
    pocket() {
      play((c, now) => {
        const out = bus(c, 0.55);
        const drop = c.createOscillator();
        drop.type = "sine";
        drop.frequency.setValueAtTime(760, now);
        drop.frequency.exponentialRampToValueAtTime(150, now + 0.22);
        const dg = c.createGain();
        gainRamp(c, dg, 0.3, 0.01, 0.22, now);
        drop.connect(dg).connect(out);
        drop.start(now);
        drop.stop(now + 0.26);

        const carrier = c.createOscillator();
        carrier.type = "sine";
        carrier.frequency.value = 1180;
        const mod = c.createOscillator();
        mod.type = "sine";
        mod.frequency.value = 1180 * 2.76;
        const modGain = c.createGain();
        modGain.gain.setValueAtTime(620, now + 0.16);
        modGain.gain.exponentialRampToValueAtTime(6, now + 0.5);
        mod.connect(modGain).connect(carrier.frequency);
        const cg = c.createGain();
        cg.gain.setValueAtTime(0.0001, now + 0.15);
        cg.gain.exponentialRampToValueAtTime(0.26, now + 0.17);
        cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);
        carrier.connect(cg).connect(out);
        carrier.start(now + 0.14);
        carrier.stop(now + 0.66);
        mod.start(now + 0.14);
        mod.stop(now + 0.66);
      });
    },

    /** Foul alarm: detuned pair sliding down under a lowpass. */
    foul() {
      play((c, now) => {
        const out = bus(c, 0.5);
        const lp = c.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(900, now);
        lp.frequency.exponentialRampToValueAtTime(320, now + 0.32);
        const g = c.createGain();
        gainRamp(c, g, 0.34, 0.01, 0.3, now);
        for (const detune of [-9, 11]) {
          const osc = c.createOscillator();
          osc.type = "sawtooth";
          osc.detune.value = detune;
          osc.frequency.setValueAtTime(226, now);
          osc.frequency.exponentialRampToValueAtTime(104, now + 0.3);
          osc.connect(lp);
          osc.start(now);
          osc.stop(now + 0.34);
        }
        lp.connect(g).connect(out);
      });
    },

    /** Run motif: FM marimba arpeggio stepping up with the streak. */
    run(tier = 0) {
      const steps = [0, 4, 7, 11, 14];
      const count = 2 + Math.min(3, Math.max(0, tier));
      play((c, now) => {
        const out = bus(c, 0.42);
        for (let i = 0; i < count; i += 1) {
          const at = now + i * 0.085;
          const semis = steps[i % steps.length] + (tier >= 2 ? 12 : 0);
          const freq = 523.25 * 2 ** (semis / 12);
          const carrier = c.createOscillator();
          carrier.type = "sine";
          carrier.frequency.value = freq;
          const mod = c.createOscillator();
          mod.type = "sine";
          mod.frequency.value = freq * 3.01;
          const modGain = c.createGain();
          modGain.gain.setValueAtTime(freq * 1.6, at);
          modGain.gain.exponentialRampToValueAtTime(2, at + 0.16);
          mod.connect(modGain).connect(carrier.frequency);
          const g = c.createGain();
          g.gain.setValueAtTime(0.0001, at);
          g.gain.exponentialRampToValueAtTime(0.24, at + 0.008);
          g.gain.exponentialRampToValueAtTime(0.0001, at + 0.34);
          carrier.connect(g).connect(out);
          carrier.start(at);
          carrier.stop(at + 0.36);
          mod.start(at);
          mod.stop(at + 0.36);
        }
      });
    },

    /** Clear-the-table flourish: bright bell phrase over a warm pad. */
    clearTable() {
      const phrase = [523.25, 659.25, 783.99, 987.77, 1174.66, 1567.98];
      play((c, now) => {
        const out = bus(c, 0.5);
        phrase.forEach((freq, i) => {
          const at = now + i * 0.11;
          const carrier = c.createOscillator();
          carrier.type = "sine";
          carrier.frequency.value = freq;
          const mod = c.createOscillator();
          mod.type = "sine";
          mod.frequency.value = freq * 2.0;
          const modGain = c.createGain();
          modGain.gain.setValueAtTime(freq * 1.1, at);
          modGain.gain.exponentialRampToValueAtTime(2, at + 0.3);
          mod.connect(modGain).connect(carrier.frequency);
          const g = c.createGain();
          g.gain.setValueAtTime(0.0001, at);
          g.gain.exponentialRampToValueAtTime(0.22, at + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, at + 0.7);
          carrier.connect(g).connect(out);
          carrier.start(at);
          carrier.stop(at + 0.75);
          mod.start(at);
          mod.stop(at + 0.75);
        });
      });
    },

    /** Soft UI tick for panels and grip buttons. */
    ui() {
      play((c, now) => {
        const out = bus(c, 0.3);
        const osc = c.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);
        const g = c.createGain();
        gainRamp(c, g, 0.12, 0.003, 0.05, now);
        osc.connect(g).connect(out);
        osc.start(now);
        osc.stop(now + 0.08);
      });
    },
  };
}
