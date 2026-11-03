import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STRINGS, getLanguage, setLanguage, t } from '../js/i18n.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function containsChinese(str) {
  return /[\u4e00-\u9fa5]/.test(str);
}

function collectStrings(obj, prefix = '') {
  const result = [];
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof val === 'string') {
      result.push({ key: fullKey, val });
    } else if (val && typeof val === 'object') {
      result.push(...collectStrings(val, fullKey));
    }
  }
  return result;
}

test('i18n: strings.en contains ZERO Chinese characters (excluding langName switch label)', () => {
  const enEntries = collectStrings(STRINGS.en);
  const chineseFound = [];

  for (const { key, val } of enEntries) {
    if (key === 'langName') continue; // 白名单：允许 langName 为 '中文' 供玩家辨识
    if (containsChinese(val)) {
      chineseFound.push({ key, val });
    }
  }

  assert.equal(
    chineseFound.length,
    0,
    `Found Chinese in strings.en: ${JSON.stringify(chineseFound, null, 2)}`
  );
});

test('i18n: translation keys symmetry between zh and en', () => {
  const zhKeys = collectStrings(STRINGS.zh).map((e) => e.key).sort();
  const enKeys = collectStrings(STRINGS.en).map((e) => e.key).sort();

  assert.deepEqual(zhKeys, enKeys, 'zh and en translation key structures must be symmetric');
});

test('i18n: shared preference key is doin.lang', () => {
  const i18nSource = fs.readFileSync(path.join(__dirname, '../js/i18n.mjs'), 'utf8');
  assert.ok(i18nSource.includes('doin.lang'), 'Must read/write global key doin.lang');
});

test('i18n: no location.reload in source files', () => {
  const jsDir = path.join(__dirname, '../js');
  const files = fs.readdirSync(jsDir);
  for (const file of files) {
    if (!file.endsWith('.mjs') && !file.endsWith('.js')) continue;
    const content = fs.readFileSync(path.join(jsDir, file), 'utf8');
    const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    assert.ok(
      !cleanContent.includes('location.reload'),
      `File ${file} must not use location.reload()`
    );
  }
});
