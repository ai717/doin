// 恶魔迷途 · 无浏览器冒烟测试（多视口 / 多存档自动复跑）
//
// 单独跑一遍：
//   node games/devil-run/tests/smoke.mjs
// 或走根脚本：
//   npm run smoke:devil-run
//
// 本文件是「跑批调度器」：它会用不同视口与不同存档各跑一次
// tests/smoke-case.mjs（真正的断言在那边）。用子进程而不是同进程内循环，是因为
// localStorage / document / rAF 这些桩一旦装上就无法干净卸载，同进程复跑会互相污染。

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const CASE = resolve(import.meta.dirname, "smoke-case.mjs");

const RUNS = [
  { label: "桌面 1440x900 · 老玩家存档", env: { SM_W: "1440", SM_H: "900" } },
  { label: "移动 390x844 · 老玩家存档", env: { SM_W: "390", SM_H: "844" } },
  { label: "桌面 1440x900 · 全新空存档", env: { SM_W: "1440", SM_H: "900", SM_FRESH: "1" } }
];

const results = [];

for (const run of RUNS) {
  const r = spawnSync(process.execPath, [CASE], {
    env: { ...process.env, NO_COLOR: "1", ...run.env },
    encoding: "utf8"
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`.trim();
  const tail = out.split("\n").filter((l) => /^(PASS|FAIL|结果)/.test(l));
  results.push({ ...run, code: r.status, tail, out });
}

let failed = 0;
for (const r of results) {
  const ok = r.code === 0;
  if (!ok) failed++;
  const summary = r.tail.find((l) => l.startsWith("结果")) || r.tail[r.tail.length - 1] || "(无输出)";
  const passCount = r.tail.filter((l) => l.startsWith("PASS")).length;
  const failCount = r.tail.filter((l) => l.startsWith("FAIL")).length;
  console.log(`${ok ? "PASS" : "FAIL"}  ${r.label}  —  ${passCount} pass / ${failCount} fail  |  ${summary}`);
  if (!ok) {
    for (const line of r.tail.filter((l) => l.startsWith("FAIL"))) console.log("        " + line);
    // 异常栈也在 stdout 里，原样透传前 40 行帮助定位
    const noisy = r.out.split("\n").filter((l) => !/^(PASS|FAIL|结果)/.test(l));
    if (noisy.length) console.log(noisy.slice(0, 40).map((l) => "        " + l).join("\n"));
  }
}

console.log("");
if (failed) {
  console.log(`结果：FAIL（${failed}/${results.length} 个场景未通过）`);
  process.exit(1);
}
console.log(`结果：PASS（${results.length}/${results.length} 个场景全通过）`);
