# DOIN 小游戏外包任务书：深海合珠（bubble-merge）

> **使用说明**
>
> 本任务书由 DOIN 产品策划（依据 `docs/plans/bubble-merge-prd.md`）按外包模板填充生成。
> 制作人三项拍板已确定：① 终极泡泡 **可戳破**；② 模式 **无尽冲分 + 每日挑战**；③ 物理手感 **高弹滑爽快**。
> 二至八节为 DOIN 固定契约，除标注"按玩法裁决"的条目外不要改动。
> 外发时贴本任务书正文，不要求承接方理解 GitHub Actions、gh-pages、CNAME 等部署细节。
> 本文档是**生产级工程规格**，不是策划案：所有规则写到引擎可建模，所有数值给具体算例，不留 TBD。

---

你，要为 DOIN.WIN 静态网页游戏门户开发一款新的独立小游戏。

====================

一、本次任务参数

====================

## 1.1 游戏名称

**深海合珠 / Bubble Merge** —— 把泡泡丢进深青水缸，同级泡泡一碰即"啵"地合成更大一号；合成出终极泡泡（L10）后点一下"啪"地戳破爆分清场；堆叠超过安全线即结算。

一句话玩法：瞄准丢泡泡 → 同级碰撞合并升级 → 连锁爆分 → 戳破 L10 清场 → 别堆过顶线。

## 1.2 slug

`bubble-merge`

（最终 slug，已确定。后续所有目录名、文件名、import 路径、存档 Key `doin.bubble-merge.v1`、CSS 类名与变量命名必须统一使用 `bubble-merge`，禁止出现 `<slug>` 或其他占位符。仓库内不存在同名冲突。）

**重要要求**：在输出第 1 轮文件前，必须先明确声明最终 slug；之后所有文件名、目录、import 路径、存档 Key 和代码变量约定必须统一使用该 slug。

## 1.3 核心玩法

> 本作对标 **Suika Game / 合成大西瓜**（鼻祖）的"同类合并升一级 + 三角数计分 + 溢出顶线即败"成熟模型，借鉴 **SSRB Ball Suika** 的"下一个掉落物预览"，以及 **合成大西瓜魔改版** 用"主动清障手段"化解"被大块卡死"的挫败。
> 差异化创新（题材带物性，非换皮）：① **戳破终极泡泡**——把 Suika 里"大西瓜是负资产"的憋屈终局，变成"攒大招→释放"的正反馈；② **泡泡专属物性**——比水果更弹更滑、半透明碰撞挤压变形；③ **虹彩玻璃 / 深海水族馆美学**；④ **每日挑战同日同题**（确定性种子）。
> 不得复制任何商业游戏的名称、代码、美术资源或外部文件。

### 1.3.1 场景与坐标系（engine 唯一权威，逻辑坐标，渲染层等比缩放）

- **逻辑世界**：`WORLD = { width: 440, height: 660 }`（固定逻辑单位，与 CSS 像素解耦；渲染按 `contain` 等比缩放并居中，指针坐标经 `getBoundingClientRect()` 反算回逻辑坐标）。
- **容器**：左右封闭、顶部开放的矩形水缸。壁厚 `WALL = 14`。
  - 泡泡圆心 x 约束：`[WALL + r, width - WALL - r]`；
  - 地板：泡泡圆心 y 约束 `≤ height - WALL - r`；
  - 顶部开放（y 可小于 0 不拦截，但见 1.3.6 超线判定）。
- **安全线**：`SAFETY_Y = 132`（距世界顶部）。其下为缓冲预警区。
- **掉落口**：`DROP_Y = 72`（新泡泡生成时圆心 y，位于安全线上方）。
- **固定时间步**：`FIXED_DT = 1 / 120` 秒。`stepFrame(state)` 每次推进恰好 `FIXED_DT`；主循环用累加器把真实 dt 切成整数个 `FIXED_DT` 子步（每帧最多 `MAX_SUBSTEPS = 6` 个子步，防"死亡螺旋"）。物理因此**帧率无关、可重放、可单测**。

### 1.3.2 泡泡等级链（10 级）

`MAX_LEVEL = 10`。每级半径（逻辑单位，index 0 = L1）：

```
RADII = [17, 22, 28, 35, 43, 52, 61, 71, 81, 92]
```

- L10 直径 184，约占容器内宽（440 − 2×14 = 412）的 45%；两颗 L10 并排 368 < 412，可共存。
- 每级专属虹彩色与透明度递进（数据见 1.4.3 `LEVEL_STYLE`），L1 微光小泡 → L10 虹彩终极泡泡。
- **不存在 L11**：两颗 L10 相撞只弹开，不合并；L10 只能被玩家**戳破**移除。

### 1.3.3 合法操作（intent）与判定

engine 暴露 `applyIntent(state, intent, { rng })`，返回 `{ state, events, action }`；`action === null` 表示"这一步没生效"，**合法操作永不抛错**。intent 类型：

