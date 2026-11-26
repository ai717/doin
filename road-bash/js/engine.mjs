// engine.mjs — 暴力摩托规则唯一权威，DOM-free。
// 固定步长 stepFrame(state, dt)；离散操作 applyIntent。合法操作永不抛错。
// action === null 表示这一步没生效。终局一律 no-op。
// rng 可注入（默认 mulberry32(seed)），交通与 AI 因此可重放。

import { BIKES, raceSpec, bikeById } from "./levels.mjs";
import { CLUB_HITS, raceCash, starsForResult } from "./score.mjs";

export const ROAD_HALF = 1.5;
export const SHOULDER = 1.78;
export const RAIL_X = 2.02;
export const LANES = Object.freeze([-0.92, 0, 0.92]);
export const RIVAL_COUNT = 6;
export const STAMINA_MAX = 100;
export const BUST_LIMIT = 1.15;
export const COUNTDOWN = 3;
export const HIT_STOP = 0.045;
export const MAX_STICK = 2;
export const MODES = Object.freeze(["league", "brawl", "getaway"]);
export const STATUS = Object.freeze({
  countdown: "countdown",
  racing: "racing",
  won: "won",
  lost: "lost",
});

const PUNCH = { dz: 8, dx: 0.58, dmg: 24, knock: 0.14, wind: 0.08, active: 0.1, recover: 0.16 };
const BACKHAND = { dz: 8, dx: 0.58, dmg: 34, knock: 0.18, wind: 0.12, active: 0.12, recover: 0.2 };
const KICK = { dz: 12, dx: 0.78, dmg: 20, knock: 0.4, wind: 0.1, active: 0.12, recover: 0.18 };
const CLUB = { dz: 9, dx: 0.62, dmg: 42, knock: 0.22, wind: 0.14, active: 0.14, recover: 0.22 };

