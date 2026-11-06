// Piano Tiles — 纯规则层（DOM-free，不碰 document/window/localStorage）
// 负责：黑块生成 / 帧步进滚动 / 命中判定 / 失误计数 / 分数与段位计算

/** ===== 常量 ===== */
export const CONFIG = {
  TRACKS: 4,
  MAX_MISSES: 3,
  CANVAS_WIDTH: 400,
  CANVAS_HEIGHT: 720,
  TILE_HEIGHT: 160,
  JUDGE_LINE_Y: 580,         // 判定线 y（距画布顶）
  PERFECT_WINDOW: 35,        // 判定线 ±px 算 PERFECT
  HIT_TOLERANCE: 60,         // 判定线 +px 仍允许命中（超过则视为漏黑已发生）
  SPEED_START: 160,          // 初始速度 px/s
  SPEED_MAX: 520,            // 最大速度 px/s
  SPAWN_INTERVAL_START: 0.85, // 初始生成间隔秒
  SPAWN_INTERVAL_MIN: 0.28,   // 最快生成间隔
  // 速度爬升：每连击多少增加多少速度
  SPEED_PER_COMBO: 4,
  INTERVAL_SHRINK_PER_COMBO: 0.012,
};

/** ===== 段位表 ===== */
export const RANKS = [
  { name: "新秀",   en: "Rookie",   minCombo: 10 },
  { name: "快手",   en: "Swift",    minCombo: 25 },
  { name: "手速大师", en: "Master",   minCombo: 50 },
  { name: "指尖传说", en: "Legend",   minCombo: 100 },
];

export function computeRank(maxCombo) {
  let current = null;
  for (const r of RANKS) {
    if (maxCombo >= r.minCombo) current = r;
  }
  return current; // null = 未入段
}

/** ===== 分数倍率 ===== */
export function comboMultiplier(combo) {
  if (combo >= 50) return 3;
  if (combo >= 25) return 2;
  if (combo >= 10) return 1.5;
  return 1;
}

