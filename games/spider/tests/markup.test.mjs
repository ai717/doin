import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(__dirname, '..', 'index.html');

test('Markup: index.html exists and is readable', () => {
  assert.ok(existsSync(htmlPath));
  const html = readFileSync(htmlPath, 'utf8');
  assert.ok(html.length > 100);
});

test('Markup: Standard semantic structure and required contract tags', () => {
  const html = readFileSync(htmlPath, 'utf8');

  // Semantic elements
  assert.ok(html.includes('<header'));
  assert.ok(html.includes('<main'));
  assert.ok(html.includes('<aside'));
  assert.ok(html.includes('<section'));

  // Mandatory portal and SEO tags
  assert.ok(/<html[^>]+lang="/.test(html), 'Must specify html lang attribute');
  assert.ok(/<meta[^>]+name="description"/.test(html), 'Must include meta description');
  assert.ok(/<link[^>]+rel="icon"/.test(html), 'Must include favicon link');
  assert.ok(/<noscript/.test(html), 'Must include noscript fallback');
  assert.ok(/<a[^>]+href="\/"[^>]+id="back-home"/.test(html), 'Must include return to home link with id back-home');
});

test('Markup: Version query ?v=dev for local styles and scripts', () => {
  const html = readFileSync(htmlPath, 'utf8');
  const matches = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((url) => !url.startsWith('http') && !url.startsWith('data:') && /\.(css|mjs|js|svg)(\?|$)/.test(url));

  assert.ok(matches.length >= 2, 'Should have multiple local asset links');
  for (const asset of matches) {
    assert.ok(
      asset.includes('?v=dev'),
      `Asset link ${asset} is missing version query string ?v=dev`
    );
  }
});
