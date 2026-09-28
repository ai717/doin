// 渲染层契约：几何换算必须能纯函数断言，DOM 写入必须幂等且全量。
// DOM 桩只实现单选择器查询与 classList / dataset / style 三类写入 ——
// 凡是"视觉对不对"的断言都不在这里，这里只钉结构与数值契约。

import test from "node:test";
import assert from "node:assert/strict";

import { BLACK, WHITE, EMPTY, CELL_COUNT, SIZE, indexOf, squareKind } from "../js/engine.mjs";
import {
  CLS, FLIP_CLASSES, FLIP_MS, GRAPH_MOVE_SPAN, GRAPH_WIDTH, GRAPH_HEIGHT,
  MAX_BEAM_DEG, FULL_TILT_DIFF,
  beamAngle, beamSign, createBoard, paintBoard, setDisc, startFlip, endFlip,
  flashCell, clearFlash, paintMarks, markLastMove, paintCellLabel, discElement,
  graphPoints, paintGraph, paintScale, gridPosition,
} from "../js/render.mjs";

const eq = assert.strictEqual;
const de = assert.deepStrictEqual;

// ─── 极简 DOM 桩 ──────────────────────────────────────────────────
function makeClassList(el) {
  return {
    add: (...names) => names.forEach((n) => el._classes.add(n)),
    remove: (...names) => names.forEach((n) => el._classes.delete(n)),
    contains: (name) => el._classes.has(name),
    toggle(name, force) {
      const on = force === undefined ? !el._classes.has(name) : Boolean(force);
      if (on) el._classes.add(name);
      else el._classes.delete(name);
      return on;
    },
  };
}

function matches(el, selector) {
  if (selector.startsWith(".")) return el._classes.has(selector.slice(1));
  if (selector.startsWith("#")) return el.attrs.id === selector.slice(1);
  const attr = selector.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);
  if (attr) {
    const value = el.attrs[attr[1]] ?? (attr[1].startsWith("data-") ? el.dataset[attr[1].slice(5)] : undefined);
    return attr[2] === undefined ? value !== undefined : String(value) === attr[2];
  }
  return el.tagName === selector.toUpperCase();
}

function search(el, selector) {
  for (const child of el.children) {
    if (matches(child, selector)) return child;
    const found = search(child, selector);
    if (found) return found;
  }
  return null;
}

function createElement(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    children: [],
    attrs: {},
    dataset: {},
    style: {},
    _classes: new Set(),
    _text: "",
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    getAttribute(name) {
      return name in this.attrs ? this.attrs[name] : null;
    },
    querySelector(selector) {
      return search(this, selector);
    },
    get firstElementChild() {
      return this.children[0] ?? null;
    },
    get classList() {
      return this._classList;
    },
    get className() {
      return [...this._classes].join(" ");
    },
    set className(value) {
      this._classes.clear();
      String(value).split(/\s+/).filter(Boolean).forEach((name) => this._classes.add(name));
    },
    get textContent() {
      return this._text;
    },
    set textContent(value) {
      this._text = String(value);
    },
    get hidden() {
      return Boolean(this._hidden);
    },
    set hidden(value) {
      this._hidden = Boolean(value);
    },
  };
  el._classList = makeClassList(el);
  return el;
}

