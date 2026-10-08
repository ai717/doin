// Eight-ball rule machine: fouls, group claim, rotation, 8-ball outcomes.
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createRules, resolveShot, analyseShot, legalTargets, legalTargetIds,
  groupRemaining, liveObjectBalls, onEightBall, respotEight, groupOfNumber,
} from "../js/rules.mjs";
import { makeBall } from "../js/engine.mjs";

function table(...numbers) {
  const balls = [makeBall(0, 14, 14)];
  numbers.forEach((n, i) => balls.push(makeBall(n, 30 + i * 2, 8 + (i % 3) * 4)));
  return balls;
}

function shot(facts, balls, rules) {
  return resolveShot(rules, { potted: [], railAfter: 1, railTotal: 1, firstContact: null, ...facts }, balls);
}

describe("group model", () => {
  it("maps numbers to the classic groups", () => {
    assert.equal(groupOfNumber(0), "cue");
    assert.equal(groupOfNumber(7), "solid");
    assert.equal(groupOfNumber(8), "eight");
    assert.equal(groupOfNumber(9), "stripe");
  });

  it("solo trial treats every object ball as legal until only the 8 is left", () => {
    const rules = createRules("clear");
    const balls = table(1, 9, 8);
    assert.equal(legalTargets(rules, balls).length, 2);
    balls.filter((b) => b.id !== 0 && b.id !== 8).forEach((b) => { b.potted = true; });
    assert.deepEqual(legalTargets(rules, balls).map((b) => b.id), [8]);
    assert.equal(onEightBall(rules, balls), true);
  });

  it("versus mode locks the group after the first legal pot", () => {
    const rules = createRules("duel");
    const balls = table(1, 2, 9, 10);
    rules.breakPending = false;
    const report = shot({ firstContact: 3, potted: [3], pottedCount: 1 }, balls, rules);
    void report;
    // no ball 3 present, so nothing was claimed; use a real one instead
    const rules2 = createRules("duel");
    rules2.breakPending = false;
    const report2 = shot({ firstContact: 1, potted: [1], pottedCount: 1 }, balls, rules2);
    assert.equal(report2.claimed, "solid");
    assert.deepEqual(rules2.groups, ["solid", "stripe"]);
    assert.equal(rules2.open, false);
  });

  it("versus mode keeps the table open on the break", () => {
    const rules = createRules("duel");
    const balls = table(1, 2, 9, 10);
    const report = shot({ firstContact: 1, potted: [1], pottedCount: 1, railBallIds: [1, 2, 9, 10] }, balls, rules);
    assert.equal(report.claimed, null, "the break never claims a group");
    assert.equal(rules.open, true);
    assert.equal(report.continueTurn, true);
  });
});

describe("fouls", () => {
  it("flags an illegal break when nothing drops and fewer than four balls hit a rail", () => {
    const rules = createRules("clear");
    const report = shot({ firstContact: 1, pottedCount: 0, railBallIds: [1, 2] }, table(1, 2, 9), rules);
    assert.equal(report.foul, true);
    assert.equal(report.reason, "illegal_break");
  });

  it("accepts a break that drives four balls into rails", () => {
    const rules = createRules("clear");
    const report = shot({ firstContact: 1, pottedCount: 0, railBallIds: [1, 2, 9, 10] }, table(1, 2, 9, 10), rules);
    assert.equal(report.foul, false);
  });

  it("scratch is a foul that hands over ball in hand", () => {
    const rules = createRules("duel");
    rules.breakPending = false;
    const report = shot({ firstContact: 1, potted: [0, 1], pottedCount: 2, cuePotted: true }, table(1, 9), rules);
    assert.equal(report.foul, true);
    assert.equal(report.reason, "scratch");
    assert.equal(rules.ballInHand, true);
    assert.equal(rules.turn, 1, "the table passes over");
  });

  it("hitting the wrong ball first is a foul", () => {
    const rules = createRules("duel");
    rules.breakPending = false;
    rules.groups = ["solid", "stripe"];
    rules.open = false;
    const report = shot({ firstContact: 9, pottedCount: 0 }, table(1, 9), rules);
    assert.equal(report.foul, true);
    assert.equal(report.reason, "wrong_ball");
  });

  it("no rail after contact and no pot is a foul", () => {
    const rules = createRules("clear");
    rules.breakPending = false;
    const report = shot({ firstContact: 1, pottedCount: 0, railAfter: 0 }, table(1, 9), rules);
    assert.equal(report.foul, true);
    assert.equal(report.reason, "no_rail");
  });

  it("a clean pot keeps the shooter at the table", () => {
    const rules = createRules("clear");
    rules.breakPending = false;
    const report = shot({ firstContact: 1, potted: [1], pottedCount: 1 }, table(1, 9), rules);
    assert.equal(report.foul, false);
    assert.equal(report.continueTurn, true);
    assert.equal(rules.run, 1);
  });

  it("solo trial charges a stroke instead of the table", () => {
    const rules = createRules("clear");
    rules.breakPending = false;
    shot({ firstContact: 1, pottedCount: 0, railAfter: 0 }, table(1, 9), rules);
    assert.equal(rules.turn, 0, "no turn to hand over in solo");
    assert.equal(rules.shots[0], 1);
    assert.equal(rules.fouls[0], 1);
    assert.equal(rules.ballInHand, true);
  });
});

