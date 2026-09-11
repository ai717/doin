# PROJECT_LOG.md

> 精简原则：只留状态快照 + 最近一轮要点。细节查 git log / `.workbuddy/memory/`。
> 游戏稳定规则写在 AGENTS.md（§5 orbit-sort / §6 tic-tac-toe / §7 homepage / §8 minesweeper /
> §9 gold-miner / §10 klotski / §11 jigsaw），本文件不重复。

***

## Current Baseline (2026-09-11)

- **门户**：薄荷渐变首页（`index.html` + `css/`），640×640 WebP 封面（3D 风格统一），
  白色胶囊卡片标签 + hover 放大；品牌行「Doin.win 字标 ←→ 地球语言按钮」+ 二级主标题；
  中英双语（`doin.lang` 全站共享偏好）。CNAME `doin.win`。共 15 款游戏上架（新增 Jigsaw）。
- **Jigsaw**（新增）：拼图，50 关（3×3 → 4×4 → 5×5）+ 今日拼图，交换碎片复原图案。
  每关一张程序化生成的抽象艺术图（同 seed 同图，零图库零版权），Canvas 渲染 + 桌面双栏 UI。
  稳定基线固化在 AGENTS.md §11。
- **Klotski**：华容道滑块解谜，50 关递进，Canvas 渲染 + 桌面双栏游戏化 UI。
  稳定基线固化在 AGENTS.md §10。已推送部署上线 `doin.win/klotski/`。
- **Sudoku / 2048 / Tic-Tac-Toe / Minesweeper / Orbit-Sort / Gold-Miner / Tetris-Neo /
  FreeCell / Snake-Orchard / Zuma / Gravity-Echoes / Tile-Matching / One-Line**：均稳定。
  规则见 AGENTS.md 对应章节。
- **i18n**：全站游戏均支持 `doin.lang` 共享偏好。
- **交付契约**：`docs/GAME-SPEC.md` + `scripts/check-game.mjs`（T1 fail / T2 warn 两级）。
- **本地服务**：`node _dev-server.mjs`（零依赖，端口 46810 起）。
- **Analytics & SEO**：GA4 `G-D67E3XTNSS` 已接入；集中式构建脚本 `scripts/build-site.mjs` 自动向 `dist/` 所有 HTML 注入统计代码；`sitemap.xml` 自动编译 16 页面；`robots.txt` 声明正常。
- **git**：正常，main 推送成功，workflow 自动构建部署到 gh-pages。

## 2026-09-11 · AGENTS.md 深度重构升级与双技能协同体系统合

### 做了什么
1. **工作模式与平台定位重塑**：
   - **解开僵化流水线**：确立三种开发协作模式，将【模式 A：本地主代理直接端到端开发】明确为最常用、最高效的默认工作流；【模式 B：策划立项先行】作为复杂机制/创新的把控手段；【模式 C：外包解耦发包】作为外发网页 AI 的协作工具；
   - **面向不断增长的集合平台**：不再局限于存量 15 款游戏，将老游戏代码细节抽离，提炼为 5 种典型玩法架构范式（离散网格益智、程序化拼图解谜、经典对弈与纸牌、反应消除与下落、物理动作与时机），指导未来任意新游戏开发。
2. **桌面端 UI 美学与游戏化设计标准（解决死板老套痛点）**：
   - 彻底破除粗糙居中单列拉伸，在 `AGENTS.md`、`GAME-SPEC.md` 与两项技能中确立**桌面端（≥900px）双栏/宽屏沉浸游戏舞台标准**（主舞台 Canvas/Grid + 侧边关卡匾额/HUD/操作台）；
   - 强调题材专属美学（环境光晕 drift、微质感纹理、深色微光或糖果质感，拒绝苍白无聊留白与原生按钮），以及游戏化 HUD 徽章、数字 bump 跳字、实体按键位移与通关成就仪式感。
3. **算法健全性与成熟规则对标铁律（解决算法出错痛点）**：
   - **严禁闭门造车凭空脑补规则**：开发前必须深入对标历史经典原型与成熟实践（状态机流转、输入缓冲、操作容错手感）；
   - **数学可解性保证（严禁死局）**：生成、发牌、打乱等必须从数学上证明或通过求解器检验保证 100% 可解（BFS、欧拉路径、无不动点打乱、7-Bag、无猜逻辑）；
   - **自动化健全性验证**：确定性 PRNG 种子支持与单元测试中至少 1000 步的随机游走门禁。
4. **全套生态统合同步与过度说明精简**：
   - 升级 `skill/doin外包小游戏开发`：任务书模板增加桌面双栏美学、经典算法对标与数学可解性硬约束；
   - 彻底重塑 `skill/doin小游戏开发策划书`：从“技术规格把关”回归“产品策划部立项”本质；
   - **全面精简 `doin-context.md`**：彻底剔除 80 行技术工程分层、代码实现与测试门禁等过度说明，将其精简为纯粹的《策划查重参考》（仅保留 15 款存量品类、品类空白建议与封面色相排重）；
   - 升级 `docs/GAME-SPEC.md` 与 `docs/COVER-STYLE.md`：补全 15 款游戏封面登记与未饱和色相，固化桌面美学与算法红线。

