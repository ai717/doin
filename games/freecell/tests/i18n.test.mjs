import test from 'node:test';
import assert from 'node:assert/strict';
import { strings, LOCALES, isLocale, format, htmlLang } from '../js/i18n.mjs';

test('i18n Dictionaries have 100% key parity between zh and en', () => {
  const zhKeys = Object.keys(strings.zh).sort();
  const enKeys = Object.keys(strings.en).sort();

  assert.deepEqual(zhKeys, enKeys);

  for (const key of zhKeys) {
    assert.equal(typeof strings.zh[key], 'string', `zh[${key}] must be a string`);
    assert.equal(typeof strings.en[key], 'string', `en[${key}] must be a string`);
    assert.ok(strings.zh[key].length > 0, `zh[${key}] cannot be empty`);
    assert.ok(strings.en[key].length > 0, `en[${key}] cannot be empty`);
  }
});

test('Locale check helper functions', () => {
  assert.equal(isLocale('zh'), true);
  assert.equal(isLocale('en'), true);
  assert.equal(isLocale('fr'), false);
  assert.equal(isLocale(null), false);

  assert.equal(htmlLang('zh'), 'zh-CN');
  assert.equal(htmlLang('en'), 'en-US');
});

test('Format utility correctly interpolates template placeholders', () => {
  const tpl = 'Hello {name}, your score is {score}!';
  const formatted = format(tpl, { name: 'Player', score: 1000 });
  assert.equal(formatted, 'Hello Player, your score is 1000!');

  const untouched = format(tpl, { name: 'Solo' });
  assert.equal(untouched, 'Hello Solo, your score is {score}!');

  assert.equal(format(null), '');
});
