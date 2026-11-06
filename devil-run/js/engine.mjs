// 恶魔迷途 · 核心规则引擎（DOM-free 纯逻辑）
// 绝对禁止访问 window / document / localStorage / Math.random
//
// 设计铁律（来自 docs/plans/devil-run-prd.md）：
//  1. 固定步长 stepFrame(state, dt)，完全确定性，同一输入序列必然产生同一结果；
//  2. 陷阱「先承诺、后翻脸」——玩家已投入动作且无法反悔时才发动；
//  3. 陷阱位置/时序固定可记忆，绝不随机致死（只考观察与记忆，不考反应）；
//  4. 死亡零惩罚：重生 ≤ RESPAWN_TOTAL 秒，印章永久保留，陷阱全部复位；
//  5. 所有陷阱在死亡重生后必须复位到关卡初始状态，杜绝「陷阱用掉了就不可解」。

// ---- 物理常量 ----
export const GRAVITY = 46;         // 重力加速度 (units/s^2)
export const MOVE_SPEED = 6.0;     // 平地最大水平速度
export const JUMP_VEL = 14.2;      // 起跳初速度（跳跃高度 ≈ v²/(2g) ≈ 2.19 格）
export const MAX_FALL = 20;        // 最大下落速度
export const COYOTE_TIME = 0.09;   // 土狼时间：离台后 90ms 内仍可跳
export const JUMP_BUFFER = 0.12;   // 跳跃预输入缓冲：落地前 120ms 按跳不吞键

export const CW = 0.62;            // 方块碰撞宽
export const CH = 0.92;            // 方块碰撞高（略矮于 1 格）

export const DEATH_ANIM = 0.22;    // 压扁碎裂动画时长（残影，不可操作）
export const RESPAWN_TOTAL = 0.38; // 死亡到可控总时长（≤0.4s，成瘾性命脉）
export const WIN_OVERLAP = 0.42;   // 进门判定重叠阈值

export const MAX_STEPS_PER_STEP = 40; // 单帧最大子步进（防穿越）

// ---- 陷阱时间参数（统一在此调，关卡数据只声明类型与位置）----
export const TRAP_TIMING = Object.freeze({
  // 前兆时长：玩家「看懂了但来不及」，是幽默与恶意的分界线
  telegraph: 0.13,
  // 塌陷地砖：踩上后延迟多久塌
  collapseDelay: 0.17,
  // 假砖：踩上后延迟多久碎
  fakeDelay: 0.06,
  // 弹出尖刺：进入触发区后延迟多久弹出
  spikeDelay: 0.07,
  // 弹出尖刺：完全弹出所需时间（期间已具致死判定，不给二次反悔）
  spikeRise: 0.07,
  // 坠落天花板：起跳后延迟多久开始坠落
  ceilingDelay: 0.09,
  // 坠落天花板：从原位落到底所需时间
  ceilingFall: 0.24,
  // 消失平台：玩家离台后多久消失（之后永久不可踩）
  vanishDelay: 0.14,
  // 弹簧：踩上后延迟多久弹射
  springDelay: 0.05,
  // 弹簧弹射初速度（故意过冲到尖刺上）
  springVel: -20.5,
  // 假门：进门后多久门消失（消失后本关不再存在此门）
  fakeDoorDelay: 0.05,
  // 移动终点：玩家靠近时滑走的速度与最远滑行距离
  runDoorSpeed: 7.5,
  runDoorRange: 3,
  // 重力翻转：踩上翻转格后延迟多久生效
  flipDelay: 0.06,
  // 隐形尖刺：玩家进入显形半径（格）与显形到激活窗口
  revealRadius: 2.05,
  revealWindow: 0.3,
  // 传送错位：传送到候选位的冷却（防连传）
  portalCooldown: 0.35
});

// ---- 地砖类型 ----
export const T = Object.freeze({
  EMPTY: 0,
  SOLID: 1,     // 实心可踩
  SPIKE: 2,     // 常驻尖刺（致死）
  LAVA: 3       // 灼热地（致死，视觉上红热）
});

export const TILE_CHARS = Object.freeze({
  ".": T.EMPTY,
  " ": T.EMPTY,
  "#": T.SOLID,
  "^": T.SPIKE
});

// ---- 陷阱类型（关卡设计词汇表）----
export const TRAP = Object.freeze({
  COLLAPSE: "collapse",   // 塌陷地砖
  SPIKE: "spike",         // 弹出尖刺
  CEILING: "ceiling",     // 坠落天花板
  FAKE: "fake",           // 伪装地砖
  VANISH: "vanish",       // 消失平台
  SPRING: "spring",       // 弹簧过冲
  FAKEDOOR: "fakedoor",   // 假门
  RUNDOOR: "rundoor",     // 移动终点
  GRAVITY: "gravity",     // 重力翻转
  REVERSE: "reverse",     // 反向操作
  GHOSTSPIKE: "ghostspike", // 隐形尖刺
  PORTAL: "portal"        // 传送错位
});

