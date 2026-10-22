// i18n.mjs — 全站共享语言偏好与双语严格对齐
export const LANG_KEY = "doin.lang";

export function isLocale(lang) {
  return lang === "zh" || lang === "en";
}

export function htmlLang(lang) {
  return lang === "zh" ? "zh-CN" : "en";
}

export function getStoredLang() {
  try {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(LANG_KEY);
      if (isLocale(stored)) return stored;
    }
  } catch {
    // 静默降级
  }
  return "zh";
}

export function setStoredLang(lang) {
  if (!isLocale(lang)) return;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LANG_KEY, lang);
    }
  } catch {
    // 静默降级
  }
}

export function format(template, params = {}) {
  if (!template || typeof template !== "string") return "";
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return params[key] !== undefined ? String(params[key]) : `{${key}}`;
  });
}

const zh = {
  // === 全局 ===
  docTitle: "DOIN · 迷你猫咖掌柜",
  gameTitle: "迷你猫咖掌柜",
  metaDesc: "迷你猫咖掌柜：治愈系午后猫咖放置经营。操控喵掌柜冲咖啡擦桌子，解锁喵咪伙伴与屋顶花园。",
  backHome: "返回大厅",
  langSwitch: "English",
  soundOn: "音效开启",
  soundOff: "静音",
  rulesBtn: "经营指南",
  closeBtn: "关闭",
  noscript: "请开启 JavaScript 以体验迷你猫咖掌柜。",
  appSubtitle: "午后治愈经营",

  // === 货币 / 单位 ===
  coin: "金币",
  coinSuffix: " 金币",
  star: "星标",
  starSuffix: " 颗星",
  perSec: "/秒",
  level: "Lv.{lvl}",
  cost: "费用：{cost} 金币",
  owned: "已持有",
  locked: "未解锁",
  unlocked: "已解锁",
  reqStage: "需要声誉：{stage}",
  reqStars: "需要星标：{stars} 颗",
  reqBowls: "需要累计出杯：{bowls} 杯",
  reqCoins: "需要金币：{coins}",

  // === 工位 ===
  station_roast: "烘焙机",
  stationDesc_roast: "咖啡豆烘焙机，红铜大炮造型，咖啡香弥漫整个吧台。",
  station_grind: "研磨机",
  stationDesc_grind: "老式手摇研磨机，豆子研磨成粉的声音治愈每一位顾客。",
  station_extract: "萃取机",
  stationDesc_extract: "带木把手的萃取机，9 巴黄金压力萃出浓郁浓缩。",
  station_latte: "拉花杯",
  stationDesc_latte: "陶釉拉花杯，奶泡在杯中画出玫瑰与爱心。",
  station_serve: "出杯窗",
  stationDesc_serve: "木质出杯窗，每一杯咖啡亲手递到客人手中。",
  upgradeStation: "升级工位",
  hireCat: "领养喵掌柜",
  upgradeCat: "培训喵掌柜",
  awakenCat: "摇小铃铛（+30 tick）",

  // === 喵掌柜 ===
  cat_orange: "橘猫阿橘",
  catDesc_orange: "稳重踏实，最爱烘焙机，出勤率 100%。",
  cat_calico: "三花小咪",
  catDesc_calico: "灵活敏捷，最爱研磨机，会追花瓣玩一下午。",
  cat_british: "英短豆豆",
  catDesc_british: "专注细致，最爱萃取机，毛绒绒手感超治愈。",
  cat_ragdoll: "布偶云朵",
  catDesc_ragdoll: "蓬松温柔，最爱拉花杯，蓬松度 +1。",
  catStation_roast: "☕ 烘焙机",
  catStation_grind: "☕ 研磨机",
  catStation_extract: "☕ 萃取机",
  catStation_latte: "☕ 拉花杯",

  // === 窗口扩张 ===
  window_takeout: "外带窗",
  windowDesc_takeout: "客人可点外带咖啡，街角行走间多了一条收入线。",
  window_terrace: "露台卡座",
  windowDesc_terrace: "午后阳光洒在藤编椅背上，咖啡香飘向街角。",
  window_garden: "屋顶花园",
  windowDesc_garden: "屋顶种满薄荷与柠檬草，喵咪们在花丛间打盹。",
  unlockWindow: "展开新窗口",
  reqStage_window: "需要声誉：{stage}",

  // === 咖啡饮品 ===
  drink_espresso: "浓缩",
  drinkDesc_espresso: "30ml 浓郁金液，一口回神。",
  drink_americano: "美式",
  drinkDesc_americano: "浓缩兑热水，黑咖啡党的日常。",
  drink_latte: "拿铁",
  drinkDesc_latte: "浓缩 + 蒸奶 + 薄薄奶泡，温柔入门款。",
  drink_cappuccino: "卡布奇诺",
  drinkDesc_cappuccino: "浓缩 + 厚奶泡 + 可可粉，意式经典。",
  drink_mocha: "摩卡",
  drinkDesc_mocha: "浓缩 + 巧克力酱 + 蒸奶，甜党的最爱。",
  drink_macchiato: "玛奇朵",
  drinkDesc_macchiato: "浓缩 + 一勺奶泡，焦糖淋顶。",
  drink_matcha: "抹茶拿铁",
  drinkDesc_matcha: "抹茶粉 + 蒸奶，颜色治愈味道清淡。",
  drink_sunset: "夕阳特调",
  drinkDesc_sunset: "店主隐藏配方，金红渐变，退休老猫的最爱。",
  researchDrink: "研制新咖啡",
  onMenu: "已在菜单",
  activeDrink: "当前出品：{drink}",
  switchDrink: "切换饮品",

  // === 声誉阶段 ===
  reputation_local: "街边小店",
  reputationDesc_local: "巷口的暖黄招牌，街坊路过会点一杯。",
  reputation_popular: "人气咖啡",
  reputationDesc_popular: "下午茶时段坐满人，常客们带着电脑来赶稿。",
  reputation_instafam: "网红打卡",
  reputationDesc_instafam: "博主们纷纷拍照，小红书上有了你家的标签。",
  reputation_city: "城市名店",
  reputationDesc_city: "跨区客专程来打卡，城市指南推荐上榜。",
  reputation_5star: "五星名店",
  reputationDesc_5star: "美食杂志封面，喵掌柜被授予金爪徽章。",
  upgradeStage: "升级声誉",

  // === 常客图鉴 ===
  guest_officecat: "加班程序员猫",
  guestStory_officecat: "深夜仍在敲代码，需要 3 杯浓缩续命，但嘴上不承认。",
  guest_writercat: "失眠作家猫",
  guestStory_writercat: "凌晨两点带着新章节来，燕麦拿铁 + 安静的角落。",
  guest_retiredcat: "退休老猫",
  guestStory_retiredcat: "带着相册来，翻一页点一杯夕阳特调，回忆整条街。",
  guest_yogacat: "瑜伽老师猫",
  guestStory_yogacat: "做完拉伸来，抹茶拿铁配轻音乐，柔韧性 +1。",
  guest_bloggercat: "网红博主猫",
  guestStory_bloggercat: "拍了 30 张拉花图发小红书，点赞过万。",
  guest_studentcat: "大学生猫",
  guestStory_studentcat: "带着论文来赶稿，美式加了 3 杯。",
  guest_couplecat: "情侣猫",
  guestStory_couplecat: "点了双人摩卡套餐，喂对方吃蛋糕。",
  guest_raincat: "雨天路人猫",
  guestStory_raincat: "没带伞，热玛奇朵暖手，听一段雨声。",
  guest_kidcat: "小学生猫",
  guestStory_kidcat: "儿童卡布，用吸管吹奶泡玩。",
  guest_doctorncat: "实习医生猫",
  guestStory_doctorncat: "下了夜班，脱因浓缩续命，笑说下次一定换班。",
  guest_pianocat: "钢琴家猫",
  guestStory_pianocat: "焦糖玛奇朵配乐谱，指尖沾奶泡在纸上画音符。",
  guest_straycat: "流浪汉猫",
  guestStory_straycat: "蹲在门口，免费美式很暖，下雨天喵了一声道谢。",
  tipBonus: "小费加成：+{bonus}%",
  favDrink: "偏爱：{drink}",
  guestLocked: "累计出杯更多后结识",
  feedDrink: "喂一杯咖啡",
  serveGuest: "已喂：{name}",

  // === 离线想念桶 ===
  offlineTitle: "猫咪想念桶",
  offlineGreeting: "店里暖黄灯光还亮着……",
  offlineMessage: "喵掌柜们帮你收了这段时间的客人小费：",
  offlineEarned: "想念桶收入：+{amount} 金币",
  offlineEfficiency: "想念效率：{eff}%",
  offlineMilestones: "想念倍率：×{mult}",
  claimBtn: "收下想念并开张",
  catMessageTitle: "{cat} 留言",
  bucketAmount: "+{amount} 金币",

  // === 玩法指南 ===
  guideContent: "【迷你猫咖掌柜 经营指南】\n1. 移动喵掌柜到工位旁即可自动执行任务（WASD / 方向键 / 触屏点击地面）。\n2. 升级五环工位（烘焙→研磨→萃取→拉花→出杯）线性提升产出。\n3. 攒星标领养新喵掌柜（橘/三花/英短/布偶），每只猫自动上岗一个工位。\n4. 喵掌柜偶尔会打盹（产速降 50% 但永不断产），摇小铃铛可唤醒 30 tick。\n5. 研制 8 款咖啡（浓缩→夕阳特调）解锁更高杯数门槛与收益倍率。\n6. 喂常客对口味的咖啡解锁 12 位图鉴，每位 +1~10% 永久小费。\n7. 展开外带窗/露台卡座/屋顶花园三个窗口，营收倍率叠加。\n8. 离线挂机按 4/4/4/218 里程碑倍率结算，回归时点亮想念桶收下。",
  toastUpgrade: "工位升级成功！",
  toastCat: "喵掌柜加入啦：{name}！",
  toastRecipe: "研制出新咖啡：{name}！",
  toastGuest: "迎来了新常客：{name}！",
  toastWindow: "新窗口展开：{name}！",
  toastStage: "声誉提升为：{name}！",
  toastOffline: "想念桶已收下，开张啦！",

  // === HUD ===
  labelCoins: "金币",
  labelStars: "星标",
  labelRps: "秒收益",
  labelStage: "声誉",
  labelBowls: "累计出杯",
  labelActiveCat: "出战喵：{name}",
  switchCat: "切换喵掌柜",
};

