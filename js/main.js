const ACCENTS = ["#4de8e0", "#ff5db1", "#ffc94d", "#9d7bff"];
const grid = document.querySelector("#game-grid");

document.querySelector("#year").textContent = String(new Date().getFullYear());

function cardFor(game, index) {
  const card = document.createElement(game.comingSoon ? "article" : "a");
  card.className = "game-card" + (game.comingSoon ? " is-soon" : "");
  card.style.setProperty("--card-accent", ACCENTS[index % ACCENTS.length]);
  if (!game.comingSoon) card.href = game.url;

  const cover = document.createElement("div");
  cover.className = "card-cover";
  if (game.cover) {
    const image = document.createElement("img");
    image.src = game.cover;
    image.alt = game.title + " 封面";
    image.loading = "lazy";
    cover.append(image);
  } else {
    const icon = document.createElement("span");
    icon.className = "card-icon";
    icon.textContent = game.icon || "🎮";
    icon.setAttribute("aria-hidden", "true");
    cover.append(icon);
  }
  if (game.comingSoon) {
    const badge = document.createElement("span");
    badge.className = "badge-soon";
    badge.textContent = "COMING SOON";
    cover.append(badge);
  }

  const body = document.createElement("div");
  body.className = "card-body";
  const title = document.createElement("h2");
  title.className = "card-title";
  title.textContent = game.title;
  const description = document.createElement("p");
  description.className = "card-desc";
  description.textContent = game.desc;
  const tags = document.createElement("div");
  tags.className = "card-tags";
  for (const value of game.tags || []) {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = value;
    tags.append(tag);
  }
  body.append(title, description, tags);
  card.append(cover, body);
  return card;
}

function addStructuredData(games) {
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "DOIN 小游戏合集",
    url: "https://doin.win/",
    itemListElement: games.filter(function (game) {
      return !game.comingSoon;
    }).map(function (game, index) {
      return {
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "VideoGame",
          name: game.title,
          description: game.desc,
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
    grid.innerHTML = '<p class="load-err">无法加载游戏列表 · 请通过本地服务器访问</p>';
  }
}

init();
