import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createDocument, installClock, installDocument } from "./dom-stub.mjs";
import { createUI } from "../js/ui.mjs";
import { createGame } from "../js/game.mjs";
import { createAudio } from "../js/audio.mjs";
import { defaultState, MODES } from "../js/storage.mjs";
import { BLACK, WHITE, EMPTY, legalMoves, flipLines } from "../js/engine.mjs";
import { CLS } from "../js/render.mjs";

const html = readFileSync(resolve(import.meta.dirname, "..", "index.html"), "utf8");

// 每个用例都重建一份桩：UI 是有状态的，共享桩会让前一个用例的副作用污染后一个。
function setup(options = {}) {
  const doc = createDocument({ html, reducedMotion: Boolean(options.reducedMotion) });
  const restoreDoc = installDocument(doc);
  const clock = installClock();
  const audio = createAudio({ muted: true });
  const calls = [];
  const handlers = {
    onCell: (index, pointerType) => calls.push(["cell", index, pointerType]),
    onArm: (index) => calls.push(["arm", index]),
    onMode: (mode) => calls.push(["mode", mode]),
    onPref: (key, value) => calls.push(["pref", key, value]),
    onUndo: () => calls.push(["undo"]),
    onHint: () => calls.push(["hint"]),
    onResign: () => calls.push(["resign"]),
    onRestart: () => calls.push(["restart"]),
    onLevels: () => calls.push(["levels"]),
    onPickPuzzle: (id) => calls.push(["pick", id]),
    onForecast: () => calls.push(["forecast"]),
    onClearRecords: () => calls.push(["clear"]),
    onToggleSound: () => calls.push(["sound"]),
    onToggleLang: () => calls.push(["lang"]),
    onVolume: (value) => calls.push(["volume", value]),
  };
  const ui = createUI({ doc, audio, locale: "zh", handlers });
  ui.bind();
  ui.setLocale("zh");
  return {
    doc,
    ui,
    clock,
    audio,
    calls,
    teardown() {
      clock.restore();
      restoreDoc();
    },
  };
}

function gameOf(options = {}) {
  // 注入确定性对手：取第一个合法手。这样整条链路（advance → 事件 → 动画）不依赖真实搜算。
  return createGame({
    think: async (board, player) => ({ move: legalMoves(board, player)[0] ?? -1 }),
    yielder: async () => {},
    seed: 7,
    ...options,
  });
}

function discsOf(cells) {
  return cells.map((cell) => {
    const value = cell.dataset.disc;
    return value === "black" ? BLACK : value === "white" ? WHITE : EMPTY;
  });
}

// ═══ 装配 ══════════════════════════════════════════════════════

test("createUI 从 index.html 的 #board 里生成 64 枚棋子按钮", () => {
  const env = setup();
  try {
    assert.equal(env.ui.cells.length, 64, "棋盘格数不对");
    const cell = env.ui.cells[0];
    assert.equal(cell.tagName, "button");
    assert.equal(cell.getAttribute("type"), "button", "棋子必须是 button 而不是提交按钮");
    assert.equal(cell.dataset.index, "0");
    assert.equal(cell.dataset.kind, "corner", "0 号格必须是角");
    assert.equal(env.ui.cells[9].dataset.kind, "x", "9 号格必须是 X 位");
    assert.equal(env.ui.cells[27].dataset.kind, "inner", "27 号格必须是内圈");
  } finally {
    env.teardown();
  }
});

test("bind 之后点击棋盘格会经 onCell 上报（事件委托 + target 传递）", () => {
  const env = setup();
  try {
    const cell = env.ui.cells[27];
    const handled = env.doc.getElementById("board").dispatch("click", { target: cell });
    assert.ok(handled > 0, "棋盘没有监听 click");
    assert.deepEqual(env.calls.at(-1), ["cell", 27, "mouse"]);
  } finally {
    env.teardown();
  }
});

test("模式 / 档位 / 执子 / 开局按钮都经委托上报对应偏好", () => {
  const env = setup();
  try {
    env.doc.getElementById("mode-puzzle").dispatch("click", { target: env.doc.getElementById("mode-puzzle") });
    assert.deepEqual(env.calls.at(-1), ["mode", MODES.PUZZLE]);

    const tier = env.doc.querySelector("#tier-group [data-tier='virtuoso']");
    tier.dispatch("click", { target: tier });
    assert.deepEqual(env.calls.at(-1), ["pref", "tier", "virtuoso"]);

    const side = env.doc.querySelector("#side-group [data-side='2']");
    side.dispatch("click", { target: side });
    assert.deepEqual(env.calls.at(-1), ["pref", "side", WHITE]);

    const opening = env.doc.querySelector("#opening-group [data-opening='random']");
    opening.dispatch("click", { target: opening });
    assert.deepEqual(env.calls.at(-1), ["pref", "opening", "random"]);
  } finally {
    env.teardown();
  }
});

