// smoke.test.mjs - real wiring run against a minimal DOM (no browser).
// Covers the seams that pure-logic and static-contract tests cannot see:
// SVG board build, select -> target -> play -> persist, in-place locale
// switch, overlay DOM truth, undo, sound and restart.
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createDom } from "./dom-stub.mjs";
import {
  loadLocale, loadPuzzleProgress, loadRun, loadSound, resetBackendForTests,
} from "../js/storage.mjs";
import { getPuzzle } from "../js/puzzles.mjs";

const html = readFileSync(join(import.meta.dirname, "..", "index.html"), "utf8");
// Import before installing document so main.mjs does not auto-boot twice.
const { boot } = await import("../js/main.mjs");

let env;
let handle;

function click(id, target) {
  const node = env.byId.get(id);
  assert.ok(node, `missing #${id}`);
  node.dispatch("click", target ? { target } : {});
}

function clickBoard(node) {
  env.byId.get("board").dispatch("click", { target: node });
}

function clickTargetNode(to) {
  const node = env.byId.get("target-layer").children
    .find((child) => child.getAttribute("data-hole") === String(to));
  assert.ok(node, `no rendered landing for hole ${to}`);
  clickBoard(node);
}

function playStudyMove(step) {
  const move = handle.game.currentMoves()
    .find((m) => m.from === step.from && m.to === step.to);
  assert.ok(move, `study answer ${step.from}->${step.to} is not offered`);
  assert.equal(handle.ui.select(move.from), true);
  clickTargetNode(move.to);
}

function playFirstMove() {
  const moves = handle.game.currentMoves();
  assert.ok(moves.length, "no legal move at the opening");
  const from = moves[0].from;
  assert.equal(handle.ui.select(from), true, "selecting a marble must expose targets");
  const targetNode = env.byId.get("target-layer").children[0];
  assert.ok(targetNode, "no highlighted landing was rendered");
  clickBoard(targetNode);
  return moves[0];
}

beforeEach(() => {
  resetBackendForTests();
  env = createDom(html);
  globalThis.document = env.doc;
  globalThis.window = globalThis;
  handle = boot(env.doc);
});

afterEach(() => {
  handle?.game.destroy();
  delete globalThis.document;
  delete globalThis.window;
  delete globalThis.__checkers;
});

describe("smoke: boot", () => {
  it("renders 121 holes / 20 marbles and exposes the getter-based handle", () => {
    assert.equal(env.byId.get("hole-layer").children.length, 121);
    assert.equal(env.byId.get("marble-layer").children.length, 20);
    assert.equal(globalThis.__checkers, handle);
    assert.equal(handle.view().state.status, "playing");
    assert.equal(handle.view().humanTurn, true);
    assert.equal(env.byId.get("help-panel").hidden, true);
    assert.equal(env.byId.get("result-panel").hidden, true);
    assert.equal(handle.overlay(), "none");
  });

  it("all static i18n nodes were translated on boot", () => {
    assert.equal(env.byId.get("game-title").textContent, "中国跳棋");
    assert.equal(env.byId.get("help-close").textContent, "关闭");
    assert.equal(env.doc.documentElement.lang, "zh-CN");
  });
});

describe("smoke: one full move", () => {
  it("select -> highlighted landing -> play -> engine + save", () => {
    handle.startRun({ mode: "pvp" });
    assert.ok(env.byId.get("target-layer").children.length === 0);
    assert.equal(handle.ui.select(handle.game.currentMoves()[0].from), true);
    assert.ok(env.byId.get("target-layer").children.length > 0, "targets must light up");

    const targetNode = env.byId.get("target-layer").children[0];
    const to = Number(targetNode.getAttribute("data-hole"));
    clickBoard(targetNode);

    const view = handle.view();
    assert.equal(view.state.history.length, 1, "the controller did not accept the move");
    assert.equal(view.state.history[0].to, to);
    const saved = loadRun();
    assert.ok(saved, "a finished move must be persisted");
    assert.equal(saved.moves.length, 1);
    assert.deepEqual(saved.moves[0], { from: view.state.history[0].from, to });
    assert.equal(env.byId.get("marble-layer").children.length, 20);
  });

  it("hovering a landing draws a chain trail, leaving selection clears it", () => {
    handle.startRun({ mode: "pvp" });
    const from = handle.game.currentMoves()[0].from;
    handle.ui.select(from);
    const targetNode = env.byId.get("target-layer").children[0];
    env.byId.get("board").dispatch("pointerover", { target: targetNode });
    assert.ok(env.byId.get("trail-layer").children.length > 0, "trail was not drawn");
    handle.ui.clearSelection();
    assert.equal(env.byId.get("trail-layer").children.length, 0);
    assert.equal(handle.ui.state().selected, null);
  });
});

