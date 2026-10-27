// 森林冰火人 · 核心规则引擎（DOM-free 纯逻辑）
// 绝对禁止访问 window / document / localStorage / Math.random
// 双角色平台跳跃 + 元素相克 + 机关联动，固定步长物理，完全确定性

// ---- 常量 ----
export const TILE = 1; // 1 网格单位
export const COLS_MAX = 24;
export const ROWS_MAX = 14;

export const GRAVITY = 42;        // 重力加速度 (units/s²)
export const MOVE_SPEED = 5.2;    // 平地最大水平速度
export const JUMP_VEL = 13.4;     // 起跳初速度 (跳跃高度 ≈ v²/2g ≈ 2.14 格)
export const MAX_FALL = 18;       // 最大下落速度
export const COYOTE_TIME = 0.09;  // 土狼时间：离台后仍可跳
export const JUMP_BUFFER = 0.12;  // 跳跃预输入缓冲
export const ICE_FRICTION = 0.90; // 冰面滑行保留系数

export const CW = 0.62;           // 角色碰撞宽
export const CH = 0.95;           // 角色碰撞高（略矮于 1 格，可从悬空平台下方走过）

export const CRATE_SIZE = 0.9;    // 箱子宽高
export const FROZEN_DURATION = 3.0; // 冻结桥持续秒数
export const BURN_DURATION = 1.4;  // 藤墙燃烧秒数
export const PORTAL_COOLDOWN = 0.45; // 传送冷却
export const DOOR_KEEP = 1.2;        // 门松板后仍保持开启的秒数（宽容容错）
export const WIN_OVERLAP = 0.4;    // 与出口门判定重叠阈值

// Tile 类型
export const T = {
  EMPTY: 0,
  SOLID: 1,
  ONEWAY: 2,
  MAGMA: 3,
  WATER: 4,
  GOO: 5,
  ICE: 6,
  VINE: 7
};

export const TILE_CHARS = {
  ".": T.EMPTY,
  " ": T.EMPTY,
  "#": T.SOLID,
  "=": T.ONEWAY,
  M: T.MAGMA,
  W: T.WATER,
  G: T.GOO,
  I: T.ICE,
  V: T.VINE
};

// 角色类型
export const KINDS = { FIRE: "fire", ICE: "ice" };

// ---- 状态构建 ----
// level: { w, h, map: number[][], fireX, fireY, iceX, iceY,
//          fireExit:{x,y}, iceExit:{x,y}, gems:[], doors:[], buttons:[],
//          syncPairs:[], crates:[], movers:[], portals:[], freezeSpots:[] }
export function createInitialState(level, options = {}) {
  const state = {
    status: "playing", // playing | won
    elapsed: 0,
    levelIndex: options.levelIndex ?? 0,
    levelName: level.name ?? "",
    w: level.w,
    h: level.h,
    map: level.map.map((row) => row.slice()),
    fireExit: { ...level.fireExit },
    iceExit: { ...level.iceExit },
    fire: {
      kind: KINDS.FIRE,
      x: level.fireX,
      y: level.fireY,
      vx: 0,
      vy: 0,
      onGround: false,
      coyote: 0,
      jumpBuffer: 0,
      facing: 1,
      spawnX: level.fireX,
      spawnY: level.fireY
    },
    ice: {
      kind: KINDS.ICE,
      x: level.iceX,
      y: level.iceY,
      vx: 0,
      vy: 0,
      onGround: false,
      coyote: 0,
      jumpBuffer: 0,
      facing: -1,
      spawnX: level.iceX,
      spawnY: level.iceY
    },
    gems: level.gems.map((g) => ({ ...g, taken: false })),
    doors: level.doors.map((d) => ({
      ...d,
      open: false,
      prevOpen: false,
      keepUntil: -1
    })),
    buttons: level.buttons.map((b) => ({ ...b, pressed: false, prevPressed: false })),
    syncPairs: (level.syncPairs ?? []).map((p) => ({
      a: { ...p.a, pressed: false },
      b: { ...p.b, pressed: false },
      active: false,
      prevActive: false
    })),
    crates: level.crates.map((c) => ({ ...c })),
    movers: (level.movers ?? []).map((m) => ({
      ...m,
      t: 0,
      curX: m.x,
      curY: m.y,
      prevX: m.x,
      prevY: m.y
    })),
    portals: (level.portals ?? []).map((p) => ({ ...p, cd: 0 })),
    freezeSpots: (level.freezeSpots ?? []).map((z) => ({ ...z, frozenUntil: 0 })),
    burning: [], // { col, row, until }
    stats: {
      deaths: 0,
      gems: { red: 0, blue: 0, gold: 0 },
      totalGems: level.gems.length,
      syncCount: 0,
      time: 0
    }
  };
  return state;
}

