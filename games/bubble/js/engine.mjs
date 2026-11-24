/**
 * 极简泡泡堂 · 水泡大作战 (Bubble Arena Lite)
 * 核心物理与对战规则引擎 (DOM-Free, 100% 确定性, 两段式困敌戳破判定)
 */

export function mulberry32(seed) {
  let s = Math.floor(seed) >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const COLS = 13;
export const ROWS = 11;

export const TILE = {
  EMPTY: 0,
  HARD: 1,
  SOFT: 2,
  BUSH: 3,
};

export const ITEMS = {
  item_bubble: { id: "item_bubble", weight: 35 },
  item_splash: { id: "item_splash", weight: 30 },
  item_boots: { id: "item_boots", weight: 20 },
  item_kick: { id: "item_kick", weight: 8 },
  item_needle: { id: "item_needle", weight: 5 },
  item_shield: { id: "item_shield", weight: 5 },
};

export const MAPS = {
  map_pool: {
    id: "map_pool",
    softBlockDensity: 0.38,
    hasIce: false,
  },
  map_isles: {
    id: "map_isles",
    softBlockDensity: 0.45,
    hasIce: false,
  },
  map_ice: {
    id: "map_ice",
    softBlockDensity: 0.32,
    hasIce: true,
  },
  map_pirate: {
    id: "map_pirate",
    softBlockDensity: 0.42,
    hasIce: false,
  },
};

export function generateGrid(mapId = "map_pool", rng = Math.random) {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(TILE.EMPTY));
  const cfg = MAPS[mapId] || MAPS.map_pool;

  // 1. 边缘全硬墙
  for (let r = 0; r < ROWS; r++) {
    grid[r][0] = TILE.HARD;
    grid[r][COLS - 1] = TILE.HARD;
  }
  for (let c = 0; c < COLS; c++) {
    grid[0][c] = TILE.HARD;
    grid[ROWS - 1][c] = TILE.HARD;
  }

  // 2. 经典奇数交错硬柱 (Odd-indexed pillars)
  for (let r = 2; r < ROWS - 1; r += 2) {
    for (let c = 2; c < COLS - 1; c += 2) {
      grid[r][c] = TILE.HARD;
    }
  }

  // 3. 出生点保护区 (四角通道保证至少 3 格畅通，避免放泡后无处可逃)
  const spawnProtection = new Set([
    // 左上 (P1)
    "1,1", "2,1", "3,1", "1,2", "1,3",
    // 右下 (P2 / AI)
    "11,9", "10,9", "9,9", "11,8", "11,7",
    // 左下
    "1,9", "2,9", "3,9", "1,8", "1,7",
    // 右上
    "11,1", "10,1", "9,1", "11,2", "11,3",
  ]);

  // 4. 对称生成软砖 (左右对称保证竞技公平)
  const halfCols = Math.ceil(COLS / 2);
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < halfCols; c++) {
      if (grid[r][c] !== TILE.EMPTY) continue;
      const key = `${c},${r}`;
      if (spawnProtection.has(key)) continue;

      if (rng() < cfg.softBlockDensity) {
        grid[r][c] = TILE.SOFT;
        grid[r][COLS - 1 - c] = TILE.SOFT;
      }
    }
  }

  return grid;
}

export function createInitialState(options = {}) {
  const mapId = options.mapId || "map_pool";
  const seed = options.seed !== undefined ? options.seed : 12345;
  const rng = mulberry32(seed);
  const mode = options.mode || "solo"; // "solo", "pvp"
  const aiLevel = options.aiLevel || "novice"; // "novice", "skilled", "master"

  const grid = generateGrid(mapId, rng);

  // 初始角色：P1 (蓝) 位于左上角 (1, 1), P2 / AI (红) 位于右下角 (11, 9)
  const players = [
    {
      id: 0,
      x: 1.5,
      y: 1.5,
      col: 1,
      row: 1,
      dir: "down",
      alive: true,
      trapped: false,
      trappedTimer: 0,
      trappedWiggle: 0,
      maxBubbles: 1,
      activeBubbles: 0,
      splashPower: 1,
      speed: 3.2, // 格 / 秒
      canKick: false,
      needles: 0,
      hasShield: false,
      isAI: false,
    },
    {
      id: 1,
      x: 11.5,
      y: 9.5,
      col: 11,
      row: 9,
      dir: "up",
      alive: true,
      trapped: false,
      trappedTimer: 0,
      trappedWiggle: 0,
      maxBubbles: 1,
      activeBubbles: 0,
      splashPower: 1,
      speed: 3.2,
      canKick: false,
      needles: 0,
      hasShield: false,
      isAI: mode === "solo",
    },
  ];

  return {
    mapId,
    mode,
    aiLevel,
    seed,
    timeElapsed: 0,
    roundTimeLeft: 100, // 100s 回合倒计时
    grid,
    players,
    bubbles: [], // array of { id, col, row, ownerId, fuse, power, sliding, slideDx, slideDy }
    splashes: [], // array of { col, row, timer, maxTimer, isCenter }
    droppedItems: [], // array of { col, row, type }
    status: "playing", // "playing", "p1_won", "p2_won", "draw"
    nextBubbleId: 1,
    rngState: seed,
    logs: [],
  };
}

