import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist");
const gamesRoot = resolve(root, "games");
const games = JSON.parse(readFileSync(resolve(root, "games.json"), "utf8")).games;
const npmCli = resolve(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
const buildId = process.env.BUILD_ID || process.env.GITHUB_SHA?.slice(0, 12) || (process.env.CI ? `build-${Date.now()}` : "dev");
let spaFallback;

function removeOutput(path) {
  if (!existsSync(path)) return;
  if (process.platform === "win32") {
    execFileSync("cmd", ["/c", "if", "exist", path, "rd", "/s", "/q", path], { stdio: "ignore" });
  } else {
    execFileSync("rm", ["-rf", path], { stdio: "ignore" });
  }
}

const SKIPPED = new Set(["node_modules", "dist", "tests", "test", "__tests__"]);

function copyGame(source, destination, exclude = []) {
  const skipped = new Set([...SKIPPED, ...exclude]);
  cpSync(source, destination, {
    recursive: true,
    filter: (src) => {
      if (src === source) return true;
      const top = relative(source, src).split(sep)[0];
      if (!top || top === "..") return true;
      return !skipped.has(top) && !top.startsWith(".");
    },
  });
}

function runNpm(args, cwd) {
  const options = { cwd, stdio: "inherit" };
  if (process.platform === "win32") {
    execFileSync(process.execPath, [npmCli, ...args], options);
  } else {
    execFileSync("npm", args, options);
  }
}

function rewriteBuildVersion(directory) {
  const extensions = new Set([".css", ".html", ".js", ".mjs"]);
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry);
    if (statSync(path).isDirectory()) {
      rewriteBuildVersion(path);
      continue;
    }
    if (!extensions.has(path.slice(path.lastIndexOf(".")))) continue;
    const source = readFileSync(path, "utf8");
    const rewritten = source.replaceAll("?v=dev", `?v=${buildId}`);
    if (rewritten !== source) writeFileSync(path, rewritten);
  }
}

removeOutput(output);
mkdirSync(output, { recursive: true });

for (const entry of ["assets", "css", "js"]) {
  cpSync(resolve(root, entry), resolve(output, entry), { recursive: true });
}
for (const file of ["index.html", "games.json", "robots.txt"]) {
  cpSync(resolve(root, file), resolve(output, file));
}

for (const game of games) {
  if (game.comingSoon) continue;
  const source = resolve(gamesRoot, game.slug);
  if (!existsSync(source)) throw new Error("Missing source for published game: " + game.slug);

  const packageFile = resolve(source, "package.json");
  const staticIndex = resolve(source, "index.html");
  const destination = resolve(output, game.slug);
  if (existsSync(packageFile)) {
    const packageJson = JSON.parse(readFileSync(packageFile, "utf8"));
    if (!packageJson.scripts || !packageJson.scripts.build) throw new Error("No build script for game: " + game.slug);
    if (process.env.CI || !existsSync(resolve(source, "node_modules"))) {
      runNpm(["ci"], source);
    }
    const built = resolve(source, "dist");
    removeOutput(built);
    runNpm(["run", "build"], source);
    if (!existsSync(resolve(built, "index.html"))) throw new Error("Build produced no index.html for game: " + game.slug);
    cpSync(built, destination, { recursive: true });
  } else if (existsSync(staticIndex)) {
    copyGame(source, destination, game.exclude);
  } else {
    throw new Error("Game needs index.html or package.json: " + game.slug);
  }

  if (game.spa) {
    const index = resolve(destination, "index.html");
    if (spaFallback) throw new Error("Only one history-mode SPA fallback is supported by GitHub Pages");
    cpSync(index, resolve(destination, "404.html"));
    spaFallback = index;
  }
}

if (spaFallback) cpSync(spaFallback, resolve(output, "404.html"));

rewriteBuildVersion(output);

execFileSync("node", [resolve(root, "scripts/gen-sitemap.mjs"), resolve(output, "sitemap.xml")], { stdio: "inherit" });
console.log(`Built static site: ${output} (build ${buildId})`);
