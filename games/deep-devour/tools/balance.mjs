// tools/balance.mjs — 成长可达性验证（策划案 §3.1「成长曲线可验证」的机器证据）
//
// 用同一条贪心 AI（game.mjs greedyInput，不含任何关卡特判）对每关跑 N 次，
// 统计通关率与平均用时。达成率 < 95% 的关卡需要调刷新率或放宽时限。
//
// 用法：
//   node games/deep-devour/tools/balance.mjs                  # 默认每关 60 次
//   node games/deep-devour/tools/balance.mjs --runs=1000      # 完整门禁（耗时较长）
//   node games/deep-devour/tools/balance.mjs --zone=4         # 只跑第 4 片海域

import { LEVELS, ZONES } from "../js/levels.mjs";
import { createGame } from "../js/game.mjs";
import { stepFrame, STATUS, setWorldHeight } from "../js/engine.mjs";
import { greedyInput } from "../js/game.mjs";

function arg(name, fallback) {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? Number(hit.split("=")[1]) : fallback;
}

const RUNS = arg("runs", 60);
const FPS = arg("fps", 30);
const ZONE = arg("zone", 0);
const VERBOSE = process.argv.includes("--verbose");

const targets = LEVELS.filter((level) => (ZONE ? level.zone === ZONE : true));
const dt = 1 / FPS;

function runOnce(level, seed) {
  const game = createGame({ levelId: level.id, seed });
  const state = game.state;
  setWorldHeight(state, 800);
  state.status = STATUS.playing;
  const hardLimit = Math.ceil(((level.timeLimit ?? 240) + 30) * FPS);
  let frames = 0;
  while (state.status === STATUS.playing && frames < hardLimit) {
    stepFrame(state, dt, greedyInput(state));
    frames += 1;
  }
  return {
    won: state.status === STATUS.won,
    timedOut: state.status === STATUS.lost,
    hits: state.stats.hits,
    time: state.time,
    tier: state.player.tier,
    eaten: state.stats.eaten,
    score: Math.round(state.stats.score),
  };
}

let failed = 0;
const started = Date.now();
console.log(`== deep-devour balance ==  runs/level=${RUNS}  fps=${FPS}`);

for (const level of targets) {
  let wins = 0;
  let timeSum = 0;
  let hitsSum = 0;
  let tierSum = 0;
  let eatSum = 0;
  const worst = [];
  for (let i = 0; i < RUNS; i += 1) {
    const result = runOnce(level, 1000 + i * 7919 + level.zone * 131 + level.index * 17);
    if (result.won) {
      wins += 1;
      timeSum += result.time;
    } else {
      worst.push(result);
    }
    hitsSum += result.hits;
    tierSum += result.tier;
    eatSum += result.eaten;
  }
  const rate = wins / RUNS;
  const avg = wins ? (timeSum / wins).toFixed(1) : "-";
  const par = level.star3?.type === "parTime" ? `${level.star3.value}s` : level.star3?.type ?? "-";
  const flag = rate >= 0.95 ? "ok  " : "FAIL";
  if (rate < 0.95) failed += 1;
  console.log(
    `${flag} ${level.id.padEnd(4)} ${level.nameZh.padEnd(6)} win=${(rate * 100).toFixed(1).padStart(5)}% avg=${avg.padStart(5)}s par=${String(par).padStart(7)} ` +
      `hits=${(hitsSum / RUNS).toFixed(2)} tier=${(tierSum / RUNS).toFixed(2)} eaten=${(eatSum / RUNS).toFixed(1)} goal=${level.goal.type}:${level.goal.tier ?? level.goal.count}`,
  );
  if (VERBOSE && worst.length) {
    console.log(`      loses: ${worst.slice(0, 3).map((r) => `${r.time.toFixed(0)}s t${r.tier} e${r.eaten}`).join(" | ")}`);
  }
}

const seconds = ((Date.now() - started) / 1000).toFixed(1);
console.log(`-- zones=${ZONES.length} levels=${targets.length} 低于 95% 的关卡: ${failed}  用时 ${seconds}s`);
process.exit(failed ? 1 : 0);