const en = {
  docTitle: "DOIN · Mini Cat Cafe",
  gameTitle: "Mini Cat Cafe",
  metaDesc: "Mini Cat Cafe: Cozy afternoon cat cafe idle tycoon. Guide your cat baristas, brew coffee and unlock rooftop gardens.",
  backHome: "Back Home",
  langSwitch: "中文",
  soundOn: "Sound On",
  soundOff: "Muted",
  rulesBtn: "Guide",
  closeBtn: "Close",
  noscript: "Please enable JavaScript to play Mini Cat Cafe.",
  appSubtitle: "Afternoon Cafe Tycoon",

  coin: "Coins",
  coinSuffix: " coins",
  star: "Stars",
  starSuffix: " stars",
  perSec: "/s",
  level: "Lv.{lvl}",
  cost: "Cost: {cost} coins",
  owned: "Owned",
  locked: "Locked",
  unlocked: "Unlocked",
  reqStage: "Requires Rep: {stage}",
  reqStars: "Requires Stars: {stars}",
  reqBowls: "Requires Total Brewed: {bowls} cups",
  reqCoins: "Requires Coins: {coins}",

  station_roast: "Roaster",
  stationDesc_roast: "Copper roaster drum fills the cafe with warm coffee aroma.",
  station_grind: "Grinder",
  stationDesc_grind: "Old-fashioned hand grinder soothes every patron with its rhythm.",
  station_extract: "Espresso Machine",
  stationDesc_extract: "Wooden-handled lever machine pulls 9-bar golden crema shots.",
  station_latte: "Latte Cup",
  stationDesc_latte: "Ceramic cups where milk art blooms into roses and hearts.",
  station_serve: "Service Window",
  stationDesc_serve: "Wooden serving counter where every cup is hand-delivered.",
  upgradeStation: "Upgrade Station",
  hireCat: "Adopt Cat",
  upgradeCat: "Train Cat",
  awakenCat: "Ring Bell (+30 ticks)",

  cat_orange: "Orange the Tabby",
  catDesc_orange: "Steady and reliable, loves the roaster, 100% attendance.",
  cat_calico: "Calico Mimi",
  catDesc_calico: "Agile and curious, loves the grinder, chases petals for hours.",
  cat_british: "British Mochi",
  catDesc_british: "Focused and fluffy, loves the espresso machine, irresistibly soft.",
  cat_ragdoll: "Ragdoll Cloud",
  catDesc_ragdoll: "Fluffy and gentle, loves latte art, fluffiness +1.",
  catStation_roast: "☕ Roaster",
  catStation_grind: "☕ Grinder",
  catStation_extract: "☕ Espresso",
  catStation_latte: "☕ Latte",

  window_takeout: "Takeout Window",
  windowDesc_takeout: "Patrons grab coffee to go, adding a new revenue stream.",
  window_terrace: "Terrace Seats",
  windowDesc_terrace: "Afternoon sun falls on rattan chairs, coffee aroma drifts to the corner.",
  window_garden: "Rooftop Garden",
  windowDesc_garden: "Mint and lemongrass carpet the rooftop; cats nap among the blooms.",
  unlockWindow: "Open Window",
  reqStage_window: "Requires Rep: {stage}",

  drink_espresso: "Espresso",
  drinkDesc_espresso: "30ml of golden intensity, one sip and you're back.",
  drink_americano: "Americano",
  drinkDesc_americano: "Espresso diluted with hot water, the black-coffee daily driver.",
  drink_latte: "Latte",
  drinkDesc_latte: "Espresso + steamed milk + thin foam, the gentle gateway.",
  drink_cappuccino: "Cappuccino",
  drinkDesc_cappuccino: "Espresso + thick foam + cocoa, the Italian classic.",
  drink_mocha: "Mocha",
  drinkDesc_mocha: "Espresso + chocolate + steamed milk, sweet-tooth favorite.",
  drink_macchiato: "Macchiato",
  drinkDesc_macchiato: "Espresso + a dollop of foam, caramel drizzle on top.",
  drink_matcha: "Matcha Latte",
  drinkDesc_matcha: "Matcha powder + steamed milk, soothing hue and clean taste.",
  drink_sunset: "Sunset Brew",
  drinkDesc_sunset: "Hidden house recipe with golden-red gradient, retired cat's favorite.",
  researchDrink: "Research Coffee",
  onMenu: "On Menu",
  activeDrink: "Serving: {drink}",
  switchDrink: "Switch Drink",

  reputation_local: "Local Shop",
  reputationDesc_local: "A warm signboard at the alley, neighbors drop in for a cup.",
  reputation_popular: "Popular Cafe",
  reputationDesc_popular: "Afternoon tea fills every seat, regulars bring their laptops.",
  reputation_instafam: "Insta-Famous",
  reputationDesc_instafam: "Bloggers snap photos, your hashtag trends on social feeds.",
  reputation_city: "City Landmark",
  reputationDesc_city: "Patrons cross districts to visit, featured in city guides.",
  reputation_5star: "Five-Star Spot",
  reputationDesc_5star: "Magazine cover story, the cat barista earns a golden paw badge.",
  upgradeStage: "Upgrade Reputation",

  guest_officecat: "Office Worker Cat",
  guestStory_officecat: "Still coding at midnight, three espressos to stay alive (won't admit it).",
  guest_writercat: "Insomniac Writer Cat",
  guestStory_writercat: "Comes at 2am with new chapters, oat latte + quiet corner.",
  guest_retiredcat: "Retired Elder Cat",
  guestStory_retiredcat: "Brings a photo album, sips Sunset Brew while recalling the whole street.",
  guest_yogacat: "Yoga Teacher Cat",
  guestStory_yogacat: "Arrives after stretching, matcha latte + soft music, flexibility +1.",
  guest_bloggercat: "Influencer Cat",
  guestStory_bloggercat: "Snaps 30 latte art photos for social, gets 10k likes.",
  guest_studentcat: "College Cat",
  guestStory_studentcat: "Comes with thesis draft, downs three americanos.",
  guest_couplecat: "Couple Cats",
  guestStory_couplecat: "Order the mocha-for-two set, feed each other cake.",
  guest_raincat: "Rainy Stranger Cat",
  guestStory_raincat: "No umbrella, hot macchiato warms hands while rain plays.",
  guest_kidcat: "Kid Cat",
  guestStory_kidcat: "Kids cappuccino, blows bubbles through the foam straw.",
  guest_doctorncat: "Intern Doctor Cat",
  guestStory_doctorncat: "Off night shift, decaf espresso revival, promises to swap shifts.",
  guest_pianocat: "Pianist Cat",
  guestStory_pianocat: "Caramel macchiato + sheet music, dips foam fingers to draw notes.",
  guest_straycat: "Stray Cat",
  guestStory_straycat: "Hovers at the door, free americano warms the rainy day, meows thanks.",
  tipBonus: "Tip Bonus: +{bonus}%",
  favDrink: "Favorite: {drink}",
  guestLocked: "Meet after serving more cups",
  feedDrink: "Brew a Cup",
  serveGuest: "Served: {name}",

  offlineTitle: "Cat Longing Buckets",
  offlineGreeting: "The warm lights in the cafe are still glowing...",
  offlineMessage: "Your cat baristas collected these tips while you were away:",
  offlineEarned: "Bucket Earnings: +{amount} coins",
  offlineEfficiency: "Longing Efficiency: {eff}%",
  offlineMilestones: "Longing Boost: ×{mult}",
  claimBtn: "Collect & Open Shop",
  catMessageTitle: "{cat} says",
  bucketAmount: "+{amount} coins",

  guideContent: "[Mini Cat Cafe Guide]\n1. Move your cat barista to a station to auto-execute tasks (WASD / arrows / tap ground).\n2. Upgrade the 5 stations (Roast → Grind → Extract → Latte → Serve) for linear gains.\n4. Earn stars to adopt new cat baristas (Tabby / Calico / British / Ragdoll).\n5. Cats occasionally nap (50% slower but never idle), ring the bell to wake for 30 ticks.\n6. Research 8 coffee recipes (Espresso → Sunset Brew) for higher thresholds and multipliers.\n7. Brew each cat's favorite drink to meet 12 guests, each giving +1-10% permanent tips.\n8. Open Takeout Window / Terrace / Rooftop Garden for stacked revenue multipliers.\n9. Offline earnings settle at ×4/4/4/218 milestone boosts, collected via Longing Buckets on return.",

  toastUpgrade: "Station upgraded!",
  toastCat: "New cat joined: {name}!",
  toastRecipe: "New recipe unlocked: {name}!",
  toastGuest: "New regular guest: {name}!",
  toastWindow: "Window opened: {name}!",
  toastStage: "Reputation raised to: {name}!",
  toastOffline: "Buckets collected, cafe is open!",

  labelCoins: "Coins",
  labelStars: "Stars",
  labelRps: "Per Sec",
  labelStage: "Reputation",
  labelBowls: "Total Brewed",
  labelActiveCat: "Active Cat: {name}",
  switchCat: "Switch Cat",
};

