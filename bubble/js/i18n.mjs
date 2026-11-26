/**
 * 极简泡泡堂 · 水泡大作战 (Bubble Arena Lite)
 * 双语中心 (读写全站共享 doin.lang, 原地热更新, 英文表零汉字)
 */

export const strings = {
  zh: {
    // 基础标签
    gameTitle: "极简泡泡堂 · 水泡大作战",
    gameSubtitle: "网格放水泡困住对手再戳破淘汰",
    roundTime: "对局倒计时",
    currentMap: "当前地图",
    p1Label: "玩家 1 (蓝)",
    p2Label: "玩家 2 / 电脑 (红)",
    trappedStatus: "困在水泡中！",
    normalStatus: "正常行动",
    eliminatedStatus: "已淘汰",
    player_stats_format: "泡:{b} 浪:{s} 速:{spd}",
    pause: "暂停",
    resume: "继续",
    restart: "重新开战",
    switchMap: "选择地图",
    howToPlay: "作战指南",
    backHome: "返回主站",
    soundOn: "音效: 开",
    soundOff: "音效: 关",
    langName: "中文",
    langToggle: "EN",
    mode: "模式",
    modeSolo: "单人对战电脑",
    modePvp: "同屏双人对决",
    aiLevel: "电脑难度",
    aiNovice: "新手巡逻",
    aiSkilled: "熟手追击",
    aiMaster: "大师预判",

    // 地图
    map_pool: "夏日水上乐园",
    map_pool_desc: "经典泳池瓷砖台面，标准软砖分布，适合练习走位与困敌。",
    map_isles: "热带浮岛水寨",
    map_isles_desc: "密集芦苇浮木障碍，极易封死路口形成连环引爆。",
    map_ice: "极寒滑冰水池",
    map_ice_desc: "冰面摩擦力极低，走位滑行考验微操，踢泡极速滑出。",
    map_pirate: "海盗藏宝水湾",
    map_pirate_desc: "开阔对决主战场，宝箱密集道具丰富，节奏快节奏激烈。",
    map_locked: "未解锁",

    // 道具
    item_bubble: "水泡+1",
    item_splash: "水柱+1",
    item_boots: "疾行靴",
    item_kick: "踢泡护腕",
    item_needle: "救急飞针",
    item_shield: "水泡护盾",
    item_bubble_sym: "泡",
    item_splash_sym: "浪",
    item_boots_sym: "鞋",
    item_kick_sym: "踢",
    item_needle_sym: "针",
    item_shield_sym: "盾",

    // 结算面板
    result_p1_won: "蓝方获胜 · 完美破泡！",
    result_p2_won: "红方获胜 · 全盘压制！",
    result_draw: "平局 · 势均力敌！",
    result_time_spent: "对局耗时",
    result_bubbles_placed: "放置水泡",
    result_trapped_count: "困敌次数",
    btn_next_level: "下一地图",
    btn_retry: "再来一局",

    // 暂停面板
    paused_title: "已暂停",
    paused_desc: "水泡引线、水柱扩散与角色行动已全部冻结。",
    btn_continue: "继续对决",
    btn_restart_game: "重新开战",

    // 指南
    guide_title: "泡泡作战速成秘籍",
    guide_tip_1: "【两段式击杀】水柱只将角色困进透明水泡，必须冲过去戳破才算淘汰！",
    guide_tip_2: "【挣扎自救】被困时狂按方向键可缩短困泡时间，有飞针可直接扎破脱困。",
    guide_tip_3: "【踢泡博弈】获得踢泡护腕后，走向水泡可将其直线踢出滑向敌人或解围。",
    guide_tip_4: "【双人键位】玩家1: WASD移动 / 空格放泡 / J飞针；玩家2: 方向键 / 小键盘0放泡。",
    guide_close: "明白，出战！",
  },
  en: {
    // Basic labels
    gameTitle: "Bubble Arena Lite",
    gameSubtitle: "Trap opponents in water bubbles and pop them to victory",
    roundTime: "Time Left",
    currentMap: "Map",
    p1Label: "Player 1 (Blue)",
    p2Label: "Player 2 / AI (Red)",
    trappedStatus: "Trapped in Bubble!",
    normalStatus: "Active",
    eliminatedStatus: "Eliminated",
    player_stats_format: "B:{b} S:{s} Spd:{spd}",
    pause: "Pause",
    resume: "Resume",
    restart: "Restart",
    switchMap: "Select Map",
    howToPlay: "Guide",
    backHome: "Portal",
    soundOn: "Sound: On",
    soundOff: "Sound: Off",
    langName: "English",
    langToggle: "中文",
    mode: "Mode",
    modeSolo: "Solo vs AI",
    modePvp: "Local 2P Duel",
    aiLevel: "AI Level",
    aiNovice: "Novice Patrol",
    aiSkilled: "Skilled Chaser",
    aiMaster: "Master Predictor",

    // Maps
    map_pool: "Summer Water Park",
    map_pool_desc: "Classic pool tiles with balanced soft blocks. Ideal for practicing trapping.",
    map_isles: "Tropical Float Isles",
    map_isles_desc: "Dense reeds and floating logs. Easy to create devastating chain reactions.",
    map_ice: "Frosty Ice Pool",
    map_ice_desc: "Low-friction ice terrain makes movement slippery and bubble kicks lightning fast.",
    map_pirate: "Pirate Treasure Cove",
    map_pirate_desc: "Open battleground packed with treasure chests and high-power powerups.",
    map_locked: "Locked",

    // Items
    item_bubble: "Bubble +1",
    item_splash: "Splash +1",
    item_boots: "Speed Boots",
    item_kick: "Kick Wristband",
    item_needle: "Emergency Needle",
    item_shield: "Water Shield",
    item_bubble_sym: "B",
    item_splash_sym: "S",
    item_boots_sym: "W",
    item_kick_sym: "K",
    item_needle_sym: "N",
    item_shield_sym: "D",

    // Results
    result_p1_won: "Blue Victory - Flawless Pop!",
    result_p2_won: "Red Victory - Total Splashdown!",
    result_draw: "Draw - Even Match!",
    result_time_spent: "Match Time",
    result_bubbles_placed: "Bubbles Dropped",
    result_trapped_count: "Opponents Trapped",
    btn_next_level: "Next Map",
    btn_retry: "Rematch",

    // Paused
    paused_title: "Game Paused",
    paused_desc: "Bubble fuses, splash expansions, and character actions are frozen.",
    btn_continue: "Resume Battle",
    btn_restart_game: "Restart Match",

    // Guide
    guide_title: "Bubble Combat Briefing",
    guide_tip_1: "Two-Step Elimination: Splashes trap opponents in bubbles. Rush in to pop them for the KO!",
    guide_tip_2: "Struggle to Escape: Tap directional keys rapidly while trapped to break free faster.",
    guide_tip_3: "Bubble Kicking: Walk into a bubble with Kick gear to slide it straight at foes.",
    guide_tip_4: "Local 2P Controls: P1 uses WASD + Space; P2 uses Arrow Keys + NumPad 0.",
    guide_close: "Ready for Battle",
  },
};

