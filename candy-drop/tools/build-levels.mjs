// tools/build-levels.mjs — 关卡生成器：设计稿 → 真实弹道吸附 → js/levels.mjs
//
// 为什么需要它：物理解谜关卡的"嘴"和"三星"位置不可能靠心算摆准。
// 本工具对每关做三件事：
//   1. 以"离设计目标点最近"为目标，坐标上升法调参解法时间（割绳/点破/吹风/滑块）；
//   2. 把糯糯的嘴吸附到弹道上真正的最近点，保证"存在一条进嘴路径"；
//   3. 沿同一条弹道按弧长均匀取三颗星，保证三星可在同一次通关中拿满。
// 最后重放一次，断言 won && stars === 3，否则该关判 FAIL 需要改几何。
//
// 用法：node games/candy-drop/tools/build-levels.mjs [--write]

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DESIGN, BOXES } from "./design.mjs";
import { createState, stepFrame, applyIntent, FIXED_DT, WORLD, CANDY_R, STAR_R, closestOnSegment } from "../js/engine.mjs";

const MAX_SIM = 13;
const FAR = [-9999, -9999];

function ropeList(design) {
  const ropes = (design.ropes ?? []).map((r) => ({ ...r }));
  for (const r of design.autoRopes ?? []) {
    ropes.push({ a: r.a, len: r.len, elastic: r.elastic, auto: { at: r.at, grow: 0.45 } });
  }
  return ropes;
}

function probeLevel(design) {
  return {
    candy: design.candy,
    ropes: ropeList(design),
    stars: [],
    bubbles: (design.bubbles ?? []).map((b) => ({ at: b.at, r: b.r ?? 44 })),
    cushions: design.cushions ?? [],
    spikes: design.spikes ?? [],
    walls: design.walls ?? [],
    monster: { at: FAR, r: 1 },
  };
}

function mouthAt(design, t, phaseOverride) {
  const m = design.mouth;
  if (!m.move) return { x: m.near[0], y: m.near[1] };
  const to = m.move.to;
  const period = m.move.period ?? 4;
  const phase = phaseOverride ?? m.move.phase ?? 0;
  const k = 0.5 - 0.5 * Math.cos((t / period + phase) * Math.PI * 2);
  return { x: m.near[0] + (to[0] - m.near[0]) * k, y: m.near[1] + (to[1] - m.near[1]) * k };
}

function clonePlan(plan) {
  return plan.map((a) => ({ ...a }));
}

/** 按计划重放一关，返回 { state, traj, minDist, minIndex, best } */
function replay(level, design, plan, record = true, phase = null) {
  const state = createState(level);
  const actions = clonePlan(plan).sort((a, b) => a.t - b.t);
  let next = 0;
  const traj = [];
  let minDist = Infinity;
  let minIndex = 0;
  const steps = Math.round(MAX_SIM / FIXED_DT);
  const sampleEvery = 2;
  for (let i = 0; i < steps; i += 1) {
    while (next < actions.length && state.t >= actions[next].t) {
      const a = actions[next];
      if (a.cut) applyIntent(state, { type: "cutRopes", indices: a.cut });
      else if (a.pop) applyIntent(state, { type: "popBubble" });
      else if (a.puff !== undefined) applyIntent(state, { type: "puff", index: a.puff });
      else if (a.slide) applyIntent(state, { type: "slide", index: a.slide[0], t: a.slide[1] });
      next += 1;
    }
    stepFrame(state, FIXED_DT);
    const target = mouthAt(design, state.t, phase);
    const d = Math.hypot(state.candy.x - target.x, state.candy.y - target.y);
    if (d < minDist) {
      minDist = d;
      minIndex = traj.length;
    }
    if (record && i % sampleEvery === 0) {
      traj.push({ t: state.t, x: state.candy.x, y: state.candy.y });
    }
    if (state.status !== "playing") break;
  }
  return { state, traj, minDist, minIndex };
}

