// engine：Line Ride 物理模拟唯一权威，DOM-free。
// 固定步长 stepFrame(state, dt) 推进物理，applyIntent(state, intent) 处理 UI 意图。
// 不碰 document/window/localStorage，只用纯函数。
// rng 可注入（测试用），默认 Math.random。

// —— 常量 ——
export const GRAVITY = 980;            // px/s² 重力加速度
export const CONTACT_THRESHOLD = 8;    // 线接触判定距离（简化宽容）
export const LANDING_ANGLE_TOLERANCE = 80; // 落地角度容差（度）
export const MAX_SPEED = 2000;         // 速度上限 px/s
export const FRICTION = {
  normal: 0.05,   // 普通线摩擦
  boost: 0.05,    // 加速线摩擦（同普通）
  slow: 0.25,     // 减速线高摩擦
  scenery: 0,     // 布景线无碰撞
};
export const BOOST_THRUST = 50;        // 加速线额外推力 px/s²
export const STEP_DT = 1 / 60;         // 固定物理步长
export const RIDER_RADIUS = 6;         // 小人碰撞半径
export const STROKE_MIN_STEP = 8;      // 笔画采样最小间距（世界坐标 px）
export const STROKE_SUBDIV = 3;        // Catmull-Rom 每段细分数
export const SAFE_POINT_STEP = 24;     // 最近安全点的记录间距（px）

export const LINE_TYPES = Object.freeze(["normal", "boost", "slow", "scenery"]);
export const PLAY_STATES = Object.freeze(["stopped", "playing", "paused"]);
export const MODES = Object.freeze(["freestyle", "puzzle"]);

