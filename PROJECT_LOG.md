# PROJECT_LOG.md

> 精简原则：只留状态快照 + 最近一轮要点。细节查 git log / `.workbuddy/memory/`。
> 游戏的稳定规则写在 AGENTS.md（§5 orbit-sort / §6 tic-tac-toe），本文件不重复。

***

## Current Baseline (2026-09-03)

- **门户**：Poki 风首页（`index.html` + `css/`），640×640 WebP 封面，CNAME `doin.win`。
- **orbit-sort**（已稳定）：5 章 × 20 题（100 关）主题化主线、积分系统、今日挑战、Intent-routing 不变量。规则见 AGENTS.md §5。
- **tic-tac-toe**（新上线）：3×3/4×4、难度=失误率、连胜爬塔、本地双人、WebAudio 音效、深色模式。规则见 AGENTS.md §6。
- **本地服务**：优先 `node _dev-server.mjs`（零依赖，端口 46810 起）。

***

## 2026-09-03 · 本轮开发记录

### 做了什么
1. 新增子游戏 **tic-tac-toe**（架构、AI、计分、存档、音效、UI 全量实现，77 测试全绿）。
2. 升级 deploy workflow：`actions/checkout@v5` + `actions/setup-node@v6`。
3. orbit-sort 可解性审计加 120ms 合并去抖（连拖只交最新局面）。
4. orbit-sort 启动流程改为新用户直接开始第 1 关；已有进度自动进入当前解锁关卡。
   关卡选择与当前关卡详情改为游戏内工具入口，选关页按需打开。
5. 新增零依赖 `_dev-server.mjs`。
6. orbit-sort 启动入口调整：新用户直达首关，已有进度直达当前解锁关卡；游戏内增加关卡选择和详情入口。
7. 关卡列表分数徽章排版修复：总分/最高分标签禁止换行并固定徽章宽度，避免中文标签竖排挤压分数。
8. orbit-sort 重构为 5 章 × 20 题：晨星港（aurora）、赤沙航道（ember）、翡翠星云（verdant）、
   紫晶裂隙（violet）、深空王座（abyss）。每章采用波浪式难度节奏；以 7 个母题的颜色/轨道
   等价变换生成 100 个唯一局面，章节主题同步到背景与球体样式，解锁上限扩展至 100。
9. 关卡、生成器、标记与计分测试迁移至 100 题覆盖；canonical 母题保留完整求解验证，避免重复 BFS。
10. 上述改动拆 **6 个小补丁**本地提交。

### 2026-09-04 · 合法操作铁律回归修复
- 发现章节切换时渲染器仅按轨道数/容量缓存结构，未比较 `dockCount`，导致上一关遗留的
  “幽灵中转槽”与引擎真实 state 不一致；用户看到空槽但引擎正确报告无空槽。
- 修复渲染器按中转槽数量重建结构，并让轨道点击动画依据 `applyIntent` 实际 action，
  不再依据 dispatch 后已变化的 state 猜测操作类型。
- 将“合法操作绝不拦截，渲染必须与引擎 state 同步”写入 AGENTS.md §5.2，作为后续开发铁律。

### 修改 / 新增文件
```
games/tic-tac-toe/               [新增] engine/ai/score/storage/audio/game/ui/main.mjs + 7 测试
assets/covers/tic-tac-toe.webp   [新增] PIL 手绘封面 640×640
games.json                      tic-tac-toe 插入清单（位于 2048 与 orbit-sort 之间）
package.json                    test:tic-tac-toe 脚本
_dev-server.mjs                 [新增] 零依赖 dev server
.github/workflows/deploy.yml    checkout/setup-node 升级
games/orbit-sort/js/main.mjs    可解性审计去抖
AGENTS.md / PROJECT_LOG.md      文档
```

### 测试
- tic-tac-toe 77/77、orbit-sort 90/90、`npm run build` 通过。

### ⚠️ 推送未完成（凭据错配）
- 5 个 commit 已本地落地，领先 `origin/main` 5 个。
- `git push` 被拒：**缓存 token 属于 `ai919`，仓库 owner 是 `ai717`** → 403。
- 尝试 `gh auth login` 受阻：WorkBuddy 注入代理 `53892` 到 `github.com` 主站返 502；
  `~/.config/gh/hosts.yml` 被沙箱剥写拦截；`7897`（clash）到主站时好时坏。
- **恢复方式**：用 clash `7897`（或浏览器直登）授权 `ai717` 账号后 `git push`；
  或直接在 Windows 凭据管理器把 github.com 凭据替换为 `ai717` 的 PAT。

### 关键实现要点（tic-tac-toe）
- 模块分层与 orbit-sort 一致：engine(规则) / ai(搜索) / score(计分) / storage(存档) /
  game(DOM-free 控制器) / ui(唯一 DOM 拥有者) / main(装配)。
- **3×3 大师档不可战胜是特性**：自对弈 120 局必平已钉进测试；成就设为"逼平"而非"击败"。
- **难度=ε-greedy 失误率 + 是否开启必胜必堵兜底**：easy 0.45 关兜底，输得自然不像放水。
- **4×4 先手每局自动轮换**：先手优势近乎必胜，否则连胜爬塔退化成掷硬币。
- 计分只在 `score.mjs`，页面不自算。

***

## Archive（索引，不展开）

- orbit-sort 六关→七关迁移：commit `d5a2c28`。
- 30 关 V1 / `nuts` 已冻结移除。
- 其他游戏：2048 零依赖上线 `doin.win/2048/`；Sudoku 有 typecheck + mocha。
- 平台遗留：`assets/og-image.png` 仍是旧像素风，建议重渲 Poki 风格 1200×630。