export function tileAt(state, col, row) {
  if (row < 0 || row >= state.h || col < 0 || col >= state.w) return T.EMPTY;
  return state.map[row][col];
}

// ---- 帧步进 ----
// inputs: { fire:{left,right,jump}, ice:{left,right,jump}, freeze }
// 返回 { state, events }
export function stepFrame(prev, dt, inputs = {}) {
  if (prev.status === "won") {
    return { state: prev, events: [] };
  }

  const state = deepClone(prev);
  const events = [];
  const f = inputs.fire ?? {};
  const i = inputs.ice ?? {};
  const fire = state.fire;
  const ice = state.ice;

  state.elapsed += dt;
  if (state.status === "playing") state.stats.time += dt;

  // 1. 输入 → 跳跃缓冲与土狼时间
  if (f.jump) fire.jumpBuffer = JUMP_BUFFER;
  if (i.jump) ice.jumpBuffer = JUMP_BUFFER;
  if (fire.jumpBuffer > 0) fire.jumpBuffer -= dt;
  if (ice.jumpBuffer > 0) ice.jumpBuffer -= dt;

  // 2. 移动平台推进
  moveMovers(state, dt);
  // 携带站上平台的角色
  carryActors(state);

  // 3. 角色物理
  moveActor(state, fire, { left: !!f.left, right: !!f.right }, dt, events);
  moveActor(state, ice, { left: !!i.left, right: !!i.right }, dt, events);

  // 4. 机关状态更新
  updateSwitches(state, events);

  // 5. 危险判定与重生
  checkHazards(state, events);

  // 6. 宝石收集
  collectGems(state, events);

  // 7. 技能：冻结 / 燃烧
  handleFreeze(state, inputs.freeze, events);
  handleBurning(state, events);

  // 8. 传送门
  handlePortals(state, events);

  // 9. 通关判定
  checkWin(state, events);

  return { state, events };
}

// ---- 移动平台 ----
function moveMovers(state, dt) {
  for (const m of state.movers) {
    m.prevX = m.curX;
    m.prevY = m.curY;
    m.t += dt;
    const period = (2 * m.range) / m.speed;
    const ph = m.t % period;
    const off = ph < m.range / m.speed ? ph * m.speed : period - ph * m.speed;
    if (m.axis === "h") {
      m.curX = m.x + off;
      m.curY = m.y;
    } else {
      m.curX = m.x;
      m.curY = m.y + off;
    }
  }
}

function standingMover(state, actor) {
  const footY = actor.y;
  for (const m of state.movers) {
    const top = m.curY - 0.15;
    const left = m.curX - 0.45;
    const right = m.curX + 0.45;
    if (
      actor.x + CW / 2 > left &&
      actor.x - CW / 2 < right &&
      Math.abs(footY - top) < 0.06
    ) {
      return m;
    }
  }
  return null;
}

function carryActors(state) {
  for (const actor of [state.fire, state.ice]) {
    const m = standingMover(state, actor);
    if (m) {
      actor.x += m.curX - m.prevX;
      actor.y += m.curY - m.prevY;
    }
  }
}

// ---- 角色物理 ----
function actorBox(x, y) {
  return { left: x - CW / 2, right: x + CW / 2, top: y - CH, bottom: y };
}

// 门是否阻挡指定角色
function doorBlocks(state, kind, left, right, top, bottom) {
  for (const d of state.doors) {
    const dLeft = d.x - 0.5;
    const dRight = d.x + 0.5;
    const dTop = d.y - 2.4;
    const dBottom = d.y + 0.1;
    if (left >= dRight || right <= dLeft || top >= dBottom || bottom <= dTop) continue;
    if (!d.open) return true;
    if (d.color === "red" && kind !== KINDS.FIRE) return true;
    if (d.color === "blue" && kind !== KINDS.ICE) return true;
  }
  return false;
}

