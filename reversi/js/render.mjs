// 渲染层：把状态画到 DOM 上（棋盘 / 圆片 / 标记 / 天平 / 子数曲线）。
// 铁律：本层只读状态、只写 DOM —— 不绑事件、不设计时器、不 import i18n、
// 不调用引擎的任何规则函数（只取 SIZE / CELL_COUNT 这类几何常量）。
// 文案由 ui 查表后传入，规则判断由 game 决定后传入，这里只负责"怎么显示"。

import { CELL_COUNT, SIZE, EMPTY } from "./engine.mjs";

// 类名常量集中在这里：CSS 与测试都以它为准，避免三处各写一份字符串。
export const CLS = Object.freeze({
  legal: "is-legal", // 当前行棋方的合法落点
  threat: "is-threat", // 对手此刻的可落点（机动性光环）
  preview: "is-preview", // 悬停预演：这一手会把哪些子翻过来
  hint: "is-hint", // 提示给出的最优落点
  last: "is-last", // 本手落点
  corner: "flash-corner", // 得角：暖金柔光
  trap: "flash-trap", // 踩陷阱（X / C 位）：暗红柔光
  flipToWhite: "flip-to-white", // 翻面动画：翻成白
  flipToBlack: "flip-to-black", // 翻面动画：翻成黑
});

export const FLIP_CLASSES = Object.freeze([CLS.flipToWhite, CLS.flipToBlack]);

// 翻面动画的时长（毫秒）。波次节奏（第 k 枚 +45ms）由 ui 用 audio 的 FLIP_STEP_MS 排程，
// 这里只定义"单枚翻面"本身的时长；CSS 必须与此一致，tests/layout 会做一致性断言。
export const FLIP_MS = 280;

// ─── 天平：子差 → 横梁倾角（纯函数，符号约定是这里唯一的坑）────────
export const MAX_BEAM_DEG = 6;
// 子差达到 16 即压满 ±6°。若按 64 归一，中局 8 子领先只有 0.75°，
// 横梁看上去像卡住了 —— 这台装置的意义恰恰是让中局的微小变化也看得见。
export const FULL_TILT_DIFF = 16;

// 黑子在左盘。横梁的 CSS 旋转为正时左端抬起、右端下沉，
// 因此"黑多 → 左盘重 → 左端下沉"对应的是**负**角度。改符号前先想清楚这一条。
export function beamAngle(black, white) {
  const diff = clampDiff(black) - clampDiff(white);
  const raw = -(diff / FULL_TILT_DIFF) * MAX_BEAM_DEG;
  const angle = Math.max(-MAX_BEAM_DEG, Math.min(MAX_BEAM_DEG, raw));
  // 平衡时必须精确返回 0，而不是 -0：负零会污染调用方的 Object.is 与除法，
  // 也会让"横梁归平"这条断言在测试里以最隐蔽的方式失败。
  return angle === 0 ? 0 : angle;
}

// 横梁当前偏向哪一侧：1 = 黑方重，-1 = 白方重，0 = 平衡。
// 用于检测"跨越中点"的那一瞬 —— 那一瞬要有一记阻尼抖动与黄铜"叮"。
export function beamSign(black, white) {
  const diff = clampDiff(black) - clampDiff(white);
  if (diff > 0) return 1;
  if (diff < 0) return -1;
  return 0;
}

// 非有限值（NaN / Infinity / undefined / 非数字）一律按"0 子"处理；
// 有限值越界则夹到 0..64。两种处理合起来保证任何输入都能得到一个可用角度。
function clampDiff(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(CELL_COUNT, Math.trunc(n)));
}

// ─── 棋盘 ─────────────────────────────────────────────────────────
// 每格是一枚可聚焦按钮（键盘准星要落在这里），内含一枚双面圆片：
// 正面黑釉、背面白釉，翻面靠 rotateX + backface-visibility 做真翻面，而不是换色。
export function createBoard(boardEl, kindOf) {
  const cells = [];
  for (let i = 0; i < CELL_COUNT; i += 1) {
    const cell = document.createElement("button");
    // 用 setAttribute 而不是 el.type = "button"：属性写法在桩环境里也能被断言，
    // 也让"这枚棋子按钮绝不是提交按钮"这条意图留在代码里。
    cell.setAttribute("type", "button");
    cell.className = "cell";
    cell.dataset.index = String(i);
    if (typeof kindOf === "function") cell.dataset.kind = kindOf(i);
    const disc = document.createElement("span");
    disc.className = "disc";
    const front = document.createElement("i");
    front.className = "face face-black";
    const back = document.createElement("i");
    back.className = "face face-white";
    disc.appendChild(front);
    disc.appendChild(back);
    cell.appendChild(disc);
    boardEl.appendChild(cell);
    cells.push(cell);
  }
  return cells;
}

// 整盘重绘：盘面 + 本手标记。逐格全量写，保证与状态严格一致（不做增量补丁）。
export function paintBoard(cells, board, options = {}) {
  const lastMove = options.lastMove ?? -1;
  for (let i = 0; i < cells.length; i += 1) {
    const cell = cells[i];
    setDisc(cell, board[i] ?? EMPTY);
    cell.classList.toggle(CLS.last, i === lastMove);
  }
}

