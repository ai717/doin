// smoke.test.mjs - boots the real wiring against a DOM stub: fill the tape,
// step to a win, unlock the next stage, switch language without a reload.
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createDom } from "./dom-stub.mjs";
import { boot } from "../js/main.mjs";
import { loadDraft, loadProgress, loadLocale, resetBackendForTests } from "../js/storage.mjs";
import { getLevel, LEVELS } from "../js/levels.mjs";

const html = readFileSync(join(import.meta.dirname, "..", "index.html"), "utf8");
const wait = () => new Promise((resolve) => setTimeout(resolve, 0));

function env() {
  const dom = createDom(html);
  const handle = boot(dom.doc);
  return { ...dom, handle };
}

async function play(handle, codes, limit = 12) {
  for (const code of codes) {
    assert.equal(handle.fill(code), true, `could not fill ${code}`);
  }
  for (let i = 0; i < limit; i += 1) {
    if (handle.view().settled) break;
    handle.step();
    await wait();
  }
  return handle.view();
}

beforeEach(() => {
  resetBackendForTests();
});

describe("smoke: first frame", () => {
  it("boots straight into stage 1 with a rendered board and an empty tape", () => {
    const { handle, byId } = env();
    const view = handle.view();
    assert.equal(view.levelId, 1);
    assert.equal(view.lines, 0);
    assert.equal(view.canRun, false);
    assert.equal(byId.get("slots-main").children.length, view.slots.main);
    assert.equal(byId.get("palette-row").children.length, view.palette.length);
    assert.ok(byId.get("tile-layer").children.length > 0, "no tiles were drawn");
    assert.equal(byId.get("robot-layer").children.length, 1, "robot node is missing");
    assert.equal(byId.get("help-panel").hidden, true);
    assert.equal(byId.get("result-panel").hidden, true);
    assert.equal(byId.get("level-panel").hidden, true);
    assert.equal(byId.get("proc-block").hidden, true, "stage 1 has no PROC1");
  });

  it("refuses tiles the stage does not unlock", () => {
    const { handle, byId } = env();
    assert.equal(handle.place("main", 0, "J"), false);
    assert.equal(byId.get("slots-main").children[0].textContent, "");
    assert.equal(handle.view().lines, 0);
  });
});

describe("smoke: solve stage 1 by hand", () => {
  it("fills the gold program, steps to a win and records three stars", async () => {
    const { handle, byId } = env();
    const gold = getLevel(1).gold.main.filter(Boolean);
    const view = await play(handle, gold);

    assert.equal(view.status, "won");
    assert.equal(view.lines, getLevel(1).par);
    assert.equal(view.stars, 3);
    assert.equal(view.litCount, view.lamps);
    assert.equal(byId.get("result-panel").hidden, false);
    assert.equal(byId.get("result-next").hidden, false);
    assert.match(byId.get("result-stars").textContent, /★★★/);
    assert.equal(loadProgress().cleared[1], 3);
    assert.ok(loadDraft(1), "the winning draft was not persisted");
  });

  it("unlocks stage 2 and loads it from the result sheet", async () => {
    const { handle, byId } = env();
    await play(handle, getLevel(1).gold.main.filter(Boolean));
    byId.get("result-next").dispatch("click");
    assert.equal(handle.view().levelId, 2);
    assert.equal(handle.view().lines, 0);
    assert.equal(byId.get("result-panel").hidden, true);
    assert.equal(byId.get("proc-block").hidden, true);
  });

  it("a wrong program halts without pretending to win", async () => {
    const { handle, byId } = env();
    const view = await play(handle, ["F"]);
    assert.equal(view.status, "halted");
    assert.equal(view.stars, 0);
    assert.equal(byId.get("result-panel").hidden, true, "a failure must not open the win sheet");
    assert.equal(byId.get("toast").hidden, false);
    assert.equal(loadProgress().clearedCount, 0);
  });
});

describe("smoke: tape editing", () => {
  it("removes a tile from a slot and drops the line count", async () => {
    const { handle } = env();
    handle.fill("F");
    handle.fill("A");
    assert.equal(handle.view().lines, 2);
    handle.ui.armSlot("main", 0);
    assert.equal(handle.view().lines, 1);
    assert.equal(handle.view().program.main[0], "");
  });

  it("clear empties both rows in one go", async () => {
    const { handle } = env();
    handle.fill("F");
    handle.fill("A");
    handle.clear();
    assert.equal(handle.view().lines, 0);
    assert.deepEqual(handle.view().program.main.filter(Boolean), []);
  });

  it("step from idle shows the first executed frame", async () => {
    const { handle } = env();
    handle.fill("F");
    assert.equal(handle.view().cursor, 0);
    handle.step();
    assert.equal(handle.view().cursor, 1);
    assert.equal(handle.view().status, "paused");
  });
});

describe("smoke: level book and language", () => {
  it("opens the stage book with only stage 1 unlocked", () => {
    const { handle, byId } = env();
    handle.openLevels();
    assert.equal(byId.get("level-panel").hidden, false);
    const buttons = byId.get("level-grid").querySelectorAll(".level-btn");
    assert.equal(buttons.length, LEVELS.length);
    assert.equal(buttons[0].disabled, false);
    assert.equal(buttons[1].disabled, true, "stage 2 waits for stage 1");
    assert.equal(buttons[2].disabled, true);
    assert.match(byId.get("level-progress").textContent, /0\/21/);
  });

  it("switches language in place without rebuilding the board", async () => {
    const { handle, byId, doc } = env();
    const tilesBefore = byId.get("tile-layer").children.length;
    const slotsBefore = byId.get("slots-main").children.length;
    handle.applyLocale("en");
    assert.equal(doc.documentElement.getAttribute("lang"), "en");
    assert.match(byId.get("hud-level").textContent, /Stage 1/);
    assert.equal(byId.get("tile-layer").children.length, tilesBefore);
    assert.equal(byId.get("slots-main").children.length, slotsBefore);
    assert.equal(byId.get("level-panel").hidden, true);
    assert.equal(loadLocale(), "en");
  });

  it("jumps straight to an unlocked stage from the debug handle", () => {
    const { handle } = env();
    handle.startLevel(1);
    assert.equal(handle.view().levelId, 1);
    assert.equal(handle.overlay(), "none");
  });
});
