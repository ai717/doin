import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mulberry32,
  createInitialState,
  stepFrame,
  enqueueAction,
  cancelAction,
  solveAbacus,
  quickPay,
  checkInvariants,
  getTableCoordinates,
  getLegalActions,
  DISHES,
  GUEST_TYPES,
  SHIFTS,
} from "../js/engine.mjs";

describe("engine.mjs rules and determinism", () => {
  it("mulberry32 generates deterministic sequences", () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    for (let i = 0; i < 20; i++) {
      assert.equal(rng1(), rng2());
    }
  });

  it("createInitialState creates ready Instant Play board", () => {
    const state = createInitialState({ shiftId: "shift_lunch", seed: 999 });
    assert.equal(state.shiftId, "shift_lunch");
    assert.equal(state.status, "playing");
    assert.equal(state.tables.length, 4);
    assert.equal(state.waiter.maxCapacity, 2);
    assert.equal(state.waiter.tray.length, 0);
    // Instant play: Table 0 has an arriving/ordering customer
    assert.ok(state.tables[0].guest);
    assert.equal(state.tables[0].status, "occupied");
    checkInvariants(state);
  });

  it("table coordinates scale by count", () => {
    assert.equal(getTableCoordinates(4).length, 4);
    assert.equal(getTableCoordinates(6).length, 6);
    assert.equal(getTableCoordinates(8).length, 8);
  });

  it("tray capacity expands with upgrade", () => {
    const normal = createInitialState({ upgrades: { tray: false } });
    assert.equal(normal.waiter.maxCapacity, 2);

    const upgraded = createInitialState({ upgrades: { tray: true } });
    assert.equal(upgraded.waiter.maxCapacity, 3);
  });

  it("enqueue and cancel actions in queue", () => {
    let state = createInitialState();
    state = enqueueAction(state, { type: "fetch_tea" });
    state = enqueueAction(state, { type: "fetch_dish", dishId: "dish_noodles" });
    assert.equal(state.actionQueue.length, 2);

    const firstId = state.actionQueue[0].id;
    state = cancelAction(state, firstId);
    assert.equal(state.actionQueue.length, 1);
    assert.equal(state.actionQueue[0].type, "fetch_dish");
  });

  it("quickPay settles bill and awards silver", () => {
    let state = createInitialState();
    // Simulate table 0 finished eating and ready to pay
    const guest = state.tables[0].guest;
    guest.state = "paying";
    guest.bill = 28;
    guest.patience = 60; // > 50 gives tip

    const prevSilver = state.silver;
    state = quickPay(state, { tableId: 0 });

    assert.ok(state.silver > prevSilver + 28); // bill + tip
    assert.equal(state.tables[0].status, "dirty");
    assert.equal(state.tables[0].guest, null);
    assert.equal(state.servedCount, 1);
    assert.equal(state.combo, 1);
  });

  it("solveAbacus rejects mismatched amount", () => {
    let state = createInitialState();
    const guest = state.tables[0].guest;
    guest.state = "paying";
    guest.bill = 30;

    const prevSilver = state.silver;
    state = solveAbacus(state, { tableId: 0, enteredSilver: 25 });
    // Silver unchanged, table still paying
    assert.equal(state.silver, prevSilver);
    assert.equal(state.tables[0].guest.state, "paying");
  });

  it("patience decay leads to walkout when unserved", () => {
    let state = createInitialState();
    const guest = state.tables[0].guest;
    guest.state = "waiting";
    guest.patience = 5;

    // Advance frame
    state = stepFrame(state, 4.0);
    assert.equal(state.lostGuests, 1);
    assert.equal(state.tables[0].status, "dirty");
    assert.equal(state.tables[0].guest, null);
  });

  it("1000+ step random walk invariant check", () => {
    let state = createInitialState({ shiftId: "shift_dinner", seed: 8888 });

    for (let step = 0; step < 1200; step++) {
      const dt = 0.05;
      state = stepFrame(state, dt);
      checkInvariants(state);

      // Random player decisions
      if (Math.random() < 0.25) {
        const legal = getLegalActions(state);
        if (legal.length > 0) {
          const act = legal[Math.floor(Math.random() * legal.length)];
          state = enqueueAction(state, act);
        }
      }

      // Check if any paying table
      const paying = state.tables.find((t) => t.guest && t.guest.state === "paying");
      if (paying && Math.random() < 0.4) {
        state = quickPay(state, { tableId: paying.id });
      }

      if (state.status !== "playing") {
        // Reset and continue test
        state = createInitialState({ shiftId: "shift_night", seed: step + 1 });
      }
    }
  });
});
