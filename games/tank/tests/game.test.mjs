import { test } from "node:test";
import assert from "node:assert/strict";
import { TankGame, MODE_CAMPAIGN, MODE_BREAKTHROUGH, MODE_LAST_STAND, SLOW_MO } from "../js/game.mjs";
import { LEVELS, ENDGAMES, LAST_STAND, DIR } from "../js/levels.mjs";
import { PHASES } from "../js/engine.mjs";
import * as store from "../js/storage.mjs";

function fresh() {
  store.clear();
  return new TankGame();
}

// Wipe the field the way a flawless run would, then let one frame settle it.
function wipe(game) {
  const st = game.state;
  st.enemies.length = 0;
  st.spawned = st.queue.length;
}

test("start hands out a live battle on the right stage", () => {
  const game = fresh();
  const st = game.start(MODE_CAMPAIGN, 5);
  assert.equal(game.mode, MODE_CAMPAIGN);
  assert.equal(game.index, 5);
  assert.equal(st.levelId, LEVELS[5].id);
  assert.equal(st.phase, PHASES.playing);
  assert.equal(game.level.id, LEVELS[5].id);
  assert.equal(game.levelCount(), LEVELS.length);
});

test("indexes are clamped instead of crashing", () => {
  const game = fresh();
  game.start(MODE_CAMPAIGN, 999);
  assert.equal(game.index, LEVELS.length - 1);
  game.start(MODE_BREAKTHROUGH, -3);
  assert.equal(game.index, 0);
  assert.equal(game.level.id, ENDGAMES[0].id);
  game.start(MODE_LAST_STAND, 4);
  assert.equal(game.index, 0);
  assert.equal(game.level.id, LAST_STAND.id);
  assert.equal(game.levelCount(), 1);
});

test("a stage always replays identically", () => {
  const a = fresh();
  a.start(MODE_CAMPAIGN, 3);
  const b = fresh();
  b.start(MODE_CAMPAIGN, 3);
  assert.deepEqual(a.state.queue, b.state.queue);
  for (let i = 0; i < 120; i += 1) {
    a.update(16);
    b.update(16);
  }
  assert.equal(a.state.time.toFixed(4), b.state.time.toFixed(4));
  assert.deepEqual(
    a.state.enemies.map((e) => [e.type, e.x.toFixed(3), e.y.toFixed(3)]),
    b.state.enemies.map((e) => [e.type, e.x.toFixed(3), e.y.toFixed(3)])
  );
});

test("intents reach the engine and pause freezes the clock", () => {
  const game = fresh();
  game.start(MODE_CAMPAIGN, 0);
  assert.equal(game.move(DIR.LEFT)?.type, "move");
  assert.equal(game.state.player.dir, DIR.LEFT);
  assert.equal(game.stop()?.type, "stop");
  assert.ok(game.fire());
  game.update(16);

  const before = game.state.time;
  game.setPaused(true);
  for (let i = 0; i < 30; i += 1) game.update(16);
  assert.equal(game.state.time, before, "a paused battle must not advance");
  assert.equal(game.update(16), null);
  game.togglePause();
  game.update(16);
  assert.ok(game.state.time > before);
});

test("clearing a campaign stage banks stars and unlocks the next one", () => {
  const game = fresh();
  game.start(MODE_CAMPAIGN, 0);
  const id = LEVELS[0].id;
  wipe(game);
  game.update(16);
  assert.equal(game.state.phase, PHASES.cleared);
  const result = game.result;
  assert.equal(result.outcome, "cleared");
  assert.equal(result.levelId, id);
  assert.equal(result.starCount, 3, "an untouched run earns every star");
  assert.ok(result.bonus > 0);
  assert.equal(game.data.campaign[id].stars, 3);
  assert.equal(game.data.campaignUnlocked, 2);
  assert.ok(store.isCampaignUnlocked(game.data, 1));
  assert.equal(store.load().campaign[id].stars, 3, "the result must be persisted");
});

test("a battered run still banks a lower grade", () => {
  const game = fresh();
  game.start(MODE_CAMPAIGN, 1);
  game.state.base.hp = 1;
  game.state.deaths = 2;
  game.state.time = LEVELS[1].parTime + 30;
  wipe(game);
  game.update(16);
  assert.equal(game.result.starCount, 0);
  assert.equal(game.data.campaign[LEVELS[1].id].stars, 0);
  assert.equal(game.data.campaign[LEVELS[1].id].baseHp, 1);
});

test("a better replay upgrades the record, a worse one never downgrades it", () => {
  const game = fresh();
  game.start(MODE_CAMPAIGN, 0);
  wipe(game);
  game.update(16);
  assert.equal(game.data.campaign[LEVELS[0].id].stars, 3);

  game.start(MODE_CAMPAIGN, 0);
  game.state.base.hp = 2;
  game.state.deaths = 1;
  wipe(game);
  game.update(16);
  assert.equal(game.data.campaign[LEVELS[0].id].stars, 3, "stars must not regress");
  assert.equal(game.data.campaign[LEVELS[0].id].deaths, 0, "best run keeps the clean sheet");
});

