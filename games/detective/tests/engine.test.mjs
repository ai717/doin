import test from "node:test";
import assert from "node:assert/strict";

import { CASES } from "../js/cases.mjs";
import {
  STAMP,
  answerCandidates,
  applySeal,
  boardSummary,
  canSeal,
  claimCheck,
  clearEvidence,
  createBoard,
  cycleStamp,
  evaluateAnswer,
  failingClaims,
  killerCandidates,
  mulberry32,
  relatedEvidence,
  sameAnswer,
  setIndictment,
  setStamp,
  solveCase,
  traceMatch,
  weaponCandidates,
} from "../js/engine.mjs";

const first = CASES[0];

function cleared(board, caseData, guilty) {
  let next = setStamp(board, caseData, guilty, STAMP.GUILTY);
  for (const who of caseData.suspects) {
    if (who !== guilty) next = setStamp(next, caseData, who, STAMP.CLEAR);
  }
  return next;
}

test("12 案全部唯一有解，且每个声明解都能被枚举证明", () => {
  assert.equal(CASES.length, 12);
  for (const caseData of CASES) {
    const solved = solveCase(caseData);
    assert.equal(solved.count, 1, `#${caseData.id} 解的数量应为 1，实际 ${solved.count}`);
    assert.ok(solved.unique, `#${caseData.id} 不唯一`);
    assert.ok(sameAnswer(solved.answer, caseData.solution), `#${caseData.id} 推导解与声明解不一致`);
  }
  const total = CASES.reduce((sum, item) => sum + answerCandidates(item).length, 0);
  assert.equal(total, 12, "全案累计候选解应恰好 12 组");
});

test("全空间枚举规模：每案候选都在 suspects × weapons × evidence 的乘积内", () => {
  for (const caseData of CASES) {
    const space = caseData.suspects.length * caseData.weapons.length * caseData.evidence.length;
    assert.ok(space >= 3 * 3 * 6, `#${caseData.id} 搜索空间过小: ${space}`);
    assert.ok(space <= 6 * 4 * 20, `#${caseData.id} 搜索空间异常: ${space}`);
  }
});

test("口供判定：硬证据把人按在别处即推翻，无法证伪则站得住", () => {
  const butler = claimCheck(first, "butler");
  assert.equal(butler.holds, false);
  assert.equal(butler.why, "key_in_lock");

  const gardener = claimCheck(first, "gardener");
  assert.equal(gardener.holds, true);
  assert.equal(gardener.why, null);

  assert.deepEqual(killerCandidates(first), ["butler"]);
});

test("盲区证人：口供被推翻但不算作案伪证，因此不进入凶手候选", () => {
  const foggy = CASES.find((item) => item.id === 9);
  const failing = failingClaims(foggy).map((entry) => entry.who).sort();
  assert.deepEqual(failing, ["customs", "widow"], "海关员与遗孀的口供都应被推翻");
  assert.deepEqual(killerCandidates(foggy), ["widow"], "只有遗孀属于真正的伪证");
});

test("凶器痕迹：种类与细节必须同时吻合，同类不同细节要能区分", () => {
  assert.equal(traceMatch("bell_hammer", { class: "blunt", detail: "square" }), true);
  assert.equal(traceMatch("candlestick", { class: "blunt", detail: "square" }), false);
  assert.equal(traceMatch("candlestick", { class: "blunt", detail: "round" }), true);
  assert.equal(traceMatch("letter_opener", { class: "blunt", detail: "square" }), false);
  assert.equal(traceMatch("nope", { class: "blunt" }), false);

  const bell = CASES.find((item) => item.id === 4);
  assert.deepEqual(weaponCandidates(bell), ["bell_hammer"]);
});

test("接触权是跨维度约束：凶手够不到的凶器必须被排除", () => {
  const caseData = {
    ...first,
    access: { ...first.access, letter_opener: ["doctor"] },
  };
  const solved = solveCase(caseData);
  assert.equal(solved.count, 0, "封死接触权后应无解，证明该约束真的参与过滤");
});

