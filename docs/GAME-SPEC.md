# DOIN 子游戏交付契约（GAME-SPEC）

> 本文档自包含，供外部开发者或 AI 交付放入 `games/<slug>/` 即可直接上架的纯静态子游戏。
> 职责边界：承接方仅交付 `games/<slug>/` 内文件；门户登记、封面、根测试、构建发布由门户方负责。

---

## 1 · 目录结构与模块分层（T2）

```
games/<slug>/
  index.html          纯语义标记骨架，外链样式与脚本，不含实现代码
  favicon.svg         独立游戏图标
  css/style.css       题材原生视窗与沉浸样式，含移动端与动效降级
  js/engine.mjs       规则唯一权威，纯函数，严格 DOM-free（禁碰 DOM / 存储）
  js/game.mjs         状态控制器，接收 UI 意图调度 engine，DOM-free
  js/ui.mjs           渲染与交互层，唯一碰 DOM / Canvas 的层
  js/storage.mjs      存档唯一口径，Key 统一 doin.<slug>.v1，集中 try/catch 降级内存
  js/i18n.mjs         中英双语表 + 全站共享偏好 localStorage["doin.lang"]
  js/audio.mjs        WebAudio 物理拟真/FM 合成音效（零外部音频文件，拒绝单调蜂鸣器）
  js/main.mjs         装配入口，绑定事件，初始化与热更新全量文本覆盖
  tests/*.test.mjs    原生 node:test 自动化测试（≥3 个文件）
```

---

## 2 · 两级门禁速查表（对齐 check-game.mjs）

### T1 上架底线（任何一项 FAIL 即拒收，exit 1）
| 门禁 ID | 规则要求 | 说明与目的 |
|---|---|---|
| `index-html` | 存在 `index.html` | 构建与开发服务入口 |
| `games-json` | 在 `games.json` 登记且 `url === "/<slug>/"` | 门户方组装时补齐（外部交付可暂缺） |
| `cover` | `assets/covers/<slug>.webp` 640×640 软胶封面 | 门户方组装时补齐（外部交付可暂缺） |
| `v-dev` | 本地所有 script/link 必须带 `?v=dev` | 构建替换为 BUILD_ID 实现缓存失效 |
| `back-home` | 具备 `<a href="/" id="back-home">` | 门户导航闭环 |
| `doin-lang` | 统一读写全站共享 key `doin.lang` | 跨游戏记忆语言，严禁私有 key |
| `no-reload` | 语言切换严禁使用 `location.reload()` | 必须原地热更新文本，严禁刷新页面打断游戏 |
| `storage-guard` | localStorage 必须集中封装在 try/catch 内 | 隐私模式或受限环境静默降级内存，绝不白屏 |
| `tests-min` | `tests/` 目录下 ≥1 个 `*.test.mjs` | 玩法正确性至少有一份自动化验证证据 |
| `tests-root-script`| 根 `package.json` 注册 `test:<slug>` | CI 与本地门禁入口，门户方组装时注册 |

### T2 一致性规范（WARN 项，推荐全绿）
| 门禁 ID | 规范要求 | 收益 |
|---|---|---|
| `structure` | 具备 `js/` 与 `css/` 目录 | 结构统一，易于审阅与长期维护 |
| `module-script` | 入口使用 `<script type="module">` | 测试直接 import 复用纯函数模块 |
| `noscript` / `meta-desc` / `icon-link` / `html-lang` | 兜底提示、SEO 描述、Favicon 与 html lang 属性齐备 | 可访问性与基础体验兜底 |
| `i18n-module` | `js/i18n.mjs` 集中中英双表（键对齐且非空） | 文本集中，避免散落硬编码 |
| `i18n-clean` | `strings.en` 零汉字、JS 源码与配置层零裸写中文、HTML 静态中文声明 `data-i18n` 或动态覆盖 | 杜绝英文模式下夹杂中文残留 |
| `engine-module` | `engine.mjs` 严格纯函数与 DOM-free | 规则纯粹，脱离浏览器即可跑通测试 |
| `reduced-motion` | CSS 包含 `@media (prefers-reduced-motion: reduce)` | 动效降级支持 |
| `tests-dir` | `tests/` 目录覆盖 engine / storage / i18n / markup（≥3 个文件） | 自动化测试完备性 |

---

## 3 · 核心红线与设计约束