export function dropBubble(state, playerId) {
  if (state.status !== "playing") return state;
  const player = state.players.find((p) => p.id === playerId);
  if (!player || !player.alive || player.trapped) return state;

  const col = Math.floor(player.x);
  const row = Math.floor(player.y);

  // 检查是否已有水泡
  const existing = state.bubbles.find((b) => b.col === col && b.row === row);
  if (existing) return state;

  // 检查水泡上限
  if (player.activeBubbles >= player.maxBubbles) return state;

  const newBubble = {
    id: state.nextBubbleId,
    col,
    row,
    ownerId: playerId,
    fuse: 2.3, // 2.3 秒爆裂
    power: player.splashPower,
    sliding: false,
    slideDx: 0,
    slideDy: 0,
  };

  const updatedPlayers = state.players.map((p) =>
    p.id === playerId ? { ...p, activeBubbles: p.activeBubbles + 1 } : p
  );

  return {
    ...state,
    nextBubbleId: state.nextBubbleId + 1,
    bubbles: [...state.bubbles, newBubble],
    players: updatedPlayers,
  };
}

export function useNeedle(state, playerId) {
  if (state.status !== "playing") return state;
  const player = state.players.find((p) => p.id === playerId);
  if (!player || !player.alive || player.needles <= 0) return state;

  if (player.trapped) {
    // 自救脱困
    const updatedPlayers = state.players.map((p) =>
      p.id === playerId ? { ...p, trapped: false, trappedTimer: 0, needles: p.needles - 1 } : p
    );
    return {
      ...state,
      players: updatedPlayers,
      logs: [...state.logs.slice(-15), { type: "needle_rescue", playerId }],
    };
  }

  // 戳刺前方格子的水泡或困住的对手
  let targetCol = Math.floor(player.x);
  let targetRow = Math.floor(player.y);
  if (player.dir === "up") targetRow--;
  else if (player.dir === "down") targetRow++;
  else if (player.dir === "left") targetCol--;
  else if (player.dir === "right") targetCol++;

  // 戳死困住的对手
  const targetEnemy = state.players.find(
    (p) => p.id !== playerId && p.alive && p.trapped && Math.floor(p.x) === targetCol && Math.floor(p.y) === targetRow
  );

  if (targetEnemy) {
    const updatedPlayers = state.players.map((p) => {
      if (p.id === playerId) return { ...p, needles: p.needles - 1 };
      if (p.id === targetEnemy.id) return { ...p, alive: false, trapped: false };
      return p;
    });
    return {
      ...state,
      players: updatedPlayers,
      logs: [...state.logs.slice(-15), { type: "needle_pop", playerId, targetId: targetEnemy.id }],
    };
  }

  return state;
}

