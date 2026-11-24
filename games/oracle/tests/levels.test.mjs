import test from "node:test";
import assert from "node:assert/strict";

import { LEVELS, CHAPTERS, GLYPHS, getLevel, levelsOfChapter, validateLevels } from "../js/levels.mjs";

test("关卡：四章各六关，共二十四关", () => {
  assert.equal(CHAPTERS.length, 4);
  assert.equal(LEVELS.length, 24);
  for (const chapter of CHAPTERS) {
    assert.equal(chapter.groups.length, 6);
    assert.equal(levelsOfChapter(CHAPTERS.indexOf(chapter)).length, 6);
  }
});

test("关卡：编号连续且章节归属正确", () => {
  LEVELS.forEach((level, index) => {
    assert.equal(level.index, index, `关卡 ${level.id} 的 index 不连续`);
    assert.equal(level.chapterIndex, Math.floor(index / 6));
    assert.equal(level.levelInChapter, (index % 6) + 1);
    assert.equal(level.pairs, level.glyphs.length);
    assert.equal(getLevel(index).id, level.id);
  });
});

test("关卡：难度按章节递进，每关四至八对", () => {
  for (const level of LEVELS) {
    assert.ok(level.pairs >= 4 && level.pairs <= 8, `${level.id} 对数越界`);
  }
  for (const level of levelsOfChapter(0)) assert.equal(level.pairs, 4);
  for (const level of levelsOfChapter(3)) assert.equal(level.pairs, 6);
});

test("关卡：同关不出现重复甲骨，唯一可解", () => {
  for (const level of LEVELS) {
    assert.equal(new Set(level.glyphs).size, level.glyphs.length, `${level.id} 有重复字形`);
  }
  assert.deepEqual(validateLevels(), []);
});

test("字库：每条都有本字、双语释义与至少一条笔画", () => {
  const chars = new Set();
  for (const [id, glyph] of Object.entries(GLYPHS)) {
    assert.ok(glyph.char && glyph.char.length >= 1, `${id} 缺本字`);
    assert.ok(glyph.zh && glyph.zh.length >= 1, `${id} 缺中文释义`);
    assert.ok(glyph.en && glyph.en.length >= 1, `${id} 缺英文释义`);
    assert.ok(Array.isArray(glyph.paths) && glyph.paths.length >= 1, `${id} 缺笔画`);
    assert.ok(Array.isArray(glyph.dots), `${id} dots 必须是数组`);
    assert.equal(chars.has(glyph.char), false, `本字重复：${glyph.char}`);
    chars.add(glyph.char);
  }
  assert.equal(Object.keys(GLYPHS).length, 48);
});

test("字库：章节池与关卡引用闭合", () => {
  for (const chapter of CHAPTERS) {
    assert.equal(chapter.pool.length, 12, `${chapter.id} 字池应为 12`);
    for (const id of chapter.pool) assert.ok(GLYPHS[id], `${chapter.id} 引用不存在的 ${id}`);
    for (const group of chapter.groups) {
      for (const id of group) assert.ok(chapter.pool.includes(id), `${chapter.id} 关卡越出字池：${id}`);
    }
  }
});
