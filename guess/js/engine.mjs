// engine.mjs —— 规则唯一权威：纯函数式状态推进，DOM-free（不碰 document / window / localStorage）
//
// 心智模型：系统先定一个数字，玩家每投一次浮标拿到一条回波（大 / 小 + 温度）。
// 三种噪声全部「有界且可推理」，绝不制造死局：
//   暗流 drift    —— 前 driftTurns 投之后，目标漂移 ±drift（UI 会把包围圈同步放宽）
//   谎灯 liar     —— 整局恰有一次方向回波被倒置，但温度恒为真（交叉验证的入口）
//   浊流 fog      —— 雾区内的投掷方向静默，位置开局即明示（是路线约束，不是暗坑）

import { randInt } from "./rng.mjs";
import { FOG_MIN_WIDTH, parOf } from "./levels.mjs";

export const DIR = { HIGHER: "higher", LOWER: "lower", HIT: "hit" };
export const TEMP = { HOT: "hot", WARM: "warm", COLD: "cold" };
export const STATUS = { PLAYING: "playing", WON: "won", LOST: "lost" };
export const TOOL = { PROBE: "probe", SCAN: "scan", RECALL: "recall" };

export const TOOL_COST = { probe: 1, scan: 2, recall: 0 };

export function clampInt(value, min, max, fallback = min) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** 温度半径随猎场宽度缩放；precision 越低，温度回波越保守、越不精确。 */
export function hotRadius(range, precision = 1) {
  const scale = Number.isFinite(precision) && precision > 0 ? precision : 1;
  return clampInt(Math.round(clampInt(Math.round(range * 0.02), 3, 12) / scale), 3, 12);
}
export function warmRadius(range, precision = 1) {
  const scale = Number.isFinite(precision) && precision > 0 ? precision : 1;
  return clampInt(Math.round(clampInt(Math.round(range * 0.08), 12, 48) / scale), 12, 48);
}
export function temperatureOf(distance, range, precision = 1) {
  const d = Math.abs(distance);
  if (d <= hotRadius(range, precision)) return TEMP.HOT;
  if (d <= warmRadius(range, precision)) return TEMP.WARM;
  return TEMP.COLD;
}

function flipDir(dir) {
  return dir === DIR.HIGHER ? DIR.LOWER : DIR.HIGHER;
}

/** 雾区：宽度固定、位置随机、互不重叠，开局即在声呐带上明示 */
function buildFog(level, rng) {
  const segs = level.fogSegs | 0;
  if (segs <= 0) return [];
  const width = Math.max(FOG_MIN_WIDTH, Math.round(level.range * level.fogPct));
  const out = [];
  for (let i = 0; i < segs; i += 1) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const lo = randInt(rng, level.min, level.max - width + 1);
      const hi = lo + width - 1;
      const clash = out.some((s) => hi >= s.lo - Math.ceil(width / 2) && lo <= s.hi + Math.ceil(width / 2));
      if (!clash) {
        out.push({ lo, hi });
        break;
      }
    }
  }
  return out.sort((a, b) => a.lo - b.lo);
}

export function createRun(level, rng) {
  const target = randInt(rng, level.min, level.max);
  const lieTurn = level.liars > 0 ? randInt(rng, 2, Math.max(2, level.budget)) : -1;
  return {
    level,
    min: level.min,
    max: level.max,
    range: level.range,
    budget: level.budget,
    blind: level.blind === true,
    drift: level.drift | 0,
    driftTurns: level.driftTurns | 0,
    liars: level.liars | 0,
    fog: buildFog(level, rng),
    target,
    lieTurn,
    log: [],
    drifts: [],
    guessed: new Set(),
    used: 0,
    status: STATUS.PLAYING,
    tools: { probe: level.tools?.probe ?? 0, scan: level.tools?.scan ?? 0, recall: level.tools?.recall ?? 1 },
    rng,
  };
}

export function inFog(run, value) {
  return run.fog.some((s) => value >= s.lo && value <= s.hi);
}

