// workshop.test.mjs —— 扎巷坊验收：五道硬闸门 + 巷码编解码 + 编辑台笔刷/撤回。
//
// 用法（在项目根跑）：
//   node --test games/lantern-maze/tests/workshop.test.mjs
// 坑：
//   1) 手作巷与纸样必须过自己定下的前五道验收（① 连通 ② 环路 ③ 巡逻/珠距 ④ 安全间距 ⑤ 影子试跑），
//      第五道会真跑图（每局约 90ms），所以只在必要处用 runs:1~3，别在循环里跑 8 局。
//   2) 破巷用例只断言"目标那一码出现在报告里"：validateRows 是一次列出所有问题，
//      往图里塞一个孤岛光尘，同时会报"不可达"和"影匣巡逻不到"，这是同一条断链的两面。
//   3) botGate 判据是吃净率而不是通关率（贪心影子玩家收不了尾），断言别写反。

import test from "node:test";
import assert from "node:assert/strict";

import {
  parseLayout,
  BRUSHES,
  BRUSH_TILE,
  WALL,
  DOT,
  PEARL,
  SPAWN,
} from "../js/engine.mjs";
import { LAYOUTS, TEMPLATES, LEVEL_COUNT, rowsForLevel } from "../js/levels.mjs";
import { validateRows, graphStats, problemHint, LIMITS } from "../js/validate.mjs";
import {
  CODE_PREFIX,
  MAZE_W,
  MAZE_H,
  blankRows,
  rowsValid,
  normalizeRows,
  mirrorRows,
  encodeRows,
  tidyCode,
  decodeRows,
  codeLength,
} from "../js/code.mjs";
import { createBench, sheetRows, SHEETS } from "../js/bench.mjs";
import { botGate, BOT_GATE, simulate } from "../js/bot.mjs";

const ALL_SHEETS = { ...LAYOUTS, ...TEMPLATES };

/** 把纸样按坐标改字符（返回新数组，不原地改关卡表） */
function put(rows, x, y, ch) {
  const next = rows.slice();
  next[y] = next[y].slice(0, x) + ch + next[y].slice(x + 1);
  return next;
}

function codes(rows) {
  return validateRows(rows).problems.map((p) => p.code);
}

/** 一棵"没有活环"的梳状死巷：三条横廊 + 一条竖干，用来单独触发第②道 */
function treeRows() {
  const rows = blankRows();
  const carve = (x, y, ch) => {
    rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1);
  };
  for (const y of [1, 3, 5]) {
    for (let x = 1; x <= 17; x += 1) carve(x, y, DOT);
  }
  for (const y of [2, 4]) carve(1, y, DOT);
  carve(17, 5, SPAWN);
  return rows;
}

// ---------------------------------------------------------------- 第 ①~④ 道

test("手作巷与纸样全过前四道验收：自己的规矩自己先守住", () => {
  for (const [name, rows] of Object.entries(ALL_SHEETS)) {
    const r = validateRows(rows);
    assert.ok(r.ok, `${name} 未过验收：${JSON.stringify(r.problems.map((p) => `${p.code}:${p.msg}`))}`);
    assert.ok(r.stats.dots >= LIMITS.minDots, `${name} 光尘太少`);
    assert.ok(r.stats.cycles >= LIMITS.minCycles, `${name} 活环不足，玩家没有退路`);
    assert.ok(r.stats.pearls >= LIMITS.minPearls, `${name} 日曜珠少于两颗`);
    assert.ok(r.stats.houses >= 1, `${name} 没有影匣`);
    assert.equal(r.stats.wrapRows, 2, `${name} 应当有两条暗巷横穿`);
    assert.ok(r.stats.vertices > r.stats.dots, `${name} 可行走格应比光尘多（要留空地）`);
  }
});

test("三十更逐更过验收，且都在 19×21 的台面内", () => {
  for (let id = 1; id <= LEVEL_COUNT; id += 1) {
    const rows = rowsForLevel(id);
    assert.equal(rows.length, MAZE_H, `第 ${id} 更行数不对`);
    for (const r of rows) assert.equal(r.length, MAZE_W, `第 ${id} 更该行等长`);
    assert.ok(rowsValid(rows), `第 ${id} 更含未知瓦片`);
    assert.ok(validateRows(rows).ok, `第 ${id} 更未过验收`);
  }
});

