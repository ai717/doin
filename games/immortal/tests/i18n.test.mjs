import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { STRINGS, getCurrentLang, setCurrentLang } from '../js/i18n.mjs';

const CHINESE_CHAR_REGEX = /[\u4e00-\u9fa5]/;

test('i18n: strings.en contains ZERO Chinese characters (excluding langToggle label)', () => {
  const enKeys = Object.keys(STRINGS.en);
  assert.ok(enKeys.length > 20, 'strings.en should contain comprehensive translations');

  for (const key of enKeys) {
    if (key === 'langToggle') {
      // The toggle label in English mode displays "中文" to let Chinese users switch back
      continue;
    }
    const val = STRINGS.en[key];
    const hasChinese = CHINESE_CHAR_REGEX.test(val);
    assert.equal(
      hasChinese,
      false,
      `strings.en[${key}] must contain 0 Chinese characters, found: "${val}"`
    );
  }
});

test('i18n: translation keys symmetry between zh and en', () => {
  const zhKeys = Object.keys(STRINGS.zh).sort();
  const enKeys = Object.keys(STRINGS.en).sort();

  assert.deepEqual(zhKeys, enKeys, 'zh and en dictionaries must have identical key sets');
});

test('i18n: shared preference key is doin.lang', () => {
  setCurrentLang('en');
  assert.equal(getCurrentLang(), 'en');
  setCurrentLang('zh');
  assert.equal(getCurrentLang(), 'zh');
});

test('i18n: no location.reload in source files', () => {
  const jsDir = join(process.cwd(), 'games', 'immortal', 'js');
  const files = readdirSync(jsDir).filter(f => f.endsWith('.mjs') || f.endsWith('.js'));

  for (const f of files) {
    const content = readFileSync(join(jsDir, f), 'utf-8');
    assert.equal(
      content.includes('location.reload'),
      false,
      `File ${f} must not contain location.reload()`
    );
  }
});