export function strings(lang) {
  return lang === "en" ? en : zh;
}

// =========================================================================
// 想念桶猫咪留言（确定性，按 catId + visit 索引；数据放在 i18n 不放 engine 是为
// 了"源码零未封装中文"硬约束——文案统一在 i18n 里双语对齐）
// =========================================================================

const CAT_MESSAGES = {
  cat_orange: [
    "今天帮 8 位客人送了咖啡～",
    "擦桌子的时候抓到一只蝴蝶，又飞走了～",
    "客人的拿铁杯里奶泡打得很漂亮，橘橘看了很开心～",
    "在吧台睡了一会儿，做了个关于鱼罐头的梦～",
    "帮咖啡师递了 12 次拉花杯，今天的小费罐满啦～",
  ],
  cat_calico: [
    "三花今天帮 5 位客人补了水～",
    "雨天花瓣飘进来，三花追了一下午～",
    "给流浪汉猫多倒了一杯免费美式，它喵了一声道谢～",
    "客人的小孩摸了摸三花的尾巴，三花没有炸毛～",
    "今天研磨机声音像猫打呼噜，三花觉得很治愈～",
  ],
  cat_british: [
    "英短豆豆今天帮 7 位客人端了摩卡～",
    "下雨天豆豆在窗边打盹，客人看着都说好治愈～",
    "帮咖啡师递了 10 次拉花杯，每一杯都很稳～",
    "今天给加班程序员续了 3 杯浓缩，豆豆有点心疼～",
    "店里来了一只新流浪猫，豆豆闻了闻它的鼻子～",
  ],
  cat_ragdoll: [
    "云朵今天被 4 位客人摸了头，蓬松度 +1～",
    "帮咖啡师递了 8 次拉花杯，云朵的尾巴很稳～",
    "客人的小孩把云朵当抱枕，云朵没有挣扎～",
    "今天来了一位钢琴家猫，云朵在钢琴上听了一下午～",
    "夕阳时分，云朵坐在窗边看天，喝了一杯夕阳特调～",
  ],
};