// 返回阻挡角色水平移动的最近信息
function hitsImmovableX(state, actor, box) {
  const topRow = Math.floor(box.top / TILE);
  const botRow = Math.floor((box.bottom - 0.02) / TILE);
  for (let r = Math.max(0, topRow); r <= Math.min(state.h - 1, botRow); r++) {
    const cL = Math.floor(box.left / TILE);
    const cR = Math.floor((box.right - 0.01) / TILE);
    for (let c = cL; c <= cR; c++) {
      const t = tileAt(state, c, r);
      if (t === T.SOLID || t === T.VINE) return true;
    }
  }
  // 门（关闭或颜色阻挡）
  if (doorBlocks(state, actor.kind, box.left, box.right, box.top, box.bottom)) return true;
  // 箱子视为可推，不在此处理
  return false;
}

function hitsCeiling(state, actor, box) {
  const r = Math.floor(box.top / TILE);
  if (r < 0) return false;
  const cL = Math.floor(box.left / TILE);
  const cR = Math.floor((box.right - 0.01) / TILE);
  for (let c = cL; c <= cR; c++) {
    const t = tileAt(state, c, r);
    if (t === T.SOLID || t === T.VINE) return true;
  }
  if (doorBlocks(state, actor.kind, box.left, box.right, box.top, box.bottom)) return true;
  // 箱子底部（头顶）
  for (const cr of state.crates) {
    const cLeft = cr.x - CRATE_SIZE / 2;
    const cRight = cr.x + CRATE_SIZE / 2;
    const cTop = cr.y - CRATE_SIZE;
    const cBottom = cr.y;
    if (
      box.right > cLeft && box.left < cRight &&
      box.top < cBottom && box.top > cTop - 0.02 &&
      box.bottom > cTop
    ) {
      return true;
    }
  }
  return false;
}

// 找与角色重叠的箱子
function findCrateAt(state, box) {
  for (const cr of state.crates) {
    const cLeft = cr.x - CRATE_SIZE / 2;
    const cRight = cr.x + CRATE_SIZE / 2;
    if (box.right > cLeft && box.left < cRight) return cr;
  }
  return null;
}

// 箱子目标位置是否可推
function canPushCrate(state, crate, dir, kind) {
  const nx = crate.x + dir * TILE;
  const cLeft = nx - CRATE_SIZE / 2;
  const cRight = nx + CRATE_SIZE / 2;
  // 目标行（箱子固定在地面，取箱子底部所在行上方一格）
  const topRow = Math.floor((crate.y - CRATE_SIZE) / TILE);
  const botRow = Math.floor((crate.y - 0.02) / TILE);
  for (let r = Math.max(0, topRow); r <= Math.min(state.h - 1, botRow); r++) {
    const cL = Math.floor(cLeft / TILE);
    const cR = Math.floor((cRight - 0.01) / TILE);
    for (let c = cL; c <= cR; c++) {
      const t = tileAt(state, c, r);
      if (t === T.SOLID || t === T.VINE || t === T.MAGMA || t === T.WATER || t === T.GOO) {
        return false;
      }
    }
  }
  // 门阻挡
  if (doorBlocks(state, kind, cLeft, cRight, crate.y - CRATE_SIZE, crate.y)) return false;
  // 其他箱子
  for (const other of state.crates) {
    if (other === crate) continue;
    if (Math.abs(other.x - nx) < CRATE_SIZE) return false;
  }
  // 目标格下方必须有支撑（防悬空）
  const belowRow = Math.floor(crate.y / TILE) + 1;
  const support1 = tileAt(state, Math.floor(cLeft / TILE), belowRow);
  const support2 = tileAt(state, Math.floor((cRight - 0.01) / TILE), belowRow);
  const supported =
    support1 === T.SOLID || support1 === T.ONEWAY || support2 === T.SOLID || support2 === T.ONEWAY;
  return supported;
}