test("① 孤岛光尘与缺出生点都会被当场抓住", () => {
  const base = TEMPLATES["tpl-ring"];
  assert.ok(codes(base).length === 0, "对照组：模板本身是干净的");

  const noSpawn = put(base, 9, 12, BRUSH_TILE.path);
  assert.ok(codes(noSpawn).includes("noSpawn"), "抹掉出生点必须报缺出生点");

  let pocket = null;
  outer: for (let y = 1; y < MAZE_H - 1; y += 1) {
    for (let x = 1; x < MAZE_W - 1; x += 1) {
      if (base[y][x] !== WALL) continue;
      if (base[y - 1][x] === WALL && base[y + 1][x] === WALL && base[y][x - 1] === WALL && base[y][x + 1] === WALL) {
        pocket = { x, y };
        break outer;
      }
    }
  }
  assert.ok(pocket, "模板里该能找到一处四面都是墙的夹层");
  const island = put(base, pocket.x, pocket.y, DOT);
  const caught = codes(island);
  assert.ok(caught.includes("unreachableDust"), "夹层里撒一粒光尘必须报不可达");
  assert.ok(caught.includes("patrolTooFar"), "同一处夹层也是影匣的死角，巡逻道要一起报");
  for (const p of validateRows(island).problems) {
    assert.ok(p.tiles.length === 0 || p.tiles.every((t) => t.x >= 0 && t.y >= 0), "问题瓦片要给出坐标好高亮");
  }
});

test("② 环路闸门拒收纯树状死巷", () => {
  const rows = treeRows();
  const layout = parseLayout(rows);
  const stats = graphStats(layout);
  assert.equal(stats.cycles, 0, "梳状死巷的环数必须是 0");
  assert.ok(codes(rows).includes("noRetreat"), "没有活环就没有退路，该打回");
  assert.equal(validateRows(blankRows()).stats.cycles, 0, "白纸一张也算没有环路");
});

test("③ 巡逻可达与日曜珠间距：一颗珠挪近一寸就报", () => {
  const base = TEMPLATES["tpl-ring"];
  const gap = put(put(base, 2, 1, PEARL), 3, 1, PEARL);
  const near = validateRows(gap).problems.filter((p) => p.code === "pearlUnsafe");
  assert.ok(near.length > 0, "两颗珠挨在一起必须报珠距");
  assert.ok(near.some((p) => p.msg.startsWith("pearlGap:")), "报的应是间距项");
  assert.ok(near.every((p) => p.rule === 3 || p.rule === 4));

  const seal = base.slice();
  seal[8] = WALL.repeat(MAZE_W);
  const stranded = validateRows(seal).problems.find((p) => p.code === "patrolTooFar");
  assert.ok(stranded, "把匣门那一条横巷糊死，影匣就出不去，必须报巡逻不可达");
  assert.equal(stranded.msg, "noPatrol");
});

test("④ 安全间距：出生点贴门、珠塞死角、光尘太少都要报", () => {
  const base = TEMPLATES["tpl-ring"];
  const hug = put(put(base, 9, 12, BRUSH_TILE.path), 9, 8, SPAWN);
  assert.ok(codes(hug).includes("spawnTooClose"), "出生点贴着匣门开局即死");

  const cornerPearl = put(base, 15, 17, PEARL);
  assert.ok(
    validateRows(cornerPearl).problems.some((p) => p.code === "pearlUnsafe" && p.msg === "pearlCorner"),
    "日曜珠塞进只有一条去路的小龛，惊惶时出不来"
  );

  const thin = TEMPLATES["tpl-ring"].map((r) => r.split(DOT).join(BRUSH_TILE.path));
  const thinCodes = codes(thin);
  assert.ok(thinCodes.includes("tooFewDust"), "把光尘全刮成空巷就该报太稀");
  assert.ok(!thinCodes.includes("noSpawn"), "出生点还在，不该误报缺出生点");
});