const CAT_MESSAGES_EN = {
  cat_orange: [
    "Helped deliver 8 coffees today~",
    "Caught a butterfly while wiping tables, it flew away~",
    "Saw beautiful latte art today, made Orange purr with joy~",
    "Took a nap at the counter, dreamed of tuna cans~",
    "Passed 12 latte cups to the barista, today's tip jar is full~",
  ],
  cat_calico: [
    "Calico helped 5 customers refill water today~",
    "Petal blew in on a rainy day, Calico chased it all afternoon~",
    "Poured an extra free americano for Stray Cat, who meowed thanks~",
    "A kid tugged Calico's tail, she didn't bristle~",
    "The grinder sounds like a cat purr today, Calico felt soothed~",
  ],
  cat_british: [
    "British Mochi delivered 7 mochas today~",
    "Slept by the window on a rainy day, patrons said it was healing~",
    "Passed 10 latte cups, every one perfectly steady~",
    "Refilled 3 espressos for the overtime coder, Mochi worries~",
    "A new stray cat visited the shop, Mochi sniffed its nose~",
  ],
  cat_ragdoll: [
    "Cloud got headpats from 4 customers today, fluffiness +1~",
    "Passed 8 latte cups, Cloud's tail stayed steady~",
    "A kid used Cloud as a pillow, Cloud didn't struggle~",
    "A pianist cat came by, Cloud listened at the piano all afternoon~",
    "At sunset, Cloud sat by the window watching the sky with a Sunset Brew~",
  ],
};

/**
 * 取得指定猫咪在第 N 次离线回归时的想念留言（确定性）
 */
export function getCatMessage(catId, visitIndex, lang = getStoredLang()) {
  const dict = lang === "en" ? CAT_MESSAGES_EN : CAT_MESSAGES;
  const list = dict[catId];
  if (!Array.isArray(list) || list.length === 0) return "";
  const idx = ((visitIndex % list.length) + list.length) % list.length;
  return list[idx];
}

export function t(key, lang = getStoredLang(), params = {}) {
  const dict = strings(lang);
  const text = dict[key] ?? zh[key] ?? key;
  return format(text, params);
}