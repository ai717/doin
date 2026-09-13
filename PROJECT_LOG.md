# PROJECT_LOG.md

> 精简原则：只留状态快照 + 最近一轮要点。细节查 git log / `.workbuddy/memory/`。
> AGENTS.md 已重构为**跨游戏通用规范**（§1 平台架构 / §2 协作模式 / §3 算法健全性 /
> §4 桌面 UI 美学 / §5 工程规范与不变量 / §6 玩法范式 / §7 工作纪律），
> **不再按游戏分节**；单游戏稳定基线记录在本文件各轮条目中。

***

## Current Baseline (2026-09-13)

- **门户**：薄荷渐变首页（`index.html` + `css/`），640×640 WebP 封面（3D 风格统一），
  白色胶囊卡片标签 + hover 放大；品牌行「Doin.win 字标 ←→ 地球语言按钮」+ 二级主标题；
  中英双语（`doin.lang` 全站共享偏好）。CNAME `doin.win`。共 17 款游戏登记（新增 Pair-Link、Link-Up）。
- **Link-Up**（新增本地接入）：喜福连连看，暖木牌桌 / 民俗符号题材，50 关五章递进 + 异形棋盘 + 每日挑战；已完成规则、UI、可访问性与构建门禁，待用户确认稀疏棋盘是否升级为高密度牌组后再调整生成规则。
- **Pair-Link**（新增）：连连看，夜市灯牌 / 琉璃瓷片题材，36 关三章 + 无尽冲分 + 每日一盘。
  逻辑盘 12×10（10×8 实心 + 外圈通道），三线连通判定（0/1/2 折，禁斜线，可绕外圈虚空）。
  第 2/3 章引入**冰封壳**（8 邻域震碎，死盘融壳兜底）；**每日一盘**同种子同题、与主线解耦。
  DOM/CSS Grid 棋盘（含淡化方格线，画在容器上）+ Canvas 2D 特效覆盖层双轨渲染，桌面双栏沉浸 UI，
  棋盘下方归位控制台 + 剩余对数进度。稳定基线见本轮条目。
- **Jigsaw**：拼图，50 关（3×3 → 4×4 → 5×5）+ 今日拼图，交换碎片复原图案。
  每关一张程序化生成的抽象艺术图（同 seed 同图，零图库零版权），Canvas 渲染 + 桌面双栏 UI。
  已提交 `771009b` 并部署上线 `doin.win/jigsaw/`；线上 E2E 17/17。稳定基线见本轮条目。
- **Klotski**：华容道滑块解谜，50 关递进，Canvas 渲染 + 桌面双栏游戏化 UI。
  已推送部署上线 `doin.win/klotski/`；稳定基线见 2026-09-10 条目。
- **Sudoku / 2048 / Tic-Tac-Toe / Minesweeper / Orbit-Sort / Gold-Miner / Tetris-Neo /
  FreeCell / Snake-Orchard / Zuma / Gravity-Echoes / Tile-Matching / One-Line**：均稳定，
  各自的门禁测试与构建配置见 `package.json` 与 `games/<slug>/`。
- **i18n**：全站游戏均支持 `doin.lang` 共享偏好。
- **交付契约**：`docs/GAME-SPEC.md` + `scripts/check-game.mjs`（T1 fail / T2 warn 两级）。
- **本地服务**：`node _dev-server.mjs`（零依赖，端口 46810 起）。
- **Analytics & SEO**：GA4 `G-D67E3XTNSS` 已接入；集中式构建脚本 `scripts/build-site.mjs` 自动向 `dist/` 所有 HTML 注入统计代码；`sitemap.xml` 自动编译 17 页面；`robots.txt` 声明正常。
- **git**：正常，main 推送成功，workflow 自动构建部署到 gh-pages。

## 2026-09-13 · Link-Up（喜福连连看）接管审计、修复与门户接入

### 做了什么

1. **规则与状态稳定化**：保留确定性种子、反向构建可解生成器、50 关 / 每日挑战 / 异形棋盘 / 四连变体；洗牌只重排剩余牌、连续洗牌递增种子、不复活已消除牌；每日成绩同时保存 `date` / `dailyDate`；终局操作安全 no-op。
2. **UI / 无障碍补齐**：中文 / 英文统一走 `doin.lang`；动态同步按钮 `aria-label` / `title`；选关、帮助、结算弹窗支持初始聚焦、Escape 关闭和 Tab 焦点循环；方向键跳过 hole / empty / removed 格；暂停遮罩、`aria-pressed`、移动端滚动弹窗和 `prefers-reduced-motion` 已覆盖。
3. **真实浏览器 Bug 修复**：Chrome CDP 发现 `SYM_CLASS` 映射包含空字符串，直接 `classList.add("")` 会抛 `Failed to execute 'add' on 'DOMTokenList'`；改为仅在 class 非空时添加，并补静态装配测试。
4. **视觉与门户组装**：新增暖绯红 / 金色 640×640 WebP 软胶封面；以「喜福连连看 / Fortune Link」统一游戏命名；登记 `games.json`，根 `package.json` 注册 `test:link-up`。

