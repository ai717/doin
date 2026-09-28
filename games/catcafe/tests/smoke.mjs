// 迷你猫咖掌柜 · 无浏览器冒烟测试（多视口 / 多存档自动复跑）
//
// 单独跑一遍：
//   node games/catcafe/tests/smoke.mjs
// 或走根脚本：
//   npm run smoke:catcafe
//
// 本文件是「跑批调度器」：用不同视口与不同存档各跑一次 smoke-case.mjs。
// 用子进程而不是同进程内循环，是因为 localStorage / document / setInterval
// 这些桩一旦装上就无法干净卸载，同进程复跑会互相污染。

import { spawn } from "node:child_process";
import { resolve } from "node:path";

const CASE = resolve(import.meta.dirname, "smoke-case.mjs");

// 三个场景：桌面+老玩家、移动+老玩家、桌面+全新空存档
const RUNS = [
  { label: "桌面 1440x900 · 老玩家存档", env: { SM_W: "1440", SM_H: "900" } },
  { label: "移动 390x844 · 老玩家存档", env: { SM_W: "390", SM_H: "844" } },
  { label: "桌面 1440x900 · 全新空存档", env: { SM_W: "1440", SM_H: "900", SM_FRESH: "1" } }
];

// 异步运行一个场景：pipe 收集 stdout/stderr，同时把子进程输出原样回显到父进程
function runOne(run) {
  return new Promise((resolveP) => {
    const child = spawn(process.execPath, [CASE], {
      env: { ...process.env, NO_COLOR: "1", ...run.env }
      // 默认 pipe：r.stdout/r.stderr 走 buffer 同时也允许父进程读
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      const s = d.toString();
      stdout += s;
      process.stdout.write(s);
    });
    child.stderr.on("data", (d) => {
      const s = d.toString();
      stderr += s;
      process.stderr.write(s);
    });
    child.on("close", (code, signal) => {
      const out = stdout + stderr;
      const tail = out.split("\n").filter((l) => /^(PASS|FAIL|结果)/.test(l));
      resolveP({ ...run, code, signal, tail, out });
    });
    child.on("error", (err) => {
      resolveP({ ...run, code: -1, signal: null, tail: [], out: `spawn error: ${err.message}` });
    });
  });
}

const results = [];
for (const run of RUNS) {
  console.log(`\n────────── 跑批：${run.label} ──────────`);
  results.push(await runOne(run));
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
  }
}

console.log("");
if (failed) {
  console.log(`结果：FAIL（${failed}/${results.length} 个场景未通过）`);
  process.exit(1);
}
console.log(`结果：PASS（${results.length}/${results.length} 个场景全通过）`);