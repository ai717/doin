// 坦克巷战 · 无浏览器冒烟测试（多视口 / 多存档自动复跑）
//
//   node games/tank/tests/smoke.mjs
//   npm run smoke:tank
//
// 本文件是「跑批调度器」：用不同视口与不同存档各跑一次 smoke-case.mjs。
// 用子进程而不是同进程内循环，是因为 localStorage / document / setTimeout 这些桩
// 一旦装上就无法干净卸载，同进程复跑会互相污染。

import { spawn } from "node:child_process";
import { resolve } from "node:path";

const CASE = resolve(import.meta.dirname, "smoke-case.mjs");

const RUNS = [
  { label: "桌面 1440x900 · 老玩家存档", env: { SM_W: "1440", SM_H: "900" } },
  { label: "移动 390x844 · 老玩家存档", env: { SM_W: "390", SM_H: "844" } },
  { label: "桌面 1440x900 · 全新空存档", env: { SM_W: "1440", SM_H: "900", SM_FRESH: "1" } }
];

function runOne(run) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [CASE], {
      env: { ...process.env, NO_COLOR: "1", ...run.env }
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("close", (code) => done({ ...run, code, stdout, stderr }));
  });
}

console.log("== 坦克巷战 smoke ==");
let failed = 0;
for (const run of RUNS) {
  const res = await runOne(run);
  const ok = res.code === 0;
  if (!ok) failed += 1;
  console.log(`\n### ${run.label} — ${ok ? "PASS" : "FAIL"}`);
  console.log(res.stdout.trim());
  if (res.stderr.trim()) console.log("stderr:\n" + res.stderr.trim());
}

if (failed) {
  console.log(`\n== smoke 结果：${failed} 个场景失败 ==`);
  process.exit(1);
}
console.log("\n== smoke 结果：全部场景 PASS ==");
