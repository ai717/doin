import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist");
const gamesRoot = resolve(root, "games");
const games = JSON.parse(readFileSync(resolve(root, "games.json"), "utf8")).games;
const npmCli = resolve(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
let spaFallback;

rmSync(output, { recursive: true, force: true });
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
      execFileSync(process.execPath, [npmCli, "ci"], { cwd: source, stdio: "inherit" });
    }
    execFileSync(process.execPath, [npmCli, "run", "build"], { cwd: source, stdio: "inherit" });
    const built = resolve(source, "dist");
    if (!existsSync(resolve(built, "index.html"))) throw new Error("Build produced no index.html for game: " + game.slug);
    cpSync(built, destination, { recursive: true });
  } else if (existsSync(staticIndex)) {
    cpSync(source, destination, { recursive: true });
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

execFileSync("node", [resolve(root, "scripts/gen-sitemap.mjs"), resolve(output, "sitemap.xml")], { stdio: "inherit" });
console.log("Built static site: " + output);
