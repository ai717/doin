import { gameTitle, htmlLang, loadLocale, saveLocale, strings } from "./i18n.mjs";

// locale 只在启动时读一次（切换语言 = saveLocale + 整页刷新）。
const locale = loadLocale();
const t = strings(locale);

const grid = document.querySelector("#game-grid");
const searchInput = document.querySelector("#search-input");
const searchClear = document.querySelector("#search-clear");
const categoryTabs = document.querySelector("#category-tabs");
const gamesCounter = document.querySelector("#games-counter");
const emptyState = document.querySelector("#empty-state");
const emptyTitle = document.querySelector("#empty-title");
const emptyHint = document.querySelector("#empty-hint");

document.querySelector("#year").textContent = String(new Date().getFullYear());

// 分类定义映射
const CATEGORIES = [
  { id: "all", label: t.filterAll, icon: "✨" },
  { id: "puzzle", label: t.filterPuzzle, icon: "🧩", match: (tags) => tags.some(tag => ["益智", "经典", "数字", "无猜", "连线", "一笔画", "策略", "视觉", "纸牌", "对战", "解谜"].includes(tag)) },
  { id: "casual", label: t.filterCasual, icon: "☕", match: (tags) => tags.some(tag => ["休闲", "治愈", "放置", "经营", "解压"].includes(tag)) },
  { id: "match", label: t.filterMatch, icon: "🎯", match: (tags) => tags.some(tag => ["消除", "排序", "匹配", "连线"].includes(tag)) },
  { id: "physics", label: t.filterPhysics, icon: "🪐", match: (tags) => tags.some(tag => ["物理", "合成", "重力", "时机"].includes(tag)) },
  { id: "arcade", label: t.filterArcade, icon: "⚡", match: (tags) => tags.some(tag => ["街机", "反应", "时机", "肉鸽", "音乐", "动作", "射击"].includes(tag)) },
];

// 精选大卡 (2x2)、宽卡 (2x1) 与角标定义
const FEATURED_SLUGS = ["mow", "watermelon-2048", "backpack", "gold-miner"];
const WIDE_SLUGS = ["pinball", "spider", "sokoban", "tetris-neo", "blind-auction", "lineride", "cut-the-rope"];
const NEW_SLUGS = ["mow", "pinball", "backpack", "blind-auction", "sokoban", "lineride", "guess", "frog", "mole"];
const HOT_SLUGS = ["watermelon-2048", "gold-miner", "spider", "tetris-neo", "2048", "zuma", "pinball", "mow"];

// 首页推荐排序优先级：最新力作与高热度经典交替置顶，错落排布品类色彩
const CURATED_ORDER = [
  "mow", "picross", "pinball", "calc24", "guess", "watermelon-2048",
  "spider", "frog", "mole", "backpack", "sokoban", "ramen-idle",
  "freecell", "lineride", "cloud-merge", "jump-jump", "gold-miner",
  "blind-auction", "zuma", "2048", "tetris-neo", "cut-the-rope",
  "gomoku", "orbit-sort", "Tile-Matching", "snake-orchard", "one-line",
  "klotski", "jigsaw", "link-up", "pair-link", "bubble-merge",
  "bubble-bloom", "water-sort", "piano-tiles", "candy-drop", "road-bash",
  "deep-devour", "lantern-maze", "number-klotski", "pong", "fire-ice",
  "rune-tower", "devil-run", "space-defender", "sudoku", "tic-tac-toe",
  "minesweeper", "winmine", "memory-duel", "Gravity-Echoes"
];

let allGames = [];
let activeCategory = "all";
let searchQuery = "";

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
  
  const siteTitle = document.querySelector(".site-title");
  if (siteTitle) siteTitle.setAttribute("aria-label", t.homeAria);

  if (searchInput) {
    searchInput.placeholder = t.searchPlaceholder;
    searchInput.setAttribute("aria-label", t.searchAria);
  }
  if (searchClear) {
    searchClear.setAttribute("aria-label", t.clearSearch);
  }
  if (emptyTitle) emptyTitle.textContent = t.emptyTitle;
  if (emptyHint) emptyHint.textContent = t.emptyHint;

  // 语言按钮：图标按钮，悬浮提示保留文案。
  const langButton = document.querySelector("#lang-button");
  if (langButton) {
    langButton.setAttribute("aria-label", t.langAria);
    langButton.title = t.langLabel;
  }
}

const langPicker = document.querySelector(".lang-picker");
const langButton = document.querySelector("#lang-button");
const langMenu = document.querySelector("#lang-menu");

function setLangMenuOpen(open) {
  if (!langMenu || !langButton) return;
  langMenu.hidden = !open;
  langButton.setAttribute("aria-expanded", String(open));
}

// 选项文案固定用各语言自称（中文 / EN），不随当前 locale 翻译。
langMenu?.querySelectorAll(".lang-option").forEach((option) => {
  const active = option.dataset.lang === locale;
  option.classList.toggle("is-active", active);
  option.setAttribute("aria-checked", String(active));
  option.addEventListener("click", () => {
    if (option.dataset.lang === locale) {
      setLangMenuOpen(false);
      return;
    }
    saveLocale(option.dataset.lang);
    location.reload();
  });
});

langButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  setLangMenuOpen(Boolean(langMenu?.hidden));
});

document.addEventListener("click", (event) => {
  if (!langMenu || langMenu.hidden) return;
  if (langPicker?.contains(event.target)) return;
  setLangMenuOpen(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setLangMenuOpen(false);
    if (searchQuery) {
      searchInput.value = "";
      handleSearchChange("");
    }
  }
});