// 命中距离必须压倒"省时间"：否则调参器会选一条"够不太着但很快"的烂路线
function score(run) {
  let s = -run.minDist * 3;
  if (run.state.status === "lost") s -= 500;
  if (run.state.status === "won") s += 1000;
  s -= run.state.t * 20;
  if (run.minDist < 40) s += 3000; // 干净命中给一大笔，确保它胜出
  return s;
}

/** 坐标上升法：逐个动作微调时间/滑块值；会走动的嘴额外微调相位 */
function tune(level, design, plan) {
  let best = clonePlan(plan);
  let bestPhase = design.mouth?.move?.phase ?? 0;
  let bestRun = replay(level, design, best, false, bestPhase);
  let bestScore = score(bestRun);
  const windows = [2, 0.8, 0.3, 0.1];
  const tryPhase = (p) => {
    const run = replay(level, design, best, false, p);
    const sc = score(run);
    if (sc > bestScore + 1e-6) {
      bestScore = sc;
      bestPhase = p;
      return true;
    }
    return false;
  };
  for (const w of windows) {
    let improved = true;
    let guard = 0;
    while (improved && guard < 3) {
      improved = false;
      guard += 1;
      if (design.mouth?.move) {
        for (const p of grid(bestPhase, w * 0.3, 0, 0.999, 10)) if (tryPhase(p)) improved = true;
      }
      for (let i = 0; i < best.length; i += 1) {
        const action = best[i];
        if (action.slide) {
          for (const v of grid(action.slide[1], w * 0.6, 0, 1, 14)) {
            const trial = clonePlan(best);
            trial[i].slide = [action.slide[0], v];
            const run = replay(level, design, trial, false, bestPhase);
            const sc = score(run);
            if (sc > bestScore + 1e-6) {
              bestScore = sc;
              best = trial;
              improved = true;
            }
          }
          continue;
        }
        if (action.t === 0 && !action.cut && !action.pop && action.puff === undefined) continue;
        for (const t of grid(action.t, w, 0.05, MAX_SIM - 0.5, 16)) {
          const trial = clonePlan(best);
          trial[i].t = t;
          const run = replay(level, design, trial, false, bestPhase);
          const sc = score(run);
          if (sc > bestScore + 1e-6) {
            bestScore = sc;
            best = trial;
            improved = true;
          }
        }
      }
    }
  }
  return { plan: best, phase: bestPhase, run: replay(level, design, best, true, bestPhase), score: bestScore };
}

function grid(center, half, min, max, n) {
  const out = [];
  for (let i = -n; i <= n; i += 1) {
    const v = center + (i / n) * half;
    if (v >= min && v <= max) out.push(Math.round(v * 1000) / 1000);
  }
  return [...new Set(out)];
}

function arcLengths(traj, upTo) {
  const acc = [0];
  for (let i = 1; i <= upTo && i < traj.length; i += 1) {
    acc.push(acc[i - 1] + Math.hypot(traj[i].x - traj[i - 1].x, traj[i].y - traj[i - 1].y));
  }
  return acc;
}

function hazardDistance(level, x, y) {
  let best = Infinity;
  for (const s of level.spikes ?? []) {
    const p = closestOnSegment(x, y, s.from[0], s.from[1], s.to[0], s.to[1]);
    best = Math.min(best, Math.hypot(x - p.x, y - p.y));
  }
  for (const w of level.walls ?? []) {
    const p = closestOnSegment(x, y, w.from[0], w.from[1], w.to[0], w.to[1]);
    best = Math.min(best, Math.hypot(x - p.x, y - p.y));
  }
  return best;
}

// 松弛档位：竖直往返类弹道上，"离起点/离嘴/彼此间距"三条约束会互相挤死，需要逐级放松
const RELAX = [
  { sep: 78, start: 46, mouth: 20, hazard: 16 },
  { sep: 66, start: 36, mouth: 12, hazard: 12 },
  { sep: 56, start: 28, mouth: 6, hazard: 10 },
];

