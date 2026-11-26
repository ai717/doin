// 规则唯一权威：纯函数 + 严格 DOM-free。
// 核心不是「写死每案答案」，而是把每案表达成一组约束，再对
// suspects × weapons × evidence 的完整笛卡尔积做过滤，要求只剩一组解。
// 这就是 PRD 要求的 Constraint Satisfaction 验证器：唯一解不是声明，是被枚举证明的。

import { CASES, FATAL_SLOT, SLOTS, WEAPONS, caseById } from "./cases.mjs";

export const STAMP = { UNSET: "unset", CLEAR: "clear", GUILTY: "guilty" };
export const STAMP_CYCLE = [STAMP.UNSET, STAMP.CLEAR, STAMP.GUILTY];
export const DIMENSIONS = ["killer", "weapon", "clue"];

/** 确定性 PRNG：测试与「每日同题」都靠它，绝不能碰 Math.random。 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function caseList() {
  return CASES;
}

export function getCase(id) {
  return caseById(id);
}

/** 凶器与尸检痕迹是否同一物理特征。 */
export function traceMatch(weaponId, trace) {
  const weapon = WEAPONS[weaponId];
  if (!weapon || !trace) return false;
  if (weapon.class !== trace.class) return false;
  if (trace.detail && weapon.detail !== trace.detail) return false;
  return true;
}

/**
 * 口供是否站得住。
 * 只有两类事实能推翻口供：硬证据把你按在另一个房间，或物理上根本不可能在你说的地方。
 * 返回的 why 是「哪件物证推翻了它」，UI 用它做柔光提示与错判解释。
 */
export function claimCheck(caseData, who) {
  const claim = caseData.claims[who];
  if (!claim) return { holds: true, why: null };
  for (const fact of caseData.facts) {
    if (fact.who !== who) continue;
    if (fact.slot && fact.slot !== claim.slot) continue;
    if (fact.kind === "sighting" && fact.room !== claim.room) {
      return { holds: false, why: fact.why, fact };
    }
    if (fact.kind === "impossible" && fact.room === claim.room) {
      return { holds: false, why: fact.why, fact };
    }
  }
  return { holds: true, why: null };
}

/** 口供被推翻的嫌疑人；blindSpot 表示「他记错了」，不算作案伪证。 */
export function failingClaims(caseData) {
  return caseData.suspects
    .map((who) => ({ who, ...claimCheck(caseData, who), blindSpot: Boolean(caseData.claims[who]?.blindSpot) }))
    .filter((entry) => !entry.holds);
}

export function killerCandidates(caseData) {
  return failingClaims(caseData)
    .filter((entry) => !entry.blindSpot)
    .map((entry) => entry.who);
}

export function weaponCandidates(caseData) {
  return caseData.weapons.filter((id) => traceMatch(id, caseData.trace));
}

export function clueCandidates(caseData, weaponId) {
  return caseData.evidence.filter((item) => caseData.points?.[item.id] === weaponId).map((item) => item.id);
}

/** 全空间枚举：只有同时满足「口供 / 痕迹 / 接触权 / 证据链」的答案才活下来。 */
export function answerCandidates(caseData) {
  const killers = killerCandidates(caseData);
  const answers = [];
  for (const killer of killers) {
    for (const weapon of caseData.weapons) {
      if (!traceMatch(weapon, caseData.trace)) continue;
      const allowed = caseData.access?.[weapon] ?? [];
      if (!allowed.includes(killer)) continue;
      for (const item of caseData.evidence) {
        if (caseData.points?.[item.id] !== weapon) continue;
        answers.push({ killer, weapon, clue: item.id });
      }
    }
  }
  return answers;
}

export function solveCase(caseData) {
  const answers = answerCandidates(caseData);
  return {
    unique: answers.length === 1,
    count: answers.length,
    answer: answers.length === 1 ? answers[0] : null,
    answers,
    killers: killerCandidates(caseData),
    weapons: weaponCandidates(caseData),
  };
}

export function sameAnswer(a, b) {
  return Boolean(a && b) && a.killer === b.killer && a.weapon === b.weapon && a.clue === b.clue;
}

/** 逐维度判定，给 UI 提供「错在哪一环」而不用泄露正确答案。 */
export function evaluateAnswer(caseData, answer) {
  const flaws = [];
  if (!answer || !answer.killer) flaws.push({ dim: "killer", code: "missing" });
  if (!answer || !answer.weapon) flaws.push({ dim: "weapon", code: "missing" });
  if (!answer || !answer.clue) flaws.push({ dim: "clue", code: "missing" });
  if (flaws.length) return { ok: false, flaws };

  const killers = killerCandidates(caseData);
  if (!killers.includes(answer.killer)) {
    flaws.push({ dim: "killer", code: "cleared", why: clearEvidence(caseData, answer.killer) });
  }
  if (!traceMatch(answer.weapon, caseData.trace)) {
    flaws.push({ dim: "weapon", code: "trace" });
  } else if (!(caseData.access?.[answer.weapon] ?? []).includes(answer.killer)) {
    flaws.push({ dim: "weapon", code: "access" });
  }
  if (caseData.points?.[answer.clue] !== answer.weapon) {
    flaws.push({ dim: "clue", code: "unlinked" });
  }
  return { ok: flaws.length === 0, flaws };
}