### 修改文件
- `AGENTS.md`
- `docs/GAME-SPEC.md`
- `docs/COVER-STYLE.md`
- `skill/doin外包小游戏开发/SKILL.md`
- `skill/doin外包小游戏开发/references/outsource-spec-template.md`
- `skill/doin小游戏开发策划书/SKILL.md`
- `skill/doin小游戏开发策划书/references/prd-template.md`
- `skill/doin小游戏开发策划书/references/doin-context.md`
- `games/klotski/tests/markup.test.mjs`
- `PROJECT_LOG.md`

## 2026-09-11 · Jigsaw 拼图上架（第 15 款）

### 做了什么
1. **游戏本体**：按 `docs/plans/jigsaw-prd.md` 从零实现拼图。50 关（5 章 × 10 关，3×3 → 4×4 →
   5×5）+ 今日拼图。核心模型是**交换**（拖一块到另一块上换位）而不是拖到空位；碎片只有落在
   正确位置才自动锁定，锁定后不可再动；每关 3 次「重排」，不计步数。
2. **程序化艺术图（核心差异）**：`artwork.mjs` 用 mulberry32 + FNV-1a 从关卡 seed 生成
   512×512 抽象图（三段渐变底 + 3–8 个柔光几何块 + 2–4 条弧线 + 细噪点），**同 seed 必得同图**。
   配方用 0..1 归一化坐标描述，棋盘切片与选关缩略图共用同一份配方，任意尺寸可渲染。
   零外链图库、零版权素材；柔光用径向渐变而非 `ctx.filter`（Safari 兼容）。
3. **引擎不变量**：`grid[r][c]` 存碎片身份；放对 ⇔ 已锁定。未锁定子系统始终是闭合排列，
   因此**任何局面都可解、本作没有死局**；初始打乱与重排都做 derange（保证无碎片落在原位）。
4. **计分与存档**：`total = base(200) + move(500) + time(100)`，主线满分 800；今日拼图
   额外 +150 基础分（满分 950）。par = `n·n + n`（12/20/30），写死在 levels.mjs，不跑求解器。
   存档 `doin.jigsaw.v1`，`current` 只存主线进行中局面且必须过 `validateSnapshot`。
5. **交互**：拖拽（≥10px 才算拖）、点选两格交换、方向键光标 + 回车拿起放下；「原图」长按预览
   最多 2 秒；第 1 关开场 3 秒虚线箭头引导。桌面 ≥900px 双栏（棋盘 + 240px 信息栏），
   移动端单列；reduced-motion 关补间。
6. **上架物料**：`games.json` 登记（tags 益智/视觉/每日挑战，icon 🎨）、640×640 青柠色 WebP
   封面（Pillow 程序化绘制：亮青柠渐变 + 居中软胶拼图块 + 漂浮彩点，无文字无水印）、
   根 `test:jigsaw`、AGENTS.md §11 稳定基线。

### 新增/修改文件
```
games/jigsaw/                          [新增整目录] index.html / favicon.svg / css/style.css /
                                       js/{engine,artwork,levels,score,storage,i18n,audio,game,
                                           render,ui,main}.mjs /
                                       tests/{engine,artwork,score,storage,i18n,markup}.test.mjs
assets/covers/jigsaw.webp              [新增] 640×640 WebP 青柠色封面
games.json                             [修改] 登记 jigsaw 条目（含 en 翻译）
package.json                           [修改] 注册 test:jigsaw
AGENTS.md                              [修改] 新增 §11 jigsaw 稳定基线，Working Rules 顺延 §12
PROJECT_LOG.md                         [修改] 本轮记录
x/jigsaw/make-cover.py                 [新增·gitignore] 封面生成脚本
```

### 关键实现方式
- **derange（无不动点排列）**：先 Fisher-Yates 洗牌，再逐个把"洗回原位"的位置与某个既不撞
  自身格也不被对方格撞的位置交换；`cells.length ≥ 2` 时该位置必然存在，所以一定收敛。
- **交换补间**：`setState(state, kind)` 用前后两份 grid 反查每块碎片的来源格，算出每格的位移
  偏移量并按 120ms ease-out 衰减到 0；重排额外带旋转+缩放，比"记录动画对象"简单且天然正确。
- **封面**：`knob_mask` = 圆 ∩ 窄矩形，给凸起/凹槽做出"脖子"，否则圆直接贴在边角会变成花瓣形。

### 遇到的问题
- **PRD §4 第 3 行算例自相矛盾**：L50 写"超时 280s → 保底 20"，但按它自己给的公式
  （100 - 28×2）应为 44。以公式为准，L50 时间分 = 44、总分 344。