// ═══ i18n 热更新 ═══════════════════════════════════════════════

test("语言切换是全量热更新：文本、html lang、标题一起换，且不触发任何重开", () => {
  const env = setup();
  try {
    env.ui.setLocale("en");
    assert.equal(env.doc.documentElement.lang, "en");
    assert.equal(env.doc.title, "Reversi · DOIN games");
    assert.equal(env.doc.getElementById("undo-btn").textContent, "Undo");
    assert.equal(env.doc.getElementById("lang-btn").textContent, "中文");
    assert.equal(env.doc.getElementById("back-home").textContent, "Back to portal");
    assert.equal(env.doc.getElementById("mode-rush").textContent, "Flip Rush");
    assert.equal(env.calls.length, 0, "切换语言不得触发任何业务回调（更不许重开对局）");

    env.ui.setLocale("zh");
    assert.equal(env.doc.documentElement.lang, "zh-CN");
    assert.equal(env.doc.getElementById("undo-btn").textContent, "悔棋");
  } finally {
    env.teardown();
  }
});

test("英文界面下所有 data-i18n 元素零汉字残留", () => {
  const env = setup();
  try {
    env.ui.setLocale("en");
    const leftovers = [];
    for (const el of env.doc.querySelectorAll("[data-i18n]")) {
      if (/[\u4e00-\u9fa5]/.test(el.textContent ?? "")) leftovers.push(`${el.dataset.i18n}=${el.textContent}`);
    }
    assert.deepEqual(leftovers, [], `英文界面残留中文: ${leftovers.join(", ")}`);
  } finally {
    env.teardown();
  }
});

// ═══ 渲染 ══════════════════════════════════════════════════════

test("render 把快照里的盘面原样画到 DOM 上（含最后落点）", () => {
  const env = setup();
  try {
    const game = gameOf();
    game.start({ mode: MODES.PLAY, side: BLACK });
    const view = game.snapshot();
    env.ui.render(view, { records: defaultState().records, showMobility: true });

    assert.deepEqual(discsOf(env.ui.cells), view.board, "DOM 盘面与快照不一致");
    assert.equal(env.ui.cells.filter((cell) => cell.classList.contains(CLS.legal)).length, view.legal.length, "合法落点标记数量不对");
    assert.equal(env.doc.getElementById("black-count").textContent, String(view.board.filter((v) => v === BLACK).length));
    assert.equal(env.doc.getElementById("move-plate").textContent, "第 0 手");
  } finally {
    env.teardown();
  }
});

test("终局预报铜牌：可算时点亮并给文案，不可算时整块清空且退到 off", () => {
  const env = setup();
  try {
    const plate = env.doc.getElementById("forecast-plate");
    env.ui.render(
      { ...baseView(), forecast: { diff: 6, lead: 6, side: BLACK, best: [19, 26] }, report: null },
      { records: defaultState().records, showMobility: true },
    );
    assert.equal(plate.dataset.state, "ready");
    assert.equal(plate.textContent, "终局已可算清 · 黑子 +6");

    env.ui.render(
      { ...baseView(), forecast: null, report: null },
      { records: defaultState().records, showMobility: true },
    );
    assert.equal(plate.dataset.state, "off");
    assert.equal(plate.textContent, "", "不可预报时必须清空文案，不得留任何暗示");
  } finally {
    env.teardown();
  }
});

test("对手落点提示受开关控制，关掉后不再出现威胁标记", () => {
  const env = setup();
  try {
    const view = baseView();
    env.ui.render(view, { records: defaultState().records, showMobility: true });
    const withThreat = env.ui.cells.filter((cell) => cell.classList.contains(CLS.threat)).length;
    env.ui.render(view, { records: defaultState().records, showMobility: false });
    const withoutThreat = env.ui.cells.filter((cell) => cell.classList.contains(CLS.threat)).length;
    assert.equal(withoutThreat, 0, "关掉开关后仍有威胁标记");
    assert.equal(withThreat, view.threat.length);
  } finally {
    env.teardown();
  }
});