describe("eight ball", () => {
  it("potting the 8 early loses the frame in versus mode", () => {
    const rules = createRules("duel");
    rules.breakPending = false;
    rules.groups = ["solid", "stripe"];
    rules.open = false;
    const report = shot({ firstContact: 1, potted: [8], pottedCount: 1, eightPotted: true }, table(1, 8), rules);
    assert.equal(report.loseEight, true);
    assert.equal(rules.winner, 1);
    assert.equal(rules.phase, "over");
  });

  it("the 8 with a scratch loses immediately", () => {
    const rules = createRules("duel");
    rules.breakPending = false;
    rules.groups = ["solid", "stripe"];
    rules.open = false;
    const balls = table(8);
    const report = shot({ firstContact: 8, potted: [8, 0], pottedCount: 2, eightPotted: true, cuePotted: true }, balls, rules);
    assert.equal(report.loseEight, true);
    assert.equal(rules.winner, 1);
  });

  it("a legal 8 after clearing the group wins", () => {
    const rules = createRules("duel");
    rules.breakPending = false;
    rules.groups = ["solid", "stripe"];
    rules.open = false;
    const balls = [makeBall(0, 14, 14), makeBall(8, 30, 14)];
    const report = shot({ firstContact: 8, potted: [8], pottedCount: 1, eightPotted: true }, balls, rules);
    assert.equal(report.winEight, true);
    assert.equal(rules.winner, 0);
    assert.equal(rules.phase, "over");
  });

  it("solo trial respots the 8 rather than dead ending", () => {
    const rules = createRules("clear");
    rules.breakPending = false;
    const balls = table(1, 8);
    const report = shot({ firstContact: 1, potted: [8], pottedCount: 1, eightPotted: true }, balls, rules);
    assert.equal(report.loseEight, true);
    assert.equal(rules.winner, null, "solo never hands the table over");
    assert.equal(rules.phase, "aim");
    assert.equal(respotEight(balls, 42, 14), true);
    assert.equal(balls.find((b) => b.id === 8).potted, false);
  });
});

describe("fact extraction", () => {
  it("reads first contact, pots and rails from the event tail", () => {
    const events = [
      { type: "strike", power: 0.6 },
      { type: "rail", id: 0, speed: 40 },
      { type: "clack", a: 0, b: 5, speed: 30 },
      { type: "rail", id: 5, speed: 20 },
      { type: "pocket", id: 5 },
      { type: "pocket", id: 0 },
    ];
    const facts = analyseShot(events);
    assert.equal(facts.firstContact, 5);
    assert.equal(facts.railAfter, 1);
    assert.equal(facts.railTotal, 2);
    assert.deepEqual(facts.potted, [5, 0]);
    assert.equal(facts.cuePotted, true);
    assert.equal(facts.eightPotted, false);
  });

  it("an empty tail is a whiff", () => {
    const facts = analyseShot([{ type: "strike" }]);
    assert.equal(facts.firstContact, null);
    assert.equal(facts.pottedCount, 0);
  });
});

describe("counters", () => {
  it("tracks what is left of each group", () => {
    const balls = table(1, 2, 9, 10, 8);
    assert.equal(groupRemaining(balls, "solid"), 2);
    assert.equal(groupRemaining(balls, "stripe"), 2);
    assert.equal(liveObjectBalls(balls).length, 4);
    assert.equal(legalTargetIds(createRules("clear"), balls).has(8), false);
  });
});
