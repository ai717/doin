// levels.mjs — 五条风景公路 + 三种模式的关卡表。DOM-free。

export const TRACKS = Object.freeze([
  Object.freeze({
    id: "coast",
    length: 1500,
    hillAmp: 16,
    hillFreq: 0.0026,
    curveAmp: 0.32,
    curveFreq: 0.0032,
    traffic: 0.42,
    cops: false,
    tight: false,
    oncoming: 0.28,
    palette: "coast",
  }),
  Object.freeze({
    id: "desert",
    length: 1700,
    hillAmp: 6,
    hillFreq: 0.0016,
    curveAmp: 0.16,
    curveFreq: 0.002,
    traffic: 0.88,
    cops: false,
    tight: false,
    oncoming: 0.55,
    palette: "desert",
  }),
  Object.freeze({
    id: "mountain",
    length: 1300,
    hillAmp: 22,
    hillFreq: 0.0048,
    curveAmp: 0.78,
    curveFreq: 0.0058,
    traffic: 0.48,
    cops: false,
    tight: true,
    oncoming: 0.18,
    palette: "mountain",
  }),
  Object.freeze({
    id: "city",
    length: 1450,
    hillAmp: 8,
    hillFreq: 0.0022,
    curveAmp: 0.4,
    curveFreq: 0.0042,
    traffic: 1.05,
    cops: true,
    tight: false,
    oncoming: 0.4,
    palette: "city",
  }),
  Object.freeze({
    id: "canyon",
    length: 1600,
    hillAmp: 34,
    hillFreq: 0.0035,
    curveAmp: 0.5,
    curveFreq: 0.003,
    traffic: 0.72,
    cops: true,
    tight: false,
    oncoming: 0.42,
    palette: "canyon",
  }),
]);

export const TIERS = Object.freeze([
  Object.freeze({ id: "rats", qualify: 4, aggression: 0.28, trafficMul: 0.7, aiSpeed: 0.8 }),
  Object.freeze({ id: "street", qualify: 3, aggression: 0.55, trafficMul: 1.0, aiSpeed: 0.88 }),
  Object.freeze({ id: "gang", qualify: 3, aggression: 0.82, trafficMul: 1.18, aiSpeed: 0.95 }),
  Object.freeze({ id: "sunset", qualify: 1, aggression: 1.0, trafficMul: 1.32, aiSpeed: 1.02 }),
]);

export const BIKES = Object.freeze([
  Object.freeze({ id: 0, key: "rat", maxSpeed: 28, accel: 12, brake: 18, handling: 2.55, armor: 5, cost: 0 }),
  Object.freeze({ id: 1, key: "street", maxSpeed: 34, accel: 14, brake: 20, handling: 2.2, armor: 4, cost: 800 }),
  Object.freeze({ id: 2, key: "sport", maxSpeed: 40, accel: 16, brake: 22, handling: 1.9, armor: 3, cost: 2200 }),
  Object.freeze({ id: 3, key: "sunset", maxSpeed: 46, accel: 18, brake: 24, handling: 1.55, armor: 2, cost: 5000 }),
]);

export const LEAGUE_COUNT = 20;
export const BRAWL_COUNT = 8;
export const GETAWAY_COUNT = 5;
export const TRACK_COUNT = TRACKS.length;
export const TIER_COUNT = TIERS.length;
export const BIKE_COUNT = BIKES.length;

export const BRAWL_QUOTA = Object.freeze([4, 4, 5, 5, 6, 6, 7, 8]);

export function bikeById(id) {
  const n = Math.trunc(Number(id) || 0);
  return BIKES[n] ?? BIKES[0];
}

export function trackByIndex(i) {
  const n = ((Math.trunc(Number(i) || 0) % TRACKS.length) + TRACKS.length) % TRACKS.length;
  return TRACKS[n];
}

export function leagueSpec(raceId) {
  const id = Math.max(0, Math.min(LEAGUE_COUNT - 1, Math.trunc(Number(raceId) || 0)));
  const tier = Math.floor(id / TRACK_COUNT);
  const trackIndex = id % TRACK_COUNT;
  const track = TRACKS[trackIndex];
  const t = TIERS[tier];
  return {
    mode: "league",
    raceId: id,
    tier,
    trackIndex,
    track,
    qualify: t.qualify,
    aggression: t.aggression,
    trafficMul: t.trafficMul,
    aiSpeed: t.aiSpeed,
    length: track.length,
    cops: track.cops && tier >= 2,
    quota: 0,
    seedKey: `league:${id}`,
  };
}

export function brawlSpec(raceId) {
  const id = Math.max(0, Math.min(BRAWL_COUNT - 1, Math.trunc(Number(raceId) || 0)));
  const trackIndex = id % TRACK_COUNT;
  const track = TRACKS[trackIndex];
  const quota = BRAWL_QUOTA[id];
  return {
    mode: "brawl",
    raceId: id,
    tier: Math.min(3, Math.floor(id / 2)),
    trackIndex,
    track,
    qualify: 7,
    aggression: 0.7 + id * 0.04,
    trafficMul: 0.55,
    aiSpeed: 0.78 + id * 0.02,
    length: Math.round(track.length * 0.68),
    cops: false,
    quota,
    seedKey: `brawl:${id}`,
  };
}

export function getawaySpec(raceId) {
  const id = Math.max(0, Math.min(GETAWAY_COUNT - 1, Math.trunc(Number(raceId) || 0)));
  const track = TRACKS[id];
  return {
    mode: "getaway",
    raceId: id,
    tier: Math.min(3, id),
    trackIndex: id,
    track,
    qualify: 1,
    aggression: 0.35,
    trafficMul: 0.9 + id * 0.08,
    aiSpeed: 1.05,
    length: Math.round(track.length * 0.82),
    cops: true,
    quota: 0,
    seedKey: `getaway:${id}`,
  };
}

export function raceSpec(mode, raceId) {
  if (mode === "brawl") return brawlSpec(raceId);
  if (mode === "getaway") return getawaySpec(raceId);
  return leagueSpec(raceId);
}

export function leagueIndex(tier, trackIndex) {
  return Math.trunc(tier) * TRACK_COUNT + Math.trunc(trackIndex);
}

export function nextLeagueId(raceId) {
  const id = Math.trunc(Number(raceId) || 0) + 1;
  return id < LEAGUE_COUNT ? id : null;
}

export function nextBrawlId(raceId) {
  const id = Math.trunc(Number(raceId) || 0) + 1;
  return id < BRAWL_COUNT ? id : null;
}

export function nextGetawayId(raceId) {
  const id = Math.trunc(Number(raceId) || 0) + 1;
  return id < GETAWAY_COUNT ? id : null;
}