- **步数分三段式 vs 平滑衰减**：PRD 明确写"moves > par·2 → 保底 100"，这是硬保底而不是
  klotski 那种 `max(FLOOR, MAX - over·5)` 的平滑衰减。按 PRD 实现，代价是刚过 2·par 时
  分数会从 500-5·par 直接掉到 100（par 12 时即 440 → 100）。已在 score.mjs 与 AGENTS.md §11.2
  写明"改口径必须三处同步"。
- **封面首版拼图块像四叶草**：凸起圆直接贴在边上没有脖子，轮廓读不出拼图。改成
  圆 ∩ 窄矩形后正常。
- **测试自身写错 3 处**：formatTime 期望值、`setCurrent(...).state`（应为 `.current.state`）、
  以及用未解锁关卡测"保存进行中局面"（未解锁本就该被丢弃）。均已修正。

### 验证结果（全绿）
- `npm run test:jigsaw` 83/83
- `node scripts/check-game.mjs jigsaw` 19 pass / 0 fail / 0 warn（零豁免）
- `npm run build` 通过，`dist/jigsaw/` 产出、`dist/sitemap.xml` 含 `/jigsaw/`
- 封面人工核对：青柠渐变 + 居中软胶拼图块 + 漂浮彩点，无文字无水印，与现有 14 张不撞色

### 追加修复：艺术图"切片后不可辨认"（同日，真浏览器冒烟驱动）

**怎么发现的**：静态测试与 check-game 全绿之后，跑无头 Chrome + CDP 的真浏览器端到端冒烟，
其中一条"每格中心区域非纯色"的检查在 3×3 首关就有 4/9 格不达标。没有把它当测试噪音，
而是写了 `x/jigsaw/probe.mjs` 逐章量化，再逐章截图人眼复核 —— 结果确认是真缺陷。

**根因（两处，都在 artwork.mjs）**：
1. 底色渐变写死 `light: 74 + rng()*14`，明暗只跨 14 个单位；而且 `contrast` 参数
   **完全没有作用到底色**，只改了形状的透明度/明度。于是 PRD §3.3 要求的第 1 章
   "高对比渐变（易辨认）"落空，整张图是一片同色。
2. 几何形状位置是纯随机 `0.1 + rng()*0.8`，特征全挤在一角。5×5 时右半部分
   10 格几乎一模一样 —— 正是 PRD §8 风险 3"抽象图切片后没有明显特征，玩家只能乱试"。

**修法**：
- `contrast` 现在同时驱动**明暗跨度**（`lightSpan = 14 + contrast*46`）与
  **色相跨度**（`spread = 18 + contrast*62 + rand`）。拼图最有效的辨认线索其实是色相差异，
  所以高对比章两条都拉开；第 3 章 contrast 调到 0.32 成为全作最柔的一档。
- 几何特征数量改为 `3 + round(detail*9 + rand)`（3..14），并把取位从纯随机改成
  「抖动网格 + 四角优先」，**列数强制取偶数** —— 奇数列时中间列中心恰好落在 0.5 上，
  抖动会让象限归属随机化。改完后"任意 shapeCount ≥ 4 覆盖四象限"是结构性成立的。
- 渐变端点由**画布四角投影**算出，任何角度下画布都完整落在渐变范围内，
  不再"只用到渐变中间一段"。

**效果**：5×5 从"右半 10 格同色"变成 25 格各有色块/边缘可辨；L1 有了黄绿→绿→青蓝的
清晰走向。量化指标（格间中心平均色最小曼哈顿距离）L1 从个位数升到 43。

**保留的已知残留**：少数关卡的个别格子中心仍可能彼此接近（柔和渐变的固有特性，
L46 有 5/300 对距离 <15）。判断为可接受 —— 玩家仍可用边缘与位置区分，
不应为了刷指标把整体对比拉到刺眼。已在 AGENTS.md §11.3 写明。

**顺带发现（不是 bug，是测试写错）**：冒烟最初还有 3 条 FAIL，逐条查证后全部是
测试预期错误而非实现缺陷：
- "键盘回车可选中光标所在格"：光标当时恰好落在**已锁定格**上，而 Enter 落在锁定格
  按设计就是 no-op（锁定块不可选中）。用 `probe.mjs` 分离验证：未锁定格 → 正常选中，
  已锁定格 → 返回 null，真实 CDP 键盘通道也通过。
- "每个格子中心区域都有可辨识内容（std ≥ 3）"：判据本身错了 —— 平滑渐变的局部方差
  天然就低，std<3 对任何渐变美术都会误判。改为真正决定可玩性的两条：
  **没有空白格** + **没有两格中心完全相同**。
- "缩略图已绘制内容（50/50）"：未解锁关卡按设计不画缩略图（不提前剧透图案），
  实际只画已解锁的 2 张。改为断言 `painted === unlocked`。

