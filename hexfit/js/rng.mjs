// rng.mjs —— 确定性 PRNG（mulberry32）：块队列、蜜流粒子、关卡生成全部可注入种子
export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] >>> 0;
  }
  return (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
}

export function randInt(rng, min, max) {
  if (max <= min) return min;
  return min + Math.floor(rng() * (max - min + 1));
}

export function hash32(x) {
  let h = x >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}
