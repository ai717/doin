// 魔方规则唯一权威：纯函数、DOM-free。所有旋转以整型 3x3 旋转矩阵表达，便于测试与复现。

export const SIZES = Object.freeze([2, 3]);

// 面序固定：0 上白 / 1 下黄 / 2 前绿 / 3 后蓝 / 4 右红 / 5 左橙
export const FACE_ORDER = Object.freeze(["U", "D", "F", "B", "R", "L"]);

export const COLOR_HEX = Object.freeze([
  "#f5f8fc",
  "#ffd23f",
  "#35d07f",
  "#2f8bff",
  "#ff4d5e",
  "#ff9f1c",
]);

const FACE_DIR = Object.freeze([
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
  [1, 0, 0],
  [-1, 0, 0],
]);

// 本地六面方向：+x -x +y -y +z -z，对应贴纸颜色见 LOCAL_COLORS
export const LOCAL_DIRS = Object.freeze([
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
]);

export const LOCAL_COLORS = Object.freeze([4, 5, 0, 1, 2, 3]);

export const FACE_AXIS = Object.freeze({ U: 1, D: 1, F: 2, B: 2, R: 0, L: 0 });
export const FACE_LAYER = Object.freeze({ U: 1, D: 0, F: 1, B: 0, R: 1, L: 0 });

const IDENTITY = Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1]);

export function isValidSize(size) {
  return SIZES.includes(size);
}

export function createSolved(size) {
  if (!isValidSize(size)) throw new Error("invalid cube size");
  const cubies = [];
  for (let x = 0; x < size; x += 1) {
    for (let y = 0; y < size; y += 1) {
      for (let z = 0; z < size; z += 1) {
        const colors = LOCAL_DIRS.map((dir) => {
          const value = FACE_DIR.findIndex((face, index) => (
            index < 6
            && face[0] === dir[0]
            && face[1] === dir[1]
            && face[2] === dir[2]
            && (
              (dir[0] === 1 && x === size - 1)
              || (dir[0] === -1 && x === 0)
              || (dir[1] === 1 && y === size - 1)
              || (dir[1] === -1 && y === 0)
              || (dir[2] === 1 && z === size - 1)
              || (dir[2] === -1 && z === 0)
            )
          ));
          return value;
        });
        cubies.push({ p: [x, y, z], m: IDENTITY.slice(), c: colors });
      }
    }
  }
  return { size, cubies };
}

export function cloneState(state) {
  return {
    size: state.size,
    cubies: state.cubies.map((cubie) => ({
      p: cubie.p.slice(),
      m: cubie.m.slice(),
      c: cubie.c,
    })),
  };
}

export function applyMat(m, v) {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

export function matMul(a, b) {
  const out = new Array(9);
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      out[row * 3 + col] =
        a[row * 3] * b[col] + a[row * 3 + 1] * b[3 + col] + a[row * 3 + 2] * b[6 + col];
    }
  }
  return out;
}

export function normalizeQuarters(quarters) {
  const q = ((Math.trunc(quarters) % 4) + 4) % 4;
  return q === 3 ? -1 : q;
}

export function rotationMatrix(axis, quarters) {
  const q = normalizeQuarters(quarters);
  if (q === 0) return IDENTITY.slice();
  if (q === 2) {
    if (axis === 0) return [1, 0, 0, 0, -1, 0, 0, 0, -1];
    if (axis === 1) return [-1, 0, 0, 0, 1, 0, 0, 0, -1];
    return [-1, 0, 0, 0, -1, 0, 0, 0, 1];
  }
  if (axis === 0) return q === 1 ? [1, 0, 0, 0, 0, -1, 0, 1, 0] : [1, 0, 0, 0, 0, 1, 0, -1, 0];
  if (axis === 1) return q === 1 ? [0, 0, 1, 0, 1, 0, -1, 0, 0] : [0, 0, -1, 0, 1, 0, 1, 0, 0];
  return q === 1 ? [0, -1, 0, 1, 0, 0, 0, 0, 1] : [0, 1, 0, -1, 0, 0, 0, 0, 1];
}

// 绕世界坐标轴旋转指定层（right-hand 四分之一圈，1 = 正向 90°）
export function turn(state, axis, layer, quarters) {
  const q = normalizeQuarters(quarters);
  if (q === 0) return state;
  const matrix = rotationMatrix(axis, q);
  const mid = (state.size - 1) / 2;
  const cubies = state.cubies.map((cubie) => {
    if (cubie.p[axis] !== layer) return cubie;
    const centered = [cubie.p[0] - mid, cubie.p[1] - mid, cubie.p[2] - mid];
    const rotated = applyMat(matrix, centered);
    return {
      p: [
        Math.round(rotated[0] + mid),
        Math.round(rotated[1] + mid),
        Math.round(rotated[2] + mid),
      ],
      m: matMul(matrix, cubie.m),
      c: cubie.c,
    };
  });
  return { size: state.size, cubies };
}

