# DOIN 现状查重底表（小游戏项目调研专用）

> **运行前必读并刷新**：本表是 2026-09-21 快照。每次调研前先重新读取
> `G:\work\code\game\doin\games.json`（已上架）与 `G:\work\code\game\doin\docs\plans\`（已策划），
> 以最新数据为准，本表仅作快速参考。

## 1 · 已上架游戏（29 款，禁止再推同类立项）

| slug | 中文名 | 玩法类型 | tags |
|---|---|---|---|
| sudoku | 数独 | 逻辑填数 | 益智/经典 |
| 2048 | 2048 | 数字合并滑动 | 益智/经典/数字 |
| tic-tac-toe | 井字棋 | 人机/双人连子 | 益智/对战/经典 |
| freecell | 空当接龙 | 纸牌接龙 | 益智/纸牌/经典 |
| minesweeper | 扫雷 | 网格扫雷（无猜） | 益智/经典/无猜 |
| orbit-sort | 星轨调度大师 | 轨道颜色排序 | 益智/排序/每日挑战 |
| gold-miner | 黄金矿工 | 钩爪时机动作 | 休闲/经典/时机 |
| tetris-neo | 俄罗斯方块 | 下落方块消除 | 益智/经典/街机 |
| zuma | 祖玛传奇 | 轨道弹珠射击消除 | 休闲/消除/经典 |
| Gravity-Echoes | 重力回响 | 弹道反弹肉鸽 | 街机/物理/肉鸽 |
| Tile-Matching | 开心消消乐 | 三消交换 | 休闲/消除/益智 |
| snake-orchard | 果园贪吃蛇 | 方向控制成长 | 休闲/经典/反应 |
| one-line | 一笔连线 | 一笔画穿格 | 益智/连线/一笔画 |
| klotski | 华容道 | 滑块推盘 | 益智/经典/策略 |
| jigsaw | 拼图 | 碎片交换复原 | 益智/视觉/每日挑战 |
| link-up | 喜福连连看 | 配对连线消除 | 益智/消除/经典 |
| pair-link | 琉璃灯市·连连看 | 配对连线消除（灯市主题） | 益智/消除/经典 |
| bubble-merge | 深海合珠 | 物理掉落合成 | 休闲/合成/物理 |
| bubble-bloom | 合成泡泡 | 物理掉落合成 | 益智/物理/合成 |
| cloud-merge | 云朵合成 | 物理掉落合成 | 休闲/合成/物理 |
| water-sort | 色彩排序 | 试管液体分类 | 益智/排序/经典 |
| piano-tiles | 别踩白块儿 | 节奏点击 | 街机/反应/音乐 |
| jump-jump | 跳一跳 | 按压跳跃时机 | 街机/时机/休闲 |
| cut-the-rope | 割绳子 | 物理切割解谜 | 益智/物理/经典 |
| candy-drop | 糖果坠落 | 物理堆叠解谜 | 益智/物理/解谜 |
| road-bash | 暴力摩托 | 横版竞速动作 | 街机/竞速/动作 |
| deep-devour | 深海吞噬 | 吞噬成长 | 街机/动作/成长 |
| lantern-maze | 灯笼巷 | 迷宫动作 | 街机/迷宫/动作 |
| number-klotski | 数字华容道 | 数字滑块 | 益智/经典/数字 |
| pong | 街机乒乓 | 双人对战 | 街机/经典/对战/双人 |

## 2 · 已策划未上架（PRD 已存在，直接避免；可提示"待开发"而非"新点子"）

`docs/plans/` 现有：watermelon-2048（数字合成大西瓜）、sokoban（推箱子）、fire-ice（冰火）——**未上架**。
其余 PRD（jigsaw/link-up/pair-link/bubble-merge/bubble-bloom/cloud-merge/water-sort/piano-tiles/jump-jump/cut-the-rope/candy-drop/road-bash/deep-devour/lantern-maze/number-klotski/pong）已全部上架。

## 3 · 品类饱和预警（谨慎/避开）

- **物理掉落合成已 3 款**（bubble-merge / bubble-bloom / cloud-merge）→ 合成类除非有真正反直觉的新机制，否则不推。
- **配对连线已 2 款**（link-up / pair-link）→ 连连看不再推。
- **益智/经典 tag 超饱和**（13+ 款）→ 新点子优先往街机/动作/模拟/叙事等空白区走。
- **深海/天空/果园/民俗题材已占用**（深海水族系、云朵天空系、果园糖果系、中国风系各 1-2 款）→ 换题材时避开。

## 4 · 当前品类空白区（调研优先瞄准）

1. **弹幕/射击类**：太空打飞机、打靶、炮台防御——全站为零。
2. **塔防类**：路径塔防/阵地塔防——为零。
3. **打砖块/弹球类**：Breakout / Arkanoid / 弹珠台——为零（pong 是双人乒乓，不是打砖块）。
4. **泡泡龙类**（bubble shooter 射击消除）——为零（zuma 是轨道弹珠，不同）。
5. **平台跳跃/跑酷类**：横版跳跃闯关——为零（jump-jump 是原地跳）。
6. **卡牌/策略类**：自走棋、卡牌构筑、麻将/斗地主、五子棋/象棋——除 tic-tac-toe 外为零。
7. **模拟/放置/养成类**：点击放置、种田经营、宠物养成——为零。
8. **叙事/文字解谜类**：密室逃脱、文字冒险、剧情选择——为零。
9. **记忆/反应复合类**：翻牌配对、Simon 记忆——为零。
10. **多人同屏类**：pong 已有双人，可扩展同屏对抗（贪吃蛇对战/乒乓球桌/台球）。

## 5 · 封面题材与色相占用（新点子题材设计时避让）

- 中国风（klotski 鎏金 / link-up 喜福 / pair-link 琉璃灯市）、深海（bubble-merge / deep-devour）、天空（cloud-merge）、果园糖果（snake-orchard / candy-drop）、实验室水彩（water-sort）、黑白琴键（piano-tiles）、霓虹（tetris-neo）均已占用。
- 色相：蓝紫系、青绿系饱和；粉红/天蓝/青柠/草绿/暖橙/粉紫/靛蓝/明黄/绯红/橙红已被各封面占用——**新封面先查 COVER-STYLE.md 登记表**。