### 验证结果（修复后，全绿）
- `npm run test:jigsaw` **86/86**（新增 3 条可辨认性门禁：明暗跨度随 contrast 增大、
  50 关几何特征铺满四象限、第 5 章特征数 ≥ 9）
- `node scripts/check-game.mjs jigsaw` 19 pass / 0 fail / 0 warn（零豁免）
- 真浏览器 CDP 端到端冒烟 **37 pass / 0 fail**（含真实指针拖拽交换、锁定 no-op、
  重排不计步、长按原图、键盘通路、中英切换、像素可辨认性、结算、选关页 50 卡、
  刷新存档、390px 无横向溢出、全程无未捕获异常）
- `npm run build` 通过；`dist/jigsaw/js/{artwork,levels}.mjs` 与源码 md5 一致

### 追加：补齐 SPEC §7B 验收清单剩余两项（同日）

`cdp-smoke.mjs` 覆盖了桌面 + 390px + 语言切换刷新保持，但 SPEC §7B 还要求
**「开关系统『减少动效』」**，且今日拼图这条完整链路从未在真浏览器里跑过。
新增 `x/jigsaw/cdp-extra.mjs`（18 项，全绿）：

- **减少动效降级**：用 `Emulation.setEmulatedMedia` 模拟 `prefers-reduced-motion: reduce`。
  关键是**带对照组**，否则测不出"补间真的被关掉了"：
  - 对照组（no-preference）：交换瞬间像素指纹 `4174074312` ≠ 稳定态 `196020520` → 补间确实在跑；
  - reduce 组：交换瞬间指纹 `196020520` **等于**稳定态 → 补间确实被关掉、立即落位；
  - 同时验证 CSS 全元素 `animation-duration`/`transition-duration` 被压到 `1e-06s`；
  - reduce 下交换仍生效（步数 +1）、仍能正常拼完并弹出结算。
  - 为此给 `render.mjs` 加了一个只读访问器 `get reducedMotion()`（与已有 `get size()` 同性质，
    仅供验收断言，游戏逻辑不读它）。
- **今日拼图全链路**：入口进入 `isDaily=true`、复用主线素材（当天 hash 到 `l40`）、
  满分 950、初始 0 步打乱；同一天刷新后重进得到**完全一致的题目**（same-day deterministic）；
  结算 `base = 350`（200 基础 + 150 每日加成）、total ≤ 950；
  成绩写入 `daily` 槽位且**不改变主线 `unlocked`、不改动 `current` 槽位**。

**又一条测试自身的错**（记下来备查）：对照组第一版写错了 —— `main.mjs` 的订阅已经在
swap 事件里调 `renderer.setState(state,'swap')` 启动了补间，测试里又手动调了一次
`setState`，于是 `prev` 被当成新网格、补间被覆盖成零偏移，测出来"没有补间"。
**手动重复调用会破坏被测行为时，应该只走应用自身的通路**。

### 追加：验证「构建产物本身能跑」+ 门户首页集成（同日）

之前对 `dist/` 只做了"文件存在 + 与源码 md5 一致"的校验，**从没真正加载过**。
构建会把本地的 `/games/<slug>/` **扁平化成 `/<slug>/`**，路径一旦写错，
md5 照样一致但线上 404。新增 `x/jigsaw/cdp-dist.mjs`（13 项，全绿）：
进程内起静态服务指向 `dist/`，用无头 Chrome 按**生产路径**加载。

- **生产路径 `/jigsaw/`**：12 个模块 + `style.css` + `favicon.svg` 全部 2xx（同源 14 个请求
  无一非 2xx）；50 关清单正常载入；可启动；**真实指针拖拽能完成交换并锁定**。
- **门户首页 `/`**：15 张卡片（含拼图），拼图卡片 `href=/jigsaw/`、标题「拼图」、
  非 comingSoon、封面 `naturalWidth=640` 已成功加载（非裂图）。
- 截图人工复核：拼图卡片在门户网格里是青柠渐变 + 居中软胶拼图块 + 漂浮彩点，
  无文字、不被裁切，与其余 14 张不撞色。

**两条测试自身的错**（又一次证明冒烟 FAIL 要先分离实现缺陷与测试写错）：
1. 把 GA4 的 `g/collect` 信标算成了错误 —— 它返回 **204** 且会被浏览器 abort。
   GA4 是构建时全局注入的外链统计，在无头沙箱里失败是外部依赖问题，不属于
   "构建产物是否完好"。已把统计范围限定为**同源**请求。
2. `Page.captureScreenshot` 的 `clip` 用的是**页面坐标**而不是视口坐标，
   导致第一版截到了别的卡片。改为 `getBoundingClientRect() + scrollX/scrollY`
   且不做 `scrollIntoView`（否则坐标错位）。