### 验收

- `npm run test:link-up` → **54 pass / 0 fail**。
- `node scripts/check-game.mjs link-up` → **19 pass / 0 fail / 0 warn / 0 waived**。
- `node x/link-up/cdp-smoke.mjs` → **23 pass / 0 fail**：真实启动、选关、提示点击消除、暂停 / 恢复、帮助 Escape、选关滚动、1440 / 1280 / 900 / 390 视口、reduced motion、控制台与资源错误检查全绿。
- `npm run test:home` → **5 pass / 0 fail**；`npm run build` → 成功，生成 `dist/link-up/`、封面与 sitemap。

### 已知产品取舍

当前第 1 关配置为 6×6 网格但仅 8 枚牌（4 种图案 × 2），其余格作为可绕行留白；这与 PRD 中「铺满全部格子」的文字描述存在歧义。为避免未经确认改变配对数量、难度和可解生成器，本轮保留现状，并把它记录为下一轮可独立拍板的密度调整项。

### 2026-09-13 · 接管后续真实浏览器复查

- **修复异形棋盘布局错位**：`.cell.hole` 原先使用 `display:none`，Chrome CSS Grid 会移除该格并让后续牌面向前填充，导致第 3 章 / 每日挑战的四角缺口消失、坐标与规则状态不一致；改为 `visibility:hidden` 保留 grid track，并清除背景与指针事件。
- **修复无障碍残留状态**：消除后的牌面按钮会移除旧 `aria-label` / `aria-pressed`，异形缺口与正常牌面之间同步清理 `aria-hidden`；填充牌面显式同步 `aria-pressed`。
- **优化响应式字号**：监听 `window.resize` 与 `visualViewport.resize`，桌面 / 移动端切换或旋转后重新计算牌面字号，避免沿用大屏字号挤出小棋盘。
- **新增真实回归断言**：CDP smoke 追加消除后读屏标签清理、每日异形棋盘四角缺口布局与 40 枚牌渲染检查。
- **键盘与空白路径优化**：棋盘改为 roving tabindex，仅保留一个可 Tab 进入的当前牌面；进入关卡自动聚焦第一张牌；空白路径格设为禁用并从读屏与点击流中移除，但仍保留网格轨道供连线算法绕行。

### 2026-09-13 · Link-Up 键盘可访问性与空白路径复查

- `npm run test:link-up` → **54 pass / 0 fail**。
- `node scripts/check-game.mjs link-up` → **19 pass / 0 fail / 0 warn / 0 waived**。
- `node x/link-up/cdp-smoke.mjs` → **27 pass / 0 fail**：新增单焦点牌面、空白路径不进入读屏 / 点击流回归；桌面 / 移动端、异形棋盘、减少动效、控制台与同源资源检查继续全绿。

### 修改 / 新增文件

```
games/link-up/                      [新增整目录：HTML / CSS / engine / game / UI / render / score / storage / audio / i18n / tests]
assets/covers/link-up.webp          [新增] 640×640 WebP 封面
games.json                          [修改] 登记 link-up 条目（含 en 翻译）
package.json                        [修改] 注册 test:link-up
PROJECT_LOG.md                      [修改] 本轮记录
```

## 2026-09-13 · Pair-Link（连连看）外包任务书 + 亲自生产交付

### 做了什么

1. **先出任务书再动工**：按 `doin-waibao` 技能，依据 `docs/plans/pair-link-prd.md` 产出
   `docs/outsource/pair-link-spec.md`（857 行，八节生产级规格）。PRD 未给的量化规格在此补全：
   - 关卡参数公式 `kinds = [6,8,10][c-1] + floor((k-1)/4)`、`tiles = 56 + 8(c-1) + 4·floor((k-1)/4)`、
     `timeMs = ceil(tiles × [2.20,2.02,1.87][c-1]) × 1000`，并给出全 36 关派生表；
   - 折线求解的**确定性返回序**（0 折 → 1 折 → 2 折，同折数按固定扫描序），避免"同局面时快时慢"；
   - 可解性三层口径：① 成对不变量（每种图案计数偶数）② 每次消除后 `hasAnyPair` 校验，
     失败自动洗牌（上限 50 次）③ 洗牌等价性（只置换位置、不改计数、外圈恒空）。
     **诚实声明不做全局回溯穷举**（80 格状态空间不可行）。
   - 1.6 节「接口预规划」：DOM id 表 + 模块导出契约 + 事件命名，防接口漂移。
