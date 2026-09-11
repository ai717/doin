# 推箱子（Sokoban）子游戏产品开发策划书

> 版本：v1.0・2026-09-11・状态：待拍板
> 本 PRD 面向开发 / 外发 AI：读完即可直接动工 
>
> `games/sokoban/`
>
> 。



***

## 0・一页纸摘要



* **游戏名**：推箱子（中）/ Sokoban（英）/slug 首选 `sokoban`（候选 `box-push`、`warehouse-puzzle`）

* **一句话玩法**：在网格仓库里上下左右推动木箱，把所有箱子推到发光目标点 —— 只推不拉，一步错步步错。

* **一句话差异化**：Poki/CrazyGames 上的推箱子全是 1982 规则的粗糙复刻；我们做 "50 关手工精品 + 实时死局红警 + 无限丝滑 undo + 每日精选一题" 的现代经典，对齐 klotski/orbit-sort 的品控。

* **目标玩家 / 场景**：25–40 岁喜欢烧脑解谜的通勤族，3–10 分钟一局，地铁 / 午休 / 睡前。

* **首发模式**：5 章 × 10 关 = 50 关主线 + 每日精选一题。

* **技术路线**：plain 静态（无 package.json、零依赖、Canvas 渲染）。

* **预估工期**：6–8 人日（含 50 关内容移植与 par 实算）。



***

## 1・市场与竞品调研（产品线负责人视角）

**品类判断**：Sokoban（仓库番）是 1982 年诞生的网格推盘解谜，与 klotski 同属 "空间推理" 大类，但核心心智不同 ——klotski 是 "在窄缝里挪大块"，推箱子是 "只推不拉的不可逆规划"。DOIN 益智区已有数独 / 2048 / 扫雷 / 华容道 / 星轨调度，**推箱子是公认三大网格益智经典之一（另两个是扫雷、华容道），缺它就是品类缺口**。



| 对标                         | 平台         | 核心机制                      | 亮点           | 可借鉴              | 要避开                         |
| -------------------------- | ---------- | ------------------------- | ------------ | ---------------- | --------------------------- |
| Sokoban（Reinout Stevens 版） | Poki 网页    | 纯经典，20 关                  | 4.4 分 3.6K 评 | Undo、步数统计、关可重玩   | 画面粗糙、无死局提示、关卡太少             |
| Shove                      | GitHub 浏览器 | 纯经典 + 无限生成 + A\* 自动求解最短路径 | 无后端纯静态开源     | "卡壳时给一步提示" 的产品思路 | MVP 不做生成器与求解器（BFS 状态爆炸、工期高） |
| Sokoban Master             | CrazyGames | 经典 + 星级 + 成就 + 关卡编辑器      | 桌面 / 触屏双适配   | 按步数分档反馈、触屏手势     | 编辑器后置 v1.1，MVP 不做           |
| Patrick's Parabox          | Steam      | 空间折叠（盒子里套盒子）              | 极简视觉标杆       | 克制的视觉语言、软质方块、单色墙 | 折叠机制不做 —— 工程量与心智成本都超 MVP    |
| 国内流水线山寨（6000 关版）           | 手游         | 经典 + 虚拟摇杆 + 收集            | 关卡灌水         | 无                | 灌水关卡、广告打断、摇杆误触 ——DOIN 全反着做  |

**差异化定位陈述**：*当玩家想安静烧一局解谜、又不想被广告和灌水关卡打扰时，DOIN 推箱子是网页端唯一 "50 关全手工、每关有最优步数据、卡壳立刻看到死局红点、关关丝滑 undo" 的现代经典。*

**与门户现有游戏关系**：



* tag 补 `益智 / 推盘 / 每日挑战`；与 klotski（策略 / 滑块）相邻但机制正交 ——klotski 块可滑、可撤回位置；推箱子箱只能推、不可逆。

* 与 orbit-sort 共享 "每日挑战" 基因，但题目生成策略不同：orbit-sort 是程序化 blueprint，推箱子用 "从 50 关里按日期 hash 选"（见 §3.3）。