test("验收器对垃圾输入不抛错，只说不过", () => {
  for (const junk of [undefined, null, [], ["###"], ["###", "#P."], "", "#\n#\n", ["@@@", "@P@"]]) {
    const r = validateRows(junk);
    assert.equal(typeof r.ok, "boolean");
    assert.equal(r.ok, false, `${JSON.stringify(junk)} 不该被判可玩`);
    assert.ok(Array.isArray(r.problems));
  }
  const ragged = validateRows(["###################", "#P................#", "#.#"]);
  assert.ok(ragged.problems.some((p) => p.code === "shape"), "长短不齐的行要单独报形制问题");
  assert.equal(validateRows(TEMPLATES["tpl-ring"].join("\n")).ok, true, "换行串与数组两种入参等价");
});

test("问题码到文案键的映射全覆盖，界面不会显示空白", () => {
  const seen = new Set();
  for (const rows of [
    blankRows(),
    put(TEMPLATES["tpl-ring"], 9, 12, DOT),
    put(TEMPLATES["tpl-ring"], 2, 1, PEARL),
    treeRows(),
    ["###", "#P."],
  ]) {
    for (const p of validateRows(rows).problems) seen.add(p.code);
  }
  assert.ok(seen.size >= 6, `只见到 ${seen.size} 种问题码，负例造得不够`);
  const hints = new Set();
  for (const code of seen) {
    const hint = problemHint(code);
    assert.equal(typeof hint, "string");
    assert.ok(hint.length > 0, `${code} 的问题码映射出了空文案键`);
    hints.add(hint);
  }
  assert.equal(problemHint("从未听过的码"), "shape", "未知问题码回落到形制提示");
  assert.ok(hints.size >= 5);
});

// ---------------------------------------------------------------- 第 ⑤ 道

test("⑤ 影子试跑：手作巷与纸样都得让人吃得净", () => {
  for (const [name, rows] of Object.entries(ALL_SHEETS)) {
    const g = botGate({ rows, runs: 3 });
    assert.equal(g.pass, true, `${name} 未过第五道：${g.reason}（吃净率 ${g.eatRate}）`);
    assert.ok(g.eatRate >= BOT_GATE.failEatRate, `${name} 吃净率 ${g.eatRate} 低于底线`);
    assert.ok(g.eatRate <= 1 && g.worstEatRate >= 0);
    assert.equal(g.runs, 3);
    assert.ok(g.avgMs > 0);
  }
});

test("⑤ 影子试跑口径：跑不动的图判 fail，且同种子同结果", () => {
  const dead = botGate({ rows: blankRows(), runs: 1 });
  assert.equal(dead.pass, false, "白纸一张没有路可走，必须判不过");
  assert.equal(dead.reason, "unbuildable");

  const rows = TEMPLATES["tpl-ring"];
  const a = botGate({ rows, runs: 2, seed: 4242 });
  const b = botGate({ rows, runs: 2, seed: 4242 });
  assert.deepEqual(a, b, "同种子必须复现同一份体检报告");

  const loose = botGate({ rows, runs: 1, minEatRate: 1.1 });
  assert.equal(loose.pass, false, "把门槛抬到 110% 就当不过——阈值是真的在生效");
  assert.equal(loose.reason.startsWith("eatRate:"), true);
});

test("单局模拟自带账本，且不会在合法图纸上抛错", () => {
  const r = simulate({ rows: LAYOUTS.arena, seed: 77, maxMs: 20000 });
  assert.equal(r.ok, true);
  assert.ok(r.total > 0);
  assert.ok(Math.abs(r.timeMs - 20000) <= 50, `限时该被尊重，实际跑了 ${r.timeMs}ms（每帧最多多走一步）`);
  assert.ok(r.dotLeft >= 0 && r.dotLeft <= r.total);
  assert.ok(r.score >= 0);
});

// ---------------------------------------------------------------- 巷码