/** 用来解释「你指认的人为什么清白」：找到能把他按在别处的那件物证。 */
export function clearEvidence(caseData, who) {
  const check = claimCheck(caseData, who);
  if (!check.holds && check.why) return check.why;
  const fact = caseData.facts.find((item) => item.kind === "sighting" && item.who === who);
  return fact ? fact.why : null;
}

/** 线索互斥高亮：点击某人的口供时，哪些物证在支持他、哪些在拆他。 */
export function relatedEvidence(caseData, who) {
  const claim = caseData.claims[who];
  if (!claim) return { supports: [], contradicts: [] };
  const supports = [];
  const contradicts = [];
  for (const fact of caseData.facts) {
    if (fact.who !== who) continue;
    const sameRoom = fact.room === claim.room;
    if (fact.kind === "sighting") (sameRoom ? supports : contradicts).push(fact.why);
    if (fact.kind === "impossible" && sameRoom) contradicts.push(fact.why);
  }
  return { supports, contradicts };
}

// ---------------------------------------------------------------- 盘面状态机

export function createBoard(caseData) {
  const stamps = {};
  for (const who of caseData.suspects) stamps[who] = STAMP.UNSET;
  return {
    caseId: caseData.id,
    stamps,
    weapon: null,
    clue: null,
    mistakes: 0,
    sealed: false,
    lastVerdict: null,
  };
}

function stampValues(board, caseData) {
  return caseData.suspects.map((who) => board.stamps[who] ?? STAMP.UNSET);
}

export function setStamp(board, caseData, who, stamp) {
  if (board.sealed) return board;
  if (!caseData.suspects.includes(who)) return board;
  if (!STAMP_CYCLE.includes(stamp)) return board;
  const stamps = { ...board.stamps };
  if (stamp === STAMP.GUILTY) {
    for (const other of caseData.suspects) {
      if (other !== who && stamps[other] === STAMP.GUILTY) stamps[other] = STAMP.UNSET;
    }
  }
  stamps[who] = stamp;
  return { ...board, stamps };
}

export function cycleStamp(board, caseData, who) {
  const current = board.stamps[who] ?? STAMP.UNSET;
  const next = STAMP_CYCLE[(STAMP_CYCLE.indexOf(current) + 1) % STAMP_CYCLE.length];
  return setStamp(board, caseData, who, next);
}

export function setIndictment(board, caseData, patch) {
  if (board.sealed) return board;
  const next = { ...board };
  if ("weapon" in patch) {
    if (patch.weapon !== null && !caseData.weapons.includes(patch.weapon)) return board;
    next.weapon = patch.weapon;
  }
  if ("clue" in patch) {
    if (patch.clue !== null && !caseData.evidence.some((item) => item.id === patch.clue)) return board;
    next.clue = patch.clue;
  }
  return next;
}

function summaryCore(board, caseData) {
  const guilt = caseData.suspects.filter((who) => board.stamps[who] === STAMP.GUILTY);
  const cleared = caseData.suspects.filter((who) => board.stamps[who] === STAMP.CLEAR).length;
  return {
    guilty: guilt[0] ?? null,
    guiltyCount: guilt.length,
    cleared,
    total: caseData.suspects.length,
    weapon: board.weapon,
    clue: board.clue,
    mistakes: board.mistakes,
    sealed: board.sealed,
  };
}

export function boardSummary(board, caseData) {
  const core = summaryCore(board, caseData);
  const conditionsMet =
    core.guiltyCount === 1 && core.cleared === core.total - 1 && Boolean(board.weapon && board.clue);
  return { ...core, ready: conditionsMet && !board.sealed };
}

/** 结案条件：唯一指认 + 其余全部清白 + 凶器与关键证据都填好。 */
export function canSeal(board, caseData) {
  if (board.sealed) return false;
  const core = summaryCore(board, caseData);
  if (core.guiltyCount !== 1) return false;
  if (core.cleared !== core.total - 1) return false;
  return Boolean(board.weapon && board.clue);
}

export function applySeal(board, caseData) {
  if (board.sealed) return { board, verdict: board.lastVerdict, changed: false };
  if (!canSeal(board, caseData)) return { board, verdict: null, changed: false };
  const summary = boardSummary(board, caseData);
  const evaluation = evaluateAnswer(caseData, { killer: summary.guilty, weapon: board.weapon, clue: board.clue });
  if (evaluation.ok) {
    const verdict = { ok: true, killer: summary.guilty, weapon: board.weapon, clue: board.clue };
    return { board: { ...board, sealed: true, lastVerdict: verdict }, verdict, changed: true };
  }
  const verdict = { ok: false, flaws: evaluation.flaws, mistakes: board.mistakes + 1 };
  return { board: { ...board, mistakes: board.mistakes + 1, lastVerdict: verdict }, verdict, changed: true };
}

export function resetBoard(board, caseData) {
  if (board.sealed) return board;
  return createBoard(caseData);
}

/** 案卷完成度：给目录抽屉显示「已破 / 在办 / 未启」。 */
export function caseReady(board, caseData) {
  const summary = boardSummary(board, caseData);
  return summary.guiltyCount === 1 && summary.ready;
}

export { FATAL_SLOT, SLOTS, WEAPONS };