| intent | 生效条件 | 效果 |
| --- | --- | --- |
| `{type:"start"}` | `status==="ready"` | 进入 `playing`，发 `start` 事件 |
| `{type:"aim", x}` | `isRunning` | 把 `state.aimX` 钳制到 `[WALL+r_cur, width-WALL-r_cur]`（r_cur 为待丢泡泡半径），不发物理事件 |
| `{type:"drop", x?}` | `isRunning` 且 `dropCooldown ≤ 0` 且掉落口未被占 | 在 `(clamp(x ?? aimX), DROP_Y)` 生成当前泡泡（vy=0），`current←next`，`next←nextDropLevel(rng)`，`dropCooldown = DROP_COOLDOWN`，发 `drop` 事件 |
| `{type:"pop", x, y}` | `isRunning` | 命中**最上层** L10 泡泡（圆心距 ≤ r）→ 移除它、`score += popScore()`、发 `pop` 事件；未命中 L10 → `action:null`（可发 `deny:{reason:"noPop"}`，不报错） |
| `{type:"pause"}`/`{type:"resume"}`/`{type:"togglePause"}` | `status==="playing"` | 切换 `paused`，发 `paused`/`resumed` |
| `{type:"restart", mode?, seed?}` | 任意态 | 用 `createState` 重建一局（保留 mode/seed 入参），发 `start` |
| `{type:"setMode", mode}` | `status!=="playing"`（ready/over 时） | 切换 `endless`/`daily`，重建一局 |

- **掉落口被占判定**：若以 `(clamp(x), DROP_Y, r_cur)` 为圆与场上任一泡泡重叠 → 拒绝掉落，发 `deny:{reason:"blocked"}`（UI 轻提示"落点被挡"），`action:null`。此情形在堆到顶时才出现（此时已临近超线），属安全 no-op。
- **戳破命中**：从 `bubbles` 末尾（最后生成 = 最上层）向前找第一个 `level===MAX_LEVEL` 且 `hypot(x-bx,y-by) ≤ r` 的泡泡。
- **终局/暂停态**：`drop`/`aim`/`pop` 在非 `isRunning` 时一律 `action:null`，不抛错、不改状态。

### 1.3.4 合并规则（连锁，engine 在 stepFrame 内解析）

1. **触发**：两个**同级**泡泡 `level < MAX_LEVEL` 且圆心距 `< r_a + r_b`（接触/重叠）→ 合并。
2. **合并产物**：
   - 新等级 `level + 1`；
   - 位置 = 两泡圆心**中点**；
   - 速度 = **动量平均** `v = (m_a·v_a + m_b·v_b) / (m_a + m_b)`，质量 `m = r²`（面积质量）；
   - 半径 = `RADII[level]`（新级）。
3. **连锁**：合并产生的新泡泡可能在同一物理步内再与同级接触 → 继续合并。**循环合并直到本步无新的同级接触**，迭代上限 `MERGE_ITER = 24`（防极端死循环；正常远小于此）。
4. **连锁计数 chain**：
   - `state.chain` 为当前连锁段已发生的合并序号（从 0 起）；
   - 每次合并的 `chainIndex = state.chain`，随后 `state.chain += 1`；
   - 若距上次合并超过 `CHAIN_WINDOW = 0.7s`（`state.sinceMerge` 累计）→ `state.chain` 归零（连锁段结束）；
   - `state.maxChain = max(state.maxChain, state.chain)`。
5. 每次合并发事件 `{type:"merge", level, x, y, chainIndex, gained}`（`gained` 为该次得分，由 score.mjs 计算）。

### 1.3.5 计分（score.mjs 唯一口径，UI 不得自算）

- **三角数制**：合成出第 N 级泡泡基础分 `triangular(N) = N(N+1)/2`。
  - 算例：L1→L2 得 `T(2)=3`；L4→L5 得 `T(5)=15`；L9→L10 得 `T(10)=55`。
- **连锁倍率**：第 k 次连锁合并（`chainIndex = k`，从 0 起）倍率 `1.5^k`。
  - `mergeScore(level, chainIndex) = round( triangular(level) × 1.5^chainIndex )`。
  - 算例：单次掉落引发 L3(chain0)→L4(chain1)→L5(chain2) 三连：`T(3)×1 + T(4)×1.5 + T(5)×2.25 = 6 + 15 + 33.75 ≈ 6 + 15 + 34 = 55`。
- **戳破奖励**：`POP_BONUS = 100`，`popScore() = 100`（戳破 L10 = +100 分 + 清空其所占空间，分数与清场双收益）。
- **本局得分**：`score = Σ mergeScore + Σ popScore`，无上限（无尽冲分），整数，钳制 `≥ 0`。
- **记录维度**：每局结束记录 `score / maxLevel（本局合成到的最高级）/ maxChain（最长连锁）`。无尽与每日各自留最高分 + 最大等级双纪录。

### 1.3.6 失败条件（超线结算，防秒败）

- **危险判定**：某泡泡满足 `(y − r) < SAFETY_Y`（顶边越过安全线）**且** `age > 0.9s`（排除刚生成正在下落的泡泡）→ 计入危险。
- **危险计时**：本步存在任一危险泡泡 → `dangerTime += FIXED_DT`；否则 `dangerTime = max(0, dangerTime − FIXED_DT × 1.5)`（衰减，给玩家靠连锁/戳破自救的时间）。
- **预警**：`dangerTime > 0` 即进入预警（安全线变红脉动 + 低沉警示音，渲染/音频层据 `state.dangerTime` 表现）。
- **结算**：`dangerTime > DANGER_LIMIT = 2.2s` → `status = "over"`，发 `{type:"roundEnd", score, maxLevel, maxChain}`。
- **无逻辑死局**：纯物理玩法不存在"合法操作被吞"；玩家始终能丢泡泡（除非落点被挡，挪一下即可）或戳破 L10 清场；即便都合不出 L10，小泡泡也能靠物理滚动自然腾挪。

