// game.mjs — DOM-free 状态控制器（收 UI 意图 → 调 engine → 派事件）。
// 本模块绝不触碰 document / window / localStorage；所有渲染与存档都在外层。

import {
  PLAYER,
  STATUS,
  createAbyssLevel,
  createState,
  pauseState,
  playerRadius,
  resumeState,
  setWorldHeight,
  stepFrame,
  summarise,
  WORLD_HEIGHT,
} from "./engine.mjs";
import { LEVELS, levelById, nextLevelId } from "./levels.mjs";
import { levelPearls } from "./score.mjs";

export function createGame(options = {}) {
  const game = {
    mode: "level",
    levelId: options.levelId ?? LEVELS[0].id,
    seed: Number.isFinite(options.seed) ? options.seed : 20260915,
    attempt: 0,
    worldHeight: options.worldHeight ?? WORLD_HEIGHT,
    view: { pointer: null, keys: { x: 0, y: 0 }, sprint: false },
    session: { peakShoal: 0, bestFrenzy: 0, bestCombo: 0 },
    finished: null,
    events: [],
  };
  loadLevel(game, game.levelId, { fresh: true });
  return game;
}

function buildState(game, level, mode, seed) {
  const state = createState(level, {
    seed,
    mode,
    height: game.worldHeight,
    autoStart: false,
  });
  return state;
}

function loadLevel(game, levelId, { fresh = false } = {}) {
  const level = levelById(levelId);
  game.mode = "level";
  game.levelId = level.id;
  if (fresh) game.attempt = 0;
  game.state = buildState(game, level, "level", game.seed + game.attempt * 977);
  game.session = { peakShoal: 0, bestFrenzy: 0, bestCombo: 0 };
  game.finished = null;
  return game.state;
}

export function startLevel(game, levelId) {
  if (typeof levelId !== "string") return { action: null, events: [] };
  const exists = LEVELS.some((level) => level.id === levelId);
  if (!exists) return { action: null, events: [] };
  loadLevel(game, levelId, { fresh: false });
  return { action: "loadLevel", events: [{ type: "levelLoaded", levelId }] };
}

export function startAbyss(game) {
  game.mode = "abyss";
  game.attempt += 1;
  const level = createAbyssLevel();
  game.state = buildState(game, level, "abyss", game.seed + game.attempt * 313);
  game.session = { peakShoal: 0, bestFrenzy: 0, bestCombo: 0 };
  game.finished = null;
  return { action: "startAbyss", events: [{ type: "abyssStarted" }] };
}

export function begin(game) {
  if (game.state.status === STATUS.ready) {
    game.state.status = STATUS.playing;
    return { action: "begin", events: [{ type: "began" }] };
  }
  return { action: null, events: [] };
}

export function currentLevel(game) {
  return game.state.level;
}

export function computeInput(game) {
  const state = game.state;
  const player = state.player;
  let dirX = 0;
  let dirY = 0;
  if (game.view.pointer) {
    const dx = game.view.pointer.x - player.x;
    const dy = game.view.pointer.y - player.y;
    const dist = Math.hypot(dx, dy);
    // 死区只用来防“指针压在身上时抽搐”，不能大到吃掉微操 —— 12px 之内才不动。
    if (dist > 12) {
      dirX = dx / dist;
      dirY = dy / dist;
    }
  } else if (game.view.keys.x || game.view.keys.y) {
    dirX = game.view.keys.x;
    dirY = game.view.keys.y;
  }
  return { dirX, dirY, sprint: game.view.sprint, pointer: game.view.pointer };
}

export function advanceFrame(game, dt) {
  const state = game.state;
  if (state.status !== STATUS.playing) return [];
  const events = stepFrame(state, dt, computeInput(game));
  trackSession(game);
  if (state.status !== STATUS.playing) finalise(game);
  return events;
}

function trackSession(game) {
  const state = game.state;
  game.session.peakShoal = Math.max(game.session.peakShoal, state.shoal.length);
  game.session.bestFrenzy = Math.max(game.session.bestFrenzy, state.stats.bestFrenzy);
  game.session.bestCombo = Math.max(game.session.bestCombo, state.stats.bestCombo);
}

function finalise(game) {
  const state = game.state;
  const won = state.status === STATUS.won;
  const result = {
    won,
    timedOut: state.timeLimit !== Infinity && state.time >= state.timeLimit,
    mode: game.mode,
    levelId: game.mode === "level" ? game.levelId : "abyss",
    hits: state.stats.hits,
    time: Math.round(state.time * 10) / 10,
    eaten: state.stats.eaten,
    score: Math.round(state.stats.score),
    tier: state.player.tier,
    hearts: state.player.hearts,
    bestFrenzy: state.stats.bestFrenzy,
    bestCombo: state.stats.bestCombo,
    shoalPeak: game.session.peakShoal,
    meters: Math.round(state.abyss.depth),
    pearls: 0,
    stars: [false, false, false],
    labels: ["pass", "noHit", "bonus"],
  };
  if (game.mode === "level") {
    const evaluation = levelPearls(state.level, result);
    result.pearls = evaluation.pearls;
    result.stars = evaluation.stars;
    result.labels = evaluation.labels;
  }
  game.finished = result;
  return result;
}

