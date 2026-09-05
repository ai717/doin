import test from 'node:test';
import assert from 'node:assert/strict';

import { LOCALES, DEFAULT_LOCALE, format, htmlLang, isLocale, strings } from '../js/i18n.mjs';

test('i18n: 中英文键完整对齐且非空', () => {
  const baseKeys = Object.keys(strings(DEFAULT_LOCALE)).sort();
  for (const locale of LOCALES) {
    const table = strings(locale);
    assert.deepEqual(Object.keys(table).sort(), baseKeys);
    for (const key of baseKeys) assert.ok(table[key], `${locale}.${key} must be non-empty`);
  }
});

test('i18n: locale helpers preserve the shared language contract', () => {
  assert.equal(isLocale('zh'), true);
  assert.equal(isLocale('en'), true);
  assert.equal(isLocale('ja'), false);
  assert.equal(htmlLang('zh'), 'zh-CN');
  assert.equal(htmlLang('en'), 'en');
  assert.equal(format('Combo x{n}!', { n: 4 }), 'Combo x4!');
});