### 1.3.7 掉落序列与"下一个"预览（确定性种子）

- **掉落池**：可掉落等级 `1..poolMax`，权重表 `DROP_WEIGHTS = [10, 8, 5, 3, 2]`（对应 L1..L5）。
  - `poolMax` 起始 = 4（开局只出 L1–L4，练手感、低风险）；
  - 当 `state.maxLevel ≥ 7`（已合出过 L7）→ `poolMax = 5`（开放 L5）；
  - **永不掉落 L6+**：高级泡泡只能靠合并产生（`CAP_POOL = 5`）。
- **取样**：`nextDropLevel(rng)` 按权重在 `1..poolMax` 内加权随机（用注入的 `rng`）。
- **预览**：`state.current`（待丢）+ `state.next`（下一个）常驻 HUD 预览槽（借鉴 SSRB）。drop 后 `current←next`、`next←nextDropLevel(rng)`。
- **PRNG**：必须可注入种子的 `mulberry32`。
  - 无尽模式：种子 = `(Date.now() ^ 随机) >>> 0`（每局不同，但同一局内序列确定）。
  - **每日挑战**：种子 = `hashSeed("bubble-merge:daily:" + YYYY-MM-DD)`（FNV-1a 32 位）→ **同日期同掉落序列**，全球同题。

### 1.3.8 模式

- **无尽冲分（endless）**：默认模式，随机种子，目标冲最高分 / 合到最大级。
- **每日挑战（daily）**：当日固定种子，超线结算，比"当日最高分 + 最大合成等级"。每日记录按日期存档（`doin.bubble-merge.v1` 内 `daily` 字段，含 `date`）。
- 模式切换在 `ready`/`over` 态进行（`setMode` 重建一局）；`playing` 中切换按钮禁用（no-op）。

### 1.3.9 单局时长与难度自然生长

- 单局约 3–8 分钟（无尽冲分，直到超线）。
- 难度自然生长（无人工关卡）：开局只出 L1–L4 → 随 `maxLevel` 提升开放 L5 → 泡泡越堆越高，空间管理压力递增。

### 1.3.10 物理手感参数（"高弹滑爽快"，engine 常量，可调）

```
GRAVITY        = 1500     // 逻辑单位/s²（下落 660 单位约 0.94s，手感干脆）
RESTITUTION    = 0.36     // 泡泡-泡泡弹性（比水果更弹）
WALL_RESTITUTION = 0.46   // 壁/地弹性
AIR_DRAG       = 0.9992   // 每子步线性阻尼（速度 *= AIR_DRAG）
FLOOR_TANGENT  = 0.985    // 落地切向保留（滑：滚动距离长）
SLEEP_SPEED    = 6        // 速度低于此视为静止（清零，助堆叠稳定）
SOLVER_ITER    = 6        // 每子步碰撞求解迭代次数（堆叠稳定关键）
MAX_CORRECTION = 0.8      // 单次位置修正占 overlap 的比例（防爆炸式弹开）
DROP_COOLDOWN  = 0.5      // 两次掉落最小间隔（s）
```

- **碰撞求解**（每子步 `SOLVER_ITER` 次迭代）：
  - 圆-圆：法向 `n = (b−a)/dist`；接近时（`vRel·n < 0`）施加冲量 `j = −(1+e)·vRel·n / (1/m_a + 1/m_b)`；位置修正按逆质量分摊 `overlap × MAX_CORRECTION`，并**只修正不合并**（合并单独在 1.3.4 处理）。
  - 圆-壁/地：钳制圆心到边界内，法向速度 `×= −WALL_RESTITUTION`，切向 `×= FLOOR_TANGENT`（仅地板）。
- **挤压变形**为纯视觉（render 据碰撞法向短暂压扁），**不进物理状态**，保证 engine 确定性与可测性。

### 1.3.11 容错与无死局说明

- 合法操作（满足 1.3.3 生效条件）**必须执行**，任何层不得拦截/吞掉/伪装失败。
- 无效意图（落点被挡、冷却未结束、非 L10 戳破、终局态操作）→ `action:null` 静默忽略，**严禁 `alert()`**，用页面内 toast。
- localStorage 不可用/坏档 → 静默降级，绝不白屏（见第五节）。

## 1.4 模块架构与接口契约（防接口漂移，第 1 轮前先锁定）

> 严格遵循第四节分层。下表为**必须实现的导出接口**，后续轮次不得改名。

### 1.4.1 `js/engine.mjs`（DOM-free 纯规则，不碰 document/window/localStorage/Canvas）

导出常量：`WORLD, WALL, SAFETY_Y, DROP_Y, FIXED_DT, MAX_SUBSTEPS, RADII, MAX_LEVEL, LEVEL_COUNT, DROP_WEIGHTS, CAP_POOL, GRAVITY, RESTITUTION, WALL_RESTITUTION, AIR_DRAG, FLOOR_TANGENT, SLEEP_SPEED, SOLVER_ITER, MAX_CORRECTION, DROP_COOLDOWN, DANGER_LIMIT, CHAIN_WINDOW, MERGE_ITER, STATUS`。

