// solver.mjs —— 可解性求解器（ hypertrophy 守护者）：只用「玩家可见信息」推演，绝不偷看 target
//
// 做法：维护一个「可能世界集合」world = (目标当前位置, 谎灯发生在第几投)，
// 每一步挑一个让最坏情况下世界集合缩得最快的投掷点（单步 minimax 贪心），
// 然后按真实回波过滤、再按暗流上限展开。
// 测试用它跑通每一关的最难配置，证明「预算内必胜」——这是无死局的机器证据。

import { DIR, TEMP, hotRadius, warmRadius, temperatureOf, isLegalGuess, submitGuess, remainingOf } from "./engine.mjs";

function tempOf(dist, run) {
  return run.blind ? null : temperatureOf(dist, run.range, run.level.temperaturePrecision);
}

/** 在某个世界里投 g 会被披露成什么（完全按 engine 的规则推导） */
function predict(run, g, pos, slot, turn) {
  const dist = pos - g;
  const hit = dist === 0;
  const silent = !hit && run.fog.some((s) => g >= s.lo && g <= s.hi);
  const temp = tempOf(dist, run);
  const truth = dist > 0 ? DIR.HIGHER : DIR.LOWER;
  const liar = run.liars > 0 && turn === slot && !hit && !silent;
  const dir = hit ? DIR.HIT : silent ? null : liar ? (truth === DIR.HIGHER ? DIR.LOWER : DIR.HIGHER) : truth;
  return { hit, silent, temp, dir };
}

function bucketOf(report) {
  if (report.hit) return "hit";
  return `${report.dir ?? "silent"}|${report.temp ?? "-"}`;
}

export function createWorlds(run) {
  const stride = run.budget + 1;
  const slots = run.liars > 0 ? Array.from({ length: run.budget - 1 }, (_, i) => i + 2) : [0];
  const worlds = new Set();
  for (let pos = run.min; pos <= run.max; pos += 1) {
    for (const slot of slots) worlds.add((pos - run.min) * stride + slot);
  }
  return worlds;
}

function decode(key, run) {
  const stride = run.budget + 1;
  return { pos: run.min + Math.floor(key / stride), slot: key % stride };
}

function candidatePositions(run, worlds) {
  const seen = new Set();
  for (const key of worlds) seen.add(decode(key, run).pos);
  const list = [...seen].sort((a, b) => a - b);
  if (list.length <= 48) return list;
  const out = [];
  const take = 32;
  for (let i = 0; i < take; i += 1) out.push(list[Math.floor((i * list.length) / take)]);
  out.push(list[list.length - 1]);
  return [...new Set(out)];
}

/**
 * 可能位置全都投过了（暗流把目标挪到了旧浮标上）时，向外找最近的合法投掷点。
 * 绝不退化成「从 1 开始枚举」——那会在最后一击时白白烧光鱼雷。
 */
function nearestLegal(run, list) {
  const extra = new Set();
  for (const p of list) {
    for (let d = 1; d <= run.range; d += 1) {
      const a = p - d;
      const b = p + d;
      if (a >= run.min && isLegalGuess(run, a)) {
        extra.add(a);
        break;
      }
      if (b <= run.max && isLegalGuess(run, b)) {
        extra.add(b);
        break;
      }
    }
    if (extra.size >= 12) break;
  }
  return [...extra];
}

/** 单步 minimax：选最坏桶最小的投掷点 */
export function pickGuess(run, worlds) {
  const turn = run.log.length + 1;
  const raw = candidatePositions(run, worlds);
  let pool = raw.filter((v) => isLegalGuess(run, v));
  if (!pool.length) pool = nearestLegal(run, raw);
  if (!pool.length) {
    for (let v = run.min; v <= run.max; v += 1) if (isLegalGuess(run, v)) return v;
    return null;
  }
  let best = pool[0];
  let bestScore = Infinity;
  const mid = (run.min + run.max) / 2;
  for (const g of pool) {
    const counts = new Map();
    for (const key of worlds) {
      const { pos, slot } = decode(key, run);
      const b = bucketOf(predict(run, g, pos, slot, turn));
      if (b === "hit") continue;
      counts.set(b, (counts.get(b) ?? 0) + 1);
    }
    let worst = 0;
    for (const n of counts.values()) if (n > worst) worst = n;
    if (worst < bestScore || (worst === bestScore && Math.abs(g - mid) < Math.abs(best - mid))) {
      bestScore = worst;
      best = g;
    }
  }
  return best;
}

/** 用真实回波过滤世界集合；随后按暗流 ±drift 展开（保守：取所有可能位移） */
export function filterWorlds(run, worlds, entry) {
  const stride = run.budget + 1;
  const turn = entry.turn;
  const observed = bucketOf({ hit: entry.hit === true, silent: entry.silent === true, temp: entry.temp ?? null, dir: entry.dir ?? null });
  const next = new Set();
  const free = (v) => !run.guessed.has(v); // 不变量：target 永远不会落在已投过的刻度上
  for (const key of worlds) {
    const { pos, slot } = decode(key, run);
    if (entry.kind !== "guess") {
      // 求解器自己不用道具，这里只可能是普通投掷
      if (free(pos)) next.add(key);
      continue;
    }
    const report = predict(run, entry.value, pos, slot, turn);
    if (bucketOf(report) !== observed) continue;
    if (!free(pos)) continue;
    if (run.drift > 0 && turn <= run.driftTurns) {
      for (let d = -run.drift; d <= run.drift; d += 1) {
        if (d === 0) continue;
        const moved = Math.min(run.max, Math.max(run.min, pos + d));
        if (moved === pos || !free(moved)) continue;
        next.add((moved - run.min) * stride + slot);
      }
      // 暗流也可能被边界或旧浮标挡住而原地不动
      next.add(key);
    } else {
      next.add(key);
    }
  }
  return next;
}

/**
 * 在真实 run 上自动通关。返回 { hit, steps, used }。
 * 只读取公开信息（log / fog / 配置），不读 run.target。
 */
export function solve(run, { maxSteps = 64 } = {}) {
  let worlds = createWorlds(run);
  let steps = 0;
  while (run.status === "playing" && steps < maxSteps && remainingOf(run) > 0) {
    const g = pickGuess(run, worlds);
    if (g === null) break;
    const entry = submitGuess(run, g);
    if (!entry) break;
    steps += 1;
    if (entry.hit) return { hit: true, steps, used: run.used };
    worlds = filterWorlds(run, worlds, entry);
    if (!worlds.size) return { hit: false, steps, used: run.used };
  }
  return { hit: run.status === "won", steps, used: run.used };
}
