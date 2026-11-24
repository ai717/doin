// Zero-dependency CDP smoke test: serves dist/, drives headless Chrome and reads window.__oracle.
// Usage: node games/oracle/tests/smoke.mjs
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, resolve, normalize } from "node:path";
import { spawn } from "node:child_process";

const ROOT = resolve(import.meta.dirname, "..", "..", "..");
const DIST = join(ROOT, "dist");
const SHOTS = join(ROOT, "x", "oracle", "shots");
const SLUG = "oracle";
const PORT = 8798;
const CDP_PORT = 9339;

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
  const profile = join(ROOT, "x", "oracle", "chrome-profile");
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
    const snapshot = async () => JSON.parse(await evaluate("JSON.stringify(window.__oracle.snapshot())"));

    const waitForApp = async () => {
      for (let i = 0; i < 80; i += 1) {
        const ready = await evaluate("document.readyState").catch(() => null);
        const has = await evaluate("Boolean(window.__oracle)").catch(() => false);
        if (ready === "complete" && has) return true;
        await wait(250);
      }
      return false;
    };

    const click = async (selector) => {
      await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
      await wait(180);
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

    await evaluate("localStorage.removeItem('doin.oracle.v1'); localStorage.setItem('doin.lang','zh'); location.reload()");
    if (!(await waitForApp())) throw new Error("重置存档后装配失败");
    await wait(600);

    let sameOrigin = [];
    for (let i = 0; i < 40; i += 1) {
      sameOrigin = await evaluate(`
        performance.getEntriesByType('resource')
          .filter((e) => e.name.startsWith(location.origin) && /\\.(mjs|css|js|webp|svg)/.test(e.name))
          .map((e) => ({ name: e.name.split('/').pop(), status: e.responseStatus ?? 0 }))
      `);
      if (sameOrigin.length >= 10) break;
      await wait(200);
    }
    const bad = sameOrigin.filter((r) => r.status && (r.status < 200 || r.status >= 300));
    check(
      "boot: 同源资源全部 2xx",
      sameOrigin.length >= 10 && bad.length === 0,
      `资源 ${sameOrigin.length} 个，异常 ${bad.map((b) => `${b.name}:${b.status}`).join(",")}`,
    );

    let state = await snapshot();
    const openPanels = await evaluate("document.querySelectorAll('.panel:not([hidden])').length");
    check(
      "开局: 首屏即第 1 关可玩盘面，无阻塞面板",
      state.status === "playing" && state.levelIndex === 0 && state.pairCount === 4 && state.matched === 0 && openPanels === 0,
      `level=${state.levelIndex} pairs=${state.pairCount} panels=${openPanels}`,
    );

    const counts = JSON.parse(await evaluate(`JSON.stringify({
      oracle: document.querySelectorAll('#oracle-grid .oracle-card').length,
      chars: document.querySelectorAll('#char-grid .char-card').length,
      board: Boolean(document.getElementById('board')),
      svg: Boolean(document.querySelector('#oracle-grid .glyph-svg'))
    })`));
    check("盘面: 四张甲骨卡、四张本字卡与 SVG 字形就绪", counts.oracle === 4 && counts.chars === 4 && counts.board && counts.svg, JSON.stringify(counts));

    const hud = JSON.parse(await evaluate(`JSON.stringify({
      chapter: document.getElementById('hud-chapter').textContent.trim(),
      level: document.getElementById('hud-level').textContent.trim(),
      pairs: document.getElementById('hud-pairs').textContent.trim(),
      errors: document.getElementById('hud-errors').textContent.trim(),
      time: document.getElementById('hud-time').textContent.trim(),
      stars: document.getElementById('hud-stars').textContent.trim(),
      brand: document.getElementById('brand-main').textContent.trim()
    })`));
    check(
      "HUD: 章节/关卡/配对/误配/用时/总星齐备",
      hud.chapter.includes("第 1 章") && hud.chapter.includes("山川日月") && hud.level === "第 1 关" && hud.pairs === "0 / 4" && hud.errors === "0" && /^\d{2}:\d{2}$/.test(hud.time) && hud.stars.includes("/ 72") && hud.brand.length > 0,
      JSON.stringify(hud),
    );

    const correct = JSON.parse(await evaluate(`(() => {
      const s = window.__oracle.snapshot();
      return JSON.stringify({ oracleIndex: 0, charIndex: s.charOrder.indexOf(s.oracleOrder[0]) });
    })()`));
    await evaluate(`document.querySelector('.oracle-card[data-index="${correct.oracleIndex}"]').click()`);
    await wait(150);
    const selected = await evaluate("document.querySelectorAll('.pair-card.is-selected').length");
    await evaluate(`document.querySelector('.char-card[data-index="${correct.charIndex}"]').click()`);
    await wait(350);
    state = await snapshot();
    const matchView = JSON.parse(await evaluate(`JSON.stringify({
      matchedCards: document.querySelectorAll('.pair-card.is-matched').length,
      lines: document.querySelectorAll('#link-layer .trace-line').length,
      evolutionOpen: !document.getElementById('evolution').hidden,
      evoSteps: document.querySelectorAll('#evolution-track .evo-step').length,
      selected: document.querySelectorAll('.pair-card.is-selected').length
    })`));
    check(
      "配对: 点甲骨再点本字，正确即点亮并拉出溯源线",
      selected === 1 && state.matched === 1 && state.errors === 0 && matchView.matchedCards === 2 && matchView.lines >= 1 && matchView.selected === 0,
      JSON.stringify({ selected, matched: state.matched, ...matchView }),
    );
    check("演变: 配对成功弹出甲骨→金文→小篆→楷书四段", matchView.evolutionOpen && matchView.evoSteps === 4, `steps=${matchView.evoSteps}`);

    await wait(300);
    const wrong = JSON.parse(await evaluate(`(() => {
      const s = window.__oracle.snapshot();
      const isMatched = (pair) => s.matches.some((m) => m.pairIndex === pair);
      let oracleIndex = -1;
      for (let i = 0; i < s.oracleOrder.length; i += 1) {
        if (!isMatched(s.oracleOrder[i])) { oracleIndex = i; break; }
      }
      const pair = s.oracleOrder[oracleIndex];
      let charIndex = -1;
      for (let i = 0; i < s.charOrder.length; i += 1) {
        if (s.charOrder[i] !== pair && !isMatched(s.charOrder[i])) { charIndex = i; break; }
      }
      return JSON.stringify({ oracleIndex, charIndex });
    })()`));
    await evaluate(`document.querySelector('.oracle-card[data-index="${wrong.oracleIndex}"]').click()`);
    await wait(150);
    await evaluate(`document.querySelector('.char-card[data-index="${wrong.charIndex}"]').click()`);
    await wait(180);
    state = await snapshot();
    const wrongCards = await evaluate("document.querySelectorAll('.pair-card.is-wrong').length");
    check(
      "容错: 误配只抖一下、记一次误配、不扣进度",
      state.errors === 1 && state.matched === 1 && state.status === "playing" && wrongCards >= 1,
      `errors=${state.errors} matched=${state.matched} wrong=${wrongCards}`,
    );
    await wait(600);

    await evaluate("window.__oracle.solveAll()");
    await wait(1100);
    state = await snapshot();
    const result = JSON.parse(await evaluate(`JSON.stringify({
      open: !document.getElementById('panel-result').hidden,
      stars: document.querySelectorAll('#result-stars .result-star:not(.dim)').length,
      rows: document.querySelectorAll('#result-rows .result-row').length,
      title: document.getElementById('result-title').textContent.trim(),
      note: document.getElementById('result-note').textContent.trim(),
      next: document.getElementById('btn-result-next').textContent.trim()
    })`));
    check(
      "结算: 整关配齐后按误配评二星并弹出结算",
      state.status === "cleared" && state.stars === 2 && result.open && result.stars === 2 && result.rows >= 4 && result.next.length > 0,
      JSON.stringify(result),
    );
    check("结算: 首次通关标记新纪录并写入存档", result.note.length > 0 && JSON.parse(await evaluate("JSON.stringify(window.__oracle.progress)")).levels[state.levelId].stars === 2, result.note);

    await click("#btn-result-next");
    await wait(350);
    state = await snapshot();
    check(
      "流转: 下一关立即就绪且资源归零",
      state.status === "playing" && state.levelIndex === 1 && state.levelInChapter === 2 && state.matched === 0 && state.errors === 0,
      `level=${state.levelIndex} chapter=${state.chapterIndex}`,
    );

    await click("#btn-levels");
    await wait(250);
    const atlas = JSON.parse(await evaluate(`JSON.stringify({
      open: !document.getElementById('panel-levels').hidden,
      chapters: document.querySelectorAll('#level-groups .chapter-block').length,
      levels: document.querySelectorAll('#level-groups .level-chip').length,
      total: document.getElementById('select-total').textContent.trim()
    })`));
    check(
      "选关: 四章二十四关字族图谱可呼出",
      atlas.open && atlas.chapters === 4 && atlas.levels === 24 && atlas.total.includes("/ 72"),
      JSON.stringify(atlas),
    );

    const frozenAt = (await snapshot()).time;
    await wait(800);
    const stillFrozen = (await snapshot()).time;
    check("计时: 呼出选关时冻结用时", stillFrozen === frozenAt, `${frozenAt} -> ${stillFrozen}`);

    await evaluate("document.querySelector('.level-chip[data-level-index=\"7\"]').click()");
    await wait(350);
    state = await snapshot();
    check(
      "选关: 点击第二章关卡立即进入",
      state.levelIndex === 7 && state.chapterIndex === 1 && state.levelInChapter === 2 && state.pairCount === 5 && state.status === "playing",
      `level=${state.levelIndex} pairs=${state.pairCount}`,
    );

    const langPair = JSON.parse(await evaluate(`(() => {
      const s = window.__oracle.snapshot();
      return JSON.stringify({ oracleIndex: 0, charIndex: s.charOrder.indexOf(s.oracleOrder[0]) });
    })()`));
    await evaluate(`document.querySelector('.oracle-card[data-index="${langPair.oracleIndex}"]').click()`);
    await wait(150);
    await evaluate(`document.querySelector('.char-card[data-index="${langPair.charIndex}"]').click()`);
    await wait(300);
    const matchedBefore = (await snapshot()).matched;

    await click("#btn-lang");
    await wait(350);
    const english = JSON.parse(await evaluate(`(() => {
      const nodes = [...document.querySelectorAll('#top-bar, #hud, #deck')].map((n) => n.innerText).join(' ');
      const lang = document.getElementById('btn-lang').textContent.trim();
      const text = nodes.split(lang).join(' ');
      return JSON.stringify({
        locale: window.__oracle.locale,
        lang: document.documentElement.lang,
        han: /[\\u4e00-\\u9fff]/.test(text),
        matched: window.__oracle.snapshot().matched,
        meaning: document.querySelector('.char-meaning').textContent.trim(),
        chapter: document.getElementById('hud-chapter').textContent.trim(),
        langText: lang
      });
    })()`));
    check(
      "双语: 原地切到英文，界面零汉字且不重置进度",
      english.locale === "en" && english.lang === "en" && english.han === false && english.matched === matchedBefore && english.langText === "中文",
      JSON.stringify({ han: english.han, matched: english.matched }),
    );
    check(
      "双语: 英文模式下本字保留、释义改为英文",
      /[\u4e00-\u9fff]/.test(english.meaning) === false && english.meaning.length > 0 && english.chapter.includes("Chapter"),
      english.meaning,
    );

    await click("#btn-lang");
    await wait(300);
    const chinese = JSON.parse(await evaluate(`JSON.stringify({
      locale: window.__oracle.locale,
      matched: window.__oracle.snapshot().matched,
      meaning: document.querySelector('.char-meaning').textContent.trim(),
      chapter: document.getElementById('hud-chapter').textContent.trim()
    })`));
    check(
      "双语: 切回中文原地生效且进度不丢",
      chinese.locale === "zh" && chinese.matched === matchedBefore && chinese.chapter.includes("第 2 章"),
      JSON.stringify(chinese),
    );

    await click("#btn-help");
    await wait(200);
    const helpFrozenAt = (await snapshot()).time;
    await wait(700);
    const helpStillFrozen = (await snapshot()).time;
    const helpOpen = await evaluate("!document.getElementById('panel-help').hidden");
    await evaluate("document.querySelector('#panel-help .close-btn').click()");
    await wait(300);
    await wait(400);
    const helpResumed = (await snapshot()).time;
    check(
      "帮助: 呼出时冻结计时，关闭后恢复",
      helpOpen && helpStillFrozen === helpFrozenAt && helpResumed > helpFrozenAt,
      `${helpFrozenAt} -> ${helpStillFrozen} -> ${helpResumed}`,
    );

    const visStart = (await snapshot()).time;
    await evaluate(`(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
      return true;
    })()`);
    await wait(250);
    const hiddenState = await snapshot();
    await wait(600);
    const hiddenLater = await snapshot();
    await evaluate(`(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
      return true;
    })()`);
    await wait(250);
    const visibleState = await snapshot();
    await wait(400);
    const visibleLater = await snapshot();
    check(
      "失焦: 切后台自动冻结计时，回来继续",
      hiddenState.paused === true && hiddenLater.time === hiddenState.time && visibleState.paused === false && visibleLater.time > visibleState.time,
      `hidden=${hiddenState.paused} visible=${visibleState.paused} time=${visStart}`,
    );

    const desktopShot = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(join(SHOTS, "desktop.png"), Buffer.from(desktopShot.data, "base64"));

    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await wait(700);
    const mobile = JSON.parse(await evaluate(`(() => {
      const paper = document.getElementById('scroll-paper').getBoundingClientRect();
      const oracle = document.querySelector('.oracle-card').getBoundingClientRect();
      const charCard = document.querySelector('.char-card').getBoundingClientRect();
      const levels = document.getElementById('btn-levels').getBoundingClientRect();
      return JSON.stringify({
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        paperW: Math.round(paper.width),
        cardW: Math.round(oracle.width),
        cardH: Math.round(oracle.height),
        stacked: charCard.top > oracle.bottom - 10,
        levelsW: Math.round(levels.width),
        levelsH: Math.round(levels.height)
      });
    })()`));
    check(
      "移动端: 双列改为上下堆叠、无横向溢出、按键够大",
      mobile.overflow <= 1 && mobile.paperW <= 390 && mobile.cardW >= 44 && mobile.cardH >= 44 && mobile.stacked === true && mobile.levelsW >= 44 && mobile.levelsH >= 32,
      JSON.stringify(mobile),
    );

    const touchMatch = JSON.parse(await evaluate(`(() => {
      const s = window.__oracle.snapshot();
      const isMatched = (pair) => s.matches.some((m) => m.pairIndex === pair);
      let oracleIndex = -1;
      for (let i = 0; i < s.oracleOrder.length; i += 1) {
        if (!isMatched(s.oracleOrder[i])) { oracleIndex = i; break; }
      }
      const charIndex = s.charOrder.indexOf(s.oracleOrder[oracleIndex]);
      return JSON.stringify({ oracleIndex, charIndex, before: s.matched });
    })()`));
    await evaluate(`document.querySelector('.oracle-card[data-index="${touchMatch.oracleIndex}"]').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 11, pointerType: 'touch', bubbles: true, cancelable: true }))`);
    await evaluate(`document.querySelector('.oracle-card[data-index="${touchMatch.oracleIndex}"]').click()`);
    await wait(150);
    await evaluate(`document.querySelector('.char-card[data-index="${touchMatch.charIndex}"]').click()`);
    await wait(300);
    const touchState = await snapshot();
    check("移动端: 触控点选仍可完成配对", touchState.matched === touchMatch.before + 1, `${touchMatch.before} -> ${touchState.matched}`);

    await wait(2400);
    const mobileShot = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(join(SHOTS, "mobile.png"), Buffer.from(mobileShot.data, "base64"));

    check("截图: 桌面与移动端均已落盘", existsSync(join(SHOTS, "desktop.png")) && existsSync(join(SHOTS, "mobile.png")));
    check("控制台: 全程零异常", errors.length === 0, errors.slice(0, 3).join(" | "));
  } finally {
    try {
      if (browser) browser.ws.close();
    } catch {
      // ignore
    }
    try {
      child.kill();
    } catch {
      // ignore
    }
    server.close();
  }

  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length} pass / ${failed.length} fail`);
  if (failed.length) {
    for (const item of failed) console.log(`FAIL  ${item.name}  <- ${item.detail}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("SMOKE ERROR", error);
  process.exitCode = 1;
});