export function discElement(cell) {
  return cell.firstElementChild;
}

export function setDisc(cell, owner) {
  if (owner === 1) cell.dataset.disc = "black";
  else if (owner === 2) cell.dataset.disc = "white";
  else delete cell.dataset.disc;
}

// 单枚翻面：先落定新归属（静止姿态立刻切到目标面），再挂动效类。
// 动画类的生命周期由调用方（ui 的波次调度器）负责收尾，这里只提供收尾入口。
export function startFlip(cell, owner) {
  setDisc(cell, owner);
  const cls = owner === 2 ? CLS.flipToWhite : CLS.flipToBlack;
  cell.firstElementChild.classList.add(cls);
  return cls;
}

export function endFlip(cell) {
  const disc = cell.firstElementChild;
  for (const cls of FLIP_CLASSES) disc.classList.remove(cls);
}

// 一次性反馈（得角 / 踩陷阱）：同样由调用方负责收尾。
export function flashCell(cell, kind) {
  clearFlash(cell);
  const cls = kind === "corner" ? CLS.corner : CLS.trap;
  cell.classList.add(cls);
  return cls;
}

export function clearFlash(cell) {
  cell.classList.remove(CLS.corner, CLS.trap);
}

// 落点标记全量重绘。must 幂等：每次调用都按传入的四个集合重算，
// 绝不做"只加不减"的增量更新，否则上一手的预览会永远留在盘面上。
export function paintMarks(cells, marks = {}) {
  const legal = toSet(marks.legal);
  const threat = toSet(marks.threat);
  const preview = toSet(marks.preview);
  const hint = Number.isInteger(marks.hint) ? marks.hint : -1;
  for (let i = 0; i < cells.length; i += 1) {
    const cell = cells[i];
    cell.classList.toggle(CLS.legal, legal.has(i));
    cell.classList.toggle(CLS.threat, threat.has(i));
    cell.classList.toggle(CLS.preview, preview.has(i));
    cell.classList.toggle(CLS.hint, i === hint);
  }
}

export function markLastMove(cells, index) {
  for (let i = 0; i < cells.length; i += 1) cells[i].classList.toggle(CLS.last, i === index);
}

export function paintCellLabel(cell, text) {
  cell.setAttribute("aria-label", text);
}

function toSet(value) {
  if (value instanceof Set) return value;
  return new Set(Array.isArray(value) ? value : []);
}

// ─── 子数曲线 ─────────────────────────────────────────────────────
// 横轴固定为"整局可能的 60 手"（64 格 − 4 枚开局子），所以曲线是**向右生长**的，
// 而不是把已有历史拉伸铺满。纵轴上半为黑、下半为白，各按 64 归一。
export const GRAPH_MOVE_SPAN = CELL_COUNT - 4;
export const GRAPH_WIDTH = 100;
export const GRAPH_HEIGHT = 100;

export function graphPoints(points, width = GRAPH_WIDTH, height = GRAPH_HEIGHT) {
  const mid = height / 2;
  const black = [];
  const white = [];
  for (const point of points ?? []) {
    const x = ((point.moveNo ?? 0) / GRAPH_MOVE_SPAN) * width;
    black.push(`${round2(x)},${round2(mid - (point.black / CELL_COUNT) * mid)}`);
    white.push(`${round2(x)},${round2(mid + (point.white / CELL_COUNT) * mid)}`);
  }
  return { black: black.join(" "), white: white.join(" ") };
}

export function paintGraph(svgEl, points) {
  const { black, white } = graphPoints(points);
  const blackLine = svgEl.querySelector(".graph-black");
  const whiteLine = svgEl.querySelector(".graph-white");
  if (blackLine) blackLine.setAttribute("points", black);
  if (whiteLine) whiteLine.setAttribute("points", white);
  svgEl.dataset.moves = String((points ?? []).length);
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

// ─── 天平横梁与仪表读数 ───────────────────────────────────────────
// els: { beam, blackDigit, whiteDigit, movePlate, forecastPlate }
// view: { black, white, moveText, forecast }
//   forecast === null 时铜牌必须**整块消失**（PRD 定案 2A：空位 > 14 绝不出现，
//   也不得用任何其他方式暗示"已算清"）。是否可预报由 game 层判定，这里只执行。
export function paintScale(els, view) {
  const angle = beamAngle(view.black, view.white);
  if (els.beam) {
    els.beam.style.transform = `rotate(${round2(angle)}deg)`;
    els.beam.dataset.lean = String(beamSign(view.black, view.white));
  }
  if (els.blackDigit) els.blackDigit.textContent = String(view.black);
  if (els.whiteDigit) els.whiteDigit.textContent = String(view.white);
  if (els.movePlate) els.movePlate.textContent = view.moveText ?? "";
  if (els.forecastPlate) {
    const forecast = view.forecast ?? null;
    els.forecastPlate.dataset.state = forecast ? "ready" : "off";
    els.forecastPlate.textContent = forecast ? forecast.text : "";
  }
}

// ─── 网格坐标 ─────────────────────────────────────────────────────
// 棋盘是 8×8 的 CSS Grid，行号自上而下、列号自左向右（与引擎索引一致）。
export function gridPosition(index) {
  return { row: Math.floor(index / SIZE) + 1, col: (index % SIZE) + 1 };
}
