import test from 'node:test';
import assert from 'node:assert/strict';
import { strings, format, isLocale, DEFAULT_LOCALE } from '../js/i18n.mjs';

test('i18n: 语言校验与默认值回退', () => {
  assert.equal(isLocale('zh'), true);
  assert.equal(isLocale('en'), true);
  assert.equal(isLocale('fr'), false);
  assert.equal(isLocale(null), false);
  assert.equal(DEFAULT_LOCALE, 'zh');
});

test('i18n: 中英文双语字典完全镜像对齐', () => {
  const zhKeys = Object.keys(strings.zh).sort();
  const enKeys = Object.keys(strings.en).sort();

  assert.deepEqual(zhKeys, enKeys, '中英文字典中的键必须 100% 完全一致');

  for (const key of zhKeys) {
    assert.equal(typeof strings.zh[key], 'string', `zh.${key} 必须为字符串`);
    assert.notEqual(strings.zh[key].trim(), '', `zh.${key} 不能为空`);
    assert.equal(typeof strings.en[key], 'string', `en.${key} 必须为字符串`);
    assert.notEqual(strings.en[key].trim(), '', `en.${key} 不能为空`);
  }
});

test('i18n: 变量插值 format 函数可靠性', () => {
  const tpl = 'Level {num}: completed in {sec}s';
  const out = format(tpl, { num: 3, sec: 12 });
  assert.equal(out, 'Level 3: completed in 12s');

  const partial = format(tpl, { num: 1 });
  assert.equal(partial, 'Level 1: completed in {sec}s');

  assert.equal(format('', {}), '');
  assert.equal(format('simple text', null), 'simple text');
});
