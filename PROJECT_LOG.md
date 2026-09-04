# PROJECT_LOG.md

> 精简原则：只留状态快照 + 最近一轮要点。细节查 git log / `.workbuddy/memory/`。
> 游戏稳定规则写在 AGENTS.md（§5 orbit-sort / §6 tic-tac-toe / §8 minesweeper），本文件不重复。

***

## Current Baseline (2026-09-04)

- **门户**：Poki 风首页（`index.html` + `css/`），640×640 WebP 封面，CNAME `doin.win`。
- **orbit-sort**（已稳定）：5 章 × 20 题（100 关）、积分系统、今日挑战。规则见 AGENTS.md §5。
- **tic-tac-toe**（已稳定）：3×3/4×4、难度=失误率、本地双人、WebAudio 音效。规则见 AGENTS.md §6。
- **minesweeper**（已稳定，本轮）：经典四难度 + 无猜保证 + 计分存档 + WebAudio 音效 + Neon Grid 主题。规则见 AGENTS.md §8。
- **本地服务**：`node _dev-server.mjs`（零依赖，端口 46810 起）。

⚠️ **git push 仍未解决**：缓存 token 属于 `ai919`、仓库 owner 是 `ai717` → 403。
main 领先 origin/main（09-03 起至少 5 commit，本轮扫雷改动尚未 commit）。恢复方式见 Archive。

## 2026-09-04 · Minesweeper：MVP → P2（本轮收尾）

### 做了什么
- **MVP**：从零新增扫雷子游戏。
  - `engine.mjs`：延后布雷（首击排除 8 邻域 → 必安全且展开一片）、BFS flood 输出
    `lastRevealed`（供波纹动画）、chord 速开（点已揭数字格即触发）、胜利自动插旗、
    无效果返回同一引用（合法操作永不报错）。
  - `solver.mjs`：单点规则 + 子集规则迭代到不动点判"纯逻辑可解"；首击 `pickNoGuessSeed`
    线性探测可解种子；运行时 `resolveDeadlock` 死局免费透视一个安全格。
  - UI：DOM + CSS Grid、右键/长按(320ms)插旗 + 旗帜模式、计时/雷数 HUD、结算浮层、
    Neon Grid 深色霓虹主题；PIL 生成 640×640 封面、登记 `games.json`、全量构建上架。
- **P2（计分/存档/音效）**：
  - `score.mjs` 唯一口径：`total = base + time`，仅通关计入；base 120/280/560（保底）；
    time = `round(base×0.6×clamp(1−elapsed/par, 0..1))`，par = 30s/120s/300s。
  - `storage.mjs`：key `doin.minesweeper.v1`，结构 `{version, prefs, best:{<diff>:{bestScore,bestTimeMs,plays,wins}}}`；
    `recordResult` 纯函数返回破纪录标记；损坏/负值 normalize 兜底；兼容老扁平 `{difficulty}` 结构。
  - `audio.mjs`：零资源 WebAudio 合成（reveal 音调随展开格数升高 / win 琶音 / lose 爆炸 /
    peek 上滑），手势解锁 + 静默降级。
  - `main.mjs` 装配重构：storage 取代内联 prefs；`finishGame()` 统一收口
    （音+触感+算分+存档+结算）；静音按钮；`?e2e` 暴露 `window.__ms`（生产零影响）。
- 稳定基线写入 AGENTS.md §8（8.4 计分存档口径 / 8.5 门禁 55 用例）。

### 修改/新增文件
```
games/minesweeper/                          [新增整目录]
  index.html  favicon.svg  css/style.css
  js/{engine,solver,level,game,ui,main}.mjs     + score/storage/audio.mjs（P2 新增）
  tests/{engine,game,solver,score,storage}.test.mjs
  scripts/make_cover.py                         封面生成脚本（构建已 exclude）
assets/covers/minesweeper.webp               [新增] 640×640 霓虹封面
games.json                                   登记 minesweeper + exclude:["scripts"]
package.json                                 test:minesweeper（5 个测试文件）
AGENTS.md                                    §8 Minesweeper 稳定基线
```

### 关键实现
- 无猜三件套：首击安全（延后布雷）→ 全盘可推（solver 不动点判定）→ 死局免费透视（兜底）。
  自动通关模拟 30/30 零踩雷、零透视触发，胜率 100%。
- 生成性能：expert（99 雷/480 格）`pickNoGuessSeed` ≈ 5.5ms/局。
- 浏览器 `?e2e` 端到端：自动通关 → 结算 CLEARED 192pts 新纪录 → localStorage 写入正确。

### 遇到的问题
- 单点规则对 expert 密度不足：400 采样 60% 退化 → 补子集规则（1-2-1/包含关系）后全档零退化。
- `game.config` 无 seed 字段 → 改用 `game.state.seed`（createState 已随机化），否则同首击必同棋盘。
- `games.json` `exclude` 项不能带尾部 `/`（build-site 按顶层目录名做 Set 判断）。
- 触屏长按插旗后 Android 补发 contextmenu 把旗切掉 → 屏蔽 flag 后 320ms 内的 contextmenu。
- flagMode 按钮未接入意图分发（ui 发 reveal、main 未翻译成 flag）。
- CSS 混入零宽字符、PIL `paste` RGB 当 mask 报错 → 清洗 / 换同心椭圆光晕。
- agent-browser daemon 跨调用丢页面 + 429 限流 → 验证收敛为单次 eval 长链 + `?e2e` 钩子。

### 验证
- `npm run test:minesweeper`：55/55（engine 22 + game 8 + solver 10 + score + storage）。

## 2026-09-04 · 一键发布脚本

- `publish.bat` 会自动暂存并提交待发布变更，再推送 `main`；无变更时跳过空提交。
- 本地 Minesweeper 测试截图 `__ms_*.png` 已加入 `.gitignore`，避免误发布测试产物。
- 回归：`test:orbit-sort` 90/90、`test:tic-tac-toe` 77/77。
- `npm run build` 通过：dist/minesweeper/、封面、sitemap、首页卡片均就绪。

***

## Archive（索引，不展开）

- **2026-09-04 orbit-sort 收尾审计**：单局计分按满分钳制（recordCompletion / recordDailyCompletion），
  `loadProgress` 强制 recomputeTotals 清理旧档；100 关可解性与难度编排全量通过。
- **2026-09-03 tic-tac-toe 上线**：engine/ai/score/storage/audio/game/ui/main + 77 测试；
  3×3 大师档不可战胜 = 特性（自对弈 120 局必平已钉进测试）；先手每局自动轮换；AI 思考 250–550ms 全局 setTimeout；
  deploy workflow 升级 checkout@v5 + setup-node@v6；拆 6 个小补丁本地提交。
- **git push 凭据错配（恢复方式）**：缓存 token 属 `ai919`、仓库 owner `ai717` → 403。
  用 clash 7897（或浏览器直登）授权 `ai717` 后 `git push`；或 Windows 凭据管理器把 github.com 凭据换为 `ai717` 的 PAT。
- orbit-sort 六关→七关迁移 commit `d5a2c28`；30 关 V1 / `nuts` 已冻结移除。
- 2048 零依赖上线 `doin.win/2048/`；Sudoku 有 typecheck + mocha。
- `assets/og-image.png` 仍是旧像素风，建议重渲 Poki 风格 1200×630。
