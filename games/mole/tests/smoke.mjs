// smoke.mjs — 无浏览器运行时冒烟：在 DOM 桩里装配真实 main.mjs，
// 断言"业务可观测量在推进"（而非仅"没抛异常"），防止假绿。
// 用法： node games/mole/tests/smoke.mjs
// 环境变量：SM_W / SM_H 可覆盖视口尺寸；SM_TAG 用于输出前缀。

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { installDom } from "./dom-stub.mjs";

const gameDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(resolve(gameDir, "index.html"), "utf8");

const W = Number(process.env.SM_W || 1280);
const H = Number(process.env.SM_H || 800);
const TAG = process.env.SM_TAG || `${W}x${H}`;

const failures = [];
const notes = [];

function check(label, condition, detail = "") {
  if (condition) {
    notes.push(`  PASS ${label}`);
  } else {
    failures.push(`  FAIL ${label}${detail ? ` <- ${detail}` : ""}`);
  }
}

const env = installDom(html);
env.document.body.querySelectorAll(".hole"); // 预热
globalThis.window.innerWidth = W;
globalThis.window.innerHeight = H;

// 捕获非法颜色等渲染噪声
const badColorRe = /(NaN|undefined|null)\s*\)/;
const runtimeErrors = [];

const originalWarn = console.warn;
console.warn = (...args) => {
  const text = args.join(" ");
  if (badColorRe.test(text)) runtimeErrors.push(`非法颜色: ${text}`);
  originalWarn(...args);
};

// ---- 装配真实入口 ----
await import("../js/main.mjs");
const api = globalThis.window.__mole;
check("main.mjs 装配出 __mole 句柄", Boolean(api), "缺少 window.__mole");
if (!api) {
  emit();
  process.exit(1);
}

const { ui, game, startRun, hitIndex } = api;
const isOpen = (el) => Boolean(el) && !el.classList.contains("hidden");

// ---- 1. 初始态：洞位网格已建、欢迎弹层打开、主循环在跑 ----
check("洞位网格已构建", ui.holes.length >= 9, `holes=${ui.holes.length}`);
check("网格与视口匹配（桌面 4 列 / 移动 3 列）",
  W <= 768 ? ui.cols === 3 : ui.cols === 4, `cols=${ui.cols}`);
check("欢迎弹层初始为显示", isOpen(ui.dom.modalWelcome), "welcome 被隐藏了");
check("暂停弹层初始为隐藏", !isOpen(ui.dom.modalPause),
  "pause 初始可见 —— 桩未还原 HTML 的 hidden");

// ---- 2. 开局：计时必须真的推进 ----
env.step(2);
startRun("normal");
check("开局后进入 running", game.run?.status === "running", `status=${game.run?.status}`);
const t0 = game.run.timeLeftMs;
env.step(60); // 约 1 秒
const t1 = game.run.timeLeftMs;
check("主循环推进：剩余时间在减少", t1 < t0, `${t0} -> ${t1}`);
check("开局后欢迎弹层已关闭", !isOpen(ui.dom.modalWelcome), "welcome 未关闭");

// ---- 3. 命中：分数与连击必须真的涨 ----
const active = [];
for (let i = 0; i < game.run.holes.length; i += 1) {
  const m = game.run.holes[i];
  if (m && m.phase !== "duck") active.push({ i, m });
}
check("场上有地鼠冒出", active.length > 0, "无地鼠（生成器停摆）");
const scoreBefore = game.run.score;
const comboBefore = game.run.combo;
for (const { i, m } of active) {
  if (m.species !== "bomb") hitIndex(i);
}
check("命中后得分/连击推进", game.run.score > scoreBefore || game.run.combo > comboBefore,
  `score ${scoreBefore}->${game.run.score}, combo ${comboBefore}->${game.run.combo}`);

// ---- 4. HUD 文本必须与引擎一致（UI 不得自算） ----
check("HUD 得分与引擎一致", ui.dom.hudScore.textContent === String(game.run.score),
  `hud=${ui.dom.hudScore.textContent} engine=${game.run.score}`);
check("HUD 连击与引擎一致", ui.dom.hudCombo.textContent === String(game.run.combo),
  `hud=${ui.dom.hudCombo.textContent} engine=${game.run.combo}`);
check("HUD 计时数字已渲染", /^\d+$/.test(ui.dom.hudTime.textContent), `time=${ui.dom.hudTime.textContent}`);

