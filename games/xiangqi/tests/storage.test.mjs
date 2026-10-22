// 存档唯一口径测试：内存降级、normalize 归一、闯关最优合并、对战记录与徽章。
import test from "node:test";
import assert from "node:assert/strict";
import {
  loadSave,
  saveSave,
  updateSave,
  recordCampaignResult,
  recordDuelResult,
  saveSettings,
  saveAiTier,
  resetSave,
  STORAGE_KEY,
} from "../js/storage.mjs";

test("resetSave 后 loadSave 返回默认结构", () => {
  resetSave();
  const data = loadSave();
  assert.equal(data.version, 1);
  assert.deepEqual(data.campaign.levels, {});
  assert.deepEqual(
    { w: data.duel.wins, l: data.duel.losses, d: data.duel.draws },
    { w: 0, l: 0, d: 0 },
  );
  assert.equal(data.aiTier, "ai_1");
  assert.equal(data.settings.sound, true);
  assert.equal(data.settings.hint, true);
});

test("recordCampaignResult：星级取最大、步数取最小", () => {
  resetSave();
  recordCampaignResult("level_3", 2, 6);
  recordCampaignResult("level_3", 3, 9);
  recordCampaignResult("level_3", 1, 4);
  const level = loadSave().campaign.levels.level_3;
  assert.equal(level.stars, 3, "星级取历史最高");
  assert.equal(level.moves, 4, "步数取历史最少");
});

test("recordDuelResult：胜场推进连胜并解锁徽章", () => {
  resetSave();
  recordDuelResult(true, false, "ai_2");
  recordDuelResult(true, false, "ai_4");
  let duel = loadSave().duel;
  assert.equal(duel.wins, 2);
  assert.equal(duel.streak, 2);
  assert.equal(duel.bestStreak, 2);
  assert.equal(duel.badges.badge_ai_2, true);
  assert.equal(duel.badges.badge_ai_4, true);
});

test("recordDuelResult：负场与和棋清零连胜", () => {
  resetSave();
  recordDuelResult(true, false, "ai_1");
  recordDuelResult(true, false, "ai_1");
  recordDuelResult(false, false, "ai_1");
  let duel = loadSave().duel;
  assert.equal(duel.losses, 1);
  assert.equal(duel.streak, 0);
  assert.equal(duel.bestStreak, 2, "bestStreak 保留");
  recordDuelResult(true, false, "ai_1");
  recordDuelResult(false, true, "ai_1");
  duel = loadSave().duel;
  assert.equal(duel.draws, 1);
  assert.equal(duel.streak, 0);
});

test("saveSave：损坏字段被 normalize 剔除，绝不白屏", () => {
  resetSave();
  saveSave({
    campaign: { levels: { level_1: { stars: 9, moves: 2 }, level_bad: { stars: 1, moves: 1 }, level_2: "junk" } },
    duel: { wins: "many", badges: { badge_ai_1: true, badge_hack: true } },
    aiTier: "ai_99",
    settings: { sound: "yes" },
  });
  const data = loadSave();
  assert.equal(data.campaign.levels.level_1, undefined, "stars 越界剔除");
  assert.equal(data.campaign.levels.level_bad, undefined);
  assert.equal(data.campaign.levels.level_2, undefined);
  assert.equal(data.duel.wins, 0);
  assert.equal(data.duel.badges.badge_ai_1, true, "合法徽章保留");
  assert.equal(data.duel.badges.badge_hack, undefined);
  assert.equal(data.aiTier, "ai_1");
  assert.equal(data.settings.sound, true);
});

test("updateSave：部分字段覆盖", () => {
  resetSave();
  updateSave({ aiTier: "ai_3" });
  assert.equal(loadSave().aiTier, "ai_3");
  assert.equal(loadSave().version, 1, "其余字段保持默认");
});

test("saveSettings 与 saveAiTier：非法输入静默拒绝", () => {
  resetSave();
  saveSettings({ sound: false });
  assert.equal(loadSave().settings.sound, false);
  saveAiTier("ai_5");
  assert.equal(loadSave().aiTier, "ai_5");
  saveAiTier("ai_0");
  assert.equal(loadSave().aiTier, "ai_5", "非法档位不改写");
});

test("存储 key 契约 = doin.xiangqi.v1", () => {
  assert.equal(STORAGE_KEY, "doin.xiangqi.v1");
});
