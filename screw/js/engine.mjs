/**
 * @file games/screw/js/engine.mjs
 * 拧螺丝解谜 · 规则唯一权威（纯函数 / 严格 DOM-free）
 *
 * 盘面模型：
 *   - 8×8 打孔背板，板材由一组正交网格单元（polyomino）构成；
 *   - 每块板材有若干螺孔，孔内螺栓颜色固定，螺栓旋入背板把板材压住；
 *   - 板材剩余螺栓数 >= 2 时静止遮挡下层；== 1 时以剩余螺栓为铰链摆开，不再遮挡；
 *   - == 0 时整块板材在重力下脱落；
 *   - 顶部收纳盒每次只收集一种颜色，每盒 3 颗；不符合当前盒颜色的螺栓只能暂存底部备用孔；
 *   - 备用孔被占满且没有可拧下的当前盒颜色螺栓 => 死锁。
 */

export const STATUS = {
  PLAYING: 'playing',
  WON: 'won',
  LOST: 'lost',
};

export const PLATE_STATE = {
  ANCHORED: 'anchored',
  SWINGING: 'swinging',
  GONE: 'gone',
};

export const COLORS = ['red', 'yellow', 'blue', 'green', 'purple'];

export const BOX_SIZE = 3;

/** 确定性伪随机数生成器（供系统随机游走测试与关卡生成使用） */
export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cloneCell(cell) {
  return { c: cell.c, r: cell.r };
}

function cellEquals(a, b) {
  return a.c === b.c && a.r === b.r;
}

export function screwKey(plateId, index) {
  return `${plateId}-${index}`;
}

/** 从关卡数据构造一局全新的权威状态 */
export function createState(level) {
  const plates = [];
  const screws = [];

  for (const raw of level.plates) {
    const plate = {
      id: raw.id,
      layer: raw.layer,
      material: raw.material || 'wood',
      shape: raw.shape || 'bar',
      tone: raw.tone || 0,
      cells: raw.cells.map(([c, r]) => ({ c, r })),
      holes: raw.holes.map(([c, r, color]) => ({ c, r, color })),
      screwIds: [],
    };
    raw.holes.forEach(([c, r, color], index) => {
      const id = screwKey(raw.id, index);
      plate.screwIds.push(id);
      screws.push({
        id,
        plateId: raw.id,
        color,
        cell: { c, r },
        state: 'board',
      });
    });
    plates.push(plate);
  }

  const state = {
    levelId: level.id,
    plates,
    screws,
    boxes: level.boxQueue.map((color) => ({ color, collected: 0, complete: false })),
    activeBox: 0,
    buffer: [],
    bufferCapacity: level.bufferCapacity,
    magnetUsed: false,
    moves: 0,
    undos: 0,
    status: STATUS.PLAYING,
    events: [],
  };

  state.status = evaluateStatus(state);
  state.events = [];
  return state;
}

/** 深拷贝引擎状态（撤销栈与求解沙盒共用） */
export function cloneState(state) {
  return {
    levelId: state.levelId,
    plates: state.plates.map((plate) => ({
      id: plate.id,
      layer: plate.layer,
      material: plate.material,
      shape: plate.shape,
      tone: plate.tone,
      cells: plate.cells.map(cloneCell),
      holes: plate.holes.map(cloneCell),
      screwIds: [...plate.screwIds],
    })),
    screws: state.screws.map((screw) => ({
      id: screw.id,
      plateId: screw.plateId,
      color: screw.color,
      cell: cloneCell(screw.cell),
      state: screw.state,
    })),
    boxes: state.boxes.map((box) => ({ ...box })),
    activeBox: state.activeBox,
    buffer: [...state.buffer],
    bufferCapacity: state.bufferCapacity,
    magnetUsed: state.magnetUsed,
    moves: state.moves,
    undos: state.undos,
    status: state.status,
    events: [],
  };
}

// ---------- 查询 ----------

export function screwById(state, screwId) {
  return state.screws.find((screw) => screw.id === screwId) || null;
}

export function plateById(state, plateId) {
  return state.plates.find((plate) => plate.id === plateId) || null;
}

export function remainingScrewsOnPlate(state, plateId) {
  return state.screws.filter((screw) => screw.plateId === plateId && screw.state === 'board').length;
}

export function plateStatus(state, plateId) {
  const remaining = remainingScrewsOnPlate(state, plateId);
  if (remaining <= 0) return PLATE_STATE.GONE;
  if (remaining === 1) return PLATE_STATE.SWINGING;
  return PLATE_STATE.ANCHORED;
}