describe("smoke: live updates without resetting the game", () => {
  it("switching language keeps the exact board and rewrites the DOM", () => {
    handle.startRun({ mode: "pvp" });
    playFirstMove();
    const before = handle.view().state.board.join("");
    const plies = handle.view().stats.plies;

    click("btn-lang");
    assert.equal(env.doc.documentElement.lang, "en");
    assert.equal(env.byId.get("game-title").textContent, "Chinese Checkers");
    assert.equal(env.byId.get("help-close").textContent, "Close");
    assert.equal(loadLocale(), "en");
    assert.equal(handle.view().state.board.join(""), before, "locale switch reset the board");
    assert.equal(handle.view().stats.plies, plies);

    click("btn-lang");
    assert.equal(env.doc.documentElement.lang, "zh-CN");
    assert.equal(env.byId.get("game-title").textContent, "中国跳棋");
  });

  it("overlay visibility is reflected in the DOM, not just internal state", () => {
    click("btn-help");
    assert.equal(handle.overlay(), "help");
    assert.equal(env.byId.get("help-panel").hidden, false);
    click("help-close");
    assert.equal(env.byId.get("help-panel").hidden, true);
    assert.equal(handle.overlay(), "none");

    click("btn-help");
    env.doc.dispatch("keydown", { key: "Escape" });
    assert.equal(env.byId.get("help-panel").hidden, true);
  });

  it("sound toggle persists and updates the button glyph", () => {
    assert.equal(loadSound(), true);
    assert.equal(env.byId.get("btn-sound").textContent, "🔊");
    click("btn-sound");
    assert.equal(loadSound(), false);
    assert.equal(env.byId.get("btn-sound").textContent, "🔇");
  });
});

describe("smoke: controls", () => {
  it("undo in PVP rewinds exactly one ply", () => {
    handle.startRun({ mode: "pvp" });
    playFirstMove();
    assert.equal(handle.view().state.history.length, 1);
    assert.equal(env.byId.get("btn-undo").disabled, false);
    click("btn-undo");
    assert.equal(handle.view().state.history.length, 0);
    assert.equal(env.byId.get("btn-undo").disabled, true);
  });

  it("mode and difficulty chips change config without a reload", () => {
    const before = handle.view().state.board.join("");
    env.doc.querySelector('[data-mode="pvp"]').dispatch("click");
    assert.equal(handle.view().config.mode, "pvp");
    const diffChip = env.doc.querySelector('[data-difficulty="master"]');
    assert.equal(diffChip.disabled, true, "difficulty is meaningless in local 2P");

    env.doc.querySelector('[data-mode="pve"]').dispatch("click");
    env.doc.querySelector('[data-difficulty="master"]').dispatch("click");
    assert.equal(handle.view().config.difficulty, "master");
    assert.equal(handle.view().state.board.join(""), before, "difficulty change must not reset the board");
  });

  it("restart clears the position and the saved run", () => {
    handle.startRun({ mode: "pvp" });
    playFirstMove();
    assert.equal(loadRun().moves.length, 1);
    click("btn-restart");
    assert.equal(handle.view().state.history.length, 0);
    assert.equal(loadRun().moves.length, 0);
    assert.equal(env.byId.get("toast").hidden, false);
    assert.equal(handle.view().humanTurn, true);
  });
});