export function dispatch(game, intent = {}) {
  const type = intent?.type;
  switch (type) {
    case "pointer": {
      if (!Number.isFinite(intent.x) || !Number.isFinite(intent.y)) return { action: null, events: [] };
      game.view.pointer = { x: intent.x, y: intent.y };
      game.view.keys = { x: 0, y: 0 };
      return { action: "pointer", events: [] };
    }
    case "clearPointer": {
      game.view.pointer = null;
      return { action: "clearPointer", events: [] };
    }
    case "keys": {
      const x = Number(intent.x) || 0;
      const y = Number(intent.y) || 0;
      if (x === 0 && y === 0) {
        game.view.keys = { x: 0, y: 0 };
        return { action: "keys", events: [] };
      }
      game.view.keys = { x, y };
      game.view.pointer = null;
      return { action: "keys", events: [] };
    }
    case "sprint": {
      game.view.sprint = Boolean(intent.on);
      return { action: "sprint", events: [] };
    }
    case "begin":
      return begin(game);
    case "pause": {
      const changed = pauseState(game.state);
      return { action: changed ? "pause" : null, events: changed ? [{ type: "paused" }] : [] };
    }
    case "resume": {
      const changed = resumeState(game.state);
      return { action: changed ? "resume" : null, events: changed ? [{ type: "resumed" }] : [] };
    }
    case "restart": {
      if (game.mode === "abyss") return startAbyss(game);
      game.attempt += 1;
      loadLevel(game, game.levelId, { fresh: false });
      return { action: "restart", events: [{ type: "levelLoaded", levelId: game.levelId, restart: true }] };
    }
    case "nextLevel": {
      if (game.mode === "abyss") return startAbyss(game);
      const next = nextLevelId(game.levelId);
      if (!next) {
        return { action: null, events: [{ type: "denied", reason: "noNextLevel" }] };
      }
      loadLevel(game, next, { fresh: true });
      return { action: "nextLevel", events: [{ type: "levelLoaded", levelId: next }] };
    }
    case "selectLevel":
      return startLevel(game, intent.levelId);
    case "startAbyss":
      return startAbyss(game);
    default:
      return { action: null, events: [] };
  }
}

export function setViewport(game, height) {
  const next = Math.round(Number(height) || WORLD_HEIGHT);
  game.worldHeight = next;
  setWorldHeight(game.state, next);
  return next;
}

export function summary(game) {
  return { ...summarise(game.state), finished: game.finished, mode: game.mode, levelId: game.levelId };
}