export function activeBox(state) {
  return state.boxes[state.activeBox] || null;
}

export function currentBoxColor(state) {
  const box = activeBox(state);
  return box ? box.color : null;
}

function plateCoversCell(plate, cell) {
  return plate.cells.some((owned) => cellEquals(owned, cell));
}

/**
 * 螺栓是否可被拧下：
 *  - 必须仍在盘面上；
 *  - 不能被任何「更高层且仍有 >=2 颗螺栓（静止遮挡）」的板材盖住螺帽；
 *  - 只剩 1 颗螺栓的板材已经摆开，不再遮挡。
 */
export function isScrewAccessible(state, screwId) {
  const screw = screwById(state, screwId);
  if (!screw || screw.state !== 'board') return false;

  const home = plateById(state, screw.plateId);
  if (!home) return false;
  if (remainingScrewsOnPlate(state, home.id) <= 0) return false;

  for (const other of state.plates) {
    if (other.id === home.id) continue;
    if (other.layer <= home.layer) continue;
    if (remainingScrewsOnPlate(state, other.id) < 2) continue;
    if (plateCoversCell(other, screw.cell)) return false;
  }
  return true;
}

export function listAccessibleScrews(state) {
  return state.screws.filter((screw) => isScrewAccessible(state, screw.id));
}

/** 该螺栓能否立即旋入当前收纳盒（颜色匹配且盒未满） */
export function matchesActiveBox(state, screw) {
  const box = activeBox(state);
  return Boolean(box && box.color === screw.color && box.collected < BOX_SIZE);
}

export function canUnscrew(state, screwId) {
  if (state.status !== STATUS.PLAYING) return false;
  const screw = screwById(state, screwId);
  if (!screw || !isScrewAccessible(state, screwId)) return false;
  if (matchesActiveBox(state, screw)) return true;
  return state.buffer.length < state.bufferCapacity;
}

export function canUseMagnet(state, screwId) {
  if (state.magnetUsed || state.status === STATUS.WON) return false;
  return isScrewAccessible(state, screwId);
}

/** 是否存在任何合法操作（用于死锁判定） */
export function hasLegalMove(state) {
  const box = activeBox(state);
  const accessible = listAccessibleScrews(state);
  if (!accessible.length) return false;
  if (box) {
    if (accessible.some((screw) => matchesActiveBox(state, screw))) return true;
  }
  return state.buffer.length < state.bufferCapacity;
}

export function evaluateStatus(state) {
  if (state.screws.every((screw) => screw.state !== 'board')) {
    return STATUS.WON;
  }
  if (!hasLegalMove(state)) return STATUS.LOST;
  return STATUS.PLAYING;
}

// ---------- 内部推进 ----------

function completeCurrentBox(state, events) {
  const box = activeBox(state);
  if (!box || box.collected < BOX_SIZE) return;
  box.complete = true;
  events.push({ type: 'box_complete', boxIndex: state.activeBox, color: box.color });
  state.activeBox += 1;
}

/**
 * 新收纳盒进入后，备用孔中的同色螺栓自动依次吸入。
 * 若连续装满多盒，会继续推进并继续吸入。
 */
export function fillBoxesFromBuffer(state, events = []) {
  let guard = 0;
  while (state.activeBox < state.boxes.length && guard < 128) {
    guard += 1;
    const box = activeBox(state);
    if (box.collected >= BOX_SIZE) {
      completeCurrentBox(state, events);
      continue;
    }
    const index = state.buffer.findIndex((id) => {
      const screw = screwById(state, id);
      return screw && screw.color === box.color;
    });
    if (index < 0) break;

    const [screwId] = state.buffer.splice(index, 1);
    const screw = screwById(state, screwId);
    if (!screw) break;
    screw.state = 'boxed';
    box.collected += 1;
    events.push({
      type: 'buffer_inflow',
      screwId,
      color: screw.color,
      boxIndex: state.activeBox,
      slot: box.collected - 1,
      bufferIndex: index,
    });
    if (box.collected >= BOX_SIZE) completeCurrentBox(state, events);
  }
  return events;
}

