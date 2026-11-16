// bench.mjs —— 扎巷坊编辑台模型：DOM-free 的纸巷画布状态 + 笔刷 + 撤回栈 + 验收编排。
// 绘制交给 render.drawBench，判定交给 validate.mjs / bot.mjs，本模块只管“这张纸现在长什么样”。

import { BRUSH_TILE, SPAWN } from "./engine.mjs";
import { validateRows } from "./validate.mjs";
import { botGate, BOT_GATE } from "./bot.mjs";
import { TEMPLATES } from "./levels.mjs";
import { blankRows, encodeRows, normalizeRows, mirrorRows, MAZE_W, MAZE_H } from "./code.mjs";

export { MAZE_W, MAZE_H };

const HISTORY_MAX = 40;

/** 起手纸样：三张手作模板 + 一张白纸 */
export const SHEETS = [
  { id: "tpl-ring", nameKey: "tplRing" },
  { id: "tpl-lanes", nameKey: "tplLanes" },
  { id: "tpl-square", nameKey: "tplSquare" },
  { id: "blank", nameKey: "tplBlank" },
];

export function sheetRows(id) {
  if (id === "blank") return blankRows();
  return TEMPLATES[id] ? TEMPLATES[id].map((r) => String(r)) : blankRows();
}

function sameRows(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** 改一个字符，返回是否真的动了 */
function putChar(rows, x, y, ch) {
  if (y < 0 || y >= rows.length) return false;
  const row = rows[y];
  if (x < 0 || x >= row.length || row[x] === ch) return false;
  rows[y] = row.slice(0, x) + ch + row.slice(x + 1);
  return true;
}

/** 落笔到一张副本上：镜像同步、出生点全图唯一 */
function applyBrush(rows, brush, mirror, x, y) {
  const ch = BRUSH_TILE[brush];
  if (!ch) return false;
  let changed = false;
  if (brush === "spawn") {
    for (let i = 0; i < rows.length; i += 1) {
      if (rows[i].includes(SPAWN)) rows[i] = rows[i].split(SPAWN).join(BRUSH_TILE.path);
    }
  }
  if (putChar(rows, x, y, ch)) changed = true;
  // 出生点全图唯一：镜像会把 P 复制成两颗，另一颗永远踩不到
  if (mirror && brush !== "spawn" && putChar(rows, rows[0].length - 1 - x, y, ch)) changed = true;
  return changed;
}

/**
 * @param {object} opts { rows, brush, mirror, grid }
 */
export function createBench(opts = {}) {
  const b = {
    rows: normalizeRows(opts.rows ?? sheetRows("tpl-ring")),
    brush: opts.brush ?? "dot",
    mirror: opts.mirror !== false,
    grid: opts.grid !== false,
    history: [],
    future: [],
    stroke: null,
  };

  function push(prev) {
    b.history.push((prev ?? b.rows).join("\n"));
    if (b.history.length > HISTORY_MAX) b.history.shift();
    b.future.length = 0;
  }

  const api = {
    get rows() {
      return b.rows;
    },
    get brush() {
      return b.brush;
    },
    get mirror() {
      return b.mirror;
    },
    get grid() {
      return b.grid;
    },
    get canUndo() {
      return b.history.length > 0;
    },
    get canRedo() {
      return b.future.length > 0;
    },
    get size() {
      return { width: b.rows[0]?.length ?? MAZE_W, height: b.rows.length };
    },

    setBrush(brush) {
      if (typeof brush !== "string" || !(brush in BRUSH_TILE)) return false;
      b.brush = brush;
      return true;
    },
    toggleMirror(next) {
      b.mirror = next ?? !b.mirror;
      return b.mirror;
    },
    toggleGrid(next) {
      b.grid = next ?? !b.grid;
      return b.grid;
    },

    // ------------------------------------------------------------ 笔画

    beginStroke() {
      b.stroke = b.rows.slice();
    },
    /** 拖动补笔：不开新撤回档，与起点算同一笔 */
    strokeTo(x, y) {
      if (!b.stroke) api.beginStroke();
      const work = b.rows.slice();
      if (!applyBrush(work, b.brush, b.mirror, x, y)) return false;
      b.rows = work;
      return true;
    },
    /** 抬笔：整笔只记一档 */
    endStroke() {
      const before = b.stroke;
      b.stroke = null;
      if (!before || sameRows(before, b.rows)) return false;
      push(before);
      return true;
    },
    /** 单击落笔 */
    paint(x, y) {
      api.beginStroke();
      api.strokeTo(x, y);
      return api.endStroke();
    },

    // ------------------------------------------------------------ 整图操作

    undo() {
      const prev = b.history.pop();
      if (prev === undefined) return false;
      b.future.push(b.rows.join("\n"));
      b.rows = prev.split("\n");
      return true;
    },
    redo() {
      const next = b.future.pop();
      if (next === undefined) return false;
      b.history.push(b.rows.join("\n"));
      if (b.history.length > HISTORY_MAX) b.history.shift();
      b.rows = next.split("\n");
      return true;
    },
    mirrorAll() {
      const next = mirrorRows(b.rows);
      if (sameRows(next, b.rows)) return false;
      push();
      b.rows = next;
      return true;
    },
    clearSheet() {
      return api.loadRows(blankRows(b.rows[0]?.length ?? MAZE_W, b.rows.length));
    },
    loadSheet(id) {
      return api.loadRows(sheetRows(id));
    },
    /** 载入整图（模板 / 巷码 / 擂台簿），与当前一致时不入档 */
    loadRows(next) {
      const clean = normalizeRows(next);
      if (sameRows(clean, b.rows)) return b.rows;
      push();
      b.rows = clean;
      return b.rows;
    },

    // ------------------------------------------------------------ 验收

    /** ① ~ ④ 廉价验收：随编辑实时刷新 */
    check() {
      return validateRows(b.rows);
    },
    /** ⑤ 影子试跑：数百毫秒量级，只在点「预演 / 保存 / 进巷子」时跑 */
    probe(runs = BOT_GATE.runs) {
      return botGate({ rows: b.rows, runs });
    },
    code() {
      return encodeRows(b.rows);
    },
  };
  return api;
}
