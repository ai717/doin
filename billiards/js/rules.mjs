// Eight-ball rule machine. Pure logic over facts gathered from the simulator,
// strictly DOM-free. Two modes share one attempt/min->shot structure:
//   "clear" - solo trial, fouls cost a shot instead of the table
//   "duel"  - hot seat two player game with full rotation rules

export const MODES = Object.freeze(["clear", "duel"]);
export const GROUPS = Object.freeze(["solid", "stripe"]);

export function groupOfNumber(number) {
  if (number === 0) return "cue";
  if (number === 8) return "eight";
  return number < 8 ? "solid" : "stripe";
}

export function otherGroup(group) {
  return group === "solid" ? "stripe" : "solid";
}

export function createRules(mode = "clear", options = {}) {
  const players = mode === "duel" ? 2 : 1;
  return {
    mode,
    players,
    turn: 0,
    phase: "aim",
    open: true,
    groups: new Array(2).fill(null),
    shots: new Array(2).fill(0),
    fouls: new Array(2).fill(0),
    run: 0,
    bestRun: 0,
    breakPending: Boolean(options.breakPending ?? true),
    ballInHand: false,
    winner: null,
    lastFoul: null,
    lastEvent: null,
    pottedCount: new Array(2).fill(0),
  };
}

export function cloneRules(rules) {
  return {
    ...rules,
    groups: rules.groups.slice(),
    shots: rules.shots.slice(),
    fouls: rules.fouls.slice(),
    pottedCount: rules.pottedCount.slice(),
  };
}

export function groupRemaining(balls, group) {
  let n = 0;
  for (const b of balls) {
    if (b.potted || groupOfNumber(b.number) !== group) continue;
    n += 1;
  }
  return n;
}

export function liveObjectBalls(balls) {
  return balls.filter((b) => !b.potted && b.id !== 0 && b.id !== 8);
}

export function eightLive(balls) {
  return balls.some((b) => b.id === 8 && !b.potted);
}

/** Balls the current shooter is allowed to contact first. */
export function legalTargets(rules, balls) {
  const objects = liveObjectBalls(balls);
  const eight = balls.find((b) => b.id === 8 && !b.potted);
  if (rules.mode === "clear") {
    return objects.length ? objects : eight ? [eight] : [];
  }
  const group = rules.groups[rules.turn];
  if (!group) return objects;
  const own = objects.filter((b) => groupOfNumber(b.number) === group);
  if (own.length) return own;
  return eight ? [eight] : [];
}

export function legalTargetIds(rules, balls) {
  return new Set(legalTargets(rules, balls).map((b) => b.id));
}

/** True once the shooter's own group is cleared and the 8 is the live target. */
export function onEightBall(rules, balls) {
  const ids = legalTargetIds(rules, balls);
  return ids.size === 1 && ids.has(8);
}

/**
 * Turn the raw event tail into shot facts.
 * `events` is the slice recorded since the shot started.
 */
export function analyseShot(events) {
  let firstContact = null;
  let contactIndex = -1;
  let railAfter = 0;
  let railTotal = 0;
  const potted = [];
  const railBallIds = new Set();
  let cuePotted = false;
  let eightPotted = false;

  for (let i = 0; i < events.length; i += 1) {
    const ev = events[i];
    if (ev.type === "clack") {
      const other = ev.a === 0 ? ev.b : ev.b === 0 ? ev.a : null;
      if (firstContact === null && other !== null) {
        firstContact = other;
        contactIndex = i;
      }
    } else if (ev.type === "rail") {
      railTotal += 1;
      railBallIds.add(ev.id);
      if (contactIndex >= 0 && i > contactIndex) railAfter += 1;
    } else if (ev.type === "pocket") {
      potted.push(ev.id);
      if (ev.id === 0) cuePotted = true;
      if (ev.id === 8) eightPotted = true;
    }
  }
  return {
    firstContact,
    potted,
    pottedCount: potted.length,
    railAfter,
    railTotal,
    railBallIds: [...railBallIds],
    cuePotted,
    eightPotted,
  };
}

function assignGroups(rules, pottedIds) {
  for (const id of pottedIds) {
    const group = groupOfNumber(id);
    if (group !== "solid" && group !== "stripe") continue;
    rules.groups[rules.turn] = group;
    rules.groups[1 - rules.turn] = otherGroup(group);
    rules.open = false;
    return group;
  }
  return null;
}

/**
 * Apply one shot outcome. Returns a report the UI can render directly.
 * `balls` is the live world ball list (already mutated by the simulation).
 */
