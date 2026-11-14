import test from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, t, setLanguage, getLanguage } from '../js/i18n.mjs';

test('i18n contains zh and en dictionaries with full alignment', () => {
  assert.ok(STRINGS.zh);
  assert.ok(STRINGS.en);

  const zhKeys = Object.keys(STRINGS.zh);
  const enKeys = Object.keys(STRINGS.en);

  zhKeys.forEach(k => {
    assert.ok(k in STRINGS.en, `Key "${k}" missing in STRINGS.en`);
  });
  enKeys.forEach(k => {
    assert.ok(k in STRINGS.zh, `Key "${k}" missing in STRINGS.zh`);
  });
});

test('strings.en has zero Chinese characters (except langToggle: "中文")', () => {
  const chineseRegex = /[\u4e00-\u9fa5]/;

  for (const [key, value] of Object.entries(STRINGS.en)) {
    if (key === 'langToggle') {
      assert.equal(value, '中文');
      continue;
    }
    const hasChinese = chineseRegex.test(value);
    assert.equal(hasChinese, false, `STRINGS.en.${key} contains Chinese characters: "${value}"`);
  }
});

test('toggle key matches platform standard regex', () => {
  const togglePattern = /switchLang|langSwitch|toggleLang|langToggle|langOther|langBtn|btnLang|langName|langLabel|langShort/i;
  const match = Object.keys(STRINGS.zh).some(k => togglePattern.test(k));
  assert.ok(match, 'Language toggle key must match standard regex pattern');
});

test('setLanguage updates translation output dynamically', () => {
  setLanguage('zh');
  assert.equal(getLanguage(), 'zh');
  assert.equal(t('gameTitle'), '雀神听牌王 · 听牌速判');

  setLanguage('en');
  assert.equal(getLanguage(), 'en');
  assert.equal(t('gameTitle'), 'Tenpai King · Wait Finder');
});
