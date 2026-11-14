// 全站唯一随机源：种子化确定性 PRNG。
//
// 为什么必须集中：黑白棋本身零随机（标准四子开局），随机只出现在三个地方 ——
// ① AI 的失误注入与并列取一；② "随机前两手"开局；③ 翻转冲刺的公平中局生成。
// 三处全部走同一个 mulberry32 实例，才能保证"同一种子 = 同一局棋"，
// 也才能让单元测试在没有 Math.random 的前提下复现任何随机分支。
//
// 铁律：engine / solver / ai 内部严禁出现 Math.random。
// 采样顺序也是契约：mulberry32 是状态化 PRNG，抽几次、什么顺序都会影响后续序列，
// 因此同一实体的所有随机量必须集中一次抽完并写死顺序（顺序一变，存档重放就会漂移）。

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

// 概率抽样与取值统一走这一组原语，避免各处自己写 Math.floor(rng() * n)。
export function chance(rng, probability) {
  return rng() < probability;
}

// 闭区间随机整数。
export function randBetween(rng, [min, max]) {
  if (max < min) return min;
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick(rng, items) {
  if (!items || items.length === 0) return null;
  return items[randBetween(rng, [0, items.length - 1])];
}

// 返回新数组，不改动入参（Fisher-Yates）。
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
