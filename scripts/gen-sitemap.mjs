import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const siteUrl = "https://doin.win";
const output = process.argv[2] ? resolve(process.argv[2]) : resolve(root, "sitemap.xml");
const games = JSON.parse(readFileSync(resolve(root, "games.json"), "utf8")).games;
const urls = [siteUrl + "/"];

for (const game of games) {
  if (game.comingSoon) continue;
  urls.push(game.url.startsWith("http") ? game.url : new URL(game.url, siteUrl).href);
}

const rows = urls.map(function (url) {
  const priority = url === siteUrl + "/" ? "1.0" : "0.8";
  return "  <url><loc>" + url + "</loc><changefreq>weekly</changefreq><priority>" + priority + "</priority></url>";
});
const xml = [
  "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
  "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">",
  ...rows,
  "</urlset>",
  ""
].join("\n");

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, xml);
console.log("Generated " + output);
