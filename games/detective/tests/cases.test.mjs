import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { CASES, CHAPTERS, FATAL_SLOT, SLOTS, WEAPONS, caseById, chapterOf, nextCaseId } from "../js/cases.mjs";
import { solveCase, traceMatch } from "../js/engine.mjs";

const PRD_SUSPECTS = [3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5];

test("案件编号 1..12 连续且唯一", () => {
  assert.deepEqual(
    CASES.map((item) => item.id),
    Array.from({ length: 12 }, (_, index) => index + 1),
  );
  assert.equal(caseById(1)?.id, 1);
  assert.equal(caseById(99), null);
  assert.equal(nextCaseId(12), 12, "最后一案没有下一案");
  assert.equal(nextCaseId(3), 4);
});

test("三卷各四案，覆盖全部 12 案且不重叠", () => {
  assert.equal(CHAPTERS.length, 3);
  const ids = CHAPTERS.flatMap((chapter) => chapter.cases).sort((a, b) => a - b);
  assert.deepEqual(ids, CASES.map((item) => item.id));
  for (const caseData of CASES) {
    assert.ok(chapterOf(caseData.id).cases.includes(caseData.id));
  }
});

test("嫌疑人数严格对齐策划案 3/3/3/3/4/4/4/4/5/5/5/5", () => {
  assert.deepEqual(
    CASES.map((item) => item.suspects.length),
    PRD_SUSPECTS,
  );
});

test("每名嫌疑人都在致命刻度有一句口供，且都有事实可查", () => {
  for (const caseData of CASES) {
    assert.ok(SLOTS.includes(FATAL_SLOT));
    for (const who of caseData.suspects) {
      const claim = caseData.claims[who];
      assert.ok(claim, `#${caseData.id} ${who} 缺口供`);
      assert.equal(claim.slot, FATAL_SLOT, `#${caseData.id} ${who} 口供不在致命刻度`);
      assert.ok(typeof claim.room === "string" && claim.room.length > 0);
      const facts = caseData.facts.filter((fact) => fact.who === who);
      assert.ok(facts.length > 0, `#${caseData.id} ${who} 没有任何可核对的事实`);
    }
  }
});

test("每条事实都指向一件场上物证，不留悬空推理", () => {
  for (const caseData of CASES) {
    const ids = new Set(caseData.evidence.map((item) => item.id));
    for (const fact of caseData.facts) {
      assert.ok(["sighting", "impossible"].includes(fact.kind), `#${caseData.id} 未知事实类型 ${fact.kind}`);
      assert.ok(caseData.suspects.includes(fact.who), `#${caseData.id} 事实指向未知嫌疑人`);
      assert.equal(fact.slot, FATAL_SLOT);
      assert.ok(ids.has(fact.why), `#${caseData.id} 事实引用了不存在的物证 ${fact.why}`);
    }
  }
});

test("物证表：id 唯一，随身物证的归属人合法", () => {
  for (const caseData of CASES) {
    const ids = caseData.evidence.map((item) => item.id);
    assert.equal(new Set(ids).size, ids.length, `#${caseData.id} 物证 id 重复`);
    for (const item of caseData.evidence) {
      if (item.holds !== null) {
        assert.ok(caseData.suspects.includes(item.holds), `#${caseData.id} 物证归属人非法: ${item.holds}`);
      }
    }
  }
});

test("证据链：points 只指向本案凶器，且线索物证确实在场", () => {
  for (const caseData of CASES) {
    const ids = new Set(caseData.evidence.map((item) => item.id));
    for (const [evidenceId, weaponId] of Object.entries(caseData.points)) {
      assert.ok(ids.has(evidenceId), `#${caseData.id} points 引用了不存在的物证 ${evidenceId}`);
      assert.ok(caseData.weapons.includes(weaponId), `#${caseData.id} points 指向非本案凶器 ${weaponId}`);
      assert.ok(WEAPONS[weaponId], `#${caseData.id} 凶器未登记物理属性 ${weaponId}`);
    }
    const solved = solveCase(caseData);
    assert.ok(ids.has(solved.answer.clue), `#${caseData.id} 解里的关键证据不在场上`);
  }
});

test("接触权矩阵覆盖全部凶器，且凶手必在名单内", () => {
  for (const caseData of CASES) {
    for (const weapon of caseData.weapons) {
      const allowed = caseData.access[weapon];
      assert.ok(Array.isArray(allowed) && allowed.length > 0, `#${caseData.id} ${weapon} 没有接触权名单`);
      for (const who of allowed) {
        assert.ok(caseData.suspects.includes(who), `#${caseData.id} ${weapon} 名单含未知嫌疑人 ${who}`);
      }
    }
    assert.ok(caseData.access[caseData.solution.weapon].includes(caseData.solution.killer));
  }
});

test("尸检痕迹只匹配唯一凶器，杜绝双解", () => {
  for (const caseData of CASES) {
    const matches = caseData.weapons.filter((weapon) => traceMatch(weapon, caseData.trace));
    assert.equal(matches.length, 1, `#${caseData.id} 匹配痕迹的凶器有 ${matches.length} 件`);
    assert.equal(matches[0], caseData.solution.weapon);
  }
});

test("案情文本量受控：每人一句口供，物证一句话说清", () => {
  for (const caseData of CASES) {
    assert.ok(caseData.suspects.length >= 3 && caseData.suspects.length <= 5);
    assert.ok(caseData.weapons.length === 3, `#${caseData.id} 凶器应恰好 3 件`);
    assert.ok(caseData.evidence.length >= 6 && caseData.evidence.length <= 14);
  }
});

test("数据层零裸写中文：所有展示文本都在 i18n", () => {
  const source = readFileSync(new URL("../js/cases.mjs", import.meta.url), "utf8");
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const hits = withoutComments.match(/[\u4e00-\u9fa5]+/g);
  assert.equal(hits, null, `cases.mjs 出现中文: ${hits?.slice(0, 5).join(", ")}`);
});