test("判定：正确解无瑕，错维度各自给出独立缺陷", () => {
  const good = evaluateAnswer(first, first.solution);
  assert.equal(good.ok, true);
  assert.deepEqual(good.flaws, []);

  const wrongKiller = evaluateAnswer(first, { ...first.solution, killer: "doctor" });
  assert.equal(wrongKiller.ok, false);
  assert.equal(wrongKiller.flaws[0].dim, "killer");
  assert.equal(wrongKiller.flaws[0].why, "call_log", "应指出洗清医生的那件物证");

  const wrongWeapon = evaluateAnswer(first, { ...first.solution, weapon: "fire_poker" });
  assert.ok(wrongWeapon.flaws.some((flaw) => flaw.dim === "weapon" && flaw.code === "trace"));

  const wrongClue = evaluateAnswer(first, { ...first.solution, clue: "torn_letter" });
  assert.ok(wrongClue.flaws.some((flaw) => flaw.dim === "clue"));

  const missing = evaluateAnswer(first, { killer: null, weapon: null, clue: null });
  assert.equal(missing.flaws.length, 3);
});

test("互相印证高亮：支持与矛盾各自有据可查", () => {
  assert.deepEqual(relatedEvidence(first, "butler"), { supports: [], contradicts: ["key_in_lock"] });
  assert.deepEqual(relatedEvidence(first, "gardener"), { supports: ["soil_prints"], contradicts: [] });
  assert.deepEqual(relatedEvidence(first, "nobody"), { supports: [], contradicts: [] });
  assert.equal(clearEvidence(first, "doctor"), "call_log");
  assert.equal(clearEvidence(first, "butler"), "key_in_lock");
});

test("盘面：初始全为存疑，指认凶手具有排他性", () => {
  const board = createBoard(first);
  assert.deepEqual(
    first.suspects.map((who) => board.stamps[who]),
    first.suspects.map(() => STAMP.UNSET),
  );
  let next = setStamp(board, first, "butler", STAMP.GUILTY);
  next = setStamp(next, first, "doctor", STAMP.GUILTY);
  assert.equal(next.stamps.butler, STAMP.UNSET, "新指认会撤掉旧的指认");
  assert.equal(boardSummary(next, first).guiltyCount, 1);
  assert.equal(boardSummary(next, first).guilty, "doctor");
});

test("三层印章循环：存疑 → 清白 → 真凶 → 存疑", () => {
  let board = createBoard(first);
  board = cycleStamp(board, first, "butler");
  assert.equal(board.stamps.butler, STAMP.CLEAR);
  board = cycleStamp(board, first, "butler");
  assert.equal(board.stamps.butler, STAMP.GUILTY);
  board = cycleStamp(board, first, "butler");
  assert.equal(board.stamps.butler, STAMP.UNSET);
});

test("非法输入一律静默忽略，不改动盘面", () => {
  const board = createBoard(first);
  assert.equal(setStamp(board, first, "ghost", STAMP.CLEAR), board);
  assert.equal(setStamp(board, first, "butler", "burned"), board);
  assert.equal(setIndictment(board, first, { weapon: "icbm" }), board);
  assert.equal(setIndictment(board, first, { clue: "not_evidence" }), board);
});

test("结案条件：唯一指认 + 其余全清白 + 凶器 + 证据，缺一不可", () => {
  const board = createBoard(first);
  assert.equal(canSeal(board, first), false);

  let staged = cleared(board, first, "butler");
  assert.equal(canSeal(staged, first), false, "缺凶器与证据不能结案");

  staged = setIndictment(staged, first, { weapon: first.solution.weapon });
  assert.equal(canSeal(staged, first), false);

  staged = setIndictment(staged, first, { clue: first.solution.clue });
  assert.equal(canSeal(staged, first), true);

  const { board: sealed, verdict, changed } = applySeal(staged, first);
  assert.equal(changed, true);
  assert.equal(verdict.ok, true);
  assert.equal(sealed.sealed, true);
  assert.equal(canSeal(sealed, first), false, "已结案不再可盖");

  const again = applySeal(sealed, first);
  assert.equal(again.changed, false, "重复盖章必须是 no-op");
  assert.equal(again.board, sealed);
});