/** 收集「板材从静止->摆开」与「最后螺栓被拔出->整板坠落」两类事件 */
function collectPlateEvents(before, after, events) {
  for (const plate of after.plates) {
    const prev = before.plates.find((item) => item.id === plate.id);
    if (!prev) continue;
    const prevRemaining = before.screws.filter(
      (screw) => screw.plateId === plate.id && screw.state === 'board',
    ).length;
    const nextRemaining = after.screws.filter(
      (screw) => screw.plateId === plate.id && screw.state === 'board',
    ).length;

    if (prevRemaining === 2 && nextRemaining === 1) {
      const pivot = after.screws.find(
        (screw) => screw.plateId === plate.id && screw.state === 'board',
      );
      const centroid = plate.cells.reduce(
        (acc, cell) => ({ c: acc.c + cell.c / plate.cells.length, r: acc.r + cell.r / plate.cells.length }),
        { c: 0, r: 0 },
      );
      events.push({
        type: 'plate_swing',
        plateId: plate.id,
        layer: plate.layer,
        material: plate.material,
        tone: plate.tone,
        pivot: pivot ? { ...pivot.cell } : null,
        centroid,
      });
    }

    if (prevRemaining > 0 && nextRemaining === 0) {
      events.push({
        type: 'plate_fall',
        plateId: plate.id,
        layer: plate.layer,
        material: plate.material,
        shape: plate.shape,
        tone: plate.tone,
        cells: plate.cells.map(cloneCell),
      });
    }
  }
}

function applyScrewRemoval(state, screw, destination, events) {
  const box = activeBox(state);
  if (destination === 'box' && box && box.color === screw.color) {
    const placedBoxIndex = state.activeBox;
    screw.state = 'boxed';
    box.collected += 1;
    const slot = box.collected - 1;
    events.push({
      type: 'screw_boxed',
      screwId: screw.id,
      color: screw.color,
      boxIndex: placedBoxIndex,
      slot,
    });
    if (box.collected >= BOX_SIZE) {
      completeCurrentBox(state, events);
      fillBoxesFromBuffer(state, events);
    }
    return { boxIndex: placedBoxIndex, bufferIndex: null, slot };
  }

  screw.state = 'buffer';
  state.buffer.push(screw.id);
  events.push({
    type: 'screw_buffered',
    screwId: screw.id,
    color: screw.color,
    bufferIndex: state.buffer.length - 1,
  });
  return { boxIndex: null, bufferIndex: state.buffer.length - 1, slot: null };
}

function finishAction(before, next, events) {
  collectPlateEvents(before, next, events);
  next.moves += 1;
  next.status = evaluateStatus(next);
  next.events = events;
  return next;
}

// ---------- 玩家意图 ----------

/**
 * 旋出一颗螺栓。
 * 返回 { action, state }；action 为 null 表示意图无效（终局 / 被遮挡 / 无空位），静默忽略。
 */
export function unscrew(state, screwId) {
  if (!canUnscrew(state, screwId)) return { action: null, state };

  const before = state;
  const next = cloneState(state);
  const screw = screwById(next, screwId);
  const box = activeBox(next);
  const destination = box && box.color === screw.color ? 'box' : 'buffer';
  const events = [];
  const placement = applyScrewRemoval(next, screw, destination, events);
  finishAction(before, next, events);

  return {
    action: {
      type: 'unscrew',
      screwId,
      color: screw.color,
      destination,
      ...placement,
      status: next.status,
    },
    state: next,
  };
}

/**
 * 磁吸螺丝刀：每关 1 次，可把任意可触及螺栓强行吸走。
 * 颜色匹配当前盒时直接入盒；否则允许占用一个超出容量的备用孔，用于打破死锁。
 */
export function useMagnet(state, screwId) {
  if (!canUseMagnet(state, screwId)) return { action: null, state };

  const before = state;
  const next = cloneState(state);
  next.magnetUsed = true;
  const screw = screwById(next, screwId);
  const box = activeBox(next);
  const destination = box && box.color === screw.color ? 'box' : 'buffer';
  const events = [{ type: 'magnet_used', screwId, color: screw.color }];
  const placement = applyScrewRemoval(next, screw, destination, events);
  finishAction(before, next, events);

  return {
    action: {
      type: 'magnet',
      screwId,
      color: screw.color,
      destination,
      ...placement,
      status: next.status,
    },
    state: next,
  };
}

// ---------- 统计与校验 ----------