export const ALL_TRAPS = Object.freeze(Object.values(TRAP));

// ---- 关卡声明的陷阱合法性 ----
export function isKnownTrap(kind) {
  return ALL_TRAPS.includes(kind);
}

// ---- 状态构建 ----
// trap 声明形状（levels.mjs 解析后统一成此结构）：
//  { kind, col, row,          // 主格
//    cells: [{col,row}],      // 覆盖格（塌陷/假砖/消失/天花板为整块；尖刺/弹簧/翻转/反向多为单格）
//    trigger: {col,row}|null, // 触发格（null = 由玩家身体所在格自动判定）
//    target: {x,y}|null,      // 弹簧落点 / 传送候选位
//    targets: [{x,y}],        // 传送错位候选位（确定性轮换）
//    dir: -1|1|0,             // 移动终点滑行方向
//    span: n                  // 天花板宽度（格）/ 反向操作覆盖列数
//  }
export function createInitialState(level, options = {}) {
  const w = level.w;
  const h = level.h;
  const spawnY = level.spawnY;
  return {
    status: "playing",              // playing | won
    phase: "playing",               // playing | dying  （dying 期间只跑动画，不接受操作）
    elapsed: 0,
    phaseTimer: 0,
    levelIndex: options.levelIndex ?? 0,
    levelName: level.name ?? "",
    nodeId: level.nodeId ?? 0,
    w,
    h,
    map: level.map.map((r) => r.slice()),
    gravityDir: 1,                  // 1 = 正常（向下），-1 = 翻转
    reverseLeft: 0,                 // 剩余反向操作秒数
    spawn: { x: level.spawnX, y: spawnY },
    player: {
      x: level.spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      onGround: true,
      coyote: 0,
      jumpBuffer: 0,
      facing: 1
    },
    goal: {
      x: level.goal.x,
      y: level.goal.y,
      homeX: level.goal.x,
      homeY: level.goal.y,
      visible: true,
      moved: 0
    },
    candle: { x: level.candle.x, y: level.candle.y, taken: false },
    traps: level.traps.map((t) => ({
      kind: t.kind,
      col: t.col,
      row: t.row,
      cells: (t.cells ?? [{ col: t.col, row: t.row }]).map((c) => ({ col: c.col, row: c.row })),
      trigger: t.trigger ? { col: t.trigger.col, row: t.trigger.row } : null,
      target: t.target ? { x: t.target.x, y: t.target.y } : null,
      targets: (t.targets ?? []).map((p) => ({ x: p.x, y: p.y })),
      dir: t.dir ?? 0,
      span: t.span ?? 0,
      // 运行时
      state: "idle",              // idle | armed | active | spent | gone
      timer: 0,
      fade: 0,                    // 0..1 前兆强度（渲染用，也决定是否已具致死）
      offsetX: 0,
      offsetY: 0,
      extra: { revealIdx: 0, teleports: 0, vanished: false }
    })),
    marks: [],                    // 恶魔脚印：{ x, y, index }（死亡纪念碑，重生不清）
    stats: {
      deaths: 0,
      deathsThisRun: 0,           // 本次未通关的连死计数（用于嘲讽表情）
      restarts: 0
    },
    // 本关一次性收集（死亡即重置）
    gotCandle: false,
    cleared: false,
    // 本次通关尝试是否零死亡
    flawless: true
  };
}

export function tileAt(state, col, row) {
  if (!Number.isFinite(col) || !Number.isFinite(row)) return T.EMPTY;
  col = Math.floor(col);
  row = Math.floor(row);
  if (row < 0 || row >= state.h || col < 0 || col >= state.w) return T.EMPTY;
  return state.map[row][col];
}

function deepClone(o) {
  if (o === null || typeof o !== "object") return o;
  if (Array.isArray(o)) return o.map(deepClone);
  const out = {};
  for (const k of Object.keys(o)) out[k] = deepClone(o[k]);
  return out;
}

