# PROJECT_LOG.md

精简原则：顶部为当前基线快照，仅保留下次开工必读的事实；历史开发细节压缩到
Archive，不再逐轮罗列验证命令与测试计数。详细记录见 git 历史与
`.workbuddy/memory/2026-09-02.md`。

## Current status · 2026-09-03

### 门户首页改版 · Poki 风格

只动仓库根的 `index.html` / `css/style.css` / `js/main.js` / `games.json` / `assets/`，
`games/orbit-sort/` 下那批未 commit 的 UI 打磨与本轮无关，两者不冲突。

#### 结论
- 首页整体重做为 poki.com 风格：薄荷绿底 + 菱形纹理、白色浮动 logo 卡、1:1 方形封面瓦片网格。
  旧像素主题（#0b0b1a / Press Start 2P / 扫描线）全部移除，不再加载任何 webfont。
- 用户明确要求：不分类、卡片只有封面、封面不做 Poki 的视频切换动画，但 hover 触效要一致。

#### 关键数值（浏览器实测 poki.com 得出，非估算）
- 配色 `--bg #83ffe7` / `--ink #002b50` / `--accent #009cff` / 白面 / `--radius 16px` / `--gap 16px`。
- 阴影：瓦片 `0 7px 10px 4px rgba(93,107,132,.3)`，小卡 `0 3px 5px 3px rgba(93,107,132,.2)`。
- hover `scale(1.04) translateY(-4px)`（实测 `matrix(1.04,0,0,1.04,0,-4.16)`）；
  静止过渡 0.6s、hover 时覆盖为 0.3s，同为 `cubic-bezier(0.25,0.1,0.25,1)` —— 进快出慢是刻意的。
- 网格 `auto-fill minmax(204px,1fr)`，520px 以下降 140px。Poki 原站是 94px 基础格 +
  瓦片跨 2×2/3×3 的 masonry；本站只 3 款游戏，等大方格更合适。
- 卡片 `container-type: inline-size`，标题 `clamp(12px, 8cqi, 22px)` 随瓦片缩放。

#### 与 Poki 的三处有意偏离
1. 标题加了渐变遮罩 + text-shadow。Poki 标题实测 `background-image: none`，
   但本站 AI 封面下半部偏亮（数独是浅薄荷），白字会糊掉。
2. 导航用文档流而非 `position: fixed`。固定侧栏会与本站 1024px 内容列打架，而用户只要 logo 卡片。
3. `container-type` 创建层叠上下文，hover 卡片必须显式 `z-index` 才盖得住后面的兄弟。

#### 封面流水线
- 三张封面重做为 640×640 WebP（`assets/covers/<slug>.webp`，23/16/19KB），
  `games.json` 的 `cover` 全部改指 `.webp`。
- AI 生成图右下角带水印，`x/cover-draft/strip-watermark.py` 负责去除：中值滤波估背景 →
  严格阈值(13)定位紧包围盒 → 只在盒内(外扩 12px)用宽松阈值(5)挖洞 → 拉普拉斯扩散迭代填补。
  **两段式是必须的**：只用宽松阈值会把 2048 的漂浮方块和星轨的轨道环一起判成水印
  （洞面积达 15.3% / 8.9%）。
- 验收用客观指标而非肉眼：补丁框内拉普拉斯能量 7.3/5.7/5.3，对照镜像区 6.0/6.0/5.7，
  无法区分；框外像素逐字节相同（max-diff = 0）。

#### 删除
- `assets/covers/sudoku.png`、`2048.png`、`orbit-sort.svg`（被方形 WebP 取代）。
- `scripts/make-sudoku-cover.py`：唯一产物就是上面那张 630×500 PNG，全仓无引用，
  留着会和新 1:1 约定冲突。需要时从 git 历史取回。

#### 验证
- `npm run build` 通过；`dist/` 已确认含 `assets/bg-diamante.svg` 与三张 `.webp`，
  `index.html` 的 `theme-color` 为 `#83ffe7`，无 scanlines / Press Start 残留。
- **未做浏览器截图验收**（按用户既定偏好）；预览走 `start.bat`，端口在 46810 附近自动选空闲。

#### 待办
1. 首页改版与 orbit-sort UI 打磨均**尚未 commit**，应拆成两笔。
2. `assets/og-image.png` 仍是旧像素风 1200×630，与新首页观感不一致（社交分享图，非阻塞）。
3. 只有 3 款游戏时方格网略空；游戏变多后可考虑 Poki 的大小瓦片混排。

***

## 2026-09-02

### 星轨调度大师 orbit-sort · 稳定版 + 游戏感打磨

#### 发布基线（stabilization）
- 主线只暴露第 1–6 关（`stabilize-alpha`…`stabilize-zeta`）；第 7–30 关（冻结 /
  单向轨道两章）保留为 `levels.mjs` 源码素材，**不导出、不进运行路径**。
