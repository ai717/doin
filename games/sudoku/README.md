# 数独游戏 Sudoku

打开就能玩的网页数独。入门到专家、每日挑战、分步提示、笔记、成就与简体 / 繁體 / English。

## 本地运行

需要 [Node.js](https://nodejs.org/) 20 或以上。

```bash
npm install
npm run dev
```

浏览器打开 [http://localhost:8080](http://localhost:8080)。

| 命令 | 作用 |
|---|---|
| `npm run dev` | 开发服务器（默认 8080 端口） |
| `npm run build` | 生产构建 |
| `npm run typecheck` | TypeScript 检查 |
| `npm test` | 引擎与积分测试 |

数据存在浏览器 `localStorage`，不需要数据库账号。改端口可编辑 `package.json` 里 `dev` 脚本的 `--port`。

## 目录

```
src/
  engine/     出题、求解、提示技巧
  game/       对局状态、积分、成就
  components/ 棋盘、数字盘、顶栏
  i18n/       简体 / 繁體 / English
  routes/     页面路由
public/       图标与分享图
docs/PRD-v1.md
```

## 技术

TanStack Router SPA + React + Vite + Tailwind CSS + Zustand。构建产物是纯静态
文件，部署在主站的 /sudoku/ 子目录。