### 最终验证（含补测）
| 项目 | 结果 |
| --- | --- |
| `npm run test:jigsaw` | 91/91 |
| `node scripts/check-game.mjs jigsaw` | 19 pass / 0 fail / 0 warn |
| `x/jigsaw/cdp-smoke.mjs` | 39 pass / 0 fail |
| `x/jigsaw/cdp-extra.mjs` | 18 pass / 0 fail |
| `x/jigsaw/cdp-dist.mjs` | 15 pass / 0 fail |
| `npm run build` | 通过，dist 与源码 md5 一致 |

***

### 关键缺陷修复：渲染器切片源取错 —— 棋盘永远画成"已拼好"（同日，用户报障驱动）

**现象（用户原话）**：「不会玩，这初始状态不就是拼好的吗？而且任何操作都不行」。

**定位过程（先证明状态机没问题，再怀疑渲染）**：
1. 写 `x/jigsaw/repro-solved.mjs`，按 10 个阶段（首屏 → 开始 → 真实拖拽 → 重开 → 三次重排
   → 拼完 → 再玩一次 → 第 2 关 → 刷新）逐步 dump `phase / inPlace / locked / solved / moves / overlay`。
   结果**全程状态机完全正确**：首屏 `归位=0/9 solved=false`，拖拽真的 +1 步，锁定真的出现，
   刷新真的恢复进度。→ 排除逻辑层，锁定渲染层。
2. 读 `render.mjs` 的绘制代码，找到根因。

**根因**：`drawSlices` 用**格子自身位置**当切片源：
```js
ctx.drawImage(art, c * slice, r * slice, slice, slice, x, y, w, h);   // 错
```
格子 `(r,c)` 应该显示"当前放在这一格的**那块碎片**"的图案，而那块碎片的图案来自它在完整
艺术图里的**原位**。取成自身位置，等于每格都画自己该在的位置 → 整个棋盘恒等于完整原图，
**永远看起来是拼好的**；而交换虽然真实发生，画面却毫无变化，所以"任何操作都像没反应"。

**修复**（`render.mjs`，`drawSlices` 两个分支 + `drawDragged` 共三处）：
```js
const piece = pieceAt(state, r, c) || { r, c };
const srcX = piece.c * slice;
const srcY = piece.r * slice;
ctx.drawImage(art, srcX, srcY, slice, slice, x, y, w, h);
```
```js
const dragged = pieceAt(state, drag.cell.r, drag.cell.c) || drag.cell;
ctx.drawImage(art, dragged.c * slice, dragged.r * slice, slice, slice, x, y, w, w);
```

**回归防护（三层）**：
1. 新增 `games/jigsaw/tests/render.test.mjs`（5 用例）：用 Proxy stub 2D context 录制
   `drawImage` 参数，直接驱动**真实** renderer 断言切片源。含「每格画该格碎片的原位切片」
   「初始局面在画面上确实打乱（50 关全部 sameAsOwn === 0）」「交换后两格互换切片源」
   「已拼好局面每格画自身位置」「空 state 不抛错」。
   **并临时把缺陷复现回去验证过捕获力**：3 条转红（2 pass / 3 fail），
   再用备份 `x/jigsaw/render.mjs.fixed` 还原，5/5 绿。
2. `x/jigsaw/cdp-smoke.mjs` 新增真像素契约（第 10b 节）：打乱态第 i 格的画面 ===
   「原图预览」第 (该格碎片原位) 格的画面，`mismatched === 0`；并断言打乱在画面上可见。
3. `x/jigsaw/cdp-dist.mjs` 把同一条契约搬到**构建产物**上复查，防"源码修了但 dist 是旧的"。

**为什么之前 86 个用例没抓到**：旧像素检查只断言"每格中心有内容 / 各格不同"，
**从未断言"画面反映的是打乱后的状态"**。格子有内容、彼此也不同，但整张图是完整的原图 ——
旧判据天然看不见。

**教训**：像素级测试必须断言"画面 = 状态的函数"，而不只是"画面非空"。
静态测试全绿 ≠ 能玩，这条已经写进 AGENTS.md §11.5。

### 修复后复验（全绿，含构建产物）
- `npm run test:jigsaw` **91/91**（新增 render 5 条）
- `x/jigsaw/cdp-smoke.mjs` **39 pass / 0 fail** —— 切片源契约「不一致 0/9 格，最大色差 2」、
  打乱可见「8/9 格」（余 1 格中心区域与完整原图巧合一致，断言允许 `cells - 1`）
- `x/jigsaw/cdp-dist.mjs` **15 pass / 0 fail** —— 构建产物上「不一致 0/9，最大色差 0」、
  「9/9 格可见打乱」，真实拖拽 `moves=1 locked=1`
- `npm run build` 通过，`games/jigsaw/js/render.mjs` 与 `dist/jigsaw/js/render.mjs`
  md5 均为 `1371c43ee515f1ac9a4b79736784e678`，且 dist 中确认含 `pieceAt(state, r, c)` 取源逻辑