// ═══ 动画：业务可观测量必须真的推进 ════════════════════════════

test("moved 事件驱动波次翻转：被夹的子逐枚变成落子方的颜色", async () => {
  const env = setup();
  try {
    const game = gameOf();
    game.start({ mode: MODES.PLAY, side: BLACK });
    env.ui.render(game.snapshot(), { records: defaultState().records, showMobility: true });

    game.placement(19);
    await game.advance();
    const events = game.drainEvents();
    const moved = events.find((event) => event.type === "moved");
    assert.ok(moved, "没有产生 moved 事件");
    assert.ok(moved.flips.length > 0, "这一手应当至少翻一枚");

    // ★ 必须分段播：drive() 会一路推到"重新轮到人类"，所以事件流里通常有两手。
    //   拿第一手的 flips 去校验最终盘面会失败 —— 对手那一手可能把同一格翻回去
    //   （d4 就是这样一个格：黑 d3 夹它、白 c3 又夹回去）。这是实测踩到的坑。
    const cut = events.indexOf(moved) + 1;
    const firstHand = events.slice(0, cut);
    const rest = events.slice(cut);

    const p1 = env.ui.animate(firstHand);
    assert.ok(env.clock.pending > 0, "翻转未登记任何延迟调度（波次节奏丢了）");
    env.clock.flush();
    await p1;

    assert.equal(env.ui.cells[moved.index].dataset.disc, "black", "落点未落子");
    for (const index of moved.flips) {
      assert.equal(env.ui.cells[index].dataset.disc, "black", `${index} 号格没有被翻成落子方颜色`);
    }

    const p2 = env.ui.animate(rest);
    env.clock.flush();
    await p2;
    assert.deepEqual(discsOf(env.ui.cells), game.snapshot().board, "全部事件播完后 DOM 盘面必须与快照一致");
  } finally {
    env.teardown();
  }
});

test("波次节奏真实存在：多枚翻转之间必须有 (k−1)×45ms 的递增延迟", () => {
  const env = setup();
  try {
    const events = [{
      type: "moved", index: 19, player: BLACK, corners: [], trap: false,
      flips: [27, 28, 35, 36], lines: [[27], [28], [35], [36]],
    }];
    const pending = env.ui.animate(events);
    const ms = env.clock.msList();
    // 4 枚翻转 + 1 个落点（0ms）+ 1 个收尾 = 6 个定时器
    assert.equal(ms.length, 6, `排程数量不对: ${ms.join(",")}`);
    assert.deepEqual(ms.slice(0, 5), [0, 0, 45, 90, 135], "波次递延不是 (k−1)×45ms");
    assert.ok(ms.at(-1) > 135, "收尾定时器必须晚于最后一枚翻转，否则动画会被截断");
    env.clock.flush();
    return pending;
  } finally {
    env.teardown();
  }
});

test("reduced-motion 下波次改为同时翻转，所有递延归零", () => {
  const env = setup({ reducedMotion: true });
  try {
    const events = [{ type: "moved", index: 19, player: BLACK, flips: [18, 20, 34], lines: [[18], [20], [34]], corners: [], trap: false }];
    const pending = env.ui.animate(events);
    const ms = env.clock.msList();
    assert.ok(ms.length > 1, "没有排程");
    // 最大值那个是"动画总时长"的收尾定时器；除此以外必须全部为 0
    assert.deepEqual(ms.slice(0, -1), new Array(ms.length - 1).fill(0), `降级后仍有递延: ${ms.join(",")}`);
    env.clock.flush();
    return pending;
  } finally {
    env.teardown();
  }
});

test("得角 / 踩陷阱的闪光类由同一个出口回收（不会永久残留在格子上）", async () => {
  const env = setup();
  try {
    const pending = env.ui.animate([
      { type: "corner", index: 63 },
      { type: "trap", index: 9 },
    ]);
    assert.ok(env.ui.cells[63].classList.contains(CLS.corner), "得角闪光未挂上");
    assert.ok(env.ui.cells[9].classList.contains(CLS.trap), "陷阱闪光未挂上");
    env.clock.flush();
    await pending;
    assert.ok(!env.ui.cells[63].classList.contains(CLS.corner), "得角闪光类没有回收");
    assert.ok(!env.ui.cells[9].classList.contains(CLS.trap), "陷阱闪光类没有回收");
  } finally {
    env.teardown();
  }
});