export function isLegalGuess(run, value) {
  if (!run || run.status !== STATUS.PLAYING) return false;
  const n = Number(value);
  if (!Number.isInteger(n)) return false;
  if (n < run.min || n > run.max) return false;
  return !run.guessed.has(n);
}

export function remainingOf(run) {
  return Math.max(0, run.budget - run.used);
}

/**
 * 暗流：目标位移 ±drift（绝不停在原地），并记下位移量供回溯还原。
 * 硬约束：猎物只会游向「还没投过浮标的刻度」——
 *   否则它会漂到一枚旧浮标上，而旧刻度不允许重复投掷，玩家就永远打不中了（真死局）。
 *   由此得到不变量：任意时刻 target ∉ guessed。
 */
function applyDrift(run, turn) {
  if (run.drift <= 0 || turn > run.driftTurns) return;
  const options = [];
  for (let d = 1; d <= run.drift; d += 1) {
    for (const sign of [-1, 1]) {
      const next = clampInt(run.target + sign * d, run.min, run.max);
      if (next !== run.target && !run.guessed.has(next)) options.push({ next, delta: next - run.target });
    }
  }
  if (!options.length) return;
  const pick = options[Math.floor(run.rng() * options.length) % options.length];
  run.target = pick.next;
  run.drifts.push({ turn, delta: pick.delta });
}

function settle(run) {
  if (run.status !== STATUS.PLAYING) return;
  if (run.used >= run.budget) run.status = STATUS.LOST;
}

/**
 * 投出一次猜测。返回值即本次回波；非法意图（越界 / 重复 / 终止态）返回 null，绝不抛错。
 */
export function submitGuess(run, value) {
  if (!isLegalGuess(run, value)) return null;
  const turn = run.log.length + 1;
  const dist = run.target - value;
  const hit = dist === 0;
  const silent = !hit && inFog(run, value);
  const temp = run.blind ? null : temperatureOf(dist, run.range, run.level.temperaturePrecision);
  const truth = dist > 0 ? DIR.HIGHER : DIR.LOWER;
  const liar = run.liars > 0 && turn === run.lieTurn && !hit && !silent;
  const dir = hit ? DIR.HIT : silent ? null : liar ? flipDir(truth) : truth;
  const entry = {
    turn,
    kind: "guess",
    value,
    dir,
    temp,
    silent,
    hit,
    liar,
    cost: 1,
    distance: Math.abs(dist),
  };
  run.log.push(entry);
  run.guessed.add(value);
  run.used += 1;
  if (hit) {
    run.status = STATUS.WON;
    return entry;
  }
  applyDrift(run, turn);
  settle(run);
  return entry;
}

function lastCostEntry(run) {
  for (let i = run.log.length - 1; i >= 0; i -= 1) {
    if (run.log[i].cost > 0) return run.log[i];
  }
  return null;
}

/** 声呐探针：回报目标奇偶（消耗 1 投）。扫描线：点亮包围圈的哪半边（消耗 2 投）。 */
export function useTool(run, kind) {
  if (!run || run.status !== STATUS.PLAYING) return null;
  if (kind !== TOOL.PROBE && kind !== TOOL.SCAN) return null;
  const cost = TOOL_COST[kind];
  if ((run.tools[kind] ?? 0) <= 0 || remainingOf(run) < cost) return null;
  const turn = run.log.length + 1;
  let entry;
  if (kind === TOOL.PROBE) {
    entry = { turn, kind: "probe", cost, parity: run.target % 2 === 0 ? "even" : "odd" };
  } else {
    const band = beliefOf(run);
    const mid = Math.floor((band.lo + band.hi) / 2);
    entry = {
      turn,
      kind: "scan",
      cost,
      lo: band.lo,
      hi: band.hi,
      mid,
      half: run.target <= mid ? "lower" : "upper",
    };
  }
  run.log.push(entry);
  run.used += cost;
  run.tools[kind] -= 1;
  // 暗流只在玩家投出猜测后触发；工具虽消耗机会，但不改变目标位置。
  settle(run);
  return entry;
}