导出函数：
- `levelRadius(level)` → `RADII[level-1]`（level 1-based，钳制）。
- `clampAimX(x, level)` → 钳制到合法 x。
- `createState(run = {}, { rng, mode, seed })` → 初始 state（见 1.4.2 state 形状）。
- `applyIntent(state, intent, { rng })` → `{ state, events, action }`。
- `stepFrame(state, { rng })` → `{ state, events, action }`（推进一个 `FIXED_DT`）。
- `isRunning(state)`、`mulberry32(seed)`、`hashSeed(str)`、`dailySeed(dateStr)`、`nextDropLevel(rng, state)`。
- `LEVEL_STYLE`：每级 `{ color, glow, alpha }` 纯数据表（供 render/ui/codex/preview 复用，engine 仅存数据不绘制）。

`STATUS = Object.freeze({ ready:"ready", playing:"playing", over:"over" })`。

### 1.4.2 state 形状（engine 就地修改，唯一写入方）

```
{
  mode: "endless" | "daily",
  status: "ready" | "playing" | "over",
  paused: false,
  bubbles: [ { id, level, x, y, vx, vy, r, age, squash } ],  // squash 仅视觉提示，物理不用
  current: 1..5,        // 待丢等级
  next: 1..5,           // 下一个等级
  aimX: number,
  dropCooldown: 0,
  score: 0,
  maxLevel: 0,          // 本局合成到的最高级（0 = 尚未合成）
  maxChain: 0,
  chain: 0,
  sinceMerge: 0,
  dangerTime: 0,
  nextId: 1,
  pops: 0,              // 本局戳破 L10 次数
}
```

### 1.4.3 `js/game.mjs`（DOM-free 控制器）

`createGame(run, { rng, mode, seed })` → `{ rng, state }`；`dispatch(game, intent)` → result；`advanceFrame(game)` → result（内部调 `stepFrame`）；`snapshot(game)` → `{ score, maxLevel, maxChain, mode, pops }`（供 storage 落盘）。

### 1.4.4 `js/render.mjs`（Canvas 2D 唯一绘制层，只读 state）

`createRenderer(canvas)` → `{ resize(), draw(state, fx), burst(x,y,level), ripple(x,y), splash(x,y), setShake(v) }`。内部自持：DPR/ResizeObserver、`contain` 缩放矩阵、粒子系统、涟漪、光斑漂移、shake 衰减。逻辑坐标 → 屏幕坐标换算在本层；指针反算暴露 `toWorld(clientX, clientY)`（main 绑定用）。

### 1.4.5 `js/ui.mjs`（DOM HUD 唯一层）

`mountUI(refs, t)` → `{ applyTexts(state, extra), renderHud(state, records), renderCodex(state), renderPreview(state), showReady(mode), showResult(state, info), showPause(on), showHelp(on), toast(msg), setSoundLabel(muted), setModeTabs(mode, playing), vibrate(pattern) }`。

### 1.4.6 `js/audio.mjs`（WebAudio 程序化合成，零外部音频）

`createAudio({ muted })` → `{ unlock(), setMuted(b), isMuted(), drop(), merge(level), pop(), chain(n), warn(), over(), click() }`。首次手势 `unlock()` 恢复 AudioContext；静音/不支持静默降级不抛错。`merge(level)` 音高随等级上升；`pop()` 为华丽爆裂噪声+下行扫频。

### 1.4.7 `js/score.mjs`（计分唯一口径，纯函数）

`triangular(n)`、`mergeScore(level, chainIndex)`、`POP_BONUS`、`popScore()`、`clampScore(v)`、`isBetterScore(a, b)`。

### 1.4.8 `js/storage.mjs`（存档唯一口径，Key `doin.bubble-merge.v1`）

`load()`、`save(data)`、`defaults()`、`recordResult(data, result)` → `{ data, isNewBest }`、`setSound(enabled)`、`resetAll()`。`result` 形如 `{ kind:"endless"|"daily", score, maxLevel, maxChain, date? }`。normalize 全字段类型/NaN/负数/越界校验，坏档回默认，localStorage 不可用降级内存 Map。

存档形状：
```
{
  sound: true,
  endless: { best: 0, maxLevel: 0, maxChain: 0 },
  daily: { date: "YYYY-MM-DD", best: 0, maxLevel: 0 }   // 当日纪录，跨日重置
}
```

### 1.4.9 `js/i18n.mjs`（全站共享 `doin.lang`）

导出 `LOCALES=["zh","en"]`、`LANG_KEY="doin.lang"`、`DEFAULT_LOCALE="zh"`、`isLocale`、`strings(locale)`、`format`、`detectLocale`、`loadLocale`、`saveLocale`、`htmlLang`。中英键 100% 对齐非空。

### 1.4.10 `js/main.mjs`（装配入口）

绑定 pointer/touch/mouse/keyboard/ResizeObserver；初始化 i18n/storage/audio/game/render/ui；固定步长累加器主循环；engine 事件 → audio/render/ui 分发；语言切换 `saveLocale` 后 `location.reload()`；`?e2e` 时暴露 `window.__bm = { state, intent, snapshot }` 测试钩子。