test("巷码：同图同码、来回一致，且短到塞得进擂台簿", () => {
  for (const [name, rows] of Object.entries(ALL_SHEETS)) {
    const code = encodeRows(rows);
    assert.ok(code.startsWith(`${CODE_PREFIX}-`), `${name} 的巷码没有前缀`);
    assert.ok(/^[A-Z0-9-]+$/.test(code), `${name} 的巷码含非法字符`);
    assert.equal(code, encodeRows(rows.map((r) => r)), `${name} 两次编码不一致`);
    assert.ok(codeLength(code) <= 4096, `${name} 巷码 ${codeLength(code)} 字，超过存档上限会被丢掉`);
    const back = decodeRows(code);
    assert.equal(back.ok, true, `${name} 的自家巷码解不开：${back.error}`);
    assert.deepEqual(back.rows, rows.map((r) => String(r)), `${name} 往返后图变了`);
  }
});

test("巷码：粘贴时的脏字符全容忍，换行与大小写都不影响", () => {
  const code = encodeRows(TEMPLATES["tpl-ring"]);
  const messy = `  ${code.toLowerCase().replace(/-/g, " _ ")}  `;
  assert.deepEqual(decodeRows(messy).rows, decodeRows(code).rows, "复制粘贴时被换行/大小写/下划线坑了");
  assert.equal(tidyCode(" lm1--a b_c "), "LM1-A-B-C");
  assert.equal(tidyCode(null), "");
  assert.equal(codeLength(`\n${code}\n`), code.length);
});

test("巷码：非法输入一律明确报错，绝不半张图载入", () => {
  const dim = (n) => n.toString(36).toUpperCase().padStart(2, "0");
  const head = `${CODE_PREFIX}-${dim(11)}${dim(11)}`;
  const bad = [
    ["XX1-0B0B-2FF", "prefix", "前缀不对"],
    ["LM1", "short", "光有前缀"],
    [`${CODE_PREFIX}-0B`, "short", "维度都没写全"],
    [`${CODE_PREFIX}-${dim(0)}${dim(11)}40A`, "dims", "宽 0"],
    [`${CODE_PREFIX}-${dim(45)}${dim(11)}40A`, "dims", "宽越界"],
    [`${head}AA`, "runs", "游程长度不是 3 的倍数"],
    [`${head}Z01`, "tile", "未知瓦片码"],
    [`${head}2FF`, "overflow", "游程总长超过画布"],
    [`${head}40A`, "length", "总长与画布不符"],
    [`${head}4${dim(121)}`, "noSpawn", "整张图没有出生点"],
  ];
  for (const [code, error, why] of bad) {
    const r = decodeRows(code);
    assert.equal(r.ok, false, `${why}：${code} 居然被判合法`);
    assert.equal(r.error, error, `${why}：报错口径不对（实际 ${r.error}）`);
    assert.equal(r.rows, undefined, "报错时不该带半张图回来");
  }
  assert.equal(decodeRows(null).ok, false);
  assert.equal(decodeRows(undefined).ok, false);
  assert.equal(decodeRows("").ok, false);

  const full = decodeRows(`${head}4${dim(60)}7${dim(1)}4${dim(60)}`);
  assert.equal(full.ok, true, "11×11 全空巷 + 一颗出生点应当被接受");
  assert.equal(full.rows.length, 11);
  assert.equal(full.rows[0], BRUSH_TILE.path.repeat(11));
  assert.equal(full.rows[5][5], SPAWN, "第 61 格落在第 5 行第 5 列（11 幅宽）");
});

test("巷码：编码只认九种瓦片，越界字符一律当墙", () => {
  const junk = blankRows().map((r, y) => (y === 5 ? `${SPAWN}?${r.slice(2)}` : r));
  assert.equal(rowsValid(junk), false, "? 不是合法瓦片");
  const clean = normalizeRows(junk);
  assert.equal(clean[5][1], WALL, "未知字符归一成墙");
  assert.equal(rowsValid(clean), true, "归一化之后必然合法");
  assert.equal(encodeRows(blankRows().slice(0, 3)), "", "行数不对编不出巷码");
  assert.equal(decodeRows(encodeRows(clean)).rows[5][1], WALL);
});

