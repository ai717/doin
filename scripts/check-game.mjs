// 新游戏交付验收：node scripts/check-game.mjs <slug>
// 契约正文见 docs/GAME-SPEC.md。两级门禁：
//   T1 上架底线 —— FAIL 即 exit 1（不登记/无封面/无缓存占位/语言偏好私有/存储会抛/无返回键/无测试入口）
//   T2 一致性建议 —— 只 WARN，不拦交付
// 存量游戏按 WAIVERS 表豁免（仅打印不判 fail），新游戏零豁免。
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const slug = process.argv[2];
if (!slug) {
  console.error("usage: node scripts/check-game.mjs <slug>");
  process.exit(2);
}

const TIER1 = new Set([
  "index-html",
  "games-json",
  "cover",
  "v-dev",
  "back-home",
  "doin-lang",
  "storage-guard",
  "tests-min",
  "tests-root-script",
]);

const LEGACY_WAIVERS = {
  "orbit-sort": {
    "meta-desc": "上架早于 meta 约定",
    noscript: "上架早于 noscript 约定",
    "back-home": "上架早于返回键约定",
    "engine-module": "规则分布在 game/solver 模块，重构成本高",
  },
  "2048": {
    "v-dev": "上架早于 BUILD_ID 占位约定",
    "doin-lang": "偏好 key 统一是已记录待办（AGENTS.md §7.2）",
    "tests-root-script": "测试在 games/2048 目录内跑（AGENTS.md §10）",
  },
  sudoku: {
    "v-dev": "vite 构建产物自带 hash，无需占位",
    noscript: "SPA 壳早于 noscript 约定",
    "back-home": "SPA 壳早于返回键约定",
    "meta-desc": "SPA 壳早于 meta 约定",
    "icon-link": "SPA 壳早于 favicon 约定",
    structure: "vite SPA 用 src/ 而非 js/ css/",
    "engine-module": "TS 源码在 src/，门禁走目录内 typecheck+test",
    "storage-guard": "TS 源码在 src/",
    "tests-min": "TS 测试走目录内 vitest（npm test）",
    "i18n-module": "TS 源码在 src/，三语自有实现",
    "doin-lang": "偏好 key 统一是已记录待办（AGENTS.md §7.2）",
    "tests-dir": "测试在目录内 npm test",
    "tests-root-script": "测试在目录内 npm test",
  },
};

const gameDir = resolve(root, "games", slug);
const waivers = LEGACY_WAIVERS[slug] ?? {};
const results = [];

function check(id, ok, detail = "") {
  if (!ok && waivers[id]) {
    results.push({ id, status: "WAIVED", detail: waivers[id] });
  } else if (ok) {
    results.push({ id, status: "PASS", detail: "" });
  } else if (TIER1.has(id)) {
    results.push({ id, status: "FAIL", detail });
  } else {
    results.push({ id, status: "WARN", detail });
  }
}

function read(path) {
  return existsSync(path) && statSync(path).isFile() ? readFileSync(path, "utf8") : null;
}

function collectSources(directory, extensions) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((name) => {
    if (name === "node_modules" || name === "dist") return [];
    const path = resolve(directory, name);
    if (statSync(path).isDirectory()) return collectSources(path, extensions);
    return extensions.some((ext) => name.endsWith(ext)) ? [{ path, src: read(path) ?? "" }] : [];
  });
}