export function stepFrame(state, dt, inputs = {}) {
  if (state.status !== "playing") return state;

  const rng = mulberry32(state.rngState);
  let timeElapsed = state.timeElapsed + dt;
  let roundTimeLeft = Math.max(0, state.roundTimeLeft - dt);
  let grid = state.grid.map((row) => [...row]);
  let droppedItems = [...state.droppedItems];
  let splashes = [];
  let bubbles = state.bubbles.map((b) => ({ ...b }));
  let players = state.players.map((p) => ({ ...p }));
  let logs = [...state.logs];

  // 1. 处理现有水花计时消散
  for (const sp of state.splashes) {
    const remain = sp.timer - dt;
    if (remain > 0) {
      splashes.push({ ...sp, timer: remain });
    }
  }

  // 2. 遍历水泡，处理滑动与倒计时爆裂
  const explodingBubbles = [];
  const remainingBubbles = [];

  for (let i = 0; i < bubbles.length; i++) {
    const b = bubbles[i];

    // 处理滑行
    if (b.sliding) {
      const nextCol = b.col + b.slideDx;
      const nextRow = b.row + b.slideDy;
      // 遇墙、软砖或另一水泡即停
      const isBlocked =
        nextCol < 0 ||
        nextCol >= COLS ||
        nextRow < 0 ||
        nextRow >= ROWS ||
        grid[nextRow][nextCol] === TILE.HARD ||
        grid[nextRow][nextCol] === TILE.SOFT ||
        bubbles.some((other) => other.id !== b.id && other.col === nextCol && other.row === nextRow);

      if (!isBlocked) {
        b.col = nextCol;
        b.row = nextRow;
      } else {
        b.sliding = false;
      }
    }

    b.fuse -= dt;
    if (b.fuse <= 0) {
      explodingBubbles.push(b);
    } else {
      remainingBubbles.push(b);
    }
  }

  // 3. 处理水泡爆裂与十字水柱扩散 (含连锁引爆)
  const newlyTriggeredExplosions = [...explodingBubbles];
  const activeBubbleSet = new Set(remainingBubbles.map((b) => b.id));

  while (newlyTriggeredExplosions.length > 0) {
    const exp = newlyTriggeredExplosions.shift();

    // 释放拥有者水泡计数
    const owner = players.find((p) => p.id === exp.ownerId);
    if (owner && owner.activeBubbles > 0) {
      owner.activeBubbles -= 1;
    }

    // 中心水花
    splashes.push({ col: exp.col, row: exp.row, timer: 0.42, maxTimer: 0.42, isCenter: true });

    // 四向水柱扩散
    const dirs = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ];

    for (const d of dirs) {
      for (let step = 1; step <= exp.power; step++) {
        const sc = exp.col + d.dx * step;
        const sr = exp.row + d.dy * step;

        if (sc < 0 || sc >= COLS || sr < 0 || sr >= ROWS) break;

        // 遇硬墙彻底截断
        if (grid[sr][sc] === TILE.HARD) {
          break;
        }

        // 遇软砖冲碎并停止本方向
        if (grid[sr][sc] === TILE.SOFT) {
          grid[sr][sc] = TILE.EMPTY;
          splashes.push({ col: sc, row: sr, timer: 0.42, maxTimer: 0.42, isCenter: false });
          // 40% 概率爆出道具
          if (rng() < 0.42) {
            const itemKeys = Object.keys(ITEMS);
            const picked = itemKeys[Math.floor(rng() * itemKeys.length)];
            droppedItems.push({ col: sc, row: sr, type: picked });
          }
          break;
        }

        // 普通空格产生水花
        splashes.push({ col: sc, row: sr, timer: 0.42, maxTimer: 0.42, isCenter: false });

        // 检查连锁引爆
        const hitBubbleIdx = remainingBubbles.findIndex(
          (b) => activeBubbleSet.has(b.id) && b.col === sc && b.row === sr
        );
        if (hitBubbleIdx !== -1) {
          const hitBubble = remainingBubbles.splice(hitBubbleIdx, 1)[0];
          activeBubbleSet.delete(hitBubble.id);
          newlyTriggeredExplosions.push(hitBubble);
        }
      }
    }
  }

  // 4. 水花检测角色困泡 (Splash Hit -> Trap)
  for (const player of players) {
    if (!player.alive) continue;
    const pCol = Math.floor(player.x);
    const pRow = Math.floor(player.y);

    const hitBySplash = splashes.some((s) => s.col === pCol && s.row === pRow);
    if (hitBySplash) {
      if (player.hasShield) {
        player.hasShield = false; // 护盾抵消
        logs.push({ type: "shield_break", playerId: player.id });
      } else if (!player.trapped) {
        // 核心机制：困在透明水泡中！
        player.trapped = true;
        player.trappedTimer = 5.2; // 5.2 秒困泡时间
        logs.push({ type: "trapped", playerId: player.id });
      }
    }
  }

  // 5. 处理玩家移动、困泡倒计时与戳破判定
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (!p.alive) continue;

    if (p.trapped) {
      // 困在水泡中倒计时
      p.trappedTimer -= dt;
      if (p.trappedTimer <= 0) {
        // 超时自脱困但掉落全部道具惩罚
        p.trapped = false;
        p.speed = 3.2;
        p.maxBubbles = Math.max(1, p.maxBubbles - 1);
        p.splashPower = Math.max(1, p.splashPower - 1);
        logs.push({ type: "escaped", playerId: p.id });
      }
      continue;
    }

    // 获取输入 (P1 vs P2 / AI)
    let moveInput = { dx: 0, dy: 0 };
    if (!p.isAI) {
      const input = p.id === 0 ? inputs.p1 : inputs.p2;
      if (input) {
        if (input.left) moveInput.dx -= 1;
        if (input.right) moveInput.dx += 1;
        if (input.up) moveInput.dy -= 1;
        if (input.down) moveInput.dy += 1;
      }
    } else {
      // AI 决策行动
      moveInput = computeAIMove(p, state, grid, remainingBubbles, splashes);
    }

    // 规范化移动速度
    if (moveInput.dx !== 0 || moveInput.dy !== 0) {
      const len = Math.hypot(moveInput.dx, moveInput.dy);
      const step = (p.speed * dt) / len;
      const targetX = p.x + moveInput.dx * step;
      const targetY = p.y + moveInput.dy * step;

      // 四向走位与拐角自适应吸附 (Corner sliding)
      if (canMoveTo(targetX, targetY, grid, remainingBubbles, p.id)) {
        p.x = targetX;
        p.y = targetY;
      } else if (moveInput.dx !== 0 && canMoveTo(targetX, p.y, grid, remainingBubbles, p.id)) {
        p.x = targetX;
      } else if (moveInput.dy !== 0 && canMoveTo(p.x, targetY, grid, remainingBubbles, p.id)) {
        p.y = targetY;
      }

      // 更新朝向
      if (Math.abs(moveInput.dx) > Math.abs(moveInput.dy)) {
        p.dir = moveInput.dx > 0 ? "right" : "left";
      } else if (moveInput.dy !== 0) {
        p.dir = moveInput.dy > 0 ? "down" : "up";
      }
    }

    // 检查踢泡 (走向水泡时踢出)
    if (p.canKick) {
      let lookCol = Math.floor(p.x);
      let lookRow = Math.floor(p.y);
      if (p.dir === "up") lookRow--;
      else if (p.dir === "down") lookRow++;
      else if (p.dir === "left") lookCol--;
      else if (p.dir === "right") lookCol++;

      const targetBubble = remainingBubbles.find(
        (b) => !b.sliding && b.col === lookCol && b.row === lookRow
      );
      if (targetBubble) {
        targetBubble.sliding = true;
        targetBubble.slideDx = p.dir === "right" ? 1 : p.dir === "left" ? -1 : 0;
        targetBubble.slideDy = p.dir === "down" ? 1 : p.dir === "up" ? -1 : 0;
        logs.push({ type: "kick_bubble", playerId: p.id });
      }
    }

    // 捡拾地面积木道具
    const curCol = Math.floor(p.x);
    const curRow = Math.floor(p.y);
    const itemIdx = droppedItems.findIndex((it) => it.col === curCol && it.row === curRow);
    if (itemIdx !== -1) {
      const it = droppedItems.splice(itemIdx, 1)[0];
      applyItem(p, it.type);
      logs.push({ type: "pickup_item", playerId: p.id, item: it.type });
    }
  }

  // 6. 核心机制：戳破淘汰 (Touching Trapped Enemy -> Pop & Eliminate!)
  for (let i = 0; i < players.length; i++) {
    const hunter = players[i];
    if (!hunter.alive || hunter.trapped) continue;

    for (let j = 0; j < players.length; j++) {
      if (i === j) continue;
      const victim = players[j];
      if (!victim.alive || !victim.trapped) continue;

      // 距离接近触发戳破淘汰！
      const dist = Math.hypot(hunter.x - victim.x, hunter.y - victim.y);
      if (dist < 0.85) {
        victim.alive = false;
        victim.trapped = false;
        logs.push({ type: "popped", hunterId: hunter.id, victimId: victim.id });
      }
    }
  }

  // 7. 胜负判断
  let status = "playing";
  const p1 = players[0];
  const p2 = players[1];

  if (!p1.alive && !p2.alive) {
    status = "draw";
  } else if (!p1.alive) {
    status = "p2_won";
  } else if (!p2.alive) {
    status = "p1_won";
  } else if (roundTimeLeft <= 0) {
    // 超时按未被困存活判定
    status = p1.trapped ? "p2_won" : p2.trapped ? "p1_won" : "draw";
  }

  return {
    ...state,
    timeElapsed,
    roundTimeLeft,
    grid,
    bubbles: remainingBubbles,
    splashes,
    droppedItems,
    players,
    status,
    rngState: (state.rngState + 1) >>> 0,
    logs: logs.slice(-20),
  };
}