- 引擎 `engine.mjs` 是唯一规则权威：`validateAction`/`applyAction`/`applyIntent`。
  合法必执行、死局只提示不拦截、仅 `won` 终止。`game.mjs` 收 UI 意图并委托引擎；
  页面不得自行拼动作或直接改状态（镜像 `state` 与 `game.state` 分离会丢改动）。
- 资源版本统一：源码 `?v=dev` 占位符，生产构建替换为单一 `BUILD_ID`（覆盖 Worker
  URL 与 Worker 内部 import）。`test:orbit-sort` 为部署前 CI 门禁。
- 死局首步为审计指标 `deadEndFirstMoves`：L2=2、L4=1，默认不拦截；`maxDeadEndFirstMoves`
  仅在发布显式要求时用。

#### 本轮 UI 打磨（game feel，纯增量，未改引擎/规则）
- 轨道空位改虚线座位环 `track-seat`，与星球落位对齐，容量剩余一眼可见。
- 轨道/中转槽按压态、桌面 hover 反馈。
- 状态栏 tone 化（good/warn/bad）+ 入场动画；合法/完成/死局/非法文案分级不再混淆。
- 头部计数跳动、结算星级错峰弹出、章节进度条、关卡节点错峰进场。
- 完成特效升级为 10 粒放射粒子。
- `main.mjs`：`message(text, tone)`、`haptic()`（`navigator.vibrate`）、`bump()`、
  `renderStars()`、`renderSelect` 章节进度条，在取出/落下/完成/通关/非法/撤销/重置处接入。
- 全部 `prefers-reduced-motion` 降级。

#### 修改文件（本轮）
- UI 打磨（未 commit）：`css/style.css`、`index.html`、`js/renderer.mjs`、`js/main.mjs`
- 已提交（4 笔 a3cf8e9/3a41a5f/a7e8ae8/4052506）：游戏本体 26 文件 + 封面 + `games.json`；
  `scripts/build-site.mjs`、`package.json`、`.github/workflows/deploy.yml`；`AGENTS.md`、
  `PROJECT_LOG.md`；`.gitignore`（增 `.workbuddy/`、`x/`）。
- 修复类：`js/game.mjs`（`useHint`）、`js/daily.mjs`（版本占位符）、`tests/markup.test.mjs`
  （遍历 `js/` 断言每条 import 带 `?v=dev`）、`games.json`（`exclude: ["generator.mjs"]`）。

#### 关键实现
- 提示计数丢失根因：`main.mjs` 镜像 `state` 与 `game.state` 分离，每次 `dispatch` 覆盖。
  修复 = 计数走 `game.useHint()`；今后改状态一律走 `game.dispatch/setState/useHint/undo/reset`。
- 版本占位符：构建脚本正则替换所有 `?v=dev` 为单一 `BUILD_ID`，含 Worker 运行时字符串，
  否则改模块/关卡浏览器仍跑缓存旧码。
- tone 状态栏：纯 CSS class + 动画，文案分级由 `message(text, tone)` 控制。

#### 验证
- `npm run test:orbit-sort`：52/0 稳定（两次连续）；`node --check` 通过；
  `npm run build` 通过；`git diff --check` 通过。

#### 待办（已知、非 bug）
1. 第 5 步联动测试仍只覆盖 3/7（无 DOM）：缺合法同色移动、异色拒绝、撤销后继续、
   提示文案与引擎原因一致。
2. advisory 快速路径未做（solver 求最优解，L6 每步约 2s）；改"找到任意解即返回"可快一个量级。
3. 第 7–30 关未激活（产品范围，非技术债）。
4. **UI 打磨改动尚未 commit**——已验证通过，待整理成 `feat: polish orbit-sort game feel`。

***

## Archive

### 2026-09-01 之前 · V1 30 关开发史（已废弃，仅供追溯）
- 《星轨调度大师》原按 30 关三章 + 冻结/单向轨道开发，含求解器、生成器、选关星图、
  每日挑战、提示 Worker、存档、音效、SVG 棋盘全套。
- 2026-09-02 被"六关稳定版"基线取代：30 关数据保留为素材，运行时只暴露 6 关。

### nuts 子游戏（已下线）
- 已从 `games.json` 与 `games/nuts/` 移除，构建不再生成 `/nuts/`。其通关判定 bug 修复
  与 2D 正交视觉重构不再适用于当前仓库。

### 2048（已上线 `doin.win/2048/`）
- 零依赖纯静态（原生 ES modules + CSS + WebAudio），可离线；4×4、撤销、主题、中英、
  键盘/触屏、本机存档、48 项测试通过。详见 git 历史，本日志不重复展开。

### 平台已知约束（与 AGENTS.md 重复，备忘）
- 本地路径 `/games/<slug>/`，生产 `/<slug>/`，勿混用。
- GitHub Pages 对 SPA 深链返回 404，已排除 sitemap；部署仍用 checkout@v4/setup-node@v4，
  待窗口升级到 Node 24 兼容大版本（非阻塞）。