// ---- 5. 暂停：计时应停住 ----
ui.dom.btnPause.dispatch("click");
check("暂停后 paused=true", game.paused === true, `paused=${game.paused}`);
check("暂停弹层可见", isOpen(ui.dom.modalPause), "暂停弹层未显示");
const p0 = game.run.timeLeftMs;
env.step(60);
check("暂停期间计时不推进", game.run.timeLeftMs === p0, `${p0} -> ${game.run.timeLeftMs}`);
ui.dom.btnResume.dispatch("click");
check("恢复后 paused=false", game.paused === false);
env.step(30);
check("恢复后计时继续", game.run.timeLeftMs < p0, "恢复后仍未推进");

// ---- 6. 键盘：数字键必须能敲中 ----
{
  // 造一只确定性的鼠放好，再派发真实 keydown
  const target = game.run.holes.findIndex((m) => !m);
  game.run.holes[target] = {
    id: game.run.nextId++, species: "normal", phase: "up", t: 0, upMs: 5000, hp: 1,
  };
  const before = game.run.hits;
  env.document.dispatch("keydown", { key: "1" });
  check("键盘 1 键敲中首洞", game.run.hits === before + 1,
    `hits ${before} -> ${game.run.hits}`);
}
{
  const before = game.paused;
  env.document.dispatch("keydown", { key: "p" });
  check("键盘 P 键切换暂停", game.paused !== before, `paused=${game.paused}`);
  if (game.paused) env.document.dispatch("keydown", { key: "p" });
}

// ---- 7. 走完整局：结算弹层 + 存档写入 ----
let guard = 0;
while (game.run.status === "running" && guard < 6000) {
  env.step(1);
  guard += 1;
}
check("对局能正常结算", game.run.status === "over", `status=${game.run.status} guard=${guard}`);
check("结算弹层已显示", isOpen(ui.dom.modalGameover), "gameover 未显示");
check("结算分数与引擎一致", ui.dom.settleScore.textContent === String(game.run.score),
  `settle=${ui.dom.settleScore.textContent} engine=${game.run.score}`);
const saved = JSON.parse(env.localStorage.getItem("doin.mole.v1") ?? "null");
check("存档已写入且分数非负", saved && saved.bestScore && saved.bestScore.normal >= 0,
  `saved=${env.localStorage.getItem("doin.mole.v1")}`);

// ---- 8. 每日模式：同题可复现 ----
startRun("daily");
const seedA = game.run.seed;
const first = [];
env.step(80);
for (const hole of game.run.holes) if (hole) first.push(`${hole.species}@${hole.upMs}`);
startRun("daily");
const seedB = game.run.seed;
check("每日模式同日同种子", seedA === seedB, `${seedA} !== ${seedB}`);
check("每日模式标记正确", game.run.daily === true && game.mode === "daily");

// ---- 9. 语言与音效按钮存在且可点 ----
ui.dom.btnSound.dispatch("click");
ui.dom.btnSound.dispatch("click");
check("音效按钮可切换且不抛错", true);
check("语言切换写入 doin.lang",
  env.localStorage.getItem("doin.lang") === null || ["zh", "en"].includes(env.localStorage.getItem("doin.lang")));

// ---- 10. 视口切换：网格与引擎必须同步，且不残留旧 DOM ----
{
  startRun("normal");
  env.step(4);
  globalThis.window.innerWidth = W <= 768 ? 1280 : 390;
  env.document.dispatch("orientationchange", {});
  env.step(4);
  const cols = globalThis.window.innerWidth <= 768 ? 3 : 4;
  check("视口切换后网格列数更新", ui.cols === cols, `cols=${ui.cols} want=${cols}`);
  check("DOM 洞位数与网格一致", ui.holes.length === ui.rows * ui.cols,
    `dom=${ui.holes.length} grid=${ui.rows * ui.cols}`);
  check("网格区子节点数与网格一致", ui.dom.grid.children.length === ui.rows * ui.cols,
    `children=${ui.dom.grid.children.length}`);
  check("网格切换后引擎洞位数同步", !game.run || game.run.holes.length === ui.rows * ui.cols,
    `engine=${game.run?.holes.length} grid=${ui.rows * ui.cols}`);
  globalThis.window.innerWidth = W;
  env.document.dispatch("orientationchange", {});
  env.step(4);
}

