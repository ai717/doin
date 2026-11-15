import test from 'node:test';
import assert from 'node:assert/strict';

import {
  STRINGS,
  getLanguage,
  setLanguage,
  toggleLanguage,
  t
} from '../js/i18n.mjs';

test('i18n has matching keys in zh and en dictionaries', () => {
  const zhKeys = Object.keys(STRINGS.zh).sort();
  const enKeys = Object.keys(STRINGS.en).sort();

  assert.deepEqual(zhKeys, enKeys);
});

test('strings.en has zero Chinese characters except whitelist langToggle', () => {
  const chineseRegex = /[\u4e00-\u9fa5]/;

  for (const [key, value] of Object.entries(STRINGS.en)) {
    if (key === 'langToggle') {
      // Whitelist toggle button label to switch back to Chinese
      continue;
    }
    assert.equal(
      chineseRegex.test(value),
      false,
      `strings.en[${key}] contains Chinese characters: "${value}"`
    );
  }
});

test('toggleLanguage and setLanguage switch seamlessly', () => {
  setLanguage('zh');
  assert.equal(getLanguage(), 'zh');
  assert.equal(t('gameTitle'), '巧解鲁班锁 · 榫卯拆解');

  toggleLanguage();
  assert.equal(getLanguage(), 'en');
  assert.equal(t('gameTitle'), 'Luban Lock · Mortise Puzzle');

  toggleLanguage();
  assert.equal(getLanguage(), 'zh');
});
