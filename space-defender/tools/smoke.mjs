// tools/smoke.mjs — 真浏览器冒烟（零依赖 CDP）：起静态服务指向 dist/，无头 Chrome 走生产路径。
// 断言一律读被测对象的只读诊断出口（window.__spaceDefender），绝不复刻玩法逻辑。
// 用法：node games/space-defender/tools/smoke.mjs [--keep-shots]
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, resolve, normalize } from "node:path";
import { spawn } from "node:child_process";

const ROOT = resolve(import.meta.dirname, "..", "..", "..");
const DIST = join(ROOT, "dist");
const SHOTS = join(ROOT, "x", "space-defender", "shots");
const SLUG = "space-defender";
const PORT = 8791;
const CDP_PORT = 9333;

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
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
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
  const profile = join(ROOT, "x", "space-defender", "chrome-profile");
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
    // 等 CDP 就绪
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
    // 明确指定桌面视口，别让无头窗口尺寸（--window-size 在 headless=new 下不可靠）影响布局判断
    await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

    const evaluate = async (expression) => {
      const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? "evaluate failed");
      return res.result.value;
    };

    // 等模块图 + 诊断出口（超时时 dump 现场，一眼区分"时序不够"与"服务端没返回正确内容"）
    const waitForApp = async () => {
      for (let i = 0; i < 80; i += 1) {
        const ready = await evaluate("document.readyState").catch(() => null);
        const has = await evaluate("Boolean(window.__spaceDefender)").catch(() => false);
        if (ready === "complete" && has) return true;
        await wait(250);
      }
      return false;
    };
    const booted = await waitForApp();
    if (!booted) {
      const dump = await evaluate(
        "JSON.stringify({ready:document.readyState, title:document.title, head:document.documentElement.outerHTML.slice(0,400), scripts:[...document.scripts].map(s=>s.src)})",
      ).catch((e) => `dump failed: ${e.message}`);
      check("boot: 页面与模块装配完成", false, String(dump));
      throw new Error("装配超时");
    }
    check("boot: 页面与模块装配完成", true);

    // 清掉上一次跑留下的存档，保证本轮是干净首局（解锁进度会影响机库断言）
    await evaluate("localStorage.removeItem('doin.space-defender.v1')");
    await evaluate("location.reload()");
    if (!(await waitForApp())) throw new Error("重置存档后装配失败");

    // 同源资源全部 2xx（用页面内 performance 表，避免 CDP 事件丢失）
    let sameOrigin = [];
    for (let i = 0; i < 40; i += 1) {
      sameOrigin = await evaluate(`
        performance.getEntriesByType('resource')
          .filter((e) => e.name.startsWith(location.origin) && /\\.(mjs|css|js|webp|svg)/.test(e.name))
          .map((e) => ({ name: e.name.split('/').pop(), status: e.responseStatus ?? 0 }))
      `);
      if (sameOrigin.length >= 4) break;
      await wait(200);
    }
    const bad = sameOrigin.filter((r) => r.status && (r.status < 200 || r.status >= 300));
    check("boot: 同源资源全部 2xx", sameOrigin.length >= 4 && bad.length === 0, `资源 ${sameOrigin.length} 个，异常 ${bad.map((b) => `${b.name}:${b.status}`).join(",")}`);

    const locale = await evaluate("window.__spaceDefender.locale()");
    check("i18n: 语言偏好读取 doin.lang", ["zh", "en"].includes(locale), `locale=${locale}`);

    // 从机库面板出击（面板此时必须可见）
    const hangarOpen = await evaluate("document.getElementById('panel-hangar').classList.contains('is-open')");
    check("ui: 初始机库面板可见", hangarOpen === true);
    await evaluate("document.getElementById('btn-hangar-start').click()");
    await wait(400);
    let snap = await evaluate("JSON.stringify(window.__spaceDefender.snapshot())");
    let state = JSON.parse(snap);
    check("game: 出击后进入战斗且有敌机", state.phase === "playing" && state.enemies > 0, snap);

    // 键盘横移必须真的驱动状态（读真值，不复刻逻辑）
    const xBefore = await evaluate("window.__spaceDefender.controller.state.player.x");
    await send("Input.dispatchKeyEvent", { type: "rawKeyDown", code: "ArrowRight", key: "ArrowRight", windowsVirtualKeyCode: 39 });
    await wait(700);
    await send("Input.dispatchKeyEvent", { type: "keyUp", code: "ArrowRight", key: "ArrowRight", windowsVirtualKeyCode: 39 });
    const xAfterRight = await evaluate("window.__spaceDefender.controller.state.player.x");
    await send("Input.dispatchKeyEvent", { type: "rawKeyDown", code: "ArrowLeft", key: "ArrowLeft", windowsVirtualKeyCode: 37 });
    await wait(700);
    await send("Input.dispatchKeyEvent", { type: "keyUp", code: "ArrowLeft", key: "ArrowLeft", windowsVirtualKeyCode: 37 });
    const xAfterLeft = await evaluate("window.__spaceDefender.controller.state.player.x");
    check("input: 键盘左右横移真的驱动战机", xAfterRight > xBefore && xAfterLeft < xAfterRight, `x ${xBefore.toFixed(0)} -> ${xAfterRight.toFixed(0)} -> ${xAfterLeft.toFixed(0)}`);

    // 自动开火对照组：关掉后射击数必须停止增长，打开后必须增长
    await evaluate("(() => { const c = document.getElementById('chk-autofire'); c.checked = false; c.dispatchEvent(new Event('change', {bubbles:true})); })()");
    await wait(300);
    const shotsOff1 = await evaluate("window.__spaceDefender.controller.state.stats.shots");
    await wait(700);
    const shotsOff2 = await evaluate("window.__spaceDefender.controller.state.stats.shots");
    await evaluate("(() => { const c = document.getElementById('chk-autofire'); c.checked = true; c.dispatchEvent(new Event('change', {bubbles:true})); })()");
    await wait(700);
    const shotsOn = await evaluate("window.__spaceDefender.controller.state.stats.shots");
    check("input: 自动开火关闭后停火、打开后恢复（带对照组）", shotsOff2 === shotsOff1 && shotsOn > shotsOff2, `off:${shotsOff1}->${shotsOff2} on:${shotsOn}`);

    // OVERLOAD：未满不可引爆，满了必须引爆（读真值）
    const early = await evaluate("window.__spaceDefender.controller.intent('overload')");
    check("overload: 未充满时引爆无效", early === null, `action=${JSON.stringify(early)}`);
    await evaluate("window.__spaceDefender.controller.state.overload.charge = 100");
    const fired = await evaluate("window.__spaceDefender.controller.intent('overload')");
    const overloadOn = await evaluate("window.__spaceDefender.controller.state.overload.active > 0");
    check("overload: 充满后可引爆并进入过载", fired === "overload" && overloadOn === true);

    // 暂停：状态必须冻结（终局与暂停都不得被推进）
    await evaluate("document.getElementById('pad-pause').click()");
    await wait(200);
    const pausedA = await evaluate("window.__spaceDefender.controller.state.time");
    await wait(500);
    const pausedB = await evaluate("window.__spaceDefender.controller.state.time");
    const pausePanel = await evaluate("document.getElementById('panel-pause').classList.contains('is-open')");
    check("ui: 暂停冻结战局并弹出暂停面板", pausedA === pausedB && pausePanel === true, `time ${pausedA}->${pausedB}`);
    await evaluate("document.getElementById('btn-resume').click()");
    await wait(300);
    const resumed = await evaluate("window.__spaceDefender.controller.state.time");
    check("ui: 继续后战局恢复推进", resumed > pausedB);

    // 画面 = 状态的函数：只截舷窗（DOM 外壳另有断言），冻结动效后比对像素
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await evaluate("window.__spaceDefender.controller.launch('campaign', 0)");
    await wait(700);
    await evaluate("window.__spaceDefender.controller.pause()");
    const pausedNow = await evaluate("window.__spaceDefender.controller.paused");
    check("render: 渲染比对前战局确已冻结", pausedNow === true);
    await wait(1800); // 让残余粒子与震屏衰减完
    // 直接读画布自身的像素（绕开合成器的亚像素抖动），比对"画面是否为状态的函数"
    const canvasPixels = async () => evaluate("document.getElementById('stage-canvas').toDataURL('image/png')");
    const shotA = await canvasPixels();
    await wait(600);
    const shotB = await canvasPixels();
    await evaluate("window.__spaceDefender.controller.state.player.x = 90");
    await wait(150);
    const shotC = await canvasPixels();
    await evaluate("window.__spaceDefender.controller.state.player.x = 450");
    await wait(150);
    const shotD = await canvasPixels();
    check("render: 冻结状态下画布逐字节稳定（无隐藏动画）", shotA === shotB, `A/B ${shotA === shotB ? "相同" : "不同"} (${shotA.length} vs ${shotB.length} 字节)`);
    check("render: 改变状态后画面随之改变（画面是状态的函数）", shotC !== shotA && shotD !== shotC);

    // 坐标映射：机体像素重心必须落在逻辑坐标 (player.x, PLAYER_Y) 上，杜绝错位/黑边/拉伸
    const measureShip = async () => {
      const raw = await evaluate(`(() => {
        const c = document.getElementById('stage-canvas');
        const ctx = c.getContext('2d');
        const scale = c.width / 540;
        const img = ctx.getImageData(0, 0, c.width, c.height);
        const d = img.data;
        let sx = 0, sy = 0, n = 0;
        for (let y = Math.floor(c.height * 0.86); y < c.height; y += 1) {
          for (let x = 0; x < c.width; x += 1) {
            const i = (y * c.width + x) * 4;
            if (d[i] < 240 && d[i + 1] > 200 && d[i + 2] > 220) { sx += x; sy += y; n += 1; }
          }
        }
        return JSON.stringify({ scale, n, cx: n ? sx / n : -1, cy: n ? sy / n : -1, w: c.width, h: c.height });
      })()`);
      return JSON.parse(raw);
    };
    const shipA = await measureShip();
    await evaluate("window.__spaceDefender.controller.state.player.x = 90");
    await wait(200);
    const shipB = await measureShip();
    const dprX = shipB.scale;
    const near = (a, b, tol) => Math.abs(a - b) <= tol;
    check(
      "render: 机体像素位置与逻辑坐标一致（无错位/黑边/拉伸）",
      shipA.n > 0 &&
        shipB.n > 0 &&
        near(shipA.cx, 450 * dprX, 14) &&
        near(shipB.cx, 90 * dprX, 14) &&
        near(shipA.cy, 634 * dprX, 16) &&
        near(shipB.cy, 634 * dprX, 16),
      `A(cx=${shipA.cx.toFixed(1)},cy=${shipA.cy.toFixed(1)}) B(cx=${shipB.cx.toFixed(1)},cy=${shipB.cy.toFixed(1)}) 期望 x=${(90 * dprX).toFixed(1)} y=${(634 * dprX).toFixed(1)} scale=${dprX.toFixed(2)}`,
    );
    await evaluate("window.__spaceDefender.controller.resume()");
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });

    // 桌面布局：舷窗必须严丝合缝地填满机台框体，且保持 3:4 竖屏比例
    const layout = JSON.parse(
      await evaluate(`(() => {
        const bezel = document.getElementById('crt-bezel');
        const canvas = document.getElementById('stage-canvas');
        const b = bezel.getBoundingClientRect();
        const c = canvas.getBoundingClientRect();
        const bs = getComputedStyle(bezel);
        const arena = document.getElementById('arena').getBoundingClientRect();
        const left = document.getElementById('wing-left').getBoundingClientRect();
        const right = document.getElementById('wing-right').getBoundingClientRect();
        return JSON.stringify({
          bezelInner: b.width - parseFloat(bs.paddingLeft) - parseFloat(bs.paddingRight),
          canvasW: c.width, canvasH: c.height,
          bezelH: b.height, arenaW: arena.width,
          leftRight: left.right, rightLeft: right.left, canvasLeft: c.left, canvasRight: c.right,
          coreW: document.getElementById('stage-core').getBoundingClientRect().width
        });
      })()`),
    );
    check(
      "layout: 舷窗填满机台框体（无空隙暗条）",
      Math.abs(layout.bezelInner - layout.canvasW) <= 2,
      `bezel内宽=${layout.bezelInner.toFixed(1)} canvas宽=${layout.canvasW.toFixed(1)}`,
    );
    check(
      "layout: 竖屏 3:4 比例",
      Math.abs(layout.canvasH / layout.canvasW - 4 / 3) < 0.02,
      `${layout.canvasW.toFixed(0)}x${layout.canvasH.toFixed(0)}`,
    );
    check(
      "layout: 桌面双翼对称包裹主舞台且不重叠",
      layout.leftRight <= layout.canvasLeft + 1 && layout.canvasRight <= layout.rightLeft + 1 && layout.coreW <= 1160,
      `左翼右缘=${layout.leftRight.toFixed(0)} 舞台=${layout.canvasLeft.toFixed(0)}~${layout.canvasRight.toFixed(0)} 右翼左缘=${layout.rightLeft.toFixed(0)} 核心宽=${layout.coreW.toFixed(0)}`,
    );
    check("layout: 桌面视口下舞台高度充分利用", layout.canvasH > 420, `canvas高=${layout.canvasH.toFixed(0)}`);

    // 截图留档：桌面 + 移动
    const desktop = (await send("Page.captureScreenshot", { format: "png" })).data;
    await writeFile(join(SHOTS, "desktop.png"), Buffer.from(desktop, "base64"));

    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await wait(600);
    const mobileMetrics = await evaluate(`JSON.stringify({
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      padBottom: getComputedStyle(document.getElementById('game-app')).paddingBottom,
      deck: getComputedStyle(document.getElementById('control-deck')).display,
      canvasW: document.getElementById('stage-canvas').getBoundingClientRect().width
    })`);
    const m = JSON.parse(mobileMetrics);
    check("mobile: 390px 无横向溢出", m.scrollW <= m.innerW + 1, mobileMetrics);
    check("mobile: 底部广告安全避让 ≥68px", parseFloat(m.padBottom) >= 68, `padding-bottom=${m.padBottom}`);
    check("mobile: 触控操作台可见", m.deck !== "none", `display=${m.deck}`);
    // 滚到页面底部后，操作台仍必须完整落在底部广告安全区之上（常驻可点，不被横幅遮挡）
    await evaluate("window.scrollTo(0, document.documentElement.scrollHeight)");
    await wait(400);
    const deckBox = JSON.parse(
      await evaluate(`(() => {
        const r = document.getElementById('control-deck').getBoundingClientRect();
        return JSON.stringify({ top: r.top, bottom: r.bottom, innerH: window.innerHeight });
      })()`),
    );
    check(
      "mobile: 操作台常驻于底部 68px 安全区之上",
      deckBox.bottom <= deckBox.innerH - 60 && deckBox.top >= 0,
      `deck ${deckBox.top.toFixed(0)}~${deckBox.bottom.toFixed(0)} / 视口高 ${deckBox.innerH}`,
    );
    await evaluate("window.scrollTo(0, 0)");
    await wait(300);
    const mobile = (await send("Page.captureScreenshot", { format: "png" })).data;
    await writeFile(join(SHOTS, "mobile.png"), Buffer.from(mobile, "base64"));

    // 语言切换持久化到 doin.lang 并即时生效
    await evaluate("localStorage.setItem('doin.lang','en'); location.reload()");
    let reloaded = false;
    for (let i = 0; i < 60; i += 1) {
      const has = await evaluate("Boolean(window.__spaceDefender)").catch(() => false);
      if (has) {
        reloaded = true;
        break;
      }
      await wait(250);
    }
    const enLocale = reloaded ? await evaluate("window.__spaceDefender.locale()") : "n/a";
    const enTitle = reloaded ? await evaluate("document.getElementById('app-title-main').textContent") : "n/a";
    check("i18n: 切语言后刷新保持并生效", enLocale === "en" && enTitle === "Space Defender", `${enLocale} / ${enTitle}`);
    await evaluate("localStorage.setItem('doin.lang','zh')");

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
      // Windows 上必须杀进程树，且不要用 CDP Browser.close（会挂起）
      spawn("taskkill", ["/F", "/T", "/PID", String(child.pid)], { stdio: "ignore" });
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n== smoke: ${SLUG} == ${results.length - failed.length} pass, ${failed.length} fail`);
  console.log(`shots -> ${SHOTS}`);
  process.exit(failed.length ? 1 : 0);
}

main();