### 1.4.11 DOM id 契约（index.html ↔ JS 选择器双向闭合）

```
back-home, title-text,
mode-endless, mode-daily,
game-canvas,
codex,                          // 10 级图鉴容器（ui 动态填充）
hud-score, hud-chain, hud-level, hud-best,
preview-current, preview-next,  // 预览槽（ui 据 LEVEL_STYLE 上色）
start-btn, pause-btn, restart-btn, sound-btn, lang-btn, help-btn,
sound-label, lang-label, pause-label, restart-label, help-label,
ready-modal, ready-title, ready-desc, ready-start-btn,
pause-modal, pause-title, pause-desc, resume-btn,
result-modal, result-title, result-score, result-level, result-chain,
result-best, result-newbest, result-restart-btn, result-mode-tip,
help-modal, help-title, help-close-btn, help-body,
toast, danger-banner
```

- 键盘：`←/→` 或 `A/D` 微调落点（aimX ∓ 6）；`Space`/`↓`/`Enter` 释放（drop）；`P` 暂停/继续；`R` 重玩；指针点击 L10 = 戳破。`Space`/方向键必须 `preventDefault()` 防滚动。核心操作不依赖 hover。

## 1.5 视觉方向与桌面美学标准

- **题材关键词**：深海气泡水 · 虹彩玻璃珠 · 梦幻高光 · 静谧水族馆 · 柔软弹性。**不做**水果写实 / 数字泡泡 / 霓虹暗黑——与站内全部题材拉开，治愈系颜值担当。
- **配色**：主色深青底 `#0E3B4D` → 靛蓝 `#1B4F72` 渐变水缸；泡泡虹彩半透明（粉 `#FF9EB5` / 青 `#6FE3E1` / 黄 `#FFD66B` / 紫 `#B39DDB` / 薄荷 / 樱 / 天蓝 / 丁香 / 琥珀 / 虹彩）。背景深青环境光晕缓慢 drift + 细噪点水纹，拒绝死白灰底。
- **桌面端（≥900px）双栏沉浸舞台**：
  - **左主舞台**：深青玻璃水缸 Canvas，背景慢速光斑漂移（仿水下光柱），容器壁微水波反射；泡泡半透明渐变玻璃珠 + 顶部高光点 + 边缘虹彩描边。`max-height: calc(100dvh - 120px)` 自适应视口高度。
  - **右侧水族馆铭牌式 HUD**：① 顶部"合成图鉴"——10 级泡泡链竖排，已合成级点亮、当前目标级发光；② 中部"计分牌卡"——得分/最长连锁/最大合成级，胶囊徽章 + bump 跳字；③ 底部"预览槽"——当前待丢 + 下一个，像池边的下一颗珍珠；④ 操作台——模式切换、开始/暂停/重玩/音效/语言/说明实体触感按键。
- **移动端（≤768px）**：单列紧凑，容器自适应屏宽，预览槽贴底，HUD 折叠为横向胶囊条；390px 不横向溢出。
- **关键动效**：瞄准（落点光圈呼吸 + 虚线轨迹）；合并（"啵"挤压膨胀 + 水面涟漪 + 1px 屏幕 shake）；连锁（每次升级迸小水花）；戳破 L10（虹彩爆裂 + 粒子四溅 + 水波荡漾 + 金色闪光全屏仪式感）；超线预警（安全线变红脉动 + 低沉警示音 + `danger-banner`）。
- **游戏化质感**：HUD 徽章/胶囊/牌匾造型 + 双层软阴影；按键立体微质感、悬停 `translateY(-2px)`、按下 `translateY(1px)`；结算弹窗层次动效（胜利用色、最大级徽章、新高分、微粒子喷发）。
- **零外部资源**：纯 CSS/Canvas 自绘 + WebAudio 合成；只用系统 sans-serif 字体栈，无 webfont、无外链图片/音视频、无 CDN。
- **全部动效受 `@media (prefers-reduced-motion: reduce)` 约束**降级为瞬移（仅减装饰动画/粒子/shake/过渡，不改规则结果）。

## 1.6 必须包含的功能

开始游戏、暂停/继续、重玩、结算反馈、模式切换（无尽/每日）、当前得分/最长连锁/最大合成级显示、下一个预览、音效开关、中/English 切换、本地最高分与最大级存档（无尽 + 每日双纪录）、玩法说明、返回 DOIN 门户首页、桌面鼠标 + 移动触摸 + 键盘三通。

## 1.7 自动化测试计划（详见第七节，四类必交）