test("错判：只扣信誉星，盘面印章原样保留（绅士模式）", () => {
  const board = createBoard(first);
  let staged = cleared(board, first, "doctor");
  staged = setIndictment(staged, first, { weapon: first.solution.weapon, clue: first.solution.clue });
  const { board: next, verdict } = applySeal(staged, first);
  assert.equal(verdict.ok, false);
  assert.equal(next.sealed, false);
  assert.equal(next.mistakes, 1);
  assert.equal(next.stamps.doctor, STAMP.GUILTY, "指认不被清空");
  assert.equal(next.weapon, first.solution.weapon, "判词不被清空");
});

test("不变式：1200 步随机操作不抛错、不越界、不破坏单指认", () => {
  const random = mulberry32(20261110);
  let board = createBoard(first);
  let caseData = first;
  let wins = 0;

  for (let step = 0; step < 1200; step += 1) {
    const roll = random();
    const who = caseData.suspects[Math.floor(random() * caseData.suspects.length)];
    if (roll < 0.5) {
      const kinds = [STAMP.UNSET, STAMP.CLEAR, STAMP.GUILTY];
      board = setStamp(board, caseData, who, kinds[Math.floor(random() * kinds.length)]);
    } else if (roll < 0.58) {
      board = cycleStamp(board, caseData, who);
    } else if (roll < 0.7) {
      const weapon = caseData.weapons[Math.floor(random() * caseData.weapons.length)];
      board = setIndictment(board, caseData, { weapon: random() < 0.5 ? weapon : null });
    } else if (roll < 0.82) {
      const item = caseData.evidence[Math.floor(random() * caseData.evidence.length)];
      board = setIndictment(board, caseData, { clue: random() < 0.5 ? item.id : null });
    } else if (roll < 0.94) {
      const outcome = applySeal(board, caseData);
      board = outcome.board;
      if (outcome.verdict?.ok) wins += 1;
    } else {
      caseData = CASES[Math.floor(random() * CASES.length)];
      board = createBoard(caseData);
    }

    const summary = boardSummary(board, caseData);
    assert.ok(summary.guiltyCount <= 1, `第 ${step} 步出现多个指认`);
    assert.ok(summary.cleared <= summary.total, `第 ${step} 步清白数越界`);
    assert.ok(summary.mistakes >= 0 && summary.mistakes < 1000, `第 ${step} 步误判计数异常`);
    for (const stamp of Object.values(board.stamps)) {
      assert.ok([STAMP.UNSET, STAMP.CLEAR, STAMP.GUILTY].includes(stamp), `第 ${step} 步出现非法印章 ${stamp}`);
    }
    assert.equal(typeof summary.ready, "boolean");
    assert.doesNotThrow(() => JSON.stringify(board), "盘面必须可序列化");
  }

  assert.ok(wins >= 0, "随机游走允许零次成功");
});

test("确定性：同种子同序列两次随机游走结果完全一致", () => {
  const run = () => {
    const random = mulberry32(7);
    let board = createBoard(first);
    for (let step = 0; step < 300; step += 1) {
      const who = first.suspects[Math.floor(random() * first.suspects.length)];
      const kinds = [STAMP.UNSET, STAMP.CLEAR, STAMP.GUILTY];
      board = setStamp(board, first, who, kinds[Math.floor(random() * kinds.length)]);
    }
    return JSON.stringify(board);
  };
  assert.equal(run(), run());
});

test("mulberry32 输出稳定落在 [0,1) 且不重复初始化", () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 500; i += 1) {
    const value = a();
    assert.ok(value >= 0 && value < 1);
    assert.equal(value, b());
  }
});