test("纸样：镜像是投影而不是翻牌，两张对称模板纹丝不动", () => {
  for (const [id, src] of Object.entries(ALL_SHEETS)) {
    const mirrored = mirrorRows(src);
    assert.ok(validateRows(mirrored).ok, `${id} 镜像之后过不了验收，一键镜像就成了破坏性按钮`);
    assert.equal(mirrored.length, src.length);
    for (const r of mirrored) assert.equal(r.length, MAZE_W, "镜像不许改变纸幅");
    for (let y = 0; y < src.length; y += 1) {
      assert.equal(mirrored[y][0], src[y][src[y].length - 1], `${id} 第 ${y} 行的左右边皮要对调`);
    }
  }
  const blank = blankRows();
  assert.deepEqual(mirrorRows(blank), blank, "白纸镜像还是白纸");
  assert.deepEqual(mirrorRows([]), []);

  const left = ["#" + SPAWN + BRUSH_TILE.path.repeat(16) + "#"];
  const once = mirrorRows(left);
  assert.equal(once[0][1], SPAWN);
  assert.equal(once[0][MAZE_W - 1 - 1], SPAWN, "左边的子要拍到右边去");
  assert.equal(once[0][MAZE_W - 1 - 5], once[0][5], "中线两侧必须互为镜像");
  assert.deepEqual(mirrorRows(once), once, "镜像再镜像等于自身：它是对折，不是倒带");
});

// ---------------------------------------------------------------- 编辑台

test("编辑台：默认起手是一张可玩的纸样，四种纸样都拿得起来", () => {
  const b = createBench();
  assert.equal(b.rows.length, MAZE_H);
  assert.deepEqual(b.size, { width: MAZE_W, height: MAZE_H });
  assert.equal(b.brush, "dot");
  assert.equal(b.mirror, true);
  assert.equal(b.canUndo, false, "刚摊开纸不该有撤回档");
  assert.equal(b.canRedo, false);
  assert.ok(b.check().ok);

  for (const sheet of SHEETS) {
    const s = createBench({ rows: sheetRows(sheet.id) });
    assert.equal(s.rows.length, MAZE_H, `${sheet.id} 纸样尺寸不对`);
    if (sheet.id !== "blank") assert.ok(s.check().ok, `${sheet.id} 起手就过不了验收`);
  }
  assert.deepEqual(sheetRows("blank"), blankRows());
  assert.equal(sheetRows("并不存在的纸样").length, MAZE_H, "未知纸样回落到白纸");
  assert.equal(createBench({ rows: sheetRows("blank") }).check().ok, false, "白纸当然不可玩");
});

test("编辑台：笔刷只认清单里的九道，落笔按瓦片改字符", () => {
  const b = createBench({ mirror: false });
  assert.equal(BRUSHES.length, 9);
  for (const brush of BRUSHES) assert.equal(b.setBrush(brush), true, `${brush} 笔刷选不上`);
  assert.equal(b.setBrush("橡皮擦"), false, "未知笔刷要静默拒绝");
  assert.equal(b.setBrush(null), false);
  assert.equal(b.brush, BRUSHES[BRUSHES.length - 1], "最后一次成功设置才是当前笔刷");

  b.setBrush("wall");
  const before = b.rows.slice();
  assert.equal(b.paint(0, 0), false, "那一格本来就是墙，不该记一档");
  assert.deepEqual(b.rows, before);
  assert.equal(b.canUndo, false);

  b.setBrush("path");
  assert.equal(b.paint(1, 3), true, "把墙改成空巷应当入档");
  assert.equal(b.rows[3][1], BRUSH_TILE.path);
  assert.equal(b.toggleMirror(false), false);
  assert.equal(b.toggleMirror(), true, "不带参数就是取反");
  assert.equal(b.toggleGrid(false), false);
  assert.equal(b.toggleGrid(), true);
});

test("编辑台：一次拖动只算一笔，撤回重做各自成栈", () => {
  const b = createBench({ mirror: false });
  const origin = b.rows.slice();
  b.setBrush("pearl");
  b.beginStroke();
  for (let x = 1; x <= 6; x += 1) b.strokeTo(x, 19);
  assert.equal(b.endStroke(), true);
  assert.equal(b.canUndo, true);
  for (let x = 1; x <= 6; x += 1) assert.equal(b.rows[19][x], PEARL, "拖动过的每一格都要落子");

  assert.equal(b.undo(), true);
  assert.deepEqual(b.rows, origin, "一整笔要一次回退干净");
  assert.equal(b.canUndo, false, "只有那一笔的档，回完就到底了");
  assert.equal(b.canRedo, true);
  assert.equal(b.redo(), true);
  assert.equal(b.rows[19][5], PEARL, "重做要把整笔再画回来");
  assert.equal(b.redo(), false, "到底了就没了");
  assert.equal(b.undo(), true);
  assert.deepEqual(b.rows, origin);

  assert.equal(b.undo(), false, "空栈撤回返回 false 而不是抛错");
});