- `x/jigsaw/cdp-extra.mjs` **18 pass / 0 fail**

### 追加改造：桌面端 UI 游戏化重构（同日，用户反馈"桌面端缺乏游戏美学，排版不好看"）

**问题**：原桌面布局是 `grid-areas: "badge hud" / "board pad" / "board tools"`，`pad` 是空行；
棋盘被 `calc(100dvh - 190px)` 卡在 570px 左右且不居中，右侧 240px 栏是 5 行一模一样的白色
"表单行"（关卡/步数/标准/得分/时间）+ 5 个散落的白胶囊按钮。整体读起来像设置页而不是游戏。

**改造（对齐 AGENTS.md §4「桌面端 UI 美学与游戏化设计标准」）**：

| 标准条目 | 落地做法 |
| --- | --- |
| 桌面双栏沉浸舞台 | `≥900px` 改 `flex` 行：棋盘 `width: min(72vw, calc(100dvh - 132px), 880px)` 居中偏左，右侧固定 344px 面板通栏 |
| 移动端单列 | 保持单列；用 `#panel { display: contents }` + `order` 把棋盘插到 HUD 与控制条之间（DOM 里面板先出现，视觉上棋盘居中） |
| HUD 徽章化 | 关卡匾额卡（章节胶囊 + 关卡名 + `n/50` + 进度条）、得分 hero 卡（渐变 + 大号 tabular 数字 + 得分条）、步数/标准/时间三格 stat 卡；数值变化沿用 `bump` 跳动 |
| 背景环境光晕 | `body::before` 四层径向光斑 + `aura-drift` 38s 缓慢漂移；`body` 底层叠加 SVG `feTurbulence` 噪点（data URI，零外链）；`body::after` 柔和暗角收拢视线 |
| 实体触感按键 | 悬停 `translateY(-2px)`、按下 `translateY(1px)`；卡片与按钮加 `--raise` 顶部内高光做双层软阴影 |
| 结算仪式感 | 结算面板标题→徽章→四格数据→最佳行→按钮**依次点亮**（`win-pop` 阶梯 delay）；`#ov-win` 内 `.burst` 10 片小方片从中心向外炸开（纯 CSS，色板取自游戏主题） |
| 动效降级 | 全部受 `prefers-reduced-motion: reduce` 约束；粒子降级为瞬移（终态 opacity 0，即不显示） |

**棋盘做成"实体托盘"**：`#board-wrap` 由透明容器改为暖卡其渐变托盘
（`linear-gradient(160deg, #f8f4ec, #ebe4d7, #ded5c4)`）+ 内描边 + 深投影，棋盘嵌在托盘里。

**唯一 JS 改动**（`ui.mjs`）：新增 `#level-bar` / `#hud-score-bar` 两条进度条的宽度同步
（`syncMeta` 写关卡进度、`syncScore` 写得分占比），并给 `#level-badge` 写 `data-daily`
以便今日拼图隐藏关卡进度条（`1/50` 对每日关无意义）。

**踩坑记录**：
1. 首次改造把 `#panel` 放在网格第 1 列 → 面板抢占 `1fr` 变超宽、棋盘被挤进 330px 列。
   改用 flex 行 + `order`（`#board-wrap { order: 0 }` / `#panel { order: 1 }`）才稳定。
2. 截图上粒子不出现 —— 探针查出 `animationDuration: "1e-06s"`：**无头 Chrome 默认
   `prefers-reduced-motion: reduce`**，动效被全局压成瞬移（这是正确的降级）。
   截图脚本必须显式 `Emulation.setEmulatedMedia` 设 `no-preference` 才能看到真实动效。

**验证（全绿）**：`test:jigsaw` 91/91；`check-game.mjs jigsaw` 19/0/0；
`cdp-smoke` 39/0；`cdp-extra` 18/0；`cdp-dist` 15/0；`npm run build` 通过，
`style.css` 源码与 dist md5 一致。人眼复核截图：桌面 1280/1440/1920、移动 390、
开始/结算（含粒子瞬间）/选关/玩法五个弹层。

**注意**：AGENTS.md 已被并行重构为 150 行通用规范（原 §11 jigsaw 章节不再存在），
本次改造直接对齐其新增的 **§4 桌面端 UI 美学与游戏化设计标准**。


## 2026-09-11 · GA4 全局统计接入与 SEO 验证 (G-D67E3XTNSS)

