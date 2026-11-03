import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DICTIONARIES, SHARED_LANG_KEY } from '../js/i18n.mjs';

test('i18n: strings.en contains ZERO Chinese characters (excluding langName switch label)', () => {
  const enDict = DICTIONARIES.en;
  const chineseRegex = /[\u4e00-\u9fa5]/;

  for (const [key, val] of Object.entries(enDict)) {
    if (key === 'langName') continue;
    assert.ok(
      !chineseRegex.test(val),
      `English dictionary key "${key}" contains Chinese character: "${val}"`
    );
  }
});

test('i18n: translation keys symmetry between zh and en', () => {
  const zhKeys = Object.keys(DICTIONARIES.zh).sort();
  const enKeys = Object.keys(DICTIONARIES.en).sort();
  assert.deepEqual(zhKeys, enKeys, 'zh and en dictionary keys must be completely symmetric');
});

test('i18n: shared preference key is doin.lang', () => {
  assert.equal(SHARED_LANG_KEY, 'doin.lang');
});

test('i18n: no location.reload in source files', () => {
  const jsDir = path.resolve('games/pin/js');
  const files = fs.readdirSync(jsDir);

  for (const file of files) {
    if (file.endsWith('.mjs') || file.endsWith('.js')) {
      const content = fs.readFileSync(path.join(jsDir, file), 'utf8');
      assert.ok(
        !content.includes('location.reload'),
        `File ${file} must not contain location.reload()`
      );
    }
  }
});