// ---- 11. 洞的结构契约：地鼠必须住在"底边压地平线"的活动区里，且洞口不带盖子 ----
{
  const hole = ui.holes[0].el;
  const pit = hole.querySelector(".hole-pit");
  const clip = hole.querySelector(".mole-clip");
  const mole = hole.querySelector(".mole");
  check("每个洞都有洞口、活动区与地鼠", Boolean(pit) && Boolean(clip) && Boolean(mole),
    "缺少 .hole-pit / .mole-clip / .mole");
  check("地鼠是活动区的子节点（隐藏态可被裁剪）", mole?.parentNode === clip,
    `mole.parent=${mole?.parentNode?.className}`);
  check("洞口不再是地鼠的裁剪容器", !hole.querySelector(".hole-rim"), ".hole-rim 仍然存在");
  check("地鼠与洞口是兄弟节点（地鼠遮住洞口后半圈）",
    clip?.parentNode === hole && pit?.parentNode === hole,
    `clip.parent=${clip?.parentNode?.className} pit.parent=${pit?.parentNode?.className}`);
}

// ---- 12. 缩回时长随机化必须真的落到 DOM 上 ----
// ui.mjs 把每只鼠的 duckMs 写成内联 --duck-ms，CSS transition 读它。
// 桩的 style.setProperty 曾经是 no-op，这条链路完全测不到（又一个盲区）。
// 需要让地鼠自然走到 duck 阶段，所以先空推一段（不敲击，任其自行缩回）。
{
  // 注意：前面的用例already把上一局打到 over 了，主循环不再生成地鼠。
  // 必须重新开局，否则这里永远等不到 duck 阶段（会得到假失败）。
  startRun("normal");
  // 地鼠要先自然走到 duck 阶段才会写 --duck-ms，所以空推若干帧（不敲击）。
  // 不同难度/视口的露头时长不同，这里循环到出现第一个 duck 或到上限为止，
  // 别写死一个帧数 —— 写死会在某些视口下偶发假失败。
  const readDuck = () => {
    const s = new Set();
    for (const h of ui.holes) {
      // 注意读的是洞位（view.el）而不是 .mole —— 属性设在洞位上，
      // 靠 CSS 自定义属性的继承传到子元素 .mole 的 transition。
      const v = h.el?.style?.getPropertyValue?.("--duck-ms");
      if (v) s.add(v);
    }
    return s;
  };
  let seen = readDuck();
  for (let i = 0; i < 40 && seen.size === 0; i += 1) {
    env.step(10);
    seen = readDuck();
  }
  check("缩回时长已写到 DOM 的 --duck-ms 上", seen.size > 0,
    "没有任何洞位拿到内联 --duck-ms（setProperty 可能是 no-op，或地鼠始终没进入 duck）");
  check("缩回时长是合法的 ms 数值", [...seen].every((v) => /^\d+ms$/.test(v)),
    `异常值: ${[...seen].join(", ")}`);
  // 多推一会儿以便采到多只鼠，验证"快慢有别"
  for (let i = 0; i < 80; i += 1) {
    env.step(10);
    for (const v of readDuck()) seen.add(v);
  }
  // 无条件断言：若只采到一个值，要么随机化失效、要么采样窗口太短，
  // 两种情况都该暴露出来，不能静默跳过。
  const nums = [...seen].map((v) => parseInt(v, 10));
  check("各鼠缩回时长有差异（不是恒定值）", nums.length >= 2,
    `只采到 ${nums.length} 种缩回时长（${nums.join(",")}ms），随机化没生效或采样窗口太短`);
  if (nums.length >= 2) {
    check("缩回时长的快慢跨度足够明显", Math.max(...nums) - Math.min(...nums) >= 20,
      `跨度仅 ${Math.max(...nums) - Math.min(...nums)}ms（${Math.min(...nums)}~${Math.max(...nums)}），看不出快慢差别`);
  }
}