// ---- 帧步进 ----
// inputs: { left, right, jump, restart }
export function stepFrame(prev, dt, inputs = {}) {
  if (prev.status === "won") {
    return { state: prev, events: [] };
  }

  const state = deepClone(prev);
  const events = [];

  // ---- 死亡动画阶段：只推进计时，不接受操作，不留痕 ----
  if (state.phase === "dying") {
    state.phaseTimer += dt;
    state.elapsed += dt;
    if (state.phaseTimer >= DEATH_ANIM) {
      respawn(state, events);
    }
    return { state, events };
  }

  const p = state.player;
  state.elapsed += dt;

  // 反向操作倒计时
  if (state.reverseLeft > 0) {
    state.reverseLeft = Math.max(0, state.reverseLeft - dt);
  }

  // 1. 输入 → 跳跃缓冲
  let wantLeft = Boolean(inputs.left);
  let wantRight = Boolean(inputs.right);
  if (state.reverseLeft > 0) {
    const tmp = wantLeft;
    wantLeft = wantRight;
    wantRight = tmp;
  }
  if (inputs.jump) p.jumpBuffer = JUMP_BUFFER;
  if (p.jumpBuffer > 0) p.jumpBuffer -= dt;

  // 2. 陷阱推进（先于物理，保证「触发即已生效」的帧对齐稳定）
  updateTraps(state, dt, events);

  // 3. 角色物理
  movePlayer(state, { left: wantLeft, right: wantRight }, dt, events);

  // 4. 移动终点（见玩家靠近就滑走）
  updateGoal(state, dt, events);

  // 5. 蜡烛收集
  collectCandle(state, events);

  // 6. 危险判定
  checkHazards(state, events);

  // 7. 进门判定
  checkWin(state, events);

  return { state, events };
}

// =====================================================================
// 陷阱系统
// =====================================================================

// 陷阱覆盖的所有格中，是否包含玩家所在格
function playerOverlapsCells(state, trap) {
  const p = state.player;
  const cL = Math.floor((p.x - CW / 2 - 0.02));
  const cR = Math.floor((p.x + CW / 2 + 0.02));
  const rT = Math.floor(p.y - CH - 0.02);
  const rB = Math.floor(p.y + 0.02);
  for (const c of trap.cells) {
    if (c.col >= cL && c.col <= cR && c.row >= rT && c.row <= rB) return true;
  }
  return false;
}

function playerOnTrigger(state, trap) {
  if (!trap.trigger) return playerOverlapsCells(state, trap);
  const p = state.player;
  const cL = Math.floor(p.x - CW / 2 - 0.02);
  const cR = Math.floor(p.x + CW / 2 + 0.02);
  const rT = Math.floor(p.y - CH - 0.02);
  const rB = Math.floor(p.y + 0.02);
  const t = trap.trigger;
  return t.col >= cL && t.col <= cR && t.row >= rT && t.row <= rB;
}

// 玩家是否踩在覆盖格之上（脚底落在该格顶面）
function playerStandsOnCells(state, trap) {
  const p = state.player;
  const footRow = Math.floor(p.y + 0.02);
  const cL = Math.floor(p.x - CW / 2 + 0.02);
  const cR = Math.floor(p.x + CW / 2 - 0.02);
  for (const c of trap.cells) {
    if (c.row === footRow && c.col >= cL && c.col <= cR) return true;
  }
  return false;
}

function setCells(state, trap, tile) {
  for (const c of trap.cells) {
    if (c.row >= 0 && c.row < state.h && c.col >= 0 && c.col < state.w) {
      state.map[c.row][c.col] = tile;
    }
  }
}

function updateTraps(state, dt, events) {
  for (const trap of state.traps) {
    updateTrap(state, trap, dt, events);
  }
}