2. **三轮交付落地 `games/pair-link/`**：第 1 轮 `index.html` / `favicon.svg` / `css/style.css`；
   第 2 轮 `js/` 10 模块（`motifs` `engine` `score` `storage` `i18n` `audio` `render` `ui` `game` `main`）；
   第 3 轮 `tests/` 4 文件（`engine` `storage` `i18n` `markup`）。
3. **门户组装**：`games.json` 追加第 16 条（`url: /pair-link/`）、根 `package.json` 加 `test:pair-link`、
   新增 `assets/covers/pair-link.webp`（640×640，程序化生成）。根 `index.html` 零改动
   —— 首页卡片网格由 `js/main.js` 运行时读 `games.json` 渲染。

### 验收（两级门禁 + 真浏览器）

- `node scripts/check-game.mjs pair-link` → **19 pass / 0 fail / 0 warn / 0 waived**（T1 全过，零豁免）。
- `npm run test:pair-link` → **77 pass / 0 fail**（含 1200 步随机游走 + 36 关各 60 步 + 全 36 关清盘）。
- `node x/pair-link/cdp-smoke.mjs` → **47 pass / 0 fail**（真鼠标点击消除、键盘、5 档视口、
  空格/外圈计算样式、降级对照组 `no-preference 0.14s` ↔ `reduce 1e-06s`）。
- `npm run build` → 成功；`dist/pair-link/` 扁平化正确、`tests/` 已排除。
- `node x/pair-link/cdp-dist.mjs` → **27 pass / 0 fail**（生产路径 + 门户卡片）。

### 本轮新增的验收范式（可复用）

1. **「画面 = 状态」契约可以不用测试钩子做**：pair-link 没有暴露任何 `window.__xxx`，
   但渲染层把母题写成 `path.setAttribute("d", motif.paths[i])`，且每格 `aria-label` 尾部带母题名。
   于是可以在生产路径上 `await import("/pair-link/js/motifs.mjs")` 拿部署后的母题表，反查画面：
   ① 每个母题名都命中母题表；② 每条 SVG `d` 都命中母题表；③ **种类数 === 该关 `kinds`**；
   ④ **每种出现次数为偶数**（成对不变量在画面上成立）。
   ③④ 才是真判据 —— 它们能区分"画面 = 状态"和"画面是张静态图"。
2. **封面程序化生成要"算材质"而不是"填色块"**：直接复用 `x/jigsaw/make-cover.py` 的
   镜面高光 / 环境光遮蔽 / 轮廓光 / 底部厚度 / 投影五件套，比平铺色块强一个量级。
   踩到的两个坑：① 陪衬元素若靠"整层乘一个 dim 系数"压暗，暖白会退化成灰橄榄，看着像石头
   —— 应改为**换一套釉色渐变**而不是压暗；② 装饰连线若终点落在主体包围盒内会被完全遮住，
   必须在合成前先算一遍包围盒，把可见段留在主体之外。
3. **固定 `sleep` 是脆弱断言**：`sleep(2200)` 等 10 个模块的依赖图会偶发不够，
   必须改成轮询等待 + 超时时 dump 页面状态（`readyState` / `outerHTML` 头部 / 已加载脚本）。
   这次的 dump 直接把问题从"疑似时序"定位到"服务端返回 404"。

### 踩到的坑

1. **`node:fs` 与 `node:fs/promises` 混用**：验收脚本里 `import { readFile, stat } from "node:fs"`
   却按 promise 风格 `await readFile(p)` 调用 → 报 `The "cb" argument must be of type function`，
   外层 catch 一律吞成 404，表现为"页面全白、连 `<title>` 都没有"。
   **回调版与 promise 版必须分开 import。**
2. **Windows 上 `chrome.kill()` 杀不掉真正的浏览器进程**：只杀启动器，无头 Chrome 会残留。
   稳妥做法是在收尾时先发一次 CDP `Browser.close` 再 `kill()`。