function canMoveTo(x, y, grid, bubbles, playerId) {
  const radius = 0.38; // 角色碰撞半径
  const left = Math.floor(x - radius);
  const right = Math.floor(x + radius);
  const top = Math.floor(y - radius);
  const bottom = Math.floor(y + radius);

  for (let r = top; r <= bottom; r++) {
    for (let c = left; c <= right; c++) {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
      if (grid[r][c] === TILE.HARD || grid[r][c] === TILE.SOFT) {
        return false;
      }
      // 水泡碰撞：如果自身就在水泡中心格，允许走开；完全在外部则阻挡
      const bubble = bubbles.find((b) => b.col === c && b.row === r);
      if (bubble) {
        const centerDist = Math.hypot(x - (c + 0.5), y - (r + 0.5));
        if (centerDist > 0.85) {
          return false;
        }
      }
    }
  }
  return true;
}

function applyItem(player, itemType) {
  if (itemType === "item_bubble") {
    player.maxBubbles = Math.min(6, player.maxBubbles + 1);
  } else if (itemType === "item_splash") {
    player.splashPower = Math.min(6, player.splashPower + 1);
  } else if (itemType === "item_boots") {
    player.speed = Math.min(5.5, player.speed + 0.6);
  } else if (itemType === "item_kick") {
    player.canKick = true;
  } else if (itemType === "item_needle") {
    player.needles = Math.min(3, player.needles + 1);
  } else if (itemType === "item_shield") {
    player.hasShield = true;
  }
}