export function parseMove(text) {
  const match = String(text).trim().match(/^([URFDLB])([2'])?$/i);
  if (!match) return null;
  const face = match[1].toUpperCase();
  const suffix = match[2] ?? "";
  const amount = suffix === "2" ? 2 : suffix === "'" ? 3 : 1;
  return { face, amount };
}

export function movesFromText(text) {
  return String(text)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(parseMove)
    .filter(Boolean);
}

export function movesToText(moves) {
  return moves.map(moveToText).join(" ");
}

export function moveToText(move) {
  if (!move) return "";
  return `${move.face}${move.amount === 2 ? "2" : move.amount === 3 ? "'" : ""}`;
}

export function invertMove(move) {
  return { face: move.face, amount: move.amount === 2 ? 2 : move.amount === 1 ? 3 : 1 };
}

// 标准记法换算成绕轴旋转：U/R/F 顺时针 = 绕正轴 -90°
const CLOCKWISE_SIGN = { U: -1, D: 1, F: -1, B: 1, R: -1, L: 1 };

export function moveToTurn(state, move) {
  const axis = FACE_AXIS[move.face];
  const layer = FACE_LAYER[move.face] === 1 ? state.size - 1 : 0;
  const sign = CLOCKWISE_SIGN[move.face];
  const quarters = move.amount === 2 ? 2 : sign * (move.amount === 1 ? 1 : -1);
  return { axis, layer, quarters };
}

export function applyMove(state, move) {
  if (!move || !(move.face in FACE_AXIS)) return state;
  const spec = moveToTurn(state, move);
  return turn(state, spec.axis, spec.layer, spec.quarters);
}

export function applyMoves(state, moves) {
  return moves.reduce((current, move) => applyMove(current, move), state);
}

export function invertTurn(spec) {
  return { axis: spec.axis, layer: spec.layer, quarters: normalizeQuarters(-spec.quarters) };
}

export function applyTurn(state, spec) {
  if (!spec) return state;
  return turn(state, spec.axis, spec.layer, spec.quarters);
}

export function isSolved(state) {
  for (const cubie of state.cubies) {
    for (let i = 0; i < LOCAL_DIRS.length; i += 1) {
      const color = cubie.c[i];
      if (color < 0) continue;
      const world = applyMat(cubie.m, LOCAL_DIRS[i]);
      const expected = FACE_DIR[color];
      if (world[0] !== expected[0] || world[1] !== expected[1] || world[2] !== expected[2]) {
        return false;
      }
    }
  }
  return true;
}

export function misplacedStickers(state) {
  let count = 0;
  for (const cubie of state.cubies) {
    for (let i = 0; i < LOCAL_DIRS.length; i += 1) {
      const color = cubie.c[i];
      if (color < 0) continue;
      const world = applyMat(cubie.m, LOCAL_DIRS[i]);
      const expected = FACE_DIR[color];
      if (world[0] !== expected[0] || world[1] !== expected[1] || world[2] !== expected[2]) {
        count += 1;
      }
    }
  }
  return count;
}

export function stickerTotal(size) {
  return size * size * 6;
}

// 可玩动作全集（不含中层切片）
export function legalMoves() {
  const out = [];
  for (const face of FACE_ORDER) {
    out.push({ face, amount: 1 }, { face, amount: 2 }, { face, amount: 3 });
  }
  return out;
}

// mulberry32：可注入确定性种子，测试与每日同题共用
export function mulberry32(seed) {
  let value = seed >>> 0;
  return function random() {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(text) {
  let hash = 2166136261;
  const source = String(text);
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function dailySeed(key = dateKey()) {
  return hashSeed(`doin-cube-${key}`);
}

export function generateScramble(size, length, random) {
  const rng = typeof random === "function" ? random : mulberry32(Date.now() >>> 0);
  const moves = [];
  let lastFace = null;
  let lastAxis = -1;
  let axisRun = 0;
  let guard = 0;
  while (moves.length < length && guard < length * 60) {
    guard += 1;
    const face = FACE_ORDER[Math.floor(rng() * FACE_ORDER.length)];
    const axis = FACE_AXIS[face];
    if (face === lastFace) continue;
    if (axis === lastAxis && axisRun >= 2) continue;
    const amount = 1 + Math.floor(rng() * 3);
    moves.push({ face, amount });
    if (axis === lastAxis) axisRun += 1;
    else axisRun = 1;
    lastAxis = axis;
    lastFace = face;
  }
  return moves;
}

export function scrambleText(moves) {
  return movesToText(moves);
}

export function generateScrambleFor(size, seed, length) {
  const moves = generateScramble(size, length, mulberry32(seed >>> 0));
  return { moves, text: movesToText(moves), seed: seed >>> 0 };
}

// 一步推荐：枚举全部合法动作，取贴纸错位最少者（用于提示）
export function suggestMove(state, options = {}) {
  if (isSolved(state)) return null;
  const banned = options.lastFace ?? null;
  let best = null;
  const total = stickerTotal(state.size);
  for (const move of legalMoves()) {
    if (banned && move.face === banned && move.amount === 3) continue;
    const next = applyMove(state, move);
    const score = misplacedStickers(next);
    const candidate = { move, score, total };
    if (
      !best
      || score < best.score
      || (score === best.score && move.amount < best.move.amount)
    ) {
      best = candidate;
    }
  }
  return best;
}

export function stateKey(state) {
  return state.cubies
    .map((cubie) => `${cubie.p.join(",")}|${cubie.m.join(",")}`)
    .join(";");
}