- **engine.test.mjs**：固定步长物理（自由落体位移、墙/地钳制、圆-圆分离不重叠）；合并（同级接触→升级、中点、动量平均、连锁、L10 不合并）；戳破（命中 L10 移除 +100、非 L10 no-op）；超线（危险累计→`over`、衰减、age 门排除新泡）；非法/终局态 no-op 不抛错；种子确定性（同 seed 同掉落序列、同 stepFrame 序列状态一致）；**≥1000 步随机游走**（随机 aim/drop/pop/step 混合，断言不变式：无 NaN、泡泡不穿墙/不穿地、score 单调不减、status 合法、不抛错、bubbles 数量有界）。
- **storage.test.mjs**：空档/坏 JSON/缺字段/错类型/负数/NaN/Infinity/越界 → normalize 回默认或钳制；localStorage 不可用 → 内存降级仍可 load/save；`recordResult` 双纪录只增不减、每日跨日重置。
- **i18n.test.mjs**：中英键集合完全相等、无空串/undefined；`detectLocale`（saved > navigator zh > 默认）；`format` 变量替换；非法语言回退 `DEFAULT_LOCALE`。
- **markup.test.mjs**：读 `index.html`/`css/style.css`/`js/main.mjs` 静态验证 DOCTYPE、`html lang`、viewport、meta description、favicon、`<noscript>`、`<a href="/">`、本地 CSS/JS 带 `?v=dev`、import 相对路径、**1.4.11 全部 DOM id 在 index.html 出现且与 main/ui 选择器闭合**、系统字体栈、390px 媒体查询、`prefers-reduced-motion`、无 `alert(`、无 `http://`/`https://` 外链/CDN/webfont/远程图片。

====================

二、DOIN 架构与交付边界

====================

DOIN.WIN 是静态网页游戏门户，每款游戏存放在独立子目录内。游戏目录 `games/bubble-merge/`；本地调试路径 `/games/bubble-merge/`；线上路径 `/bubble-merge/`（构建时扁平化）。

**【交付范围限制】** 你只负责开发此独立小游戏，严格仅生成 `games/bubble-merge/` 目录内部的完整文件。**严禁修改或生成门户外层文件**：根 `index.html`、`games.json`、根 `package.json`、GitHub Actions 工作流、`dist/`、部署脚本、站点级 CSS/JS 或其他门户文件。games.json 登记、封面制作、根测试脚本、机器验收、构建、部署、发布均由门户方负责。

**【路径引用规范与唯一例外】**
1. 所有本地资源引用与模块 import 必须用严格相对路径：`css/style.css`、`js/main.mjs`、`favicon.svg`、`./engine.mjs?v=dev`。
2. 严禁游戏内部使用绝对路径：`/games/bubble-merge/`、`/bubble-merge/`、`C:\...`、`file://...`。
3. HTML 中本地 CSS/JS 引用必须保留 `?v=dev`：`href="css/style.css?v=dev"`、`src="js/main.mjs?v=dev"`。
4. JS 之间本地 ES Module import 也必须保留 `?v=dev`：`import { createState } from "./engine.mjs?v=dev";`。
5. **【唯一绝对路径例外】** "返回游戏门户首页"链接必须用 `href="/"`（即 `<a href="/" id="back-home">`），不得用易错位的相对路径跳出游戏目录。

====================

三、渲染策略与自包含规范

====================

**【双轨渲染分工——本作裁决】**
- 本作"掉落物理合成"属于**连续运动 + 物理碰撞 + 粒子特效玩法**，**裁决：主舞台用 Canvas 2D** 绘制水缸、泡泡、瞄准线、安全线、涟漪、粒子、光斑、戳破爆裂、shake。
- **所有 HUD、按钮、菜单、弹窗、模式切换、语言切换、玩法说明、计分牌、图鉴、预览槽文本必须保留在语义化 DOM 层**（`ui.mjs`）；不得在 Canvas 内手绘表单/长文本/菜单/需无障碍阅读的内容；不得在连续运动场景滥用大量 DOM 节点（泡泡一律 Canvas，不用 DOM 节点表示）。
- **不上 Three.js**：本作是 2D 物理，不需要真实 3D 场景/摄像机/光照/模型；不得为"看起来高级"强行引入。
- 预览槽与图鉴的泡泡小图：用 DOM 元素 + CSS 径向渐变（据 `LEVEL_STYLE` 上色），或独立小 Canvas，二选一；不引外部图片。

**【游戏舞台布局要求】** 桌面端必须像完整宽屏游戏页面，不是手机网页套在桌面中央：游戏舞台占据浏览器主要可视区；桌面宽屏舒展双栏（左 Canvas 水缸 + 右 HUD），游戏区/HUD/按钮集中在舞台附近；可有紧凑工具栏与返回按钮；**不得**做传统门户式大页头/营销文案区/页尾；**不得**把整个游戏限制成窄手机屏；**不得**出现大面积黑边/手机外壳/竖屏模拟框/生硬居中黑容器；**不得**整体锁 9:16；水缸可保持固定比例但页面不模拟手机竖屏；桌面宽屏充分利用空间；移动端自然收缩，390px 不横向溢出；核心操作不依赖 hover。

**【零外链与自包含底线】** 原生 HTML5 + CSS3 + JavaScript ES Modules；默认零依赖、零构建、零 npm；严禁外部 CDN/远程 API/在线字体/远程图片；只用系统字体栈，不加载 WebFont；禁止 `alert()` 做游戏反馈（用页面内 DOM toast/提示区/结算面板）；破坏性操作（如清空存档）可用 `confirm()`，其他交互不依赖原生模态框。

**【音效发生器——本作裁决：包含音效】** 必须用原生 Web Audio API + 振荡器/合成器程序化音效；首次用户手势（"开始游戏"按钮）解锁 AudioContext；静音时静默降级；浏览器不支持 Web Audio 不抛错；严禁外部音频文件。音效清单：drop（轻"咚"）、merge（"啵"，音高随级升高）、chain（连锁递进音）、pop（L10 华丽爆裂）、warn（超线低沉警示）、over（结算）、click（按钮）。