***

## 2・产品定位与范围（PM 视角）

**核心循环（一局 3–8 分钟）**：



```
观察关卡布局 → 按方向键/滑动走格 → 推箱到位 → 检查是否全就位

&#x20;  ↑\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_↓

&#x20;  卡壳？ → Undo 一步 / 多步 / 整关重置
```

循环短、反馈即时、失败代价低（undo 无限步），天然适合碎片场景。

**玩家画像**：喜欢 "我靠自己想出来了" 的顿悟感，不喜欢操作压力。对他们来说时间压力是负资产 —— 所以时间分权重压到最低（见 §4）。

**MVP（首发必须有）**：



1. 50 关手工关卡，5 章 × 10 关，难度波浪上升。

2. 四向操作：键盘方向键 / WASD + 触屏四向滑动。

3. 无限步 Undo + 整关重置 + 上一步 / 重开关快捷键。

4. **实时死局检测**：箱子被推进非目标点的硬角时，该箱红色脉冲提示（只提示不拦截）。

5. HUD：当前步数 / 本关 par / 实时预估分 / 总积分。

6. 每日精选：按日期 hash 从 50 关选一题，同日期全服同题。

7. 本地进度：通关状态、最佳步数 / 时间 / 分数、已解锁章节。

8. 中英 i18n（`doin.lang` 共享偏好）、WebAudio 合成音效、静音开关。

9. 动效 `prefers-reduced-motion` 降级、390px 宽不溢出。

**v1.1+ 后置（明确不做）**：



* 冰面 / 传送门 / 按钮门等机关 —— 会让关卡设计与死局检测复杂度上一个量级，先把纯经典做扎实。

* 关卡编辑器与分享 —— 依赖后端或 URL 编码长串，纯静态体验差。

* 无限生成 + A\* 求解提示 ——Shove 做了但工期高，且与 "手工精品" 定位冲突。

* 多主题皮肤（工业 / 森林 / 太空）—— 首发热木仓库一套皮肤做精。

**绝对不做**：联机、账号系统、内购、广告、排行榜（纯静态无后端）。



***

## 3・玩法设计（游戏设计大师视角）

### 3.1 规则定义（引擎规格）

**棋盘**：每关由关卡文件定义 `rows × cols` 矩形网格（典型 8×8 \~ 12×10）。每格类型：



| 字符  | 含义           |
| --- | ------------ |
| `#` | 墙（不可穿越）      |
| ` ` | 地板（可走）       |
| `.` | 目标点（地板上的标记）  |
| `$` | 箱子（在普通地板上）   |
| `*` | 箱子（在目标点上，就位） |
| `@` | 玩家（在普通地板上）   |
| `+` | 玩家（在目标点上）    |

**操作意图**：`{ dir: "up" | "down" | "left" | "right" }`。`applyMove(state, dir)` 返回 `{ state, action }`，`action` 为 `null` 表示这步没生效（撞墙、推不动）。

**移动规则（逐格判定，纯函数）**：



1. 计算 `next = player + dir`。

2. 若 `next` 是墙 → `action = null`，原状态返回。

3. 若 `next` 是地板或目标点（无箱）→ 玩家走到 `next`，`action = "move"`。

4. 若 `next` 是箱子（无论是否在目标上）：

* 计算 `beyond = next + dir`。

* 若 `beyond` 是墙或箱子 → `action = null`（推不动）。

* 否则箱子走到 `beyond`（若 `beyond` 是目标点则变 `*`），玩家走到 `next`，`action = "push"`。

**胜利判定**：`isSolved(state)` = 场上不存在 `$`（普通地板上的箱子），即所有箱子都在目标上（`*`）。**只有&#x20;**`solved`**&#x20;是终止态**；没有失败态。

**纯函数签名（engine.mjs 导出）**：