1. **题材原生视窗隐喻（严禁同质化模版抄袭）**：
   - **严禁无脑换皮套用“左右双翼对称机台”**！视窗结构必须来自游戏题材本身的物理隐喻（探案档案袋/手账、飞船雷达舷窗、餐厅吧台账簿、复古掌机卡带外壳、方格稿纸蓝图等）；
   - 拒绝三大老套网页病：严禁四角散落浮动按钮（收纳为题材内嵌栏或小托盘）；严禁右侧机械堆叠 SaaS 表单卡片；严禁单调死白/死黑大平铺；
   - 专属按键实体微浮雕（`translateY(2px)` 位移），标记**禁用硬边描边圈**，改用**无边界径向柔光**。
2. **题材专属音色设计（严禁千篇一律蜂鸣器雷同）**：
   - 严禁全平台通篇使用单个正弦波 beep 或固定 C-E-G-C 琶音；
   - 物理撞击必须加入 **噪声缓冲（AudioBuffer noise）+ BiquadFilter 滤波** 产生木块、切纸、金属摩擦碰撞感；
   - 解谜与温润反馈使用 **FM 调频**（马林巴、木琴、编钟）；消除/爆炸使用 **失谐多振荡器（Detuned Oscillators）** 与急促 Pitch Envelope 打出下潜低音与火花感；
   - 每款游戏定制 4~8 种专属音效，严禁直接复制别处旧代码。
3. **语言切换零副作用铁律（严禁打断或重置游戏状态）**：
   - **绝对禁止 `location.reload()`**；
   - **绝对禁止重置正在游玩的游戏局势**：盘面卡牌、下落中方块、当前血量、连击、倒计时必须原样保留；
   - **全量热更新（In-Place Live Update）**：遍历 `[data-i18n]` / `[data-i18n-aria]` 更新文本属性，Canvas 仅在当前帧重绘文本，控制器和引擎状态机绝不重置。
4. **算法健全性与无死局保证（硬性铁律）**：
   - 必须对标经典成熟范式（BFS 求解器、7-Bag、无不动点 Derangement 打乱、欧拉路径）；
   - 随机逻辑支持 PRNG 种子（`mulberry32`）；单测必须包含 **≥1000 步随机游走测试**，断言不抛错、不卡死。
5. **纯净语言铁律（硬性红线：严禁英文界面夹杂中文）**：
   - `strings.en` 英文表绝无汉字（白名单 `langSwitch` 除外）；
   - 关卡数据（`levels.mjs`）、道具表（`data.mjs`）或逻辑代码严禁裸写中文字符串；
   - `index.html` 中的汉字标签必须附带 `data-i18n` 属性，或在 JS 中通过 ID 明确替换；英文界面下绝对零汉字残留。
6. **移动端触控与广告安全避让区（强制红线）**：
   - 操作画布声明 `touch-action: none;` 与 `overscroll-behavior: none;` 拦截滚动与下拉刷新；
   - **桌面端（≥900px）**：左右边缘与底部留白，核心舞台居中（防侧栏广告重叠）；
   - **移动端（≤768px）**：底部严禁贴底放置按键，主容器底部留足广告避让缓冲（`padding-bottom: max(68px, calc(16px + env(safe-area-inset-bottom)))`）。
7. **渲染策略与立体质感（CSS 3D 优先 vs Three.js 极少数准入）**：
   - **95% 场景立体质感优先**：绝大多数桌面质感无需 Heavy 3D 引擎。优先采用语义 DOM + CSS 3D（`perspective`、`transform: rotateX/Y translateZ`、实体阴影）或 Canvas 2D 拟真光影。零加载等待、零打包体积、120fps 秒开且零发热；
   - **极少数（<5%）真 3D 玩法创新窗口**：对于天然依赖真三维立体空间变换（如魔方翻转、3D 滚木块 Bloxorz、3D 倾斜迷宫）或特定视觉突破品类，允许在适当的时候探索引入 Three.js，以丰富网站类型与视觉多样性；
   - **Three.js 准入三条硬性红线（违反直接拒收）**：
     - *零外部模型/纹理文件*：严禁引入 `.gltf`、`.obj`、`.bin` 等外部 3D 文件或图片贴图，所有网格一律代码生成基础几何体（`BoxGeometry`、`SphereGeometry` 等）+ 程序化纯色/渐变材质；
     - *轻量开销与低发热*：仅限低开销轻量材质（`MeshLambertMaterial` / `MeshBasicMaterial`），严禁开启多重动态阴影（ShadowMap）与重度后期处理（Post-processing），确保移动端满帧且不发烫；
     - *纯粹舞台隔离*：Canvas 仅作底层 3D 视窗，所有 HUD、得分、操作按键、多语言切换与弹窗说明必须严格留在语义化 DOM 层，遵循全量 i18n 与原地热更新契约。