### 做了什么
1. **构建期集中注入架构**：在 `scripts/build-site.mjs` 中增加 `injectGlobalSiteTags(output)` 函数，在 `npm run build` 打包 `dist/` 时自动向全站所有 `.html`（包含首页、独立静态游戏、Vite 编译 SPA 游戏及 404 页）的 `<head>` 中注入 GA4 统计代码 `G-D67E3XTNSS`；源码解耦免手动粘贴；
2. **源码保持纯粹**：将开发过程中在 `games/*/index.html` 及 `index.html` 临时添加的标签干净回滚，防止源文件冗余与后续 ID 更新困难；
3. **SEO & Sitemap 验证**：排查并验证线上 `https://doin.win/sitemap.xml` 200 OK 且输出 15 个全量页面，解析了 Google Search Console 刚提交时“无法抓取（上次读取时间为空）”的假性显示延迟机制。

### 修改文件
- `scripts/build-site.mjs`
- `AGENTS.md`
- `PROJECT_LOG.md`

## 2026-09-11 · Klotski 英文棋子刻字修复

### 问题
英文语言下棋子上完全没有文字。

### 根因
`render.mjs` 的 `LABELS` 只有硬编码中文，`main.mjs` 便用
`createRenderer(canvas, { labels: getLocale() === "zh" })` 在英文下整块跳过刻字绘制；
切语言时同样调 `setLabels(...)`。属于「用关掉绘制来回避没有译文」，不是单纯缺文案。

### 修复
- `i18n.mjs`：新增 `piece.caocao / piece.guanyu / piece.general / piece.soldier`，
  zh = 曹操/关羽/将/兵，en = `Cao Cao` / `Guan Yu` / `Gen` / `Pawn`。
- `render.mjs`：`LABELS` 降为中文兜底；新增 `labelMap`（`options.labelMap` +
  `setLabelMap()`）；绘制改用 `fitLabel()` 自适应排版——按空格给出两行候选（多行优先），
  在块内宽 ×0.84、块高 ×0.8 内取最大字号，放不下再退回单行最小字号。中文单行表现不变。
- `main.mjs`：新增 `pieceLabels()` 组装 `t("piece.*")`，初始化注入、切语言时 `setLabelMap()`。
- 英文名取短词的原因：1×1 兵块与 1×2 竖块内宽仅 0.72 cell，`General`/`Soldier` 被自适应
  压到约 0.18 cell（手机端约 12px），改 `Gen` / `Pawn` 后与中文字号持平
  （兵 45px ↔ Pawn 45px、将 51px ↔ Gen 51px，cell=150）。

### 验证
- `npm run test:klotski` 56/56 通过（i18n 新增「每种 KIND 都有中英文、英文必须 ASCII」门禁）。
- `.workbuddy/tmp/klotski-label-probe.mjs`（Proxy 桩记录 ctx 调用）：9 条断言全 PASS——
  中英都有刻字、每块都有刻字、无溢出、描边行数与文字行数对齐。
- `npm run build` 通过，dist/klotski 同步更新。
- 文档同步：AGENTS.md §10 小节编号修正（11.x → 10.x）并补「棋子刻字必须走 i18n」硬规则。

## 2026-09-10 · Klotski 华容道上线

### 做了什么
1. **游戏本体**：从零实现完整华容道滑块解谜，50 关递进（par 8→116 严格递增，第 50 关
   经典「横刀立马」最优 116 步）。Canvas 渲染棋盘与方块，支持拖拽 + 键盘双操作、撤销、
   重玩、计时计分、本地进度保存、中英双语。模块分层：engine / levels / score / storage /
   audio / render / game / ui / main / i18n（与 orbit-sort 一致）。
2. **方块纹理设计**：`render.mjs` `drawPiece` 实现对角高光 + 左侧光 + 底部厚度渐变 + 阴影；
   四角回纹装饰；曹操回纹 / 关羽偃月 / 将铠甲竖纹 / 兵铜钱差异化纹理；选中态鎏金环 + 阴刻文字。
3. **桌面双栏游戏化 UI**：`@media (min-width:900px) and (min-height:560px)` 下 `#stage`
   转 CSS Grid 双栏——左棋盘通栏、右 HUD(2×2 牌卡 + 对角回纹) / 关卡匾额 / 装饰留白 / 操作台。
   棋盘解除固定宽度：`width: min(100%, calc((100dvh-120px)*0.8)); aspect-ratio:4/5` 精确贴合
   Canvas 自绘棋盘 + 6px 外框。body::before 朱红/鎏金双光晕缓慢 drift。
4. **封面**：Pillow 程序化绘制（天蓝渐变底 + 居中朱红曹操 2×2 + 蓝将/纸兵陪衬 + 漂浮光点，
   无文字无水印，640×640 WebP q90）。已知不足：关羽画成竖向（应为横向）、扁平感偏强，
   用户已确认"先这样"。
5. **推送 + 部署**：`git push origin main`（fast-forward `cd5df1d..d06fab7`），GitHub Actions
   workflow #40 成功，`gh-pages` 更新，生产站点验证通过。