```
parseLevel(rows: string\[]) -> Level   // 解析字符网格，校验至少 1 个玩家、箱数 == 目标数

createState(level) -> State

applyMove(state, dir) -> { state, action: "move" | "push" | null }

isSolved(state) -> boolean

findDeadlockedBoxes(state, level) -> \[index]   // 死局检测（见 §3.2）
```

**"合法操作永不报错" 落地的三个易错点**：



* 撞墙不是非法操作，是 "没生效"—— 返回 `action: null`，UI 不弹错误 toast。

* 推不动（箱子后面有箱 / 墙）同样 `action: null`，给一个 60ms 的轻量抖动反馈即可。

* 已通关后继续按方向键 → no-op，不重置、不报错。

### 3.2 创新点（响应对现代感的要求）

用户只说 "推箱子游戏"，没要求机制创新。MVP **不改经典规则**—— 推箱子的乐趣就在 "只推不拉" 的不可逆约束。差异化放在三个 "现代体验层"：



1. **实时死局红警（核心创新）**：玩家每次推动后，`findDeadlockedBoxes` 扫描所有箱子，若某箱子位于 "非目标角落"（即该格上、左两方向都是墙，或上、右、或下、左、或下、右 —— 二邻皆墙且该格不是目标点），则该箱在渲染层红色脉冲 2 次。

* **工程建模**：纯 O (cells) 规则扫描，不做 BFS 死局推理。

* **产品理由**：推箱子最挫败的不是 "想不出来"，而是 "推到一半才发现这步死了"。红警把这个挫败提前到推动当步，undo 成本几乎为零。

* **不拦截**：即使死局了玩家仍可继续走（他可能想研究 / 演示），只是视觉提示。

1. **无限步 Undo（现代标配）**：`game.mjs` 维护动作栈，Ctrl+Z / 按钮 / 双指回退都可触发；与 klotski 一致，undo 不取消费步数分（步数分按最终解算，undo 只改当前步，不改历史最佳）。

2. **滑丝滑推箱动画**：Canvas 渲染时，玩家与箱子移动用 120ms ease-out 补间，而不是瞬间跳格。`prefers-reduced-motion: reduce` 时关闭补间、直接跳格。

**为什么不做更激进的机制创新**（时间克隆 / 重力 / 折叠）：这些机制都要求重写引擎的移动与碰撞模型，50 关手工设计成本翻倍，且和 "经典推箱子" 心智冲突。留给 v1.1 以 "机关包" 形式出。

### 3.3 难度曲线与内容

**章节结构**：5 章 × 10 关 = 50 关。



| 章    | 主题    | 箱数  | 典型尺寸           | 目标 par 区间 |
| ---- | ----- | --- | -------------- | --------- |
| 1 入门 | 单箱直线  | 1   | 5×5 \~ 7×7     | 3 \~ 12   |
| 2 拐角 | 双箱转向  | 2   | 7×7 \~ 8×8     | 10 \~ 25  |
| 3 通道 | 窄走廊多箱 | 2–3 | 8×8 \~ 9×9     | 20 \~ 40  |
| 4 仓库 | 多箱交错  | 3–4 | 9×9 \~ 11×10   | 35 \~ 70  |
| 5 大师 | 综合    | 4   | 10×10 \~ 12×10 | 60 \~ 116 |

**par 实算**：与 klotski 一致，开发期用多源 BFS（双向 BFS + 位状态编码）对每关求解最短步数，par 写入 `levels.mjs`。每关 box 数 ≤ 4，状态空间（箱子位置组合 × 玩家位置）可控，单关求解预算 3 秒；超时则用保守估计 `(boxes × 8) + 20` 并在代码注释标注。

**关卡来源**：以 David W. Skinner 维护的经典公有领域 Sokoban 关卡集（Sokoban 经典 90 / Sasquatch 等集子，许可宽松）为底，做本地化与难度重排，前 10 关手工改写到 "30 秒能学会" 的程度。**不原创 50 关**—— 那是 2 人月的工作量，PRD 期已明确标注。