// 垂直落地检测：返回落地 y 或 null
function groundY(state, actor, prevBottom, box) {
  const r = Math.floor(box.bottom / TILE);
  if (r < 0 || r >= state.h) return null;
  // 脚下列 ±0.05 容差，避免贴平台边缘时漏判
  const cL = Math.floor((box.left - 0.05) / TILE);
  const cR = Math.floor((box.right + 0.05) / TILE);
  for (let c = cL; c <= cR; c++) {
    const t = tileAt(state, c, r);
    if (t === T.SOLID || t === T.VINE || t === T.ICE) return r * TILE;
    if (t === T.ONEWAY && prevBottom <= r * TILE + 0.01) return r * TILE;
  }
  // 箱子顶
  for (const cr of state.crates) {
    const cLeft = cr.x - CRATE_SIZE / 2;
    const cRight = cr.x + CRATE_SIZE / 2;
    const cTop = cr.y - CRATE_SIZE;
    if (
      box.right > cLeft + 0.02 && box.left < cRight - 0.02 &&
      prevBottom <= cTop + 0.02 && box.bottom >= cTop - 0.02
    ) {
      return cTop;
    }
  }
  // 移动平台顶
  for (const m of state.movers) {
    const top = m.curY - 0.15;
    const left = m.curX - 0.45;
    const right = m.curX + 0.45;
    if (
      box.right > left + 0.02 && box.left < right - 0.02 &&
      prevBottom <= top + 0.02 && box.bottom >= top - 0.02
    ) {
      return top;
    }
  }
  // 冻结桥顶（one-way 平台）
  for (const z of state.freezeSpots) {
    if (state.elapsed > z.frozenUntil) continue;
    const zTop = z.y; // 桥顶与地面齐平，冰人可水平走上桥
    const zLeft = z.x - 1.5;
    const zRight = z.x + 1.5;
    if (
      box.right > zLeft + 0.02 && box.left < zRight - 0.02 &&
      prevBottom <= zTop + 0.02 && box.bottom >= zTop - 0.02
    ) {
      return zTop;
    }
  }
  return null;
}

function moveActor(state, actor, input, dt, events) {
  // ---- 水平 ----
  let dir = 0;
  if (input.left) dir -= 1;
  if (input.right) dir += 1;

  const onIce = isOnIce(state, actor);
  if (dir !== 0) {
    actor.facing = dir;
    if (onIce) {
      // 冰面：目标速度线性逼近（低摩擦滑行）
      const target = dir * MOVE_SPEED * 0.72;
      actor.vx += (target - actor.vx) * Math.min(1, dt * 6);
    } else {
      actor.vx = dir * MOVE_SPEED;
    }
  } else {
    if (onIce) {
      actor.vx *= Math.pow(ICE_FRICTION, dt * 60);
      if (Math.abs(actor.vx) < 0.05) actor.vx = 0;
    } else {
      actor.vx = 0;
    }
  }

  const dx = actor.vx * dt;
  if (dx !== 0) moveActorX(state, actor, dx);

  // ---- 跳跃（先于垂直积分） ----
  if (actor.jumpBuffer > 0 && (actor.onGround || actor.coyote > 0)) {
    actor.vy = -JUMP_VEL;
    actor.jumpBuffer = 0;
    actor.coyote = 0;
    actor.onGround = false;
    events.push({ type: "jump", kind: actor.kind });
  }

  // ---- 垂直 ----
  actor.vy = Math.min(MAX_FALL, actor.vy + GRAVITY * dt);
  const dy = actor.vy * dt;
  moveActorY(state, actor, dy, events);

  // ---- 土狼时间 ----
  if (actor.onGround) {
    actor.coyote = COYOTE_TIME;
  } else if (actor.coyote > 0) {
    actor.coyote -= dt;
  }
}

function isOnIce(state, actor) {
  const r = Math.floor((actor.y + 0.05) / TILE);
  if (r < 0 || r >= state.h) return false;
  const cL = Math.floor((actor.x - CW / 2) / TILE);
  const cR = Math.floor((actor.x + CW / 2 - 0.01) / TILE);
  for (let c = cL; c <= cR; c++) {
    if (tileAt(state, c, r) === T.ICE) return true;
  }
  return false;
}

