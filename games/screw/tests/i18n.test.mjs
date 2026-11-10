import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DICTIONARIES, SHARED_LANG_KEY, COLOR_KEYS } from '../js/i18n.mjs';
import { LEVELS, CHAPTERS } from '../js/levels.mjs';
import { COLORS } from '../js/engine.mjs';

test('i18n: English dictionary contains zero Chinese characters', () => {
  const chinese = /[\u4e00-\u9fa5]/;
  for (const [key, value] of Object.entries(DICTIONARIES.en)) {
    if (key === 'langName') continue;
    assert.ok(!chinese.test(String(value)), `English key "${key}" contains Chinese: "${value}"`);
  }
});

test('i18n: zh and en dictionaries are completely symmetric', () => {
  assert.deepEqual(Object.keys(DICTIONARIES.zh).sort(), Object.keys(DICTIONARIES.en).sort());
  for (const dict of [DICTIONARIES.zh, DICTIONARIES.en]) {
    for (const [key, value] of Object.entries(dict)) {
      assert.equal(typeof value, 'string', `key ${key} must be a string`);
      assert.ok(value.length > 0, `key ${key} must not be empty`);
    }
  }
});

test('i18n: every chapter, stage and color has bilingual copy', () => {
  for (const chapter of CHAPTERS) {
    for (const key of [chapter.nameKey, chapter.subtitleKey]) {
      assert.ok(DICTIONARIES.zh[key], `missing zh ${key}`);
      assert.ok(DICTIONARIES.en[key], `missing en ${key}`);
    }
  }
  for (const level of LEVELS) {
    assert.ok(DICTIONARIES.zh[level.nameKey], `missing zh ${level.nameKey}`);
    assert.ok(DICTIONARIES.en[level.nameKey], `missing en ${level.nameKey}`);
  }
  for (const color of COLORS) {
    assert.ok(COLOR_KEYS[color]);
    assert.ok(DICTIONARIES.zh[COLOR_KEYS[color]]);
    assert.ok(DICTIONARIES.en[COLOR_KEYS[color]]);
  }
});

test('i18n: shared language key is doin.lang and no source uses location.reload', () => {
  assert.equal(SHARED_LANG_KEY, 'doin.lang');
  const jsDir = path.resolve('games/screw/js');
  for (const file of fs.readdirSync(jsDir)) {
    if (!file.endsWith('.mjs') && !file.endsWith('.js')) continue;
    const source = fs.readFileSync(path.join(jsDir, file), 'utf8');
    assert.ok(!source.includes('location.reload'), `${file} must not reload the page`);
  }
});
