import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCALES, strings, format, isLocale, htmlLang } from '../js/i18n.mjs';

test('i18n - 支持语种完整性', () => {
  assert.ok(isLocale('zh'));
  assert.ok(isLocale('en'));
  assert.equal(isLocale('jp'), false);
  assert.equal(htmlLang('zh'), 'zh-CN');
  assert.equal(htmlLang('en'), 'en');
});

test('i18n - 中英文双语字典 100% 键对齐无遗漏', () => {
  const zhKeys = Object.keys(strings.zh).sort();
  const enKeys = Object.keys(strings.en).sort();

  assert.deepEqual(zhKeys, enKeys, '中英文字典的所有 Key 必须完全对应且无缺失');

  for (const key of zhKeys) {
    assert.equal(typeof strings.zh[key], 'string', `zh.${key} 必须是字符串`);
    assert.ok(strings.zh[key].length > 0, `zh.${key} 不得为空`);
    assert.equal(typeof strings.en[key], 'string', `en.${key} 必须是字符串`);
    assert.ok(strings.en[key].length > 0, `en.${key} 不得为空`);
  }
});

test('i18n - format 模板替换正常', () => {
  const template = 'Score: {score}, Apples: {apples}!';
  const formatted = format(template, { score: 100, apples: 5 });
  assert.equal(formatted, 'Score: 100, Apples: 5!');

  const partial = format('Hello {user}, score is {points}', { user: 'Orchard' });
  assert.equal(partial, 'Hello Orchard, score is {points}');
});