function moveActorX(state, actor, dx) {
  const steps = Math.max(1, Math.ceil(Math.abs(dx) / 0.04));
  const per = dx / steps;
  for (let s = 0; s < steps; s++) {
    const nx = actor.x + per;
    const box = actorBox(nx, actor.y);
    if (hitsImmovableX(state, actor, box)) {
      // 撞墙：回退该步，尝试贴边
      actor.x = snapWallX(state, actor, Math.sign(per), nx);
      actor.vx = 0;
      break;
    }
    const crate = findCrateAt(state, box);
    if (crate) {
      const dir = Math.sign(per);
      if (canPushCrate(state, crate, dir, actor.kind)) {
        crate.x += dir * TILE;
        actor.x = nx;
      } else {
        actor.x = snapWallX(state, actor, dir, actor.x + per);
        actor.vx = 0;
        break;
      }
    } else {
      actor.x = nx;
    }
  }
}

function snapWallX(state, actor, dir, nx) {
  // 沿移动方向贴到最近的 solid/门边缘
  // 用撞墙时的目标位置 nx 计算 box（actor.x 是撞墙前位置，box 可能差一步查不到目标列）
  let x = actor.x;
  const box = actorBox(nx ?? actor.x, actor.y);
  const topRow = Math.floor(box.top / TILE);
  const botRow = Math.floor((box.bottom - 0.02) / TILE);
  if (dir > 0) {
    let min = Infinity;
    for (let r = Math.max(0, topRow); r <= Math.min(state.h - 1, botRow); r++) {
      const c = Math.floor(box.right / TILE);
      const t = tileAt(state, c, r);
      if (t === T.SOLID || t === T.VINE) min = Math.min(min, c * TILE - CW / 2 - 0.01);
    }
    for (const d of state.doors) {
      if (!d.open || (d.color === "red" && actor.kind !== KINDS.FIRE) || (d.color === "blue" && actor.kind !== KINDS.ICE)) {
        if (box.bottom > d.y - 2.2 && box.top < d.y + 0.1) {
          min = Math.min(min, d.x - 0.5 - CW / 2 - 0.01);
        }
      }
    }
    if (min !== Infinity) x = min;
  } else if (dir < 0) {
    let max = -Infinity;
    for (let r = Math.max(0, topRow); r <= Math.min(state.h - 1, botRow); r++) {
      const c = Math.floor(box.left / TILE);
      const t = tileAt(state, c, r);
      if (t === T.SOLID || t === T.VINE) max = Math.max(max, (c + 1) * TILE + CW / 2 + 0.01);
    }
    for (const d of state.doors) {
      if (!d.open || (d.color === "red" && actor.kind !== KINDS.FIRE) || (d.color === "blue" && actor.kind !== KINDS.ICE)) {
        if (box.bottom > d.y - 2.2 && box.top < d.y + 0.1) {
          max = Math.max(max, d.x + 0.5 + CW / 2 + 0.01);
        }
      }
    }
    if (max !== -Infinity) x = max;
  }
  return x;
}

function moveActorY(state, actor, dy, events) {
  if (dy === 0) return;
  const steps = Math.max(1, Math.ceil(Math.abs(dy) / 0.04));
  const per = dy / steps;
  let landed = false;
  for (let s = 0; s < steps; s++) {
    const ny = actor.y + per;
    const box = actorBox(actor.x, ny);
    if (per > 0) {
      const gy = groundY(state, actor, actor.y, box);
      if (gy !== null) {
        actor.y = gy;
        actor.vy = 0;
        actor.onGround = true;
        landed = true;
        break;
      }
    } else {
      if (hitsCeiling(state, actor, box)) {
        // 顶头：吸附到天花板下
        const r = Math.floor(box.top / TILE);
        actor.y = (r + 1) * TILE + CH + 0.01;
        actor.vy = 0;
        break;
      }
    }
    actor.y = ny;
  }
  if (!landed && dy > 0) {
    // 若最终没落地且原本在空中，保持 onGround 状态由下一帧重判
    const box = actorBox(actor.x, actor.y);
    if (groundY(state, actor, actor.y, box) !== null) actor.onGround = true;
  }
}

// ---- 机关 ----
function actorOnButton(state, actor, btn) {
  const bLeft = btn.x - 0.45;
  const bRight = btn.x + 0.45;
  const bTop = btn.y - 0.15;
  const bBottom = btn.y + 0.05;
  return (
    actor.x + CW / 2 > bLeft &&
    actor.x - CW / 2 < bRight &&
    actor.y > bTop &&
    actor.y < bBottom + 0.3
  );
}