test("编辑台：对称笔刷同步落子，出生点全图唯一", () => {
  const b = createBench({ mirror: true });
  b.setBrush("pearl");
  b.paint(2, 5);
  assert.equal(b.rows[5][2], PEARL);
  assert.equal(b.rows[5][MAZE_W - 1 - 2], PEARL, "开了对称就该两边同时落子");

  b.setBrush("spawn");
  b.paint(4, 12);
  let n = 0;
  for (const r of b.rows) n += (r.match(/P/g) ?? []).length;
  assert.equal(n, 1, "落第二个出生点要把前一个抹成空巷");
  assert.equal(b.rows[12][4], SPAWN);

  b.paint(10, 12);
  n = 0;
  for (const r of b.rows) n += (r.match(/P/g) ?? []).length;
  assert.equal(n, 1, "出生点永远只有一个，否则引擎不知道该把玩家放哪");
});

test("编辑台：撤回栈只留 40 档，载入相同图不入档", () => {
  const b = createBench({ mirror: false });
  b.setBrush("path");
  let painted = 0;
  for (let y = 1; y < MAZE_H - 1; y += 1) {
    for (let x = 1; x < MAZE_W - 1; x += 1) {
      if (b.paint(x, y)) painted += 1;
    }
  }
  assert.ok(painted > 45, "样本太小，撤回栈上限这条测不到");
  const snapshot = b.rows.slice();

  let steps = 0;
  while (b.undo()) steps += 1;
  assert.equal(steps, 40, "超出 40 档的老历史应当丢掉");
  assert.notDeepEqual(b.rows, snapshot, "回退 40 笔不可能一步回到起手");
  for (let i = 0; i < steps; i += 1) assert.equal(b.redo(), true);
  assert.deepEqual(b.rows, snapshot, "撤到底再重做到底，要回到同一张图");
  assert.equal(b.redo(), false, "重做栈也到底了");
  assert.equal(b.undo(), true, "重做之后仍可再撤");

  const c = createBench({ rows: TEMPLATES["tpl-ring"], mirror: false });
  const same = c.rows.slice();
  assert.deepEqual(c.loadRows(same), same, "载入一模一样的图不该入档");
  assert.equal(c.canUndo, false);
  const cleared = c.clearSheet();
  assert.ok(cleared.every((r) => r === WALL.repeat(MAZE_W)), "清空后应当整张是墙");
  assert.equal(c.canUndo, true, "清空是动了图，必须可撤");
  assert.equal(c.undo(), true);
  assert.deepEqual(c.rows, same, "撤销清空要原样拿回整张巷子");
  assert.ok(c.code().startsWith(CODE_PREFIX), "白纸也编得出巷码");
});

test("编辑台：验收与体检各走各的口径，巷码能载回同一张图", () => {
  const b = createBench({ rows: TEMPLATES["tpl-lanes"] });
  const cheap = b.check();
  assert.ok(cheap.ok);
  assert.equal(cheap.stats.cycles, validateRows(TEMPLATES["tpl-lanes"]).stats.cycles, "实时验收与提交验收必须是同一份判定");

  const probe = b.probe(1);
  assert.equal(probe.runs, 1);
  assert.equal(probe.pass, true, probe.reason);

  const code = b.code();
  const other = createBench({ rows: blankRows() });
  const back = decodeRows(code);
  assert.equal(back.ok, true);
  other.loadRows(back.rows);
  assert.deepEqual(other.rows, b.rows, "巷码来回一趟必须是同一张巷子");
  assert.equal(other.code(), code, "载入之后重新编码必须一模一样");

  b.setBrush("wall");
  b.paint(1, 5);
  assert.notEqual(b.code(), code, "改了一格，巷码就该跟着变");
});