**每日精选**：`dailyKey = todayKey()`，`levelId = "daily-" + hash(dailyKey) % 50`。同日期所有玩家同一题。不做程序化生成（生成器保证可解 + par 实算的工程量在 Shove 里证明不低）。每日题通关额外 +150 基础分（对齐 orbit-sort 的 daily bonus 量级）。



***

## 4・数值框架（数值策划视角）

**计分公式**（与 klotski 整站对齐，满分 800）：



```
total = base(200) + move(max 500) + time(max 100)
```



* **base = 200**：固定，通关即得（与 klotski 一致，解谜不按关号加 base）。

* **moveScore(moves, par)**：


  * `moves ≤ par` → 500（满分）。

  * `par < moves ≤ par·2` → 每步 -5，即 `500 - 5·(moves - par)`。

  * `moves > par·2` → 保底 100。

* **timeScore(elapsedMs, par)**：


  * `targetSec = 20 + par·1.2`（解谜不催时间，比 klotski 宽松）。

  * `elapsed ≤ targetSec` → 100。

  * 超时每 10 秒 -2，保底 20。

* **perfectScore = 800**，任何关卡都一样（与 klotski 一致；选关页未通关显示 800，已通关显示历史最高）。

**三个算例验证公式自洽**：



| 关   | par | 玩家表现          | base | move                 | time                           | total   |
| --- | --- | ------------- | ---- | -------------------- | ------------------------------ | ------- |
| L1  | 8   | 8 步、25 秒通关    | 200  | 500                  | 100                            | **800** |
| L25 | 40  | 52 步、90 秒通关   | 200  | 500 - 5·12 = 440     | target=68s，超时 22s → 100-4・2=92 | **732** |
| L50 | 100 | 180 步、600 秒通关 | 200  | moves>par・2 → 保底 100 | target=140s，超时 460s → 保底 20    | **320** |

**步数统计**：每 `action === "push"` 或 `action === "move"` 真实发生才 +1；undo 回退步数不回退（与 orbit-sort 一致，最佳步数仍按历史最优解保存）。

**存档结构**（`doin.sokoban.v1`）：



```
{

&#x20; version: 1,

&#x20; prefs: { muted: false, reducedMotion: false },

&#x20; unlocked: 5,                    // 已解锁到第几章

&#x20; current: { levelId: 0, step: 0, state: "..." },  // 进行中关卡与压缩态

&#x20; levels: {

&#x20;   "\<id>": { cleared, bestScore, bestMoves, bestTimeMs }

&#x20; },

&#x20; daily: { dateKey, bestScore }

}
```

任何字段缺失 / 损坏 / 负值 → normalize 回默认，绝不抛白屏。



***

## 5・UX 设计（UX 负责人视角）

**操作模型**：



* 桌面：方向键 / WASD 四向移动；长按方向键 180ms 后以 120ms 间隔重复（连走）；Z / Ctrl+Z undo；R 重置；U 打开重开关。

* 移动：四向滑动（上下左右）单步；滑动太快不连走（防止误触连推错）；双指轻点 = undo。

* 不做 "点哪走哪自动寻路"—— 自动寻路会替玩家做推箱决策，破坏 "规划" 心智。

**反馈通路清单**：



| 事件   | 视觉               | 听觉        | 触感      |
| ---- | ---------------- | --------- | ------- |
| 走路   | 轻微阴影位移           | 木质轻步音（短）  | —       |
| 推箱   | 箱子补间滑动 + 地面微震    | 木质摩擦音（中频） | 8ms 震动  |
| 推到目标 | 目标环金色脉冲          | "咔" 定位音   | 10ms 震动 |
| 死局红警 | 箱子红色脉冲 2 次       | 低音短提示     | 15ms 震动 |
| 推不动  | 箱子 60ms 水平抖动     | 无         | —       |
| Undo | 状态回退补间           | 回退滑音（上滑）  | —       |
| 通关   | 所有箱子金光扩散 + 门打开动画 | 五声音阶上行琶音  | 25ms 震动 |
| 破纪录  | HUD 分数跳字 bump    | 高音叮       | 20ms    |