function webpSize(path) {
  const buf = readFileSync(path);
  if (buf.length < 30 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  const fourcc = buf.toString("ascii", 12, 16);
  if (fourcc === "VP8X") return [buf.readUIntLE(24, 3) + 1, buf.readUIntLE(27, 3) + 1];
  if (fourcc === "VP8 ") return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  if (fourcc === "VP8L") {
    const bits = buf.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
  }
  return null;
}

const indexHtml = read(resolve(gameDir, "index.html"));
check("index-html", indexHtml !== null, "games/<slug>/index.html 缺失");

const manifest = JSON.parse(readFileSync(resolve(root, "games.json"), "utf8")).games;
const entry = manifest.find((game) => game.slug === slug);
const missingFields = entry
  ? ["title", "slug", "desc", "icon", "cover", "tags", "url"].filter((key) => !(key in entry) || (key === "tags" && !entry.tags.length))
  : ["(未登记)"];
check("games-json", Boolean(entry) && missingFields.length === 0 && entry.url === `/${slug}/`, missingFields.join(","));

const coverPath = resolve(root, "assets", "covers", `${slug}.webp`);
const coverOk = existsSync(coverPath) && entry?.cover === `/assets/covers/${slug}.webp`;
const dims = coverOk ? webpSize(coverPath) : null;
check("cover", coverOk && dims?.[0] === 640 && dims?.[1] === 640, dims ? `${dims[0]}x${dims[1]}` : "缺 640x640 WebP 封面或 games.json cover 路径不符");

const localAssets = [...(indexHtml ?? "").matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((value) => !/^(https?:)?\/\//.test(value) && !value.startsWith("data:") && /\.(mjs|js|css)(\?|$)/.test(value));
const unversioned = localAssets.filter((value) => !value.includes("?v=dev"));
check("v-dev", localAssets.length > 0 && unversioned.length === 0, unversioned.join(","));

check("back-home", /<a[^>]+href="\/"/.test(indexHtml ?? ""), "缺返回首页链接");

const jsSources = collectSources(gameDir, [".mjs", ".js"]);
check("doin-lang", jsSources.some((file) => file.src.includes("doin.lang")), "语言偏好必须读写全站共享 key doin.lang");

const storageModule = read(resolve(gameDir, "js", "storage.mjs"));
const storageUsers = jsSources.filter((file) => file.src.includes("localStorage"));
const storageGuarded =
  storageUsers.length === 0 ||
  (storageModule !== null && storageModule.includes("catch")) ||
  (storageUsers.length === 1 && storageUsers[0].src.includes("catch"));
check("storage-guard", storageGuarded, `localStorage 分散在 ${storageUsers.length} 个文件且无 try/catch 降级`);

const testFiles = existsSync(resolve(gameDir, "tests"))
  ? readdirSync(resolve(gameDir, "tests")).filter((name) => name.endsWith(".test.mjs"))
  : [];
check("tests-min", testFiles.length >= 1, "tests/ 下没有任何 .test.mjs");
const rootScripts = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).scripts ?? {};
check("tests-root-script", Boolean(rootScripts[`test:${slug}`]), `根 package.json 缺 test:${slug} 脚本`);

check("structure", existsSync(resolve(gameDir, "js")) && existsSync(resolve(gameDir, "css")), "建议 js/ 与 css/ 目录");
check("module-script", /<script[^>]+type="module"/.test(indexHtml ?? ""), "建议入口脚本用 ES module（测试才能直接 import 复用）");
check("noscript", /<noscript/.test(indexHtml ?? ""), "建议 <noscript> 兜底");
check("meta-desc", /<meta[^>]+name="description"/.test(indexHtml ?? ""), "建议 meta description");
check("icon-link", /rel="icon"/.test(indexHtml ?? ""), "建议 favicon");
check("html-lang", /<html[^>]+lang="/.test(indexHtml ?? ""), "建议 html lang");
check("i18n-module", read(resolve(gameDir, "js", "i18n.mjs")) !== null, "建议 js/i18n.mjs 集中双表");

const engineSource = read(resolve(gameDir, "js", "engine.mjs"));
const domLeaks = engineSource ? ["document.", "window.", "localStorage", "sessionStorage"].filter((token) => engineSource.includes(token)) : [];
check("engine-module", engineSource !== null && domLeaks.length === 0, domLeaks.length ? `engine 混入 DOM/存储: ${domLeaks.join(",")}` : "建议 js/engine.mjs 承载纯规则");

const cssAll = collectSources(gameDir, [".css"]).map((file) => file.src).join("\n");
check("reduced-motion", cssAll.includes("prefers-reduced-motion"), "建议动效带 prefers-reduced-motion 降级");
check("tests-dir", testFiles.length >= 3, `建议 tests/ 覆盖 engine/storage/i18n/markup（当前 ${testFiles.length} 个）`);

const failed = results.filter((result) => result.status === "FAIL");
const warned = results.filter((result) => result.status === "WARN");
const waived = results.filter((result) => result.status === "WAIVED");
console.log(`== check-game: ${slug} ==`);
for (const result of results) {
  const tier = TIER1.has(result.id) ? "T1" : "T2";
  const note = result.detail ? `  <- ${result.detail}` : "";
  console.log(`${result.status.padEnd(6)} [${tier}] ${result.id}${note}`);
}
console.log(`-- ${results.length - failed.length - warned.length - waived.length} pass, ${failed.length} fail(T1), ${warned.length} warn(T2), ${waived.length} waived`);
process.exit(failed.length ? 1 : 0);
