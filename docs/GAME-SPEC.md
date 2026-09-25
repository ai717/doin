# DOIN 子游戏交付契约（GAME-SPEC）

> 本文档**自包含**：外部开发者或 AI 只需本文即可交付"放进 `games/` 就能直接用"的子游戏。
>
> **职责边界**：你只产出 `games/<slug>/` 目录内的文件（纯静态、零依赖、零构建）。
> `games.json` 登记、封面图、根 `package.json` 的 `test:<slug>`、构建与部署都由门户方负责
> （见 §6、§7B）。
>
> 若你没有运行环境（例如网页对话 AI，跑不了 node 也开不了浏览器），按 §7A 的人工自查清单
> 交付即可，**不要**因为无法执行脚本或测试就省略代码或写占位实现。机器验收
> `node scripts/check-game.mjs <slug>` 由门户方在把你的文件组装成目录之后执行。

## 0 · 三十秒概览

- DOIN 是静态浏览器游戏门户：首页 `index.html` 只列游戏不含实现；`games.json` 是唯一游戏清单。
- 每款游戏 = `games/<slug>/` 独立目录。**Slug 命名契约（极简原则）**：优先使用**单个简短纯英文单词**（如 `sudoku`、`klotski`、`jigsaw`、`zuma`、`freecell`、`gomoku`、`sokoban`），避免繁琐冗长的 `****-****` 连字符；仅在单一词汇严重歧义或专有名词时才按需选用双词连字符（kebab-case）。本地路径 `/games/<slug>/`，生产路径 `/<slug>/`（构建时扁平化），**代码内一律相对路径**，两套路径绝不能混用。
- 首选**零依赖 plain 静态游戏**（无 package.json）。确需构建框架时才加 package.json +
  `build` 脚本，且产物 base / router base 必须设为 `/<slug>/`。
- 视觉风格自由（门户主题只约束首页）；工程约定分两级：T1 上架底线、T2 一致性建议（见 §2）。

## 1 · 目录结构（推荐形状，T2）

下面是存量游戏的统一形状，照做最省事；T1 底线并不强制目录名与分层数量。

```
games/<slug>/
  index.html          标记_only：外链 css/js，不含实现代码
  favicon.svg
  css/style.css
  js/engine.mjs       规则唯一权威，DOM-free（不碰 document/window/localStorage）
  js/storage.mjs      存档唯一口径，localStorage 不可用静默降级内存
  js/i18n.mjs         中英双表 + 全站统一语言 API
  js/main.mjs         装配：入口 module，绑定事件、启动循环
  js/<其它>.mjs       score / audio / render / game / ui 按需分层
  tests/*.test.mjs    node:test 门禁（≥3 个文件）
```

分层职责：`engine` 纯函数判合法性；`game` DOM-free 控制器收 UI 意图调 engine；
`ui`/`main` 是唯一碰 DOM 的地方；`score`/`storage` 是唯一计分/存档口径，UI 不许自己算。

## 2 · 两级门禁（id 与 check-game 输出一致）

**T1 = 上架底线**：任何一条 FAIL 即拒收（exit 1）。它们保证"放进 games/ 就能用、且不破坏全站"。

| id | 要求 | 为什么 |
| --- | --- | --- |
| index-html | 存在 `index.html` | 构建与 dev server 的入口约定 |
| games-json | 在 `games.json` 登记，字段齐（title/slug/desc/icon/cover/tags/url），`url === "/<slug>/"` | 未登记 = 不构建、不上首页、不进 sitemap |
| cover | `assets/covers/<slug>.webp`，640×640，且 games.json cover 指向它 | 首页卡片 1:1 封面 |
| v-dev | 所有本地 script/link 带 `?v=dev` | 生产构建替换为 BUILD_ID 做缓存失效，否则修 bug 后老访客仍是旧 JS |
| back-home | 有 `<a href="/">` 返回首页 | 门户导航闭环 |
| doin-lang | 语言偏好读写全站共享 key `doin.lang` | 跨游戏记住用户选择；私有 key 会让切换语言在下一款游戏失效 |
| storage-guard | 用到 localStorage 就必须集中在一处且带 try/catch 降级 | 隐私模式/存储被禁不得白屏 |
| tests-min | `tests/` 下 ≥1 个 `*.test.mjs` | 玩法正确性至少有一份机器证据 |
| tests-root-script | 根 package.json 注册 `test:<slug>` | CI 与本地统一门禁入口 |

> `games-json` / `cover` / `tests-root-script` 这三项属于门户方上架时补的物料（§6、§7B）。
> 外部开发者交付时它们必然 FAIL，是预期结果——**不要**为了凑绿去动 `games/` 以外的文件。

**T2 = 一致性建议**：不合规只打印 WARN，不拦交付；内部新游戏仍建议全绿，让各款游戏保持架构规范一致。

