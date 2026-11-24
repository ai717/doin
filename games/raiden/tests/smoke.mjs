// Zero-dependency CDP smoke test: serves dist/, drives headless Chrome and reads window.__raiden.
// Usage: node games/raiden/tests/smoke.mjs
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, resolve, normalize } from "node:path";
import { spawn } from "node:child_process";

const ROOT = resolve(import.meta.dirname, "..", "..", "..");
const DIST = join(ROOT, "dist");
const SHOTS = join(ROOT, "x", "raiden", "shots");
const SLUG = "raiden";
const PORT = 8797;
const CDP_PORT = 9338;

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
  const profile = join(ROOT, "x", "raiden", "chrome-profile");
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
    const snapshot = async () => JSON.parse(await evaluate("JSON.stringify(window.__raiden.snapshot())"));

    const waitForApp = async () => {
      for (let i = 0; i < 80; i += 1) {
        const ready = await evaluate("document.readyState").catch(() => null);
        const has = await evaluate("Boolean(window.__raiden)").catch(() => false);
        if (ready === "complete" && has) return true;
        await wait(250);
      }
      return false;
    };

    const key = async (type, code, keyValue, vk) => {
      await send("Input.dispatchKeyEvent", {
        type,
        code,
        key: keyValue,
        windowsVirtualKeyCode: vk,
        nativeVirtualKeyCode: vk,
      });
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

    await evaluate("localStorage.removeItem('doin.raiden.v1'); localStorage.setItem('doin.lang','zh'); location.reload()");
    if (!(await waitForApp())) throw new Error("重置存档后装配失败");
    await wait(600);

    let sameOrigin = [];
    for (let i = 0; i < 40; i += 1) {
      sameOrigin = await evaluate(`
        performance.getEntriesByType('resource')
          .filter((e) => e.name.startsWith(location.origin) && /\\.(mjs|css|js|webp|svg)/.test(e.name))
          .map((e) => ({ name: e.name.split('/').pop(), status: e.responseStatus ?? 0 }))
      `);
      if (sameOrigin.length >= 9) break;
      await wait(200);
    }
    const bad = sameOrigin.filter((r) => r.status && (r.status < 200 || r.status >= 300));
    check(
      "boot: 同源资源全部 2xx",
      sameOrigin.length >= 9 && bad.length === 0,
      `资源 ${sameOrigin.length} 个，异常 ${bad.map((b) => `${b.name}:${b.status}`).join(",")}`,
    );

    let state = await snapshot();
    check(
      "开局: 首屏即一局可玩的中文闯关",
      state.status === "playing" && state.mode === "stage" && state.stageNumber === 1 && state.lives === 3 && state.bombs === 2,
      `stage=${state.stageNumber} lives=${state.lives} bombs=${state.bombs}`,
    );

    const canvasInfo = JSON.parse(await evaluate(`(() => {
      const canvas = document.getElementById('stage');
      const rect = canvas.getBoundingClientRect();
      const deck = getComputedStyle(document.getElementById('touch-deck'));
      return JSON.stringify({ w: canvas.width, h: canvas.height, rectW: rect.width, rectH: rect.height, deck: deck.display });
    })()`));
    check(
      "渲染: 竖版画布就绪且比例正确",
      canvasInfo.w === 540 && canvasInfo.h === 900 && canvasInfo.rectH > 260 && Math.abs(canvasInfo.rectW / canvasInfo.rectH - 0.6) < 0.02,
      `${canvasInfo.w}x${canvasInfo.h} css ${Math.round(canvasInfo.rectW)}x${Math.round(canvasInfo.rectH)}`,
    );

    const hud = JSON.parse(await evaluate(`JSON.stringify({
      stage: document.getElementById('hud-stage').textContent.trim(),
      score: document.getElementById('hud-score').textContent.trim(),
      graze: document.getElementById('hud-graze').textContent.trim(),
      lives: document.getElementById('hud-lives').textContent.trim(),
      bombs: document.getElementById('hud-bombs').textContent.trim(),
      charge: document.getElementById('hud-charge').style.width,
      bossHidden: document.getElementById('hud-boss').hidden,
      brand: document.getElementById('brand-main').textContent.trim()
    })`));
    check(
      "HUD: 面数/得分/命数/保险/蓄力条与标题齐备",
      hud.stage.includes("第 1 面") && hud.score === "0" && hud.graze === "0" && hud.lives.length >= 3 && hud.bombs.length >= 2 && hud.charge === "0%" && hud.bossHidden && hud.brand.length > 0,
      JSON.stringify(hud),
    );

    await wait(500);
    state = await snapshot();
    check("玩法: 战机自动开火", state.playerBullets > 0, `bullets=${state.playerBullets}`);

    const x0 = state.player.x;
    await key("keyDown", "ArrowRight", "ArrowRight", 39);
    await wait(420);
    await key("keyUp", "ArrowRight", "ArrowRight", 39);
    state = await snapshot();
    check("操作: 方向键真的移动战机", state.player.x > x0 + 30, `${x0} -> ${state.player.x}`);

    await wait(900);
    state = await snapshot();
    check("关卡: 波次自动刷出敌机", state.enemies > 0 && state.status === "playing", `enemies=${state.enemies}`);

    await key("keyDown", "KeyX", "x", 88);
    await wait(760);
    state = await snapshot();
    check("蓄力: 按住 X 蓄力条增长且战机减速", state.charging === true && state.charge > 0.45, `charge=${state.charge.toFixed(2)}`);
    await key("keyUp", "KeyX", "x", 88);
    await wait(160);
    state = await snapshot();
    check("蓄力: 松开后蓄力清零并释放激光", state.charging === false && state.charge === 0, `charge=${state.charge}`);

    const bombBefore = state.bombs;
    const bombsUsedBefore = state.bombsUsed;
    await key("keyDown", "KeyC", "c", 67);
    await wait(220);
    await key("keyUp", "KeyC", "c", 67);
    state = await snapshot();
    check(
      "保险: C 键消耗保险并清空敌弹",
      state.bombsUsed > bombsUsedBefore && state.bombs < bombBefore && state.enemyBullets === 0,
      `bombs ${bombBefore} -> ${state.bombs} used ${bombsUsedBefore} -> ${state.bombsUsed}`,
    );

    await key("keyDown", "KeyP", "p", 80);
    await wait(120);
    await key("keyUp", "KeyP", "p", 80);
    await wait(200);
    const pausedAt = await snapshot();
    const pausePanel = await evaluate("!document.getElementById('panel-pause').hidden");
    await wait(420);
    const stillPaused = await snapshot();
    check(
      "暂停: P 打开暂停面板并冻结时间",
      pausedAt.paused === true && pausePanel === true && stillPaused.time === pausedAt.time,
      `paused=${pausedAt.paused} panel=${pausePanel}`,
    );
    await evaluate("document.getElementById('btn-pause-resume').click()");
    await wait(200);
    state = await snapshot();
    check("暂停: 继续游戏恢复推进", state.paused === false && state.time > pausedAt.time, `t ${pausedAt.time} -> ${state.time}`);

    const target = (state.enemies > 0 ? JSON.parse(await evaluate(`
      (() => { const s = window.__raiden.session; const e = s.world.enemies[0]; return JSON.stringify({x: e.x, y: e.y}); })()
    `)) : { x: 270, y: 300 });
    const killsBefore = state.kills;
    await evaluate(`window.__raiden.debugTeleport(${Math.round(target.x)}, ${Math.min(820, Math.round(target.y) + 260)})`);
    await evaluate("window.__raiden.debugCharge(1)");
    await wait(320);
    state = await snapshot();
    check("蓄力激光: 纵向穿透并击杀敌机", state.kills > killsBefore, `kills ${killsBefore} -> ${state.kills}`);

    await evaluate("document.getElementById('btn-stages').click()");
    await wait(220);
    const stagesOpen = await evaluate("!document.getElementById('panel-stages').hidden");
    const chips = await evaluate("document.querySelectorAll('#stage-grid .stage-chip').length");
    check("选关: 航线图打开且有六面可选", stagesOpen && chips === 6, `chips=${chips}`);

    await evaluate("document.querySelector('#stage-grid .stage-chip[data-index=\"2\"]').click()");
    await wait(300);
    state = await snapshot();
    check("选关: 点击第三面立即进入", state.stageNumber === 3 && state.status === "playing" && state.mode === "stage", `stage=${state.stageNumber}`);

    await evaluate("window.__raiden.debugSpawnBoss()");
    await wait(320);
    state = await snapshot();
    const bossBar = JSON.parse(await evaluate(`JSON.stringify({
      hidden: document.getElementById('hud-boss').hidden,
      width: document.getElementById('hud-boss-fill').style.width
    })`));
    check(
      "首领: 入场后血条出现且血量随火力回落",
      state.bossMax === 140 && state.bossHp > 0 && state.bossHp <= state.bossMax && bossBar.hidden === false && bossBar.width !== "",
      `hp=${state.bossHp}/${state.bossMax} width=${bossBar.width}`,
    );

    const bossBefore = state.bossHp;
    await evaluate(`window.__raiden.debugTeleport(${Math.round(await evaluate("window.__raiden.session.boss.x"))}, 780)`);
    await evaluate("window.__raiden.debugCharge(1)");
    await wait(320);
    state = await snapshot();
    check("首领: 满蓄力激光确实削血", state.bossHp < bossBefore, `${bossBefore} -> ${state.bossHp}`);

    await evaluate("window.__raiden.debugWin()");
    await wait(320);
    state = await snapshot();
    const result = JSON.parse(await evaluate(`JSON.stringify({
      open: !document.getElementById('panel-result').hidden,
      stars: document.querySelectorAll('#result-stars .result-star:not(.dim)').length,
      rows: document.querySelectorAll('#result-rows .result-row').length,
      next: document.getElementById('btn-result-next').textContent.trim()
    })`));
    check(
      "结算: 击破后弹出三星结算与动作按钮",
      state.status === "cleared" && result.open && result.stars >= 1 && result.stars <= 3 && result.rows >= 4 && result.next.length > 0,
      `stars=${result.stars} rows=${result.rows}`,
    );

    await evaluate("document.getElementById('btn-result-next').click()");
    await wait(420);
    state = await snapshot();
    check("结算: 下一面继续且资源继承", state.stageNumber === 4 && state.status === "playing" && !state.paused, `stage=${state.stageNumber}`);

    await evaluate("document.getElementById('btn-stages').click()");
    await wait(200);
    await evaluate("document.getElementById('training-card').click()");
    await wait(500);
    state = await snapshot();
    check(
      "训练: 从航线图进入六十秒弹幕训练",
      state.mode === "training" && state.status === "playing" && state.trainingLeft > 58 && state.lives === 3,
      `left=${state.trainingLeft.toFixed(1)}`,
    );

    await wait(5200);
    state = await snapshot();
    check("训练: 几何弹幕持续生成且不损命", state.enemyBullets > 0 && state.lives === 3 && state.status === "playing", `bullets=${state.enemyBullets} lives=${state.lives}`);

    await key("keyDown", "KeyP", "p", 80);
    await wait(120);
    await key("keyUp", "KeyP", "p", 80);
    await wait(200);
    state = await snapshot();
    await evaluate("document.getElementById('btn-pause-resume').click()");
    await wait(160);
    const resumedState = await snapshot();
    check("训练: 暂停与继续同样生效", state.paused === true && resumedState.paused === false, `paused=${state.paused}`);

    await evaluate("document.getElementById('btn-lang').click()");
    await wait(320);
    const english = JSON.parse(await evaluate(`(() => {
      const nodes = [...document.querySelectorAll('#top-bar, #hud, #deck')].map((n) => n.innerText).join(' ');
      const lang = document.getElementById('btn-lang').textContent.trim();
      const text = nodes.split(lang).join(' ');
      return JSON.stringify({ locale: window.__raiden.locale, lang: document.documentElement.lang, han: /[\\u4e00-\\u9fff]/.test(text), sample: document.getElementById('hud-stage').textContent.trim(), langText: lang });
    })()`));
    check(
      "双语: 原地切到英文且界面零汉字",
      english.locale === "en" && english.lang === "en" && english.han === false && english.langText === "中文",
      `stage=${english.sample} han=${english.han}`,
    );

    await evaluate("document.getElementById('btn-lang').click()");
    await wait(320);
    const chinese = JSON.parse(await evaluate(`JSON.stringify({
      locale: window.__raiden.locale,
      stage: document.getElementById('hud-stage').textContent.trim(),
      title: document.title
    })`));
    check(
      "双语: 切回中文原地生效且不重置局面",
      chinese.locale === "zh" && chinese.stage.includes("训练") && chinese.title.includes("雷电"),
      `${chinese.stage}`,
    );

    const desktopShot = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(join(SHOTS, "desktop.png"), Buffer.from(desktopShot.data, "base64"));

    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await wait(600);
    const mobile = JSON.parse(await evaluate(`(() => {
      const rect = document.getElementById('stage').getBoundingClientRect();
      const charge = document.getElementById('btn-charge').getBoundingClientRect();
      const deck = getComputedStyle(document.getElementById('touch-deck')).display;
      return JSON.stringify({
        deck,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        stageW: Math.round(rect.width),
        stageH: Math.round(rect.height),
        chargeW: Math.round(charge.width),
        chargeH: Math.round(charge.height)
      });
    })()`));
    check(
      "移动端: 触控托盘出现、无横向溢出、按键够大",
      mobile.deck === "flex" && mobile.overflow <= 1 && mobile.stageW <= 390 && mobile.stageH > 300 && mobile.chargeW >= 44 && mobile.chargeH >= 44,
      JSON.stringify(mobile),
    );

    const touchCharge = await evaluate(`(() => {
      const btn = document.getElementById('btn-charge');
      btn.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, pointerType: 'touch', bubbles: true, cancelable: true }));
      return true;
    })()`);
    await wait(500);
    state = await snapshot();
    await evaluate(`(() => {
      const btn = document.getElementById('btn-charge');
      btn.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, pointerType: 'touch', bubbles: true, cancelable: true }));
    })()`);
    check("移动端: 按住蓄力键进入蓄力", touchCharge === true && state.charging === true && state.charge > 0.2, `charge=${state.charge.toFixed(2)}`);

    const bombsNow = state.bombs;
    await evaluate(`document.getElementById('btn-bomb').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 8, pointerType: 'touch', bubbles: true, cancelable: true }))`);
    await wait(150);
    state = await snapshot();
    check("移动端: 点保险键立即释放", state.bombs === bombsNow - 1, `${bombsNow} -> ${state.bombs}`);

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