3. **源码内相对 import 不能带 `?v=dev`**：Node 原生测试无法解析查询串（`MODULE_NOT_FOUND`）。
   只有 HTML 的 `<link>`/`<script src>` 带占位，由构建脚本 `replaceAll` 替换。
4. **`node --test <目录>` 静默跑不出结果**：必须显式列出测试文件。

### 补充：把两条自评缺口收口（改为程序化验证）

上一轮把「12 母题两两可辨」标成"只能人眼"，其实可以程序化验证；而且当时还缺一条更关键的
——**没有任何测试证明 36 关真能清盘获胜**（只有"开局存在可消对"和"前 60 步不抛错"）。

1. **全 36 关清盘验证**（`tests/engine.test.mjs` 新增）：用 `findAnyPair` 贪心求解每一关，
   从头清到空。任何一次 `findAnyPair` 返回 null 都意味着自动洗牌没能化解死局。
   实测 36 关全部 `phase=won`、恰好消掉 `tiles/2` 对、清盘后棋盘为空。
   - **捕获力已验证**：临时把 `allocateCounts` 改成奇数计数（多出一块永远无法配对的瓷片），
     该用例转红（`phase=lost, failReason=deadlock`），另两条相关用例同时转红；
     从 `x/pair-link/engine.mjs.orig` 还原后 77/77 全绿（md5 与注入前一致、`git diff` 为空）。
   - **诚实记录**：注入 `resolveDeadlock` 空实现时这条用例**仍然通过** —— 说明 36 关在贪心
     求解下从不触发死局，自动洗牌路径没被这 36 关走到（它由专门的死局单测覆盖）。
     不要误以为这条用例守住了洗牌逻辑。
2. **母题可辨性**（`x/pair-link/cdp-motifs.mjs`，6 项）：真浏览器用 `Path2D` 把 12 个母题
   光栅化成 64×64 剪影，算两两形状差异 + 两两平均色曼哈顿距离。
   实测：墨量 24.6%~52.0%（无空墨）、形状差异 min 7.8%、颜色距离 min 53、无剪影完全相同、
   100% 的对在形状上就有明显差异。
   - **踩坑**：第一版用纯 Node 手搓光栅化，flattener 不支持椭圆弧 `A` 指令，
     导致 `圆环 / 涟漪 / 月牙` 剪影墨量为 **0%** —— 工具坏了却"看起来在跑"。
     是脚本里那条**测量自身健全性**断言（每个母题墨量必须落在 3%~85%）把它抓出来的。
     **教训：测量脚本必须自带"测量本身是否有效"的断言**，否则测出的是工具的 bug 而非被测对象的。
3. **颜色可辨性进单测**（`tests/engine.test.mjs` 母题表用例）：断言任意两母题的平均色
   曼哈顿距离 ≥ 30（实测最小 53）。只断言"tint 名字不同"是**数据**不同，不是**玩家看得出**不同。

### 修复：消除后的空格残留"插座"轮廓（用户报障）

**现象**：用户报「消除的格子 应该没有格子 就是背景」。清掉若干对之后，空格位置仍留着
一圈淡淡的圆角轮廓，外圈通道还额外是虚线 —— 整片空棋盘看起来像一排排空插槽，
玩家分不清"这格已经消掉了"和"这格还有东西"。

**根因**：`css/style.css` 的 `.cell::after` 对**每一个**格子都画了轮廓
（`inset: 6%; border-radius: 22%; border: 1px solid rgba(243,230,210,0.045)`），
`.cell.is-void::after` 又把它改成 `dashed`。而任务书 1.4 只给**外圈通道**规定了
「以极淡网格线（`rgba(243,230,210,0.07)`）暗示可绕行」，**对已消除格没有任何外观要求**。
所以这是**实现偏离规格**，不是需求扩展。

**修复**（`cf9fa27`）：
- `.cell.is-empty::after { border-color: transparent; }` —— 空格就是纯背景；
- `.cell.is-void::after { inset: 0; border: 0; border-radius: 0; border-right/bottom: 1px solid rgba(243,230,210,0.07); }`
  —— 只画右 / 下两条边，避免相邻格叠成双线，同时去掉圆角与 inset，否则又退化成一格格插座。

**新增 3 条真浏览器计算样式回归断言**（`x/pair-link/cdp-smoke.mjs`，读 `getComputedStyle(n,"::after")`）：
① 空格可见边数 === 0；② 外圈不再有 `dashed` 且 `border-radius === 0`；
③ 外圈所有**已绘制**的边 alpha ≤ 0.10。
- **踩坑**：第 ③ 条初版写成"所有边 alpha ≤ 0.1"→ 恒假。因为 `border: 0` 只重置**宽度**，
  颜色仍是默认的 `rgb(243,230,210)`（alpha 1），未绘制的边也被算进来了。
  改为 `widths.every((w,i) => px(w) === 0 || alpha(colors[i]) <= 0.1)` 才对。