test("错误提示类事件（残局错手 / 连击断）会弹出 toast 并自动收起", async () => {
  const env = setup();
  try {
    const pending = env.ui.animate([{ type: "puzzle", phase: "wrong", value: -12 }]);
    assert.equal(env.doc.getElementById("toast").hidden, false);
    assert.match(env.doc.getElementById("toast").textContent, /-12/);
    env.clock.flush();
    await pending;
    assert.equal(env.doc.getElementById("toast").hidden, true, "toast 没有自动收起");
  } finally {
    env.teardown();
  }
});

// ═══ 弹层与选关 ════════════════════════════════════════════════

test("五层弹层互斥：打开一层就关掉其他层", () => {
  const env = setup();
  try {
    for (const name of ["settings", "help", "levels", "result", "confirm"]) {
      env.ui.openLayer(name);
      for (const other of ["settings", "help", "levels", "result", "confirm"]) {
        assert.equal(env.doc.getElementById(`${other}-layer`).hidden, other !== name, `${name} 打开时 ${other} 的可见性不对`);
      }
      assert.ok(env.ui.isOpen(name));
    }
    env.ui.closeLayers();
    for (const name of ["settings", "help", "levels", "result", "confirm"]) {
      assert.equal(env.doc.getElementById(`${name}-layer`).hidden, true);
    }
  } finally {
    env.teardown();
  }
});

test("从对局中打开设置，关闭后回到对局而不是弹回上一层", () => {
  const env = setup();
  try {
    env.ui.openLayer("settings");
    assert.ok(env.ui.isOpen("settings"));
    env.ui.closeLayers();
    assert.equal(env.ui.isOpen("settings"), false);
    assert.equal(env.ui.isOpen("result"), false);
    assert.equal(env.doc.getElementById("settings-layer").hidden, true);
  } finally {
    env.teardown();
  }
});

test("选关面板：6 章 × 10 题，未通关时后续章节锁定且题号两位数", () => {
  const env = setup();
  try {
    env.ui.buildLevels(defaultState().records);
    const blocks = env.doc.querySelectorAll(".chapter-block");
    assert.equal(blocks.length, 6, "章节数不对");
    assert.equal(env.doc.querySelectorAll(".level-cell").length, 60, "题目数不对");

    const firstChapter = blocks[0].querySelectorAll(".level-cell");
    assert.equal(firstChapter.length, 10);
    assert.equal(firstChapter[0].disabled, false, "第一章必须可直接进入");
    assert.equal(firstChapter[0].querySelector(".lv-id").textContent, "01");

    const laterChapter = blocks[1].querySelectorAll(".level-cell");
    assert.equal(laterChapter[0].disabled, true, "未解出 6 题时第二章必须锁定");
    assert.ok(laterChapter[0].classList.contains("is-locked"));
  } finally {
    env.teardown();
  }
});

test("已解出的题显示实心星，且星数只升不降地反映在面板上", () => {
  const env = setup();
  try {
    const records = defaultState().records;
    records.puzzle.p0101 = { stars: 3, hadWrongRetry: false, firstMoveOptimal: true };
    records.puzzle.p0102 = { stars: 1, hadWrongRetry: true, firstMoveOptimal: false };
    env.ui.buildLevels(records);
    const cells = env.doc.querySelectorAll(".level-cell");
    assert.equal(cells[0].querySelector(".lv-stars").textContent, "\u2605\u2605\u2605");
    assert.equal(cells[1].querySelector(".lv-stars").textContent, "\u2605\u2606\u2606");
    assert.ok(cells[0].classList.contains("is-solved"));
    assert.equal(env.doc.getElementById("levels-total").textContent, "总星数 4 / 180");
  } finally {
    env.teardown();
  }
});

test("点选题目会把 id 上报给装配层", () => {
  const env = setup();
  try {
    env.ui.buildLevels(defaultState().records);
    const cell = env.doc.querySelectorAll(".level-cell")[0];
    cell.dispatch("click", { target: cell });
    assert.deepEqual(env.calls.at(-1), ["pick", "p0101"]);
  } finally {
    env.teardown();
  }
});

// ═══ 交互细节 ══════════════════════════════════════════════════

