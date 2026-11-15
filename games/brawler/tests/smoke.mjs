// tests/smoke.mjs — 零依赖 CDP 真浏览器冒烟：起静态服务指向 dist/，无头 Chrome 走生产路径。
// 只读 window.__brawler 暴露的对局真值，不复刻玩法逻辑。
// 用法：node games/brawler/tests/smoke.mjs
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { spawn } from "node:child_process";

const ROOT = resolve(import.meta.dirname, "..", "..", "..");
const DIST = join(ROOT, "dist");
const SHOTS = join(ROOT, "x", "brawler", "shots");
const SLUG = "brawler";
const PORT = 8793;
const CDP_PORT = 9334;

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
const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));

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
  return new Promise((resolveServer) => server.listen(PORT, "127.0.0.1", () => resolveServer(server)));
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = [];
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve: resolvePending, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolvePending(message.result);
      } else if (message.method) {
        for (const listener of this.listeners) listener(message);
      }
    });
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolveOpen, reject) => {
      ws.addEventListener("open", resolveOpen, { once: true });
      ws.addEventListener("error", () => reject(new Error(`CDP 连接失败: ${url}`)), { once: true });
    });
    return new Cdp(ws);
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolvePending, reject) => this.pending.set(id, { resolve: resolvePending, reject }));
  }

  on(fn) {
    this.listeners.push(fn);
  }
}