test("losing a stage records no unlock but keeps the stats", () => {
  const game = fresh();
  game.start(MODE_CAMPAIGN, 2);
  game.state.stats.shots = 40;
  game.state.stats.hits = 10;
  game.state.base.hp = 0;
  game.update(16);
  assert.equal(game.result.outcome, "lost");
  assert.equal(game.data.campaignUnlocked, 1);
  assert.equal(game.data.campaign[LEVELS[2].id], undefined);
  assert.equal(game.data.records.shots, 40);
  assert.equal(store.accuracy(game.data), 0.25);
});

test("finishing a chapter awards its medal", () => {
  const game = fresh();
  for (let i = 0; i < 4; i += 1) {
    game.start(MODE_CAMPAIGN, i);
    wipe(game);
    game.update(16);
  }
  assert.equal(game.data.medals["1"], true);
  assert.equal(game.data.campaignUnlocked, 5);
  assert.equal(game.data.medals["2"], undefined);
});

test("breakthrough banks the magazine and unlocks the next puzzle", () => {
  const game = fresh();
  game.start(MODE_BREAKTHROUGH, 0);
  const id = ENDGAMES[0].id;
  game.state.ammo = 4;
  wipe(game);
  game.update(16);
  assert.equal(game.result.outcome, "cleared");
  assert.equal(game.result.ammoLeft, 4);
  assert.equal(game.data.endgames[id].cleared, true);
  assert.equal(game.data.endgames[id].ammoLeft, 4);
  assert.equal(game.data.endgameUnlocked, 2);
  assert.equal(game.result.stars, null, "puzzles are not star graded");
});

test("the siege never clears: waves keep rolling and the best wave is banked", () => {
  const game = fresh();
  game.start(MODE_LAST_STAND);
  assert.equal(game.state.wave, 1);
  assert.equal(game.next(), false, "the siege has no next stage");
  for (let w = 0; w < 3; w += 1) {
    wipe(game);
    game.update(16);
    assert.equal(game.state.phase, PHASES.playing);
    assert.equal(game.state.wave, w + 2);
  }
  game.state.base.hp = 0;
  game.update(16);
  assert.equal(game.result.outcome, "lost");
  assert.equal(game.data.records.bestWave, 4);
  assert.ok(game.data.records.bestHold > 0);
});

test("the last kill triggers the slow motion beat", () => {
  const game = fresh();
  const seen = [];
  game.on((type) => seen.push(type));
  // A breakthrough garrison is all present from the start, so one grenade really is
  // the last kill. Wait out the spawn flash first: materialising tanks are immune.
  game.start(MODE_BREAKTHROUGH, 0);
  for (let i = 0; i < 50; i += 1) game.update(16);
  assert.ok(game.state.enemies.length > 0);
  const p = game.state.player;
  game.state.drops.push({
    id: 9999,
    kind: "grenade",
    hx: Math.floor(p.x),
    hy: Math.floor(p.y),
    ttl: 20,
  });
  game.update(16);
  assert.equal(game.state.enemies.length, 0);
  assert.ok(seen.includes("lastKill"), `events seen: ${seen.join(",")}`);
  assert.equal(game.slowMo, SLOW_MO);
  assert.ok(seen.includes("finish"));
  assert.ok(game.state.stats.kills > 0);
});

test("slow motion also fires when the field is cleared without a final shot", () => {
  const game = fresh();
  game.start(MODE_CAMPAIGN, 0);
  wipe(game);
  game.update(16);
  assert.equal(game.slowMo, SLOW_MO);
});

test("a finished battle ignores further frames and intents", () => {
  const game = fresh();
  game.start(MODE_CAMPAIGN, 0);
  wipe(game);
  game.update(16);
  const settled = game.result;
  for (let i = 0; i < 30; i += 1) game.update(16);
  assert.equal(game.result, settled);
  assert.equal(game.move(DIR.UP), null);
  assert.equal(game.fire(), null);
});

test("restart and next drive the campaign forward", () => {
  const game = fresh();
  game.start(MODE_CAMPAIGN, 0);
  game.state.score = 500;
  game.restart();
  assert.equal(game.state.score, 0);
  assert.equal(game.index, 0);
  assert.equal(game.next(), true);
  assert.equal(game.index, 1);
  game.start(MODE_CAMPAIGN, LEVELS.length - 1);
  assert.equal(game.next(), false);
});

test("the hud carries everything the tray has to show", () => {
  const game = fresh();
  game.start(MODE_BREAKTHROUGH, 2);
  const hud = game.hud();
  assert.equal(hud.mode, MODE_BREAKTHROUGH);
  assert.equal(hud.levelId, ENDGAMES[2].id);
  assert.equal(hud.ammo, ENDGAMES[2].ammo);
  assert.equal(hud.ammoMax, ENDGAMES[2].ammo);
  assert.equal(hud.remaining, ENDGAMES[2].preset.length);
  assert.equal(hud.baseHp, 3);
  assert.equal(hud.lives, 3);
  assert.ok(["artillery", "fortify", "jam"].includes(hud.order));
  assert.equal(hud.paused, false);
  assert.equal(hud.phase, PHASES.playing);
});

test("options persist through the dossier", () => {
  const game = fresh();
  assert.equal(game.setMuted(true), true);
  assert.equal(store.load().muted, true);
  assert.equal(game.setHints(false), false);
  assert.equal(store.load().hints, false);
  game.data.campaign.level_1_1 = { stars: 3 };
  game.resetProgress();
  assert.deepEqual(game.data.campaign, {});
  assert.deepEqual(store.load().campaign, {});
});