test("悬停预演只对鼠标生效，且高亮的是会被翻的子", () => {
  const env = setup();
  try {
    const game = gameOf();
    game.start({ mode: MODES.PLAY, side: BLACK });
    const view = game.snapshot();
    env.ui.render(view, { records: defaultState().records, showMobility: true });
    const target = view.legal[0];
    env.ui.setPreview(target);
    const expected = new Set(flipLines(view.board, target, view.current).flat());
    const marked = new Set(env.ui.cells.flatMap((cell, index) => (cell.classList.contains(CLS.preview) ? [index] : [])));
    assert.deepEqual([...marked].sort((a, b) => a - b), [...expected].sort((a, b) => a - b));
    env.ui.clearPreview();
    assert.equal(env.ui.cells.filter((cell) => cell.classList.contains(CLS.preview)).length, 0);
  } finally {
    env.teardown();
  }
});

test("终局预报点按后的最优首手会钉在盘面上（peek）", () => {
  const env = setup();
  try {
    const game = gameOf();
    game.start({ mode: MODES.PLAY, side: BLACK });
    env.ui.render(game.snapshot(), { records: defaultState().records, showMobility: true });
    env.ui.peek(19);
    assert.ok(env.ui.cells[19].classList.contains(CLS.hint), "最优首手没有被高亮");
    env.ui.peek(-1);
    assert.equal(env.ui.cells.filter((cell) => cell.classList.contains(CLS.hint)).length, 0);
  } finally {
    env.teardown();
  }
});

test("键盘：方向键移动准星并上报，Enter 落子", () => {
  const env = setup();
  try {
    env.doc.dispatch("keydown", { key: "ArrowDown" });
    const arm = env.calls.filter((call) => call[0] === "arm").at(-1);
    assert.ok(arm, "方向键没有上报准星位置");
    const before = arm[1];
    env.doc.dispatch("keydown", { key: "ArrowDown" });
    const after = env.calls.filter((call) => call[0] === "arm").at(-1)[1];
    assert.equal(after - before, 8, "向下移动应当跨一行");

    env.doc.dispatch("keydown", { key: "Enter" });
    const cell = env.calls.filter((call) => call[0] === "cell").at(-1);
    assert.equal(cell[2], "keyboard");
  } finally {
    env.teardown();
  }
});

test("键盘快捷键：U 悔棋 / H 提示 / R 重开 / M 静音", () => {
  const env = setup();
  try {
    for (const [key, action] of [["u", "undo"], ["h", "hint"], ["r", "restart"], ["m", "sound"]]) {
      env.doc.dispatch("keydown", { key });
      assert.deepEqual(env.calls.at(-1), [action], `${key} 没有映射到 ${action}`);
    }
  } finally {
    env.teardown();
  }
});

test("触屏走二次点按确认，鼠标单击直接落子", () => {
  const env = setup();
  try {
    assert.equal(env.ui.wantsConfirm("touch"), true);
    assert.equal(env.ui.wantsConfirm("pen"), true);
    assert.equal(env.ui.wantsConfirm("mouse"), false);
  } finally {
    env.teardown();
  }
});

test("escape 关闭当前弹层；无弹层时清掉悬停预演", () => {
  const env = setup();
  try {
    env.ui.openLayer("help");
    env.doc.dispatch("keydown", { key: "Escape" });
    assert.equal(env.ui.isOpen("help"), false);
    // 弹层开着时快捷键必须闭嘴，否则会在弹层里误操作对局
    env.ui.openLayer("settings");
    env.doc.dispatch("keydown", { key: "r" });
    assert.equal(env.calls.filter((call) => call[0] === "restart").length, 0, "弹层开启期间快捷键仍然生效");
  } finally {
    env.teardown();
  }
});

test("resetRound 清掉所有未执行的调度，绝不让上一局的定时器打到新局上", () => {
  const env = setup();
  try {
    const pending = env.ui.animate([{ type: "corner", index: 0 }]);
    assert.ok(env.clock.pending > 0);
    env.ui.resetRound();
    assert.equal(env.clock.pending, 0, "换局后仍有上一局的定时器在排队");
    env.clock.flush();
    assert.equal(env.ui.cells[0].classList.contains(CLS.corner), false);
    assert.ok(env.ui.isAnimating() === false);
    void pending;
  } finally {
    env.teardown();
  }
});

// ═══ 与 game.mjs 的契约闭合 ════════════════════════════════════