function computeAIMove(ai, state, grid, bubbles, splashes) {
  const p1 = state.players[0];
  const curCol = Math.floor(ai.x);
  const curRow = Math.floor(ai.y);

  // 1. 若对手被困，最高优先级：立即冲过去戳破！
  if (p1.alive && p1.trapped) {
    const dx = p1.x - ai.x;
    const dy = p1.y - ai.y;
    return { dx: Math.sign(dx), dy: Math.sign(dy) };
  }

  // 2. 危险规避：如果当前格子或附近有即将爆裂的水泡或水花，立即逃避
  const inDanger = splashes.some((s) => s.col === curCol && s.row === curRow) ||
    bubbles.some((b) => Math.hypot(b.col - curCol, b.row - curRow) <= 1.5 && b.fuse < 1.0);

  if (inDanger) {
    const escapeDirs = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ];
    for (const d of escapeDirs) {
      const tc = curCol + d.dx;
      const tr = curRow + d.dy;
      if (
        tc >= 1 && tc < COLS - 1 && tr >= 1 && tr < ROWS - 1 &&
        grid[tr][tc] === TILE.EMPTY &&
        !bubbles.some((b) => b.col === tc && b.row === tr)
      ) {
        return d;
      }
    }
  }

  // 3. 寻找最近的软砖或道具
  if (state.droppedItems.length > 0) {
    const item = state.droppedItems[0];
    const dx = (item.col + 0.5) - ai.x;
    const dy = (item.row + 0.5) - ai.y;
    return { dx: Math.sign(dx), dy: Math.sign(dy) };
  }

  // 4. 靠近玩家逼近
  const dx = p1.x - ai.x;
  const dy = p1.y - ai.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    return { dx: Math.sign(dx), dy: 0 };
  } else {
    return { dx: 0, dy: Math.sign(dy) };
  }
}

export function checkInvariants(state) {
  if (state.roundTimeLeft < 0) {
    throw new Error(`Invariant violation: roundTimeLeft < 0, got ${state.roundTimeLeft}`);
  }
  for (const player of state.players) {
    if (player.x < 0 || player.x > COLS || player.y < 0 || player.y > ROWS) {
      throw new Error(`Invariant violation: player out of bounds (${player.x}, ${player.y})`);
    }
    if (player.maxBubbles < 1 || player.maxBubbles > 10) {
      throw new Error(`Invariant violation: invalid maxBubbles ${player.maxBubbles}`);
    }
  }
  return true;
}

export function getLegalActions(state, playerId = 0) {
  if (state.status !== "playing") return [];
  const player = state.players.find((p) => p.id === playerId);
  if (!player || !player.alive) return [];

  const actions = [
    { type: "move", dx: 0, dy: -1 },
    { type: "move", dx: 0, dy: 1 },
    { type: "move", dx: -1, dy: 0 },
    { type: "move", dx: 1, dy: 0 },
  ];

  if (!player.trapped && player.activeBubbles < player.maxBubbles) {
    actions.push({ type: "drop_bubble" });
  }

  if (player.needles > 0) {
    actions.push({ type: "use_needle" });
  }

  return actions;
}