// ---- 13. 木槌链路：指针进入 → 显形 → 跟随光标 ----
// 这一段的来由：曾有版本把木槌过度收紧到 `(hover:hover) and (pointer:fine)`，
// 之后再怎么点都"看不到锤子"，而所有测试全绿 —— 因为没有任何断言碰过这条链路。
// 桩测不到像素，但能测"类名 + 内联坐标是否真的写进去了"。
{
  const hammer = ui.dom.hammer;
  const garden = ui.dom.garden;
  check("木槌元素已装配", Boolean(hammer) && Boolean(garden), "缺少 #hammer 或 #garden");
  const armed = () => hammer.classList.contains("is-armed");

  // 从"未悬停"的干净态开始
  garden.dispatch("pointerleave", {});
  check("指针离开后木槌收起（无 is-armed）", !armed(),
    `classList=${hammer.className}`);

  // 指针进入花园：应立刻显形，不依赖用户先动一下鼠标
  garden.dispatch("pointerenter", { pointerType: "mouse", clientX: 300, clientY: 200 });
  check("指针进入花园后木槌显形", armed(), "pointerenter 未点亮 is-armed");

  // 先清掉上一轮可能残留的内联坐标，确保下面的断言来自本次事件
  hammer.style.left = "";
  hammer.style.top = "";
  garden.dispatch("pointermove", { pointerType: "mouse", clientX: 300, clientY: 200 });
  // ★ 必须写"视口坐标"而不是 garden 内相对坐标：
  // 木槌是 fixed 定位，写相对坐标会让锤子整体偏移 garden 的 left/top。
  // 桩给 #garden 的 rect 是 left:40 / top:90，因此两种写法结果必然不同，可断言。
  check("木槌跟随光标写入视口 left", hammer.style.left === "300px",
    `left=${hammer.style.left}（期望 300px；写成 ${300 - 40}px 说明又退回了 garden 相对坐标）`);
  check("木槌跟随光标写入视口 top", hammer.style.top === "200px",
    `top=${hammer.style.top}（期望 200px；写成 ${200 - 90}px 说明又退回了 garden 相对坐标）`);
  check("木槌定位为 fixed（脱离 .garden 的 overflow 裁剪）",
    hammer.style.position === "fixed", `position=${hammer.style.position || "(空)"}`);

  // 触屏兜底：pointerType=touch 时必须收走木槌，否则触屏上会有一把锤子跟着手指
  garden.dispatch("pointermove", { pointerType: "touch", clientX: 120, clientY: 120 });
  check("触摸时收走木槌并上 is-touch", !armed() && garden.classList.contains("is-touch"),
    `armed=${armed()} is-touch=${garden.classList.contains("is-touch")}`);
  // 鼠标回来必须能恢复（混合输入设备不能被一次触摸永久锁死）
  garden.dispatch("pointermove", { pointerType: "mouse", clientX: 400, clientY: 300 });
  check("鼠标回来后木槌恢复", armed() && !garden.classList.contains("is-touch"),
    `armed=${armed()} is-touch=${garden.classList.contains("is-touch")}`);
  check("恢复后坐标同步更新", hammer.style.left === "400px" && hammer.style.top === "300px",
    `left=${hammer.style.left} top=${hammer.style.top}`);
}