- **捕获力已验证**：把 CSS 临时退回缺陷版 → 第 ① ② 条转红（`可见边数=4`、
  `styles=["dashed",...] radius=22%`），第 ③ 条按设计仍绿。从 `x/pair-link/style.css.fixed`
  还原后 47/47 全绿，md5 与注入前一致。

### 待办（已随下一轮拍板全部关闭）

- 三项拍板已由用户给出：**冰封壳首发（1B）**、**加「每日一盘」（2B）**、图案题材维持抽象琉璃几何（3B）。
  落地见下一节。
- 用户已选择**只本地提交、暂不推送**（本游戏相关提交 `c093d0c` → `7cff4a4` → `cf9fa27`），
  故生产域名尚未上线本游戏。推送需用户明确指示。
- 仅剩人工目视项：三线连通（0/1/2 折）的手动试玩手感。
  （12 母题可辨性已由 `x/pair-link/cdp-motifs.mjs` 程序化覆盖。）

## 2026-09-13 · Pair-Link 首发增强：冰封壳 + 每日一盘 + 空格残留根治

> 用户四条并行指令：①「pair-link 与 link-up 是两个并行的项目，你只管你的！」→ 只改 pair-link，
> 绝不触碰 `games/link-up/`、`docs/plans/link-up-prd.md`、`docs/outsource/link-up-spec.md`；
> ②「首发」= 冰封壳进首发；③「加「每日一盘」。」；④「空的格子就不要存在！」

### 1 · 根治"消除后仍有空格残留"（用户第二次报障，这次才找到真根因）

**上一轮为什么没治本**：只把 `.cell::after` 的轮廓改成透明，断言也只读 `::after` 的计算样式 →
**全绿却依然看得见**。断言与缺陷不在同一层，看不见它。

**真根因**：`.tile` 的 `background` 用的是 **`var(--tile-lt, #e8b768)` 带回退色**。
`paintTile()` 消除时只 `removeAttribute("style")` —— 内联变量没了，**回退色还在**，
于是每个已消除格继续渲染一枚**没有图案的纯金色方块**。

**修复**：`.cell.is-empty .tile { display: none; }`；同时删掉整块棋盘的网格线
（`.cell::after`、`.cell.is-void::after`、`.cell.is-breath::before` + `@keyframes breath`、
`.cell:focus-visible::after`）——已消除格与外圈通道一律纯背景。

**断言升级为"可见表面"三层 + 真像素等价性**（`x/pair-link/cdp-smoke.mjs`）：
1. 已消除格的**瓷片本体** `display:none`（不再画无图案色块）；
2. 已消除格的**格子自身**无背景/边框/伪元素；
3. 已消除格的**母题 SVG** 无残留可见内容；
4. **真像素等价性**：把全部空格 / 通道格 `visibility: hidden` 后截图，必须与之前**逐字节相同**。
   这条与具体装饰无关，只要还画了东西就必然不等 —— 是决定性判据。
   ⚠️ 比较前必须先冻结所有动画（背景有 26s `drift` 光晕 + 半透明棋盘底 `rgba(36,26,21,.86)`，
   否则两次截图本就不同，断言恒假）。

**捕获力已验证**：把 CSS 退回缺陷版 → 3 条转红，detail 正是那块金色瓷片
`{"display":"flex","bg":"image","paints":true}`；从 `x/pair-link/style.css.fixed` 还原后 md5 一致。

### 2 · 冰封壳（首发特殊块，拍板 1B）

- **编码**：棋盘值 `v ∈ [1,12]` 为裸块，`v + MOTIF_COUNT ∈ [13,24]` 表示带壳。
  好处：「非 0 即有块」判定零改动、`shuffleBoard` 置换值数组时壳自动跟随、无需平行 `frozen` 数组。
  读母题走 `motifOf()`，判壳走 `isFrozenValue()`。
- **数量**：`F(L) = [0,4,8][c-1] + [0,1,2][c-1] × floor((k-1)/4)` → 第 1 章 0，第 2 章 4/5/6，第 3 章 8/10/12。
- **规则**：带壳块不可点选、不参与配对（点它 → `action.type === "frozen"`，冰蓝抖动 + 提示）；
  其 **8 邻域（含斜向）** 内瓷片被消除时壳震碎（`iceShatter` 动效），恢复可点选。