const COLORS = [
  { body: "#e24b32", suit: "#2f9e6a", helm: "#f2d44a" },
  { body: "#3d7dff", suit: "#7b4adf", helm: "#f4f0ea" },
  { body: "#f0a202", suit: "#c43d5a", helm: "#6ee0c4" },
  { body: "#2bb0a6", suit: "#355c7d", helm: "#ffb4c8" },
  { body: "#c77dff", suit: "#ee6c4d", helm: "#ffe066" },
  { body: "#8d6e63", suit: "#1d3557", helm: "#a8dadc" },
  { body: "#111111", suit: "#1b3a4b", helm: "#dbe7ff" },
];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(text) {
  const s = String(text ?? "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function curveAt(z, track) {
  const f = track.curveFreq;
  const a = track.curveAmp;
  return Math.sin(z * f) * a + Math.sin(z * f * 0.37 + 1.7) * a * 0.45;
}

export function hillAt(z, track) {
  return Math.sin(z * track.hillFreq) * track.hillAmp + Math.sin(z * track.hillFreq * 0.51 + 0.6) * track.hillAmp * 0.35;
}

function clamp(n, lo, hi) {
  return n < lo ? lo : n > hi ? hi : n;
}

function laneX(i) {
  return LANES[((i % 3) + 3) % 3];
}

function pushEvent(state, event) {
  state.events.push(event);
}

export function drainEvents(state) {
  const out = state.events;
  state.events = [];
  return out;
}

export function isTerminal(state) {
  return !state || state.status === STATUS.won || state.status === STATUS.lost;
}

export function occupiedLanesAt(state, z, window = 16) {
  const used = [false, false, false];
  for (const car of state.cars) {
    if (Math.abs(car.z - z) > window) continue;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < 3; i += 1) {
      const d = Math.abs(car.x - LANES[i]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (bestD < 0.45) used[best] = true;
  }
  return used;
}

export function openLanesAt(state, z, window = 16) {
  const used = occupiedLanesAt(state, z, window);
  const open = [];
  for (let i = 0; i < 3; i += 1) if (!used[i]) open.push(i);
  return open;
}

export function hasOpenLane(state, z, window = 16) {
  return openLanesAt(state, z, window).length > 0;
}

function makeRider({
  id,
  kind,
  personality,
  x,
  z,
  bike,
  color,
  weapon = "fist",
  targetSpeed,
}) {
  return {
    id,
    kind,
    personality,
    x,
    z,
    vx: 0,
    speed: 0,
    bike,
    stamina: STAMINA_MAX,
    bikeHp: bike.armor,
    maxHp: bike.armor,
    mounted: true,
    wrecked: false,
    finished: false,
    finishPlace: 0,
    finishTime: 0,
    weapon,
    clubHits: weapon === "club" ? CLUB_HITS : 0,
    attack: null,
    stun: 0,
    hitCd: 0,
    justMissed: 0,
    sticking: false,
    color,
    crashes: 0,
    knockouts: 0,
    fly: null,
    bikeX: x,
    bikeZ: z,
    bikeSlide: 0,
    run: 0,
    targetSpeed,
    desiredLane: 1,
    alertHits: 0,
  };
}

function personalitiesFor(spec, rng) {
  const list = ["normal", "normal", "speedster", "brawler", "brawler", "clubber"];
  if (spec.mode === "brawl") {
    list[0] = "brawler";
    list[1] = "brawler";
    list[2] = "clubber";
  }
  if (spec.mode === "getaway") {
    return ["normal", "normal", "speedster", "normal", "brawler", "normal"];
  }
  if (spec.aggression > 0.7) list[1] = "clubber";
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  if (!list.includes("clubber") && spec.mode !== "getaway") list[0] = "clubber";
  return list;
}

export function createRace({ mode = "league", raceId = 0, bikeId = 0, seed } = {}, { rng } = {}) {
  const spec = raceSpec(mode, raceId);
  const seedValue = Number.isFinite(seed) ? seed >>> 0 : hashSeed(spec.seedKey);
  const rand = rng || mulberry32(seedValue);
  const playerBike = bikeById(bikeId);
  const riders = [];

  riders.push(
    makeRider({
      id: 0,
      kind: "player",
      personality: "player",
      x: 0.2,
      z: 4,
      bike: playerBike,
      color: COLORS[0],
      targetSpeed: playerBike.maxSpeed,
    }),
  );

  const pers = personalitiesFor(spec, rand);
  const rivalCount = spec.mode === "getaway" ? 2 : RIVAL_COUNT;
  for (let i = 0; i < rivalCount; i += 1) {
    const p = pers[i] || "normal";
    const aiBike = bikeById(clamp(spec.tier + (p === "speedster" ? 1 : 0), 0, 3));
    const speedMul = spec.aiSpeed * (p === "speedster" ? 1.06 : p === "brawler" ? 0.94 : 1);
    riders.push(
      makeRider({
        id: i + 1,
        kind: "rival",
        personality: p,
        x: laneX(i + (i > 2 ? 1 : 0)) + (rand() - 0.5) * 0.18,
        z: 10 + i * 14 + rand() * 8,
        bike: aiBike,
        color: COLORS[(i + 1) % COLORS.length],
        weapon: p === "clubber" ? "club" : "fist",
        targetSpeed: playerBike.maxSpeed * speedMul,
      }),
    );
  }

  if (spec.mode === "getaway") {
    riders.push(
      makeRider({
        id: riders.length,
        kind: "cop",
        personality: "cop",
        x: -0.2,
        z: -18,
        bike: bikeById(Math.min(3, spec.tier + 1)),
        color: COLORS[6],
        targetSpeed: playerBike.maxSpeed * 1.08,
      }),
    );
  }

  return {
    mode: spec.mode,
    raceId: spec.raceId,
    spec,
    seed: seedValue,
    rng: rand,
    status: STATUS.countdown,
    countdown: COUNTDOWN,
    time: 0,
    paused: false,
    hitStop: 0,
    input: { accel: false, brake: false, steer: 0, cruise: false },
    riders,
    cars: [],
    spawnAcc: 0,
    lastSpawnZ: 40,
    events: [],
    fx: { shake: 0, flash: 0, slow: 0 },
    stats: {
      knockouts: 0,
      crashes: 0,
      farthestFly: 0,
      nearMiss: 0,
      nearMissCd: 0,
      bust: 0,
      maxBust: 0,
      alert: 0,
    },
    copBackup: 0,
    result: null,
  };
}

export function playerOf(state) {
  return state.riders[0];
}

export function computePlace(state, rider) {
  if (rider.finishPlace) return rider.finishPlace;
  let place = 1;
  const rz = rider.finished ? state.spec.length + (8 - rider.finishPlace) : rider.z;
  for (const other of state.riders) {
    if (other.id === rider.id || other.wrecked) continue;
    const oz = other.finished ? state.spec.length + (8 - other.finishPlace) : other.z;
    if (oz > rz + 0.01) place += 1;
  }
  return place;
}

export function nearestTarget(state, rider, maxDz, maxDx) {
  let best = null;
  let bestScore = Infinity;
  for (const other of state.riders) {
    if (other.id === rider.id || !other.mounted || other.wrecked || other.finished) continue;
    const dz = other.z - rider.z;
    const dx = other.x - rider.x;
    if (Math.abs(dz) > maxDz || Math.abs(dx) > maxDx) continue;
    const score = Math.abs(dz) + Math.abs(dx) * 10;
    if (score < bestScore) {
      bestScore = score;
      best = other;
    }
  }
  return best;
}

function attackBusy(rider) {
  return Boolean(rider.attack) || rider.stun > 0 || !rider.mounted;
}

function startMove(rider, move, dir) {
  const table = move === "kick" ? KICK : move === "backhand" ? BACKHAND : move === "club" ? CLUB : PUNCH;
  rider.attack = {
    move,
    dir,
    t: 0,
    wind: table.wind,
    active: table.active,
    recover: table.recover,
    landed: false,
    dmg: table.dmg,
    knock: table.knock,
    dz: table.dz,
    dx: table.dx,
  };
}

function resolveMove(state, rider, intentMove) {
  if (isTerminal(state) || state.status === STATUS.countdown) return false;
  if (attackBusy(rider) || rider.wrecked || rider.finished) return false;
  const isKick = intentMove === "kick";
  const table = isKick ? KICK : PUNCH;
  const target = nearestTarget(state, rider, table.dz, table.dx);
  let move = isKick ? "kick" : "punch";
  let dir = state.input.steer || 0;
  if (!isKick && target) {
    const toward = Math.sign(target.x - rider.x) || 1;
    if (dir && dir !== toward) move = "backhand";
    else dir = toward;
  } else if (isKick) {
    dir = dir || (target ? Math.sign(target.x - rider.x) || 1 : rider.x >= 0 ? 1 : -1);
  }
  if (!isKick && rider.weapon === "club") move = "club";
  startMove(rider, move, dir);
  pushEvent(state, { type: "swing", id: rider.id, move });
  return true;
}

function trySteal(attacker, target, move) {
  if (target.weapon !== "club") return false;
  const winding = target.attack && target.attack.move === "club" && target.attack.t < target.attack.wind;
  if (move === "backhand" || winding || target.justMissed > 0) {
    attacker.weapon = "club";
    attacker.clubHits = target.clubHits > 0 ? target.clubHits : CLUB_HITS;
    target.weapon = "fist";
    target.clubHits = 0;
    if (target.attack && target.attack.move === "club") target.attack = null;
    return true;
  }
  return false;
}

function environmentKill(state, rider) {
  for (const car of state.cars) {
    if (Math.abs(car.z - rider.z) < 3.4 && Math.abs(car.x - rider.x) < 0.42) return "car";
  }
  if (Math.abs(rider.x) >= RAIL_X) return "rail";
  return null;
}

function crashRider(state, rider, cause) {
  if (!rider.mounted || rider.wrecked) return;
  const speed = rider.speed;
  rider.mounted = false;
  rider.attack = null;
  rider.stun = 0;
  rider.speed = 0;
  rider.crashes += 1;
  rider.bikeHp -= 1;
  const fly = 5 + speed * 0.35 + (cause === "knockout" ? 6 : 0);
  rider.fly = { t: 0, dur: 0.72, dist: fly, x0: rider.x, z0: rider.z, sx: (rider.x >= 0 ? 1 : -1) * 0.35 };
  rider.bikeX = clamp(rider.x, -SHOULDER + 0.1, SHOULDER - 0.1);
  rider.bikeZ = rider.z + 2;
  rider.bikeSlide = Math.max(8, fly * 1.35);
  rider.run = 0;
  if (rider.id === 0) {
    state.stats.crashes += 1;
    state.stats.farthestFly = Math.max(state.stats.farthestFly, fly);
  }
  pushEvent(state, { type: "crash", id: rider.id, cause, fly });
  if (rider.bikeHp <= 0) {
    rider.wrecked = true;
    pushEvent(state, { type: "wrecked", id: rider.id });
    if (rider.id === 0) finishRace(state, false, "wrecked");
  }
}

function landHit(state, attacker, target, atk) {
  const aiScale = attacker.kind === "player" ? 1 : 0.72;
  target.stamina -= atk.dmg * aiScale;
  target.hitCd = 0.45;
  target.stun = Math.max(target.stun, 0.12);
  target.x += atk.dir * atk.knock;
  target.vx += atk.dir * atk.knock * 1.6;
  atk.landed = true;
  state.hitStop = Math.max(state.hitStop, HIT_STOP);
  state.fx.shake = Math.max(state.fx.shake, 0.55);
  const stolen = trySteal(attacker, target, atk.move);
  if (stolen) pushEvent(state, { type: "steal", id: attacker.id, from: target.id });
  if (atk.move === "club") {
    attacker.clubHits -= 1;
    if (attacker.clubHits <= 0) {
      attacker.weapon = "fist";
      attacker.clubHits = 0;
    }
  }
  pushEvent(state, { type: "hit", id: attacker.id, target: target.id, move: atk.move });
  const env = environmentKill(state, target);
  if (env) {
    crashRider(state, target, env);
  } else if (target.stamina <= 0) {
    attacker.knockouts += 1;
    if (attacker.id === 0) state.stats.knockouts += 1;
    crashRider(state, target, "knockout");
    pushEvent(state, { type: "knockout", id: attacker.id, target: target.id });
  }
}

function stepAttack(state, rider, dt) {
  const atk = rider.attack;
  if (!atk) return;
  atk.t += dt;
  const strikeAt = atk.wind;
  const recoverAt = atk.wind + atk.active;
  const endAt = recoverAt + atk.recover;
  if (!atk.landed && atk.t >= strikeAt && atk.t <= recoverAt) {
    const target = nearestTarget(state, rider, atk.dz, atk.dx);
    if (target) landHit(state, rider, target, atk);
  }
  if (atk.t >= recoverAt && !atk.landed && atk.justChecked !== true) {
    atk.justChecked = true;
    rider.justMissed = 0.28;
    pushEvent(state, { type: "whiff", id: rider.id, move: atk.move });
  }
  if (atk.t >= endAt) rider.attack = null;
}

function finishRace(state, won, reason) {
  if (isTerminal(state)) return;
  const player = playerOf(state);
  if (!player.finished && won) {
    player.finished = true;
    player.finishPlace = computePlace(state, player);
    player.finishTime = state.time;
  }
  const place = player.finishPlace || computePlace(state, player);
  const payload = {
    mode: state.mode,
    raceId: state.raceId,
    won: Boolean(won),
    reason,
    place,
    qualify: state.spec.qualify,
    knockouts: state.stats.knockouts,
    crashes: state.stats.crashes,
    quota: state.spec.quota,
    farthestFly: state.stats.farthestFly,
    maxBust: state.stats.maxBust,
    tier: state.spec.tier,
    time: state.time,
  };
  payload.stars = starsForResult(payload);
  payload.cash = raceCash(payload);
  state.result = payload;
  state.status = won ? STATUS.won : STATUS.lost;
  state.fx.slow = won ? 0.8 : 0.35;
  pushEvent(state, { type: won ? "finish" : "fail", reason, place, stars: payload.stars, cash: payload.cash });
}

function maybeFinishPlayer(state) {
  const player = playerOf(state);
  if (player.finished || player.wrecked || !player.mounted) return;
  if (player.z < state.spec.length) return;
  player.finished = true;
  player.finishPlace = computePlace(state, player);
  player.finishTime = state.time;
  if (state.mode === "league") {
    const ok = player.finishPlace <= state.spec.qualify;
    finishRace(state, ok, ok ? "qualify" : "place");
  } else if (state.mode === "brawl") {
    const ok = state.stats.knockouts >= state.spec.quota;
    finishRace(state, ok, ok ? "quota" : "quota-fail");
  } else {
    finishRace(state, true, "escape");
  }
}

function lookCars(state, rider, ahead = 28) {
  let left = false;
  let mid = false;
  let right = false;
  for (const car of state.cars) {
    const dz = car.z - rider.z;
    if (dz < 2 || dz > ahead) continue;
    if (Math.abs(car.x - rider.x) > 0.7) continue;
    if (car.x < -0.4) left = true;
    else if (car.x > 0.4) right = true;
    else mid = true;
  }
  return { left, mid, right };
}

function chooseLane(state, rider) {
  const look = lookCars(state, rider);
  const order = [1, 2, 0];
  if (rider.personality === "brawler" || rider.personality === "clubber" || rider.kind === "cop") {
    const player = playerOf(state);
    const prefer = player.x > 0.3 ? 2 : player.x < -0.3 ? 0 : 1;
    order.unshift(prefer);
  }
  for (const i of order) {
    const blocked = i === 0 ? look.left : i === 2 ? look.right : look.mid;
    if (!blocked) return i;
  }
  return rider.desiredLane;
}

function countStick(state) {
  const player = playerOf(state);
  let n = 0;
  for (const r of state.riders) {
    if (r.id === 0 || !r.mounted || r.wrecked) continue;
    if (Math.abs(r.z - player.z) < 10 && Math.abs(r.x - player.x) < 0.7) n += 1;
  }
  return n;
}

function steerToward(rider, x, dt) {
  const dx = x - rider.x;
  const want = clamp(dx * 3.2, -1, 1);
  rider.vx += (want * rider.bike.handling - rider.vx * 3.4) * dt;
}

function stepRiderMotion(state, rider, dt, accel, brake, steer) {
  if (rider.wrecked || rider.finished) return;
  if (rider.fly) {
    rider.fly.t += dt;
    const u = clamp(rider.fly.t / rider.fly.dur, 0, 1);
    rider.x = rider.fly.x0 + rider.fly.sx * Math.sin(u * Math.PI);
    rider.z = rider.fly.z0 + rider.fly.dist * u * 0.22;
    rider.bikeZ += rider.bikeSlide * dt;
    rider.bikeSlide *= Math.exp(-2.4 * dt);
    rider.bikeX = clamp(rider.bikeX, -SHOULDER, SHOULDER);
    if (u >= 1) rider.fly = null;
    return;
  }
  if (!rider.mounted) {
    if (rider.bikeHp <= 0) return;
    const catchZ = rider.bikeZ;
    rider.z += 7.2 * dt;
    rider.x += (rider.bikeX - rider.x) * 4 * dt;
    rider.bikeZ += rider.bikeSlide * dt;
    rider.bikeSlide *= Math.exp(-3.2 * dt);
    if (rider.z >= catchZ - 1.2) {
      rider.mounted = true;
      rider.x = rider.bikeX;
      rider.z = rider.bikeZ;
      rider.speed = 8;
      rider.stamina = Math.max(42, STAMINA_MAX * 0.6);
      rider.fly = null;
      pushEvent(state, { type: "remount", id: rider.id });
    }
    return;
  }

  const curve = curveAt(rider.z, state.spec.track);
  const tight = state.spec.track.tight ? 1.25 : 1;
  rider.x += curve * rider.speed * 0.0011 * tight * dt;

  const handling = rider.bike.handling;
  rider.vx += (steer * handling * 1.2 - rider.vx * 4.1) * dt;
  rider.vx = clamp(rider.vx, -1.05, 1.05);
  rider.x += rider.vx * dt * 6.2;

  if (Math.abs(rider.x) > SHOULDER) {
    rider.speed *= Math.exp(-1.8 * dt);
    state.fx.flash = Math.max(state.fx.flash, 0.12);
  }
  if (Math.abs(rider.x) >= RAIL_X) {
    crashRider(state, rider, "rail");
    return;
  }

  const maxV = rider.bike.maxSpeed;
  if (brake) rider.speed = Math.max(0, rider.speed - rider.bike.brake * dt);
  else if (accel) rider.speed = Math.min(maxV, rider.speed + rider.bike.accel * dt);
  else rider.speed = Math.max(0, rider.speed - 3.2 * dt);

  rider.z += rider.speed * dt;
  rider.stamina = Math.min(STAMINA_MAX, rider.stamina + (rider.hitCd > 0 ? 0 : 11) * dt);
  rider.stun = Math.max(0, rider.stun - dt);
  rider.hitCd = Math.max(0, rider.hitCd - dt);
  rider.justMissed = Math.max(0, rider.justMissed - dt);
  stepAttack(state, rider, dt);
}

function stepPlayer(state, dt) {
  const rider = playerOf(state);
  if (state.status === STATUS.countdown) {
    const steer = state.input.steer;
    rider.vx += (steer * rider.bike.handling * 1.2 - rider.vx * 4.1) * dt;
    rider.vx = clamp(rider.vx, -1.05, 1.05);
    rider.x = clamp(rider.x + rider.vx * dt * 5.4, -1.2, 1.2);
    if (state.input.accel) rider.speed = Math.min(9, rider.speed + rider.bike.accel * dt);
    else rider.speed = Math.max(0, rider.speed - 8 * dt);
    return;
  }
  let accel = state.input.accel;
  let brake = state.input.brake;
  if (state.input.cruise && !accel && !brake) {
    const cruise = rider.bike.maxSpeed * 0.62;
    accel = rider.speed < cruise - 0.4;
    brake = rider.speed > cruise + 1.2;
  }
  stepRiderMotion(state, rider, dt, accel, brake, state.input.steer);
}

function stepAI(state, dt) {
  const player = playerOf(state);
  const sticks = countStick(state);
  for (const rider of state.riders) {
    if (rider.id === 0) continue;
    if (rider.wrecked || rider.finished) continue;
    if (!rider.mounted) {
      stepRiderMotion(state, rider, dt, false, false, 0);
      continue;
    }
    if (state.status === STATUS.countdown) {
      rider.x += (laneX(rider.id) - rider.x) * dt;
      continue;
    }

    rider.desiredLane = chooseLane(state, rider);
    let desiredX = laneX(rider.desiredLane);

    if (rider.kind === "cop") {
      if (!player.mounted) {
        rider.targetSpeed = 8;
        desiredX = player.bikeX;
      } else {
        rider.targetSpeed = player.bike.maxSpeed * 1.08;
        desiredX = player.x;
      }
    } else {
      const lead = rider.z - player.z;
      let mul = 1;
      if (lead > 36) mul = 0.86;
      else if (lead < -48) mul = 1.1;
      const want = rider.targetSpeed * mul;
      const accel = rider.speed < want - 0.5;
      const brake = rider.speed > want + 1.4;
      const stickNow = Math.abs(rider.z - player.z) < 10 && Math.abs(rider.x - player.x) < 0.7;
      const mayStick = rider.sticking || sticks < MAX_STICK || !stickNow;
      if ((rider.personality === "brawler" || rider.personality === "clubber") && mayStick && player.mounted) {
        if (Math.abs(player.z - rider.z) < 18) {
          desiredX = player.x;
          rider.sticking = stickNow;
        } else rider.sticking = false;
      } else rider.sticking = false;

      steerToward(rider, desiredX, dt);
      const steer = Math.sign(desiredX - rider.x);
      stepRiderMotion(state, rider, dt, accel, brake, steer);

      const agg = state.spec.aggression;
      const fight =
        (rider.personality === "brawler" || rider.personality === "clubber" || rider.kind === "cop") &&
        player.mounted &&
        Math.abs(player.z - rider.z) < 8 &&
        Math.abs(player.x - rider.x) < 0.6 &&
        (rider.sticking || sticks <= MAX_STICK);
      if (fight && !rider.attack && rider.stun <= 0 && state.rng() < agg * 1.4 * dt) {
        const move = rider.weapon === "club" ? "club" : state.rng() < 0.3 ? "kick" : "punch";
        startMove(rider, move, Math.sign(player.x - rider.x) || 1);
      }
      continue;
    }

    const want = rider.targetSpeed;
    const accel = rider.speed < want - 0.4;
    const brake = rider.speed > want + 1.2;
    steerToward(rider, desiredX, dt);
    stepRiderMotion(state, rider, dt, accel, brake, Math.sign(desiredX - rider.x));
  }
}

function spawnCar(state, z, oncoming) {
  const open = openLanesAt(state, z, 18);
  if (open.length <= 1) return false;
  const lane = open[Math.floor(state.rng() * open.length)];
  const kind = oncoming && state.rng() < 0.45 ? "truck" : "car";
  state.cars.push({
    id: state.cars.length + 1,
    x: laneX(lane) + (state.rng() - 0.5) * 0.08,
    z,
    speed: oncoming ? -(18 + state.rng() * 8) : 11 + state.rng() * 6,
    kind,
    dir: oncoming ? -1 : 1,
  });
  return true;
}

function spawnTraffic(state, dt) {
  if (state.status !== STATUS.racing) return;
  state.spawnAcc += dt;
  if (state.spawnAcc < 0.18) return;
  state.spawnAcc = 0;
  const player = playerOf(state);
  const density = state.spec.track.traffic * state.spec.trafficMul;
  const gap = (22 + state.rng() * 28) / Math.max(0.35, density);
  const z = Math.max(state.lastSpawnZ + gap, player.z + 70);
  if (z > state.spec.length - 40) return;
  const oncoming = state.rng() < state.spec.track.oncoming;
  if (oncoming) spawnCar(state, player.z + 160, true);
  else spawnCar(state, z, false);
  state.lastSpawnZ = z;
}

function enforceGaps(state) {
  const player = playerOf(state);
  const samples = [8, 20, 40, 50, 70, 90, 110, 150, 190];
  for (const car of state.cars) samples.push(car.z - player.z);
  for (const ahead of samples) {
    const z = player.z + ahead;
    if (openLanesAt(state, z, 16).length > 0) continue;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < state.cars.length; i += 1) {
      const d = Math.abs(state.cars[i].z - z);
      if (d < bestD && d < 16) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) state.cars.splice(best, 1);
  }
}

function stepCars(state, dt) {
  const player = playerOf(state);
  const keep = [];
  for (const car of state.cars) {
    car.z += car.speed * dt;
    if (car.z < player.z - 30 || car.z > player.z + 220) continue;
    keep.push(car);
    for (const rider of state.riders) {
      if (!rider.mounted || rider.wrecked || rider.finished) continue;
      const dz = Math.abs(car.z - rider.z);
      const dx = Math.abs(car.x - rider.x);
      if (dz < 3.2 && dx < 0.4) {
        if (rider.id === 0) state.stats.alert += 1;
        crashRider(state, rider, "car");
      } else if (rider.id === 0 && dz < 4.2 && dx < 0.72 && dx > 0.4 && state.stats.nearMissCd <= 0) {
        state.stats.nearMiss += 1;
        state.stats.nearMissCd = 0.35;
        state.fx.flash = Math.max(state.fx.flash, 0.22);
        pushEvent(state, { type: "nearMiss" });
      }
    }
  }
  state.cars = keep;
}

function stepCops(state, dt) {
  if (!state.spec.cops) return;
  const player = playerOf(state);
  if (state.mode === "league" && state.stats.alert >= 3 && !state.riders.some((r) => r.kind === "cop")) {
    state.riders.push(
      makeRider({
        id: state.riders.length,
        kind: "cop",
        personality: "cop",
        x: player.x,
        z: player.z - 22,
        bike: bikeById(Math.min(3, state.spec.tier + 1)),
        color: COLORS[6],
        targetSpeed: player.bike.maxSpeed * 1.06,
      }),
    );
    pushEvent(state, { type: "copSpawn" });
  }
  const cop = state.riders.find((r) => r.kind === "cop" && !r.wrecked);
  if (!cop || isTerminal(state)) return;
  if (player.mounted && Math.abs(cop.z - player.z) < 5 && Math.abs(cop.x - player.x) < 0.38) {
    state.stats.bust += dt;
    state.stats.maxBust = Math.max(state.stats.maxBust, state.stats.bust);
    if (state.stats.bust >= BUST_LIMIT) finishRace(state, false, "busted");
  } else {
    state.stats.bust = Math.max(0, state.stats.bust - dt * 0.45);
  }
}

function roadsideHit(state) {
  const player = playerOf(state);
  if (!player.mounted) return;
  const period = 380;
  const cowZ = Math.round(player.z / period) * period + 90;
  if (Math.abs(player.z - cowZ) < 2.2 && Math.abs(Math.abs(player.x) - 1.7) < 0.22 && Math.abs(player.x) > 1.48) {
    crashRider(state, player, "cow");
  }
}

export function applyIntent(state, intent) {
  if (!state || !intent || typeof intent !== "object") return { state, action: null, events: [] };
  if (isTerminal(state) && intent.type !== "resume" && intent.type !== "pause") {
    return { state, action: null, events: [] };
  }
  const start = state.events.length;
  let action = null;
  const type = intent.type;
  if (type === "set-input") {
    if (typeof intent.accel === "boolean") state.input.accel = intent.accel;
    if (typeof intent.brake === "boolean") state.input.brake = intent.brake;
    if (intent.steer === -1 || intent.steer === 0 || intent.steer === 1) state.input.steer = intent.steer;
    if (typeof intent.cruise === "boolean") state.input.cruise = intent.cruise;
    action = "set-input";
  } else if (type === "punch") {
    action = resolveMove(state, playerOf(state), "punch") ? "punch" : null;
  } else if (type === "kick") {
    action = resolveMove(state, playerOf(state), "kick") ? "kick" : null;
  } else if (type === "pause") {
    if (!isTerminal(state)) {
      state.paused = true;
      action = "pause";
    }
  } else if (type === "resume") {
    if (!isTerminal(state) && state.paused) {
      state.paused = false;
      action = "resume";
    }
  } else if (type === "toggle-pause") {
    if (!isTerminal(state)) {
      state.paused = !state.paused;
      action = state.paused ? "pause" : "resume";
    }
  }
  return { state, action, events: state.events.slice(start) };
}

export function stepFrame(state, dt = 1 / 60) {
  if (!state) return { state, action: null, events: [] };
  const step = Math.max(0, Math.min(0.05, Number(dt) || 0));
  if (step === 0 || isTerminal(state) || state.paused) {
    return { state, action: isTerminal(state) || state.paused ? null : "step", events: [] };
  }
  const start = state.events.length;
  if (state.hitStop > 0) {
    state.hitStop = Math.max(0, state.hitStop - step);
    state.fx.shake = Math.max(0, state.fx.shake - step * 2);
    return { state, action: "hitStop", events: state.events.slice(start) };
  }
  if (state.status === STATUS.countdown) {
    state.countdown -= step;
    stepPlayer(state, step);
    stepAI(state, step);
    if (state.countdown <= 0) {
      state.status = STATUS.racing;
      state.countdown = 0;
      pushEvent(state, { type: "go" });
    }
    state.fx.shake = Math.max(0, state.fx.shake - step * 2.4);
    state.fx.flash = Math.max(0, state.fx.flash - step * 3);
    return { state, action: "countdown", events: state.events.slice(start) };
  }

  state.time += step;
  state.stats.nearMissCd = Math.max(0, (state.stats.nearMissCd || 0) - step);
  stepPlayer(state, step);
  stepAI(state, step);
  spawnTraffic(state, step);
  stepCars(state, step);
  enforceGaps(state);
  roadsideHit(state);
  stepCops(state, step);
  maybeFinishPlayer(state);

  for (const rider of state.riders) {
    if (!rider.finished && !rider.wrecked && rider.mounted && rider.z >= state.spec.length && rider.id !== 0) {
      rider.finished = true;
      rider.finishPlace = computePlace(state, rider);
      rider.finishTime = state.time;
    }
  }

  state.fx.shake = Math.max(0, state.fx.shake - step * 2.4);
  state.fx.flash = Math.max(0, state.fx.flash - step * 3);
  state.fx.slow = Math.max(0, state.fx.slow - step);
  return { state, action: "step", events: state.events.slice(start) };
}

export function summarize(state) {
  if (state.result) return { ...state.result };
  const player = playerOf(state);
  const payload = {
    mode: state.mode,
    raceId: state.raceId,
    won: state.status === STATUS.won,
    reason: state.status,
    place: computePlace(state, player),
    qualify: state.spec.qualify,
    knockouts: state.stats.knockouts,
    crashes: state.stats.crashes,
    quota: state.spec.quota,
    farthestFly: state.stats.farthestFly,
    maxBust: state.stats.maxBust,
    tier: state.spec.tier,
    time: state.time,
  };
  payload.stars = starsForResult(payload);
  payload.cash = raceCash(payload);
  return payload;
}

export { BIKES };