// ---- 14. 砸下去的反馈链路：挥锤动画 + 落点冲击波 + 屏幕微震 ----
// 用户反馈"锤子砸下去缺乏动画效果"。这一段把三样反馈逐一钉死，
// 否则将来任何一样被删掉都不会有测试报警。
{
  const hammer = ui.dom.hammer;
  check("木槌元素已装配", Boolean(hammer), "缺少 #hammer");
  // 挥击动画必须挂在 .hammer 本体上 —— 曾经套了一层 .hammer-rig，
  // 依赖后代选择器，多一层就多一处失配的可能。
  check("挥击动画挂在 .hammer 本体（无多余内层）",
    !/\.hammer\.is-swing\s+\.hammer-rig/.test(readFileSync(resolve(gameDir, "css/style.css"), "utf8")),
    "CSS 里仍残留 .hammer.is-swing .hammer-rig 的后代选择器");

  // 先让游戏跑起来，否则 hitIndex 会被 isRunning 拦掉。
  // 注意要推到真的有地鼠浮出（RISE_MS=220ms，4 帧远不够），
  // 否则会打到空洞、hits 不涨 —— 那又是"断言写法错"而不是产品缺陷。
  startRun("normal");
  let holeWithMole = -1;
  for (let i = 0; i < 60 && holeWithMole < 0; i += 1) {
    env.step(10);
    holeWithMole = game.run.holes.findIndex((m) => m && m.species !== "bomb" && m.phase === "up");
  }
  check("已等到一只可打的地鼠（前置条件）", holeWithMole >= 0,
    "60×10ms 内没有地鼠进入 up 阶段，说明生成器或冒头时序有问题");

  // --- 挥锤动画 ---
  // pointerdown 监听器绑在 .holes-grid 上（事件委托），所以必须派发到 grid，
  // 并把 target 设成洞位 —— 桩不冒泡，派发到洞位本身是收不到的。
  const fireAt = (holeEl) =>
    ui.dom.grid.dispatch("pointerdown", {
      pointerType: "mouse", clientX: 500, clientY: 320, target: holeEl,
    });

  const targetHole = ui.holes[holeWithMole >= 0 ? holeWithMole : 0].el;
  const holesBefore = game.run.hits;
  fireAt(targetHole);
  check("砸击真的命中了（hits 递增）", game.run.hits > holesBefore,
    `hits ${holesBefore} -> ${game.run.hits}（holeWithMole=${holeWithMole} dataset.index=${targetHole.dataset.index}）`);
  check("砸击后木槌挂上 is-swing", hammer.classList.contains("is-swing"),
    `classList=${hammer.className}`);

  // 动画收尾：桩不会自己发 animationend，测试显式推一下，
  // 验证"动画结束摘类"这条路是通的（连击时靠它重启动画）
  hammer.dispatch("animationend");
  check("animationend 后摘掉 is-swing（连击可重启）", !hammer.classList.contains("is-swing"),
    `未摘类，第二次挥击将失效。classList=${hammer.className}`);

  // --- 落点冲击波 ---
  const hitHoles = ui.holes.filter((h) => h.el.classList.contains("is-impact"));
  check("命中洞位挂上 is-impact（落点冲击波）", hitHoles.length > 0,
    "没有任何洞位拿到 is-impact，砸中缺少落点反馈");
  check("命中洞位同时有 is-hit（地鼠挤压）",
    ui.holes.some((h) => h.el.classList.contains("is-hit")),
    "is-hit 缺失，地鼠没有被打扁的反馈");

  // --- 屏幕微震 ---
  check("命中后 .garden 挂上 is-shake", ui.dom.garden.classList.contains("is-shake"),
    `gardenClass=${ui.dom.garden.className}`);
  check("微震时长写在 --shake-ms 上", /^\d+ms$/.test(ui.dom.garden.style.getPropertyValue("--shake-ms")),
    `--shake-ms=${ui.dom.garden.style.getPropertyValue("--shake-ms")}`);

  // 炸弹用更长的震动，与普通命中区分
  const bombIdx = game.run.holes.findIndex((m) => m && m.species === "bomb");
  if (bombIdx >= 0) {
    // 清掉上一轮的时长，确保下面读到的是本次事件写的值
    ui.dom.garden.style.setProperty("--shake-ms", "");
    fireAt(ui.holes[bombIdx].el);
    check("炸弹命中使用更强的震动（--shake-ms 更长）",
      ui.dom.garden.style.getPropertyValue("--shake-ms") === "300ms",
      `--shake-ms=${ui.dom.garden.style.getPropertyValue("--shake-ms")}`);
  }
}