**新手引导**：不做弹窗教程。第 1 关就是 1 箱 2 步教学；进入第 1 关时在玩家与箱子之间画一个虚线箭头提示第一步（3 秒后淡出）。HUD 角放一个 "？" 按钮，点开后三行文字："推动所有木箱到发光点。只能推，不能拉。Z 撤销。"

**信息层级**（HUD）：



* 顶栏：返回首页 ← 第 X 关 / 共 50・步数 12/par 8・得分 720/800 → 静音

* 底栏：Undo / 重置 / 重选关 三个按钮

* 总积分放在选关页，不在单局 HUD。

**无障碍与降级**：



* `prefers-reduced-motion: reduce`：所有补间动画关闭，直接跳格；死局红警改为常显而不是脉冲。

* 色盲：箱子用暖棕色、目标用金色圆环轮廓，不依赖单一色相；红绿不靠。

* 触屏长按阈值 320ms 内不触发长按连走（避免滑动误判）。

* 切后台 /visibilitychange：暂停计时，不暂停棋盘（解谜不需要帧循环）。

* 隐私模式 localStorage 不可用：静默降级内存，通关进度本次会话有效，下次刷新丢失。



***

## 6・视觉方向（UI 设计师视角）

**风格关键词**：现代极简治愈、软质黏土方块、暖木仓库、克制不喧哗。不做赛博霓虹、不做写实工厂、不做像素风。

**配色**（hex）：



| 角色     | 色值            | 用途       |
| ------ | ------------- | -------- |
| 背景     | `#F5EDE0` 米白  | 页面底色     |
| 墙      | `#3D2F23` 深棕  | 墙体       |
| 地板     | `#E8D9C0` 浅木色 | 地板       |
| 木箱     | `#B8895A` 暖棕  | 箱子       |
| 到位箱    | `#8FAE7E` 治愈绿 | 推到目标上的箱子 |
| 目标环    | `#D4A84B` 金   | 目标点轮廓    |
| 玩家     | `#5B7C99` 雾蓝  | 小人       |
| 文字 ink | `#2A2118` 深棕黑 | HUD 文字   |
| 死局红    | `#C0392B`     | 死局脉冲     |

**为什么选暖棕**：现有 12 张封面色相表里暖棕是空位，且木箱 / 仓库主题天然契合；与 gold-miner 的 "暖橙金" 不同（那是高饱和橙金，我们是低饱和灰棕），不撞。

**HUD 布局**：



* 桌面（≥900px）：棋盘居左最大，右侧 280px 栏放章节地图缩略 + 按钮；与 klotski 桌面双栏同构。

* 移动端（<600px）：单列，棋盘占屏宽，按钮横排底部。

* 棋盘尺寸：`width: min(100%, calc((100dvh-160px)*0.85)); aspect-ratio: rows/cols; height: auto`，Canvas 内部按 DPR 缩放。

**封面 prompt 草案**（按 `docs/COVER-STYLE.md` 模板）：



```
Soft 3D clay render app icon on a colored gradient background (not white, not dark, not black):

a single cute glossy wooden crate box centered, slightly tilted, with a golden glowing

ring outline beneath it marking the target spot, a tiny round blue worker character

standing beside it. Single centered composition, soft warm brown and cream bright

gradient background, subtle floating particles and sparkles, no text, no letters,

cute glossy toy-plastic high quality 3D illustration, square format.
```

背景色系：暖棕（未占用）。主体：木箱 + 金环 + 小工人，符合 "游戏最具辨识度物件"。

**字体**：只用系统 sans-serif，不加载 webfont。



***

## 7・技术方案（开发负责人视角）

**路线选择**：plain 静态。推箱子是纯网格逻辑，Canvas 2D 足够，无构建框架收益。

**模块清单**（`games/sokoban/`）：