test("残局快照能驱动残局专属 UI：目标分差、星级、下一题", () => {
  const env = setup();
  try {
    const view = {
      ...baseView(),
      mode: MODES.PUZZLE,
      moveCount: 6,
      over: true,
      puzzle: { id: "p0101", chapter: 1, chapterKey: "cornerstone", side: BLACK, target: 54, plies: 6, wrongRetry: false, firstMoveOptimal: true, status: "solved", stars: 3 },
      report: { moves: 6, black: 59, white: 5, winner: BLACK, diff: 54, perfect: false, maxFlip: { moveNo: 1, index: 63, flips: 6 }, swing: { moveNo: 1, index: 63, swing: 7 }, resigned: false },
    };
    env.ui.render(view, { records: defaultState().records, showMobility: true });
    assert.equal(env.doc.getElementById("result-layer").hidden, false, "终局未弹出结算");
    assert.equal(env.doc.getElementById("result-stars").textContent, "\u2605\u2605\u2605");
    assert.equal(env.doc.getElementById("result-next").dataset.puzzle, "p0102", "下一题没有指向 p0102");
    assert.equal(env.doc.getElementById("status").textContent, "正解");
  } finally {
    env.teardown();
  }
});

test("对弈结算卡展示终局比分与档案三行，认输不伪装成完美局", () => {
  const env = setup();
  try {
    const view = {
      ...baseView(),
      over: true,
      report: {
        moves: 30, black: 38, white: 26, winner: BLACK, diff: 12, perfect: false, resigned: false,
        maxFlip: { moveNo: 12, index: 19, flips: 5 }, swing: { moveNo: 12, index: 19, swing: 9 },
      },
    };
    env.ui.render(view, { records: defaultState().records, showMobility: true });
    assert.equal(env.doc.getElementById("result-title").textContent, "你赢了");
    assert.equal(env.doc.getElementById("result-score").textContent, "终局比分 38 : 26");
    assert.match(env.doc.getElementById("report-maxflip").textContent, /d3/);
    assert.equal(env.doc.getElementById("report-note").hidden, true, "非完美局不该出现完美局徽记");

    const resigned = { ...view, report: { ...view.report, winner: WHITE, resigned: true } };
    env.ui.resetRound();
    env.ui.render(resigned, { records: defaultState().records, showMobility: true });
    assert.equal(env.doc.getElementById("result-title").textContent, "你输了");
    assert.equal(env.doc.getElementById("result-score").textContent, "终局比分 38 : 26", "认输必须保留真实子数");
  } finally {
    env.teardown();
  }
});

test("冲刺结算展示得分与连击，并区分新纪录", () => {
  const env = setup();
  try {
    const records = defaultState().records;
    records.rush.bestScore = 10;
    const view = {
      ...baseView(),
      mode: MODES.RUSH,
      over: true,
      rush: { score: 240, combo: 9, multiplier: 2.5, moves: 22, timeLeftMs: 0, turnLeftMs: 6000, over: true, bonus: 0 },
      report: { moves: 22, black: 40, white: 24, winner: BLACK, diff: 16, perfect: false, maxFlip: null, swing: null },
    };
    env.ui.render(view, { records, showMobility: true });
    assert.equal(env.doc.getElementById("result-score").textContent, "本次得分 240");
    assert.equal(env.doc.getElementById("report-note").textContent, "新纪录");
  } finally {
    env.teardown();
  }
});

// ── 供构造"最小可用快照"的底线字段 ─────────────────────────────
function baseView() {
  const board = new Array(64).fill(EMPTY);
  board[27] = BLACK;
  board[28] = WHITE;
  board[35] = WHITE;
  board[36] = BLACK;
  return {
    mode: MODES.PLAY,
    rules: "wof",
    tier: "duelist",
    human: BLACK,
    pvp: false,
    blitz: false,
    opening: "standard",
    status: "playing",
    board,
    current: BLACK,
    lastMove: -1,
    moveCount: 0,
    legal: [19, 26, 37, 44],
    threat: [18, 20, 34],
    hint: -1,
    spend: { undo: 3, hint: 3, undoLimit: 3, hintLimit: 3 },
    thinking: false,
    busy: false,
    pending: null,
    over: false,
    report: null,
    forecast: null,
    graph: [{ moveNo: 0, black: 2, white: 2, player: EMPTY, index: -1, flips: 0 }],
    blitzLeft: 10000,
    puzzle: null,
    rush: null,
  };
}