| id | 建议 | 收益 |
| --- | --- | --- |
| structure | `js/` 与 `css/` 目录 | 与存量一致，好审阅 |
| module-script | 入口 `<script type="module">` | 测试能直接 import 复用核心代码 |
| noscript / meta-desc / icon-link / html-lang | 无 JS 兜底、SEO、favicon、lang 属性 | 体验与可访问性细节 |
| i18n-module | `js/i18n.mjs` 集中中英双表（键对齐非空） | 文案不散落 |
| i18n-clean | 英文词典 `strings.en` 绝无汉字，且 JS 源码零未封装硬编码中文 | 保证英文模式纯净，杜绝英文版夹杂中文 |
| engine-module | `js/engine.mjs` 承载纯规则，不碰 document/window/localStorage | 规则可被 node:test 直接验证 |
| reduced-motion | 动效带 `prefers-reduced-motion` 降级 | 动效可降级 |
| tests-dir | tests/ 覆盖 engine / storage / i18n / markup（≥3 文件） | 门禁厚度 |

## 3 · 禁止与红线

- **严禁闭门造车脑补规则**：开发前必须对标经典成熟规则与算法；严禁未经数学可解性检验的纯随机生成（杜绝死局）。
- **严禁粗糙死板的纯单列网页表单化 UI**：桌面端（≥900px）禁止简陋居中单列拉伸，必须设计舒展的双栏或宽屏沉浸游戏舞台与游戏化 HUD。
- 页面/渲染层直接改规则状态或自建 rule action（规则只在 engine；UI 只发"意图"）。
- 裸读裸写 localStorage（必须走 storage.mjs；读到的任何值都要 normalize，坏值回默认）。
- 私有语言偏好 key（如 `xxx_lang`）——必须 `doin.lang`。
- **严禁英文环境界面夹杂中文（硬性红线）**：
  - 英文模式下，网页标题、返回键、所有按钮、HUD 徽章、关卡/道具名称、AI 等级、说明弹窗、Canvas 绘制文字绝对严禁出现任何汉字（`[\u4e00-\u9fa5]`）；
  - 严禁在关卡数据（`levels.mjs`）、道具表（`data.mjs`）、AI 称号或 UI 逻辑中硬编码中文字符串，所有文本必须由 `i18n.mjs` 统一管理并动态映射；
  - `strings.en` 英文词典除切换按钮自身标识外绝无汉字。
- 代码内绝对路径（`/games/...` 或 `/slug/...`）。
- 提交 `dist/`、`node_modules/`、构建产物。
- `alert()` 做游戏内反馈（用页面内 toast/浮层；`confirm()` 仅限重置存档这类破坏性操作）。
- 加载 webfont（只用系统字体栈）。
- 合法用户操作抛错或静默吞掉：意图无效时返回"没生效"（如 `action === null`），不抛异常。

## 3.1 · 算法健全性与成熟规则对标（硬性要求）

1. **经典对标**：绝大多数小游戏均有成熟的经典范式（如三消下落、7-Bag 俄罗斯方块、扫雷无猜、华容道 BFS、接龙花色递降）。必须严密对标其状态流转、容错和手感，不可凭空乱造规则。
2. **数学可解性保证**：凡涉及关卡生成、随机发牌、拼图打乱，必须包含可解性保证（如求解器预检、欧拉路径生成、无不动点 Derangement 打乱），严禁随机生成不可通关的死局。
3. **确定性单测与随机游走**：随机数必须支持注入确定性种子 PRNG；单元测试中必须包含至少 1000 步的随机游走测试，验证任意合法分支不抛错、不卡死。

## 3.2 · 桌面端 UI 游戏美学（硬性红线：严禁老套网页化）

1. **严禁四角散落浮动按钮**：绝不允许左上角贴返回、右上角孤零零挂音效/语言胶囊、屏幕中间留大片苍白背景。返回、音效、语言、规则说明必须收纳为**游戏机顶边内嵌状态条，或主舞台边框上的精致小托盘/小挂件**，视线紧凑统一。
2. **严禁右侧机械卡片视窗集群**：绝不允许在主游戏右侧垂直堆叠一连串生硬的白底/灰底卡片（模式卡片、分数卡片、预览卡片、按钮卡片），严禁做成“SaaS 仪表盘或网页表单”。
3. **一体化游戏机台/沉浸舞台**：
   - 竖屏类核心（如下落合成、弹珠）：做成一体化掌机或街机框体，HUD 分布在机顶或框体两翼，操作按钮嵌入控制台面板；
   - 横屏/宽屏类核心：主舞台居中，两侧翅膀对称分布徽章与得分，整体包裹在协调的主题光晕与场景中。