| 文件               | 职责                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------ |
| `index.html`     | 标记 only：外链 css/js，`<a href="/">`，noscript                                            |
| `favicon.svg`    | 木箱简笔                                                                                 |
| `css/style.css`  | 布局、桌面双栏、移动单列、reduced-motion                                                          |
| `js/engine.mjs`  | 纯函数：`parseLevel / createState / applyMove / isSolved / findDeadlockedBoxes`，DOM-free |
| `js/levels.mjs`  | 50 关字符数据 + par 表 + 每日 hash 选题                                                        |
| `js/game.mjs`    | DOM-free 控制器：undo 栈、步数、计时、通关判定、daily 状态                                              |
| `js/render.mjs`  | Canvas 绘制：地板 / 墙 / 箱 / 玩家 / 目标，补间动画，DPR                                              |
| `js/ui.mjs`      | 唯一 DOM 拥有者：HUD、按钮、选关页、弹窗                                                             |
| `js/score.mjs`   | 计分唯一口径：`scoreFor(moves, par, elapsedMs)`                                             |
| `js/storage.mjs` | 存档唯一口径：`doin.sokoban.v1`，try/catch 降级                                                |
| `js/i18n.mjs`    | 中英双表，`doin.lang` API                                                                 |
| `js/audio.mjs`   | WebAudio 合成：step/push/click/deadlock/win/undo                                        |
| `js/main.mjs`    | 装配：绑定事件、启动                                                                           |

**三条铁律复述**：



1. `applyMove` 返回的合法移动必须全部执行 —— 撞墙 / 推不动是 `action: null` 而非抛错。

2. UI 只发意图（`applyMove(state, dir)`），不直接改 state；Canvas 永远从 engine state 重绘。

3. 任何 localStorage 读取都 normalize，坏值回默认；storage 不可用时静默降级 Map。

**渲染选型**：Canvas 2D。每格 48 CSS px（移动端按屏宽缩放），DPR = `window.devicePixelRatio`，Canvas backing store 同步放大。推箱补间用 `requestAnimationFrame` 120ms 内完成；`prefers-reduced-motion` 时直接跳帧。

**音频事件**（WebAudio 合成，零资源）：step（短木音）、push（摩擦中频）、click（到位）、deadlock（低音）、undo（上滑 blip）、win（五声音阶琶音）。AudioContext 需首次用户手势解锁。

**i18n key 骨架**（≥10 键，中英必须对齐）：



| key         | 中                        | 英                                                                                     |
| ----------- | ------------------------ | ------------------------------------------------------------------------------------- |
| app.title   | 推箱子                      | Sokoban                                                                               |
| app.tagline | 把箱子推到发光点                 | Push every crate onto the glowing targets                                             |
| hud.moves   | 步数                       | Moves                                                                                 |
| hud.par     | 标准                       | Par                                                                                   |
| hud.score   | 得分                       | Score                                                                                 |
| hud.total   | 总积分                      | Total                                                                                 |
| btn.undo    | 撤销                       | Undo                                                                                  |
| btn.reset   | 重置                       | Reset                                                                                 |
| btn.hint    | ？                        | ?                                                                                     |
| hint.body   | 推动所有木箱到发光点。只能推，不能拉。Z 撤销。 | Push every crate onto the glowing dots. You can only push, not pull. Press Z to undo. |
| win.title   | 完成！                      | Solved!                                                                               |
| win.newBest | 新纪录                      | New best!                                                                             |
| daily.title | 今日挑战                     | Daily                                                                                 |
| nav.back    | 返回首页                     | Home                                                                                  |

**测试计划**（四类，对齐 GAME-SPEC §5）：



1. `engine.test.mjs`：移动规则、推箱规则、撞墙 no-op、isSolved、findDeadlockedBoxes（构造角死局用例）。

2. `storage.test.mjs`：normalize 损坏数据、localStorage 不可用降级、bestScore 钳制 ≤ 800。

3. `i18n.test.mjs`：中英键完全对齐非空、`doin.lang` 读写。