// —— 工具函数 ——
export function createRNG(seed) {
  let s = seed | 0;
  return function mulberry32() {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function dist(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function dot(ax, ay, bx, by) {
  return ax * bx + ay * by;
}

// 点到线段最近点
export function closestPointOnSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { x: x1, y: y1, t: 0 };
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = clamp(t, 0, 1);
  return { x: x1 + t * dx, y: y1 + t * dy, t };
}

// 线段夹角（弧度，相对于水平）
function segmentAngle(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

// 速度方向与线切线夹角（度）
function angleBetweenVectors(vx, vy, tx, ty) {
  const magV = Math.sqrt(vx * vx + vy * vy);
  const magT = Math.sqrt(tx * tx + ty * ty);
  if (magV === 0 || magT === 0) return 0;
  const cosA = clamp((vx * tx + vy * ty) / (magV * magT), -1, 1);
  return Math.acos(cosA) * 180 / Math.PI;
}

// —— 状态创建 ——

/** 创建初始游戏状态 */
export function createState(options = {}) {
  const { mode = "freestyle", puzzleId = 0, rng = null } = options;
  return {
    mode,
    puzzleId,
    lines: [],           // [{x1,y1,x2,y2,type}]
    rider: { x: 100, y: 100, vx: 0, vy: 0, angle: 0, onTrack: false },
    riderAlive: true,
    playState: "stopped", // stopped | playing | paused
    simTime: 0,
    startMarker: null,   // {x,y} 起点标记
    finishMarker: null,  // {x,y} 终点标记（拼图模式）
    stars: [],           // [{x,y,collected}] 星标
    undoStack: [],       // 撤销栈（每项是 lines 快照 JSON）
    viewOffset: { x: 0, y: 0 },
    viewScale: 1,
    activeLineType: "normal",
    stroke: null,        // 正在画的一笔 {type, points:[], startIndex, segCount}
    lastSafe: null,      // 最近的安全接触点 {x,y}（摔落后重生用）
    events: [],          // 本帧事件
    puzzleProgress: {},  // { puzzleId: { stars, completed } }
    inkUsed: 0,          // 拼图模式墨水用量
    inkLimit: 0,         // 拼图模式墨水配额
    rng: rng || Math.random,
  };
}

// —— 线段操作 ——

/** 创建一条线段 */
export function createSegment(x1, y1, x2, y2, type = "normal") {
  return { x1, y1, x2, y2, type };
}

/** 线段长度 */
export function segmentLength(seg) {
  return dist(seg.x1, seg.y1, seg.x2, seg.y2);
}

/** 添加线段到状态 */
export function addLine(state, seg) {
  if (seg.type === "scenery") {
    state.lines.push(seg);
    return;
  }
  // 碰撞线：先记录快照再添加，撤销时才能恢复到添加前的状态
  pushUndo(state);
  state.lines.push(seg);
}

/** 撤销上一步 */
export function pushUndo(state) {
  state.undoStack.push(JSON.stringify(state.lines));
  if (state.undoStack.length > 50) state.undoStack.shift();
}

export function undo(state) {
  if (state.undoStack.length === 0) return false;
  const prev = state.undoStack.pop();
  state.lines = JSON.parse(prev);
  return true;
}

/** 橡皮擦：删除与圆形区域相交的线段 */
export function eraseAt(state, cx, cy, radius = 10) {
  const r2 = radius * radius;
  // 先算结果再决定：快照必须记在删除「之前」，否则撤销会回到已擦除的状态
  const kept = state.lines.filter(seg => {
    const cp = closestPointOnSegment(cx, cy, seg.x1, seg.y1, seg.x2, seg.y2);
    const d2 = (cp.x - cx) ** 2 + (cp.y - cy) ** 2;
    return d2 > r2;
  });
  if (kept.length === state.lines.length) return false;
  pushUndo(state);
  state.lines = kept;
  return true;
}

// —— 笔画：连续采样 + Catmull-Rom 平滑 ——

/** 单点 Catmull-Rom 插值（uniform，tension 0.5） */
function catmullRomPoint(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

/** 把折线点序列平滑为曲线点序列；点数 < 3 时原样返回 */
export function smoothCatmullRom(points, subdiv = STROKE_SUBDIV) {
  if (!Array.isArray(points) || points.length < 3) return points.slice();
  const n = points.length;
  const out = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || points[i + 1];
    for (let s = 0; s < subdiv; s++) {
      out.push(catmullRomPoint(p0, p1, p2, p3, s / subdiv));
    }
  }
  out.push(points[n - 1]);
  return out;
}

/** 点序列 -> 线段数组 */
export function pointsToSegments(points, type) {
  const segs = [];
  for (let i = 0; i < points.length - 1; i++) {
    segs.push({
      x1: points[i].x, y1: points[i].y,
      x2: points[i + 1].x, y2: points[i + 1].y,
      type,
    });
  }
  return segs;
}

export function polylineLength(points) {
  let len = 0;
  for (let i = 0; i < points.length - 1; i++) {
    len += dist(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
  }
  return len;
}

/** 开始一笔（撤销快照在此刻推入，撤销粒度 = 一整笔） */
export function beginStroke(state, x, y, type = state.activeLineType) {
  pushUndo(state);
  state.stroke = {
    type,
    points: [{ x, y }],
    startIndex: state.lines.length,
    segCount: 0,
  };
  return state.stroke;
}

/** 追加采样点：距上一点 >= STROKE_MIN_STEP 才成段，天然去掉鼠标抖动 */
export function addStrokePoint(state, x, y) {
  const st = state.stroke;
  if (!st) return false;
  const last = st.points[st.points.length - 1];
  if (dist(last.x, last.y, x, y) < STROKE_MIN_STEP) return false;
  const prev = { x: last.x, y: last.y };
  st.points.push({ x, y });
  state.lines.push({ x1: prev.x, y1: prev.y, x2: x, y2: y, type: st.type });
  st.segCount++;
  return true;
}

/**
 * 结束一笔：平滑整笔并替换该笔的段。
 * 拼图模式下墨水不足则整笔回滚，返回 { ok:false, reason:"ink-out" }。
 */
export function endStroke(state) {
  const st = state.stroke;
  if (!st) return { ok: false, reason: "no-stroke" };
  state.stroke = null;

  // 只点了一下：撤销这一笔的快照，避免留下空撤销步
  if (st.points.length < 2) {
    if (state.undoStack.length) state.undoStack.pop();
    return { ok: false, reason: "too-short" };
  }

  const smoothed = smoothCatmullRom(st.points, STROKE_SUBDIV);
  const segs = pointsToSegments(smoothed, st.type);
  state.lines.splice(st.startIndex, st.segCount, ...segs);

  const length = polylineLength(smoothed);
  if (state.mode === "puzzle" && st.type !== "scenery") {
    if (state.inkUsed + length > state.inkLimit) {
      // 墨水不足 → 整笔回滚到落笔前
      state.lines.splice(st.startIndex, segs.length);
      if (state.undoStack.length) state.undoStack.pop();
      return { ok: false, reason: "ink-out", length };
    }
    state.inkUsed += length;
  }
  return { ok: true, length, segments: segs.length };
}

/** 取消当前一笔（不留下任何痕迹） */
export function cancelStroke(state) {
  const st = state.stroke;
  if (!st) return false;
  state.lines.splice(st.startIndex, st.segCount);
  if (state.undoStack.length) state.undoStack.pop();
  state.stroke = null;
  return true;
}

// —— 物理核心 ——

/** 粗筛：包围盒（含容差）是否可能命中，避免逐段精算 */
function segmentNear(seg, x, y, radius) {
  const minX = Math.min(seg.x1, seg.x2) - radius;
  const maxX = Math.max(seg.x1, seg.x2) + radius;
  if (x < minX || x > maxX) return false;
  const minY = Math.min(seg.y1, seg.y2) - radius;
  const maxY = Math.max(seg.y1, seg.y2) + radius;
  return !(y < minY || y > maxY);
}

/** 查找小人所在的轨道线段 */
function findTrackSegment(state) {
  const { x, y } = state.rider;
  let best = null;
  let bestDist = Infinity;
  for (const seg of state.lines) {
    if (seg.type === "scenery") continue;
    if (!segmentNear(seg, x, y, CONTACT_THRESHOLD)) continue;
    const cp = closestPointOnSegment(x, y, seg.x1, seg.y1, seg.x2, seg.y2);
    const d = dist(x, y, cp.x, cp.y);
    if (d < CONTACT_THRESHOLD && d < bestDist) {
      best = { seg, d, cp };
      bestDist = d;
    }
  }
  return best;
}

/** 检测星标收集 */
function checkStars(state) {
  for (let i = state.stars.length - 1; i >= 0; i--) {
    const s = state.stars[i];
    if (s.collected) continue;
    if (dist(state.rider.x, state.rider.y, s.x, s.y) < 15) {
      s.collected = true;
      state.events.push({ type: "star-collected", index: i });
    }
  }
}

/** 检测到达终点 */
function checkFinish(state) {
  if (!state.finishMarker) return;
  if (dist(state.rider.x, state.rider.y, state.finishMarker.x, state.finishMarker.y) < 25) {
    state.events.push({ type: "finished" });
    state.playState = "stopped";
  }
}

/** 主物理步进：固定 dt */
export function stepFrame(state, dt = STEP_DT) {
  if (state.playState !== "playing") return;
  if (!state.riderAlive) return;

  const rider = state.rider;
  const track = findTrackSegment(state);

  if (track) {
    // 在轨道上 → 滑行
    rider.onTrack = true;
    const seg = track.seg;
    const angle = segmentAngle(seg.x1, seg.y1, seg.x2, seg.y2);
    const cosA = Math.cos(angle), sinA = Math.sin(angle);

    // 吸附到线上
    rider.x = track.cp.x;
    rider.y = track.cp.y;

    // 将速度分解为切向和法向
    const speedTangential = rider.vx * cosA + rider.vy * sinA;
    // 法向吸收
    rider.vx = speedTangential * cosA;
    rider.vy = speedTangential * sinA;

    // 重力沿切线分量：(0, +G) 点乘切线 (cosA, sinA) = G·sinA
    // y 轴向下为正，所以下坡（sinA>0）加速、上坡（sinA<0）减速。
    const gravTangential = GRAVITY * sinA;

    // 摩擦力
    let friction = FRICTION[seg.type] || FRICTION.normal;
    let frictionForce = -Math.sign(speedTangential) * friction * GRAVITY * Math.abs(cosA);

    // 加速线额外推力
    let boostForce = 0;
    if (seg.type === "boost") {
      boostForce = BOOST_THRUST * Math.sign(cosA >= 0 ? 1 : -1); // 沿轨道方向
    }

    // 应用加速度
    const accelTangential = gravTangential + frictionForce + boostForce;
    const newSpeed = speedTangential + accelTangential * dt;
    rider.vx = newSpeed * cosA;
    rider.vy = newSpeed * sinA;

    rider.angle = angle;

    // 更新位置（沿轨道）
    rider.x += rider.vx * dt;
    rider.y += rider.vy * dt;

    // 记录在轨安全点（节流，供摔落后重生）
    if (!state.lastSafe || dist(state.lastSafe.x, state.lastSafe.y, rider.x, rider.y) >= SAFE_POINT_STEP) {
      state.lastSafe = { x: rider.x, y: rider.y };
    }

  } else {
    // 在空中 → 自由落体
    rider.onTrack = false;
    rider.vy += GRAVITY * dt; // 重力
    rider.x += rider.vx * dt;
    rider.y += rider.vy * dt;

    // 角度随速度方向变化
    if (Math.abs(rider.vx) > 0.1 || Math.abs(rider.vy) > 0.1) {
      rider.angle = Math.atan2(rider.vy, rider.vx);
    }

    // 落地检测
    const landingTrack = findTrackSegment(state);
    if (landingTrack) {
      const seg = landingTrack.seg;
      const segAng = segmentAngle(seg.x1, seg.y1, seg.x2, seg.y2);
      const cosA = Math.cos(segAng), sinA = Math.sin(segAng);
      const impactAngle = angleBetweenVectors(rider.vx, rider.vy, cosA, sinA);

      if (impactAngle < LANDING_ANGLE_TOLERANCE) {
        // 安全落地
        rider.onTrack = true;
        rider.x = landingTrack.cp.x;
        rider.y = landingTrack.cp.y;
      } else {
        // 摔落
        state.riderAlive = false;
        state.events.push({ type: "crashed", reason: "hard-landing" });
      }
    }
  }

  // 速度钳制
  const speed = Math.sqrt(rider.vx ** 2 + rider.vy ** 2);
  if (speed > MAX_SPEED) {
    const scale = MAX_SPEED / speed;
    rider.vx *= scale;
    rider.vy *= scale;
  }

  // 边界检测：掉出画布
  if (rider.y > 5000 || rider.y < -2000 || rider.x < -1000 || rider.x > 10000) {
    state.riderAlive = false;
    state.events.push({ type: "crashed", reason: "out-of-bounds" });
  }

  state.simTime += dt;

  // 收集星标与终点检测
  checkStars(state);
  checkFinish(state);
}

/** 摔落后重生：回到最近的安全接触点（没有则回起点），速度归零 */
export function respawn(state) {
  const target = state.lastSafe || state.startMarker
    || (state.lines.find(l => l.type !== "scenery") || null);
  if (target) {
    state.rider.x = target.x ?? target.x1 ?? state.rider.x;
    state.rider.y = target.y ?? target.y1 ?? state.rider.y;
  }
  state.rider.vx = 0;
  state.rider.vy = 0;
  state.rider.onTrack = false;
  state.riderAlive = true;
  return state.rider;
}

// —— 意图处理 ——

/** 处理用户操作意图 */
export function applyIntent(state, intent) {
  switch (intent.type) {
    case "play":
      if (state.playState === "stopped" || state.playState === "paused") {
        state.playState = "playing";
        state.riderAlive = true;
        state.lastSafe = null;
        // 从起点出发
        if (state.startMarker) {
          state.rider.x = state.startMarker.x;
          state.rider.y = state.startMarker.y;
          state.rider.vx = 0;
          state.rider.vy = 0;
          state.rider.angle = 0;
          state.rider.onTrack = false;
        } else if (state.lines.length > 0) {
          // 默认起点：第一条非布景线的起点
          const first = state.lines.find(l => l.type !== "scenery");
          if (first) {
            state.rider.x = first.x1;
            state.rider.y = first.y1;
            state.rider.vx = 0;
            state.rider.vy = 0;
            state.rider.angle = segmentAngle(first.x1, first.y1, first.x2, first.y2);
            state.rider.onTrack = false;
          }
        }
      }
      return true;

    case "pause":
      if (state.playState === "playing") {
        state.playState = "paused";
      }
      return true;

    case "stop":
      state.playState = "stopped";
      state.riderAlive = true;
      state.simTime = 0;
      state.events = [];
      // 重置星标
      state.stars.forEach(s => s.collected = false);
      return true;

    case "reset-rider":
      state.riderAlive = true;
      state.lastSafe = null;
      state.events = [];
      state.stars.forEach(s => s.collected = false);
      if (state.startMarker) {
        state.rider.x = state.startMarker.x;
        state.rider.y = state.startMarker.y;
        state.rider.vx = 0;
        state.rider.vy = 0;
        state.rider.angle = 0;
        state.rider.onTrack = false;
      }
      return true;

    case "set-line-type":
      if (LINE_TYPES.includes(intent.lineType)) {
        state.activeLineType = intent.lineType;
      }
      return true;

    case "draw-line":
      if (intent.segment) {
        const seg = intent.segment;
        addLine(state, seg);
        // 拼图模式墨水消耗
        if (state.mode === "puzzle" && seg.type !== "scenery") {
          state.inkUsed += segmentLength(seg);
        }
        return true;
      }
      return false;

    case "erase":
      return eraseAt(state, intent.x, intent.y, intent.radius || 10);

    case "undo":
      return undo(state);

    case "set-start":
      state.startMarker = { x: intent.x, y: intent.y };
      return true;

    case "set-finish":
      state.finishMarker = { x: intent.x, y: intent.y };
      return true;

    case "clear-all":
      state.lines = [];
      state.undoStack = [];
      state.stroke = null;
      state.lastSafe = null;
      state.rider.x = 100;
      state.rider.y = 100;
      state.rider.vx = 0;
      state.rider.vy = 0;
      state.riderAlive = true;
      state.playState = "stopped";
      state.simTime = 0;
      state.startMarker = null;
      state.finishMarker = null;
      state.stars = [];
      state.events = [];
      state.inkUsed = 0;
      return true;

    case "set-view":
      if (intent.offset) state.viewOffset = intent.offset;
      if (intent.scale) state.viewScale = clamp(intent.scale, 0.1, 5);
      return true;

    case "zoom":
      state.viewScale = clamp(state.viewScale * (intent.factor || 1), 0.1, 5);
      return true;

    default:
      return false;
  }
}

// —— 拼图模式辅助 ——

/** 加载拼图关卡 */
export function loadPuzzle(state, puzzleData) {
  state.mode = "puzzle";
  state.puzzleId = puzzleData.id;
  state.lines = (puzzleData.track || []).map(s => ({ ...s }));
  state.startMarker = puzzleData.start || null;
  state.finishMarker = puzzleData.finish || null;
  state.stars = (puzzleData.stars || []).map(s => ({ ...s, collected: false }));
  state.inkLimit = puzzleData.inkLimit || 800;
  state.inkUsed = 0;
  state.playState = "stopped";
  state.riderAlive = true;
  state.simTime = 0;
  state.events = [];
  state.undoStack = [];
  state.stroke = null;
  state.lastSafe = null;
  state.viewOffset = { x: 0, y: 0 };
  state.viewScale = 1;

  // 设置初始位置
  if (state.startMarker) {
    state.rider.x = state.startMarker.x;
    state.rider.y = state.startMarker.y;
    state.rider.vx = 0;
    state.rider.vy = 0;
    state.rider.angle = 0;
    state.rider.onTrack = false;
  }
  return state;
}

/** 计算拼图通关星级 */
export function calcPuzzleStars(state) {
  const stars = [];
  // 星1：到达终点
  stars.push(state.events.some(e => e.type === "finished"));
  // 星2：收集全部星标
  stars.push(state.stars.length > 0 && state.stars.every(s => s.collected));
  // 星3：步数/墨水限制内完成（用 inkUsed ≤ inkLimit 的 70%）
  if (state.inkLimit > 0) {
    stars.push(state.inkUsed <= state.inkLimit * 0.7);
  } else {
    stars.push(false);
  }
  const count = stars.filter(Boolean).length;
  return { stars: count, details: stars };
}

// —— 自由画布辅助 ——

/** 导出画布为 JSON */
export function exportCanvas(state) {
  return JSON.stringify({
    version: 1,
    lines: state.lines,
    startMarker: state.startMarker,
  });
}

/** 从 JSON 导入画布 */
export function importCanvas(state, json) {
  try {
    const data = JSON.parse(json);
    if (!data || data.version !== 1) return false;
    state.lines = data.lines || [];
    state.startMarker = data.startMarker || null;
    state.undoStack = [];
    state.events = [];
    return true;
  } catch {
    return false;
  }
}