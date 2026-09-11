# PROJECT_LOG.md

> 精简原则：只留状态快照 + 最近一轮要点。细节查 git log / `.workbuddy/memory/`。
> 游戏稳定规则写在 AGENTS.md（§5 orbit-sort / §6 tic-tac-toe / §7 homepage / §8 minesweeper /
> §9 gold-miner / §10 klotski），本文件不重复。

***

## Current Baseline (2026-09-11)

- **门户**：薄荷渐变首页（`index.html` + `css/`），640×640 WebP 封面（3D 风格统一），
  白色胶囊卡片标签 + hover 放大；品牌行「Doin.win 字标 ←→ 地球语言按钮」+ 二级主标题；
  中英双语（`doin.lang` 全站共享偏好）。CNAME `doin.win`。共 14 款游戏上架（新增 Klotski）。
- **Klotski**（新增）：华容道滑块解谜，50 关递进，Canvas 渲染 + 桌面双栏游戏化 UI。
  稳定基线固化在 AGENTS.md §10。已推送部署上线 `doin.win/klotski/`。
- **Sudoku / 2048 / Tic-Tac-Toe / Minesweeper / Orbit-Sort / Gold-Miner / Tetris-Neo /
  FreeCell / Snake-Orchard / Zuma / Gravity-Echoes / Tile-Matching / One-Line**：均稳定。
  规则见 AGENTS.md 对应章节。
- **i18n**：全站游戏均支持 `doin.lang` 共享偏好。
- **交付契约**：`docs/GAME-SPEC.md` + `scripts/check-game.mjs`（T1 fail / T2 warn 两级）。
- **本地服务**：`node _dev-server.mjs`（零依赖，端口 46810 起）。
- **Analytics & SEO**：GA4 `G-D67E3XTNSS` 已接入；集中式构建脚本 `scripts/build-site.mjs` 自动向 `dist/` 所有 HTML 注入统计代码；`sitemap.xml` 自动编译 15 页面；`robots.txt` 声明正常。
- **git**：正常，main 推送成功，workflow 自动构建部署到 gh-pages。

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