4. `markup.test.mjs`：index.html 的 id 与 main refs 双向闭合、`?v=dev` 在位、移动 /reduced-motion 样式在位。

**工期拆解**：



| 任务                              | 人日    | 依赖     |
| ------------------------------- | ----- | ------ |
| engine + levels 数据 + par BFS 脚本 | 2     | —      |
| Canvas 渲染 + 移动补间                | 1.5   | engine |
| game 控制器 + undo + 计时            | 1     | engine |
| score/storage/i18n/audio        | 1     | —      |
| UI 选关页 + HUD + 弹窗               | 1     | 以上     |
| 四类测试                            | 1     | 全部     |
| 人工验收 + 构建                       | 0.5   | 全部     |
| **合计**                          | **8** |        |



***

## 8・风险与开放问题

**Top 3 风险**：



1. **50 关内容产能与版权**：若完全原创 50 关需 2 人月。

* 缓解：以 David W. Skinner 经典公有领域集为底，前 10 关手工改写。需在落地时确认所用关卡集的具体许可（CC0 / 公有领域 / 允许免费使用），在 `games/sokoban/levels.mjs` 头部注释来源。

1. **par BFS 状态爆炸**：4 箱关卡的状态空间在最坏情况（箱子散布）可达百万级。

* 缓解：双向 BFS + 位编码（箱子位置打包成整数）；单关 3 秒超时回退保守 par。box 数硬上限 4，不引入 5 箱以上关卡。

1. **死局误报 / 漏报**：只做硬角检测，会漏 "走廊死锁"（箱在长走廊中间，两侧都堵）。

* 缓解：明确写进 UI 文案 ——"红色提示 = 可能死局，请三思"，不承诺完整推理；走廊死锁留给 v1.1 升级为完整死局求解。

**待用户拍板（最多 3 个）**：



1. **slug 选哪个**：`sokoban`（首选，国际通用，SEO 友好）/ `box-push` / `warehouse-puzzle`？

2. **关卡来源**：接受 "经典公有领域关卡集改编"（快、稳、质量已被几十年验证），还是要求完全原创（+2 周工期）？

3. **每日挑战**：MVP 就上 "每日精选（hash 选关）"，还是 v1.0 只做 50 关主线、daily 留 v1.1？（建议上，成本几乎为零）



***

## 9・交付清单（给开发 / 外发 AI 的接手说明）



* [ ] 完整 `games/sokoban/` 目录，文件结构见 §7 模块表

* [ ] 规则完整定义见 §3.1；死局检测见 §3.2

* [ ] 计分公式与三个算例见 §4

* [ ] 视觉方向与封面 prompt 见 §6

* [ ] 四类测试要求见 §7 末尾

* [ ] 明确边界：只做目录内文件；`games.json` 登记、640×640 封面、根 `test:sokoban` 注册、`npm run build` 由主仓库补

* [ ] 所有本地 script/link 带 `?v=dev`；零外链；相对路径；系统字体

* [ ] 三条铁律写进引擎注释：合法操作不拦截 / UI 只发意图 / 存档损坏不白屏



***

## 附录・六角色红蓝军自审记录



* **产品线负责人**：14 款里没有推箱子，益智区最后一块经典拼图；tag 不撞（益智 / 推盘 / 每日挑战）。✅

* **产品经理**：MVP 砍到 50 关 + 死局红警 + undo + daily，没有编辑器 / 生成器 / 联机。✅

* **游戏设计大师**：规则纯经典无妥协；par 由 BFS 实算；box 数硬上限 4 保证可解与性能；没有必输状态（无失败态）。✅

* **UX 负责人**：第 1 关即教学；误推有 undo；时间分压到 100 不催命；手机滑动单步防误触。✅

* **UI 设计师**：暖棕色系未被现有 12 张占用；HUD 双栏对齐 klotski；reduced-motion 有降级。✅

* **开发负责人**：engine 纯函数可 node:test；随机数无（关卡固定，不需要 rng 注入）；storage 有降级；四类测试都可写。✅