**【视觉图元】** 优先 CSS/内联 SVG/Canvas 实时绘制；严禁外部位图与外部图片 URL；不制作带文字/logo/水印的游戏内素材。`favicon.svg` 为自包含 SVG（一颗虹彩泡泡），不依赖外部资源。

====================

四、代码组织与模块架构

====================

代码需在 `games/bubble-merge/` 内清晰模块化，单向数据流、职责隔离。严禁为凑目录生成空文件、透传包装层或无作用模块。结构（与 1.4 接口契约对应）：

```
games/bubble-merge/
  index.html        语义骨架 + 资源挂载，无内联大段 CSS/实现脚本
  favicon.svg       自包含虹彩泡泡图标
  css/style.css     响应式双栏舞台 + 390px + 系统字体栈 + reduced-motion + HUD/按键质感
  js/engine.mjs     纯规则 + 固定步长物理 + 合并/戳破/超线 + 种子掉落（DOM-free）
  js/game.mjs       DOM-free 控制器（createGame/dispatch/advanceFrame/snapshot）
  js/render.mjs     Canvas 2D 渲染 + DPR/ResizeObserver + 粒子/涟漪/shake
  js/ui.mjs         DOM HUD/图鉴/预览/弹窗/toast/语言/焦点
  js/audio.mjs      WebAudio 程序化音效
  js/score.mjs      计分唯一口径（三角数 + 连锁 + 破灭）
  js/storage.mjs    存档唯一口径（doin.bubble-merge.v1，normalize + 降级）
  js/i18n.mjs       中英双表 + 全站统一语言 API（doin.lang）
  js/main.mjs       装配入口（绑定事件 + 固定步长主循环 + e2e 钩子）
  tests/engine.test.mjs
  tests/storage.test.mjs
  tests/i18n.test.mjs
  tests/markup.test.mjs
```

`index.html` 必含：正确 `<!DOCTYPE html>`、`html lang`、viewport、meta description、favicon 相对链接、`<noscript>` 兜底、`<a href="/">` 返回门户、游戏舞台/HUD/按钮/说明挂载节点（id 见 1.4.11）；不得内联大段 CSS 或游戏实现脚本；不得做传统网站式页头页尾。

====================

五、系统协同规范

====================

**【统一 i18n API】** 全局语言 Key 必须用 `doin.lang`。探测优先级：① 已保存的 `doin.lang` → ② `navigator.language`（`zh*` 用中文）→ ③ 默认（本作 `DEFAULT_LOCALE="zh"`，与站内一致；其他语言回退英文）。`js/i18n.mjs` 必须导出 `LOCALES, LANG_KEY, DEFAULT_LOCALE, isLocale, strings, format, detectLocale, loadLocale, saveLocale, htmlLang`。中英键值对完整对齐，无空串/undefined；切换语言 `saveLocale(locale)` 后完整重渲染或 `location.reload()`；语言按钮有清晰 `aria-label` 且支持键盘操作。

**【数据持久化与 Normalize】** 存档 Key 必须用 `doin.bubble-merge.v1`。所有 localStorage 读写只能集中在 `storage.mjs`；所有读写与 `JSON.parse` 必须 `try/catch`；`JSON.parse` 结果不得直接信任，所有字段严格类型检查，所有数值检查 NaN/Infinity/负数/边界；存档缺失/损坏/版本不兼容/存储不可用 → 回退模块内存默认值；localStorage 不可用仍必须能正常开始游戏；不得因隐私模式/配额/坏档白屏。

====================

六、画布、交互质量与状态底线

====================

**【Canvas 规范】** 据 `window.devicePixelRatio` 设物理分辨率（`setPixelRatio` 上限 2，避免高分屏显存异常），CSS 维持逻辑尺寸；用 `ResizeObserver`（或 resize 事件）同步；指针/触摸/鼠标坐标必须经 `getBoundingClientRect()` 换算（含 `contain` 缩放反算），不得假设 CSS 尺寸 = Canvas 物理像素；连续运动基于 Delta Time，每帧 dt 上限 `Math.min(dt, 0.1)`；**复杂物理用固定时间步累计更新**（1.3.1 累加器，每帧最多 `MAX_SUBSTEPS` 子步）；浏览器后台恢复后不得瞬移/穿模/速度异常；适配移动触摸与桌面鼠标；核心操作不依赖 hover。

**【键盘与可访问性】** 核心玩法提供匹配键盘操作（1.4.11：方向键微调落点、Space/↓ 释放、P 暂停、R 重玩、点击戳破）；按钮/菜单有清晰焦点状态；用 `aria-label`/`role`/`aria-live`（得分/连锁变化用 `aria-live="polite"`）；HUD 与结算文本能被屏幕阅读器读取；Canvas 只负责视觉时，关键玩法信息（得分、最大级、模式、下一个预览等级）必须有 DOM 文本/语义替代，不能只画在 Canvas 内。