4. **游戏化实体控件质感**：按钮具备实体微浮雕与按下物理下沉位移（`translateY(2px)`），数字跳动附带弹性冲击动画（bump），通关具备星级点亮或粒子爆发的仪式感。

## 3.3 · 移动端触控与防误触规范（硬性红线）

1. **严禁划屏拖动整个网页**：
   - 核心操作画布或棋盘区域**必须声明 `touch-action: none;`**，明确拦截浏览器默认滚动；
   - 游戏页面容器设置 `overscroll-behavior: none;`，彻底禁用浏览器的下拉刷新与橡皮筋弹跳。
2. **专属移动端控制器（避免盲目全屏滑）**：
   - 方向/高频操作类游戏（如贪吃蛇、俄罗斯方块、推箱子）：在移动端（≤768px）视口下方必须配备舒展的**实体触控按钮台（十字方向键、旋转键、硬降键，高度≥44px）**，避免手指滑屏遮挡视线或连续转向失败；
   - 滑动手势游戏（如 2048、滑块）：必须设置最小划动阈值（如 ≥30px），并在下方提供小方向键作为点按兜底；
   - 点选类游戏（如连连看、水排序）：触控热区必须 ≥ 44×44px，支持“点击即选、再点即放”，严禁长按或微小目标误触。

## 3.4 · 广告位布局安全避让区规范（硬性红线：预留未来广告位）

为了平台后续商业化广告变现（目前广告默认关闭，但全站布局必须提前做好物理避让）：
1. **桌面端（≥900px）左右侧与底部安全留白**：
   - **严禁将操作按钮贴在浏览器最左侧、最右侧或最底部边缘**；
   - 游戏主体舞台必须保持在安全中轴区域（通常宽度在 `800px ~ 1160px` 之间居中），左右两侧与底部必须留有自然边距，为桌面端未来的左右侧边栏广告位留出缓冲，绝不能与游戏功能按键产生物理重叠。
2. **移动端（≤768px）底部广告安全避让区**：
   - **移动设备未来只加载底部横幅广告（Banner）**；
   - **严禁把操作按钮或关卡/重开/发射键贴在屏幕最底部**；
   - 所有游戏主容器在移动端必须配置底部安全避让间距（`padding-bottom: max(68px, calc(16px + env(safe-area-inset-bottom)))` 左右），确保未来一旦底部横幅广告弹出，**绝对不会遮挡住游戏的任何操作按键或 HUD 信息**。

## 4 · 骨架照抄

`index.html` 推荐结构骨架（杜绝四角散落，一体化舞台收纳）：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>游戏名 · DOIN 在线小游戏</title>
  <meta name="description" content="一句话玩法 + 特色。">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="css/style.css?v=dev">
</head>
<body>
  <div id="game-app">
    <!-- 顶边一体化紧凑控制栏（拒绝四角散落） -->
    <header id="stage-bar">
      <a href="/" id="back-home" class="bar-btn">← 门户</a>
      <h1 id="stage-title">游戏名</h1>
      <div class="stage-actions">
        <button id="btn-sound" class="bar-btn" aria-label="音效">🔊</button>
        <button id="btn-lang" class="bar-btn" aria-label="语言">EN</button>
        <button id="btn-help" class="bar-btn" aria-label="玩法说明">?</button>
      </div>
    </header>

    <!-- 游戏机台/主舞台核心 -->
    <main id="stage-core">
      <!-- 游戏主舞台与专属实体控制台，严禁堆叠 SaaS 卡片集群 -->
    </main>
  </div>
  <noscript><p>需要启用 JavaScript 才能游玩。</p></noscript>
  <script type="module" src="js/main.mjs?v=dev"></script>
</body>
</html>
```

storage 降级与防抛错（照抄形状）：

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
  } catch { /* 隐私模式或存储被禁用 */ }
  const map = new Map();
  backend = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
  return backend;
}
```

**存档 key 命名**：统一 `doin.<slug>.v1`（需要分域时用 `doin.<slug>.<域>.v1`，
如 orbit-sort 的 `doin.orbit-sort.progress.v1`）。禁止自造前缀（`tetris_neo_state_*`
这类私有命名是反例）——统一前缀才能整站排查、清理与迁移存档。

i18n API 形状（与存量游戏同构，键名一致）：
`LOCALES / LANG_KEY="doin.lang" / DEFAULT_LOCALE / isLocale / strings / format /
detectLocale / loadLocale / saveLocale / htmlLang`。切换语言 = `saveLocale(locale)` 后
`location.reload()`（或全量重渲染）。

## 5 · 测试要求

- 你只需写出 `tests/*.test.mjs` 本身，按 `node --test` **显式列文件**的形式组织
  （Node 22 不给目录递归）；根 package.json 的 `test:<slug>` 由门户方注册。