### 修改/新增文件
```
games/klotski/                      [新增整目录：index.html / css/style.css / favicon.svg /
                                       js/{engine,levels,score,storage,audio,render,game,ui,main,i18n}.mjs /
                                       tests/{engine,storage,i18n,markup}.test.mjs]
assets/covers/klotski.webp          [新增] 640×640 WebP 封面
games.json                          [修改] 登记 klotski 条目（含 en 翻译）
package.json                        [修改] 注册 test:klotski 脚本
AGENTS.md                           [修改] 新增 §11 klotski 稳定基线
PROJECT_LOG.md                      [修改] 本轮记录
```

### 关键实现方式
- **关卡生成**：`mulberry32(20260910)` 抽每 par 一态（Cao Cao 行号升序），多源 BFS 实算 par；
  50 关 par 严格递增，第 50 关锁定经典布局。`x/klotski/gen50.mjs` 为离线生成脚本（gitignore）。
- **引擎**：纯函数 `parseGrid / canMove / applyMove / applySlide / undo / isSolved`；5×4 棋盘，
  方块用字符网格解析（同字符连通 = 一块，形状由包围盒推断 kind）；曹操左上角到 (3,1) 即过关。
- **计分**：`total = base(200) + move(max300, par 基线每步 -5 保底 60) + time(max300, 超时每 10s -4 保底 60)`；
  满分 800。存档 key `doin.klotski.v1`，分数钳制 ≤ PERFECT。
- **桌面布局验证**：CDP 无头测 6 档视口（1280/1440/1920/900×600/899/390），92/92 全绿。
- **像素统计验证**：`getImageData` 取块内中心 40% 区域，判颜色数/亮度 std/四类主色曼哈顿距离 >40。

### 遇到的问题
- **pixel-check 测试写错**：初次把 'A' 当曹操（实际 'A' 是竖将 2×1，'C' 才是曹操 2×2），
  取样窗跨块导致均值偏蓝——是测试写错非渲染错。修正后 18/18。
- **make-cover.py paste 失败**：`ValueError: images do not match`，根因是 mask 尺寸用了全画布
  而非局部块尺寸。修为 `rr_mask_local(w,h,r)` 生成局部尺寸 mask。
- **git fetch 后 origin/main 不可解析**：fetch 报 `[new branch]` 但 `git rev-parse` 找不到；
  根因是 `.git/refs/remotes/origin/` 目录未创建。用 `FETCH_HEAD` 中的 SHA 直接做
  `merge-base --is-ancestor` 判定 fast-forward 安全。
- **封面已知不足**：关羽画成竖向（w/h 写反）、扁平感偏强。用户确认"先这样"。

### 提交与部署
- `ca68890 feat: assemble klotski game and wire into portal`（19 文件 / 4824 行）
- `d06fab7 style(covers): add klotski clay cover`（1 文件）
- 推送 `cd5df1d..d06fab7 main -> main`（fast-forward）
- GitHub Actions workflow #40：`completed / success`
- 生产验证：`doin.win/klotski/` 200、封面 200（8456 字节）、games.json 含完整条目

### 验证结果（全绿）
- `npm run test:klotski` 55/55
- `node scripts/check-game.mjs klotski` 19 pass / 0 fail / 0 warn
- `npm run build` 通过，`dist/sitemap.xml` 含 `/klotski/`
- CDP 桌面布局 92/92、像素统计 18/18、smoke 21/21、e2e-win 14/14、interaction 16/16

***

## Archive（索引，不展开）

- **2026-09-08~10 Klotski 开发全过程**：详见 git log（ca68890, d06fab7）及 `.workbuddy-ai/memory/2026-09-10.md`。
- **2026-09-07 OG 封面重渲**：`assets/og-image.png` 由旧版深色像素风重构为 Poki 主题。
- **2026-09-07 Sudoku/2048 i18n 对齐**：引入 `doin.lang` 共享偏好 + 单元测试门禁。
- **2026-09-06 外部 AI 子游戏交付模板定稿**：任务参数 + 三轮交付格式。
- **2026-09-05 tetris-neo 整改上架**：外部交付首款，3 补丁修 bug + 抽规则层 + 上架物料。
- **2026-09-05 GAME-SPEC + check-game**：自包含交付契约 + 两级验收脚本。
- **2026-09-05 黄金矿工上架**：收敛三套原型为 9 模块，58 用例门禁。
- **2026-09-04 首页 Poki 风改版 + 全站 i18n**：薄荷渐变 / 胶囊标签 / 语言选择器 / brand 字标。
- **2026-09-04 Minesweeper 上线**：延后布雷无猜保证 + solver + 计分存档 + WebAudio。
- **2026-09-04 Orbit-sort 收尾审计**：满分钳制 / recomputeTotals / 100 关可解性。
- **2026-09-03 Tic-Tac-Toe 上线**：77 测试 / 大师档不可战胜 = 特性。
- **git push 凭据**：曾因 token 属 ai919≠ai717 导致 403，已解除。