function updateSwitches(state, events) {
  // 普通按钮
  for (const b of state.buttons) {
    const pressed = actorOnButton(state, state.fire, b) || actorOnButton(state, state.ice, b);
    if (pressed && !b.pressed) events.push({ type: "plate_down" });
    if (!pressed && b.pressed) events.push({ type: "plate_up" });
    b.pressed = pressed;
  }
  // 同步压力板（两两配对：a 上站一人、b 上站另一人）
  for (const pair of state.syncPairs) {
    const fa = actorOnButton(state, state.fire, pair.a);
    const fi = actorOnButton(state, state.ice, pair.a);
    const ia = actorOnButton(state, state.fire, pair.b);
    const ii = actorOnButton(state, state.ice, pair.b);
    const active = (fa && ii) || (fi && ia);
    if (active && !pair.prevActive) {
      state.stats.syncCount += 1;
      events.push({ type: "plate_down" });
    }
    if (!active && pair.prevActive) events.push({ type: "plate_up" });
    pair.a.pressed = fa || fi;
    pair.b.pressed = ia || ii;
    pair.active = active;
    pair.prevActive = active;
  }
  // 门开关序列：第 i 个门由第 i 个开关控制（普通按钮在前、同步板对在后）
  // 门在踩板后保持开启 DOOR_KEEP 秒，便于穿行容错
  const switchVals = [];
  for (const b of state.buttons) switchVals.push(b.pressed);
  for (const p of state.syncPairs) switchVals.push(p.active);
  state.doors.forEach((d, i) => {
    const sw = switchVals[d.switchIndex ?? i] ?? false;
    if (sw) d.keepUntil = state.elapsed + DOOR_KEEP;
    const open = sw || state.elapsed < d.keepUntil;
    if (open !== d.prevOpen) {
      events.push({ type: open ? "door_open" : "door_close", door: d.color });
    }
    d.open = open;
    d.prevOpen = open;
  });
}

// ---- 危险与重生 ----
function checkHazards(state, events) {
  for (const actor of [state.fire, state.ice]) {
    const hazard = hazardAt(state, actor);
    if (hazard) {
      events.push({ type: "death", kind: actor.kind, hazard });
      respawn(state, actor);
    }
  }
}

// 冻结桥覆盖的危格（桥顶与地面齐平，站在冻结岩浆/水格上安全）
function isFrozenCover(state, c, r) {
  for (const z of state.freezeSpots) {
    if (state.elapsed > z.frozenUntil) continue;
    const zLeft = z.x - 1.5;
    const zRight = z.x + 1.5;
    const zRow = Math.floor(z.y);
    if (r === zRow && c + 0.5 > zLeft && c + 0.5 < zRight) return true;
  }
  return false;
}

function hazardAt(state, actor) {
  const cx = Math.floor(actor.x / TILE);
  const cy = Math.floor((actor.y - CH * 0.5) / TILE);
  const by = Math.floor((actor.y + 0.05) / TILE);
  for (const [c, r] of [[cx, by], [cx, cy]]) {
    if (isFrozenCover(state, c, r)) continue;
    const t = tileAt(state, c, r);
    if (t === T.GOO) return "goo";
    if (t === T.MAGMA && actor.kind !== KINDS.FIRE) return "magma";
    if (t === T.WATER && actor.kind !== KINDS.ICE) return "water";
  }
  if (actor.y > state.h * TILE + 2) return "fall";
  return null;
}

// ---- 危险与重生 ----
function respawn(state, actor) {
  actor.x = actor.spawnX;
  actor.y = actor.spawnY;
  actor.vx = 0;
  actor.vy = 0;
  actor.onGround = false;
  actor.coyote = 0;
  actor.jumpBuffer = 0;
  state.stats.deaths += 1;
}

// ---- 深拷贝（纯逻辑，无外部依赖）----
function deepClone(o) {
  if (o === null || typeof o !== "object") return o;
  if (Array.isArray(o)) return o.map(deepClone);
  const out = {};
  for (const k of Object.keys(o)) out[k] = deepClone(o[k]);
  return out;
}

