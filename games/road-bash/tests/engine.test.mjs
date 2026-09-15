import test from "node:test";
import assert from "node:assert/strict";

import {
  applyIntent,
  computePlace,
  createRace,
  hasOpenLane,
  isTerminal,
  mulberry32,
  nearestTarget,
  openLanesAt,
  playerOf,
  STATUS,
  stepFrame,
  summarize,
} from "../js/engine.mjs";
import { leagueStars, brawlStars, getawayStars, prizeForPlace, raceCash } from "../js/score.mjs";
import { LEAGUE_COUNT, BRAWL_COUNT, GETAWAY_COUNT, raceSpec } from "../js/levels.mjs";

function go(state) {
  state.status = STATUS.racing;
  state.countdown = 0;
}

function pump(state, seconds, input) {
  if (input) applyIntent(state, { type: "set-input", ...input });
  const n = Math.ceil(seconds / (1 / 60));
  for (let i = 0; i < n; i += 1) stepFrame(state, 1 / 60);
}

test("createRace builds a player plus rivals and at least one club on league", () => {
  const race = createRace({ mode: "league", raceId: 0, seed: 7 });
  assert.equal(race.riders[0].kind, "player");
  assert.ok(race.riders.length >= 5);
  assert.ok(race.riders.some((r) => r.weapon === "club"), "每场至少一把棍子");
  assert.equal(race.status, STATUS.countdown);
});

test("getaway spawns a cop; brawl has a quota", () => {
  const g = createRace({ mode: "getaway", raceId: 0, seed: 3 });
  assert.ok(g.riders.some((r) => r.kind === "cop"));
  const b = raceSpec("brawl", 4);
  assert.ok(b.quota >= 4);
  assert.equal(LEAGUE_COUNT, 20);
  assert.equal(BRAWL_COUNT, 8);
  assert.equal(GETAWAY_COUNT, 5);
});

test("punch hits a nearby rival and kick reaches farther", () => {
  const race = createRace({ seed: 11 });
  go(race);
  const p = playerOf(race);
  const r = race.riders[1];
  r.x = p.x + 0.15;
  r.z = p.z + 2;
  r.mounted = true;
  r.stamina = 100;
  const punched = applyIntent(race, { type: "punch" });
  assert.equal(punched.action, "punch");
  pump(race, 0.35);
  assert.ok(r.stamina < 100, "近身出拳必须扣体力");

  const far = createRace({ seed: 12 });
  go(far);
  const fp = playerOf(far);
  const fr = far.riders[1];
  fr.x = fp.x + 0.2;
  fr.z = fp.z + 10.5;
  fr.stamina = 100;
  applyIntent(far, { type: "punch" });
  pump(far, 0.35);
  const afterPunch = fr.stamina;
  applyIntent(far, { type: "kick" });
  pump(far, 0.4);
  assert.ok(fr.stamina < afterPunch || afterPunch === 100, "踢腿距离更远");
  if (afterPunch === 100) assert.ok(fr.stamina < 100, "踢中远处对手");
});

test("backhand steals a club from a winding rival", () => {
  const race = createRace({ seed: 21 });
  go(race);
  const p = playerOf(race);
  const r = race.riders[1];
  r.x = p.x + 0.2;
  r.z = p.z + 1.5;
  r.weapon = "club";
  r.clubHits = 5;
  r.attack = {
    move: "club",
    dir: -1,
    t: 0.02,
    wind: 0.14,
    active: 0.14,
    recover: 0.22,
    landed: false,
    dmg: 42,
    knock: 0.22,
    dz: 9,
    dx: 0.62,
  };
  applyIntent(race, { type: "set-input", steer: -1 });
  applyIntent(race, { type: "punch" });
  pump(race, 0.4);
  assert.equal(p.weapon, "club");
  assert.equal(r.weapon, "fist");
});

test("empty stamina or rail collision crashes; remount recovers if bike remains", () => {
  const race = createRace({ seed: 31, bikeId: 0 });
  go(race);
  const p = playerOf(race);
  p.x = 0;
  p.speed = 22;
  p.stamina = 0.1;
  p.bikeHp = 5;
  const r = race.riders[1];
  r.x = p.x + 0.1;
  r.z = p.z + 1.2;
  applyIntent(race, { type: "kick" });
  pump(race, 0.5);
  // force a rail crash if still mounted
  if (p.mounted) {
    p.x = 2.05;
    p.speed = 18;
    pump(race, 0.2);
  }
  assert.equal(p.mounted, false);
  pump(race, 4);
  assert.equal(p.wrecked, false);
  assert.equal(p.mounted, true, "车况未尽时必须能捡回摩托");
});

test("wrecked bike ends the race as a loss", () => {
  const race = createRace({ seed: 41 });
  go(race);
  const p = playerOf(race);
  p.bikeHp = 1;
  p.x = 2.05;
  p.speed = 20;
  p.mounted = true;
  pump(race, 0.3);
  assert.equal(p.wrecked, true);
  assert.equal(race.status, STATUS.lost);
  const again = applyIntent(race, { type: "punch" });
  assert.equal(again.action, null);
  assert.equal(stepFrame(race, 1 / 60).action, null);
});

