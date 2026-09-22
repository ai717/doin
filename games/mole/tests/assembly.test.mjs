// assembly.test.mjs — 装配冒烟：解析主分层的 import 图，确保引用真实存在且无循环依赖
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { strings } from "../js/i18n.mjs";

const gameDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const jsDir = resolve(gameDir, "js");

const MODULES = ["engine.mjs", "score.mjs", "storage.mjs", "i18n.mjs", "audio.mjs", "game.mjs", "ui.mjs", "main.mjs"];

function importsOf(name) {
  const src = readFileSync(resolve(jsDir, name), "utf8");
  return [...src.matchAll(/from\s+["'](\.\/[^"']+)["']/g)].map((m) => m[1]);
}

describe("assembly: 分层文件齐备", () => {
  for (const name of MODULES) {
    it(`${name} 存在且非空`, () => {
      const path = resolve(jsDir, name);
      assert.ok(existsSync(path), `缺 ${name}`);
      assert.ok(readFileSync(path, "utf8").trim().length > 200, `${name} 内容过少`);
    });
  }

  it("index.html / favicon / css 齐备", () => {
    assert.ok(existsSync(resolve(gameDir, "index.html")));
    assert.ok(existsSync(resolve(gameDir, "favicon.svg")));
    assert.ok(existsSync(resolve(gameDir, "css", "style.css")));
  });
});

describe("assembly: import 图闭合", () => {
  it("所有相对 import 都指向真实文件", () => {
    for (const name of MODULES) {
      for (const spec of importsOf(name)) {
        const target = resolve(jsDir, spec);
        assert.ok(existsSync(target), `${name} 引用了不存在的 ${spec}`);
      }
    }
  });

  it("不存在循环依赖", () => {
    const graph = new Map(MODULES.map((name) => [name, importsOf(name).map((s) => s.replace("./", ""))]));
    const visiting = new Set();
    const done = new Set();
    const walk = (node, path) => {
      if (done.has(node)) return;
      assert.ok(!visiting.has(node), `循环依赖: ${[...path, node].join(" -> ")}`);
      visiting.add(node);
      for (const next of graph.get(node) ?? []) {
        if (graph.has(next)) walk(next, [...path, node]);
      }
      visiting.delete(node);
      done.add(node);
    };
    for (const name of MODULES) walk(name, []);
  });

  it("只有 main.mjs 与 ui.mjs / audio.mjs 接触 DOM 或 WebAudio", () => {
    const domTouchers = MODULES.filter((name) =>
      /document\.|getElementById|requestAnimationFrame/.test(
        readFileSync(resolve(jsDir, name), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")
      )
    );
    assert.deepEqual(domTouchers.sort(), ["main.mjs", "ui.mjs"]);
  });
});

describe("assembly: 双语文案覆盖 HTML 标记", () => {
  const html = readFileSync(resolve(gameDir, "index.html"), "utf8");
  const keys = [...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]);

  it("至少标记了 20 处文案", () => {
    assert.ok(keys.length >= 20, `仅有 ${keys.length} 处 data-i18n`);
  });

  for (const locale of ["zh", "en"]) {
    it(`${locale} 表覆盖全部 data-i18n 键`, () => {
      const missing = keys.filter((k) => !strings[locale]?.[k]);
      assert.equal(missing.length, 0, `缺: ${missing.join(", ")}`);
    });
  }
});
