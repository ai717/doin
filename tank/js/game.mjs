// Tank Assault - controller. DOM-free: receives intents, drives the engine, persists results.
import {
  LEVELS,
  ENDGAMES,
  LAST_STAND,
  ORDERS,
  hashSeed,
} from "./levels.mjs";
import {
  createState,
  startBattle,
  stepFrame,
  applyIntent,
  remainingEnemies,
  PHASES,
  CHARGE_MAX,
} from "./engine.mjs";
import * as store from "./storage.mjs";
import * as score from "./score.mjs";

export const MODE_CAMPAIGN = "campaign";
export const MODE_BREAKTHROUGH = "breakthrough";
export const MODE_LAST_STAND = "last_stand";

export const SLOW_MO = 0.5; // seconds of half-speed drift after the last tank blows up

export class TankGame {
  constructor() {
    this.data = store.load();
    this.state = null;
    this.mode = MODE_CAMPAIGN;
    this.index = 0;
    this.paused = false;
    this.slowMo = 0;
    this.result = null;
    this.lostReason = null;
    this.listeners = new Set();
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(type, payload = {}) {
    for (const fn of this.listeners) fn(type, payload);
  }

  get level() {
    if (this.mode === MODE_BREAKTHROUGH) return ENDGAMES[this.index] ?? ENDGAMES[0];
    if (this.mode === MODE_LAST_STAND) return LAST_STAND;
    return LEVELS[this.index] ?? LEVELS[0];
  }

  levelCount() {
    if (this.mode === MODE_BREAKTHROUGH) return ENDGAMES.length;
    if (this.mode === MODE_LAST_STAND) return 1;
    return LEVELS.length;
  }

  start(mode, index = 0) {
    this.mode =
      mode === MODE_BREAKTHROUGH ? MODE_BREAKTHROUGH : mode === MODE_LAST_STAND ? MODE_LAST_STAND : MODE_CAMPAIGN;
    this.index = this.mode === MODE_LAST_STAND ? 0 : Math.max(0, Math.min(this.levelCount() - 1, index));
    const level = this.level;
    // Every stage is seeded from its own id, so a stage replays exactly the same way
    // and the endless siege stays comparable across runs.
    this.state = createState({ level, seed: hashSeed(level.id) });
    startBattle(this.state);
    this.paused = false;
    this.slowMo = 0;
    this.result = null;
    this.lostReason = null;
    this.emit("start", { mode: this.mode, index: this.index, level });
    return this.state;
  }

  restart() {
    return this.start(this.mode, this.index);
  }

  next() {
    if (this.mode === MODE_LAST_STAND) return false;
    if (this.index + 1 >= this.levelCount()) return false;
    this.start(this.mode, this.index + 1);
    return true;
  }

  /* ----------------------------------------------------------------- intents */

  move(dir) {
    return this.state ? applyIntent(this.state, { type: "move", dir }) : null;
  }

  stop() {
    return this.state ? applyIntent(this.state, { type: "stop" }) : null;
  }

  fire() {
    return this.state ? applyIntent(this.state, { type: "fire" }) : null;
  }

  order() {
    return this.state ? applyIntent(this.state, { type: "order" }) : null;
  }

  setPaused(value) {
    this.paused = Boolean(value);
    this.emit("pause", { paused: this.paused });
    return this.paused;
  }

  togglePause() {
    return this.setPaused(!this.paused);
  }

  /* ------------------------------------------------------------------- clock */

  update(dtMs) {
    const st = this.state;
    if (!st || this.paused || st.phase !== PHASES.playing) return null;
    const dt = Math.max(0, Math.min(0.05, Number(dtMs) / 1000 || 0));
    const events = stepFrame(st, dt);
    for (const event of events) {
      if (event.type === "lost") this.lostReason = event.reason;
      this.emit("event", event);
    }
    const lastKill = events.some((e) => e.type === "kill") && remainingEnemies(st) === 0;
    if (lastKill) {
      this.slowMo = SLOW_MO;
      this.emit("lastKill", { x: st.player.x, y: st.player.y });
    }
    if (st.phase === PHASES.cleared) {
      this.slowMo = SLOW_MO;
      this.finish("cleared");
    }
    else if (st.phase === PHASES.lost) this.finish("lost");
    return events;
  }

  /* ----------------------------------------------------------------- results */

  finish(outcome) {
    const st = this.state;
    if (!st || this.result) return this.result;
    const lv = this.level;
    const time = st.time;
    let stars = null;
    let bonus = 0;

    if (outcome === "cleared" && this.mode === MODE_CAMPAIGN) {
      stars = score.starsFor({
        baseHp: st.base.hp,
        maxBaseHp: st.base.maxHp,
        time,
        parTime: st.parTime,
        deaths: st.deaths,
      });
      bonus = score.stageBonus({
        timeLeft: Math.max(0, st.parTime - time),
        baseHp: st.base.hp,
        lives: st.lives,
        parTime: st.parTime,
      });
      st.score = score.clampScore(st.score + bonus);
      const count = score.starCount(stars);
      const prev = this.data.campaign[lv.id];
      this.data.campaign[lv.id] = {
        stars: Math.max(count, prev?.stars ?? 0),
        time: Math.min(time, prev?.time ?? time),
        baseHp: Math.max(st.base.hp, prev?.baseHp ?? 0),
        deaths: Math.min(st.deaths, prev?.deaths ?? st.deaths),
        score: Math.max(st.score, prev?.score ?? 0),
      };
      this.data.campaignUnlocked = Math.max(
        this.data.campaignUnlocked,
        Math.min(store.CAMPAIGN_SIZE, this.index + 2)
      );
      if (store.chapterCleared(this.data, lv.chapter, LEVELS)) {
        this.data.medals[String(lv.chapter)] = true;
      }
    }

    if (outcome === "cleared" && this.mode === MODE_BREAKTHROUGH) {
      this.data.endgames[lv.id] = {
        cleared: true,
        time,
        ammoLeft: Number.isFinite(st.ammo) ? st.ammo : 0,
        score: st.score,
      };
      this.data.endgameUnlocked = Math.max(
        this.data.endgameUnlocked,
        Math.min(store.ENDGAME_SIZE, this.index + 2)
      );
    }

    const r = this.data.records;
    r.kills += st.stats.kills;
    r.bricks += st.stats.bricks;
    r.ricochets += st.stats.ricochets;
    r.shots += st.stats.shots;
    r.hits += st.stats.hits;
    r.maxCombo = Math.max(r.maxCombo, st.bestCombo);
    r.bestWave = Math.max(r.bestWave, st.wave);
    if (this.mode === MODE_LAST_STAND) r.bestHold = Math.max(r.bestHold, time);
    r.stars = store.totalStars(this.data);
    r.cleared = store.clearedCount(this.data);
    store.save(this.data);

    this.result = {
      outcome,
      mode: this.mode,
      levelId: lv.id,
      chapter: lv.chapter ?? 0,
      index: this.index,
      reason: this.lostReason,
      time,
      parTime: st.parTime,
      score: st.score,
      bonus,
      stars,
      starCount: stars ? score.starCount(stars) : 0,
      wave: st.wave,
      baseHp: st.base.hp,
      lives: st.lives,
      deaths: st.deaths,
      ammoLeft: Number.isFinite(st.ammo) ? st.ammo : 0,
      stats: { ...st.stats },
      bestCombo: st.bestCombo,
    };
    this.emit("finish", this.result);
    return this.result;
  }

  /* ------------------------------------------------------------------ readout */

  hud() {
    const st = this.state;
    if (!st) return null;
    const p = st.player;
    return {
      mode: this.mode,
      index: this.index,
      levelId: st.levelId,
      chapter: st.chapter,
      phase: st.phase,
      paused: this.paused,
      score: st.score,
      lives: st.lives,
      baseHp: st.base.hp,
      maxBaseHp: st.base.maxHp,
      combo: st.combo,
      charge: st.charge,
      chargeMax: CHARGE_MAX,
      order: ORDERS[st.orderIndex % ORDERS.length],
      star: p.star,
      shield: p.shieldT > 0,
      grace: p.graceT > 0,
      remaining: remainingEnemies(st),
      total: st.queue.length,
      wave: st.wave,
      ammo: Number.isFinite(st.ammo) ? st.ammo : 0,
      ammoMax: st.ammoMax,
      time: st.time,
      timeLeft: st.timeLimit > 0 ? st.timeLeft : 0,
      timeLimit: st.timeLimit,
      parTime: st.parTime,
      kills: st.kills,
      freeze: st.freezeT > 0,
      steelBase: st.steelBaseT > 0,
    };
  }

  /* ----------------------------------------------------------------- options */

  setHints(value) {
    this.data.hints = Boolean(value);
    store.save(this.data);
    return this.data.hints;
  }

  setMuted(value) {
    this.data.muted = Boolean(value);
    store.save(this.data);
    return this.data.muted;
  }

  resetProgress() {
    this.data = store.clear();
    this.emit("reset", {});
    return this.data;
  }
}
