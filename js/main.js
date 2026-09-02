const grid = document.querySelector("#game-grid");

document.querySelector("#year").textContent = String(new Date().getFullYear());

function cardFor(game) {
  const card = document.createElement(game.comingSoon ? "article" : "a");
  card.className = "game-card" + (game.comingSoon ? " is-soon" : "");
  if (!game.comingSoon) card.href = game.url;

  const cover = document.createElement("img");
  cover.className = "game-card__cover";
  cover.src = game.cover;
  cover.alt = game.title + " 封面";
  cover.loading = "lazy";
  cover.decoding = "async";
  cover.width = 640;
  cover.height = 640;

  const title = document.createElement("span");
  title.className = "game-card__title";
  title.textContent = game.title;

  card.append(cover, title);

  if (game.comingSoon) {
    const badge = document.createElement("span");
    badge.className = "badge-soon";
    badge.textContent = "敬请期待";
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
    grid.innerHTML = '<p class="load-err">无法加载游戏列表 · 请通过本地服务器访问</p>';
  }
}

init();
