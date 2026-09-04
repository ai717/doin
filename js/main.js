import { gameTitle, htmlLang, loadLocale, saveLocale, strings } from "./i18n.mjs";

// locale 只在启动时读一次（切换语言 = saveLocale + 整页刷新）。
const locale = loadLocale();
const t = strings(locale);

const grid = document.querySelector("#game-grid");

document.querySelector("#year").textContent = String(new Date().getFullYear());

// 按当前语言刷写 index.html 静态中文文案（SEO 兜底保留中文）。
function applyStaticTexts() {
  document.documentElement.lang = htmlLang(locale);
  document.title = t.docTitle;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute("content", t.metaDesc);
  const ogLocale = document.querySelector('meta[property="og:locale"]');
  if (ogLocale) ogLocale.setAttribute("content", t.ogLocale);
  const ogDesc = document.querySelector('meta[property="og:description"]');
  const twDesc = document.querySelector('meta[name="twitter:description"]');
  if (ogDesc) ogDesc.setAttribute("content", t.metaDesc);
  if (twDesc) twDesc.setAttribute("content", t.metaDesc);
  const chip = document.querySelector(".head-chip");
  if (chip) chip.textContent = t.chip;
  grid.setAttribute("aria-label", t.gridAria);
  const noscript = document.querySelector("noscript");
  if (noscript) noscript.textContent = "<p class=\"noscript-msg\">" + t.noscript + "</p>";
  // 语言切换按钮：显示"目标语言"。
  const langButton = document.querySelector("#lang-button");
  if (langButton) {
    langButton.textContent = t.langShort;
    langButton.setAttribute("aria-label", t.langAria);
    langButton.title = t.langLabel;
  }
}

const langButton = document.querySelector("#lang-button");
langButton?.addEventListener("click", () => {
  saveLocale(locale === "zh" ? "en" : "zh");
  location.reload();
});

function cardFor(game) {
  const card = document.createElement(game.comingSoon ? "article" : "a");
  card.className = "game-card" + (game.comingSoon ? " is-soon" : "");
  if (!game.comingSoon) card.href = game.url;

  const cover = document.createElement("img");
  cover.className = "game-card__cover";
  cover.src = game.cover;
  cover.alt = gameTitle(game, locale) + " " + t.coverAlt;
  cover.loading = "lazy";
  cover.decoding = "async";
  cover.width = 640;
  cover.height = 640;

  const title = document.createElement("span");
  title.className = "game-card__title";
  title.textContent = gameTitle(game, locale);

  card.append(cover, title);

  if (game.comingSoon) {
    const badge = document.createElement("span");
    badge.className = "badge-soon";
    badge.textContent = t.comingSoon;
    card.append(badge);
  }

  return card;
}

function addStructuredData(games) {
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t.structuredName,
    url: "https://doin.win/",
    itemListElement: games.filter(function (game) {
      return !game.comingSoon;
    }).map(function (game, index) {
      return {
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "VideoGame",
          name: gameTitle(game, locale),
          description: game.desc,
          image: new URL(game.cover, window.location.href).href,
          url: new URL(game.url, window.location.href).href,
          gamePlatform: "Web Browser"
        }
      };
    })
  });
  document.head.append(script);
}

async function init() {
  try {
    const response = await fetch("games.json");
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    if (!Array.isArray(data.games) || data.games.length === 0) throw new Error("empty games list");
    grid.append(...data.games.map(cardFor));
    addStructuredData(data.games);
  } catch (error) {
    console.error("Unable to load games.json", error);
    grid.innerHTML = '<p class="load-err">' + t.loadError + "</p>";
  }
}

applyStaticTexts();
init();
