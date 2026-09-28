// Deterministic PRNG (mulberry32) with a serializable cursor so the whole
// simulation state stays plain data and can be replayed / asserted in tests.

export function nextRandom(state) {
  let t = (state.rngState + 0x6d2b79f5) >>> 0;
  state.rngState = t;
  let x = t;
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
}

export function randInt(state, min, max) {
  return min + Math.floor(nextRandom(state) * (max - min + 1));
}

export function randRange(state, min, max) {
  return min + nextRandom(state) * (max - min);
}

export function pick(state, list) {
  if (!list.length) return undefined;
  return list[Math.floor(nextRandom(state) * list.length) % list.length];
}

export function seedFrom(text) {
  let h = 2166136261 >>> 0;
  const s = String(text);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