/** 回溯：撤销上一次投掷及其回波，不消耗机会（每关限量），并还原当次的暗流位移 */
export function recall(run) {
  if (!run || run.status !== STATUS.PLAYING) return false;
  if ((run.tools.recall ?? 0) <= 0) return false;
  const entry = lastCostEntry(run);
  if (!entry) return false;
  run.log.pop();
  run.used = Math.max(0, run.used - entry.cost);
  if (entry.kind === "guess") run.guessed.delete(entry.value);
  if (entry.kind === "probe" || entry.kind === "scan") run.tools[entry.kind] += 1;
  const drift = run.drifts[run.drifts.length - 1];
  if (drift && drift.turn === entry.turn) {
    run.target -= drift.delta;
    run.drifts.pop();
  }
  run.tools.recall -= 1;
  run.status = STATUS.PLAYING;
  return true;
}

/**
 * 玩家侧包围圈：完全由「已披露的回波」推导，绝不偷看目标。
 * 有谎灯时若区间被压成空集，会自动试着丢掉其中一条方向约束重建（丢一次 = 认一次谎），
 * 取所有可重建区间的并集，保证结果一定是真值的超集。
 */
export function beliefOf(run) {
  const min = run.min;
  const max = run.max;
  const steps = run.log.filter((e) => e.cost > 0);
  const hit = steps.find((e) => e.kind === "guess" && e.hit);
  if (hit) return { lo: hit.value, hi: hit.value, width: 1, parity: null, conflict: false };
  const driftTotal = run.drift;

  function walk(skipIndex) {
    let lo = min;
    let hi = max;
    let parity = null;
    let parityTurn = -1;
    for (let i = 0; i < steps.length; i += 1) {
      const e = steps[i];
      const turn = e.turn;
      if (e.kind === "guess") {
        if (i !== skipIndex) {
          if (e.dir === DIR.HIGHER) lo = Math.max(lo, e.value + 1);
          else if (e.dir === DIR.LOWER) hi = Math.min(hi, e.value - 1);
        }
        if (!run.blind && e.temp) {
          const r = e.temp === TEMP.HOT ? hotRadius(run.range, run.level.temperaturePrecision) : e.temp === TEMP.WARM ? warmRadius(run.range, run.level.temperaturePrecision) : 0;
          if (r > 0) {
            lo = Math.max(lo, e.value - r);
            hi = Math.min(hi, e.value + r);
          }
        }
      } else if (e.kind === "scan") {
        const mid = Math.floor((lo + hi) / 2);
        if (e.half === "lower") hi = Math.min(hi, mid);
        else lo = Math.max(lo, mid + 1);
      } else if (e.kind === "probe") {
        parity = e.parity;
        parityTurn = turn;
      }
      // 暗流在本次投掷之后发生：此前定下的边界都要放宽 ±drift
      if (driftTotal > 0 && turn <= run.driftTurns) {
        lo = Math.max(min, lo - driftTotal);
        hi = Math.min(max, hi + driftTotal);
        if (parity && parityTurn <= turn) parity = null;
      }
    }
    return { lo, hi, parity };
  }

  const base = walk(-1);
  if (base.lo <= base.hi) {
    return { lo: base.lo, hi: base.hi, width: base.hi - base.lo + 1, parity: base.parity, conflict: false };
  }
  // 出现空集 = 回波自相矛盾（谎灯已现）。逐条丢弃方向约束重建，取并集。
  let lo = max;
  let hi = min;
  for (let i = 0; i < steps.length; i += 1) {
    if (steps[i].kind !== "guess" || !steps[i].dir) continue;
    const r = walk(i);
    if (r.lo > r.hi) continue;
    lo = Math.min(lo, r.lo);
    hi = Math.max(hi, r.hi);
  }
  if (lo > hi) return { lo: min, hi: max, width: run.range, parity: null, conflict: true };
  return { lo, hi, width: hi - lo + 1, parity: null, conflict: true };
}

/** 包围圈是否收紧到只剩一个候选（瓮中捉鳖） */
export function isCornered(run) {
  const b = beliefOf(run);
  return !b.conflict && b.width <= 1;
}

export function parFor(range) {
  return parOf(range);
}