function updateTrap(state, trap, dt, events) {
  switch (trap.kind) {
    case TRAP.COLLAPSE: {
      if (trap.state === "idle") {
        if (playerStandsOnCells(state, trap) || playerOnTrigger(state, trap)) {
          trap.state = "armed";
          trap.timer = TRAP_TIMING.collapseDelay;
          events.push({ type: "trap_telegraph", kind: trap.kind, col: trap.col, row: trap.row });
        }
      } else if (trap.state === "armed") {
        trap.timer -= dt;
        trap.fade = 1 - Math.max(0, trap.timer) / TRAP_TIMING.collapseDelay;
        if (trap.timer <= 0) {
          setCells(state, trap, T.EMPTY);
          trap.state = "spent";
          trap.fade = 1;
          events.push({ type: "trap_fire", kind: trap.kind, col: trap.col, row: trap.row });
        }
      }
      break;
    }

    case TRAP.FAKE: {
      if (trap.state === "idle" && (playerStandsOnCells(state, trap) || playerOnTrigger(state, trap))) {
        trap.state = "armed";
        trap.timer = TRAP_TIMING.fakeDelay;
      } else if (trap.state === "armed") {
        trap.timer -= dt;
        trap.fade = 1 - Math.max(0, trap.timer) / TRAP_TIMING.fakeDelay;
        if (trap.timer <= 0) {
          setCells(state, trap, T.EMPTY);
          trap.state = "spent";
          trap.fade = 1;
          events.push({ type: "trap_fire", kind: trap.kind, col: trap.col, row: trap.row });
        }
      }
      break;
    }

    case TRAP.VANISH: {
      // 玩家离开后才消失：先记住被踩过，再在离台后延迟消失
      if (trap.state === "idle" && (playerStandsOnCells(state, trap) || playerOnTrigger(state, trap))) {
        trap.state = "armed";
        trap.timer = -1; // 尚未离台
        trap.fade = 0.35;
      } else if (trap.state === "armed") {
        if (playerStandsOnCells(state, trap)) {
          trap.timer = -1;
        } else {
          if (trap.timer < 0) trap.timer = TRAP_TIMING.vanishDelay;
          trap.timer -= dt;
          trap.fade = 0.35 + 0.65 * (1 - Math.max(0, trap.timer) / TRAP_TIMING.vanishDelay);
          if (trap.timer <= 0) {
            setCells(state, trap, T.EMPTY);
            trap.state = "spent";
            trap.extra.vanished = true;
            events.push({ type: "trap_fire", kind: trap.kind, col: trap.col, row: trap.row });
          }
        }
      }
      break;
    }

    case TRAP.SPIKE: {
      if (trap.state === "idle") {
        if (playerOnTrigger(state, trap)) {
          trap.state = "armed";
          trap.timer = TRAP_TIMING.spikeDelay;
          events.push({ type: "trap_telegraph", kind: trap.kind, col: trap.col, row: trap.row });
        }
      } else if (trap.state === "armed") {
        trap.timer -= dt;
        trap.fade = 1 - Math.max(0, trap.timer) / TRAP_TIMING.spikeDelay;
        if (trap.timer <= 0) {
          trap.state = "active";
          trap.fade = 1;
          setCells(state, trap, T.SPIKE);
          events.push({ type: "trap_fire", kind: trap.kind, col: trap.col, row: trap.row });
        }
      }
      break;
    }

    case TRAP.GHOSTSPIKE: {
      // 只在玩家距其 revealRadius 格内才显形；显形 → revealWindow 后才致死
      const p = state.player;
      const cx = trap.col + 0.5;
      const cy = trap.row + 0.5;
      const dist = Math.hypot(p.x - cx, p.y - 0.5 - cy);
      if (trap.state === "idle") {
        if (dist <= TRAP_TIMING.revealRadius) {
          trap.state = "armed";
          trap.timer = TRAP_TIMING.revealWindow;
          setCells(state, trap, T.SPIKE);
          events.push({ type: "trap_telegraph", kind: trap.kind, col: trap.col, row: trap.row });
        }
      } else if (trap.state === "armed") {
        trap.timer -= dt;
        trap.fade = 1 - Math.max(0, trap.timer) / TRAP_TIMING.revealWindow;
        if (trap.timer <= 0) {
          trap.state = "active";
          trap.fade = 1;
          events.push({ type: "trap_fire", kind: trap.kind, col: trap.col, row: trap.row });
        }
      }
      break;
    }

    case TRAP.CEILING: {
      if (trap.state === "idle") {
        // 「先承诺后翻脸」的精髓：玩家起跳的那一瞬才脱落
        if (!state.player.onGround && playerOverlapsCells(state, trap)) {
          trap.state = "armed";
          trap.timer = TRAP_TIMING.ceilingDelay;
          events.push({ type: "trap_telegraph", kind: trap.kind, col: trap.col, row: trap.row });
        }
      } else if (trap.state === "armed") {
        trap.timer -= dt;
        trap.fade = 1 - Math.max(0, trap.timer) / TRAP_TIMING.ceilingDelay;
        if (trap.timer <= 0) {
          trap.state = "active";
          trap.timer = TRAP_TIMING.ceilingFall;
          trap.fade = 1;
          events.push({ type: "trap_fire", kind: trap.kind, col: trap.col, row: trap.row });
        }
      } else if (trap.state === "active") {
        trap.timer -= dt;
        const total = TRAP_TIMING.ceilingFall;
        trap.offsetY = (1 - Math.max(0, trap.timer) / total) * (trap.fallHeight ?? 6);
        if (trap.timer <= 0) {
          trap.state = "spent";
          trap.offsetY = trap.fallHeight ?? 6;
        }
      }
      break;
    }

    case TRAP.SPRING: {
      if (trap.state === "idle") {
        if (playerStandsOnCells(state, trap) || playerOnTrigger(state, trap)) {
          trap.state = "armed";
          trap.timer = TRAP_TIMING.springDelay;
        }
      } else if (trap.state === "armed") {
        trap.timer -= dt;
        trap.fade = 1 - Math.max(0, trap.timer) / TRAP_TIMING.springDelay;
        if (trap.timer <= 0) {
          trap.state = "spent";
          trap.fade = 1;
          // 故意过冲：把玩家弹进尖刺
          const p = state.player;
          p.vy = TRAP_TIMING.springVel;
          p.onGround = false;
          p.coyote = 0;
          if (trap.target) {
            // 朝目标方向给一点水平初速，保证轨迹可复现
            p.vx = Math.sign(trap.target.x - p.x) * MOVE_SPEED * 0.62;
          }
          events.push({ type: "trap_fire", kind: trap.kind, col: trap.col, row: trap.row });
          events.push({ type: "spring", col: trap.col, row: trap.row });
        }
      }
      break;
    }

    case TRAP.FAKEDOOR: {
      if (trap.state === "idle" && playerOverlapsCells(state, trap)) {
        trap.state = "armed";
        trap.timer = TRAP_TIMING.fakeDoorDelay;
      } else if (trap.state === "armed") {
        trap.timer -= dt;
        if (trap.timer <= 0) {
          trap.state = "spent";
          state.goal.visible = false;
          events.push({ type: "trap_fire", kind: trap.kind, col: trap.col, row: trap.row });
          events.push({ type: "goal_gone" });
        }
      }
      break;
    }

    case TRAP.RUNDOOR: {
      // 见玩家靠近就滑走；滑到最远距离后停下（确定性）
      const g = state.goal;
      if (!g.visible) break;
      const dist = Math.abs(state.player.x - g.x);
      const remaining = TRAP_TIMING.runDoorRange - g.moved;
      if (dist < 1.35 && remaining > 0.001) {
        // 朝远离玩家的方向滑，方向由 trap.dir 指定（0 = 自动远离）
        const away = trap.dir !== 0 ? trap.dir : (state.player.x <= g.x ? 1 : -1);
        const step = Math.min(remaining, TRAP_TIMING.runDoorSpeed * dt);
        g.x += away * step;
        g.moved += step;
        if (g.moved >= TRAP_TIMING.runDoorRange - 0.001) {
          trap.state = "spent";
          events.push({ type: "goal_stopped" });
        } else {
          trap.state = "active";
        }
      }
      break;
    }

    case TRAP.GRAVITY: {
      if (trap.state === "idle") {
        if (playerStandsOnCells(state, trap) || playerOnTrigger(state, trap)) {
          trap.state = "armed";
          trap.timer = TRAP_TIMING.flipDelay;
          events.push({ type: "trap_telegraph", kind: trap.kind, col: trap.col, row: trap.row });
        }
      } else if (trap.state === "armed") {
        trap.timer -= dt;
        trap.fade = 1 - Math.max(0, trap.timer) / TRAP_TIMING.flipDelay;
        if (trap.timer <= 0) {
          trap.state = "spent";
          trap.fade = 1;
          state.gravityDir = trap.dir === 0 ? -state.gravityDir : trap.dir;
          state.player.vy = 0;
          state.player.onGround = false;
          events.push({ type: "trap_fire", kind: trap.kind, col: trap.col, row: trap.row });
          events.push({ type: "gravity_flip", dir: state.gravityDir });
        }
      }
      break;
    }

    case TRAP.REVERSE: {
      if (trap.state === "idle" && playerOnTrigger(state, trap)) {
        trap.state = "armed";
        trap.timer = 0;
        trap.fade = 1;
        state.reverseLeft = Math.max(state.reverseLeft, trap.span || 6);
        events.push({ type: "trap_fire", kind: trap.kind, col: trap.col, row: trap.row });
        events.push({ type: "controls_reversed", seconds: state.reverseLeft });
      }
      break;
    }

    case TRAP.PORTAL: {
      if (trap.state === "spent") {
        trap.timer -= dt;
        if (trap.timer <= 0) {
          trap.state = "idle";
          trap.extra.teleports = 0;
        }
        break;
      }
      if (trap.state === "idle" && playerOverlapsCells(state, trap)) {
        const list = trap.targets.length ? trap.targets : (trap.target ? [trap.target] : []);
        if (!list.length) {
          trap.state = "spent";
          trap.timer = 0;
          break;
        }
        // 确定性轮换：第 n 次踩踏取第 n % len 个候选位
        const idx = trap.extra.teleports % list.length;
        const dest = list[idx];
        trap.extra.teleports += 1;
        const p = state.player;
        p.x = dest.x;
        p.y = dest.y;
        p.vx = 0;
        p.vy = 0;
        p.onGround = false;
        p.coyote = 0;
        trap.state = "spent";
        trap.timer = TRAP_TIMING.portalCooldown;
        events.push({ type: "trap_fire", kind: trap.kind, col: trap.col, row: trap.row });
        events.push({ type: "portal", x: dest.x, y: dest.y, index: idx });
      }
      break;
    }

    default:
      break;
  }
}