function pickStars(level, traj, upTo, mouth, mouthR, fracs, debug = false, relax = 0) {
  const R = RELAX[relax] ?? RELAX[0];
  const acc = arcLengths(traj, upTo);
  const total = acc[acc.length - 1] || 1;
  const chosen = [];
  for (const f of fracs) {
    const targetLen = total * f;
    let idx = acc.findIndex((v) => v >= targetLen);
    if (idx < 0) idx = upTo;
    // 沿弹道上下搜索一个合法位置：不压刺/板/嘴、不贴边、彼此不重叠
    let placed = null;
    for (let off = 0; off < upTo && !placed; off += 1) {
      for (const cand of [idx + off, idx - off]) {
        if (cand < 1 || cand > upTo) continue;
        const p = traj[cand];
        if (p.x < 52 || p.x > WORLD.w - 52 || p.y < 58 || p.y > WORLD.h - 46) continue;
        if (Math.hypot(p.x - mouth.x, p.y - mouth.y) < mouthR + R.mouth) continue;
        if (hazardDistance(level, p.x, p.y) < STAR_R + R.hazard) continue;
        if (chosen.some((c) => Math.hypot(c[0] - p.x, c[1] - p.y) < R.sep)) continue;
        if (Math.hypot(p.x - level.candy[0], p.y - level.candy[1]) < R.start) continue;
        placed = [Math.round(p.x), Math.round(p.y)];
        break;
      }
    }
    if (placed) chosen.push(placed);
    else if (debug) {
      const p = traj[idx];
      console.log(
        `   [星失败] f=${f} idx=${idx} 点=(${p?.x.toFixed(0)},${p?.y.toFixed(0)}) 弧=${(acc[idx] ?? 0).toFixed(0)}/${total.toFixed(0)} 离嘴=${Math.hypot(p.x - mouth.x, p.y - mouth.y).toFixed(0)}`
      );
    }
  }
  return chosen;
}

const SAFE = { x0: 70, x1: WORLD.w - 70, y0: 78, y1: WORLD.h - 70 };

/** 弹道上第一次真正"进嘴"的采样点（嘴半径内），星星必须排在它之前 */
function arrivalIndex(traj, mouth, mouthR, design, phase) {
  for (let i = 0; i < traj.length; i += 1) {
    const m = design.mouth?.move ? mouthAt(design, traj[i].t, phase) : mouth;
    if (Math.hypot(traj[i].x - m.x, traj[i].y - m.y) < mouthR - 2) return i;
  }
  return -1;
}

/**
 * 目标不可达时的兜底：从真实弹道里挑一个"适合放嘴"的落点。
 * 偏好：飞行后段、靠近盒底、远离糖果起点、周围没有刺与板。
 */
function suggestTarget(traj, design, level) {
  const mouthR = design.mouth.r ?? 36;
  let best = null;
  let bestScore = -Infinity;
  const start = design.candy;
  const acc = arcLengths(traj, traj.length - 1);
  for (let i = 6; i < traj.length; i += 1) {
    const p = traj[i];
    if (p.x < 90 || p.x > WORLD.w - 90 || p.y < 120 || p.y > WORLD.h - 90) continue;
    if (Math.hypot(p.x - start[0], p.y - start[1]) < 110) continue;
    if (p.t < 0.45 || acc[i] < 300) continue; // 弹道太短塞不下三星
    const hz = hazardDistance(level, p.x, p.y);
    if (hz < mouthR + 16) continue;
    const frac = i / traj.length;
    let s = 0;
    s += frac * 220; // 越靠后越好（让关卡有过程）
    s -= Math.abs(p.y - 470) * 0.35; // 偏好盒底一带（小兽坐着的地方）
    s += Math.min(hz, 120) * 0.5; // 周围越干净越好
    s -= Math.abs(p.x - WORLD.w / 2) * 0.05;
    if (s > bestScore) {
      bestScore = s;
      best = p;
    }
  }
  return best;
}