// 平衡测试与端到端复用的贪心 AI：威胁斥力 + 收益吸引力 + 危险物斥力 + 边界规避，
// 不含任何关卡特判 —— 用它跑出的通关率才是关卡本身的可达性证据。
// 对危险物的处理等价于一个“看得见尖刺、会绕开、只剩一颗心就不再贪宝箱”的普通玩家。
export function greedyInput(state) {
  const player = state.player;
  const world = state.world;
  const radius = playerRadius(state);
  const cautious = player.hearts <= 1;
  let repelX = 0;
  let repelY = 0;
  let nearest = Infinity;
  for (const entity of state.entities) {
    // 卸力期的精英不构成威胁 —— 那正是绕到它尾巴后面的窗口。
    const hostile = entity.elite ? entity.stun <= 0 && !entity.recovering : entity.tier > player.tier;
    if (!hostile) continue;
    const dx = entity.x - player.x;
    const dy = entity.y - player.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist > 340) continue;
    if (dist < nearest) nearest = dist;
    const weight = ((340 - dist) / 340) ** 2 * (entity.elite ? 1.5 : 1);
    repelX -= (dx / dist) * weight * 3;
    repelY -= (dy / dist) * weight * 3;
  }

  let target = null;
  let bestScore = Infinity;
  for (const entity of state.entities) {
    if (entity.elite || entity.tier >= player.tier) continue;
    const dx = entity.x - player.x;
    const dy = entity.y - player.y;
    const dist = Math.hypot(dx, dy);
    const score = dist - entity.tier * 26 - (entity.shoalable ? 30 : 0);
    if (score < bestScore) {
      bestScore = score;
      target = entity;
    }
  }

  // 危险物绕行：不做“正面顶开”——那会把 AI 顶在原地打转，猎物一跑就永远追不上。
  // 改成沿切线侧滑绕过去，侧滑取更靠近猎物的那一侧，这就是人类玩家的绕行直觉。
  let slideX = 0;
  let slideY = 0;
  for (const hazard of state.hazards) {
    // 宝箱平时要去开（里面是增益泡泡），但只剩一颗心时不再拿命赌 25% 的陷阱。
    if (hazard.kind === "chest" && !cautious) continue;
    const dx = hazard.x - player.x;
    const dy = hazard.y - player.y;
    const dist = Math.hypot(dx, dy) || 1;
    const clearance = dist - hazard.r - radius;
    const feel = 135;
    if (clearance > feel) continue;
    const nx = dx / dist;
    const ny = dy / dist;
    const urgency = ((feel - clearance) / feel) ** 2 * (hazard.kind === "chest" ? 0.6 : 1);
    repelX -= nx * urgency * 2.2;
    repelY -= ny * urgency * 2.2;
    const tx = -ny;
    const ty = nx;
    const side = target ? Math.sign(tx * (target.x - player.x) + ty * (target.y - player.y)) || 1 : 1;
    slideX += tx * side * urgency * 3.4;
    slideY += ty * side * urgency * 3.4;
  }

  // 危险半径内不贪吃：做一次 0.55 秒的前瞻采样，选“最坏情况下离所有威胁最远”的方向（maximin）。
  // 这仍然是纯贪心 —— 不看关卡、不做规划，只是把“往哪边跑”这件事算清楚。
  // 注意：这一段必须是纯粹的逃离虚招，不能掺入“顺手吃一口”的收益项 ——
  // 实测掺入收益吸引力会让 AI 边逃边贪，反而更容易被吃。
  if (nearest < 260) {
    const threats = [];
    for (const entity of state.entities) {
      const hostile = entity.elite ? entity.stun <= 0 && !entity.recovering : entity.tier > player.tier;
      if (!hostile) continue;
      const dist = Math.hypot(entity.x - player.x, entity.y - player.y);
      if (dist > 460) continue;
      threats.push({ x: entity.x, y: entity.y, weight: entity.elite ? 1.25 : 1 });
    }
    const probe = PLAYER.baseSpeed * 0.55;
    let bestX = 0;
    let bestY = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < 16; i += 1) {
      const angle = (i / 16) * Math.PI * 2;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const nx = player.x + dx * probe;
      const ny = player.y + dy * probe;
      let worst = Infinity;
      let sum = 0;
      for (const threat of threats) {
        const gap = Math.hypot(nx - threat.x, ny - threat.y) / threat.weight;
        worst = Math.min(worst, gap);
        sum += gap;
      }
      if (worst === Infinity) worst = 600;
      // 危险物按“擦身余量”扣分，越贴越狠 —— 逃命时也不能一头扎进尖刺。
      let penalty = 0;
      for (const hazard of state.hazards) {
        if (hazard.kind === "chest" && !cautious) continue;
        const clearance = Math.hypot(nx - hazard.x, ny - hazard.y) - hazard.r - radius;
        if (clearance < 46) penalty += (46 - clearance) * (hazard.kind === "chest" ? 2.5 : 5);
      }
      const wall = Math.min(nx, ny, world.width - nx, world.height - ny);
      if (wall < 100) penalty += (100 - wall) * 4;
      const score = worst + (sum / Math.max(1, threats.length)) * 0.3 - penalty;
      if (score > bestScore) {
        bestScore = score;
        bestX = dx;
        bestY = dy;
      }
    }
    const escapeSprint = (player.energy > 20) || (player.snare > 0 && player.energy > 22);
    return { dirX: bestX, dirY: bestY, sprint: escapeSprint };
  }

  let dirX = 0;
  let dirY = 0;
  if (target) {
    const dist = Math.hypot(target.x - player.x, target.y - player.y) || 1;
    dirX = (target.x - player.x) / dist;
    dirY = (target.y - player.y) / dist;
  }
  dirX += repelX + slideX;
  dirY += repelY + slideY;

  // 贴边会被逼死：靠近上下左右墙时加一股向内的力。
  const margin = 110 + radius;
  if (player.x < margin) dirX += (margin - player.x) / margin;
  if (player.x > world.width - margin) dirX -= (player.x - (world.width - margin)) / margin;
  if (player.y < margin) dirY += (margin - player.y) / margin;
  if (player.y > world.height - margin) dirY -= (player.y - (world.height - margin)) / margin;

  // 中毒时左右反向是公开信息，玩家会本能地反着推杆。
  if (player.poison > 0) dirX = -dirX;

  const magnitude = Math.hypot(dirX, dirY);
  if (magnitude > 1) {
    dirX /= magnitude;
    dirY /= magnitude;
  }
  if (magnitude < 0.05) {
    // 无事可做：贴着猎物密度最高的方向慢慢巡游，避免原地打转。
    dirX = target ? Math.sign(target.x - player.x) : Math.sin(state.time * 0.7) * 0.4;
    dirY = target ? Math.sign(target.y - player.y) * 0.5 : Math.cos(state.time * 0.5) * 0.4;
    const length = Math.hypot(dirX, dirY) || 1;
    dirX /= length;
    dirY /= length;
  }
  // 被渔网缠住就冲刺扯断，不要拖着网慢慢蹭。
  const sprint = (nearest < 210 && player.energy > 25) || (player.snare > 0 && player.energy > 22);
  return { dirX, dirY, sprint };
}