// =====================================================================
// 角色物理
// =====================================================================

function playerBox(x, y) {
  return { left: x - CW / 2, right: x + CW / 2, top: y - CH, bottom: y };
}

function solidAt(state, col, row) {
  return tileAt(state, col, row) === T.SOLID;
}

// 踩到天花板等：向上时头是否撞到实心
function hitsSolidUp(state, box) {
  const r = Math.floor(box.top);
  if (r < 0) return false;
  const cL = Math.floor(box.left);
  const cR = Math.floor(box.right - 0.01);
  for (let c = cL; c <= cR; c++) {
    if (solidAt(state, c, r)) return true;
  }
  // 坠落中的天花板块（已具致死由 hazard 处理；这里也当作实体阻挡）
  for (const t of state.traps) {
    if (t.kind !== TRAP.CEILING) continue;
    if (t.state !== "armed" && t.state !== "active" && t.state !== "spent") continue;
    const cy = t.row + t.offsetY;
    if (cy <= box.top && cy + 1 > box.top) {
      const cFrom = t.col;
      const cTo = t.col + Math.max(0, (t.span || 1) - 1);
      if (box.right > cFrom && box.left < cTo + 1) return true;
    }
  }
  return false;
}

function hitsSolidHorizontal(state, box) {
  const rT = Math.floor(box.top);
  const rB = Math.floor(box.bottom - 0.02);
  const cL = Math.floor(box.left);
  const cR = Math.floor(box.right - 0.01);
  for (let r = rT; r <= rB; r++) {
    for (let c = cL; c <= cR; c++) {
      if (solidAt(state, c, r)) return true;
    }
  }
  return false;
}

