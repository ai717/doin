/**
 * @file games/sleepwalker/tests/i18n.test.mjs
 * 双语字典纯净性与全站统一契约测试。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { strings, t } from '../js/i18n.mjs';

test('i18n: strings.en contains ZERO Chinese characters (excluding langName switch label)', () => {
  function checkClean(obj, path = '') {
    for (const k in obj) {
      if (k === 'langName') continue;
      const val = obj[k];
      if (typeof val === 'string') {
        assert.ok(
          !/[\u4e00-\u9fa5]/.test(val),
          `Found Chinese in strings.en at ${path}.${k}: "${val}"`
        );
      } else if (typeof val === 'object' && val !== null) {
        checkClean(val, `${path}.${k}`);
      }
    }
  }

  checkClean(strings.en);
});

test('i18n: translation keys symmetry between zh and en', () => {
  function checkKeys(zhObj, enObj, path = '') {
    for (const k in zhObj) {
      assert.ok(k in enObj, `Missing key in en: ${path}.${k}`);
      if (typeof zhObj[k] === 'object' && zhObj[k] !== null) {
        assert.ok(typeof enObj[k] === 'object', `Expected object in en: ${path}.${k}`);
        checkKeys(zhObj[k], enObj[k], `${path}.${k}`);
      }
    }
  }

  checkKeys(strings.zh, strings.en);
});

test('i18n: t() retrieval and fallback functionality', () => {
  const titleZh = t('title', 'zh');
  assert.equal(titleZh, '梦游先生');

  const titleEn = t('title', 'en');
  assert.equal(titleEn, 'Sleepwalker');

  const nonExistent = t('non.existent.key', 'zh');
  assert.equal(nonExistent, 'non.existent.key');
});

test('i18n: shared preference key is doin.lang', () => {
  const i18nSource = readFileSync(
    resolve(import.meta.dirname, '..', 'js', 'i18n.mjs'),
    'utf8'
  );
  assert.ok(
    i18nSource.includes('doin.lang'),
    'i18n.mjs must read/write shared key doin.lang'
  );
  const cleanSource = i18nSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.ok(
    !cleanSource.includes('location.reload'),
    'i18n.mjs must NOT call location.reload()'
  );
});
