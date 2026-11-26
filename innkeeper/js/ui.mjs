/**
 * 中华客栈 · 跑堂点菜 (Inn Master)
 * 交互与 DOM HUD 渲染器 (队列条、算盘弹窗、场次与升级抽屉)
 */

import { translate, t, toggleLocale, updatePageTranslations } from "./i18n.mjs";
import { STATIONS, DISHES } from "./engine.mjs";
import {
  playPourTea,
  playServeDish,
  playAbacusBead,
  playCoinClink,
  playHappyTip,
  playAngryWalkout,
  playCleanTable,
  setSoundEnabled,
  isSoundEnabled,
} from "./audio.mjs";
import { loadRecord, buyUpgrade } from "./storage.mjs";

export function createUI(controller, container) {
  let activeTableForCheckout = null;
  let abacusCount = { tensUpper: 0, tensLower: 0, onesUpper: 0, onesLower: 0 };

  // DOM Elements
  const elSilver = document.getElementById("hud-silver");
  const elTime = document.getElementById("hud-time");
  const elShiftName = document.getElementById("hud-shift-name");
  const elCombo = document.getElementById("hud-combo");
  const elServed = document.getElementById("hud-served");
  const elLost = document.getElementById("hud-lost");
  const elQueueList = document.getElementById("queue-items");
  const elCanvas = document.getElementById("tavern-canvas");

  // Modals
  const modalAbacus = document.getElementById("modal-abacus");
  const modalShifts = document.getElementById("modal-shifts");
  const modalUpgrades = document.getElementById("modal-upgrades");
  const modalResults = document.getElementById("modal-results");
  const modalPaused = document.getElementById("modal-paused");
  const modalGuide = document.getElementById("modal-guide");

  // Buttons
  const btnPause = document.getElementById("btn-pause");
  const btnLang = document.getElementById("btn-lang");
  const btnSound = document.getElementById("btn-sound");
  const btnShiftDrawer = document.getElementById("btn-shift-drawer");
  const btnUpgradesDrawer = document.getElementById("btn-upgrades-drawer");
  const btnGuide = document.getElementById("btn-guide");

  // Abacus controls
  const abacusDue = document.getElementById("abacus-due");
  const abacusCountDisplay = document.getElementById("abacus-counted");
  const abacusSubmit = document.getElementById("abacus-btn-submit");
  const abacusQuick = document.getElementById("abacus-btn-quick");
  const abacusReset = document.getElementById("abacus-btn-reset");
  const abacusClose = document.getElementById("abacus-btn-close");
  const abacusError = document.getElementById("abacus-error-msg");

  // Hook sound events
  controller.onEvent((event) => {
    if (event.type === "served") {
      playServeDish();
      if (event.combo >= 2) {
        playHappyTip();
      }
    } else if (event.type === "coin_gain") {
      playCoinClink();
    } else if (event.type === "guest_lost") {
      playAngryWalkout();
    } else if (event.type === "action_enqueued") {
      if (event.action.type === "fetch_tea") {
        playPourTea();
      } else if (event.action.type === "clean_table") {
        playCleanTable();
      }
    }
  });

  // 1. Canvas Click Handlers (Smart Auto-Dispatch)
  elCanvas.addEventListener("pointerdown", (e) => {
    const state = controller.getState();
    if (state.status !== "playing") return;

    const rect = elCanvas.getBoundingClientRect();
    const scaleX = 800 / rect.width;
    const scaleY = 540 / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Check stations click
    if (clickY <= 140) {
      if (Math.hypot(clickX - STATIONS.tea.x, clickY - STATIONS.tea.y) < 55) {
        controller.enqueue({ type: "fetch_tea" });
        return;
      }
      if (Math.hypot(clickX - STATIONS.kitchen.x, clickY - STATIONS.kitchen.y) < 60) {
        // Enqueue next needed dish from guests, or default noodles
        const neededDish = findMostUrgentNeededDish(state) || "dish_noodles";
        controller.enqueue({ type: "fetch_dish", dishId: neededDish });
        return;
      }
      if (Math.hypot(clickX - STATIONS.counter.x, clickY - STATIONS.counter.y) < 55) {
        // Check if any guest is waiting to pay
        const payingTable = state.tables.find((t) => t.guest && t.guest.state === "paying");
        if (payingTable) {
          openAbacusModal(payingTable.id, payingTable.guest.bill);
        }
        return;
      }
    }

    // Check tables click
    for (const table of state.tables) {
      if (Math.hypot(clickX - table.x, clickY - table.y) < 48) {
        handleTableClick(table, state);
        return;
      }
    }
  });

  function findMostUrgentNeededDish(state) {
    for (const table of state.tables) {
      if (table.guest && table.guest.state === "waiting") {
        const unserved = table.guest.dishes.find(
          (d) => d !== "dish_tea" && !table.guest.servedDishes.includes(d)
        );
        if (unserved) return unserved;
      }
    }
    return null;
  }

  function handleTableClick(table, state) {
    if (table.status === "dirty") {
      controller.enqueue({ type: "clean_table", targetTableId: table.id });
      return;
    }

    if (table.guest) {
      if (table.guest.state === "paying") {
        openAbacusModal(table.id, table.guest.bill);
        return;
      }

      if (table.guest.state === "waiting") {
        const guest = table.guest;
        const waiter = state.waiter;
        const neededDishes = guest.dishes.filter((d) => !guest.servedDishes.includes(d));

        // If waiter carries needed item, go serve directly!
        const hasNeededInTray = neededDishes.some((d) => waiter.tray.includes(d));
        if (hasNeededInTray) {
          controller.enqueue({ type: "serve_table", targetTableId: table.id });
          return;
        }

        // Otherwise auto-queue: fetch needed item, then serve table!
        const nextNeeded = neededDishes[0];
        if (nextNeeded === "dish_tea") {
          controller.enqueue({ type: "fetch_tea" });
        } else {
          controller.enqueue({ type: "fetch_dish", dishId: nextNeeded });
        }
        controller.enqueue({ type: "serve_table", targetTableId: table.id });
      }
    }
  }

  // 2. Abacus Modal Operations
  function openAbacusModal(tableId, bill) {
    activeTableForCheckout = tableId;
    abacusCount = { tensUpper: 0, tensLower: 0, onesUpper: 0, onesLower: 0 };
    abacusDue.textContent = `$${bill}`;
    abacusError.textContent = "";
    updateAbacusDisplay();
    modalAbacus.classList.remove("hidden");
    playAbacusBead();
  }

  function closeAbacusModal() {
    activeTableForCheckout = null;
    modalAbacus.classList.add("hidden");
  }

  function getAbacusValue() {
    const tens = abacusCount.tensUpper * 5 + abacusCount.tensLower;
    const ones = abacusCount.onesUpper * 5 + abacusCount.onesLower;
    return tens * 10 + ones;
  }

  function updateAbacusDisplay() {
    const val = getAbacusValue();
    abacusCountDisplay.textContent = `$${val}`;

    // Render beads visual state
    document.querySelectorAll(".abacus-rod").forEach((rodEl) => {
      const rodType = rodEl.getAttribute("data-rod"); // 'tens' or 'ones'
      const upperBtn = rodEl.querySelector(".bead-upper");
      const lowerBtns = rodEl.querySelectorAll(".bead-lower");

      const isUpperDown = rodType === "tens" ? abacusCount.tensUpper > 0 : abacusCount.onesUpper > 0;
      upperBtn.classList.toggle("active", isUpperDown);

      const lowerCount = rodType === "tens" ? abacusCount.tensLower : abacusCount.onesLower;
      lowerBtns.forEach((btn, idx) => {
        btn.classList.toggle("active", idx < lowerCount);
      });
    });
  }

  // Abacus Bead Clicks
  document.querySelectorAll(".bead-upper").forEach((btn) => {
    btn.addEventListener("click", () => {
      const rod = btn.closest(".abacus-rod").getAttribute("data-rod");
      if (rod === "tens") {
        abacusCount.tensUpper = abacusCount.tensUpper === 1 ? 0 : 1;
      } else {
        abacusCount.onesUpper = abacusCount.onesUpper === 1 ? 0 : 1;
      }
      playAbacusBead();
      updateAbacusDisplay();
    });
  });

  document.querySelectorAll(".bead-lower").forEach((btn) => {
    btn.addEventListener("click", () => {
      const rod = btn.closest(".abacus-rod").getAttribute("data-rod");
      const targetCount = parseInt(btn.getAttribute("data-val"), 10);
      if (rod === "tens") {
        abacusCount.tensLower = abacusCount.tensLower === targetCount ? targetCount - 1 : targetCount;
      } else {
        abacusCount.onesLower = abacusCount.onesLower === targetCount ? targetCount - 1 : targetCount;
      }
      playAbacusBead();
      updateAbacusDisplay();
    });
  });

  abacusSubmit.addEventListener("click", () => {
    if (activeTableForCheckout === null) return;
    const entered = getAbacusValue();
    const state = controller.getState();
    const table = state.tables.find((t) => t.id === activeTableForCheckout);
    if (!table || !table.guest) {
      closeAbacusModal();
      return;
    }

    if (entered === table.guest.bill) {
      controller.pay(activeTableForCheckout, entered);
      closeAbacusModal();
    } else {
      abacusError.textContent = t("abacus_error");
      playAngryWalkout();
    }
  });

  abacusQuick.addEventListener("click", () => {
    if (activeTableForCheckout !== null) {
      controller.pay(activeTableForCheckout, null);
      closeAbacusModal();
    }
  });

  abacusReset.addEventListener("click", () => {
    abacusCount = { tensUpper: 0, tensLower: 0, onesUpper: 0, onesLower: 0 };
    playAbacusBead();
    updateAbacusDisplay();
  });

  abacusClose.addEventListener("click", closeAbacusModal);

  // 3. Queue Bar Display & Cancel
  function renderQueue(queue) {
    elQueueList.innerHTML = "";
    if (queue.length === 0) {
      const emptyChip = document.createElement("span");
      emptyChip.className = "queue-empty-text";
      emptyChip.textContent = t("table_clean");
      elQueueList.appendChild(emptyChip);
      return;
    }

    queue.forEach((act) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "queue-chip";

      let desc = "";
      if (act.type === "fetch_tea") {
        desc = t("act_fetch_tea");
      } else if (act.type === "fetch_dish") {
        desc = t("act_fetch_dish", { dish: t(act.dishId || "dish_noodles") });
      } else if (act.type === "serve_table") {
        desc = t("act_serve_table", { n: act.targetTableId + 1 });
      } else if (act.type === "clean_table") {
        desc = t("act_clean_table", { n: act.targetTableId + 1 });
      } else if (act.type === "checkout_table") {
        desc = t("act_checkout_table", { n: act.targetTableId + 1 });
      }

      chip.textContent = `${desc} ✕`;
      chip.title = t("cancel_queue_hint");
      chip.addEventListener("click", () => {
        controller.cancel(act.id);
      });
      elQueueList.appendChild(chip);
    });
  }

  // 4. State Update Subscriber
  controller.subscribe((state, isPaused) => {
    // HUD stats
    elSilver.textContent = state.silver;
    elTime.textContent = Math.ceil(state.timeLeft);
    elShiftName.textContent = t(state.shiftId);
    elCombo.textContent = state.combo > 1 ? `${state.combo}x` : "-";
    elServed.textContent = state.servedCount;
    elLost.textContent = `${state.lostGuests}/${state.maxLost}`;

    btnPause.textContent = isPaused ? t("resume") : t("pause");
    modalPaused.classList.toggle("hidden", !isPaused);

    renderQueue(state.actionQueue);

    // Results Modal
    if (state.status !== "playing") {
      showResultsModal(state);
    }
  });

  function showResultsModal(state) {
    modalResults.classList.remove("hidden");
    const titleEl = document.getElementById("results-title");
    const silverEl = document.getElementById("results-silver");
    const servedEl = document.getElementById("results-served");
    const lostEl = document.getElementById("results-lost");
    const comboEl = document.getElementById("results-combo");

    silverEl.textContent = state.silver;
    servedEl.textContent = state.servedCount;
    lostEl.textContent = state.lostGuests;
    comboEl.textContent = state.maxCombo;

    if (state.status === "won") {
      titleEl.textContent = t("result_won_title");
      titleEl.className = "result-title won";
    } else if (state.status === "lost_reputation") {
      titleEl.textContent = t("result_reputation_title");
      titleEl.className = "result-title lost";
    } else {
      titleEl.textContent = t("result_lost_title");
      titleEl.className = "result-title lost";
    }
  }

  // 5. Button Bindings
  btnPause.addEventListener("click", () => {
    controller.togglePause();
  });

  btnLang.addEventListener("click", () => {
    toggleLocale();
    btnLang.textContent = t("langToggle");
    updatePageTranslations();
    const st = controller.getState();
    elShiftName.textContent = t(st.shiftId);
    renderQueue(st.actionQueue);
  });

  btnSound.addEventListener("click", () => {
    const next = !isSoundEnabled();
    setSoundEnabled(next);
    btnSound.textContent = next ? t("soundOn") : t("soundOff");
  });

  btnGuide.addEventListener("click", () => {
    modalGuide.classList.remove("hidden");
  });

  document.getElementById("btn-guide-close").addEventListener("click", () => {
    modalGuide.classList.add("hidden");
  });

  btnShiftDrawer.addEventListener("click", () => {
    renderShiftsModal();
    modalShifts.classList.remove("hidden");
  });

  document.getElementById("btn-shifts-close").addEventListener("click", () => {
    modalShifts.classList.add("hidden");
  });

  btnUpgradesDrawer.addEventListener("click", () => {
    renderUpgradesModal();
    modalUpgrades.classList.remove("hidden");
  });

  document.getElementById("btn-upgrades-close").addEventListener("click", () => {
    modalUpgrades.classList.add("hidden");
  });

  document.getElementById("btn-restart-paused").addEventListener("click", () => {
    modalPaused.classList.add("hidden");
    const record = loadRecord();
    controller.startMatch({
      shiftId: controller.getState().shiftId,
      upgrades: record.upgrades,
    });
  });

  document.getElementById("btn-continue-paused").addEventListener("click", () => {
    controller.resume();
  });

  document.getElementById("btn-results-retry").addEventListener("click", () => {
    modalResults.classList.add("hidden");
    const record = loadRecord();
    controller.startMatch({
      shiftId: controller.getState().shiftId,
      upgrades: record.upgrades,
    });
  });

  document.getElementById("btn-results-next").addEventListener("click", () => {
    modalResults.classList.add("hidden");
    const record = loadRecord();
    const cur = controller.getState().shiftId;
    const nextShift =
      cur === "shift_lunch" ? "shift_dinner" : cur === "shift_dinner" ? "shift_night" : "shift_fair";
    controller.startMatch({
      shiftId: nextShift,
      upgrades: record.upgrades,
    });
  });

  function renderShiftsModal() {
    const list = document.getElementById("shifts-list");
    list.innerHTML = "";
    const record = loadRecord();
    const shiftKeys = ["shift_lunch", "shift_dinner", "shift_night", "shift_fair"];

    shiftKeys.forEach((key) => {
      const isUnlocked = record.unlockedShifts.includes(key);
      const card = document.createElement("div");
      card.className = `shift-card ${isUnlocked ? "unlocked" : "locked"}`;

      const title = document.createElement("h4");
      title.textContent = t(key);
      const desc = document.createElement("p");
      desc.textContent = t(`${key}_desc`);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-primary";
      btn.textContent = isUnlocked ? t("shift") : t("locked");
      btn.disabled = !isUnlocked;

      if (isUnlocked) {
        btn.addEventListener("click", () => {
          modalShifts.classList.add("hidden");
          controller.startMatch({
            shiftId: key,
            upgrades: record.upgrades,
          });
        });
      }

      card.appendChild(title);
      card.appendChild(desc);
      card.appendChild(btn);
      list.appendChild(card);
    });
  }

  function renderUpgradesModal() {
    const list = document.getElementById("upgrades-list");
    list.innerHTML = "";
    const record = loadRecord();
    const upgradesDef = [
      { key: "tray", cost: 200, name: "upgrade_tray", desc: "upgrade_tray_desc" },
      { key: "kettle", cost: 150, name: "upgrade_kettle", desc: "upgrade_kettle_desc" },
      { key: "helper", cost: 400, name: "upgrade_helper", desc: "upgrade_helper_desc" },
    ];

    upgradesDef.forEach((item) => {
      const isOwned = record.upgrades[item.key];
      const card = document.createElement("div");
      card.className = `upgrade-card ${isOwned ? "owned" : ""}`;

      const title = document.createElement("h4");
      title.textContent = t(item.name);
      const desc = document.createElement("p");
      desc.textContent = t(item.desc);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-primary";

      if (isOwned) {
        btn.textContent = t("upgrade_owned");
        btn.disabled = true;
      } else {
        btn.textContent = t("upgrade_cost", { cost: item.cost });
        btn.disabled = record.totalSilver < item.cost;
        btn.addEventListener("click", () => {
          if (buyUpgrade(item.key, item.cost)) {
            playCoinClink();
            renderUpgradesModal();
          }
        });
      }

      card.appendChild(title);
      card.appendChild(desc);
      card.appendChild(btn);
      list.appendChild(card);
    });
  }
}