- 最少四类：engine 纯函数用例；storage normalize/降级用例；i18n 中英键对齐与**纯净英文（`strings.en` 绝无汉字且 JS 源码零未封装中文）**用例；
  markup 装配契约用例（index.html 的 id 与 main 的引用表互相闭合、`?v=dev` 在位、
  移动端与 reduced-motion 样式在位）。
- 有随机性的生成/发牌逻辑必须支持注入 `rng`，测试里用固定种子。
- 不变量写进测试：**合法操作永不报错**；终止态上的操作是 no-op 而非异常。

## 6 · 上架物料（门户方负责，外部开发者可跳过）

- `games.json` 追加：`title, slug, desc, icon(emoji), cover, tags(2-3), url, en.title`。
- 封面：640×640 WebP，放 `assets/covers/<slug>.webp`。**风格硬约束**（门户内完整规范见
  `docs/COVER-STYLE.md`，外发时以本条为准）：
  - 3D 软胶 / 黏土质感（soft 3D clay、glossy toy-plastic），**禁止**扁平矢量、像素、
    写实渲染、线框霓虹；
  - 单一居中主体，约占画面 60%–75%；**禁止**并列拼贴、游戏 UI 截图；
  - 背景为平滑的单色系彩色渐变，整体偏亮；**禁止**纯白、纯黑、暗黑霓虹；
  - 散布少量漂浮粒子 / 火花点缀；
  - **禁止任何文字**（标题、字母、数字、logo、UI 角标），水印也必须清干净。
- 登记后跑 `npm run build` 确认 `dist/<slug>/` 产出、sitemap 收录。

## 7 · 交付与验收

> **协作边界**：外部网页 AI 只负责生成 `games/<slug>/`；门户方负责把目录落盘、验收、
> 登记清单、生成封面、注册根测试、构建与发布。不要让外部 AI 修改门户文件或自行部署。

### 7A · 外部开发者自查清单（不需要运行环境）

交付前逐条核对。没有运行环境时这是唯一的质量关口——请**读代码核对**，别凭印象打勾：

1. 逐文件给**完整内容**（每个文件前写明相对路径），不用 `...` / "同上" / 只给 diff。
2. 所有 `import` 的相对路径与文件名真实存在，无循环依赖。
3. JS 里引用的每个 `id` 在 `index.html` 中都存在，装配表双向闭合。
4. 本地 script/link 全部带 `?v=dev`；零 CDN、零外链字体、零外链图片、零 npm 依赖。
5. 语言偏好读写 `doin.lang`；中英双表键完全对齐且非空；**`strings.en` 英文表除语言切换自身提示外绝无任何汉字**；关卡/道具/AI 等数据层无硬编码中文字符串；英文环境下加载时界面无任何中文残留。
6. localStorage 集中一处封装并包 try/catch；读到的每个值都 normalize，坏值回默认；
   存档 key 用 `doin.<slug>.v1`，不自造前缀。
7. 有 `<a href="/">` 返回首页、`<noscript>` 兜底，动效带 `prefers-reduced-motion` 降级。
8. `tests/` 下 ≥3 个 `*.test.mjs`（engine / storage / i18n / markup），按 `node --test`
   显式列文件的形式书写；有随机性的生成/发牌逻辑可注入 `rng`。
9. 通读终止态与边界：合法操作永不抛错；终止态上的操作是 no-op 而非异常。
10. 桌面与 390px 宽两种视口都不溢出（读 CSS 判断，别只写桌面样式）。

### 7B · 门户方验收流程（组装后按序）

1. 把交付文件落盘成 `games/<slug>/` → `node scripts/check-game.mjs <slug>`：
   T1 必须零 fail，T2 的 WARN 顺手能清就清。
2. 人工读代码找脚本查不出的逻辑缺陷（状态自锁导致操作无效、偏好未校验会崩等）。
3. 补 §6 上架物料 + 根 `package.json` 的 `test:<slug>` → `npm run test:<slug>` 全绿。
4. `npm run build` → 确认 `dist/<slug>/` 产出、sitemap 收录。
5. `node _dev-server.mjs` 起本地服务，手测 `/games/<slug>/`：桌面 + 390px 宽 +
   开关系统"减少动效"各一遍；语言切换后刷新仍保持。
6. 更新 `PROJECT_LOG.md`；commit 用英文 conventional 前缀（feat/fix/docs/chore）。

## 8 · 存量豁免

`scripts/check-game.mjs` 内置 `LEGACY_WAIVERS` 表，仅覆盖早于本契约上架的存量游戏
（orbit-sort / 2048 / sudoku），输出里打印为 `WAIVED` 及原因。**新 slug 零豁免**；
要新增豁免必须改脚本并在 commit 里说明原因，保证豁免始终可见、可审计。
T2 不合规对任何游戏都只打印 WARN，与豁免无关。
