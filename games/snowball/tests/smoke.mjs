// Zero-dependency CDP smoke test for Snowball Bros.
// Serves dist/, drives a headless Chrome, and asserts only window.__snowball truth.
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, resolve, normalize } from "node:path";
import { spawn } from "node:child_process";

const ROOT = resolve(import.meta.dirname, "..", "..", "..");
const DIST = join(ROOT, "dist");
const SHOTS = join(ROOT, "x", "snowball", "shots");
const SLUG = "snowball";
const PORT = 8796;
const CDP_PORT = 9337;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
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
  if (!existsSync(join(DIST, SLUG, "index.html"))) {
    throw new Error("dist 缺少 snowball，请先 npm run build");
  }
  await mkdir(SHOTS, { recursive: true });
  const server = await startServer();
  const chromePath = await findChrome();
  const profile = join(ROOT, "x", "snowball", "chrome-profile");
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
    const snapshot = async () => JSON.parse(await evaluate("JSON.stringify(window.__snowball.snapshot())"));
    const key = async (type, code, keyValue, vk) => {
      await send("Input.dispatchKeyEvent", { type, code, key: keyValue, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
    };
    const tapKey = async (code, keyValue, vk, hold = 40) => {
      await key("keyDown", code, keyValue, vk);
      await wait(hold);
      await key("keyUp", code, keyValue, vk);
    };

    const waitForApp = async () => {
      for (let i = 0; i < 80; i += 1) {
        const ready = await evaluate("document.readyState").catch(() => null);
        const has = await evaluate("Boolean(window.__snowball)").catch(() => false);
        if (ready === "complete" && has) return true;
        await wait(250);
      }
      return false;
    };

    if (!(await waitForApp())) {
      const dump = await evaluate(
        "JSON.stringify({ready:document.readyState,title:document.title,scripts:[...document.scripts].map(s=>s.src)})",
      ).catch((e) => `dump failed: ${e.message}`);
      check("boot: 页面与模块装配完成", false, String(dump));
      throw new Error("装配超时");
    }
    check("boot: 页面与模块装配完成", true);

    await evaluate("localStorage.removeItem('doin.snowball.v1'); localStorage.setItem('doin.lang','zh'); location.reload()");
    if (!(await waitForApp())) throw new Error("重置存档后装配失败");
    await wait(600);

    let resources = [];
    for (let i = 0; i < 40; i += 1) {
      resources = await evaluate(`
        performance.getEntriesByType('resource')
          .filter((e) => e.name.startsWith(location.origin) && /\\.(mjs|css|js|svg)/.test(e.name))
          .map((e) => ({ name: e.name.split('/').pop(), status: e.responseStatus ?? 0 }))
      `);
      if (resources.length >= 8) break;
      await wait(200);
    }
    const bad = resources.filter((r) => r.status && (r.status < 200 || r.status >= 300));
    check("boot: 同源资源全部 2xx", resources.length >= 8 && bad.length === 0, `资源 ${resources.length} 个`);

    let state = await snapshot();
    const langTag = await evaluate("document.documentElement.lang");
    check(
      "开局: 首屏即第 1 关可玩",
      langTag === "zh-CN" && state.status === "playing" && state.levelNumber === 1 && state.lives === 3 && state.enemies >= 3 && !state.paused,
      `lang=${langTag} level=${state.levelNumber} enemies=${state.enemies}`,
    );

    const uiState = JSON.parse(await evaluate(`JSON.stringify({
      level: document.getElementById('hud-level').textContent.trim(),
      chapter: document.getElementById('hud-chapter').textContent.trim(),
      hearts: document.querySelectorAll('#hud-hearts .heart').length,
      score: document.getElementById('hud-score').textContent.trim(),
      panels: document.querySelectorAll('.panel:not([hidden])').length,
      deck: getComputedStyle(document.getElementById('touch-deck')).display
    })`));
    check(
      "渲染: HUD 关卡/章节/五格生命与零浮层",
      uiState.level.length > 0 && uiState.chapter.length > 0 && uiState.hearts === 5 && uiState.panels === 0,
      `level=${uiState.level} hearts=${uiState.hearts}`,
    );

    const painted = await evaluate(`(() => {
      const canvas = document.getElementById('stage');
      const ctx = canvas.getContext('2d');
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const colors = new Set();
      for (let i = 0; i < data.length; i += 4004) colors.add(data[i] + ':' + data[i + 1] + ':' + data[i + 2]);
      return colors.size;
    })()`);
    check("渲染: Canvas 已绘制雪原场景", painted > 20, `采样色彩 ${painted} 种`);

    const startX = state.player.x;
    await key("keyDown", "ArrowRight", "ArrowRight", 39);
    await wait(520);
    await key("keyUp", "ArrowRight", "ArrowRight", 39);
    await wait(120);
    state = await snapshot();
    check("操作: 键盘右移真的推动雪人", state.player.x > startX + 30, `x ${startX} -> ${state.player.x}`);

    const groundY = state.player.y;
    await tapKey("KeyX", "x", 88, 60);
    await wait(180);
    state = await snapshot();
    check("操作: X 跳跃离地", state.player.y < groundY - 12, `y ${groundY} -> ${state.player.y}`);
    await wait(1100);
    state = await snapshot();
    check("操作: 落回平台且可继续操作", state.player.onGround, `y=${state.player.y}`);

    await evaluate("window.__snowball.loadLevel(5)");
    await wait(600);
    state = await snapshot();
    await evaluate("window.__snowball.teleport(70, 390)");
    const enemiesBefore = state.enemies;
    await key("keyDown", "KeyZ", "z", 90);
    await wait(1150);
    await key("keyUp", "KeyZ", "z", 90);
    await wait(120);
    state = await snapshot();
    check(
      "玩法: 按住喷雪把小怪冻成雪球",
      state.snowballs >= 1 && state.enemies < enemiesBefore,
      `enemies ${enemiesBefore} -> ${state.enemies} balls=${state.snowballs}`,
    );

    const ball = state.ball;
    await evaluate(`window.__snowball.teleport(${ball.x - 30}, ${ball.y + ball.r})`);
    await key("keyDown", "ArrowRight", "ArrowRight", 39);
    await wait(420);
    await key("keyUp", "ArrowRight", "ArrowRight", 39);
    await wait(160);
    state = await snapshot();
    check("玩法: 贴近雪球朝它走即可推成滚球", state.rollingBalls >= 1 && (state.ball?.vx ?? 0) > 0, JSON.stringify(state.ball));
    await wait(1600);
    state = await snapshot();
    check("玩法: 滚球碾过小怪得分", state.kills >= 1 && state.score >= 100, `kills=${state.kills} score=${state.score}`);

    const beforePause = (await snapshot()).elapsed;
    await tapKey("KeyP", "p", 80, 40);
    await wait(260);
    state = await snapshot();
    const frozenAt = state.elapsed;
    await wait(600);
    const still = await snapshot();
    check("暂停: P 冻结局面与计时并展示暂停页", state.paused && still.elapsed === frozenAt && (await evaluate("!document.getElementById('panel-pause').hidden")), `elapsed=${frozenAt}`);
    await tapKey("KeyP", "p", 80, 40);
    await wait(320);
    state = await snapshot();
    check("暂停: 再按 P 原地继续", !state.paused && state.elapsed > frozenAt, `elapsed ${frozenAt} -> ${state.elapsed}`);

    await evaluate("document.getElementById('btn-levels').click()");
    await wait(260);
    const book = JSON.parse(await evaluate(`JSON.stringify({
      open: !document.getElementById('panel-levels').hidden,
      chips: document.querySelectorAll('#level-groups .level-chip').length,
      chapters: document.querySelectorAll('#level-groups .level-chapter').length,
      paused: window.__snowball.snapshot().paused
    })`));
    check("关卡册: 三章三十关且翻开时自动暂停", book.open && book.chips === 30 && book.chapters === 3 && book.paused, JSON.stringify(book));
    await evaluate("document.querySelectorAll('#level-groups .level-chip')[9].click()");
    await wait(400);
    state = await snapshot();
    check("关卡册: 点第 10 关直达首领战", state.levelNumber === 10 && state.bossHp > 0 && state.bossMax >= 3 && !state.paused, `boss=${state.bossHp}/${state.bossMax}`);
    check("首领: HUD 显示血格", await evaluate("!document.getElementById('hud-boss').hidden"));

    await evaluate("window.__snowball.loadLevel(0)");
    await wait(400);
    await evaluate("window.__snowball.clearLevel()");
    await wait(500);
    state = await snapshot();
    const resultUi = JSON.parse(await evaluate(`JSON.stringify({
      open: !document.getElementById('panel-result').hidden,
      stars: document.querySelectorAll('#result-stars .result-star:not(.dim)').length,
      rows: document.querySelectorAll('#result-rows .result-row').length,
      next: document.getElementById('btn-result-next').textContent.trim()
    })`));
    check("结算: 清场后亮星、列出数据并显示下一关", state.status === "cleared" && resultUi.open && resultUi.stars === 3 && resultUi.rows >= 3 && resultUi.next.length > 0, JSON.stringify(resultUi));
    const saved = await evaluate("JSON.parse(localStorage.getItem('doin.snowball.v1')).stars.snow_01.stars");
    check("结算: 三星成绩写入 doin.snowball.v1", saved === 3, `saved=${saved}`);

    await evaluate("document.getElementById('btn-result-next').click()");
    await wait(500);
    state = await snapshot();
    check("结算: 下一关立刻开打", state.levelNumber === 2 && state.status === "playing" && (await evaluate("document.getElementById('panel-result').hidden")), `level=${state.levelNumber}`);

    await evaluate("document.getElementById('btn-mode').click()");
    await wait(260);
    check("模式: 顶栏模式键翻开选择页", await evaluate("!document.getElementById('panel-mode').hidden"));
    await evaluate("document.getElementById('btn-mode-rush').click()");
    await wait(500);
    state = await snapshot();
    const rushText = await evaluate("document.getElementById('hud-level').textContent.trim()");
    check("模式: 切入九十秒雪崩冲刺", state.mode === "rush" && state.rushTime <= 90 && state.rushTime > 80 && rushText.length > 0, `rush=${state.rushTime.toFixed(1)} hud=${rushText}`);
    const rushStart = state.rushTime;
    await wait(600);
    state = await snapshot();
    check("模式: 冲刺倒计时递减", state.rushTime < rushStart - 0.3, `rush ${rushStart.toFixed(1)} -> ${state.rushTime.toFixed(1)}`);

    await tapKey("KeyP", "p", 80, 40);
    await wait(260);
    const rushPaused = await snapshot();
    await wait(500);
    const rushStill = await snapshot();
    check("模式: 冲刺暂停冻结倒计时", rushPaused.paused && rushStill.rushTime === rushPaused.rushTime, `rush=${rushPaused.rushTime.toFixed(2)}`);
    await tapKey("KeyP", "p", 80, 40);
    await wait(260);

    await evaluate("window.__sentinel = 4242");
    const levelBefore = (await snapshot()).levelNumber;
    const rushBefore = (await snapshot()).rushTime;
    await evaluate("document.getElementById('btn-lang').click()");
    await wait(500);
    const enState = JSON.parse(await evaluate(`JSON.stringify({
      lang: document.documentElement.lang,
      title: document.title,
      level: document.getElementById('hud-level').textContent.trim(),
      sentinel: window.__sentinel,
      state: window.__snowball.snapshot()
    })`));
    const enText = await evaluate(`(() => {
      const btn = document.getElementById('btn-lang');
      const prev = btn.textContent;
      btn.textContent = '';
      const text = document.body.innerText;
      btn.textContent = prev;
      return text;
    })()`);
    check(
      "i18n: 切英文原地热更新且局面不重置",
      enState.lang === "en" && enState.sentinel === 4242 && enState.state.mode === "rush" && enState.state.levelNumber === levelBefore && !/[\u4e00-\u9fa5]/.test(enText.replace(/中文/g, "")),
      `lang=${enState.lang} level=${enState.level} residue=${(enText.match(/[\u4e00-\u9fa5]+/g) ?? []).join(",")}`,
    );
    await evaluate("document.getElementById('btn-lang').click()");
    await wait(400);
    check("i18n: 切回中文仍保留冲刺进度", (await snapshot()).rushTime <= rushBefore + 1 && (await evaluate("document.documentElement.lang")) === "zh-CN");

    await evaluate("document.getElementById('btn-sound').click()");
    const muted = await evaluate("document.getElementById('btn-sound').textContent.trim()");
    await evaluate("document.getElementById('btn-sound').click()");
    check("音效: 静音按钮可切换并复原", muted === "×" && (await evaluate("document.getElementById('btn-sound').textContent.trim()")) === "♪", `muted=${muted}`);

    await evaluate("window.__snowball.loadLevel(0)");
    await wait(500);
    const desktopShot = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(join(SHOTS, "desktop.png"), Buffer.from(desktopShot.data, "base64"));

    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await wait(600);
    const mobile = JSON.parse(await evaluate(`JSON.stringify({
      overflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
      deck: getComputedStyle(document.getElementById('touch-deck')).display,
      jump: (() => { const r = document.getElementById('btn-jump').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; })(),
      stick: (() => { const r = document.getElementById('stick').getBoundingClientRect(); return { left: r.left, right: r.right, bottom: r.bottom }; })(),
      width: window.innerWidth
    })`));
    check(
      "移动端: 无横向溢出，摇杆与跳跃键在视口内",
      mobile.overflow && mobile.deck === "flex" && mobile.jump.bottom < 844 && mobile.jump.left > 0 && mobile.jump.right <= mobile.width && mobile.stick.left >= 0 && mobile.stick.bottom < 844,
      JSON.stringify(mobile.jump),
    );
    const beforeTouchJump = (await snapshot()).player.y;
    await evaluate("document.getElementById('btn-jump').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7 }))");
    await wait(220);
    state = await snapshot();
    check("移动端: 点跳跃键真的起跳", state.player.y < beforeTouchJump - 8, `y ${beforeTouchJump} -> ${state.player.y}`);
    await wait(900);
    await evaluate("document.getElementById('btn-spray').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 8 }))");
    await wait(200);
    const spraying = (await snapshot()).player.spraying;
    await evaluate("document.getElementById('btn-spray').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 8 }))");
    await wait(150);
    check("移动端: 按住喷雪键持续喷雾", spraying === true);

    const mobileShot = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(join(SHOTS, "mobile.png"), Buffer.from(mobileShot.data, "base64"));

    await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await wait(300);
    check("稳定: 全流程无控制台异常", errors.length === 0, errors.slice(0, 3).join(" | "));
  } finally {
    try {
      await browser?.send("Browser.close");
    } catch {
      // ignore
    }
    child.kill();
    server.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n== smoke: ${results.length - failed.length} pass, ${failed.length} fail ==`);
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error("SMOKE ERROR:", error.message);
  process.exitCode = 1;
});
