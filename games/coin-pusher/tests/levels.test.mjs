// levels.test.mjs — 无尽机台数据层：唯一布局 / 机关权重表 / 投放区 / 零裸写中文
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ENDLESS_LAYOUT, CARD_EFFECTS, TOKEN_TABLE, TOKEN_AREA, START_Y } from "../js/levels.mjs";
import { FIELD_W, FIELD_H, PUSHER_EXTEND, TOKEN_INTERVAL } from "../js/engine.mjs";

const src = readFileSync(join(import.meta.dirname, "..", "js", "levels.mjs"), "utf8");
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("levels: 无尽机台只有一套布局", () => {
  it("不再导出章节 / 关卡 / getLevel / LEVEL_COUNT", async () => {
    const mod = await import("../js/levels.mjs");
    for (const gone of ["LEVELS", "CHAPTERS", "getLevel", "LEVEL_COUNT", "loadLevel"]) {
      assert.equal(mod[gone], undefined, `不应再导出 ${gone}`);
    }
  });

  it("初始铺币参数合法且落在推板前方", () => {
    assert.equal(ENDLESS_LAYOUT.startY, START_Y);
    assert.ok(ENDLESS_LAYOUT.rows >= 6, "铺币行数过少，台面会太空");
    assert.ok(ENDLESS_LAYOUT.startY > PUSHER_EXTEND, "首行铺币必须在推板行程之前方");
    assert.ok(ENDLESS_LAYOUT.startY < FIELD_H, "首行铺币必须在台面内");
    assert.ok(ENDLESS_LAYOUT.goldRatio >= 0 && ENDLESS_LAYOUT.gemRatio >= 0);
    assert.ok(ENDLESS_LAYOUT.goldRatio + ENDLESS_LAYOUT.gemRatio < 0.5, "特殊币比例过高会失衡");
    assert.ok(Number.isFinite(ENDLESS_LAYOUT.seed));
  });

  it("奖励卡增益表非空且互不重复", () => {
    assert.ok(CARD_EFFECTS.length >= 2);
    assert.equal(new Set(CARD_EFFECTS).size, CARD_EFFECTS.length);
    for (const e of CARD_EFFECTS) assert.equal(typeof e, "string");
  });
});

describe("levels: 机关投放权重表", () => {
  it("累计概率单调递增且最后一项恰为 1", () => {
    assert.ok(TOKEN_TABLE.length >= 3);
    let prev = 0;
    for (const entry of TOKEN_TABLE) {
      assert.ok(entry.upto > prev, `累计概率必须递增：${prev} → ${entry.upto}`);
      assert.ok(entry.upto <= 1 + 1e-9);
      prev = entry.upto;
    }
    assert.equal(TOKEN_TABLE[TOKEN_TABLE.length - 1].upto, 1, "最后一项必须为 1，否则随机数会漏档");
  });

  it("机关类型都是引擎认得的", () => {
    const known = new Set(["card", "launcher", "magnet", "tower"]);
    for (const entry of TOKEN_TABLE) assert.ok(known.has(entry.t), `未知机关 ${entry.t}`);
    assert.equal(new Set(TOKEN_TABLE.map((e) => e.t)).size, TOKEN_TABLE.length, "机关类型不得重复");
  });

  it("金塔是稀有档（累计概率落在最后一段，且不超过 1/6）", () => {
    const towerIdx = TOKEN_TABLE.findIndex((e) => e.t === "tower");
    assert.ok(towerIdx >= 0, "权重表应含金塔");
    const prevUpto = towerIdx > 0 ? TOKEN_TABLE[towerIdx - 1].upto : 0;
    const prob = TOKEN_TABLE[towerIdx].upto - prevUpto;
    assert.ok(prob > 0 && prob <= 1 / 6, `金塔概率 ${prob} 应稀有`);
  });
});

describe("levels: 机关投放区", () => {
  it("投放区落在台面内，避开推板行程与最前沿的悬垂带", () => {
    assert.ok(TOKEN_AREA.x0 > 0 && TOKEN_AREA.x1 < FIELD_W);
    assert.ok(TOKEN_AREA.y0 > PUSHER_EXTEND, "不得投在推板行程内");
    assert.ok(TOKEN_AREA.y1 < FIELD_H, "不得投在台面外");
    assert.ok(TOKEN_AREA.y1 - TOKEN_AREA.y0 > 1, "投放区纵深过窄");
  });
});

describe("levels: 零裸写中文", () => {
  it("数据层不含中文字符串（展示文本一律走 i18n）", () => {
    const code = stripComments(src);
    const cjk = code.match(/[\u4e00-\u9fff]+/g);
    assert.equal(cjk, null, `levels.mjs 混入裸写中文：${cjk && cjk.join(",")}`);
  });
});

describe("levels: 与引擎常量一致", () => {
  it("补投间隔是正整数且合理", () => {
    assert.ok(Number.isInteger(TOKEN_INTERVAL));
    assert.ok(TOKEN_INTERVAL >= 5 && TOKEN_INTERVAL <= 60, `补投间隔 ${TOKEN_INTERVAL} 不合理`);
  });
});