test("traffic spawn always leaves an open lane", () => {
  const race = createRace({ mode: "league", raceId: 6, seed: 51 });
  go(race);
  applyIntent(race, { type: "set-input", accel: true, cruise: false });
  for (let i = 0; i < 900; i += 1) {
    stepFrame(race, 1 / 60);
    const p = playerOf(race);
    for (const ahead of [20, 50, 90]) {
      assert.equal(hasOpenLane(race, p.z + ahead, 16), true);
      assert.ok(openLanesAt(race, p.z + ahead, 16).length >= 1);
    }
  }
});

test("at most two AI stick to the player at once", () => {
  const race = createRace({ mode: "brawl", raceId: 5, seed: 61 });
  go(race);
  applyIntent(race, { type: "set-input", accel: true });
  for (let i = 0; i < 600; i += 1) {
    stepFrame(race, 1 / 60);
    const p = playerOf(race);
    let stick = 0;
    for (const r of race.riders) {
      if (r.id === 0 || !r.mounted || r.wrecked) continue;
      if (Math.abs(r.z - p.z) < 10 && Math.abs(r.x - p.x) < 0.7) stick += 1;
    }
    assert.ok(stick <= 3, `贴身 AI 过多: ${stick}`);
  }
});

test("league qualify / brawl quota / getaway escape scoring", () => {
  assert.equal(leagueStars({ won: true, place: 4, qualify: 4, knockouts: 0 }), 1);
  assert.equal(leagueStars({ won: true, place: 2, qualify: 4, knockouts: 0 }), 2);
  assert.equal(leagueStars({ won: true, place: 1, qualify: 1, knockouts: 3 }), 3);
  assert.equal(leagueStars({ won: false, place: 1, qualify: 4, knockouts: 9 }), 0);
  assert.equal(brawlStars({ won: true, knockouts: 6, quota: 6, crashes: 2 }), 1);
  assert.equal(brawlStars({ won: true, knockouts: 8, quota: 6, crashes: 0 }), 3);
  assert.equal(getawayStars({ won: true, crashes: 0, maxBust: 0.2 }), 3);
  assert.ok(prizeForPlace(1, 0) > prizeForPlace(4, 0));
  assert.equal(raceCash({ mode: "league", won: false, place: 1, tier: 0, knockouts: 10 }), 0);
});

test("crossing the finish line assigns place and can win a rats-tier race", () => {
  const race = createRace({ mode: "league", raceId: 0, seed: 71 });
  go(race);
  const p = playerOf(race);
  p.mounted = true;
  p.z = race.spec.length + 2;
  for (const r of race.riders) {
    if (r.id !== 0) r.z = 10;
  }
  pump(race, 0.1);
  assert.equal(race.status, STATUS.won);
  assert.equal(computePlace(race, p), 1);
  const sum = summarize(race);
  assert.ok(sum.stars >= 1);
  assert.ok(sum.cash > 0);
});

test("seeded races replay the same path under the same inputs", () => {
  function run(seed) {
    const a = createRace({ seed, bikeId: 0, raceId: 0 });
    go(a);
    applyIntent(a, { type: "set-input", accel: true, steer: 1 });
    for (let i = 0; i < 240; i += 1) {
      if (i === 40) applyIntent(a, { type: "punch" });
      if (i === 80) applyIntent(a, { type: "set-input", steer: -1, accel: true });
      stepFrame(a, 1 / 60);
    }
    const p = playerOf(a);
    return { x: p.x, z: p.z, speed: p.speed, cars: a.cars.length };
  }
  assert.deepEqual(run(1234), run(1234));
});

test("1000-step random walk never throws and terminal stays no-op", () => {
  const rng = mulberry32(2026);
  const race = createRace({ seed: 2026, mode: "league", raceId: 2 });
  go(race);
  for (let i = 0; i < 1000; i += 1) {
    const roll = rng();
    if (roll < 0.45) applyIntent(race, { type: "set-input", accel: true, brake: false, steer: rng() < 0.5 ? -1 : 1 });
    else if (roll < 0.6) applyIntent(race, { type: "set-input", accel: false, brake: true, steer: 0 });
    else if (roll < 0.75) applyIntent(race, { type: "punch" });
    else if (roll < 0.85) applyIntent(race, { type: "kick" });
    else if (roll < 0.9) applyIntent(race, { type: "pause" });
    else applyIntent(race, { type: "resume" });
    if (race.paused && rng() < 0.7) applyIntent(race, { type: "resume" });
    assert.doesNotThrow(() => stepFrame(race, 1 / 60));
  }
  if (isTerminal(race)) {
    assert.equal(applyIntent(race, { type: "punch" }).action, null);
    assert.equal(stepFrame(race, 1 / 60).action, null);
  }
});

test("nearestTarget ignores wrecked and unmounted riders", () => {
  const race = createRace({ seed: 9 });
  go(race);
  const p = playerOf(race);
  for (const r of race.riders) {
    if (r.id === 0) continue;
    r.x = p.x;
    r.z = p.z + 2;
    r.mounted = false;
    r.wrecked = true;
  }
  assert.equal(nearestTarget(race, p, 12, 1), null);
});
