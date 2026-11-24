// Persistence: preferences + catalogue progress. All access is wrapped, never throws.
// Key: doin.soap.v1. Corrupt or partial data normalizes to defaults.

import { SOAP_IDS, TOOL_IDS } from "./soaps.mjs";

export const STORAGE_KEY = "doin.soap.v1";
export const SCHEMA_VERSION = 1;

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    prefs: { tool: "tool_knife", muted: false, lastSoap: SOAP_IDS[0] },
    progress: { completed: [], bestEvenness: {}, soapsCut: 0 },
  };
}

function createMemoryFallback() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

let backend;

function storage() {
  if (backend) return backend;
  try {
    if (typeof localStorage !== "undefined") {
      const probe = "__doin_soap__";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      backend = localStorage;
      return backend;
    }
  } catch (error) {
    // Restricted environment: fall through to memory.
  }
  backend = createMemoryFallback();
  return backend;
}

export function resetBackendForTests() {
  backend = undefined;
}

function pick(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function evenness(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const prefs = raw.prefs && typeof raw.prefs === "object" ? raw.prefs : {};
  const progress = raw.progress && typeof raw.progress === "object" ? raw.progress : {};
  const completed = Array.isArray(progress.completed)
    ? [...new Set(progress.completed.filter((id) => SOAP_IDS.includes(id)))]
    : [];
  const bestEvenness = {};
  if (progress.bestEvenness && typeof progress.bestEvenness === "object") {
    for (const id of SOAP_IDS) {
      if (progress.bestEvenness[id] !== undefined) bestEvenness[id] = evenness(progress.bestEvenness[id]);
    }
  }
  return {
    version: SCHEMA_VERSION,
    prefs: {
      tool: pick(prefs.tool, TOOL_IDS, base.prefs.tool),
      muted: Boolean(prefs.muted),
      lastSoap: pick(prefs.lastSoap, SOAP_IDS, base.prefs.lastSoap),
    },
    progress: {
      completed,
      bestEvenness,
      soapsCut: Number.isFinite(progress.soapsCut) ? Math.max(0, Math.trunc(progress.soapsCut)) : 0,
    },
  };
}

export function load() {
  try {
    const raw = storage().getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return normalize(JSON.parse(raw));
  } catch (error) {
    return defaultState();
  }
}

export function save(state) {
  try {
    storage().setItem(STORAGE_KEY, JSON.stringify(normalize(state)));
    return true;
  } catch (error) {
    return false;
  }
}

// Shared portal metadata (doin.meta.v1) is written through the same guarded backend.
export function recordMeta(payload) {
  try {
    const raw = storage().getItem("doin.meta.v1");
    const meta = raw ? JSON.parse(raw) : {};
    const safe = meta && typeof meta === "object" ? meta : {};
    const slug = String(payload?.slug ?? "");
    safe.recentlyPlayed = [slug, ...(Array.isArray(safe.recentlyPlayed) ? safe.recentlyPlayed.filter((s) => s !== slug) : [])].slice(0, 8);
    safe.totalStars = (Number.isFinite(safe.totalStars) ? safe.totalStars : 0) + Math.max(0, Math.trunc(payload?.stars ?? 0));
    storage().setItem("doin.meta.v1", JSON.stringify(safe));
    return true;
  } catch (error) {
    return false;
  }
}

// Record one finished soap. Pure: never mutates input.
export function recordFinish(state, soapId, evenValue) {
  const next = normalize(state);
  const id = pick(soapId, SOAP_IDS, next.prefs.lastSoap);
  const value = evenness(evenValue);
  const completed = [...new Set([...next.progress.completed, id])];
  const prevBest = next.progress.bestEvenness[id] ?? 0;
  return {
    state: {
      ...next,
      progress: {
        completed,
        bestEvenness: { ...next.progress.bestEvenness, [id]: Math.max(prevBest, value) },
        soapsCut: next.progress.soapsCut + 1,
      },
    },
    isBest: value > prevBest,
  };
}