// 垂直方向求落点（沿着重力方向找地面）
function findGround(state, prevBottom, box) {
  const g = state.gravityDir;
  if (g > 0) {
    const r = Math.floor(box.bottom);
    if (r < 0 || r >= state.h) return null;
    const cL = Math.floor(box.left - 0.05);
    const cR = Math.floor(box.right + 0.05);
    for (let c = cL; c <= cR; c++) {
      if (solidAt(state, c, r)) return r;
    }
    return null;
  }
  // 重力向上：天花板即地面
  const r = Math.floor(box.top - 0.001);
  if (r < 0 || r >= state.h) return null;
  const cL = Math.floor(box.left - 0.05);
  const cR = Math.floor(box.right + 0.05);
  for (let c = cL; c <= cR; c++) {
    if (solidAt(state, c, r)) return r + 1;
  }
  return null;
}

function movePlayer(state, input, dt, events) {
  const p = state.player;
  const g = state.gravityDir;

  // ---- 水平 ----
  let dir = 0;
  if (input.left) dir -= 1;
  if (input.right) dir += 1;
  if (dir !== 0) {
    p.facing = dir;
    p.vx = dir * MOVE_SPEED;
  } else {
    p.vx = 0;
  }
  const dx = p.vx * dt;
  if (dx !== 0) movePlayerX(state, dx);

  // ---- 跳跃（先于垂直积分，保持与 fire-ice 一致的跟手节奏）----
  if (p.jumpBuffer > 0 && (p.onGround || p.coyote > 0)) {
    p.vy = -JUMP_VEL * g;
    p.jumpBuffer = 0;
    p.coyote = 0;
    p.onGround = false;
    events.push({ type: "jump" });
  }

  // ---- 垂直 ----
  p.vy = clampFall(p.vy + GRAVITY * g * dt);
  const dy = p.vy * dt;
  movePlayerY(state, dy, events);

  // ---- 土狼时间 ----
  if (p.onGround) {
    p.coyote = COYOTE_TIME;
  } else if (p.coyote > 0) {
    p.coyote -= dt;
  }
}

function clampFall(v) {
  // 朝重力方向的速度上限（朝反方向时不做上限，保证弹簧过冲不被削）
  if (v > MAX_FALL) return MAX_FALL;
  return v;
}

function movePlayerX(state, dx) {
  const p = state.player;
  const steps = Math.max(1, Math.ceil(Math.abs(dx) / 0.04));
  const per = dx / steps;
  for (let s = 0; s < steps; s++) {
    const nx = p.x + per;
    const box = playerBox(nx, p.y);
    if (hitsSolidHorizontal(state, box) || hitsGoalWall(state, box)) {
      p.x = snapWallX(state, p.y, Math.sign(per), nx);
      p.vx = 0;
      break;
    }
    p.x = nx;
  }
}

// 终点门（认真门）实体阻挡：必须落到门口而不是穿过去
function hitsGoalWall(state, box) {
  const g = state.goal;
  if (!g.visible) return false;
  const dLeft = g.x - 0.5;
  const dRight = g.x + 0.5;
  const dTop = g.y - 1.9;
  const dBottom = g.y + 0.1;
  if (box.right <= dLeft || box.left >= dRight) return false;
  if (box.top >= dBottom || box.bottom <= dTop) return false;
  // 门对玩家的水平穿透不阻挡（进门靠 checkWin）——只有「已进门」才不阻挡，
  // 所以这里返回 false，让玩家可以走进门内触发通关。柱子则用 solid tile 表达。
  return false;
}

function snapWallX(state, y, dir, nx) {
  const box = playerBox(nx ?? state.player.x, y);
  const rT = Math.floor(box.top);
  const rB = Math.floor(box.bottom - 0.02);
  let x = state.player.x;
  if (dir > 0) {
    let min = Infinity;
    for (let r = Math.max(0, rT); r <= Math.min(state.h - 1, rB); r++) {
      const c = Math.floor(box.right);
      if (solidAt(state, c, r)) min = Math.min(min, c - CW / 2 - 0.01);
    }
    if (min !== Infinity) x = min;
  } else if (dir < 0) {
    let max = -Infinity;
    for (let r = Math.max(0, rT); r <= Math.min(state.h - 1, rB); r++) {
      const c = Math.floor(box.left);
      if (solidAt(state, c, r)) max = Math.max(max, c + 1 + CW / 2 + 0.01);
    }
    if (max !== -Infinity) x = max;
  }
  return x;
}