// ---- 宝石收集 ----
function collectGems(state, events) {
  for (let i = state.gems.length - 1; i >= 0; i--) {
    const g = state.gems[i];
    for (const actor of [state.fire, state.ice]) {
      const dx = Math.abs(actor.x - g.x);
      const dy = Math.abs(actor.y - g.y);
      if (dx < 0.9 && dy < 0.95) {
        state.stats.gems[g.kind] += 1;
        events.push({ type: "gem", kind: g.kind, x: g.x, y: g.y });
        state.gems.splice(i, 1);
        break;
      }
    }
  }
}

// ---- 技能：冻结 ----
function handleFreeze(state, freezePressed, events) {
  if (!freezePressed) return;
  const ice = state.ice;
  for (const z of state.freezeSpots) {
    const zLeft = z.x - 0.5;
    const zRight = z.x + 0.5;
    const zTop = z.y - 0.5;
    const zBottom = z.y + 0.4;
    if (
      ice.x + CW / 2 > zLeft &&
      ice.x - CW / 2 < zRight &&
      ice.y > zTop &&
      ice.y - CH < zBottom
    ) {
      if (state.elapsed > z.frozenUntil) {
        events.push({ type: "freeze", x: z.x, y: z.y });
      }
      z.frozenUntil = state.elapsed + FROZEN_DURATION;
    }
  }
}

// ---- 技能：燃烧（火人点燃藤墙开路，火焰持续 BURN_DURATION）----
function handleBurning(state, events) {
  const remaining = [];
  for (const b of state.burning) {
    if (state.elapsed >= b.until) {
      events.push({ type: "burn_out", col: b.col, row: b.row });
    } else {
      remaining.push(b);
    }
  }
  state.burning = remaining;
  const f = state.fire;
  const c0 = Math.floor((f.x - CW * 0.5 - 0.02) / TILE);
  const c1 = Math.floor((f.x + CW * 0.5 + 0.02) / TILE);
  const r0 = Math.floor((f.y - CH + 0.02) / TILE);
  const r1 = Math.floor((f.y + 0.02) / TILE);
  for (let c = c0; c <= c1; c++) {
    for (let r = r0; r <= r1; r++) {
      if (r >= 0 && r < state.h && c >= 0 && c < state.w && state.map[r][c] === T.VINE) {
        state.map[r][c] = T.EMPTY; // 点燃瞬间烧毁开路
        state.burning.push({ col: c, row: r, until: state.elapsed + BURN_DURATION });
        events.push({ type: "burn", col: c, row: r });
      }
    }
  }
}

// ---- 传送门 ----
function handlePortals(state, events) {
  for (const p of state.portals) {
    if (state.elapsed < p.cooldownUntil) continue;
    const twin = state.portals.find((q) => q.id === p.pairId);
    if (!twin) continue;
    for (const actor of [state.fire, state.ice]) {
      const dx = Math.abs(actor.x - p.x);
      const dy = Math.abs(actor.y - p.y);
      if (dx < 0.55 && dy < 1.2) {
        actor.x = twin.x + 0.9; // 传送到配对门右侧（落点 +0.9，避免原地卡触发）
        actor.y = twin.y;
        actor.vx = 0;
        actor.vy = 0;
        p.cooldownUntil = state.elapsed + PORTAL_COOLDOWN;
        twin.cooldownUntil = state.elapsed + PORTAL_COOLDOWN;
        events.push({ type: "portal", kind: actor.kind, x: twin.x, y: twin.y });
      }
    }
  }
}

// ---- 通关判定：双人同时到达各自出口 ----
function checkWin(state, events) {
  const fe = state.fireExit;
  const ie = state.iceExit;
  const fireOk =
    Math.abs(state.fire.x - fe.x) < WIN_OVERLAP + 0.2 &&
    state.fire.y > fe.y - 1.6 &&
    state.fire.y < fe.y + 1.6;
  const iceOk =
    Math.abs(state.ice.x - ie.x) < WIN_OVERLAP + 0.2 &&
    state.ice.y > ie.y - 1.6 &&
    state.ice.y < ie.y + 1.6;
  if (fireOk && iceOk) {
    state.status = "won";
    events.push({ type: "won" });
  }
}

// ---- 星级 ----
export function computeStars(stats) {
  const got = stats.gems.red + stats.gems.blue + stats.gems.gold;
  if (stats.totalGems > 0 && got >= stats.totalGems && stats.deaths === 0) return 3;
  if (stats.totalGems > 0 && got >= stats.totalGems) return 2;
  return 1;
}
