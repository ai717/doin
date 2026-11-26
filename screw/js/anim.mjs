/**
 * @file games/screw/js/anim.mjs
 * 纯函数补间/物理动画助手（DOM-free）。
 * 面板坠落采用固定重力加速度 g = 1200 px/s²，供 UI 每帧调用并可在测试中重放。
 */

export const FALL_GRAVITY = 1200;
export const SCREW_FLIGHT_DURATION = 0.38;

export function easeOutCubic(t) {
  const x = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - x, 3);
}

/**
 * 面板只剩一颗螺栓时的铰链目标角（弧度）。
 * 以质心相对支点的方向决定摆向，让整块板自然下垂到侧面。
 */
export function swingTargetAngle(centroid, pivot) {
  const dx = (centroid.c || 0) - (pivot.c || 0);
  const direction = dx >= 0 ? 1 : -1;
  return direction * 1.15;
}

export function createPlateFall(event, startAngle = 0) {
  const seed = (event.plateId || 'p').charCodeAt(0) + (event.layer || 1) * 7;
  return {
    plateId: event.plateId,
    cells: event.cells.map((cell) => ({ c: cell.c, r: cell.r })),
    material: event.material,
    shape: event.shape,
    tone: event.tone || 0,
    layer: event.layer || 1,
    y: 0,
    vy: 0,
    angle: startAngle,
    angularVelocity: (seed % 2 === 0 ? 1 : -1) * (1.1 + (seed % 5) * 0.12),
    alpha: 1,
    life: 0,
    done: false,
  };
}

/** 固定步长推进坠落状态，返回新对象；不修改入参 */
export function stepPlateFall(fall, dt) {
  const step = Math.max(0, Math.min(0.05, Number(dt) || 0));
  const vy = fall.vy + FALL_GRAVITY * step;
  const y = fall.y + vy * step;
  const angle = fall.angle + fall.angularVelocity * step;
  const alpha = y > 760 ? Math.max(0, fall.alpha - step * 1.35) : fall.alpha;
  const life = fall.life + step;
  return {
    ...fall,
    vy,
    y,
    angle,
    alpha,
    life,
    done: y > 1500 || alpha <= 0,
  };
}

export function createScrewFlight({ from, to, color, duration = SCREW_FLIGHT_DURATION }) {
  return {
    color,
    from: { x: from.x, y: from.y },
    to: { x: to.x, y: to.y },
    control: { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 120 },
    t: 0,
    duration: duration > 0 ? duration : SCREW_FLIGHT_DURATION,
    angle: 0,
    done: false,
  };
}

/** 返回新的飞行状态；位置为二次贝塞尔曲线 */
export function stepScrewFlight(flight, dt) {
  const step = Math.max(0, Math.min(0.05, Number(dt) || 0));
  const t = Math.min(1, flight.t + step / flight.duration);
  const e = easeOutCubic(t);
  const inv = 1 - e;
  const x = inv * inv * flight.from.x + 2 * inv * e * flight.control.x + e * e * flight.to.x;
  const y = inv * inv * flight.from.y + 2 * inv * e * flight.control.y + e * e * flight.to.y;
  return {
    ...flight,
    t,
    x,
    y,
    angle: e * Math.PI * 4,
    scale: 1 - e * 0.45,
    done: t >= 1,
  };
}