- **可解性联动**：`findAnyPair` / `hasAnyPair` 跳过带壳块；死盘兜底顺序
  「洗牌 → 若仍无解且有壳则 `meltAll` 融壳 → 再洗牌」，`resolveDeadlock` 返回 `melted` 标记。
  **绝不把死盘交给玩家。**
- **无障碍**：带壳格 `aria-label` 追加「冰封」、`cursor: not-allowed`。

### 3 · 每日一盘（拍板 2B）

- `dateKey`（**本地时区** YYYY-MM-DD，不能用 UTC）→ `hashSeed("pair-link:daily:" + key) % 36 + 1` 挑关、
  `hashSeed("pair-link:daily-board:" + key)` 出种子。
- **同一天全服同一副盘面**：刷新、点「重玩」都逐格相同（有专门用例守护）。
- **与主线完全解耦**：结算只写 `progress.daily`，`unlocked` / `levels` / `lastLevel` 一律不动。
  存档 `v` 保持 `1`（追加字段而非破坏性变更），老档不丢主线进度（有专门用例守护）。
- 匾额显示 `MM-DD`、章名「今日灯市」、结算按钮「返回选关」。

### 新增 / 修改文件

- `games/pair-link/css/style.css`（空格根治 + 冰封壳霜层/裂纹/抖动/碎裂 + 每日一盘条块样式）
- `games/pair-link/js/engine.mjs`（779 → ~950 行：壳编码、8 邻域震碎、融壳兜底、每日一盘派生）
- `games/pair-link/js/storage.mjs`（`daily` 字段 + `dailyBest` / `recordDaily`）
- `games/pair-link/js/ui.mjs`、`js/main.mjs`、`js/i18n.mjs`（中英各 +12 键）、`index.html`
- `games/pair-link/tests/engine.test.mjs`（77 → 94 条）、`tests/storage.test.mjs`（+7 条）
- `x/pair-link/cdp-smoke.mjs`（47 → 50，弱断言换真像素等价性）
- `x/pair-link/cdp-features.mjs`（新建，32 项：冰封壳 + 每日一盘）
- `x/pair-link/cdp-dist.mjs`（27 → 34 项）、`x/pair-link/shot-clear.mjs`（新建，从画面反推棋盘求解）
- `docs/plans/pair-link-prd.md`（新增 §6 拍板结果）、`docs/outsource/pair-link-spec.md`（同步规格）

### 验证结果（全绿）

- `npm run test:pair-link` **101 / 0**
- `node scripts/check-game.mjs pair-link` **19 pass / 0 fail / 0 warn**
- `x/pair-link/cdp-smoke.mjs` **50 / 0**（含两条真像素等价性、降级对照组）
- `x/pair-link/cdp-motifs.mjs` **6 / 0**
- `x/pair-link/cdp-features.mjs` **32 / 0**（含带壳第 13 关贪心打通清盘、每日盘确定性/解耦）
- `x/pair-link/cdp-dist.mjs` **34 / 0**（生产路径 + 门户首页卡片）

### 踩坑记录

- **生产路径验收两条 FAIL 全是"测试写错"**：`#btn-daily` 在 `#panel-start` 内，
  先点「暂停 → 选择关卡」会把 `#panel-levels` 打开并**盖住**开始面板 → 点了没反应，
  被误读成产品缺陷（`open:true, plaque:"1"`）。改为 `Page.navigate` 回干净开始面板再点。
  **一般规律：点被遮挡的按钮前先确认它所在面板是可见的。**
- **`cdp-features.mjs` 崩溃**：`INSTALL` 模板里残留 `return true;` 把后续 `return {...}` 截断。
- **`shot-clear.mjs` 参数解析**：`Number(process.argv[2] || 12)` 使传 `0` 变 12，
  改为 `process.argv[2] === undefined ? 12 : Number(...) || 0`。
- 单测里我自己写的坐标 `(1,1)`/`(2,2)` 是**斜向相邻**，本就在 8 邻域内 → 断言失败。
  改用 `(1,4)`/`(6,6)`，并**补了一条"斜向必须震碎"的用例**（正是这次错误暴露的盲点）。

## 2026-09-13 · Pair-Link 桌面 UI 排版优化（方格线 + 控制台归位 + 剩余对数）

> 用户指令：「桌面端UI 排版优化，注意游戏美学，功能按钮不要离棋盘太远。
> 另外棋盘最好有方格线（淡化一点）便于用户心算。其它你自己考虑优化」

