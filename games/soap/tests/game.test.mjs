import test from "node:test";
import assert from "node:assert/strict";
import { createController } from "../js/game.mjs";
import { evennessOf, grade } from "../js/score.mjs";
import { createAudio } from "../js/audio.mjs";
import { reportSession } from "../js/portal.mjs";

const stroke = (x0, y0, x1, y1, tool = "tool_knife") => ({
  from: { x: x0, y: y0 }, to: { x: x1, y: y1 }, tool, speed: 300,
});

test("controller starts with first soap and selected tool", () => {
  const game = createController();
  const view = game.snapshot();
  assert.equal(view.soapId, "soap_classic_white");
  assert.equal(view.tool, "tool_knife");
  assert.equal(view.complete, false);
  assert.equal(view.paused, false);
  assert.ok(view.progress >= 0 && view.progress < 1);
});

test("controller cuts, reports finesse samples and respects pause", () => {
  const game = createController({ soapId: "soap_classic_pink", seed: 1 });
  const real = game.cut({ x: 1, y: 2 }, { x: 8, y: 2 }, 300);
  assert.equal(real.changed, true);
  assert.ok(game.snapshot().finesse >= 0);
  game.setPaused(true);
  const blocked = game.cut({ x: 1, y: 4 }, { x: 8, y: 4 }, 300);
  assert.equal(blocked.changed, false);
  game.setPaused(false);
  assert.equal(game.cut({ x: 1, y: 4 }, { x: 8, y: 4 }, 300).changed, true);
});

test("tool switching and soap cycling stay within the catalogue", () => {
  const game = createController();
  assert.equal(game.setTool("tool_peeler"), true);
  assert.equal(game.setTool("tool_peeler"), false);
  assert.equal(game.setTool("bogus"), false);
  assert.equal(game.toolId, "tool_peeler");
  assert.equal(game.loadSoap("soap_jelly_berry", 42), true);
  assert.equal(game.soapId, "soap_jelly_berry");
  assert.equal(game.loadSoap("bogus"), false);
  game.nextSoap();
  assert.equal(game.soapId, "soap_jelly_citrus");
});

test("finishing with finish() completes and later cuts are ignored", () => {
  const game = createController({ soapId: "soap_classic_white", seed: 5 });
  for (let pass = 0; pass < 30 && !game.snapshot().complete; pass += 1) {
    for (let y = -1; y <= 7; y += 1) {
      game.cut({ x: -1, y }, { x: 10, y }, 350);
      game.setTool("tool_scraper");
    }
  }
  assert.equal(game.snapshot().complete, true);
  assert.ok(game.snapshot().result.stars >= 1);
  const after = game.cut({ x: 0, y: 0 }, { x: 9, y: 6 }, 300);
  assert.equal(after.changed, false);
});

test("evenness rewards uniform thin curls", () => {
  assert.equal(evennessOf([]), 0);
  assert.equal(evennessOf([0, -1]), 0);
  const even = evennessOf([0.5, 0.5, 0.5, 0.5]);
  const uneven = evennessOf([0.1, 0.9, 0.2, 0.8]);
  assert.ok(even > uneven);
  assert.ok(even <= 1 && even >= 0);
});

test("grade only awards high stars on a finished bar", () => {
  assert.equal(grade(null).stars, 0);
  const partial = grade({ totalDepth: 100, removedDepth: 20 }, 1);
  assert.equal(partial.stars, 1);
  const done = grade({ totalDepth: 100, removedDepth: 100 }, 0.95);
  assert.equal(done.stars, 5);
});

test("audio module degrades to no-ops without WebAudio", () => {
  const audio = createAudio();
  assert.equal(audio.unlock(), false);
  assert.equal(audio.startScrape("mat_hard", 300), false);
  assert.equal(audio.updateScrape(500, 1), false);
  assert.equal(audio.stopScrape(), false);
  assert.equal(audio.chip("curl"), false);
  assert.equal(audio.coreReveal(), false);
  assert.equal(audio.complete(), false);
  assert.equal(audio.setMuted(true), true);
  assert.equal(audio.isMuted(), true);
  audio.pause();
  audio.resume();
  audio.dispose();
});

test("audio with a stubbed context keeps gain automation on AudioParam, not the node", () => {
  const calls = [];
  function param(name) {
    return {
      value: 0,
      setValueAtTime(value) { calls.push([name, "set", value]); return this; },
      setTargetAtTime(value) { calls.push([name, "target", value]); return this; },
      exponentialRampToValueAtTime(value) { calls.push([name, "ramp", value]); return this; },
    };
  }
  function node(extra = {}) {
    return { connect(next) { return next; }, ...extra };
  }
  class StubContext {
    constructor() { this.currentTime = 0; this.sampleRate = 8000; this.state = "running"; this.destination = node(); }
    createGain() { return node({ gain: param("gain") }); }
    createBiquadFilter() { return node({ type: "bandpass", frequency: param("freq"), Q: param("q") }); }
    createBufferSource() { return node({ buffer: null, loop: false, start() {}, stop() {} }); }
    createBuffer(ch, frames) { return { getChannelData: () => new Float32Array(frames) }; }
    createOscillator() { return node({ type: "sine", frequency: param("oscFreq"), start() {}, stop() {} }); }
    suspend() { this.state = "suspended"; }
    resume() { this.state = "running"; }
    close() {}
  }
  const previous = globalThis.AudioContext;
  globalThis.AudioContext = StubContext;
  const audio = createAudio();
  assert.equal(audio.unlock(), true);
  assert.equal(audio.startScrape("mat_jelly", 900), true);
  assert.equal(audio.updateScrape(1200, 0.7), true);
  assert.equal(audio.stopScrape(), true);
  assert.equal(audio.chip("ribbon"), true);
  assert.equal(audio.coreReveal(), true);
  assert.equal(audio.complete(), true);
  assert.ok(calls.some(([name]) => name === "freq"));
  audio.pause();
  assert.equal(audio.bedNode !== null, true);
  audio.resume();
  audio.dispose();
  globalThis.AudioContext = previous;
});

test("portal report tags a win and never throws", () => {
  const payload = reportSession({ slug: "soap", outcome: "WON", score: 77, stars: 4 });
  assert.equal(payload.slug, "soap");
  assert.equal(payload.outcome, "WON");
  assert.equal(payload.stars, 4);
  assert.ok(Number.isFinite(payload.timestamp));
});