8. **系统底线**：
   - 源码内一律用相对路径，严禁绝对路径（唯一例外是 `<a href="/" id="back-home">`）；
   - 零外部网络依赖：零 CDN、零外链音视频、仅用系统字体；
   - 严禁使用 `alert()` 报错；合法操作必须执行，终局操作为 no-op。

---

## 4 · 标准实现骨架参考

### 4.1 HTML 标记骨架（`index.html`）
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>游戏名 · DOIN 在线小游戏</title>
  <meta name="description" content="一句话玩法与核心亮点。">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="css/style.css?v=dev">
</head>
<body>
  <div id="game-app">
    <!-- 机顶内嵌紧凑控制栏（拒绝四角散落） -->
    <header id="stage-bar">
      <a href="/" id="back-home" class="bar-btn" data-i18n="backHome">← 门户</a>
      <h1 id="stage-title" data-i18n="appTitle">游戏名</h1>
      <div class="stage-actions">
        <button id="btn-sound" class="bar-btn" type="button" aria-label="音效">🔊</button>
        <button id="btn-lang" class="bar-btn" type="button">EN</button>
        <button id="btn-help" class="bar-btn" type="button" aria-label="玩法说明">?</button>
      </div>
    </header>

    <!-- 题材原生游戏视窗核心 -->
    <main id="stage-core">
      <!-- 契合题材隐喻的专属游戏视窗与道具台 -->
    </main>
  </div>
  <noscript><p>需要启用 JavaScript 才能游玩。</p></noscript>
  <script type="module" src="js/main.mjs?v=dev"></script>
</body>
</html>
```

### 4.2 语言切换热更新（绝不刷新页面）
```js
export function applyLocale(locale) {
  saveLocale(locale);
  const t = strings[locale] || strings.zh;
  document.documentElement.lang = htmlLang(locale);
  document.title = t.docTitle || t.appTitle;

  // 1. DOM 声明式热更新
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (t[key] !== undefined) el.textContent = t[key];
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria");
    if (t[key] !== undefined) el.setAttribute("aria-label", t[key]);
  });

  // 2. 切换按钮自身文本
  const langBtn = document.getElementById("btn-lang");
  if (langBtn) langBtn.textContent = locale === "en" ? "中文" : "EN";

  // 3. 当前帧重新绘制（仅刷文字，绝不重置游戏状态）
  if (typeof renderCurrentFrame === "function") {
    renderCurrentFrame();
  }
}
```

### 4.3 存储降级内存回退（`js/storage.mjs`）
```js
let backend;
function storage() {
  if (backend) return backend;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("__probe__", "1");
      localStorage.removeItem("__probe__");
      backend = localStorage;
      return backend;
    }
  } catch { /* 隐私模式或存储受限静默降级 */ }
  const map = new Map();
  backend = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
  return backend;
}
```

---

## 5 · 原生测试规范（`tests/*.test.mjs`）

- 使用 Node 22 原生 `node:test`，按显式文件列出；
- 必须覆盖四类核心契约：
  1. `engine.test.mjs`：规则纯函数、无死局保证、1000 步随机游走不变式；
  2. `storage.test.mjs`：坏数据归一化、降级内存回退、往返读写一致；
  3. `i18n.test.mjs`：双表键对齐且非空、**`strings.en` 绝无汉字**、运行源码零未封装中文；
  4. `markup.test.mjs`：`?v=dev` 占位、`#back-home` 链接、DOM 与 JS 引用双向闭合。

---

## 6 · 交付核对清单（Checklist）

外部开发者交付前逐项核对：
1. **完整交付**：各文件给出完整可运行代码，严禁省略或 `...` 占位；
2. **纯净语言与热更新**：英文模式下界面 100% 纯英文，无任何汉字残留；切换语言**严禁 `location.reload()`**，必须热更新且不影响游戏进行态；
3. **音色专属**：包含契合题材的物理/FM WebAudio 合成，杜绝千篇一律单音振荡器；
4. **题材原生美学**：界面具备独特的题材视窗隐喻，严禁无脑照搬左右双翼模板；
5. **安全避让**：移动端底部预留 `≥68px` 安全距离，画布声明 `touch-action: none;`；
6. **零外链**：零 CDN、零外链字体音视频，资源附加 `?v=dev`；
7. **门禁自测**：通过 `node scripts/check-game.mjs <slug>` 校验（T1 零 fail，T2 零 warn）。