### 改动
1. **控制台归位到棋盘正下方**：把 `.tool-dock`（提示/洗牌）与 `.ctrl-dock`（暂停/重开）
   从 `#hud` 移入新建的 `#console`，紧贴 `#board` 之下。桌面量得 棋盘→控制台间距 12px、
   控制台与棋盘等宽（widthDelta 0px）；原先工具盘/控制盘在侧栏，1024/1280 下落后棋盘中心
   115~168px，宽屏（1920）侧栏甚至被推到 230px 外。
   `#stage` 改 `justify-content: center` + `#board-col` 以
   `flex-basis: calc((100dvh - 150px) * 1.2)` 占主列，消除宽屏 230px 空隙。
2. **棋盘方格线（淡化，画在容器上）**：`#board` 用两份 `linear-gradient` 网格层
   （`calc(100%/12)` × `calc(100%/10)`）+ 一层底色合成，平铺周期严格等于单格尺寸。
   `--grid-line` alpha 0.10 → 0.14（仍淡，内部线起伏约 19.7，在"可辨但不刺眼"区间）。
   **关键约束**：线画在容器 `background` 上，**不在 `.cell` 上** —— 这样"空格/外圈不画任何东西"
   不变量不被破坏，真像素等价性断言（隐藏空格后截图逐字节不变）依旧成立。
3. **新增「剩余对数」匾额 + 进度条**：`#hud` 加 `plaque-progress`，`js/ui.mjs` 在
   `render` 里写 `pairs-left` 与 `progress-fill` 宽度；`js/i18n.mjs` 补中英 `pairsLeft` 键。
4. **Toast 改到右下角 + `pointer-events: none`**：原 `#toast` 居中贴在底部，控制台归位到棋盘下后
   正好盖住居中的「暂停」键 → 点击被吞（**真实 UX bug**，非测试写错）。改为 `right:24px` 后修复。

### 验证（全绿）
- `cdp-smoke` **53 / 0**（原 50 → 53；新增方格线像素探针 3 项）
- `check-game` 19/0、`test:pair-link` 101/101、`cdp-dist` 34/0、`cdp-features` 32/0、`cdp-motifs` 6/0

### 踩坑（可复用）
- **像素探针必须在关闭带 `backdrop-filter: blur` 的遮罩后跑**：开始面板的 blur(7px) 会把 1px
  方格线糊成噪声，导致"线没画"的假阴性。把 `#btn-continue` 点击移到探针之前即解。
- **局部凹凸探测替代全局中点阈值**：`hi` 被左/右边框那 1 个超亮像素（~95）抬到 60+，
  会把真正只有 ~47 的网格线峰过滤掉 → `found=[]`。改用"期望线附近局部峰 − 两侧低谷"判定，
  且"淡化"幅度只取内部线（跳过边框），散峰阈值绑定 `faded×0.6` 排除底色/AA 噪声。
- 提交边界：本次只动 `games/pair-link/` 4 个文件；`games.json`/`package.json` 的改动属并行
  `link-up` 项目，不纳入本次提交。

### 修改文件
- `games/pair-link/index.html`、`css/style.css`、`js/ui.mjs`、`js/i18n.mjs`
- `x/pair-link/cdp-smoke.mjs`（方格线像素探针 + 时序修正）

## 2026-09-13 · Pair-Link 关卡难度重调（方案 A：每 2 关一档 + 抬高章节基数）

> 用户反馈：「梳理关卡难度，当前我试玩了前三关，感觉太简单」。
> 诊断：原 `step = floor((k-1)/4)` 使 L1–4 完全同参（6 种类 / 56 块 / 124s / 0 冰封），
> 且章节基数偏低（6/8/10、56/64/72、2.20/2.02/1.87），前三关几乎没有坡度。
> 拍板：方案 A（推荐）——台阶缩到每 2 关进一档，并抬高章节基数。

### 改动（`games/pair-link/js/engine.mjs`）
- 章节常数：`CHAPTER_KINDS = [7, 9, 11]`、`CHAPTER_TILES = [60, 68, 76]`、`CHAPTER_SECONDS = [1.90, 1.80, 1.70]`。
- `levelParams()`：`step = floor((k-1)/2)`，`kinds` 取 `min(12,…)`、`tiles` 取 `min(80,…)` 封顶。
- 冰封壳 `[0,4,8] + [0,1,2]·step` → 第 2 章 4/5/6/7/8/9，第 3 章 8/10/12/14/16/18。

