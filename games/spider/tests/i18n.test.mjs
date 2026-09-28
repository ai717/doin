import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strings, LOCALES, LANG_KEY } from '../js/i18n.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('i18n: LOCALES contains zh and en and uses doin.lang key', () => {
  assert.ok(LOCALES.includes('zh'));
  assert.ok(LOCALES.includes('en'));
  assert.equal(LANG_KEY, 'doin.lang');
});

test('i18n: Key parity between zh and en dictionaries', () => {
  const zhKeys = Object.keys(strings.zh).sort();
  const enKeys = Object.keys(strings.en).sort();

  const missingInEn = zhKeys.filter((k) => !enKeys.includes(k));
  const missingInZh = enKeys.filter((k) => !zhKeys.includes(k));

  assert.deepEqual(missingInEn, [], `Keys missing in English dictionary: ${missingInEn.join(', ')}`);
  assert.deepEqual(missingInZh, [], `Keys missing in Chinese dictionary: ${missingInZh.join(', ')}`);
});

test('i18n: strings.en is 100% pure English with zero Chinese characters', () => {
  const chineseRegex = /[\u4e00-\u9fa5]/;
  const whitelist = ['langSwitch']; // Allowed to display "中文" on language switch button

  for (const [key, val] of Object.entries(strings.en)) {
    if (whitelist.includes(key)) continue;
    assert.equal(
      chineseRegex.test(val),
      false,
      `strings.en[${key}] contains Chinese character: "${val}"`
    );
  }
});

test('i18n: JS runtime code contains zero hardcoded Chinese strings', () => {
  const jsDir = resolve(__dirname, '..', 'js');
  const files = readdirSync(jsDir).filter((name) => name.endsWith('.mjs') && name !== 'i18n.mjs');
  const chineseStringRegex = /(["'`])[^"'`\r\n]*[\u4e00-\u9fa5]+[^"'`\r\n]*\1/g;

  for (const file of files) {
    const content = readFileSync(resolve(jsDir, file), 'utf8');
    // Strip comments
    const stripped = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    const matches = stripped.match(chineseStringRegex);
    assert.equal(
      matches,
      null,
      `File ${file} has hardcoded Chinese string literals: ${matches ? matches.join(', ') : ''}`
    );
  }
});

test('i18n: English mode text mapping covers all initial static markup strings', () => {
  // Read index.html
  const html = readFileSync(resolve(__dirname, '..', 'index.html'), 'utf8');
  // Strip noscript block (noscript carries static fallback for disabled JS)
  const withoutNoscript = html.replace(/<noscript>[\s\S]*?<\/noscript>/, '');

  // Extract all Chinese strings in index.html (outside noscript)
  const matches = withoutNoscript.match(/[\u4e00-\u9fa5]+/g) || [];
  assert.ok(matches.length > 0, 'index.html has initial Chinese markup');

  // Verify that every Chinese string in index.html exists in strings.zh so ui.setLocale('en') replaces it
  const zhValues = Object.values(strings.zh);
  const unmapped = [];
  for (const text of matches) {
    const found = zhValues.some((val) => typeof val === 'string' && val.includes(text));
    if (!found) {
      unmapped.push(text);
    }
  }

  assert.deepEqual(
    unmapped,
    [],
    `Found Chinese text in index.html that is not mapped in strings.zh: ${unmapped.join(', ')}`
  );
});