function build(design) {
  const probe = probeLevel(design);
  let tuned = tune(probe, design, design.plan);
  let retargeted = false;
  // 目标不可达时，按真实弹道重选嘴的位置，再调一次参（至多两轮）
  for (let round = 0; round < 2; round += 1) {
    if (tuned.run.minDist <= 90 || design.mouth.move || design.fixed) break;
    const guess = suggestTarget(tuned.run.traj, design, probe);
    if (!guess) break;
    design = { ...design, mouth: { ...design.mouth, near: [Math.round(guess.x), Math.round(guess.y)] } };
    retargeted = true;
    tuned = tune(probe, design, design.plan);
  }
  const traj = tuned.run.traj;
  const idx = Math.min(tuned.run.minIndex, Math.max(0, traj.length - 1));
  const hit = traj[idx] ?? { x: design.candy[0], y: design.candy[1] };
  const problems = [];

  const mouthR = design.mouth.r ?? 36;
  let monster;
  if (design.fixed || design.mouth.move) {
    monster = { at: [Math.round(design.mouth.near[0]), Math.round(design.mouth.near[1])], r: mouthR };
    if (design.mouth.move) {
      monster.move = { to: design.mouth.move.to, period: design.mouth.move.period, phase: Math.round((tuned.phase ?? 0) * 1000) / 1000 };
    }
    if (tuned.run.minDist > mouthR) problems.push(`够不到嘴 minDist=${tuned.run.minDist.toFixed(0)}`);
  } else {
    if (tuned.run.minDist > 90) problems.push(`目标不可达 minDist=${tuned.run.minDist.toFixed(0)}`);
    const mx = Math.round(Math.max(SAFE.x0, Math.min(SAFE.x1, hit.x)));
    const my = Math.round(Math.max(SAFE.y0, Math.min(SAFE.y1, hit.y)));
    monster = { at: [mx, my], r: mouthR };
  }

  const level = {
    id: design.id,
    box: design.box,
    name: design.name,
    hint: design.hint,
    candy: design.candy,
    ropes: ropeList(design),
    stars: [],
    bubbles: (design.bubbles ?? []).map((b) => ({ at: b.at, r: b.r ?? 44 })),
    cushions: design.cushions ?? [],
    spikes: design.spikes ?? [],
    walls: design.walls ?? [],
    monster,
    plan: tuned.plan,
  };

  // 嘴的最终位置确认后，找出弹道上"第一次进嘴"的采样点：三星必须排在它之前
  let arrive = arrivalIndex(traj, { x: monster.at[0], y: monster.at[1] }, mouthR, design, tuned.phase);
  if (arrive <= 0) {
    if (arrive === 0) problems.push("开局即进嘴（嘴压在糖的起点上）");
    else problems.push("弹道从未进入口腔半径");
    arrive = Math.max(1, traj.length - 1);
  }
  // 小兽不能坐在刺上或嵌在板里
  const mouthHazard = hazardDistance(level, monster.at[0], monster.at[1]);
  if (mouthHazard < mouthR + 8) problems.push(`嘴离刺/板只有 ${mouthHazard.toFixed(0)}px`);

  const upTo = design.mouth.move || design.fixed ? arrive : Math.min(arrive, idx);
  const upToArc = arcLengths(traj, upTo)[upTo] ?? 0;
  if (upToArc < 240) problems.push(`进嘴前弹道仅 ${upToArc.toFixed(0)}px，塞不下三星`);

  const fractionSets = [
    design.starFrac ?? [0.2, 0.5, 0.8],
    [0.15, 0.42, 0.72],
    [0.25, 0.55, 0.85],
    [0.12, 0.35, 0.6],
    [0.3, 0.6, 0.9],
  ];
  let stars = [];
  const debug = process.env.DEBUG_LEVEL === String(design.id);
  for (let relax = 0; relax < RELAX.length && stars.length < 3; relax += 1) {
    for (const fracs of fractionSets) {
      stars = pickStars(level, traj, upTo, { x: monster.at[0], y: monster.at[1] }, mouthR, fracs, debug, relax);
      if (stars.length === 3) break;
    }
  }
  level.stars = stars;
  if (stars.length < 3) problems.push(`只放下 ${stars.length} 颗星`);

  // 终检：重放一次，必须进嘴且三星全收
  const finalRun = replay(level, design, level.plan, false, tuned.phase);
  const ok =
    problems.length === 0 &&
    finalRun.state.status === "won" &&
    finalRun.state.starsTaken === 3 &&
    stars.length === 3;
  if (ok === false && finalRun.state.status === "won" && finalRun.state.starsTaken < 3) {
    problems.push(`终检只收到 ${finalRun.state.starsTaken} 星`);
  }
  return {
    level,
    ok,
    retargeted,
    problems,
    stars: finalRun.state.starsTaken,
    status: finalRun.state.status,
    minDist: tuned.run.minDist,
    time: finalRun.state.t,
    upToArc,
    arrive,
    samples: traj.length,
  };
}