### 派生表（全 36 关，S/种类 N/块 T/s）
- 第 1 章：`7/60/114`(L1-2)、`8/64/122`(L3-4)、`9/68/130`(L5-6)、`10/72/137`(L7-8)、`11/76/145`(L9-10)、`12/80/152`(L11-12)
- 第 2 章：`9/68/123`(L13-14)、`10/72/130`(L15-16)、`11/76/137`(L17-18)、`12/80/144`(L19-24)
- 第 3 章：`11/76/130`(L25-26)、`12/80/136`(L27-36)

### 同步更新
- `games/pair-link/tests/engine.test.mjs`：36 关 `kinds/tiles/timeMs/frozen` 硬编码派生表按新公式改写。
- `docs/outsource/pair-link-spec.md` §1.3.8：章节概览表、参数公式、`min(12/80)` 封顶、全 36 关派生表同步。
- `x/pair-link/cdp-*.mjs`：L1 瓷片数 56→60、kinds 6→7；L13 瓷片数 64→68、消除后 64→66；
  首页卡片数 16→17（games.json 已登记 17 款）。均为反映新参数的断言刷新，非游戏逻辑改动。

### 验证（全绿）
- `test:pair-link` **101/0**（含全 36 关贪心清盘无死局、带壳块数=参数）
- `check-game` **19/0**、`npm run build` 成功
- `cdp-smoke` 53/0、`cdp-dist` 34/0、`cdp-features` 32/0、`cdp-motifs` 6/0（参数变更未引入回归）

### 提交边界
- 只动 `games/pair-link/js/engine.mjs`、`tests/engine.test.mjs`、`docs/outsource/pair-link-spec.md`、
  `x/pair-link/cdp-*.mjs`；`games.json`/`package.json` 改动属并行 `link-up` 项目，不纳入。保持本地，不推送。

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

### 封装与发布

用户指令「封装本游戏 并提交发布」；经询问，提交范围选择 **「全部合并为一个提交」**。

| 项 | 值 |
|---|---|
| 提交 | `771009b feat(jigsaw): add jigsaw puzzle game with procedural artwork and game-styled UI` |
| 规模 | 37 文件 / +9206 / −391 |
| 推送 | `4950493..771009b  main -> main`（fast-forward，已用 `merge-base --is-ancestor` 预检） |
| 部署 | 轮询 `https://doin.win/jigsaw/`，第 5 次由 404 转 **200** |

**提交刻意合并了并行改动**（AGENTS.md 通用化重构、两个新 skill、jigsaw + sokoban PRD、
COVER-STYLE/GAME-SPEC 刷新、klotski CRLF 修复），并在提交正文逐条列明，避免日后归属不清。

**生产产物校验**：`?v=771009ba7c2f`（= commit SHA 前 12 位）已注入 `style.css` / `main.mjs`；
`v=dev` 残留 **0**；GA4 注入 2 处；`#panel` / `#level-bar` / `#hud-score-bar` / `.burst` /
`#btn-home` 均存在；封面 `200 image/webp 12880 字节`（与本地一致）；sitemap 16 条含 `/jigsaw/`；
gh-pages `CNAME = doin.win`。

**线上 E2E（`x/jigsaw/cdp-prod.mjs`）17 pass / 0 fail** —— 对真实 `doin.win` 跑真浏览器：

- 首页 15 张卡片；拼图卡片 `href=/jigsaw/`、标题「拼图」、`soon=false`、封面 `naturalWidth=640`
- 游戏入口无 404、50 关载入、首关 3×3 / 满分 800、`phase=playing`
- **切片契约线上成立**：每格画的是该格碎片的原位图案，不一致 **0/9**；9/9 格可见打乱
- 真实指针拖拽完成交换 `{moves:1, locked:1}`；可拼完并弹出结算 `800/800`
- 390px 不横向溢出；移动端棋盘 350×350 正方形

**为什么必须写这个脚本**：首页卡片是 **JS 客户端渲染**，`curl` 抓到的 HTML 里
`jigsaw 卡片链接数: 0 / 首页卡片总数: 0` —— 静态抓取永远验证不了客户端渲染的内容。
以后验收"线上首页是否正确列出某游戏"，只能用无头浏览器。

**发布期踩坑**：
1. 沙箱内写 `/tmp` 会**静默失败**（curl 报 `http=200` 但文件没落地，后续 grep 报 no such file）→ 改写到工作区 `x/` 下。
2. `gh` CLI 未登录（`gh run list` 要求 `gh auth login`）→ 改用**轮询生产 URL** 判断部署完成，比等 API 更直接。


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