function withDocument(handler) {
  const previous = globalThis.document;
  globalThis.document = { createElement };
  try {
    return handler();
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
}

function buildBoard(kindOf = (i) => squareKind(i)) {
  const root = createElement("div");
  const cells = createBoard(root, kindOf);
  return { root, cells };
}

// ─── 常量与类名 ───────────────────────────────────────────────────
test("类名常量无重复，翻面类恰好两个", () => {
  const values = Object.values(CLS);
  eq(new Set(values).size, values.length);
  de([...FLIP_CLASSES], [CLS.flipToWhite, CLS.flipToBlack]);
  eq(FLIP_MS, 280);
  eq(GRAPH_MOVE_SPAN, CELL_COUNT - 4);
  eq(MAX_BEAM_DEG, 6);
  eq(FULL_TILT_DIFF, 16);
});

// ─── 天平倾角 ─────────────────────────────────────────────────────
test("beamAngle：平衡是精确的 0（不是 -0），黑多则左端下沉（负角），白多则正角", () => {
  eq(beamAngle(0, 0), 0);
  eq(beamAngle(2, 2), 0);
  eq(Object.is(beamAngle(4, 4), 0), true, "平衡时不许返回负零");
  eq(Object.is(beamAngle(4, 4), -0), false);
  eq(beamAngle(10, 2), -MAX_BEAM_DEG / 2);
  eq(beamAngle(2, 10), MAX_BEAM_DEG / 2);
  eq(beamAngle(1, 0), -(MAX_BEAM_DEG / FULL_TILT_DIFF));
});

test("beamAngle：±6° 封顶，且子差越大角度单调不回头", () => {
  eq(beamAngle(FULL_TILT_DIFF, 0), -MAX_BEAM_DEG);
  eq(beamAngle(0, FULL_TILT_DIFF), MAX_BEAM_DEG);
  eq(beamAngle(CELL_COUNT, 0), -MAX_BEAM_DEG);
  eq(beamAngle(0, CELL_COUNT), MAX_BEAM_DEG);
  // 黑子从 0 递增到 64：角度必须始终不增（黑越多，左盘越沉）
  let previous = Infinity;
  for (let black = 0; black <= CELL_COUNT; black += 1) {
    const angle = beamAngle(black, CELL_COUNT - black);
    assert.ok(angle <= previous, `黑 ${black} 子时角度回头了`);
    assert.ok(Math.abs(angle) <= MAX_BEAM_DEG);
    previous = angle;
  }
  eq(previous, -MAX_BEAM_DEG);
});

test("beamAngle：非有限值按 0 子处理、有限越界夹到 0..64，绝不产生 NaN", () => {
  for (const bad of [undefined, null, "x", NaN, -5, {}, Infinity, -Infinity]) {
    const angle = beamAngle(bad, 3);
    eq(angle, beamAngle(0, 3), `输入 ${String(bad)} 应按 0 子处理`);
    eq(Number.isFinite(angle), true);
  }
  eq(beamAngle(999, 0), -MAX_BEAM_DEG); // 有限但越界：夹到 64
  eq(beamAngle(0, 999), MAX_BEAM_DEG);
  eq(beamAngle(999, 999), 0);
  eq(beamAngle(2.9, 2.1), 0); // 小数先截断为整数子数：2 与 2，仍是平衡
  eq(beamAngle(3.9, 2.9), -0.375); // 3 与 2 → 子差 1
});

test("beamSign：用于识别跨越中点的那一瞬", () => {
  eq(beamSign(10, 4), 1);
  eq(beamSign(4, 10), -1);
  eq(beamSign(4, 4), 0);
  eq(beamSign(0, 0), 0);
  eq(beamSign(NaN, 0), 0);
});

// ─── 棋盘结构 ─────────────────────────────────────────────────────
test("createBoard：64 枚可聚焦按钮，逐格带 index / kind 与双面圆片", () => {
  withDocument(() => {
    const { root, cells } = buildBoard();
    eq(cells.length, CELL_COUNT);
    eq(root.children.length, CELL_COUNT);
    for (let i = 0; i < CELL_COUNT; i += 1) {
      const cell = cells[i];
      eq(cell.tagName, "BUTTON");
      eq(cell.getAttribute("type"), "button");
      eq(cell.dataset.index, String(i));
      eq(cell.dataset.kind, squareKind(i));
      eq(cell.children.length, 1);
      const disc = discElement(cell);
      eq(disc.className, "disc");
      de(disc.children.map((face) => face.className), ["face face-black", "face face-white"]);
    }
    eq(cells[0].dataset.kind, "corner");
    eq(cells[indexOf(3, 3)].dataset.kind, "inner");
    eq(cells[indexOf(0, 1)].dataset.kind, "c");
    eq(cells[indexOf(1, 1)].dataset.kind, "x");
    eq(cells[indexOf(0, 3)].dataset.kind, "edge");
  });
});

test("createBoard：kindOf 缺省时不留脏属性", () => {
  withDocument(() => {
    const root = createElement("div");
    const cells = createBoard(root, null);
    eq(cells.length, CELL_COUNT);
    eq("kind" in cells[0].dataset, false);
  });
});

// ─── 盘面重绘 ─────────────────────────────────────────────────────
test("paintBoard：逐格全量写入归属，空位不留 data-disc", () => {
  withDocument(() => {
    const { cells } = buildBoard();
    const board = new Array(CELL_COUNT).fill(EMPTY);
    board[0] = BLACK;
    board[1] = WHITE;
    paintBoard(cells, board, { lastMove: 1 });
    eq(cells[0].dataset.disc, "black");
    eq(cells[1].dataset.disc, "white");
    eq("disc" in cells[2].dataset, false);
    eq(cells[1].classList.contains(CLS.last), true);
    eq(cells[0].classList.contains(CLS.last), false);

    // 重绘一次只留最新的本手标记（绝不做增量累加）
    paintBoard(cells, board, { lastMove: 0 });
    eq(cells[0].classList.contains(CLS.last), true);
    eq(cells[1].classList.contains(CLS.last), false);

    // 空盘重绘必须把旧子清掉（index / kind 是结构属性，不在清除范围内）
    paintBoard(cells, new Array(CELL_COUNT).fill(EMPTY), {});
    eq("disc" in cells[0].dataset, false);
    eq("disc" in cells[1].dataset, false);
    eq(cells[0].classList.contains(CLS.last), false);
  });
});

test("setDisc：只认 1 / 2，其余一律当空格", () => {
  withDocument(() => {
    const cell = createElement("button");
    setDisc(cell, BLACK);
    eq(cell.dataset.disc, "black");
    setDisc(cell, WHITE);
    eq(cell.dataset.disc, "white");
    setDisc(cell, EMPTY);
    eq("disc" in cell.dataset, false);
    setDisc(cell, 7);
    eq("disc" in cell.dataset, false);
  });
});

test("startFlip / endFlip：先落定归属再挂动效类，收尾必须清干净两个类", () => {
  withDocument(() => {
    const { cells } = buildBoard();
    const cell = cells[10];
    const cls = startFlip(cell, WHITE);
    eq(cls, CLS.flipToWhite);
    eq(cell.dataset.disc, "white");
    eq(discElement(cell).classList.contains(CLS.flipToWhite), true);

    endFlip(cell);
    for (const name of FLIP_CLASSES) eq(discElement(cell).classList.contains(name), false);
    eq(cell.dataset.disc, "white", "收尾只能清动效类，不能动归属");

    eq(startFlip(cell, BLACK), CLS.flipToBlack);
    eq(cell.dataset.disc, "black");
    endFlip(cell);
    for (const name of FLIP_CLASSES) eq(discElement(cell).classList.contains(name), false);
  });
});

test("flashCell：得角与踩陷阱互斥，clearFlash 两者都清", () => {
  withDocument(() => {
    const cell = createElement("button");
    eq(flashCell(cell, "corner"), CLS.corner);
    eq(cell.classList.contains(CLS.corner), true);
    flashCell(cell, "trap");
    eq(cell.classList.contains(CLS.corner), false);
    eq(cell.classList.contains(CLS.trap), true);
    clearFlash(cell);
    eq(cell.classList.contains(CLS.corner), false);
    eq(cell.classList.contains(CLS.trap), false);
  });
});

// ─── 落点标记 ─────────────────────────────────────────────────────
test("paintMarks：全量重绘，上一手的预览绝不残留", () => {
  withDocument(() => {
    const { cells } = buildBoard();
    paintMarks(cells, { legal: [10, 11], threat: [20], preview: [10, 9], hint: 11 });
    eq(cells[10].classList.contains(CLS.legal), true);
    eq(cells[10].classList.contains(CLS.preview), true);
    eq(cells[11].classList.contains(CLS.hint), true);
    eq(cells[20].classList.contains(CLS.threat), true);
    eq(cells[9].classList.contains(CLS.preview), true);

    paintMarks(cells, { legal: [30] });
    for (const index of [10, 11, 20, 9]) {
      for (const cls of [CLS.legal, CLS.threat, CLS.preview, CLS.hint]) {
        eq(cells[index].classList.contains(cls), false, `第 ${index} 格残留了 ${cls}`);
      }
    }
    eq(cells[30].classList.contains(CLS.legal), true);
  });
});

test("paintMarks：接受 Set、拒绝非法 hint，缺省参数即清空全部标记", () => {
  withDocument(() => {
    const { cells } = buildBoard();
    paintMarks(cells, { legal: new Set([5]), hint: null });
    eq(cells[5].classList.contains(CLS.legal), true);
    eq(cells[5].classList.contains(CLS.hint), false);
    paintMarks(cells);
    eq(cells[5].classList.contains(CLS.legal), false);
    eq(cells[5].classList.contains(CLS.hint), false);
  });
});

test("markLastMove 与 paintCellLabel", () => {
  withDocument(() => {
    const { cells } = buildBoard();
    markLastMove(cells, 63);
    eq(cells[63].classList.contains(CLS.last), true);
    eq(cells[62].classList.contains(CLS.last), false);
    paintCellLabel(cells[63], "第 8 行第 8 列");
    eq(cells[63].getAttribute("aria-label"), "第 8 行第 8 列");
  });
});

// ─── 子数曲线 ─────────────────────────────────────────────────────
test("graphPoints：横轴按整局 60 手铺开，曲线随时间向右生长", () => {
  eq(GRAPH_MOVE_SPAN, 60);
  eq(GRAPH_WIDTH, 100);
  eq(GRAPH_HEIGHT, 100);

  const single = graphPoints([{ moveNo: 0, black: 2, white: 2 }]);
  de(single, { black: "0,48.44", white: "0,51.56" });

  const two = graphPoints([{ moveNo: 0, black: 2, white: 2 }, { moveNo: 30, black: 20, white: 12 }]);
  de(two.black, "0,48.44 50,34.38");
  de(two.white, "0,51.56 50,59.38");

  const end = graphPoints([{ moveNo: GRAPH_MOVE_SPAN, black: 0, white: 0 }]);
  de(end, { black: "100,50", white: "100,50" });
  de(graphPoints([]), { black: "", white: "" });
  de(graphPoints(undefined), { black: "", white: "" });
});

test("graphPoints：黑多则黑带整体抬高、白多则下压，且永不出图", () => {
  const low = graphPoints([{ moveNo: 10, black: 4, white: 4 }]);
  const high = graphPoints([{ moveNo: 10, black: 32, white: 1 }]);
  const lowY = Number(low.black.split(",")[1]);
  const highY = Number(high.black.split(",")[1]);
  assert.ok(highY < lowY, "黑子数上升，黑带必须更靠上");
  assert.ok(Number(high.white.split(",")[1]) > 50, "白带应落在下半部");
  for (const point of [{ moveNo: 60, black: CELL_COUNT, white: CELL_COUNT }, { moveNo: 0, black: 0, white: 0 }]) {
    const { black, white } = graphPoints([point]);
    for (const y of [black.split(",")[1], white.split(",")[1]].map(Number)) {
      assert.ok(y >= 0 && y <= GRAPH_HEIGHT, "曲线必须落在视口内");
    }
  }
});

test("paintGraph：两条折线各写各的点，并记录已画手数", () => {
  withDocument(() => {
    const svg = createElement("svg");
    const black = createElement("polyline");
    black.className = "graph-black";
    const white = createElement("polyline");
    white.className = "graph-white";
    svg.appendChild(black);
    svg.appendChild(white);

    paintGraph(svg, [{ moveNo: 0, black: 2, white: 2 }, { moveNo: 12, black: 10, white: 8 }]);
    eq(black.getAttribute("points"), "0,48.44 20,42.19");
    eq(white.getAttribute("points"), "0,51.56 20,56.25");
    eq(svg.dataset.moves, "2");

    paintGraph(svg, []);
    eq(black.getAttribute("points"), "");
    eq(svg.dataset.moves, "0");
  });
});

// ─── 天平横梁与预报铜牌 ───────────────────────────────────────────
function scaleElements() {
  return {
    beam: createElement("span"),
    blackDigit: createElement("b"),
    whiteDigit: createElement("b"),
    movePlate: createElement("span"),
    forecastPlate: createElement("button"),
  };
}

test("paintScale：横梁角度、双方砝码、手数铭牌一次写全", () => {
  withDocument(() => {
    const els = scaleElements();
    paintScale(els, { black: 10, white: 2, moveText: "第 7 手" });
    eq(els.beam.style.transform, "rotate(-3deg)");
    eq(els.beam.dataset.lean, "1");
    eq(els.blackDigit.textContent, "10");
    eq(els.whiteDigit.textContent, "2");
    eq(els.movePlate.textContent, "第 7 手");

    paintScale(els, { black: 2, white: 10, moveText: "第 8 手" });
    eq(els.beam.style.transform, "rotate(3deg)");
    eq(els.beam.dataset.lean, "-1");
  });
});

test("paintScale：forecast 为 null 时铜牌整块消失且不留文案（定案 2A 硬约束）", () => {
  withDocument(() => {
    const els = scaleElements();
    paintScale(els, { black: 30, white: 28, moveText: "第 40 手", forecast: { text: "终局已可算清 · 黑 +6" } });
    eq(els.forecastPlate.dataset.state, "ready");
    eq(els.forecastPlate.textContent, "终局已可算清 · 黑 +6");

    paintScale(els, { black: 20, white: 20, moveText: "第 41 手", forecast: null });
    eq(els.forecastPlate.dataset.state, "off");
    eq(els.forecastPlate.textContent, "", "不可预报时铜牌上不许残留任何文字");

    paintScale(els, { black: 20, white: 20, moveText: "第 42 手" });
    eq(els.forecastPlate.dataset.state, "off");
  });
});

test("paintScale：元素缺失时不抛错（渐进增强，缺件不该炸掉整局）", () => {
  withDocument(() => {
    assert.doesNotThrow(() => paintScale({}, { black: 1, white: 1 }));
    assert.doesNotThrow(() => paintScale({ beam: null, blackDigit: null }, { black: 5, white: 1 }));
  });
});

// ─── 网格坐标 ─────────────────────────────────────────────────────
test("gridPosition：8×8 行列号与引擎索引一一对应", () => {
  eq(SIZE, 8);
  de(gridPosition(0), { row: 1, col: 1 });
  de(gridPosition(7), { row: 1, col: 8 });
  de(gridPosition(8), { row: 2, col: 1 });
  de(gridPosition(63), { row: 8, col: 8 });
  for (let i = 0; i < CELL_COUNT; i += 1) {
    const { row, col } = gridPosition(i);
    eq(indexOf(row - 1, col - 1), i);
  }
});
