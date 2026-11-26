/**
 * 中华客栈 · 跑堂点菜 (Inn Master)
 * 核心规则引擎 (DOM-Free, 100% 确定性, 严格可测试)
 */

export function mulberry32(seed) {
  let s = Math.floor(seed) >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DISHES = {
  dish_tea: { id: "dish_tea", price: 10, prepTime: 0.6, station: "tea" },
  dish_noodles: { id: "dish_noodles", price: 18, prepTime: 1.0, station: "kitchen" },
  dish_pork: { id: "dish_pork", price: 28, prepTime: 1.4, station: "kitchen" },
  dish_cake: { id: "dish_cake", price: 15, prepTime: 0.8, station: "kitchen" },
};

export const GUEST_TYPES = {
  guest_scholar: { id: "guest_scholar", basePatience: 50, tipMultiplier: 1.5, dishes: ["dish_tea", "dish_cake"] },
  guest_merchant: { id: "guest_merchant", basePatience: 35, tipMultiplier: 2.0, dishes: ["dish_tea", "dish_pork", "dish_noodles"] },
  guest_escort: { id: "guest_escort", basePatience: 60, tipMultiplier: 1.2, dishes: ["dish_noodles", "dish_pork"] },
  guest_traveler: { id: "guest_traveler", basePatience: 30, tipMultiplier: 1.3, dishes: ["dish_tea", "dish_noodles"] },
};

export const SHIFTS = {
  shift_lunch: {
    id: "shift_lunch",
    tableCount: 4,
    duration: 100,
    targets: { star1: 120, star2: 200, star3: 300 },
    spawnInterval: 6.0,
    maxLost: 4,
    guestTypes: ["guest_scholar", "guest_traveler"],
  },
  shift_dinner: {
    id: "shift_dinner",
    tableCount: 6,
    duration: 120,
    targets: { star1: 260, star2: 420, star3: 580 },
    spawnInterval: 5.0,
    maxLost: 5,
    guestTypes: ["guest_scholar", "guest_merchant", "guest_escort"],
  },
  shift_night: {
    id: "shift_night",
    tableCount: 6,
    duration: 130,
    targets: { star1: 380, star2: 580, star3: 820 },
    spawnInterval: 4.2,
    maxLost: 5,
    guestTypes: ["guest_traveler", "guest_merchant", "guest_escort"],
  },
  shift_fair: {
    id: "shift_fair",
    tableCount: 8,
    duration: 150,
    targets: { star1: 550, star2: 880, star3: 1250 },
    spawnInterval: 3.6,
    maxLost: 6,
    guestTypes: ["guest_scholar", "guest_merchant", "guest_escort", "guest_traveler"],
  },
};

export const STATIONS = {
  tea: { id: "tea", x: 190, y: 80 },
  kitchen: { id: "kitchen", x: 400, y: 80 },
  counter: { id: "counter", x: 620, y: 80 },
  entrance: { id: "entrance", x: 740, y: 490 },
};

export function getTableCoordinates(count) {
  const coords = [];
  if (count <= 4) {
    // 2x2 grid
    coords.push({ id: 0, x: 250, y: 220 });
    coords.push({ id: 1, x: 550, y: 220 });
    coords.push({ id: 2, x: 250, y: 390 });
    coords.push({ id: 3, x: 550, y: 390 });
  } else if (count <= 6) {
    // 2 rows of 3
    coords.push({ id: 0, x: 180, y: 220 });
    coords.push({ id: 1, x: 400, y: 220 });
    coords.push({ id: 2, x: 620, y: 220 });
    coords.push({ id: 3, x: 180, y: 390 });
    coords.push({ id: 4, x: 400, y: 390 });
    coords.push({ id: 5, x: 620, y: 390 });
  } else {
    // 2 rows of 4
    coords.push({ id: 0, x: 140, y: 220 });
    coords.push({ id: 1, x: 310, y: 220 });
    coords.push({ id: 2, x: 490, y: 220 });
    coords.push({ id: 3, x: 660, y: 220 });
    coords.push({ id: 4, x: 140, y: 390 });
    coords.push({ id: 5, x: 310, y: 390 });
    coords.push({ id: 6, x: 490, y: 390 });
    coords.push({ id: 7, x: 660, y: 390 });
  }
  return coords;
}

export function createInitialState(options = {}) {
  const shiftId = options.shiftId || "shift_lunch";
  const shift = SHIFTS[shiftId] || SHIFTS.shift_lunch;
  const seed = options.seed !== undefined ? options.seed : 12345;
  const rng = mulberry32(seed);

  const upgrades = {
    tray: options.upgrades?.tray || false,
    kettle: options.upgrades?.kettle || false,
    helper: options.upgrades?.helper || false,
  };

  const tableCoords = getTableCoordinates(shift.tableCount);
  const tables = tableCoords.map((coord) => ({
    id: coord.id,
    x: coord.x,
    y: coord.y,
    status: "clean", // clean, occupied, dirty
    guest: null,
  }));

  const maxTrayCapacity = upgrades.tray ? 3 : 2;

  // Waiter starts near counter
  const waiter = {
    x: STATIONS.counter.x,
    y: STATIONS.counter.y + 30,
    targetX: STATIONS.counter.x,
    targetY: STATIONS.counter.y + 30,
    speed: 240, // px per second
    tray: [], // Array of dish IDs
    maxCapacity: maxTrayCapacity,
    currentAction: null, // { type, targetId, duration, progress }
  };

  // Assistant runner for Shift 4 or when unlocked
  const hasAssistant = shiftId === "shift_fair" || upgrades.helper;
  const assistant = hasAssistant
    ? {
        active: true,
        x: STATIONS.tea.x,
        y: STATIONS.tea.y + 30,
        targetX: STATIONS.tea.x,
        targetY: STATIONS.tea.y + 30,
        speed: 180,
        tray: [],
        maxCapacity: 1,
        currentAction: null,
      }
    : null;

  const state = {
    shiftId: shift.id,
    seed,
    timeElapsed: 0,
    timeLeft: shift.duration,
    duration: shift.duration,
    spawnTimer: 1.0, // initial customer walks in after 1s
    silver: 0,
    servedCount: 0,
    lostGuests: 0,
    maxLost: shift.maxLost,
    combo: 0,
    maxCombo: 0,
    comboTimer: 0,
    actionQueue: [], // array of { id, type, target, descKey, dishId }
    tables,
    waiter,
    assistant,
    upgrades,
    status: "playing", // playing, won, lost_reputation, lost_target
    activeCheckout: null, // { tableId, amount, targetUpper, targetLower }
    logs: [],
    nextGuestId: 1,
    nextActionId: 1,
    rngState: seed,
  };

  // Pre-seed table 0 with an arriving customer for Instant Play
  spawnGuest(state, rng, 0);

  return state;
}

export function spawnGuest(state, rng, targetTableId = null) {
  const shift = SHIFTS[state.shiftId];
  // Find an empty clean table
  const availableTables = state.tables.filter((t) => t.status === "clean" && !t.guest);
  if (availableTables.length === 0) return null;

  let table = null;
  if (targetTableId !== null) {
    table = state.tables.find((t) => t.id === targetTableId && t.status === "clean");
  }
  if (!table) {
    const idx = Math.floor(rng() * availableTables.length);
    table = availableTables[idx];
  }
  if (!table) return null;

  // Pick guest type from shift
  const gTypeKeys = shift.guestTypes;
  const gKey = gTypeKeys[Math.floor(rng() * gTypeKeys.length)];
  const gType = GUEST_TYPES[gKey];

  // Pick order (1 to 2 dishes)
  const orderCount = state.shiftId === "shift_lunch" ? 1 : rng() < 0.5 ? 1 : 2;
  const dishes = [];
  for (let i = 0; i < orderCount; i++) {
    const dKey = gType.dishes[Math.floor(rng() * gType.dishes.length)];
    dishes.push(dKey);
  }

  const guest = {
    id: state.nextGuestId++,
    typeKey: gType.id,
    state: "ordering", // ordering, waiting, eating, paying, leaving, angry
    orderTimer: 1.2,
    dishes: [...dishes],
    servedDishes: [],
    patience: 100,
    maxPatience: gType.basePatience,
    eatTimer: 5.5,
    tipMultiplier: gType.tipMultiplier,
    bill: dishes.reduce((sum, d) => sum + DISHES[d].price, 0),
  };

  table.status = "occupied";
  table.guest = guest;
  return guest;
}

export function enqueueAction(state, action) {
  if (state.status !== "playing") return state;
  if (state.actionQueue.length >= 8) return state; // queue ceiling

  const actionItem = {
    id: state.nextActionId++,
    type: action.type, // 'fetch_tea', 'fetch_dish', 'serve_table', 'clean_table', 'checkout_table'
    targetTableId: action.targetTableId !== undefined ? action.targetTableId : null,
    station: action.station || null,
    dishId: action.dishId || null,
  };

  return {
    ...state,
    actionQueue: [...state.actionQueue, actionItem],
  };
}

export function cancelAction(state, actionId) {
  return {
    ...state,
    actionQueue: state.actionQueue.filter((a) => a.id !== actionId),
  };
}

export function solveAbacus(state, { tableId, enteredSilver }) {
  if (state.status !== "playing") return state;
  const table = state.tables.find((t) => t.id === tableId);
  if (!table || !table.guest || table.guest.state !== "paying") return state;

  const guest = table.guest;
  const isMatch = enteredSilver === guest.bill;
  if (!isMatch) {
    // Bead wrong: log retry
    return {
      ...state,
      logs: [...state.logs.slice(-15), { type: "abacus_mismatch", time: state.timeElapsed }],
    };
  }

  // Calculate tip based on guest patience and speed
  const tipBonus = guest.patience > 50 ? Math.round(guest.bill * (guest.tipMultiplier - 1)) : 0;
  const totalEarned = guest.bill + tipBonus;

  // Update combo
  const newCombo = state.combo + 1;
  const maxCombo = Math.max(state.maxCombo, newCombo);

  // Mark table dirty and remove guest
  const updatedTables = state.tables.map((t) => {
    if (t.id === tableId) {
      return {
        ...t,
        status: "dirty",
        guest: null,
      };
    }
    return t;
  });

  return {
    ...state,
    silver: state.silver + totalEarned,
    servedCount: state.servedCount + 1,
    combo: newCombo,
    maxCombo,
    comboTimer: 8.0,
    activeCheckout: null,
    tables: updatedTables,
    logs: [
      ...state.logs.slice(-15),
      {
        type: "paid",
        bill: guest.bill,
        tip: tipBonus,
        total: totalEarned,
        combo: newCombo,
      },
    ],
  };
}

export function quickPay(state, { tableId }) {
  const table = state.tables.find((t) => t.id === tableId);
  if (!table || !table.guest || table.guest.state !== "paying") return state;
  return solveAbacus(state, { tableId, enteredSilver: table.guest.bill });
}

export function stepFrame(state, dt) {
  if (state.status !== "playing") return state;

  const rng = mulberry32(state.rngState);
  let timeElapsed = state.timeElapsed + dt;
  let timeLeft = Math.max(0, state.timeLeft - dt);
  let silver = state.silver;
  let servedCount = state.servedCount;
  let lostGuests = state.lostGuests;
  let combo = state.combo;
  let maxCombo = state.maxCombo;
  let comboTimer = state.comboTimer > 0 ? Math.max(0, state.comboTimer - dt) : 0;
  if (comboTimer === 0 && combo > 0) {
    combo = 0;
  }

  const shift = SHIFTS[state.shiftId];

  // 1. Guest spawn timer
  let spawnTimer = state.spawnTimer - dt;
  let tables = state.tables.map((t) => ({ ...t, guest: t.guest ? { ...t.guest } : null }));

  if (spawnTimer <= 0) {
    const spawned = spawnGuest({ ...state, tables }, rng);
    spawnTimer = shift.spawnInterval * (0.8 + rng() * 0.4);
  }

  // 2. Update table guests state
  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];
    if (!table.guest) continue;
    const guest = table.guest;

    if (guest.state === "ordering") {
      guest.orderTimer -= dt;
      if (guest.orderTimer <= 0) {
        guest.state = "waiting";
      }
    } else if (guest.state === "waiting") {
      const decayRate = 100 / guest.maxPatience;
      guest.patience = Math.max(0, guest.patience - decayRate * dt);
      if (guest.patience <= 0) {
        // Angry walkout!
        guest.state = "angry";
        table.status = "dirty";
        table.guest = null;
        lostGuests += 1;
        combo = 0;
      }
    } else if (guest.state === "eating") {
      guest.eatTimer -= dt;
      if (guest.eatTimer <= 0) {
        guest.state = "paying";
      }
    }
  }

  // 3. Process Waiter movement & actions
  let waiter = { ...state.waiter, tray: [...state.waiter.tray] };
  let actionQueue = [...state.actionQueue];

  // If waiter is idle and there is an action in queue, pick it up
  if (!waiter.currentAction && actionQueue.length > 0) {
    const nextAction = actionQueue[0];
    actionQueue.shift();

    let targetCoord = { x: waiter.x, y: waiter.y };
    let duration = 0.5;

    if (nextAction.type === "fetch_tea") {
      targetCoord = STATIONS.tea;
      duration = state.upgrades.kettle ? 0.3 : 0.6;
    } else if (nextAction.type === "fetch_dish") {
      targetCoord = STATIONS.kitchen;
      duration = DISHES[nextAction.dishId]?.prepTime || 0.8;
    } else if (nextAction.type === "serve_table") {
      const targetTable = tables.find((t) => t.id === nextAction.targetTableId);
      if (targetTable) {
        targetCoord = { x: targetTable.x, y: targetTable.y + 40 };
        duration = 0.4;
      }
    } else if (nextAction.type === "clean_table") {
      const targetTable = tables.find((t) => t.id === nextAction.targetTableId);
      if (targetTable) {
        targetCoord = { x: targetTable.x, y: targetTable.y + 40 };
        duration = 0.8;
      }
    } else if (nextAction.type === "checkout_table") {
      targetCoord = STATIONS.counter;
      duration = 0.5;
    }

    waiter.targetX = targetCoord.x;
    waiter.targetY = targetCoord.y;
    waiter.currentAction = {
      ...nextAction,
      duration,
      progress: 0,
      atDestination: false,
    };
  }

  // Move waiter towards targetX, targetY
  if (waiter.currentAction) {
    const dx = waiter.targetX - waiter.x;
    const dy = waiter.targetY - waiter.y;
    const dist = Math.hypot(dx, dy);
    const step = waiter.speed * dt;

    if (dist <= step || dist < 4) {
      waiter.x = waiter.targetX;
      waiter.y = waiter.targetY;
      waiter.currentAction.atDestination = true;
    } else {
      waiter.x += (dx / dist) * step;
      waiter.y += (dy / dist) * step;
    }

    // If reached destination, progress the action
    if (waiter.currentAction.atDestination) {
      waiter.currentAction.progress += dt;
      if (waiter.currentAction.progress >= waiter.currentAction.duration) {
        // Complete action
        const act = waiter.currentAction;
        if (act.type === "fetch_tea") {
          if (waiter.tray.length < waiter.maxCapacity) {
            waiter.tray.push("dish_tea");
          }
        } else if (act.type === "fetch_dish") {
          if (waiter.tray.length < waiter.maxCapacity && act.dishId) {
            waiter.tray.push(act.dishId);
          }
        } else if (act.type === "serve_table") {
          const targetTable = tables.find((t) => t.id === act.targetTableId);
          if (targetTable && targetTable.guest && targetTable.guest.state === "waiting") {
            const guest = targetTable.guest;
            // Check if waiter carries needed dish
            const neededDishes = guest.dishes.filter((d) => !guest.servedDishes.includes(d));
            for (const needed of neededDishes) {
              const trayIdx = waiter.tray.indexOf(needed);
              if (trayIdx !== -1) {
                waiter.tray.splice(trayIdx, 1);
                guest.servedDishes.push(needed);
                // Tea restores patience!
                if (needed === "dish_tea") {
                  guest.patience = Math.min(100, guest.patience + 35);
                }
              }
            }
            // If all served, start eating!
            if (guest.servedDishes.length >= guest.dishes.length) {
              guest.state = "eating";
            }
          }
        } else if (act.type === "clean_table") {
          const targetTable = tables.find((t) => t.id === act.targetTableId);
          if (targetTable && targetTable.status === "dirty") {
            targetTable.status = "clean";
          }
        } else if (act.type === "checkout_table") {
          // Open cashier / checkout
          if (act.targetTableId !== null) {
            const targetTable = tables.find((t) => t.id === act.targetTableId);
            if (targetTable && targetTable.guest && targetTable.guest.state === "paying") {
              // Direct quick pay
              const guest = targetTable.guest;
              const tipBonus = guest.patience > 50 ? Math.round(guest.bill * (guest.tipMultiplier - 1)) : 0;
              const totalEarned = guest.bill + tipBonus;
              silver += totalEarned;
              servedCount += 1;
              combo += 1;
              maxCombo = Math.max(maxCombo, combo);
              comboTimer = 8.0;
              targetTable.status = "dirty";
              targetTable.guest = null;
            }
          }
        }
        waiter.currentAction = null;
      }
    }
  }

  // 4. Assistant Runner (auto-cleans dirty tables or delivers tea)
  let assistant = state.assistant ? { ...state.assistant } : null;
  if (assistant && assistant.active) {
    if (!assistant.currentAction) {
      // Find a dirty table to clean
      const dirtyTable = tables.find((t) => t.status === "dirty");
      if (dirtyTable) {
        assistant.targetX = dirtyTable.x;
        assistant.targetY = dirtyTable.y + 40;
        assistant.currentAction = {
          type: "clean_table",
          targetTableId: dirtyTable.id,
          duration: 1.0,
          progress: 0,
          atDestination: false,
        };
      }
    } else {
      const dx = assistant.targetX - assistant.x;
      const dy = assistant.targetY - assistant.y;
      const dist = Math.hypot(dx, dy);
      const step = assistant.speed * dt;
      if (dist <= step || dist < 4) {
        assistant.x = assistant.targetX;
        assistant.y = assistant.targetY;
        assistant.currentAction.atDestination = true;
      } else {
        assistant.x += (dx / dist) * step;
        assistant.y += (dy / dist) * step;
      }

      if (assistant.currentAction.atDestination) {
        assistant.currentAction.progress += dt;
        if (assistant.currentAction.progress >= assistant.currentAction.duration) {
          const table = tables.find((t) => t.id === assistant.currentAction.targetTableId);
          if (table && table.status === "dirty") {
            table.status = "clean";
          }
          assistant.currentAction = null;
        }
      }
    }
  }

  // 5. Check Win / Loss status
  let status = "playing";
  if (lostGuests >= shift.maxLost) {
    status = "lost_reputation";
  } else if (timeLeft <= 0) {
    status = silver >= shift.targets.star1 ? "won" : "lost_target";
  }

  return {
    ...state,
    timeElapsed,
    timeLeft,
    silver,
    servedCount,
    lostGuests,
    combo,
    maxCombo,
    comboTimer,
    spawnTimer,
    tables,
    waiter,
    assistant,
    actionQueue,
    status,
    rngState: (state.rngState + 1) >>> 0,
  };
}

