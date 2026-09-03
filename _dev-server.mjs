// 最小静态服务器（不依赖 npm，避免 serve 启动慢/占资源）
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = __dirname;
const PORT = Number(process.env.PORT || 46810);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".mjs":  "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico":  "image/x-icon",
  ".map":  "application/json; charset=utf-8",
  ".txt":  "text/plain; charset=utf-8",
  ".mp3":  "audio/mpeg",
  ".wav":  "audio/wav",
  ".ogg":  "audio/ogg",
};

function safeJoin(root, reqPath) {
  const decoded = decodeURIComponent(reqPath.split("?")[0]);
  let target = path.normalize(path.join(root, decoded));
  if (!target.startsWith(root)) target = path.join(root, "index.html");
  return target;
}

const server = http.createServer((req, res) => {
  try {
    let filePath = safeJoin(ROOT, req.url);
    // 目录 → index.html
    let st;
    try { st = fs.statSync(filePath); } catch { /* miss */ }
    if (st && st.isDirectory()) filePath = path.join(filePath, "index.html");
    fs.readFile(filePath, (err, data) => {
      if (err) {
        // 游戏内 SPA fallback: 如果 games/<slug>/xxx 不存在且根 games/<slug>/index.html 存在 -> 回那个
        const parts = req.url.split(/[?#]/)[0].split("/").filter(Boolean);
        if (parts[0] === "games" && parts[1]) {
          const idx = path.join(ROOT, "games", parts[1], "index.html");
          if (fs.existsSync(idx)) {
            res.writeHead(200, { "Content-Type": MIME[".html"] });
            res.end(fs.readFileSync(idx));
            return;
          }
        }
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("404 Not Found");
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const ct = MIME[ext] ?? "application/octet-stream";
      res.writeHead(200, {
        "Content-Type": ct,
        "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=5", // 开发时快速刷新
        "Content-Length": data.length,
      });
      res.end(data);
    });
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("500 " + String(err?.message ?? err));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[doin] HTTP ready: http://localhost:${PORT}/games/orbit-sort/`);
});
server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(`[doin] Port ${PORT} busy, retrying +1...`);
    server.close(() => server.listen(PORT + 1, "0.0.0.0"));
  } else { console.error(e); process.exit(1); }
});