function movePlayerY(state, dy, events) {
  if (dy === 0) return;
  const p = state.player;
  const g = state.gravityDir;
  const steps = Math.max(1, Math.min(MAX_STEPS_PER_STEP, Math.ceil(Math.abs(dy) / 0.04)));
  const per = dy / steps;
  let landed = false;
  for (let s = 0; s < steps; s++) {
    const ny = p.y + per;
    const box = playerBox(p.x, ny);
    if (per > 0 === (g > 0)) {
      // 朝「地面」方向运动
      const gRow = findGround(state, p.y, box);
      if (gRow !== null) {
        if (g > 0) {
          p.y = gRow;
        } else {
          p.y = gRow + CH;
        }
        p.vy = 0;
        p.onGround = true;
        landed = true;
        break;
      }
    } else {
      // 朝「天花板」方向运动
      if (hitsSolidUp(state, box)) {
        const r = Math.floor(box.top);
        p.y = g > 0 ? r + 1 + CH + 0.01 : r - 0.01;
        p.vy = 0;
        break;
      }
    }
    p.y = ny;
  }
  if (!landed) {
    p.onGround = false;
    const box = playerBox(p.x, p.y);
    if (findGround(state, p.y, box) !== null) p.onGround = true;
  }
}

// =====================================================================
// 终点门 / 蜡烛 / 危险 / 通关
// =====================================================================

function updateGoal(state, dt) {
  // 移动终点由 trap 系统处理（TRAP.RUNDOOR）
}

function collectCandle(state, events) {
  const c = state.candle;
  if (c.taken) return;
  const p = state.player;
  if (Math.abs(p.x - c.x) < 0.7 && Math.abs(p.y - 0.45 - c.y) < 0.8) {
    c.taken = true;
    state.gotCandle = true;
    events.push({ type: "candle", x: c.x, y: c.y });
  }
}

function checkHazards(state, events) {
  const p = state.player;
  // 位置守卫：任何非有限值都直接判死重生，绝不让 NaN 扩散
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
    kill(state, events, "fall");
    return;
  }
  const cx = Math.floor(p.x);
  const cMid = Math.floor(p.y - CH * 0.5);
  const cFoot = Math.floor(p.y - 0.02);

  // 1. 地砖类致死
  for (const [c, r] of [[cx, cFoot], [cx, cMid]]) {
    const t = tileAt(state, c, r);
    if (t === T.SPIKE || t === T.LAVA) {
      kill(state, events, t === T.SPIKE ? "spike" : "lava");
      return;
    }
  }

  // 2. 坠落天花板压中
  for (const trap of state.traps) {
    if (trap.kind !== TRAP.CEILING) continue;
    if (trap.state !== "armed" && trap.state !== "active") continue;
    if (trap.state === "armed" && trap.fade < 0.6) continue; // 前兆期不致死
    const cy = trap.row + trap.offsetY;
    const cFrom = trap.col;
    const cTo = trap.col + Math.max(0, (trap.span || 1) - 1);
    if (p.x + CW / 2 > cFrom && p.x - CW / 2 < cTo + 1) {
      if (p.y > cy && p.y - CH < cy + 1) {
        kill(state, events, "ceiling");
        return;
      }
    }
  }

  // 3. 出界（上下左右都判：重力翻转后「上」也是死区）
  if (p.y > state.h + 2 || p.y < -3) {
    kill(state, events, "fall");
    return;
  }
  if (p.x < -1.5 || p.x > state.w + 1.5) {
    kill(state, events, "fall");
  }
}

function kill(state, events, hazard) {
  if (state.phase === "dying") return;
  state.phase = "dying";
  state.phaseTimer = 0;
  state.stats.deaths += 1;
  state.stats.deathsThisRun += 1;
  state.flawless = false;
  const p = state.player;
  // 恶魔脚印：本关重跑保留（死亡纪念碑）
  state.marks.push({
    x: Math.round(p.x * 4) / 4,
    y: findMarkY(state, p.x),
    index: state.stats.deathsThisRun
  });
  events.push({ type: "death", hazard, x: p.x, y: p.y });
}

function findMarkY(state, x) {
  // 把脚印贴到玩家脚下最近的实心格顶面
  const col = Math.floor(x);
  const startRow = Math.floor(state.player.y);
  for (let r = startRow; r < state.h; r++) {
    if (solidAt(state, col, r)) return r;
  }
  return Math.floor(state.player.y);
}

