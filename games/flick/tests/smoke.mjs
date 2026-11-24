// Zero-dependency CDP smoke test for Flick Duel.
// Serves dist/, drives headless Chrome and inspects window.__flick.
// Usage: node games/flick/tests/smoke.mjs

import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, resolve, normalize } from "node:path";
import { spawn } from "node:child_process";

const ROOT = resolve(import.meta.dirname, "..", "..", "..");
const DIST = join(ROOT, "dist");
const SHOTS = join(ROOT, "x", "flick", "shots");
const SLUG = "flick";
const PORT = 8799;
const CDP_PORT = 9340;

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

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
      res.writeHead(200, {
        "content-type": MIME[extname(file)] ?? "application/octet-stream",
        "cache-control": "no-store",
      });
      res.end(body);
    } catch (error) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end(`404 ${error.message}`);
    }
  });
  return new Promise((resolve) => server.listen(PORT, "127.0.0.1", () => resolve(server)));
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
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", () => reject(new Error(`CDP 连接失败: ${url}`)), { once: true });
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
  const profile = join(ROOT, "x", "flick", "chrome-profile");
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
        errors.push(msg.params.args.map((arg) => arg.value ?? arg.description).join(" "));
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
    const snapshot = async () => JSON.parse(await evaluate("JSON.stringify(window.__flick.snapshot())"));

    const waitForApp = async () => {
      for (let i = 0; i < 80; i += 1) {
        const ready = await evaluate("document.readyState").catch(() => null);
        const has = await evaluate("Boolean(window.__flick)").catch(() => false);
        if (ready === "complete" && has) return true;
        await wait(250);
      }
      return false;
    };

    const click = async (selector) => {
      await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
      await wait(200);
    };

    const booted = await waitForApp();
    if (!booted) {
      const dump = await evaluate(
        "JSON.stringify({ready:document.readyState,title:document.title,html:document.documentElement.outerHTML.slice(0,500),scripts:[...document.scripts].map(s=>s.src)})",
      ).catch((error) => `dump failed: ${error.message}`);
      check("boot: 页面与模块装配完成", false, String(dump));
      throw new Error("装配超时");
    }
    check("boot: 页面与模块装配完成", true);

    await evaluate("localStorage.removeItem('doin.flick.v1'); localStorage.setItem('doin.lang','zh'); location.reload()");
    if (!(await waitForApp())) throw new Error("重置存档后装配失败");
    await wait(700);
    await evaluate("window.__bootTag = 'stay'");

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
    const bad = sameOrigin.filter((entry) => entry.status && (entry.status < 200 || entry.status >= 300));
    check(
      "boot: 同源资源全部 2xx",
      sameOrigin.length >= 10 && bad.length === 0,
      `资源 ${sameOrigin.length} 个，异常 ${bad.map((entry) => `${entry.name}:${entry.status}`).join(",")}`,
    );

    let state = await snapshot();
    const openPanels = await evaluate("document.querySelectorAll('.panel:not([hidden])').length");
    check(
      "开局: 首屏即就绪桌面，无阻塞面板",
      state.status === "playing" && state.mode === "solo" && state.humanSide === "south" && state.round === 0
        && state.counts.south === 5 && state.counts.north === 5 && state.phase === "aim" && openPanels === 0,
      `mode=${state.mode} round=${state.round} counts=${state.counts.south}/${state.counts.north} panels=${openPanels}`,
    );

    const view = JSON.parse(await evaluate(`JSON.stringify({
      canvas: Boolean(document.getElementById('table-canvas')),
      canvasW: Math.round(document.getElementById('table-canvas').getBoundingClientRect().width),
      canvasH: Math.round(document.getElementById('table-canvas').getBoundingClientRect().height),
      hud: ['hud-turn','hud-south','hud-north','hud-round','hud-time'].map((id) => document.getElementById(id).textContent.trim()),
      modeBtn: document.getElementById('btn-mode').textContent.trim(),
      pauseBtn: document.getElementById('btn-pause').textContent.trim(),
      panels: document.querySelectorAll('.panel').length
    })`));
    check(
      "桌面: 画布、HUD 与常驻模式/暂停按钮齐备",
      view.canvas && view.canvasW > 500 && view.canvasH > 300 && view.hud.length === 5
        && /^\d+ \/ 60$/.test(view.hud[3]) && /^\d{2}:\d{2}$/.test(view.hud[4])
        && view.modeBtn.length > 0 && view.pauseBtn.length > 0 && view.panels === 3,
      JSON.stringify(view),
    );

    // Real pointer drag: pull the centre puck straight back and release.
    const drag = JSON.parse(await evaluate(`(() => {
      const s = window.__flick.snapshot();
      const puck = s.pucks.find((item) => item.id === 2);
      const canvas = document.getElementById('table-canvas');
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + (puck.x / 960) * rect.width;
      const cy = rect.top + (puck.y / 620) * rect.height;
      const pull = (36 / 620) * rect.height;
      const options = (x, y, buttons) => ({ pointerId: 21, pointerType: 'mouse', bubbles: true, cancelable: true, clientX: x, clientY: y, buttons });
      canvas.dispatchEvent(new PointerEvent('pointerdown', options(cx, cy, 1)));
      canvas.dispatchEvent(new PointerEvent('pointermove', options(cx, cy + pull, 1)));
      canvas.dispatchEvent(new PointerEvent('pointerup', options(cx, cy + pull, 0)));
      return JSON.stringify({ before: s.counts, round: s.round });
    })()`));
    await evaluate("window.__flick.advance(6)");
    await wait(250);
    state = await snapshot();
    check(
      "操作: 拖拽蓄力松手完成一次真实弹射并交出回合",
      state.round === drag.round + 1 && state.turn === "north" && state.phase === "aim" && state.status === "playing",
      `round=${state.round} turn=${state.turn} phase=${state.phase}`,
    );
    const crossed = state.pucks.find((item) => item.id === 2);
    check(
      "过线: 正对孔门的棋子进入对方半场并计入负担",
      crossed && crossed.side === "north" && state.counts.south === 4 && state.counts.north === 6,
      `side=${crossed?.side} counts=${state.counts.south}/${state.counts.north}`,
    );

    await click("#btn-pause");
    const paused = await snapshot();
    const pausedVeil = await evaluate("!document.getElementById('pause-veil').hidden");
    const pausedAt = paused.time;
    await wait(650);
    const pausedLater = await snapshot();
    check(
      "暂停: 按钮冻结物理与计时并显示遮罩",
      paused.paused === true && pausedVeil === true && pausedLater.time === pausedAt,
      `paused=${paused.paused} veil=${pausedVeil} time=${pausedAt}->${pausedLater.time}`,
    );
    await click("#btn-pause");
    const resumed = await snapshot();
    check("暂停: 再次点击继续对局", resumed.paused === false, `paused=${resumed.paused}`);

    await evaluate("window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP', key: 'p', bubbles: true, cancelable: true }))");
    await wait(120);
    const keyPaused = await snapshot();
    await evaluate("window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP', key: 'p', bubbles: true, cancelable: true }))");
    await wait(120);
    const keyResumed = await snapshot();
    check("暂停: P 键即时切换暂停与继续", keyPaused.paused === true && keyResumed.paused === false, `${keyPaused.paused} -> ${keyResumed.paused}`);

    const aiStartRound = keyResumed.round;
    let aiState = keyResumed;
    for (let i = 0; i < 36; i += 1) {
      await wait(250);
      aiState = await snapshot();
      if (aiState.status !== "playing") break;
      if (aiState.round > aiStartRound && aiState.phase === "aim") break;
    }
    check(
      "AI: 单人模式下对手自动弹射并把回合交回",
      aiState.status === "ended" || (aiState.round > aiStartRound && aiState.phase === "aim" && aiState.turn === "south"),
      `round=${aiStartRound}->${aiState.round} turn=${aiState.turn} phase=${aiState.phase}`,
    );

    await click("#btn-mode");
    const modeOpen = await evaluate("!document.getElementById('panel-mode').hidden");
    await click("#mode-group [data-value=duel]");
    const diffHidden = await evaluate("document.getElementById('diff-row').hidden");
    await click("#board-group [data-value=board_3gate]");
    await click("#btn-start-match");
    await wait(250);
    state = await snapshot();
    const saved = JSON.parse(await evaluate("localStorage.getItem('doin.flick.v1')"));
    check(
      "模式: 同屏双人 + 三孔盘立即开局且存档记住设置",
      modeOpen && diffHidden && state.mode === "duel" && state.boardId === "board_3gate"
        && state.gates.length === 3 && state.round === 0 && state.counts.south === 5
        && saved.settings.mode === "duel" && saved.settings.boardId === "board_3gate",
      `mode=${state.mode} board=${state.boardId} gates=${state.gates.length}`,
    );

    const turnIds = JSON.parse(await evaluate(`(() => {
      const s = window.__flick.snapshot();
      return JSON.stringify({
        south: s.pucks.find((item) => item.side === 'south').id,
        north: s.pucks.find((item) => item.side === 'north').id
      });
    })()`));
    await evaluate(`window.__flick.aimAt(${turnIds.south}, 1, 0.22)`);
    await evaluate("window.__flick.advance(6)");
    const afterSouth = await snapshot();
    await evaluate(`window.__flick.aimAt(${turnIds.north}, 0, 0.22)`);
    await evaluate("window.__flick.advance(6)");
    const afterNorth = await snapshot();
    check(
      "双人: 上下半场轮流弹射，回合交替",
      afterSouth.turn === "north" && afterNorth.turn === "south" && afterNorth.round === 2,
      `turn=${afterSouth.turn}->${afterNorth.turn} round=${afterNorth.round}`,
    );

    const roundBefore = afterNorth.round;
    const countsBefore = `${afterNorth.counts.south}/${afterNorth.counts.north}`;
    await click("#btn-lang");
    await wait(300);
    const english = JSON.parse(await evaluate(`(() => {
      const nodes = [...document.querySelectorAll('#top-bar, #hud, #deck')].map((node) => node.innerText).join(' ');
      const panels = [...document.querySelectorAll('.panel')].map((node) => node.textContent).join(' ');
      const lang = document.getElementById('btn-lang').textContent.trim();
      const strip = (text) => text.split(lang).join(' ');
      return JSON.stringify({
        locale: window.__flick.locale,
        lang: document.documentElement.lang,
        han: /[\\u4e00-\\u9fff]/.test(strip(nodes + ' ' + panels)),
        langText: lang,
        bootTag: window.__bootTag,
        round: window.__flick.snapshot().round,
        counts: window.__flick.snapshot().counts,
        brand: document.getElementById('brand-main').textContent.trim(),
        turn: document.getElementById('hud-turn').textContent.trim()
      });
    })()`));
    check(
      "双语: 原地切到英文，界面零汉字且不重载、不重置",
      english.locale === "en" && english.lang === "en" && english.han === false && english.langText === "中文"
        && english.bootTag === "stay" && english.round === roundBefore && `${english.counts.south}/${english.counts.north}` === countsBefore
        && english.brand.length > 0 && /[A-Za-z]/.test(english.turn),
      JSON.stringify({ han: english.han, round: english.round, counts: english.counts, turn: english.turn }),
    );
    await click("#btn-lang");
    await wait(250);
    const chinese = JSON.parse(await evaluate("JSON.stringify({ locale: window.__flick.locale, round: window.__flick.snapshot().round, brand: document.getElementById('brand-main').textContent.trim() })"));
    check(
      "双语: 切回中文原地生效且局势不丢",
      chinese.locale === "zh" && chinese.round === roundBefore && chinese.brand.includes("指弹"),
      JSON.stringify(chinese),
    );

    await click("#btn-help");
    const helpOpen = await evaluate("!document.getElementById('panel-help').hidden");
    const helpAt = (await snapshot()).time;
    await wait(750);
    const helpFrozen = (await snapshot()).time;
    await evaluate("document.querySelector('#panel-help .close-btn').click()");
    await wait(500);
    const helpResumed = (await snapshot()).time;
    check(
      "帮助: 呼出时冻结计时，关闭后恢复",
      helpOpen && helpFrozen === helpAt && helpResumed > helpAt,
      `${helpAt} -> ${helpFrozen} -> ${helpResumed}`,
    );

    const visAt = (await snapshot()).time;
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
      "失焦: 切后台自动冻结，回来继续",
      hiddenState.paused === true && hiddenLater.time === hiddenState.time
        && visibleState.paused === false && visibleLater.time > visibleState.time,
      `vis=${visAt} hidden=${hiddenState.paused} visible=${visibleState.paused}`,
    );

    await evaluate("window.__flick.debugClear('south')");
    await wait(1100);
    state = await snapshot();
    const result = JSON.parse(await evaluate(`JSON.stringify({
      open: !document.getElementById('panel-result').hidden,
      title: document.getElementById('result-title').textContent.trim(),
      rows: document.querySelectorAll('#result-rows .result-row').length,
      note: document.getElementById('result-note').textContent.trim(),
      noteVisible: !document.getElementById('result-note').hidden,
      stats: document.getElementById('result-stats').textContent.trim(),
      best: JSON.stringify(window.__flick.progress.best)
    })`));
    check(
      "胜负: 清空本方半场即结算并弹出结果",
      state.status === "ended" && state.winner === "south" && state.reason === "cleared"
        && result.open && result.title.length > 0 && result.rows >= 4,
      JSON.stringify({ status: state.status, winner: state.winner, rows: result.rows, title: result.title }),
    );
    check(
      "结算: 战绩写入存档并标记新纪录",
      JSON.parse(result.best)["duel_duel_board_3gate_south"].rounds > 0
        && result.noteVisible === true && result.stats.length > 0,
      `best=${result.best} note=${result.note}`,
    );

    await click("#btn-result-replay");
    await wait(300);
    state = await snapshot();
    const panelsAfterReplay = await evaluate("document.querySelectorAll('.panel:not([hidden])').length");
    check(
      "流转: 再来一局立即重置盘面",
      state.status === "playing" && state.round === 0 && state.counts.south === 5 && state.counts.north === 5
        && panelsAfterReplay === 0,
      `round=${state.round} panels=${panelsAfterReplay}`,
    );

    await wait(2200);
    const desktopShot = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(join(SHOTS, "desktop.png"), Buffer.from(desktopShot.data, "base64"));

    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await wait(800);
    const mobile = JSON.parse(await evaluate(`(() => {
      const canvas = document.getElementById('table-canvas');
      const rect = canvas.getBoundingClientRect();
      const app = getComputedStyle(document.getElementById('app'));
      const mode = document.getElementById('btn-mode').getBoundingClientRect();
      const pause = document.getElementById('btn-pause').getBoundingClientRect();
      return JSON.stringify({
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        canvasW: Math.round(rect.width),
        canvasH: Math.round(rect.height),
        ratio: Math.round((rect.width / rect.height) * 100) / 100,
        touchAction: getComputedStyle(canvas).touchAction,
        bottomPad: parseFloat(app.paddingBottom),
        modeH: Math.round(mode.height),
        pauseH: Math.round(pause.height),
        hudCells: document.querySelectorAll('#hud .hud-cell').length,
        panels: document.querySelectorAll('.panel:not([hidden])').length
      });
    })()`));
    check(
      "移动端: 无横向溢出、画布比例正确、触控拦截与安全区到位",
      mobile.overflow <= 1 && mobile.canvasW <= 380 && mobile.ratio >= 1.5 && mobile.ratio <= 1.6
        && mobile.touchAction === "none" && mobile.bottomPad >= 68 && mobile.hudCells === 5 && mobile.panels === 0,
      JSON.stringify(mobile),
    );
    check("移动端: 模式与暂停按键触控高度达标", mobile.modeH >= 44 && mobile.pauseH >= 44, JSON.stringify(mobile));

    const beforeTouch = await snapshot();
    const touchShot = await evaluate(`(() => {
      const s = window.__flick.snapshot();
      const own = s.pucks.filter((item) => item.side === s.turn);
      const puck = own.reduce((best, item) => {
        const score = Math.min(...s.gates.map((gate) => Math.abs(item.x - gate.x)));
        return score < best.score ? { item, score } : best;
      }, { item: own[0], score: Infinity }).item;
      const canvas = document.getElementById('table-canvas');
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + (puck.x / 960) * rect.width;
      const cy = rect.top + (puck.y / 620) * rect.height;
      const pull = (36 / 620) * rect.height * (s.turn === 'south' ? 1 : -1);
      const options = (x, y, buttons) => ({ pointerId: 31, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y, buttons });
      canvas.dispatchEvent(new PointerEvent('pointerdown', options(cx, cy, 1)));
      canvas.dispatchEvent(new PointerEvent('pointermove', options(cx, cy + pull, 1)));
      canvas.dispatchEvent(new PointerEvent('pointerup', options(cx, cy + pull, 0)));
      return true;
    })()`);
    await evaluate("window.__flick.advance(6)");
    await wait(200);
    const afterTouch = await snapshot();
    check(
      "移动端: 触控拖拽仍可完成一次弹射",
      touchShot === true && afterTouch.round === beforeTouch.round + 1 && afterTouch.phase === "aim",
      `round=${beforeTouch.round}->${afterTouch.round} phase=${afterTouch.phase}`,
    );

    await wait(2000);
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