describe("smoke: chain-hop studies", () => {
  it("the studies chip opens a drawer with 20 stages in 4 chapters", () => {
    env.doc.querySelector('[data-mode="puzzle"]').dispatch("click");
    assert.equal(handle.overlay(), "levels");
    assert.equal(env.byId.get("level-panel").hidden, false);
    const grid = env.byId.get("level-grid");
    assert.equal(grid.querySelectorAll("[data-level]").length, 20);
    assert.equal(grid.querySelectorAll(".level-chapter").length, 4);
    assert.equal(handle.view().config.mode, "pve", "opening the drawer must not change the duel");
  });

  it("clicking a stage button starts that stage and closes the drawer", () => {
    handle.openLevels();
    const button = env.doc.querySelector('[data-level="7"]');
    assert.ok(button);
    env.byId.get("level-grid").dispatch("click", { target: button });
    assert.equal(handle.overlay(), "none");
    assert.equal(env.byId.get("level-panel").hidden, true);
    assert.equal(handle.view().config.mode, "puzzle");
    assert.equal(handle.view().puzzle.id, 7);
    assert.equal(handle.view().puzzle.goal, getPuzzle(7).goal);
  });

  it("a study lights exactly one goal hole and never overwrites the duel save", () => {
    const level = getPuzzle(1);
    handle.startPuzzle(1);
    assert.equal(handle.view().state.board[level.goal], 0);
    assert.equal(env.byId.get("puzzle-info").hidden, false);
    assert.equal(env.byId.get("ticks-row").hidden, true);
    assert.equal(env.byId.get("puzzle-level").textContent, "1");
    assert.equal(env.byId.get("puzzle-par").textContent, String(level.par));
    assert.equal(env.byId.get("puzzle-left").textContent, String(level.par));
    const goals = env.byId.get("hole-layer").querySelectorAll(".is-goal");
    assert.equal(goals.length, 1);
    assert.equal(goals[0].getAttribute("data-hole"), String(level.goal));
    assert.equal(env.byId.get("hint").textContent, "把红弹珠送进金色目标孔");
    assert.equal(loadRun(), null);
  });

  it("solving a stage shows the next-stage action and stores three stars", () => {
    const level = getPuzzle(1);
    handle.startPuzzle(1);
    for (const step of level.solution) playStudyMove(step);
    assert.equal(handle.overlay(), "result");
    assert.equal(env.byId.get("result-panel").hidden, false);
    assert.equal(env.byId.get("result-next").hidden, false);
    assert.equal(env.byId.get("result-again").textContent, "重解本关");
    assert.equal(handle.view().state.board[level.goal], 1);
    assert.equal(loadPuzzleProgress().cleared[1], 3);
    assert.equal(loadPuzzleProgress().totalStars, 3);
  });

  it("next stage advances without leaving studies, retry replays the same board", () => {
    handle.startPuzzle(1);
    for (const step of getPuzzle(1).solution) playStudyMove(step);
    click("result-next");
    assert.equal(handle.overlay(), "none");
    assert.equal(handle.view().config.mode, "puzzle");
    assert.equal(handle.view().puzzle.id, 2);
    assert.equal(env.byId.get("puzzle-level").textContent, "2");

    const before = handle.view().state.board.join("");
    click("result-again"); // no overlay now; the button is still wired
    assert.equal(handle.view().state.board.join(""), before);
  });

  it("a wrong line toasts instead of blocking the board, and undo retries", () => {
    const level = getPuzzle(1);
    handle.startPuzzle(1);
    const answer = level.solution[0];
    const wrong = handle.game.currentMoves()
      .find((m) => !(m.from === answer.from && m.to === answer.to));
    assert.ok(wrong);
    assert.equal(handle.ui.select(wrong.from), true);
    clickTargetNode(wrong.to);
    assert.equal(handle.overlay(), "none");
    assert.equal(env.byId.get("result-panel").hidden, true);
    assert.equal(env.byId.get("toast").hidden, false);
    assert.match(env.byId.get("toast").textContent, /步数用尽/);
    assert.equal(handle.view().puzzle.failed, true);
    assert.equal(env.byId.get("btn-undo").disabled, false);
    click("btn-undo");
    assert.equal(handle.view().finished, null);
    assert.equal(handle.view().humanTurn, true);
    assert.equal(handle.view().puzzle.left, level.par);
  });

  it("locale switching keeps the study board and re-labels the drawer", () => {
    handle.startPuzzle(3);
    const before = handle.view().state.board.join("");
    handle.openLevels();
    const zhChapter = env.byId.get("level-grid").querySelector(".level-chapter").textContent;
    click("btn-lang");
    assert.equal(handle.overlay(), "levels");
    const enChapter = env.byId.get("level-grid").querySelector(".level-chapter").textContent;
    assert.equal(enChapter, "First Flight");
    assert.notEqual(enChapter, zhChapter);
    assert.equal(handle.view().state.board.join(""), before, "locale switch reset the study board");
    assert.equal(env.byId.get("puzzle-info").hidden, false);
    assert.equal(env.byId.get("hint").textContent, "Land a red marble on the golden hole");
  });
});