function respawn(state, events) {
  const p = state.player;
  p.x = state.spawn.x;
  p.y = state.spawn.y;
  p.vx = 0;
  p.vy = 0;
  p.onGround = false;
  p.coyote = 0;
  p.jumpBuffer = 0;
  state.phase = "playing";
  state.phaseTimer = 0;
  state.gravityDir = 1;
  state.reverseLeft = 0;
  state.gotCandle = false;
  state.candle.taken = false;
  state.goal.x = state.goal.homeX;
  state.goal.y = state.goal.homeY;
  state.goal.moved = 0;
  state.goal.visible = true;
  // 陷阱复位到关卡初始状态（绝不留下「陷阱已用掉 → 不可解」）
  resetTraps(state);
  events.push({ type: "respawn" });
}

export function resetTraps(state) {
  for (const trap of state.traps) {
    trap.state = "idle";
    trap.timer = 0;
    trap.fade = 0;
    trap.offsetX = 0;
    trap.offsetY = 0;
    trap.extra.revealIdx = 0;
    trap.extra.teleports = 0;
    trap.extra.vanished = false;
    restoreTrapTiles(state, trap);
  }
}

function restoreTrapTiles(state, trap) {
  // 把被陷阱改写的格恢复成初始形态
  switch (trap.kind) {
    case TRAP.COLLAPSE:
    case TRAP.FAKE:
    case TRAP.VANISH:
      setCells(state, trap, T.SOLID);
      break;
    case TRAP.SPIKE:
    case TRAP.GHOSTSPIKE:
      setCells(state, trap, T.EMPTY);
      break;
    default:
      break;
  }
}

function checkWin(state, events) {
  const g = state.goal;
  if (!g.visible) return;
  const p = state.player;
  const dx = Math.abs(p.x - g.x);
  const dy = p.y - g.y;
  if (dx < WIN_OVERLAP + 0.12 && dy > -1.75 && dy < 0.6) {
    state.status = "won";
    state.cleared = true;
    events.push({ type: "win" });
  }
}

// =====================================================================
// 印章（评价体系，不算总分）
// =====================================================================

// 三枚印章：通关印 / 蜡烛印 / 无伤印
export function computeSeals(state) {
  const seals = { clear: false, candle: false, flawless: false };
  if (!state) return seals;
  seals.clear = Boolean(state.cleared);
  seals.candle = Boolean(state.gotCandle);
  seals.flawless = Boolean(state.cleared) && state.stats.deathsThisRun === 0;
  return seals;
}

export function sealCount(seals) {
  if (!seals) return 0;
  return (seals.clear ? 1 : 0) + (seals.candle ? 1 : 0) + (seals.flawless ? 1 : 0);
}

// 节点大印章：本节点 5 关全部 3 印点亮
export function nodeSealLit(sealsByLevel, node) {
  if (!sealsByLevel || !node) return false;
  for (let i = node.from; i <= node.to; i++) {
    if (sealCount(sealsByLevel[i]) < 3) return false;
  }
  return true;
}

// ---- 计时格式化（供 UI 复用，避免各处自算）----
export function formatClock(seconds) {
  const s = Math.max(0, Math.trunc(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

// ---- 黄金路径重放（测试与可解性校验共用）----
// trace: [{ t: 秒, left, right, jump }] —— 按 60Hz 采样，支持确定性复现
//
// 注意：重放必须与「录制时的逐帧推进」严格一致。trace 的 t 常被写成
// 四舍五入后的值（如 0.9667 vs 实际的 0.966666…），若严格用 `t <= now`
// 比较，会因浮点误差把某些帧的输入推迟整整一帧，进而让整条轨迹发散
// （实测可把一条 3.5s 的必胜轨迹变成 163 次死亡）。
//
// 因此这里用「四舍五入半格」的容差：只要输入时间落在当前帧的半帧之内，
// 就认为它属于当前帧。这既容忍毫秒级时间戳精度，又不改变原本精确的语义。
const REPLAY_EPS = 1e-3;

export function replayTrace(level, trace, opts = {}) {
  const dt = opts.dt ?? 1 / 60;
  let state = createInitialState(level, { levelIndex: opts.levelIndex ?? 0 });
  const events = [];
  const totalSec = opts.maxSec ?? 60;
  const frames = Math.ceil(totalSec / dt);
  let cursor = 0;
  for (let f = 0; f < frames; f++) {
    const now = f * dt + REPLAY_EPS;
    while (cursor < trace.length && trace[cursor].t <= now) cursor += 1;
    const cur = cursor > 0 ? trace[cursor - 1] : { left: false, right: false, jump: false };
    const r = stepFrame(state, dt, {
      left: Boolean(cur.left),
      right: Boolean(cur.right),
      jump: Boolean(cur.jump)
    });
    state = r.state;
    for (const ev of r.events) events.push(ev);
    if (state.status === "won") break;
  }
  return { state, events };
}
