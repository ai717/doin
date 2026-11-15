// tests/smoke.mjs — 零依赖 CDP 真浏览器冒烟：起静态服务指向 dist/，无头 Chrome 走生产路径。
// 断言只读 window.__idiom 暴露的真值，不复刻玩法逻辑。
// 用法：node games/idiom/tests/smoke.mjs
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, resolve, normalize } from "node:path";
import { spawn } from "node:child_process";

const ROOT = resolve(import.meta.dirname, "..", "..", "..");
const DIST = join(ROOT, "dist");
const SHOTS = join(ROOT, "x", "idiom", "shots");
const SLUG = "idiom";
const PORT = 8795;
const CDP_PORT = 9336;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  <- ${detail}` : ""}`);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function findChrome() {
  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  ];
  for (const path of candidates) if (existsSync(path)) return path;
  throw new Error("找不到 Chrome / Edge");
}

function startServer() {
  const server = createServer(async (req, res) => {
    try {
      let path = decodeURIComponent((req.url ?? "/").split("?")[0]);
      if (path.endsWith("/")) path += "index.html";
      const file = join(DIST, normalize(path).replace(/^([/\\])+/, ""));
      if (!file.startsWith(DIST)) {
        res.writeHead(403).end("forbidden");
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
      res.end(body);
    } catch (error) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end(`404 ${error.message}`);
    }
  });
  return new Promise((r) => server.listen(PORT, "127.0.0.1", () => r(server)));
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = [];
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.message} (${JSON.stringify(msg.error.data ?? "")})`));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const listener of this.listeners) listener(msg);
      }
    });
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => {
      ws.addEventListener("open", res, { once: true });
      ws.addEventListener("error", () => rej(new Error(`CDP 连接失败: ${url}`)), { once: true });
    });
    return new Cdp(ws);
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  on(fn) {
    this.listeners.push(fn);
  }
}

async function main() {
  await mkdir(SHOTS, { recursive: true });
  const server = await startServer();
  const chromePath = await findChrome();
  const profile = join(ROOT, "x", "idiom", "chrome-profile");
  const child = spawn(
    chromePath,
    [
      "--headless=new",
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--hide-scrollbars",
      "--window-size=1440,900",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  const errors = [];
  let browser = null;
  try {
    let version = null;
    for (let i = 0; i < 60; i += 1) {
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
        version = await res.json();
        break;
      } catch {
        await wait(250);
      }
    }
    if (!version) throw new Error("无头浏览器未就绪");
    browser = await Cdp.connect(version.webSocketDebuggerUrl);

    const { targetId } = await browser.send("Target.createTarget", { url: `http://127.0.0.1:${PORT}/${SLUG}/` });
    const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true });
    const send = (method, params) => browser.send(method, params, sessionId);

    browser.on((msg) => {
      if (msg.method === "Runtime.exceptionThrown") {
        errors.push(msg.params.exceptionDetails?.exception?.description ?? "exception");
      }
      if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
        errors.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
      }
    });
    await send("Runtime.enable");
    await send("Page.enable");
    await send("Network.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

    const evaluate = async (expression) => {
      const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? "evaluate failed");
      return res.result.value;
    };

    const waitForApp = async () => {
      for (let i = 0; i < 80; i += 1) {
        const ready = await evaluate("document.readyState").catch(() => null);
        const has = await evaluate("Boolean(window.__idiom)").catch(() => false);
        if (ready === "complete" && has) return true;
        await wait(250);
      }
      return false;
    };

    const booted = await waitForApp();
    if (!booted) {
      const dump = await evaluate(
        "JSON.stringify({ready:document.readyState, title:document.title, html:document.documentElement.outerHTML.slice(0,500), scripts:[...document.scripts].map(s=>s.src)})",
      ).catch((e) => `dump failed: ${e.message}`);
      check("boot: 页面与模块装配完成", false, String(dump));
      throw new Error("装配超时");
    }
    check("boot: 页面与模块装配完成", true);

    await evaluate("localStorage.removeItem('doin.idiom.v1'); localStorage.setItem('doin.lang','zh'); location.reload()");
    if (!(await waitForApp())) throw new Error("重置存档后装配失败");
    await wait(500);

    let sameOrigin = [];
    for (let i = 0; i < 40; i += 1) {
      sameOrigin = await evaluate(`
        performance.getEntriesByType('resource')
          .filter((e) => e.name.startsWith(location.origin) && /\\.(mjs|css|js|webp|svg)/.test(e.name))
          .map((e) => ({ name: e.name.split('/').pop(), status: e.responseStatus ?? 0 }))
      `);
      if (sameOrigin.length >= 8) break;
      await wait(200);
    }
    const bad = sameOrigin.filter((r) => r.status && (r.status < 200 || r.status >= 300));
    check(
      "boot: 同源资源全部 2xx",
      sameOrigin.length >= 8 && bad.length === 0,
      `资源 ${sameOrigin.length} 个，异常 ${bad.map((b) => `${b.name}:${b.status}`).join(",")}`,
    );

    let snap = await evaluate("JSON.stringify(window.__idiom.snapshot())");
    let state = JSON.parse(snap);
    check(
      "开局: 首屏即一局可玩的中文纵横格",
      state.lang === "zh" && state.status === "playing" && state.entries >= 4 && state.rows >= 5 && state.cols >= 5 && state.panel === null,
      `lang=${state.lang} entries=${state.entries} grid=${state.rows}x${state.cols}`,
    );

    const dom = await evaluate(`JSON.stringify({
      cells: document.querySelectorAll('#grid .cell:not(.void)').length,
      clues: document.querySelectorAll('#clue-list .clue').length,
      tiles: document.querySelectorAll('#rack .tile').length,
      hud: document.getElementById('hud-board').textContent.trim(),
      time: document.getElementById('hud-time').textContent.trim(),
      book: getComputedStyle(document.getElementById('book')).display,
      transform: getComputedStyle(document.getElementById('book')).transform,
      aria: document.getElementById('grid').getAttribute('aria-label')
    })`);
    const domState = JSON.parse(dom);
    check(
      "渲染: 网格/释义/字库与状态严格对齐",
      domState.cells === state.totalCells && domState.clues === state.entries && domState.tiles === state.rack.length,
      `cells=${domState.cells}/${state.totalCells} clues=${domState.clues}/${state.entries} tiles=${domState.tiles}/${state.rack.length}`,
    );
    check(
      "渲染: 书页与顶部信息可见，网格有可读标签",
      domState.book !== "none" && domState.transform !== "none" && domState.hud.length > 0 && domState.time.length > 0 && Boolean(domState.aria),
      `book=${domState.book} hud=${domState.hud}`,
    );

    // 真实鼠标点第一个字格
    const cellRect = await evaluate(`(() => {
      const cell = document.querySelector('#grid .cell:not(.void)');
      const rect = cell.getBoundingClientRect();
      return JSON.stringify({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    })()`);
    const point = JSON.parse(cellRect);
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
    await wait(150);
    state = JSON.parse(await evaluate("JSON.stringify(window.__idiom.snapshot())"));
    const answerMap = new Map(state.cells.map((cell) => [`${cell.r},${cell.c}`, cell.answer]));
    const selectedKey = state.selected?.cellKey ?? null;
    check("交互: 鼠标点格真的选中词条", Boolean(selectedKey), `selected=${selectedKey}`);

    // 点正确的字库字 → 填字成功
    const answer = selectedKey ? answerMap.get(selectedKey) : null;
    const filledBefore = state.filledCells;
    await evaluate(`(() => {
      const tile = [...document.querySelectorAll('#rack .tile')].find((node) => node.textContent === ${JSON.stringify(answer)});
      if (tile) tile.click();
    })()`);
    await wait(200);
    state = JSON.parse(await evaluate("JSON.stringify(window.__idiom.snapshot())"));
    check(
      "交互: 点字库正确字后落字并推进进度",
      state.filledCells === filledBefore + 1 && state.selected?.cellKey !== selectedKey,
      `filled ${filledBefore} -> ${state.filledCells}`,
    );

    // 点错字 → 抖动提示，擦除键可清除
    const wrongChar = state.rack.find((char) => char !== (selectedKey ? answerMap.get(state.selected.cellKey) : ""));
    await evaluate(`(() => {
      const tile = [...document.querySelectorAll('#rack .tile')].find((node) => node.textContent === ${JSON.stringify(wrongChar)});
      if (tile) tile.click();
    })()`);
    await wait(120);
    const wrongShown = await evaluate("Boolean(document.querySelector('#grid .cell.is-wrong'))");
    check("交互: 填错字出现抖动反馈", wrongShown === true);
    await evaluate("document.getElementById('btn-erase').click()");
    await wait(150);
    state = JSON.parse(await evaluate("JSON.stringify(window.__idiom.snapshot())"));
    check("交互: 擦除键清掉错字", state.filledCells === filledBefore + 1, `filled=${state.filledCells}`);

    // 提示
    const hintsBefore = state.hintsLeft;
    await evaluate("document.getElementById('btn-hint').click()");
    await wait(200);
    state = JSON.parse(await evaluate("JSON.stringify(window.__idiom.snapshot())"));
    check(
      "交互: 提示消耗次数并揭开一字",
      state.hintsLeft === hintsBefore - 1 && state.filledCells === filledBefore + 2,
      `hints ${hintsBefore} -> ${state.hintsLeft}, filled=${state.filledCells}`,
    );

    // 完词 → 图鉴解锁
    const solved = await evaluate(`(() => {
      const snap = window.__idiom.snapshot();
      const entry = snap.entriesDetail[0];
      const cells = snap.cells;
      for (let i = 0; i < entry.len; i += 1) {
        const r = entry.row + (entry.dir === 'down' ? i : 0);
        const c = entry.col + (entry.dir === 'across' ? i : 0);
        window.__idiom.dispatch({ type: 'cell', r, c });
        window.__idiom.dispatch({ type: 'fill', char: cells.find((cell) => cell.r === r && cell.c === c).answer });
      }
      return window.__idiom.snapshot().solvedEntries;
    })()`);
    await wait(250);
    check("规则: 完成一条词条即计入已解", solved >= 1, `solved=${solved}`);

    // 语言热切换：不刷新、切到英文题库、切回保留中文进度
    const zhFilled = JSON.parse(await evaluate("JSON.stringify(window.__idiom.snapshot())")).filledCells;
    await evaluate("document.getElementById('btn-lang').click()");
    await wait(400);
    const enState = JSON.parse(await evaluate("JSON.stringify(window.__idiom.snapshot())"));
    const enText = await evaluate(`(() => {
      const btn = document.getElementById('btn-lang');
      const prev = btn ? btn.textContent : '';
      if (btn) btn.textContent = '';
      const text = document.body.innerText;
      if (btn) btn.textContent = prev;
      return text;
    })()`);
    check(
      "i18n: 一键切到英文 Word Crossword 且无残留汉字",
      enState.lang === "en" &&
        enState.entries >= 4 &&
        enState.entriesDetail.every((entry) => /^[A-Z]+$/.test(entry.answer)) &&
        !/[\u4e00-\u9fa5]/.test(enText),
      `lang=${enState.lang} entries=${enState.entries} answers=${enState.entriesDetail.map((entry) => entry.answer).join("/")} residue=${(enText.match(/[\u4e00-\u9fa5]+/g) || []).join(",")}`,
    );
    await evaluate("document.getElementById('btn-lang').click()");
    await wait(400);
    const backState = JSON.parse(await evaluate("JSON.stringify(window.__idiom.snapshot())"));
    check(
      "i18n: 切回中文后原局面原样恢复，未重置",
      backState.lang === "zh" && backState.filledCells === zhFilled && backState.entries === state.entries,
      `filled ${zhFilled} -> ${backState.filledCells}`,
    );

    // 榜单面板
    await evaluate("document.getElementById('btn-boards').click()");
    await wait(300);
    const boards = await evaluate(`JSON.stringify({
      open: !document.getElementById('panel-boards').hidden,
      cards: document.querySelectorAll('#board-cards .board-card').length,
      chips: document.querySelectorAll('#board-cards .level-chip').length,
      names: [...document.querySelectorAll('#board-cards .board-name')].map((n) => n.textContent.trim()).slice(0, 2)
    })`);
    const boardState = JSON.parse(boards);
    check(
      "榜单: 八榜八十关全部可点",
      boardState.open && boardState.cards === 8 && boardState.chips === 80,
      `cards=${boardState.cards} chips=${boardState.chips}`,
    );
    check("榜单: 主题名已本地化", boardState.names.length === 2 && boardState.names.every((name) => name.length > 0), boardState.names.join("/"));

    // 直接跳到第 4 关
    await evaluate(`(() => {
      const card = document.querySelector('#board-cards .board-card');
      const chips = card.querySelectorAll('.level-chip');
      chips[3].click();
    })()`);
    await wait(500);
    state = JSON.parse(await evaluate("JSON.stringify(window.__idiom.snapshot())"));
    check("榜单: 点关即换局并收起面板", state.levelIndex === 3 && state.panel === null && state.entries >= 4, `level=${state.levelIndex}`);

    // 图鉴
    await evaluate("document.getElementById('btn-atlas').click()");
    await wait(300);
    const atlas = await evaluate(`JSON.stringify({
      open: !document.getElementById('panel-atlas').hidden,
      tabs: document.querySelectorAll('#atlas-tabs .atlas-tab').length,
      cards: document.querySelectorAll('#atlas-grid .atlas-card').length,
      unlocked: document.querySelectorAll('#atlas-grid .atlas-card:not(.is-locked)').length,
      progress: document.getElementById('atlas-progress').textContent.trim()
    })`);
    const atlasState = JSON.parse(atlas);
    check(
      "图鉴: 八榜分页与 16 张卡就绪",
      atlasState.open && atlasState.tabs === 8 && atlasState.cards === 16,
      `tabs=${atlasState.tabs} cards=${atlasState.cards} unlocked=${atlasState.unlocked}`,
    );
    check("图鉴: 已解词条自动解锁卡片", atlasState.unlocked >= 1 && atlasState.progress.length > 0, atlasState.progress);

    const opened = await evaluate(`(() => {
      const card = document.querySelector('#atlas-grid .atlas-card:not(.is-locked)');
      if (!card) return null;
      card.click();
      return !document.getElementById('panel-card').hidden;
    })()`);
    await wait(250);
    const cardInfo = await evaluate(`JSON.stringify({
      open: !document.getElementById('panel-card').hidden,
      word: document.getElementById('card-word').textContent.trim(),
      fields: document.querySelectorAll('#card-body .card-field').length
    })`);
    const cardState = JSON.parse(cardInfo);
    check("图鉴: 点卡翻开典故（出处/故事/例句）", opened === true && cardState.open && cardState.fields >= 2 && cardState.word.length > 1, cardState.word);
    await evaluate("document.querySelector('#panel-card [data-close]').click()");
    await wait(250);
    const backToAtlas = await evaluate("!document.getElementById('panel-atlas').hidden");
    check("图鉴: 关闭卡片回到图鉴页", backToAtlas === true);
    await evaluate("document.querySelector('#panel-atlas [data-close]').click()");
    await wait(200);

    // 计时冻结
    const t1 = JSON.parse(await evaluate("JSON.stringify(window.__idiom.snapshot())")).elapsed;
    await evaluate("document.getElementById('btn-boards').click()");
    await wait(900);
    const t2 = JSON.parse(await evaluate("JSON.stringify(window.__idiom.snapshot())")).elapsed;
    await evaluate("document.querySelector('#panel-boards [data-close]').click()");
    await wait(900);
    const t3 = JSON.parse(await evaluate("JSON.stringify(window.__idiom.snapshot())")).elapsed;
    check("计时: 翻榜单时冻结，收起后继续", t2 - t1 <= 250 && t3 > t2, `${t1} -> ${t2} -> ${t3}`);

    // 通关结算
    await evaluate("window.__idiom.solveLevel()");
    await wait(1300);
    const result = await evaluate(`JSON.stringify({
      status: window.__idiom.snapshot().status,
      panel: window.__idiom.snapshot().panel,
      lit: document.querySelectorAll('#result-stars .star:not(.dim)').length,
      rows: document.querySelectorAll('#result-rows .result-row').length
    })`);
    const resultState = JSON.parse(result);
    check(
      "结算: 整关填对后弹出结算与星级",
      resultState.status === "cleared" && resultState.panel === "panel-result" && resultState.lit >= 1 && resultState.rows >= 3,
      JSON.stringify(resultState),
    );

    await evaluate("document.getElementById('btn-next').click()");
    await wait(600);
    state = JSON.parse(await evaluate("JSON.stringify(window.__idiom.snapshot())"));
    check("结算: 下一关可继续且面板收起", state.levelIndex === 4 && state.panel === null && state.status === "playing", `level=${state.levelIndex}`);

    const desktop = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(join(SHOTS, "desktop.png"), Buffer.from(desktop.data, "base64"));

    // 移动端
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await wait(700);
    const mobile = await evaluate(`JSON.stringify({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      rackBottom: document.getElementById('rack-shell').getBoundingClientRect().bottom,
      deckTop: document.getElementById('rack-shell').getBoundingClientRect().top,
      eraseVisible: document.getElementById('btn-erase').getBoundingClientRect().width > 0,
      tiles: document.querySelectorAll('#rack .tile').length,
      gridWidth: document.getElementById('grid').getBoundingClientRect().width,
      viewport: window.innerWidth,
      viewportH: window.innerHeight
    })`);
    const mobileState = JSON.parse(mobile);
    check(
      "移动端: 无横向溢出，字库与擦除键在视口内",
      mobileState.overflow <= 1 && mobileState.rackBottom <= mobileState.viewportH + 1 && mobileState.eraseVisible && mobileState.tiles > 0,
      `overflow=${mobileState.overflow} rackBottom=${Math.round(mobileState.rackBottom)}/${mobileState.viewportH}`,
    );
    check("移动端: 网格按屏宽收缩", mobileState.gridWidth <= mobileState.viewport - 8, `grid=${Math.round(mobileState.gridWidth)} viewport=${mobileState.viewport}`);

    const mobileShot = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(join(SHOTS, "mobile.png"), Buffer.from(mobileShot.data, "base64"));

    check("console: 无异常与报错", errors.length === 0, errors.slice(0, 2).join(" | "));
  } finally {
    try {
      browser?.ws.close();
    } catch {
      // ignore
    }
    child.kill();
    server.close();
  }

  const failed = results.filter((result) => !result.ok);
  console.log(`\n== smoke: ${SLUG} == ${results.length - failed.length} pass, ${failed.length} fail`);
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