export function stats(state) {
  const totalScrews = state.screws.length;
  const boardScrews = state.screws.filter((screw) => screw.state === 'board').length;
  const boxedScrews = state.screws.filter((screw) => screw.state === 'boxed').length;
  const bufferedScrews = state.buffer.length;
  const totalPlates = state.plates.length;
  const gonePlates = state.plates.filter(
    (plate) => state.screws.filter((screw) => screw.plateId === plate.id && screw.state === 'board').length === 0,
  ).length;
  const swingingPlates = state.plates.filter(
    (plate) => state.screws.filter((screw) => screw.plateId === plate.id && screw.state === 'board').length === 1,
  ).length;

  return {
    totalScrews,
    boardScrews,
    boxedScrews,
    bufferedScrews,
    removedScrews: totalScrews - boardScrews,
    totalPlates,
    gonePlates,
    swingingPlates,
    activeBoxIndex: state.activeBox,
    totalBoxes: state.boxes.length,
  };
}

/** 颜色剩余数量（包括盘面、备用孔与当前盒未满部分） */
export function colorProgress(state) {
  const map = {};
  for (const color of COLORS) map[color] = { total: 0, boxed: 0, remaining: 0 };
  for (const screw of state.screws) {
    if (!map[screw.color]) map[screw.color] = { total: 0, boxed: 0, remaining: 0 };
    map[screw.color].total += 1;
    if (screw.state !== 'board') map[screw.color].boxed += 1;
    else map[screw.color].remaining += 1;
  }
  return map;
}

/**
 * 关卡数据健康检查。返回问题键数组，空数组代表可交付。
 * 生成器、测试与运行时都依赖它守住数据底线。
 */
export function validateLevelData(level) {
  const problems = [];
  if (!level || typeof level !== 'object') return ['missing_level'];
  if (!Number.isInteger(level.id) || level.id < 1) problems.push('bad_id');
  if (!Array.isArray(level.boxQueue) || level.boxQueue.length === 0) problems.push('bad_box_queue');
  if (!Number.isInteger(level.bufferCapacity) || level.bufferCapacity < 3 || level.bufferCapacity > 5) {
    problems.push('bad_buffer_capacity');
  }
  if (!Array.isArray(level.plates) || level.plates.length === 0) {
    problems.push('bad_plates');
    return problems;
  }

  const plateIds = new Set();
  const occupiedCells = new Set();
  const colorCounts = {};
  let totalScrews = 0;

  for (const plate of level.plates) {
    if (!plate || !plate.id) {
      problems.push('plate_missing_id');
      continue;
    }
    if (plateIds.has(plate.id)) problems.push(`duplicate_plate_id:${plate.id}`);
    plateIds.add(plate.id);

    if (!Number.isInteger(plate.layer) || plate.layer < 1) problems.push(`bad_layer:${plate.id}`);
    if (!Array.isArray(plate.cells) || plate.cells.length === 0) {
      problems.push(`plate_no_cells:${plate.id}`);
      continue;
    }

    const cellSet = new Set();
    for (const [c, r] of plate.cells) {
      if (!Number.isInteger(c) || !Number.isInteger(r) || c < 0 || c > 7 || r < 0 || r > 7) {
        problems.push(`cell_out_of_bounds:${plate.id}`);
      }
      const key = `${c},${r}`;
      if (cellSet.has(key)) problems.push(`duplicate_plate_cell:${plate.id}`);
      cellSet.add(key);
    }

    if (!Array.isArray(plate.holes) || plate.holes.length === 0) {
      problems.push(`plate_no_holes:${plate.id}`);
      continue;
    }

    const holeSet = new Set();
    for (const hole of plate.holes) {
      if (!Array.isArray(hole) || hole.length < 3) {
        problems.push(`bad_hole:${plate.id}`);
        continue;
      }
      const [c, r, color] = hole;
      const key = `${c},${r}`;
      if (!cellSet.has(key)) problems.push(`hole_outside_plate:${plate.id}`);
      if (holeSet.has(key)) problems.push(`duplicate_hole:${plate.id}`);
      holeSet.add(key);
      if (occupiedCells.has(key)) problems.push(`screw_position_overlap:${key}`);
      occupiedCells.add(key);
      if (!COLORS.includes(color)) problems.push(`bad_color:${plate.id}`);
      colorCounts[color] = (colorCounts[color] || 0) + 1;
      totalScrews += 1;
    }
  }

  if (totalScrews % BOX_SIZE !== 0) problems.push('screw_total_not_divisible_by_3');
  if (Array.isArray(level.boxQueue)) {
    const expected = {};
    for (const color of level.boxQueue) expected[color] = (expected[color] || 0) + BOX_SIZE;
    for (const color of new Set([...Object.keys(expected), ...Object.keys(colorCounts)])) {
      if ((expected[color] || 0) !== (colorCounts[color] || 0)) {
        problems.push(`color_mismatch:${color}`);
      }
    }
  }

  return problems;
}