export function resolveShot(rules, facts, balls) {
  if (rules.phase === "over") {
    return { type: "noop", rules };
  }
  const targetIds = legalTargetIds(rules, balls);
  const wasOpen = rules.open;
  const report = {
    type: "shot",
    foul: false,
    reason: null,
    potted: facts.potted.slice(),
    claimed: null,
    continueTurn: false,
    loseEight: false,
    winEight: false,
    cleared: false,
    breakTaken: false,
  };

  rules.shots[rules.turn] += 1;
  if (rules.breakPending) {
    report.breakTaken = true;
    rules.breakPending = false;
    const railBalls = facts.railBallIds.filter((id) => id !== 0).length;
    if (facts.pottedCount === 0 && railBalls < 4) {
      report.foul = true;
      report.reason = "illegal_break";
    }
  }

  if (facts.cuePotted) {
    report.foul = true;
    report.reason = report.reason ?? "scratch";
  }
  if (facts.firstContact === null && facts.pottedCount === 0) {
    report.foul = true;
    report.reason = report.reason ?? "no_contact";
  }
  if (facts.firstContact !== null && targetIds.size > 0 && !targetIds.has(facts.firstContact)) {
    report.foul = true;
    report.reason = report.reason ?? "wrong_ball";
  }
  if (!report.foul && facts.pottedCount === 0 && facts.railAfter === 0) {
    report.foul = true;
    report.reason = "no_rail";
  }

  const eightLegal = targetIds.has(8) && !report.foul;
  if (facts.eightPotted) {
    if (facts.cuePotted || report.foul || !eightLegal) {
      report.loseEight = true;
      report.reason = report.reason ?? "eight_early";
    } else {
      report.winEight = true;
    }
  }

  if (report.foul) {
    rules.fouls[rules.turn] += 1;
    rules.lastFoul = report.reason;
    rules.run = 0;
  } else {
    const ownCount = facts.potted.filter((id) => id !== 0 && id !== 8).length;
    rules.pottedCount[rules.turn] += ownCount;
    if (ownCount > 0) {
      rules.run += 1;
      rules.bestRun = Math.max(rules.bestRun, rules.run);
    }
  }

  if (wasOpen && rules.mode === "duel" && !report.foul && facts.pottedCount > 0 && !report.breakTaken) {
    report.claimed = assignGroups(rules, facts.potted);
  }

  const canPotEight = rules.mode === "clear" && facts.eightPotted && eightLegal;
  if (report.loseEight) {
    if (rules.mode === "duel") {
      rules.winner = 1 - rules.turn;
      rules.phase = "over";
      rules.lastEvent = "lose_eight";
      return report;
    }
    // Solo trial: never a dead end, the 8 comes back on the foot spot.
    report.reason = report.reason ?? "eight_early";
    rules.lastEvent = "foul_rescue";
  }

  if (canPotEight) {
    rules.phase = "over";
    rules.winner = 0;
    rules.lastEvent = "cleared";
    report.cleared = true;
    return report;
  }
  if (rules.mode === "duel" && report.winEight) {
    rules.phase = "over";
    rules.winner = rules.turn;
    rules.lastEvent = "win_eight";
    return report;
  }

  const keepTurn = !report.foul && (facts.pottedCount > 0 || canPotEight);
  report.continueTurn = keepTurn;

  if (rules.mode === "clear") {
    rules.turn = 0;
    rules.ballInHand = report.foul;
    if (!liveObjectBalls(balls).length && !eightLive(balls)) {
      rules.phase = "over";
      rules.winner = 0;
      rules.lastEvent = "cleared";
      report.cleared = true;
    } else {
      rules.lastEvent = report.foul ? "foul" : keepTurn ? "run" : "turn";
    }
    return report;
  }

  if (!keepTurn) {
    rules.run = 0;
    rules.turn = 1 - rules.turn;
    if (report.foul) {
      rules.ballInHand = true;
      rules.lastEvent = "foul_turn";
    } else {
      rules.lastEvent = "turn";
    }
  } else {
    rules.lastEvent = facts.pottedCount > 0 ? "run" : "turn";
  }
  return report;
}

/** Re-spot the 8 after an illegal pocket, used only by the solo trial. */
export function respotEight(balls, x, y) {
  const eight = balls.find((b) => b.id === 8);
  if (!eight) return false;
  eight.potted = false;
  eight.x = x;
  eight.y = y;
  eight.vx = 0;
  eight.vy = 0;
  eight.rvx = 0;
  eight.rvy = 0;
  return true;
}

export function isOpenTable(rules) {
  return rules.mode === "clear" ? false : rules.open && rules.groups[rules.turn] === null;
}