let currentLocale = "zh";

export function getLocale() {
  try {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("doin.lang");
      if (saved === "en" || saved === "zh") {
        currentLocale = saved;
        return currentLocale;
      }
    }
  } catch (err) {
    // Degrade gracefully
  }
  return currentLocale;
}

export function setLocale(locale) {
  currentLocale = locale === "en" ? "en" : "zh";
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("doin.lang", currentLocale);
    }
  } catch (err) {
    // Degrade gracefully
  }
  updatePageTranslations();
  return currentLocale;
}

export function toggleLocale() {
  return setLocale(currentLocale === "zh" ? "en" : "zh");
}

export function translate(key, params = {}) {
  const dict = strings[currentLocale] || strings.zh;
  let text = dict[key] || strings.zh[key] || key;

  if (params && typeof params === "object") {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), v);
      text = text.replace(new RegExp(`\\$${k}`, "g"), v);
    }
  }
  return text;
}

export const t = translate;

export function updatePageTranslations() {
  if (typeof document === "undefined") return;

  const htmlEl = document.documentElement;
  if (htmlEl) {
    htmlEl.lang = currentLocale === "zh" ? "zh-CN" : "en";
  }

  const elements = document.querySelectorAll("[data-i18n]");
  elements.forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (key) {
      el.textContent = translate(key);
    }
  });

  const attrElements = document.querySelectorAll("[data-i18n-attr]");
  attrElements.forEach((el) => {
    const spec = el.getAttribute("data-i18n-attr");
    if (spec) {
      const pairs = spec.split(",");
      pairs.forEach((pair) => {
        const [attr, key] = pair.split(":").map((s) => s.trim());
        if (attr && key) {
          el.setAttribute(attr, translate(key));
        }
      });
    }
  });
}