**【规则执行与状态安全】** 任何被 engine 判定合法的操作必须完整执行；game/事件处理/render/ui 层不得再次拦截、吞掉或伪装合法操作；渲染结果必须始终来自最新 engine state；render 不得维护与 engine 冲突的规则状态；`paused`/`over`/`ready` 等不接受玩法输入的状态下，玩法输入必须安全 no-op 且不抛错；终止态操作不得改变规则状态；随机逻辑必须支持种子注入（`mulberry32`）；掉落序列与物理必须可固定种子稳定复现；挑战类玩法保证数值增长平滑可控，不制造系统性不可恢复死局。

**【视口与页面布局】** 390px 移动端不横向溢出；桌面端宽屏游戏舞台；不得做成手机竖屏模拟/大黑边/生硬竖屏容器；水缸可正方形或固定比例；桌面按钮/HUD 集中在游戏区附近；不得用传统营销页/页头/页尾/大段说明占据主要游戏区；必须适配 `@media (prefers-reduced-motion: reduce)`，关闭减少动效后核心玩法与状态推进仍正常（只减装饰动画/粒子/shake/过渡，不改规则结果）。

====================

七、自动化测试规范

====================

必须在 `games/bubble-merge/tests/` 下提供全部四个测试文件：`engine.test.mjs`、`storage.test.mjs`、`i18n.test.mjs`、`markup.test.mjs`。统一使用：

```js
import test from "node:test";
import assert from "node:assert/strict";
```

禁止依赖 JSDOM、浏览器 DOM、Canvas API 或真实浏览器环境（engine/score/storage/i18n 均为 DOM-free，可直接 import 测试；markup 测试只读文件文本做静态正则校验）。

具体覆盖项见 **1.7 测试计划**（已按本作玩法逐条写明）。补充硬要求：
- engine 测试必须含**固定 PRNG 确定性**断言（同 seed → 同 `nextDropLevel` 序列、同 `stepFrame` 轨迹）。
- engine 测试必须含 **≥1000 步随机游走**：注入固定种子，随机混合 `aim/drop/pop/step/pause` 意图，断言全程不抛错、不变式不破（无 NaN/Infinity；泡泡圆心始终在 `[WALL+r, width-WALL-r]` × `≤ height-WALL-r` 内；`score` 单调不减；`status ∈ {ready,playing,over}`；`bubbles.length` 有界，如 ≤ 200）。
- 不变量写进测试：**合法操作永不报错**；终止态/暂停态上的玩法操作是 no-op 而非异常。
- 测试按 `node --test` **显式列文件**形式组织（Node 22 不递归目录）；根 `package.json` 的 `test:bubble-merge` 由门户方注册。

====================

八、代码生成与交付协议

====================

**【文件标识规范】** 每个独立代码块首行用单行注释声明相对项目根的完整路径：`// filepath: games/bubble-merge/path/to/filename.ext`（HTML/CSS/JS/MJS/SVG 一律如此）。该标记由插件识别并在落盘时移除，不属于最终文件内容。

**【完整性承诺】** 必须输出生产级完整代码；禁止 `...`、"同上"、只输出 diff、`// TODO`、伪代码、截断逻辑、省略必要模块；除 filepath 标记外不得用导致文件内容不完整的占位注释。

**【防止接口漂移】** 输出第 1 轮前先在内部规划全部文件、确定最终 slug（已定 `bubble-merge`）、规划全部 DOM id（1.4.11）/按钮 id/模块导出接口（1.4）/事件命名；后续轮次严格复用第 1 轮已确定的 id 与接口；若必须修改前面已输出文件，重新完整输出该文件，禁止只给片段。

**【三轮交付流程】** 严格分三轮，每轮只在完整文件边界结束：
- **第 1 轮**：`index.html`、`favicon.svg`、`css/style.css`。
- **第 2 轮**：`js/` 下全部模块（engine、game、render、ui、audio、score、storage、i18n、main）。
- **第 3 轮**：`tests/engine.test.mjs`、`tests/storage.test.mjs`、`tests/i18n.test.mjs`、`tests/markup.test.mjs`。

输出完当前轮次后主动暂停等待指令；某文件单次容量不足时在该文件开始前暂停并提示"输入【继续】输出下一文件"。

**【最终交付核对】** 第 3 轮完成附人工核对清单，逐项确认：已统一最终 slug；所有 import 的相对文件均已实际输出且路径/文件名吻合；本地 CSS/JS/import 均保留 `?v=dev`；`index.html` 容器/按钮 id 与 JS 选择器完全闭合（对照 1.4.11）；桌面端是宽屏双栏游戏舞台不是手机竖屏模拟；移动端 390px 不横向溢出；中英双语键 100% 对齐无 undefined/空串；存档 Key 用 `doin.bubble-merge.v1`；localStorage 经 try/catch 与 normalize；合法 engine 操作都能执行；终止/暂停态操作是安全 no-op；物理为固定步长且可种子复现；合并/连锁/戳破/超线判定与 1.3 一致；`prefers-reduced-motion` 已覆盖；无 CDN/外链字体/远程图片/远程 API；engine DOM-free（无 document/window/localStorage）；测试按 Node 原生规范编写；若无真实运行环境只能声明"已按规范编写，未在本地实际运行"，不得虚假声称测试通过；外部承接方只交付 `games/bubble-merge/` 内文件，未改门户文件。
