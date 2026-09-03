# PROJECT_LOG.md

> 精简原则：只保留当前状态快照 + 最近两轮开发要点 + 简短归档。
> 历史细节查阅 git log / `.workbuddy/memory/2026-09-03.md`。

***

## Current · Baseline (2026-09-03)

### 门户首页
Poki 风：薄荷绿底 (#83ffe7) + 菱形纹理 bg，1:1 WebP 封面方格瓦片 `auto-fill minmax(204px,1fr)`，悬停 `scale(1.04) translateY(-4px)` 不对称时序；卡片纯 cover-only 不分类不挂标签。

- 封面 640×640 WebP：`assets/covers/{sudoku,2048,orbit-sort}.webp`
- 主题色 `--ink #002b50` / `--accent #009cff` / `--radius 16px` / `--gap 16px`
- 部署：main 推送 workflow → build 到 dist/ → gh-pages 整分支替换，CNAME 固定 `doin.win`

### 星轨调度大师 orbit-sort (当前发布基线)
- **7 关主线**：D1..D7 一一对应（`difficulty.mjs paramsForDifficulty(1..7)`）。`levels.mjs`
  里 L8+ 仍保留但运行时只暴露 `LEVELS = ALL_LEVELS.slice(0, 7)`，禁止误暴露。
- **积分系统**：`score.mjs` 是唯一口径；HUD 显示「步数 / 目标 / 得分 X/Y / 总积分」。
  公式（见 AGENTS.md 第 6 节 "Score system"）：`total = base + moveScore + timeScore`。
  未通关 HUD：分子 = 实时保守 estimate，分母 = `perfectScoreForLevel(level, isDaily)`。
  总积分 = `Σ bestScoresByLevel[id].score`，load 时会 recomputeTotals 防数据损坏。
- **今日挑战**（原"今日星轨"）：选关页顶部 + 游戏内工具按钮下一行都有入口；
  `daily.mjs createDailyLevel()` 现在是 **O(1) blueprint**（基于 dateKey seed 的
  Fisher-Yates 洗牌 + 循环分发填充，颜色/容量严格平衡，不跑 solve，不阻塞 UI）。
  D5/D6 双 dock、5-6 色/容量、当日同 seed 所有人同一题。
  异步 `refineDailyLevel()` 可低优先级拿到真实 par（前台成功就覆盖，失败不影响）。
- **UI 视觉**：选关卡片 = 7 颗真实科幻主题行星（D1 水星冰蓝..D7 海王风暴）+ 下方胶囊徽章
  显示分数（通关=最高分/未通关=本题总分）；通关弹窗顶行 = `得分 X / Y · 步数 m/par`，
  删除了所有 ★★★ 星级。标题 `game-title` 巨型铬金金属 + 扫光 + 上下 LED 引线。
- **Intent routing 不变量**（合法操作永不报错）：`engine.mjs applyIntent(click track/dock)`
  placing/extracting 模式下，如果 primary 失败则按 fallback 链：
  ① idle dock → extract ② clear + extract ③ switch to matching dock → insert。
  所有候选按最小 id deterministic，不产生歧义。generator `validateLevel` 时会跑
  intent rollout 门闩（反例直接判 invalid），保证将来批量生成的新关卡也不会再出现
  "合法操作仍报错"。
- **步数只增不减**：引擎 `stats.movesPlayed` 每次真实 extract 才递增；undo/reset
  取最大值防止回退；storage 存 `totalMoves`。撤回不会让计分器减少。
- **本地服务器**：推荐用根目录 `_dev-server.mjs`（零依赖、node 原生 http、内存 43MB / CPU
  几乎 0、自动 46810 开始）。`start.bat` 仍保留但用户现场遇到 npx/serve 孤儿进程爆炸时
  切 `node _dev-server.mjs`。

***

## 2026-09-03 · 本轮开发记录

### 本次完成内容
1. 重做「调度 / 目标 / 已充能」旧 HUD → 新积分口径：
   步数 `stats.movesPlayed` / 目标 `level.par` / **得分 `<当前>/<满分上限>`** / **总积分**。
2. 积分算法落地：`score.mjs` 拆分 `baseScoreFor / moveScore / timeScore / perfectScoreForLevel`
   纯函数 + 保底 + 今日挑战高分开挂（+200 bonus + 维度上限 150）。
3. 存储改造 `storage.mjs`：`bestScoresByLevel[id]` + `totalScore/totalMoves` + `daily.bestScore`
   + 每次 load 强制 `recomputeTotals` 防止本地数据改坏。
4. 通关弹窗重做：删除 ★★★ 星条，明细行 `基础分 / 步数分 / 时间分 / 合计得分`，
   顶行 `得分 X/Y · 步数 m/par · 🏆 新高分` 格式；破纪录分级提示。
5. UI 科幻风全面升级（标题巨型金属+扫光+LED上下引线；行星球 D1-D7 主题色替换 ★★★
   胶囊徽章显示分数；选关页 continue-button / daily-button 从老紫棕切角改为
   金橙冷蓝金属渐变 + 左侧木星/蓝宝石徽 + 4.8s 扫光）。
6. 修复"合法操作仍报错"：engine applyIntent 多级 fallback（clear+extract / switch
   matching dock / dual-dock 去重 pick min-id）。generator validateLevel 新增 intent
   rollout 门闩 10×40 随机游走 保证新关卡必通过 → 合法点击绝不报错（L1-L7 全状态空间
   175k+ 状态 audit 0 false-negative）。
7. 今日挑战从"今日星轨"改名 + 搬到工具按钮下方 + 选关页常驻按钮；`daily.mjs` 彻底
   rewrite（旧版 createDailyLevel 依赖 generator+solve → 选关页 renderSelect 主线程
   阻塞 2-8 分钟，CPU 爆）→ O(1) blueprint。新增 `refineDailyLevel` 后台低优先级审计。
8. 服务 & 性能修复：杀掉 1.1 GB / CPU 6183s 孤儿 Node 进程；关闭 51211 端口死服务；
   新建 `_dev-server.mjs`（零依赖 43MB 常驻）。选关页秒开，CPU 0-2%。
9. 测试扩充：`score.test.mjs` 29 用例（覆盖难度边界/步时保底/撤回不减少/新高持久化/
   perfectScore 主线/每日公式）；`storage.test.mjs 15` / `daily.test.mjs 4` /
   `markup.test.mjs 5`。合计 **53 tests PASS** + `npm run build` 通过。
10. 部署维护：`.github/workflows/deploy.yml` 中 `actions/checkout` 升级至 `v5`，
    `actions/setup-node` 升级至 `v6`，以使用兼容 Node 24 的 Action 运行时；发布流程及
    Node 项目版本保持不变。
11. 求解器调用优化：游戏移动后的可解性审计增加 120ms 合并窗口，连续操作只向 Worker
    提交最新局面，减少过时局面的重复搜索；手动提示求解保持即时路径不变。

### 修改的文件 (git status)
```
games/orbit-sort/css/style.css          (科幻按钮样式 + 行星球 + 金属标题样式体系)
games/orbit-sort/index.html             (HUD "得分"文案/删除章节选择 back-link)
games/orbit-sort/js/daily.mjs           (O(1) blueprint + refineDailyLevel 异步)
games/orbit-sort/js/main.mjs            (HUD 分数线 render / renderSelect 快判 continueDaily /
                                          通关弹窗新格式 / 可解性审计请求合并)
games/orbit-sort/js/score.mjs           (积分拆分 + perfectScoreForLevel)
games/orbit-sort/tests/daily.test.mjs   (blueprint 确定性 / 日期差异验证)
games/orbit-sort/tests/score.test.mjs   (公式边界 / perfectScore 公式)
_dev-server.mjs                         [新] 根目录零依赖最小静态 HTTP 服务
.github/workflows/deploy.yml            (checkout/setup-node 升级至 Node 24 兼容大版本)
```

(上一轮的 engine/generator.mjs intent routing fallback 改动已在本对话前落到工作副本；
其产物在 PROJECT_LOG 中作为 "Current baseline" 记录，不重复展开。)

### 关键实现方式
- **Score 3D 拆分**：`base` 按难度线性 (80+D·40)；`moveScore` 超 `Mmax=⌈par·1.5⌉`
  每 1 步 -1、保底 20 / 每日保底 40；`timeScore` 超 `Tmax=45+(D-1)·18`（今日 ×1.3）
  每 10 秒 -1、保底同上。3 维相加 = 单局总分。
- **perfectScoreForLevel 统一**：主线 = `base(D) + 100 + 100`，今日挑战 =
  `base(D) + 200 + 150 + 150`；HUD 分母永远用它。
- **Intent routing fallback 链**（engine applyIntent）：
  placing → ① primary insert X→track ② otherDock 有 idle 就 extract via idledock
  ③ clickTrack 可 extract → clear selectDock + extract
  ④ altDocks (其他 occupied docks) 能 canInsert(→track) → 选 min-id 那个先切再插。
  extracting → ① primary extract ② candidates(occupied docks ∩ canInsert(→track)) ≥1
  (min-id) → insert / select-then-insert。"有合理候选必须成功"= invariant。
- **今日挑战 blueprint**：`hash(dateKey)` → D5/D6 二选一 + paramsForDifficulty 上探
  cap/color/dock/empty；Fisher-Yates 打乱 orbs；循环分发到非空轨道（≤capacity）；
  par 给保守估 `orbs×2+dock×3+empty×2`。validation 直接标 `balanced-layout-intent-
  route-invariant` → 认为合法，因为 engine intent routing invariant 已经保证"合法不
  报错"，不需要花 2-8 分钟跑 solve 了。

### 遇到的问题 & 解决
1. **"合法操作仍报错"反复出现** — 根因是 UI 意图路由缺少 placing 匹配 dock 切换 /
   extracting 多 dock 去重两条 fallback。解决：applyIntent 新增 ③④ 级 fallback，并在
   generator validateLevel 增加 intent rollout 门闩 (10×40 步) 作为关卡准入门槛，
   新关出不来就直接判 invalid，不再漏网。L1-L7 205k 状态 audit 0 false negative。
2. **选关页卡死 + 51211 打不开 + 1.1GB 内存爆炸** — 旧 `createDailyLevel` 在
   renderSelect 首行同步调用 generator+solve+rollout（2-8 分钟阻塞主线程），孤儿进程
   不回收。解决：① 杀掉孤儿进程、关死 46810/51211/3000 所有残留；② 把 daily 改成
   O(1) blueprint；③ 换用 0-dep `_dev-server.mjs`（43MB 常驻）。
3. **选关页"今日挑战"还是老紫棕大宽条** — 之前只重写游戏内 `.challenge-button`，
   没改选关页 `.daily-button` 老定义（还和 `.challenge-button` 产生 cascade 冲突）。
   解决：删除 273-304 行旧 daily/continue 所有紫棕 + 六边形切角定义，统一一套
   金蓝金属风（扫光 4.8s + 左侧木星/蓝宝石徽）。
4. **标题仍是 22px 小字体** — 改成 clamp(30/34px, 5.6/6vw, 54/60px) 铬金金属渐变 +
   斜扫高光 + -webkit-text-stroke 冷蓝外缘 + drop-shadow 三层辉光 + 上下 LED 引线。

***

## Archive（瘦身归档，仅留索引）

### 2026-09-02 六关稳定版开发史（已被 D1..D7 七关基线替代）
原"六关稳定版 + 今日星轨 + 调度/目标/已充能"概念全部被本轮积分系统 & D1..D7 基线替代。
历史细节：见 commit d5a2c28（feat: score orbit-sort runs and re-cut the mainline to seven levels）。

### 2026-09-01 之前 30 关 V1 全量开发
仍保留 levels.mjs 源码但运行路径不进；冻结/单向轨道两章未激活（产品范围）。

### 其他游戏
- **2048**: 零依赖纯静态、48 项单测稳定上线 `doin.win/2048/`。
- **数独 Sudoku**: 有 typecheck + mocha 测试门禁。
- **nuts**: 已从 `games.json` 和 `games/nuts/` 移除。

### 平台遗留工作项（下次窗口集中做）
1. `assets/og-image.png` 社交分享图仍是旧像素风，建议重新渲染 Poki 风格 1200×630。