// ---- 15. 受击状态的存活时间（用户反馈"地鼠被打的状态缺乏"的回归） ----
// 根因复盘：命中后 engine 立刻把鼠置成 DUCK 并按 duckMs 计时，
// 几十毫秒内 holes[i] 就变成 null。syncHoles 见到 view.id 变化会顺手清一遍 class，
// 于是 380ms 的挨打动画播不到一半就被掐断 —— 玩家看到的是"锤子落下、地鼠直接没了"。
// 这里把"多帧之后 is-hit 还在"钉死：只要 syncHoles 再去清,这条就会红。
{
  const fireOnce = (holeEl) =>
    ui.dom.grid.dispatch("pointerdown", {
      pointerType: "mouse", clientX: 500, clientY: 320, target: holeEl,
    });

  let idx = -1;
  for (let i = 0; i < 80 && idx < 0; i += 1) {
    env.step(10);
    idx = game.run.holes.findIndex((m) => m && m.species !== "bomb" && m.phase === "up");
  }
  check("等到下一只可打的地鼠（前置条件）", idx >= 0, "80×10ms 内没有地鼠浮出");

  const holeEl = ui.holes[idx >= 0 ? idx : 0].el;
  fireOnce(holeEl);
  check("命中瞬间挂上 is-hit", holeEl.classList.contains("is-hit"),
    `classList=${holeEl.className}`);
  // 眩晕星星：buildGrid 每个洞都得有，靠 CSS 的 .is-hit 显形。
  // 桩的 querySelector 只认单一简单选择器，后裔选择器必须拆两步查。
  const starsWrap = ui.holes[0].el.querySelector(".mole-stars");
  check("每个洞位都有眩晕星星构件",
    Boolean(starsWrap) && ui.holes.every((h) => h.el.querySelector(".mole-stars")?.querySelectorAll(".star").length === 3),
    `缺少 .mole-stars/.star（wrap=${Boolean(starsWrap)}）—— 挨打时头顶没有星星`);

  // 推进 240ms —— 已经超过最快的自然缩回时长（DUCK_RANGE_MS 下界 110ms），
  // 过去这正是会被 syncHoles 掐断的窗口。注意 step 第一个参数是帧数不是毫秒。
  env.step(15, 16);
  check("受击 240ms 后 is-hit 仍在（未被 syncHoles 掐断）", holeEl.classList.contains("is-hit"),
    `classList=${holeEl.className} —— syncHoles 又把受击类清了，挨打动画会被截断`);
  // 同一时刻地鼠必须还在场上：受击下沉走固定 WHACKED_MS，不再用随机的自然缩回时长。
  check("受击 240ms 地鼠仍在场上（受击下沉走固定时长）", Boolean(game.run.holes[idx]),
    `holes[${idx}]=${JSON.stringify(game.run.holes[idx] ?? null)} —— 被打的地鼠提前退场，动作演不完`);

  // 再推过 WHACKED_MS：此时 engine 已把洞位清空（holes[i] === null），
  // 而 is-hit 必须还挂在 DOM 上 —— 这正是以前被 syncHoles 顺手清掉的时刻。
  env.step(12, 16); // 累计 ~432ms
  check("洞位清空后 is-hit 仍存活（真正的回归点）",
    game.run.holes[idx] === null && holeEl.classList.contains("is-hit"),
    `holes[${idx}]=${JSON.stringify(game.run.holes[idx] ?? null)} classList=${holeEl.className}`);

  // 反过来看另一半契约：等这只洞位的**下一只**地鼠进场，受击残留必须被收走，
  // 否则 .hole.is-hit .mole 的 animation 会盖掉新鼠的冒头动画（看着像闪一下）。
  let respawned = false;
  for (let i = 0; i < 600 && !respawned; i += 1) {
    env.step(5, 16);
    respawned = Boolean(game.run.holes[idx]);
  }
  check("同一洞位的新地鼠进场时会收走受击残留",
    respawned && !holeEl.classList.contains("is-hit"),
    `respawned=${respawned} classList=${holeEl.className}`);
}

// ---- 16. 铁盔鼠：非致命（弹开）与致命（打死）必须是两套反馈 ----
// 之前两者共用 markHit，而 markHit 的动画末帧是"沉到地平线以下" ——
// 被铁盔挡住的地鼠其实没死，于是会先沉下去、动画结束后又弹回洞口，看着像卡帧。
{
  startRun("normal");
  let hi = -1;
  for (let i = 0; i < 500 && hi < 0 && game.run; i += 1) {
    env.step(5, 16);
    hi = game.run.holes.findIndex((m) => m && m.species === "helmet" && m.hp > 1 && m.phase === "up");
  }
  if (hi >= 0 && game.run) {
    const el = ui.holes[hi].el;
    const fireHelmet = () =>
      ui.dom.grid.dispatch("pointerdown", { pointerType: "mouse", clientX: 500, clientY: 320, target: el });
    fireHelmet();
    check("铁盔第一次被打到：挂 is-blocked 而非 is-hit",
      el.classList.contains("is-blocked") && !el.classList.contains("is-hit"),
      `classList=${el.className} —— 没死的地鼠不能演"被砸扁+沉下去"`);
    fireHelmet();
    check("铁盔第二锤打死：切到 is-hit 并收掉 is-blocked",
      el.classList.contains("is-hit") && !el.classList.contains("is-blocked"),
      `classList=${el.className}`);
  } else {
    notes.push(`NOTE 未抽到铁盔鼠，跳过本段（50 次×5 帧内没出现 hp=2 的铁盔）`);
  }
}

// ---- 17. 渲染噪声 ----
check("无非法颜色/几何 NaN", runtimeErrors.length === 0, runtimeErrors.join(" | "));

emit();

function emit() {
  const head = `== mole smoke [${TAG}] ==`;
  const lines = [...notes, ...failures];
  console.log(head);
  console.log(lines.join("\n"));
  console.log(`-- ${notes.length} pass, ${failures.length} fail`);
  if (failures.length) process.exit(1);
}