export function checkInvariants(state) {
  if (typeof state.silver !== "number" || state.silver < 0) {
    throw new Error(`Invariant violation: silver must be >= 0, got ${state.silver}`);
  }
  if (typeof state.timeLeft !== "number" || state.timeLeft < 0) {
    throw new Error(`Invariant violation: timeLeft must be >= 0, got ${state.timeLeft}`);
  }
  if (state.waiter.tray.length > state.waiter.maxCapacity) {
    throw new Error(`Invariant violation: waiter tray exceeded capacity: ${state.waiter.tray.length} > ${state.waiter.maxCapacity}`);
  }
  for (const table of state.tables) {
    if (!["clean", "occupied", "dirty"].includes(table.status)) {
      throw new Error(`Invariant violation: invalid table status: ${table.status}`);
    }
    if (table.guest) {
      if (table.guest.patience < 0 || table.guest.patience > 100) {
        throw new Error(`Invariant violation: guest patience out of bounds: ${table.guest.patience}`);
      }
    }
  }
  return true;
}

export function getLegalActions(state) {
  if (state.status !== "playing") return [];
  const actions = [];

  // Can fetch tea if tray not full
  if (state.waiter.tray.length < state.waiter.maxCapacity) {
    actions.push({ type: "fetch_tea" });
    actions.push({ type: "fetch_dish", dishId: "dish_noodles" });
    actions.push({ type: "fetch_dish", dishId: "dish_pork" });
    actions.push({ type: "fetch_dish", dishId: "dish_cake" });
  }

  // Tables
  for (const table of state.tables) {
    if (table.status === "dirty") {
      actions.push({ type: "clean_table", targetTableId: table.id });
    } else if (table.guest) {
      if (table.guest.state === "waiting") {
        actions.push({ type: "serve_table", targetTableId: table.id });
      } else if (table.guest.state === "paying") {
        actions.push({ type: "checkout_table", targetTableId: table.id });
      }
    }
  }

  return actions;
}