const results = DESIGN.map((d) => ({ design: d, ...build(d) }));
let fails = 0;
for (const r of results) {
  const tag = r.ok ? "OK  " : "FAIL";
  if (!r.ok) fails += 1;
  console.log(
    `${tag} #${String(r.level.id).padStart(2)} ${r.design.name.zh.padEnd(6)} 嘴=(${r.level.monster.at[0]},${r.level.monster.at[1]}) 星=${r.stars}/${r.level.stars.length} 状态=${r.status} 用时=${r.time.toFixed(2)}s 偏差=${r.minDist.toFixed(1)}${r.problems.length ? "  « " + r.problems.join("; ") + ` [弧${(r.upToArc ?? 0).toFixed(0)} 到达#${r.arrive}/${r.samples}]` : ""}`
  );
}
console.log(`-- ${results.length - fails} ok, ${fails} fail`);

if (process.argv.includes("--write") && fails === 0) {
  const body = results
    .map((r) => {
      const l = r.level;
      const lines = [];
      lines.push(`  {`);
      lines.push(`    id: ${l.id},`);
      lines.push(`    box: ${l.box},`);
      lines.push(`    name: { zh: "${l.name.zh}", en: "${l.name.en}" },`);
      lines.push(`    hint: { zh: "${l.hint.zh}", en: "${l.hint.en}" },`);
      lines.push(`    candy: [${l.candy.join(", ")}],`);
      lines.push(`    monster: ${JSON.stringify(l.monster)},`);
      if (l.ropes.length) lines.push(`    ropes: ${JSON.stringify(l.ropes)},`);
      lines.push(`    stars: ${JSON.stringify(l.stars)},`);
      if (l.bubbles.length) lines.push(`    bubbles: ${JSON.stringify(l.bubbles)},`);
      if (l.cushions.length) lines.push(`    cushions: ${JSON.stringify(l.cushions)},`);
      if (l.spikes.length) lines.push(`    spikes: ${JSON.stringify(l.spikes)},`);
      if (l.walls.length) lines.push(`    walls: ${JSON.stringify(l.walls)},`);
      lines.push(`    plan: ${JSON.stringify(l.plan)},`);
      lines.push(`  },`);
      return lines.join("\n");
    })
    .join("\n");

  const out = `// levels.mjs — 割绳子 40 关（由 tools/build-levels.mjs 依据设计稿与真实弹道生成，勿手改）
// 每关的 plan 是一条已验证的"三星进嘴"解法；tests/levels.test.mjs 会逐关重放校验。
// 机关图例：ropes(普通/弹性/自动/滑轨) · bubbles · cushions · spikes · walls

export const BOXES = ${JSON.stringify(BOXES, null, 2)};

export const LEVELS = [
${body}
];

export const LEVEL_COUNT = LEVELS.length;
export const LEVELS_PER_BOX = 8;

export function levelById(id) {
  return LEVELS.find((l) => l.id === id) ?? null;
}

export function levelsOfBox(box) {
  return LEVELS.filter((l) => l.box === box);
}
`;
  const target = resolve(import.meta.dirname, "..", "js", "levels.mjs");
  writeFileSync(target, out, "utf8");
  console.log(`written -> ${target}`);
}