/** ===== PRNG（确定性种子） ===== */
export function createPrng(seed = Date.now()) {
  let s = Math.floor(seed) % 2147483647;
  if (s <= 0) s += 2147483646;
  return function next() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** ===== 状态工厂 ===== */
export function createState(options = {}) {
  const cfg = { ...CONFIG, ...options };
  const prng = typeof options.random === "function"
    ? options.random
    : createPrng(options.seed);

  return {
    // 黑块列表：每个 tile 从顶部 y=0 向下滚动
    tiles: [],
    nextTileId: 1,
    // 分数与连击
    score: 0,
    combo: 0,
    maxCombo: 0,
    // 失误
    misses: 0,
    // 速度与生成节奏
    speed: cfg.SPEED_START,
    spawnInterval: cfg.SPAWN_INTERVAL_START,
    spawnTimer: 0,
    // 游戏状态
    running: false,
    gameOver: false,
    paused: false,
    // 配置快照（用于回读）
    config: { ...cfg },
    _prng: prng,
  };
}

/** ===== 生成新黑块 =====
 * 硬约束：与最近一个 active 黑块不在同一列（避免死站），
 * 且保证生成位置足够分散（不允许两列同时出现黑块在判定线附近）。
 */
export function spawnTile(state) {
  const cfg = state.config;
  const activeTiles = state.tiles.filter((t) => t.status === "active");

  // 找所有 active 黑块中最大的 col（最近刚生成的那一列）
  const lastCol = activeTiles.length
    ? activeTiles[activeTiles.length - 1].col
    : -1;

  // 可选列：避开上一列（降低"必死双黑"风险）
  const candidates = [];
  for (let c = 0; c < cfg.TRACKS; c++) {
    if (c !== lastCol) candidates.push(c);
  }
  const pick = candidates[Math.floor(state._prng() * candidates.length)];

  state.tiles.push({
    id: state.nextTileId++,
    col: pick,
    y: -cfg.TILE_HEIGHT, // 从屏幕外顶端开始
    height: cfg.TILE_HEIGHT,
    status: "active", // active | hit | missed
  });
  return state;
}

/** ===== 帧步进 =====
 * dt: 距上一帧的秒数（通常 ~0.016）
 * 返回 { missed: number[] } 刚漏黑的 tile id 列表（便于 UI 音效触发）
 */
export function stepFrame(state, dt) {
  if (!state.running || state.gameOver || state.paused) {
    return state;
  }

  const cfg = state.config;
  const missedIds = [];

  // 1. 生成节奏
  state.spawnTimer += dt;
  if (state.spawnTimer >= state.spawnInterval) {
    state.spawnTimer = 0;
    spawnTile(state);
  }

  // 2. 所有 active 黑块下落
  for (const tile of state.tiles) {
    if (tile.status !== "active") continue;
    tile.y += state.speed * dt;

    // 3. 漏黑检测：黑块顶部超过判定线 + 宽容窗口
    if (tile.y > cfg.JUDGE_LINE_Y + cfg.HIT_TOLERANCE) {
      tile.status = "missed";
      missedIds.push(tile.id);
      state.misses++;
      state.combo = 0;

      if (state.misses >= cfg.MAX_MISSES) {
        state.gameOver = true;
        state.running = false;
      }
    }
  }

  // 4. 清理已经完全滚出屏幕的黑块（保持数组精简）
  state.tiles = state.tiles.filter(
    (t) => t.y < cfg.CANVAS_HEIGHT + cfg.TILE_HEIGHT * 2
  );

  return state;
}

/** ===== 尝试命中某一列 =====
 * col: 0..3
 * hitY: 点击的 y 坐标（可选，用于 PERFECT 判定；不传则按判定线最近处理）
 * 返回：
 *   { ok: true, quality: 'perfect'|'good', tileId, baseScore, multiplier, gainedScore }
 *   { ok: false, reason: 'white'|'offline' }  — 点白 / 游戏未运行
 */
export function tryHit(state, col, hitY) {
  if (!state.running || state.gameOver) {
    return { ok: false, reason: "offline" };
  }

  const cfg = state.config;

  // 找该列所有 active 黑块中最靠近判定线的那个
  const candidates = state.tiles
    .filter((t) => t.status === "active" && t.col === col)
    .sort((a, b) => b.y - a.y); // y 最大 = 最靠下

  if (candidates.length === 0) {
    // 点白：该列此刻没有黑块
    state.misses++;
    state.combo = 0;
    if (state.misses >= cfg.MAX_MISSES) {
      state.gameOver = true;
      state.running = false;
    }
    return { ok: false, reason: "white" };
  }

  const tile = candidates[0];

  // 命中有效：黑块底部已经进入判定线以上区域
  // 黑块顶部 tile.y，底部 tile.y + tile.height
  // 判定线 cfg.JUDGE_LINE_Y
  // 有效命中窗口：tile.y <= JUDGE_LINE_Y + HIT_TOLERANCE（防漏黑已判的）
  // 且 tile.y + tile.height >= JUDGE_LINE_Y - 一些（块还没完全进入也能点）
  if (tile.y > cfg.JUDGE_LINE_Y + cfg.HIT_TOLERANCE) {
    // 其实已经应该算漏黑了，但用户恰好此刻点了 —— 仍按点白算失误
    state.misses++;
    state.combo = 0;
    if (state.misses >= cfg.MAX_MISSES) {
      state.gameOver = true;
      state.running = false;
    }
    return { ok: false, reason: "white" };
  }

  // 命中成功
  tile.status = "hit";

  // PERFECT / GOOD 判定
  // 理想命中点：黑块中央在判定线附近
  const tileCenter = tile.y + tile.height / 2;
  const distanceToLine = Math.abs(tileCenter - cfg.JUDGE_LINE_Y);
  const quality = distanceToLine <= cfg.PERFECT_WINDOW ? "perfect" : "good";

  // 更新连击
  state.combo++;
  if (state.combo > state.maxCombo) state.maxCombo = state.combo;

  // 得分
  const mult = comboMultiplier(state.combo);
  const base = quality === "perfect" ? 2 : 1;
  const gained = Math.round(base * mult * 10);
  state.score += gained;

  // 速度与生成节奏递增
  state.speed = Math.min(cfg.SPEED_MAX, cfg.SPEED_START + state.combo * cfg.SPEED_PER_COMBO);
  state.spawnInterval = Math.max(
    cfg.SPAWN_INTERVAL_MIN,
    cfg.SPAWN_INTERVAL_START - state.combo * cfg.INTERVAL_SHRINK_PER_COMBO
  );

  return {
    ok: true,
    quality,
    tileId: tile.id,
    baseScore: base,
    multiplier: mult,
    gainedScore: gained,
  };
}

/** ===== 启动/暂停/重开 ===== */
export function start(state) {
  state.running = true;
  state.gameOver = false;
  state.paused = false;
  return state;
}

export function pause(state) {
  state.paused = true;
  return state;
}

export function resume(state) {
  state.paused = false;
  state.running = true;
  return state;
}

export function reset(state) {
  const fresh = createState({ seed: state._seed });
  state.tiles = fresh.tiles;
  state.nextTileId = fresh.nextTileId;
  state.score = fresh.score;
  state.combo = fresh.combo;
  state.maxCombo = fresh.maxCombo;
  state.misses = fresh.misses;
  state.speed = fresh.speed;
  state.spawnInterval = fresh.spawnInterval;
  state.spawnTimer = fresh.spawnTimer;
  state.running = false;
  state.gameOver = false;
  state.paused = false;
  return state;
}