async function main() {
  await mkdir(SHOTS, { recursive: true });
  const server = await startServer();
  const chromePath = await findChrome();
  const profile = join(ROOT, "x", "brawler", "chrome-profile");
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

    browser.on((message) => {
      if (message.method === "Runtime.exceptionThrown") {
        errors.push(message.params.exceptionDetails?.exception?.description ?? "exception");
      }
      if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
        errors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(" "));
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
        const has = await evaluate("Boolean(window.__brawler)").catch(() => false);
        if (ready === "complete" && has) return true;
        await wait(250);
      }
      return false;
    };

    if (!(await waitForApp())) {
      const dump = await evaluate(
        "JSON.stringify({ready:document.readyState,title:document.title,scripts:[...document.scripts].map(s=>s.src)})",
      ).catch((error) => `dump failed: ${error.message}`);
      check("boot: 页面与模块装配完成", false, String(dump));
      throw new Error("装配超时");
    }
    check("boot: 页面与模块装配完成", true);

    // 干净首局 + 固定中文，排除语言与历史进度干扰
    await evaluate("localStorage.removeItem('doin.brawler.v1'); localStorage.setItem('doin.lang','zh'); location.reload()");
    if (!(await waitForApp())) throw new Error("重置存档后装配失败");
    await wait(600);

    const resources = await evaluate(`
      performance.getEntriesByType('resource')
        .filter((entry) => entry.name.startsWith(location.origin) && /\\.(mjs|css|js|webp|svg)/.test(entry.name))
        .map((entry) => ({ name: entry.name.split('/').pop(), status: entry.responseStatus ?? 0 }))
    `);
    const bad = resources.filter((entry) => entry.status && (entry.status < 200 || entry.status >= 300));
    check("boot: 同源资源全部 2xx", resources.length >= 6 && bad.length === 0, `资源 ${resources.length} 个，异常 ${bad.map((entry) => entry.name).join(",")}`);

    const initial = JSON.parse(await evaluate(`JSON.stringify({
      mode: window.__brawler.game.mode,
      level: window.__brawler.game.levelId,
      enemies: window.__brawler.game.match.enemies.length,
      players: window.__brawler.game.match.players.length,
      status: window.__brawler.game.match.status,
      hudLevel: document.getElementById('hud-level-name').textContent,
      hudKo: document.getElementById('hud-ko').textContent,
      fighters: document.querySelectorAll('#actors .fighter').length,
      sky: getComputedStyle(document.getElementById('sky')).backgroundImage
    })`));
    check(
      "boot: 开局 1 人 3 敌、粉笔 HUD 与立体人物就绪",
      initial.mode === "story" && initial.level === "level_01" && initial.enemies === 3
        && initial.players === 1 && initial.status === "playing"
        && initial.fighters >= 4 && initial.hudLevel.length > 0 && initial.sky !== "none",
      JSON.stringify(initial),
    );

    // 键盘移动：读真值，确认输入链路而非复刻逻辑
    const xBefore = await evaluate("window.__brawler.game.match.players[0].x");
    await send("Input.dispatchKeyEvent", { type: "rawKeyDown", code: "KeyD", key: "d", windowsVirtualKeyCode: 68 });
    await wait(600);
    await send("Input.dispatchKeyEvent", { type: "keyUp", code: "KeyD", key: "d", windowsVirtualKeyCode: 68 });
    const xAfter = await evaluate("window.__brawler.game.match.players[0].x");
    check("input: WASD 真的驱动角色横移", xAfter > xBefore + 5, `x ${xBefore.toFixed(0)} -> ${xAfter.toFixed(0)}`);

    // 重拳击飞：把一名对手放到面前并留 1 血，按 K 后 KO 计数必须上涨且 HUD 同步
    await evaluate(`(() => {
      const m = window.__brawler.game.match;
      const p = m.players[0];
      const e = m.enemies.find((item) => !item.dead);
      e.spawnT = 0; e.stun = 0; e.hp = 1; e.cool = 60; e.attack = null;
      e.x = Math.min(1700, p.x + 46); e.z = p.z;
      p.facing = 1;
    })()`);
    const koBefore = await evaluate("window.__brawler.game.match.ko");
    await send("Input.dispatchKeyEvent", { type: "rawKeyDown", code: "KeyK", key: "k", windowsVirtualKeyCode: 75 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", code: "KeyK", key: "k", windowsVirtualKeyCode: 75 });
    await wait(900);
    const koAfter = await evaluate("window.__brawler.game.match.ko");
    const hudKo = await evaluate("document.getElementById('hud-ko').textContent");
    check("combat: 重拳击飞计入 KO 并同步粉笔黑板", koAfter > koBefore && hudKo === String(koAfter), `ko ${koBefore} -> ${koAfter} / hud ${hudKo}`);

    // 选关：12 张关卡卡 + 街机入口，关闭后继续
    await evaluate("document.getElementById('btn-levels').click()");
    await wait(350);
    const levels = JSON.parse(await evaluate(`JSON.stringify({
      open: !document.getElementById('panel-levels').hidden,
      cards: document.querySelectorAll('#levels-body .level-card').length,
      arcade: Boolean(document.querySelector('#levels-body .arcade-row')),
      paused: window.__brawler.game.paused
    })`));
    check("ui: 选关抽屉含 12 关与街机入口，并按设计暂停", levels.open && levels.cards === 12 && levels.arcade && levels.paused, JSON.stringify(levels));
    await evaluate("document.getElementById('levels-close').click()");
    await wait(350);
    check("ui: 关闭选关后恢复推进", (await evaluate("window.__brawler.game.paused")) === false);

    // 语言热更新：不重开对局，击飞数与关卡保持不变
    const beforeLocale = JSON.parse(await evaluate(`JSON.stringify({level: window.__brawler.game.levelId, ko: window.__brawler.game.match.ko})`));
    await evaluate("document.getElementById('btn-lang').click()");
    await wait(300);
    const afterLocale = JSON.parse(await evaluate(`JSON.stringify({
      lang: document.documentElement.lang,
      levelsBtn: document.getElementById('btn-levels').textContent.trim(),
      level: window.__brawler.game.levelId,
      ko: window.__brawler.game.match.ko,
      hud: document.getElementById('hud-level-name').textContent
    })`));
    check(
      "i18n: 切换英文只原地换字，不重置对局",
      afterLocale.lang === "en" && afterLocale.levelsBtn.includes("Levels")
        && afterLocale.level === beforeLocale.level && afterLocale.ko === beforeLocale.ko,
      JSON.stringify(afterLocale),
    );

    // 暂停冻结
    await evaluate("document.getElementById('btn-pause').click()");
    await wait(250);
    const pausedA = await evaluate("window.__brawler.game.match.time");
    await wait(500);
    const pausedB = await evaluate("window.__brawler.game.match.time");
    const pauseOpen = await evaluate("!document.getElementById('panel-pause').hidden");
    check("ui: 暂停冻结战局并弹面板", pauseOpen && pausedA === pausedB, `time ${pausedA.toFixed(2)} -> ${pausedB.toFixed(2)}`);
    await evaluate("document.getElementById('btn-resume').click()");
    await wait(350);
    const resumedTime = await evaluate("window.__brawler.game.match.time");
    check("ui: 继续后恢复推进", resumedTime > pausedB, `time ${pausedB.toFixed(2)} -> ${resumedTime.toFixed(2)}`);

    // 桌面截图
    const desktop = (await send("Page.captureScreenshot", { format: "png" })).data;
    await writeFile(join(SHOTS, "desktop.png"), Buffer.from(desktop, "base64"));

    // 移动端 390×844：无横向溢出、底部 68px 安全区、操作台常驻
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await wait(700);
    const mobile = JSON.parse(await evaluate(`JSON.stringify({
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      padBottom: getComputedStyle(document.getElementById('game-app')).paddingBottom,
      stageW: document.getElementById('stage').getBoundingClientRect().width,
      deck: document.getElementById('control-deck').getBoundingClientRect(),
      innerH: window.innerHeight,
      stick: getComputedStyle(document.getElementById('stick-pad')).display
    })`));
    check("mobile: 390px 无横向溢出且舞台可见", mobile.scrollW <= mobile.innerW + 1 && mobile.stageW > 300, JSON.stringify(mobile).slice(0, 200));
    check("mobile: 底部 68px 广告安全区", parseFloat(mobile.padBottom) >= 68, `padding-bottom=${mobile.padBottom}`);
    check("mobile: 操作台常驻在安全区之上", mobile.deck.bottom <= mobile.innerH - 60 && mobile.deck.top >= 0, `deck ${mobile.deck.top.toFixed(0)}~${mobile.deck.bottom.toFixed(0)} / 视口 ${mobile.innerH}`);
    check("mobile: 虚拟摇杆可见", mobile.stick !== "none", `display=${mobile.stick}`);
    const mobileShot = (await send("Page.captureScreenshot", { format: "png" })).data;
    await writeFile(join(SHOTS, "mobile.png"), Buffer.from(mobileShot, "base64"));

    // 触控按钮：真实 pointerdown 必须能出拳（不读内部实现，只读攻击状态变化）
    await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await wait(300);
    await evaluate("window.__brawler.game.match.players[0].attack = null");
    const box = JSON.parse(await evaluate(`(() => {
      const r = document.getElementById('act-light').getBoundingClientRect();
      return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    })()`));
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: box.x, y: box.y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: box.x, y: box.y, button: "left", clickCount: 1 });
    await wait(150);
    const attacked = await evaluate("window.__brawler.game.match.players[0].attack?.type ?? null");
    check("input: 点击屏幕按钮可以出拳", attacked === "light", `attack=${JSON.stringify(attacked)}`);

    check("console: 无未捕获异常与 error 日志", errors.length === 0, errors.slice(0, 3).join(" | "));
  } catch (error) {
    check("smoke: 执行未中断", false, error.message);
  } finally {
    try {
      server.close();
    } catch {
      // 忽略
    }
    if (child.pid) {
      spawn("taskkill", ["/F", "/T", "/PID", String(child.pid)], { stdio: "ignore" });
    }
  }

  const failed = results.filter((result) => !result.ok);
  console.log(`\n== smoke: ${SLUG} == ${results.length - failed.length} pass, ${failed.length} fail`);
  console.log(`shots -> ${SHOTS}`);
  process.exit(failed.length ? 1 : 0);
}

main();
