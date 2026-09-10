# 封面风格规范 · Cover Style Guide

> 适用范围：门户首页所有游戏封面 `assets/covers/<slug>.webp`。
> 新增、替换、重做封面一律按本文档执行，保证整墙 12 张卡片视觉一致。
> 本规范面向执行 AI：照抄第四章 Prompt 模板、按第五章后处理落盘即可。

***

## 1 · 风格公式（五条硬约束）

每张封面必须同时满足：

1. **3D 软胶 / 黏土质感**：圆角、厚实、带柔和光泽的玩具塑料感（soft 3D clay render / glossy toy-plastic）。
   不是扁平矢量、不是像素、不是写实渲染、不是线框霓虹。
2. **单一居中主体**：一个主角物件/角色占据画面中心，周围少量陪衬元素。**不要拼贴多个并列主体**，
   不要做成游戏内 UI 截图。
3. **柔和彩色渐变背景**：整张背景是平滑的单色系渐变，**必须明显有色**（禁止纯白、禁止纯黑、
   禁止暗黑霓虹），亮度整体偏亮。
4. **漂浮粒子点缀**：背景中散布少量柔和光点 / 小方块 / 火花，增强质感，不喧宾夺主。
5. **无任何文字**：不得出现标题、字母、数字、logo、UI 标签。连"看起来像字"的形状都不要。

## 2 · 构图与配色

- **画布**：1:1，最终交付 640×640 WebP（生成 1024×1024 后缩放）。
- **主体占比**：主体连同陪衬约占画面 60%–75%，四周留白，不出血、不裁切到边缘。
- **光源**：左上主光，柔和环境光，投影短而软。
- **配色**：每张一个主色系，尽量在整墙中**不撞色**。

现有封面配色登记表（新增时避开已饱和色相）：

| slug | 主体 | 背景色系 |
|---|---|---|
| sudoku | 数字方块 | 青绿 |
| 2048 | 数字方块 | 米黄暖橙 |
| tic-tac-toe | X / O 棋子 | 蓝紫 |
| freecell | 纸牌扇 + 空当槽 | 青绿 ⚠ 与 sudoku 接近 |
| minesweeper | 地雷 | 蓝 |
| orbit-sort | 星球轨道 | 深蓝紫 |
| gold-miner | 矿工 + 钢爪 | 暖橙金 |
| tetris-neo | 四格方块 | 紫蓝 |
| zuma | 石蛙 + 彩珠 | 暖绿金 |
| Gravity-Echoes | 星球 + 轨道环 | 蓝紫 ⚠ 与 tetris-neo / orbit-sort 接近 |
| Tile-Matching | 糖果方块 | 粉紫 |
| snake-orchard | 小蛇 + 苹果 | 草绿 |

> 蓝紫系已有 3 张、青绿系 2 张，已饱和。新封面优先选**未被占用**的色相：
> 粉红、橙红、靛蓝、青柠、暖棕、天蓝。

## 3 · 禁止项（常见翻车）

| 翻车形态 | 说明 |
|---|---|
| 扁平 UI 截图风 | 直接截游戏界面当封面，质感与 3D 卡片完全不搭 |
| 暗黑霓虹 / 线框风 | 与整墙明亮柔和基调相反 |
| 画面带文字 | 标题、英文名、UI 角标一律禁止（历史上 zuma、Tile-Matching、freecell 都犯过） |
| 纯白 / 近白背景 | 卡片贴到首页像"没画完"，必须给明显色相 |
| 写实渲染 / 3A 质感 | 与软胶玩具风割裂（gold-miner 早期版本犯过） |
| 生成水印残留 | 右下角"AI生成"水印必须清干净再落盘 |

## 4 · 生成 Prompt 模板

替换 `{SUBJECT}`（主体描述）与 `{COLOR}`（背景色系）：

```
Soft 3D clay render app icon on a colored gradient background (not white, not dark, not black):
{SUBJECT}. Single centered composition, soft {COLOR} bright gradient background,
subtle floating particles and sparkles, no text, no letters,
cute glossy toy-plastic high quality 3D illustration, square format.
```

示例（zuma 实际使用）：

```
Soft 3D clay render app icon on a colored gradient background (not white, not dark, not black):
a cute glossy stone frog head with a round open mouth in the center, a curved spiral chain of
glossy colorful marble spheres in red, blue, yellow, purple and green leading toward its mouth.
Single centered composition, soft warm green-gold bright gradient background,
subtle floating particles and sparkles, no text, no letters,
cute high quality 3D illustration, square format.
```

要点：
- 生成参数：1024×1024、quality high。
- 若首版背景偏白或偏暗，改 prompt 补一句强调（`the background must be a colored gradient, not white`）重生成，不要将就。
- 主体要用**游戏最具辨识度的物件**，不要写玩法流程。

## 5 · 后处理流水线（必做）

生成图右下角带半透明"AI生成"水印，必须清除后再落盘。

1. **去水印**：对右下角固定区域 `x > 0.80·W, y > 0.91·H` 做 `cv2.inpaint(..., INPAINT_TELEA, radius=7)`。
   - ⚠ 不要用"检测白色像素"的方式定位水印——半透明水印漏检率高，必须走固定 bbox。
   - 参考脚本：`.workbuddy/tmp/covers/process2.py`（可复制改 MAP 复用）。
   - 环境：`C:/Users/everg/.workbuddy/binaries/python/envs/default/Scripts/python.exe`（已装 opencv-python-headless + numpy）。
2. **缩放**：`INTER_AREA` 到 640×640。
3. **落盘**：`cv2.imwrite(..., [IMWRITE_WEBP_QUALITY, 90])`，覆盖 `assets/covers/<slug>.webp`。
   - 文件名与路径不变 → `games.json` **零改动**。
4. **构建**：`npm run build` 同步 dist。
5. **核查**：用图片查看器过一遍右下角，确认水印无残留。

## 6 · 验收清单

- [ ] 3D 软胶质感，非扁平 / 非写实 / 非暗黑
- [ ] 单一居中主体，无并列拼贴
- [ ] 背景为明显彩色渐变（非白非黑）
- [ ] 有漂浮粒子
- [ ] 无文字、无 logo
- [ ] 右下角无水印
- [ ] 640×640 WebP，文件在 `assets/covers/<slug>.webp`
- [ ] 与现有 12 张放一起不突兀、不撞色
- [ ] `npm run build` 通过