function cardFor(game, isBentoAllowed) {
  const card = document.createElement(game.comingSoon ? "article" : "a");
  const isFeatured = isBentoAllowed && FEATURED_SLUGS.includes(game.slug);
  const isWide = isBentoAllowed && !isFeatured && WIDE_SLUGS.includes(game.slug);

  card.className = "game-card" + 
    (game.comingSoon ? " is-soon" : "") +
    (isFeatured ? " is-featured" : "") +
    (isWide ? " is-wide" : "");
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

  // 为大卡/宽卡增加视觉微标签（品类特色）
  if ((isFeatured || isWide) && game.tags && game.tags.length > 0) {
    const genreTag = document.createElement("span");
    genreTag.className = "game-card__genre";
    const tagZh = game.tags[0];
    const tagMap = {
      "益智": "Puzzle", "经典": "Classic", "休闲": "Casual",
      "消除": "Match", "物理": "Physics", "街机": "Arcade",
      "合成": "Merge", "纸牌": "Cards", "策略": "Strategy",
      "解压": "Relaxing", "对战": "Battle", "肉鸽": "Roguelite",
      "放置": "Idle", "经营": "Sim"
    };
    genreTag.textContent = locale === "en" ? (tagMap[tagZh] || tagZh) : tagZh;
    card.append(genreTag);
  }

  // 质感角标（即将到来 > 最新力作 > 热门推荐 > 精选）
  if (game.comingSoon) {
    const badge = document.createElement("span");
    badge.className = "badge-tag badge-soon";
    badge.textContent = t.comingSoon;
    card.append(badge);
  } else if (NEW_SLUGS.includes(game.slug)) {
    const badge = document.createElement("span");
    badge.className = "badge-tag badge-new";
    badge.textContent = t.badgeNew;
    card.append(badge);
  } else if (HOT_SLUGS.includes(game.slug)) {
    const badge = document.createElement("span");
    badge.className = "badge-tag badge-hot";
    badge.textContent = t.badgeHot;
    card.append(badge);
  } else if (isFeatured) {
    const badge = document.createElement("span");
    badge.className = "badge-tag badge-featured";
    badge.textContent = t.badgeFeatured;
    card.append(badge);
  }

  return card;
}

function renderGames() {
  grid.innerHTML = "";
  const query = searchQuery.trim().toLowerCase();
  
  const filtered = allGames.filter((game) => {
    // 1. 分类筛选
    if (activeCategory !== "all") {
      const cat = CATEGORIES.find(c => c.id === activeCategory);
      if (cat && cat.match && !cat.match(game.tags || [])) {
        return false;
      }
    }
    // 2. 搜索词匹配（匹配中文标题、英文标题、slug、描述与标签）
    if (query) {
      const zhTitle = (game.title || "").toLowerCase();
      const enTitle = (game.en?.title || "").toLowerCase();
      const slug = (game.slug || "").toLowerCase();
      const desc = (game.desc || "").toLowerCase();
      const tags = (game.tags || []).join(" ").toLowerCase();
      const hit = zhTitle.includes(query) || enTitle.includes(query) || slug.includes(query) || desc.includes(query) || tags.includes(query);
      if (!hit) return false;
    }
    return true;
  });

  // 更新计数
  if (gamesCounter) {
    gamesCounter.textContent = `${filtered.length} ${t.gameCount}`;
  }

  // 空状态切换
  if (filtered.length === 0) {
    if (emptyState) emptyState.hidden = false;
  } else {
    if (emptyState) emptyState.hidden = true;
    // 仅当在“全部”分类且无搜索关键词时，启用 Bento 大卡突出精选游戏
    const allowBento = activeCategory === "all" && !query;
    grid.append(...filtered.map(game => cardFor(game, allowBento)));
  }
}

function renderCategoryTabs() {
  if (!categoryTabs) return;
  categoryTabs.innerHTML = "";
  CATEGORIES.forEach(cat => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab-btn" + (cat.id === activeCategory ? " is-active" : "");
    btn.innerHTML = `<span>${cat.icon}</span><span>${cat.label}</span>`;
    btn.setAttribute("aria-pressed", String(cat.id === activeCategory));
    btn.addEventListener("click", () => {
      if (activeCategory === cat.id) return;
      activeCategory = cat.id;
      categoryTabs.querySelectorAll(".tab-btn").forEach(b => {
        b.classList.remove("is-active");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("is-active");
      btn.setAttribute("aria-pressed", "true");
      renderGames();
    });
    categoryTabs.append(btn);
  });
}

function handleSearchChange(value) {
  searchQuery = value;
  if (searchClear) {
    searchClear.hidden = !value;
  }
  renderGames();
}

if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    handleSearchChange(e.target.value);
  });
}

if (searchClear) {
  searchClear.addEventListener("click", () => {
    if (searchInput) {
      searchInput.value = "";
      searchInput.focus();
    }
    handleSearchChange("");
  });
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
          description: (locale === "en" && game.en?.desc) ? game.en.desc : (game.desc || ""),
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
    // 按推荐权重 CURATED_ORDER 智能排序，最新力作与高热度经典置顶交错排布
    const orderMap = new Map(CURATED_ORDER.map((slug, idx) => [slug, idx]));
    allGames = [...data.games].sort((a, b) => {
      const posA = orderMap.has(a.slug) ? orderMap.get(a.slug) : 999;
      const posB = orderMap.has(b.slug) ? orderMap.get(b.slug) : 999;
      return posA - posB;
    });
    renderCategoryTabs();
    renderGames();
    addStructuredData(allGames);
  } catch (error) {
    console.error("Unable to load games.json", error);
    grid.innerHTML = '<p class="load-err">' + t.loadError + "</p>";
  }
}

applyStaticTexts();
init();

