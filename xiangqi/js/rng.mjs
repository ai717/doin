// 全站唯一随机源：种子化确定性 PRNG（mulberry32）。
// 象棋本身零随机，随机只出现在 AI 失误注入与并列取一处。
// 铁律：engine / solver / ai 内部严禁出现 Math.random。
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randBetween(rng, [min, max]) {
  if (max < min) return min;
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick(rng, items) {
  if (!items || items.length === 0) return null;
  return items[randBetween(rng, [0, items.length - 1])];
}

export function shuffle(rng, items) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randBetween(rng, [0, i]);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
