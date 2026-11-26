/**
 * 中华客栈 · 跑堂点菜 (Inn Master)
 * 双语中心 (读写全站共享 doin.lang, 原地热更新, 英文表零汉字)
 */

export const strings = {
  zh: {
    // 基础标签
    gameTitle: "中华客栈 · 跑堂点菜",
    gameSubtitle: "跑堂添茶传菜算盘结账忙客栈",
    shift: "当前场次",
    timeLeft: "营业剩余",
    silver: "客栈银两",
    combo: "连击",
    maxCombo: "最高连击",
    served: "接待客人",
    lostGuests: "离店客官",
    tray: "跑堂托盘",
    queue: "行动队列",
    pause: "暂停",
    resume: "继续",
    restart: "重新开张",
    switchShift: "切换场次",
    locked: "未解锁",
    upgrades: "营运升级",
    howToPlay: "客栈指南",
    backHome: "返回主站",
    soundOn: "音效: 开",
    soundOff: "音效: 关",
    langName: "中文",
    langToggle: "EN",

    // 场次名
    shift_lunch: "午市小场",
    shift_lunch_desc: "4 张方桌，单茶单菜，熟悉客栈跑堂动线。",
    shift_dinner: "晚市正餐",
    shift_dinner_desc: "6 张方桌，点菜组合增多，商贾与镖师登门。",
    shift_night: "夜宵摊",
    shift_night_desc: "6 张方桌，客官性急匆忙，考验极致动线排布。",
    shift_fair: "庙会日",
    shift_fair_desc: "8 张方桌，庙会客流大爆满，帮工小二入驻协力！",

    // 工位与设施
    station_tea: "茶台添茶",
    station_kitchen: "后厨取菜",
    station_counter: "柜台结账",
    station_tea_sign: "茶 台",
    station_kitchen_sign: "后 厨",
    station_counter_sign: "账房柜台",
    station_door_sign: "客栈大门",
    bubble_ordering: "点菜...",
    bubble_eating: "享用中",
    bubble_pay: "结账 ${n}",
    table_label: "第 {n} 号桌",
    table_clean: "空闲就绪",
    table_occupied: "客人就坐",
    table_dirty: "残局待收",

    // 菜品
    dish_tea: "西湖龙井",
    dish_noodles: "阳春面",
    dish_pork: "东坡红烧肉",
    dish_cake: "金桂花糕",

    // 客人类型
    guest_scholar: "江南书生",
    guest_merchant: "四海商贾",
    guest_escort: "威武镖师",
    guest_traveler: "云游侠客",

    // 动作与指令
    act_fetch_tea: "前往茶台倒茶",
    act_fetch_dish: "后厨取 {dish}",
    act_serve_table: "为第 {n} 桌上茶送菜",
    act_clean_table: "收拾第 {n} 桌残局",
    act_checkout_table: "柜台为第 {n} 桌结算",
    cancel_queue_hint: "点击队列取消该步骤",

    // 算盘结账界面
    abacus_title: "柜台算盘对账收银",
    abacus_tens: "十位",
    abacus_ones: "个位",
    abacus_bill_label: "应付银两",
    abacus_current_label: "当前所拨",
    abacus_submit: "拨珠确认",
    abacus_quick_pay: "快速结账",
    abacus_reset: "清盘重拨",
    abacus_error: "账目不符，请重新核对银两！",
    abacus_close: "暂缓结账",

    // 升级面板
    upgrade_title: "客栈营运升级",
    upgrade_tray: "双层红木托盘",
    upgrade_tray_desc: "跑堂托盘容量上限 +1（最多同时端 3 件菜品）。",
    upgrade_kettle: "紫砂快热茶壶",
    upgrade_kettle_desc: "茶台倒茶耗时减半（由 0.6 秒缩短至 0.3 秒）。",
    upgrade_helper: "招募勤快帮工",
    upgrade_helper_desc: "解锁帮工小二，全自动穿梭大堂清理空桌残局！",
    upgrade_cost: "花费 {cost} 银两",
    upgrade_owned: "已购置",
    upgrade_not_enough: "银两不足",

    // 关卡结算
    result_won_title: "今日打烊 · 大获全胜！",
    result_lost_title: "客栈打烊 · 略有遗憾",
    result_reputation_title: "口碑崩塌 · 停业整顿！",
    result_silver_earned: "今日营业额",
    result_guests_served: "服务满意客官",
    result_lost_count: "急躁离店客官",
    result_max_combo: "最高行云流水连击",
    result_stars: "客栈评级",
    next_shift: "下一场次",
    retry_shift: "重新开市",

    // 暂停面板
    paused_title: "已暂停",
    paused_desc: "客人耐心、跑堂行动与营业时间已全线冻结。",
    btn_continue: "继续跑堂",
    btn_restart_game: "重开本场",

    // 快捷键指南
    guide_title: "客栈跑堂速成指南",
    guide_tip_1: "【动线规划】点击茶台、后厨或桌子即可排队，小二将沿最优动线自动执行。",
    guide_tip_2: "【耐心回升】客人等待时送上一壶热茶，可直接回升 35% 耐心值并防拂袖离店！",
    guide_tip_3: "【连击小费】客人耐心高于 50% 时结账可得丰厚小费，连续服务触发连击倍率。",
    guide_tip_4: "【快捷操作】键盘 1~8 选中餐桌，Q/W/E 对应茶台/后厨/柜台，P 或 Esc 随时暂停。",
    guide_close: "知道咯，去跑堂",
  },
  en: {
    // Basic labels
    gameTitle: "Inn Master",
    gameSubtitle: "Serve tea, deliver dishes, and settle bills on the abacus",
    shift: "Current Shift",
    timeLeft: "Time Left",
    silver: "Silver",
    combo: "Combo",
    maxCombo: "Max Combo",
    served: "Served Guests",
    lostGuests: "Walkouts",
    tray: "Waiter Tray",
    queue: "Action Queue",
    pause: "Pause",
    resume: "Resume",
    restart: "Restart",
    switchShift: "Select Shift",
    locked: "Locked",
    upgrades: "Upgrades",
    howToPlay: "Guide",
    backHome: "Portal",
    soundOn: "Sound: On",
    soundOff: "Sound: Off",
    langName: "English",
    langToggle: "中文",

    // Shifts
    shift_lunch: "Lunch Rush",
    shift_lunch_desc: "4 tables, single dishes and tea. Master the basic routes.",
    shift_dinner: "Dinner Service",
    shift_dinner_desc: "6 tables, combo orders. Wealthy merchants and escorts arrive.",
    shift_night: "Night Snacks",
    shift_night_desc: "6 tables, impatient night travelers. Rapid multitasking test.",
    shift_fair: "Temple Fair",
    shift_fair_desc: "8 tables, massive festive crowd. Helper boy joins to assist!",

    // Stations & Tables
    station_tea: "Tea Station",
    station_kitchen: "Kitchen Pass",
    station_counter: "Cashier Counter",
    station_tea_sign: "Tea Bar",
    station_kitchen_sign: "Kitchen",
    station_counter_sign: "Cashier Desk",
    station_door_sign: "Entrance",
    bubble_ordering: "Ordering...",
    bubble_eating: "Dining",
    bubble_pay: "Pay ${n}",
    table_label: "Table {n}",
    table_clean: "Empty & Clean",
    table_occupied: "Guests Seated",
    table_dirty: "Needs Cleaning",

    // Dishes
    dish_tea: "Longjing Tea",
    dish_noodles: "Plain Noodles",
    dish_pork: "Dongpo Pork",
    dish_cake: "Osmanthus Cake",

    // Guest Types
    guest_scholar: "Gentle Scholar",
    guest_merchant: "Rich Merchant",
    guest_escort: "Brave Escort",
    guest_traveler: "Wandering Knight",

    // Actions & Queue
    act_fetch_tea: "Brew fresh tea at station",
    act_fetch_dish: "Fetch {dish} from kitchen",
    act_serve_table: "Serve dishes to Table {n}",
    act_clean_table: "Wipe and clean Table {n}",
    act_checkout_table: "Settle bill for Table {n}",
    cancel_queue_hint: "Click queue item to cancel",

    // Abacus Checkout
    abacus_title: "Abacus Bill Checkout",
    abacus_tens: "Tens",
    abacus_ones: "Ones",
    abacus_bill_label: "Bill Due",
    abacus_current_label: "Counted",
    abacus_submit: "Confirm Bill",
    abacus_quick_pay: "Quick Pay",
    abacus_reset: "Clear Abacus",
    abacus_error: "Amount mismatch! Please count the beads again.",
    abacus_close: "Pay Later",

    // Upgrades
    upgrade_title: "Inn Business Upgrades",
    upgrade_tray: "Double Rosewood Tray",
    upgrade_tray_desc: "Increases waiter tray capacity by +1 (holds up to 3 items).",
    upgrade_kettle: "Quick Heating Kettle",
    upgrade_kettle_desc: "Cuts tea brewing time in half (from 0.6s to 0.3s).",
    upgrade_helper: "Diligent Helper Boy",
    upgrade_helper_desc: "Recruits an assistant who automatically cleans dirty tables!",
    upgrade_cost: "Cost: {cost} Silver",
    upgrade_owned: "Purchased",
    upgrade_not_enough: "Not Enough Silver",

    // Results
    result_won_title: "Closing Time - Stellar Shift!",
    result_lost_title: "Closing Time - Missed Target",
    result_reputation_title: "Reputation Lost - Shut Down!",
    result_silver_earned: "Total Silver Earned",
    result_guests_served: "Happy Guests Served",
    result_lost_count: "Frustrated Walkouts",
    result_max_combo: "Maximum Fast Combo",
    result_stars: "Shift Rating",
    next_shift: "Next Shift",
    retry_shift: "Try Again",

    // Paused
    paused_title: "Game Paused",
    paused_desc: "Guest patience, waiter actions, and shift timer are frozen.",
    btn_continue: "Resume Work",
    btn_restart_game: "Restart Shift",

    // Guide
    guide_title: "Inn Master Quick Guide",
    guide_tip_1: "Route Planning: Click stations or tables to queue actions. The waiter navigates automatically.",
    guide_tip_2: "Tea Soothes: Serving tea to waiting guests restores +35% patience and prevents walkouts!",
    guide_tip_3: "Combos & Tips: Guests with over 50% patience give generous tips! Chain fast service for combos.",
    guide_tip_4: "Shortcuts: 1-8 selects tables, Q/W/E for stations, P or Esc pauses anytime.",
    guide_close: "Got It, Open the Inn",
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

  // Update elements with data-i18n
  const elements = document.querySelectorAll("[data-i18n]");
  elements.forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (key) {
      el.textContent = translate(key);
    }
  });

  // Update elements with data-i18n-attr (e.g. "aria-label:someKey,title:otherKey")
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
