// 唯一碰 DOM 的层：把快照铺成一张摊开的案卷，把点击翻译成控制器意图。
// 所有可变文本都经由 i18n，切语言时原地重铺，绝不重建控制器。

import { CASES, CHAPTERS, chapterOf } from "./cases.mjs";
import { STAMP } from "./engine.mjs";
import { formatDuration } from "./score.mjs";
import { translate } from "./i18n.mjs";

/** 维多利亚警局档案照：四种帽型 + 两种面部特征的木刻式剪影。 */
const HATS = [
  // 高礼帽
  `<path d="M-15 30 h30 v-16 a3 3 0 0 0 -3 -3 h-24 a3 3 0 0 0 -3 3 z" fill="#20150f"/>
   <rect x="-19" y="29" width="38" height="4" rx="2" fill="#160e0a"/>`,
  // 圆顶硬礼帽
  `<path d="M-14 31 q0 -18 14 -18 q14 0 14 18 z" fill="#241a13"/>
   <rect x="-19" y="29" width="38" height="4" rx="2" fill="#1a110c"/>`,
  // 女帽 + 面纱
  `<path d="M-18 31 q18 -14 36 0 q-5 5 -18 5 q-13 0 -18 -5 z" fill="#2c1d1c"/>
   <circle cx="13" cy="22" r="4.4" fill="#6b4238"/>
   <path d="M-17 31 q17 8 34 0" stroke="#1a1210" stroke-width="1.2" fill="none" opacity="0.6"/>`,
  // 鸭舌帽
  `<path d="M-13 30 q13 -13 26 0 z" fill="#1d1712"/>
   <path d="M6 30 q10 1 12 4 q-8 2 -12 -1 z" fill="#120d09"/>`,
];

const FACES = [
  // 有髭须
  `<path d="M-6 52 q6 2 12 0 q-2 4 -6 4 q-4 0 -6 -4 z" fill="#1d140f"/>`,
  // 无髭须，戴眼镜
  `<g fill="none" stroke="#2a1d14" stroke-width="1.2">
     <circle cx="-8" cy="43" r="5"/><circle cx="8" cy="43" r="5"/>
     <path d="M-3 43 h6 M-13 42 l-4 -1 M13 42 l4 -1"/>
   </g>`,
];

const TONES = [
  ["#b9a488", "#8d775d"],
  ["#c3ae92", "#96806a"],
  ["#b09a7e", "#846e56"],
  ["#bfa98d", "#907a62"],
  ["#b4a086", "#87715a"],
];

function portraitSvg(index, tone) {
  const hat = HATS[index % HATS.length];
  const face = FACES[index % FACES.length];
  const tilt = ((index % 3) - 1) * 1.6;
  const id = `p${index}`;
  return [
    `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" class="portrait-svg" aria-hidden="true" focusable="false">`,
    `<defs>`,
    `<linearGradient id="bg${id}" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0" stop-color="${tone[0]}"/><stop offset="1" stop-color="${tone[1]}"/>`,
    `</linearGradient>`,
    `<radialGradient id="vig${id}" cx="50%" cy="40%" r="66%">`,
    `<stop offset="52%" stop-color="#1b1108" stop-opacity="0"/><stop offset="100%" stop-color="#1b1108" stop-opacity="0.6"/>`,
    `</radialGradient>`,
    `</defs>`,
    `<rect width="100" height="100" fill="url(#bg${id})"/>`,
    `<g transform="translate(${50 + tilt} 2)">`,
    `<path d="M-31 100 v-7 c0-13 13-21 31-21 s31 8 31 21 v7 z" fill="#2b1f18"/>`,
    `<path d="M-8 70 l8 9 l8 -9 l7 7 -15 9 -15 -9 z" fill="#eadfc6"/>`,
    `<rect x="-7" y="57" width="14" height="16" rx="5" fill="#7d5f47"/>`,
    `<ellipse cx="0" cy="42" rx="17" ry="21" fill="#a0805f"/>`,
    `<path d="M-17 37 c0-14 8-21 17-21 s17 7 17 21 c-4-9 -9-12 -17-12 s-13 3 -17 12 z" fill="#241811"/>`,
    `<path d="M-12 37 q4 -2 7 0 M5 37 q4 -2 7 0" stroke="#241811" stroke-width="1.7" fill="none" stroke-linecap="round"/>`,
    `<ellipse cx="-8" cy="42" rx="2.2" ry="1.7" fill="#170f09"/>`,
    `<ellipse cx="8" cy="42" rx="2.2" ry="1.7" fill="#170f09"/>`,
    `<path d="M0 43 v7 l3 2" stroke="#6f5237" stroke-width="1.3" fill="none" stroke-linecap="round"/>`,
    `<path d="M-5 55 q5 3 10 0" stroke="#48301f" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
    face,
    hat,
    `</g>`,
    `<rect width="100" height="100" fill="url(#vig${id})"/>`,
    `</svg>`,
  ].join("");
}

function starText(n) {
  const filled = Math.max(0, Math.min(3, n | 0));
  return "★".repeat(filled) + "☆".repeat(3 - filled);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createUI({ game, actions, locale: initialLocale = "zh" }) {
  let locale = initialLocale;
  let current = null;
  let builtCaseId = null;
  let heldStamp = STAMP.CLEAR;
  let insightWho = null;
  let inspecting = null;
  let pickerMode = null;
  let toastTimer = 0;

  const refs = {
    caseNo: document.getElementById("case-no"),
    caseTitle: document.getElementById("case-title"),
    caseFlag: document.getElementById("case-flag"),
    briefHook: document.getElementById("brief-hook"),
    briefVictim: document.getElementById("brief-victim"),
    briefScene: document.getElementById("brief-scene"),
    briefWindow: document.getElementById("brief-window"),
    lineup: document.getElementById("lineup"),
    rail: document.getElementById("evidence-rail"),
    slotKiller: document.getElementById("slot-killer"),
    slotWeapon: document.getElementById("slot-weapon"),
    slotClue: document.getElementById("slot-clue"),
    sealBtn: document.getElementById("seal-btn"),
    sealLabel: document.getElementById("seal-label"),
    watch: document.getElementById("watch"),
    watchTime: document.getElementById("watch-time"),
    trayHint: document.getElementById("tray-hint"),
    toast: document.getElementById("toast"),
    inspector: document.getElementById("inspector"),
    inspectTitle: document.getElementById("inspect-title"),
    inspectBody: document.getElementById("inspect-body"),
    inspectPick: document.getElementById("inspect-pick"),
    inspectClose: document.getElementById("inspect-close"),
    picker: document.getElementById("picker"),
    pickerTitle: document.getElementById("picker-title"),
    pickerList: document.getElementById("picker-list"),
    pickerClose: document.getElementById("picker-close"),
    drawer: document.getElementById("drawer"),
    drawerClose: document.getElementById("drawer-close"),
    caseGroups: document.getElementById("case-groups"),
    help: document.getElementById("help"),
    helpClose: document.getElementById("help-close"),
    pause: document.getElementById("pause"),
    pauseResume: document.getElementById("pause-resume"),
    pauseReset: document.getElementById("pause-reset"),
    result: document.getElementById("result"),
    resultTitle: document.getElementById("result-title"),
    resultSub: document.getElementById("result-sub"),
    resultTime: document.getElementById("result-time"),
    resultMistakes: document.getElementById("result-mistakes"),
    resultRank: document.getElementById("result-rank"),
    resultCase: document.getElementById("result-case"),
    resultNext: document.getElementById("result-next"),
    resultCases: document.getElementById("result-cases"),
    btnCases: document.getElementById("btn-cases"),
    btnPause: document.getElementById("btn-pause"),
    btnSound: document.getElementById("btn-sound"),
    btnLang: document.getElementById("btn-lang"),
    btnHelp: document.getElementById("btn-help"),
    btnReset: document.getElementById("btn-reset"),
    stampTools: document.querySelectorAll(".stamp-tool"),
  };

  function t(key, vars) {
    return translate(locale, key, vars);
  }

  // ------------------------------------------------------------ 案卷主体

  function buildCase(caseData) {
    builtCaseId = caseData.id;
    refs.lineup.innerHTML = "";
    refs.rail.innerHTML = "";
    caseData.suspects.forEach((who, index) => {
      refs.lineup.appendChild(buildSuspect(caseData, who, index));
    });
    for (const item of caseData.evidence) {
      refs.rail.appendChild(buildTag(caseData, item));
    }
  }

  function buildSuspect(caseData, who, index) {
    const card = el("article", "suspect");
    card.dataset.who = who;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.innerHTML = [
      `<div class="photo">${portraitSvg(index, TONES[index % TONES.length])}</div>`,
      `<div class="who"><span class="role"></span><span class="index">No.${index + 1}</span></div>`,
      `<p class="claim" role="note"></p>`,
      `<div class="belongings"></div>`,
      `<span class="stamp-badge"></span>`,
    ].join("");
    card.querySelector(".role").textContent = t(`role_${who}`);
    card.querySelector(".claim").textContent = t(`c${caseData.id}_${who}`);
    card.querySelector(".stamp-badge").textContent = t("stampUnset");
    card.setAttribute("aria-label", t("ariaSuspect", { name: t(`role_${who}`) }));

    card.addEventListener("click", (event) => {
      if (event.target.closest(".chip")) return;
      if (event.target.closest(".claim")) {
        toggleInsight(who);
        return;
      }
      actions.stamp(who, heldStamp);
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        actions.stamp(who, heldStamp);
      }
    });

    const belongings = card.querySelector(".belongings");
    const held = caseData.evidence.filter((item) => item.holds === who);
    for (const item of held) {
      const chip = el("button", "chip", t(`ev_${item.id}`));
      chip.type = "button";
      chip.dataset.evidence = item.id;
      chip.setAttribute("aria-label", t("ariaEvidence", { name: t(`ev_${item.id}`) }));
      chip.addEventListener("click", (event) => {
        event.stopPropagation();
        openInspector(item.id);
      });
      belongings.appendChild(chip);
    }
    if (!held.length) belongings.remove();
    return card;
  }

  function buildTag(caseData, item) {
    const tag = el("button", "tag");
    tag.type = "button";
    tag.dataset.evidence = item.id;
    tag.innerHTML = `<span class="tag-name"></span><span class="tag-short"></span>`;
    tag.querySelector(".tag-name").textContent = t(`ev_${item.id}`);
    tag.querySelector(".tag-short").textContent = t(`ev_${item.id}_d`).slice(0, 34);
    tag.setAttribute("aria-label", t("ariaEvidence", { name: t(`ev_${item.id}`) }));
    tag.addEventListener("click", () => openInspector(item.id));
    return tag;
  }

  function syncCaseText(caseData) {
    refs.caseNo.textContent = t("caseNo", { n: String(caseData.id).padStart(2, "0") });
    refs.caseTitle.textContent = t(`case${caseData.id}_title`);
    refs.briefHook.textContent = t(`case${caseData.id}_hook`);
    refs.briefVictim.textContent = t(`victim_${caseData.victim}`);
    refs.briefScene.textContent = t(`scene_${caseData.scene}`);
    refs.briefWindow.textContent = `${caseData.from} – ${caseData.to}`;
    for (const card of refs.lineup.children) {
      const who = card.dataset.who;
      if (!who) continue;
      card.querySelector(".role").textContent = t(`role_${who}`);
      card.querySelector(".claim").textContent = t(`c${caseData.id}_${who}`);
      card.setAttribute("aria-label", t("ariaSuspect", { name: t(`role_${who}`) }));
      for (const chip of card.querySelectorAll(".chip")) {
        const id = chip.dataset.evidence;
        chip.textContent = t(`ev_${id}`);
        chip.setAttribute("aria-label", t("ariaEvidence", { name: t(`ev_${id}`) }));
      }
    }
    for (const tag of refs.rail.children) {
      const id = tag.dataset.evidence;
      tag.querySelector(".tag-name").textContent = t(`ev_${id}`);
      tag.querySelector(".tag-short").textContent = t(`ev_${id}_d`).slice(0, 34);
      tag.setAttribute("aria-label", t("ariaEvidence", { name: t(`ev_${id}`) }));
    }
    syncHeldTools();
    renderDrawer();
    if (pickerMode) openPicker(pickerMode);
    if (inspecting) openInspector(inspecting, true);
  }

  // ------------------------------------------------------------ 状态同步

  function sync(snapshot) {
    current = snapshot;
    if (!snapshot) return;
    if (builtCaseId !== snapshot.caseId) buildCase(snapshot.caseData);
    syncCaseText(snapshot.caseData);
    syncStamps(snapshot);
    syncWatch(snapshot);
    syncSlots(snapshot);
    syncSeal(snapshot);
    syncFlag(snapshot);
    refs.btnPause.textContent = snapshot.paused ? "▶" : "❙❙";
    refs.btnPause.setAttribute("aria-label", snapshot.paused ? t("resume") : t("pause"));
  }

  function syncStamps(snapshot) {
    for (const card of refs.lineup.children) {
      const who = card.dataset.who;
      if (!who) continue;
      const kind = snapshot.stamps[who] ?? STAMP.UNSET;
      card.dataset.stamp = kind;
      card.querySelector(".stamp-badge").textContent =
        kind === STAMP.CLEAR ? t("stampClear") : kind === STAMP.GUILTY ? t("stampGuilty") : t("stampUnset");
    }
    applyInsight();
  }

  function syncWatch(snapshot) {
    refs.watchTime.textContent = formatDuration(snapshot.elapsed);
    refs.watch.dataset.paused = String(snapshot.paused || snapshot.sealed);
  }

  function syncSlots(snapshot) {
    const filled = [
      [refs.slotKiller, t("slotKiller"), snapshot.guilty ? t(`role_${snapshot.guilty}`) : null, "killer"],
      [refs.slotWeapon, t("slotWeapon"), snapshot.weapon ? t(`weapon_${snapshot.weapon}`) : null, "weapon"],
      [refs.slotClue, t("slotClue"), snapshot.clue ? t(`ev_${snapshot.clue}`) : null, "clue"],
    ];
    for (const [node, label, value, dim] of filled) {
      node.dataset.dim = dim;
      node.dataset.filled = String(Boolean(value));
      node.innerHTML = `<span class="slot-label"></span><span class="slot-value"></span>`;
      node.querySelector(".slot-label").textContent = label;
      node.querySelector(".slot-value").textContent = value ?? t("slotPick");
      node.disabled = dim !== "killer" ? snapshot.sealed : true;
      node.setAttribute("aria-label", `${label} ${value ?? t("slotPick")}`);
    }
  }

  function syncSeal(snapshot) {
    const ready = snapshot.ready && !snapshot.sealed;
    refs.sealBtn.disabled = !ready;
    refs.sealBtn.classList.toggle("armed", ready);
    refs.sealBtn.classList.toggle("pressed", Boolean(snapshot.sealed));
    if (!snapshot.sealed) refs.sealLabel.textContent = ready ? t("sealReady") : t("seal");
  }

  function syncFlag(snapshot) {
    const record = snapshot.progress?.cases?.[snapshot.caseId];
    refs.caseFlag.textContent = snapshot.sealed ? t("caseDone") : record ? t("caseOpen") : t("caseNew");
    refs.caseFlag.dataset.state = snapshot.sealed ? "done" : record ? "open" : "new";
  }

  function syncHeldTools() {
    for (const tool of refs.stampTools) {
      tool.dataset.held = String(tool.dataset.stamp === heldStamp);
      tool.setAttribute("aria-pressed", String(tool.dataset.stamp === heldStamp));
    }
    const label = heldStamp === STAMP.GUILTY ? t("stampGuilty") : t("stampClear");
    refs.trayHint.textContent = t("trayHeld", { stamp: label });
  }

  // ------------------------------------------------------------ 线索互斥高亮

  function toggleInsight(who) {
    insightWho = insightWho === who ? null : who;
    applyInsight();
    if (insightWho) actions.onInsight?.(insightWho);
  }

  function applyInsight() {
    const related = insightWho && game ? game.related(insightWho) : { supports: [], contradicts: [] };
    const support = new Set(related.supports ?? []);
    const contra = new Set(related.contradicts ?? []);
    for (const card of refs.lineup.children) {
      card.classList.toggle("insight", card.dataset.who === insightWho);
    }
    for (const node of [...refs.rail.children, ...refs.lineup.querySelectorAll(".chip")]) {
      const id = node.dataset.evidence;
      node.classList.toggle("glow-support", Boolean(id) && insightWho !== null && support.has(id));
      node.classList.toggle("glow-contra", Boolean(id) && insightWho !== null && contra.has(id));
    }
  }

  function clearInsight() {
    if (!insightWho) return;
    insightWho = null;
    applyInsight();
  }

  // ------------------------------------------------------------ 物证检验

  function openInspector(id, silent = false) {
    if (!refs.inspector) return;
    inspecting = id;
    refs.inspectTitle.textContent = t(`ev_${id}`);
    refs.inspectBody.textContent = t(`ev_${id}_d`);
    refs.inspector.hidden = false;
    refs.inspectPick.textContent = t("slotClue");
    refs.inspectPick.dataset.evidence = id;
    if (!silent) actions.onInspect?.(id);
  }

  function closeInspector() {
    inspecting = null;
    refs.inspector.hidden = true;
  }

  // ------------------------------------------------------------ 选择器

  function openPicker(mode) {
    if (!current) return;
    pickerMode = mode;
    const caseData = current.caseData;
    refs.pickerTitle.textContent = mode === "weapon" ? t("slotWeapon") : t("slotClue");
    refs.pickerList.innerHTML = "";
    const ids = mode === "weapon" ? caseData.weapons : caseData.evidence.map((item) => item.id);
    for (const id of ids) {
      const button = el("button", "picker-item");
      button.type = "button";
      button.dataset.id = id;
      const active = mode === "weapon" ? current.weapon === id : current.clue === id;
      button.dataset.active = String(active);
      button.textContent = mode === "weapon" ? t(`weapon_${id}`) : t(`ev_${id}`);
      button.addEventListener("click", () => {
        if (mode === "weapon") actions.pickWeapon(id);
        else actions.pickClue(id);
        closePicker();
      });
      refs.pickerList.appendChild(button);
    }
    refs.picker.hidden = false;
  }

  function closePicker() {
    pickerMode = null;
    refs.picker.hidden = true;
  }

  // ------------------------------------------------------------ 卷宗目录

  function renderDrawer() {
    if (!refs.caseGroups) return;
    refs.caseGroups.innerHTML = "";
    for (const chapter of CHAPTERS) {
      const group = el("section", "case-group");
      group.appendChild(el("h3", "group-title", t(chapter.key)));
      const grid = el("div", "case-grid");
      for (const id of chapter.cases) {
        const caseData = CASES.find((item) => item.id === id);
        const record = current?.progress?.cases?.[id];
        const unlocked = id === 1 || Boolean(current?.progress?.cases?.[id - 1]);
        const button = el("button", "case-cell");
        button.type = "button";
        button.dataset.case = String(id);
        button.dataset.state = record ? "done" : unlocked ? "open" : "locked";
        button.disabled = !unlocked;
        button.innerHTML = [
          `<span class="cell-no"></span>`,
          `<span class="cell-title"></span>`,
          `<span class="cell-stars"></span>`,
        ].join("");
        button.querySelector(".cell-no").textContent = String(id).padStart(2, "0");
        button.querySelector(".cell-title").textContent = t(`case${id}_title`);
        button.querySelector(".cell-stars").textContent = record ? starText(record.stars) : unlocked ? "☆☆☆" : t("locked");
        button.setAttribute("aria-label", t("ariaCase", { n: id, title: t(`case${id}_title`) }));
        button.addEventListener("click", () => {
          actions.openCase(id);
          closeDrawer();
        });
        grid.appendChild(button);
      }
      group.appendChild(grid);
      refs.caseGroups.appendChild(group);
    }
  }

  function openDrawer() {
    renderDrawer();
    refs.drawer.hidden = false;
    actions.onDrawer?.(true);
  }

  function closeDrawer() {
    refs.drawer.hidden = true;
    actions.onDrawer?.(false);
  }

  function openHelp() {
    refs.help.hidden = false;
  }

  function closeHelp() {
    refs.help.hidden = true;
  }

  function openPause() {
    refs.pause.hidden = false;
  }

  function closePause() {
    refs.pause.hidden = true;
  }

  // ------------------------------------------------------------ 结算与提示

  function showResult(payload) {
    refs.resultTime.textContent = payload.time;
    refs.resultMistakes.textContent = String(payload.mistakes);
    refs.resultRank.textContent = t(payload.stars === 3 ? "rank3" : payload.stars === 2 ? "rank2" : "rank1");
    refs.resultCase.textContent = `${starText(payload.stars)} · ${t(`case${payload.caseId}_title`)}`;
    refs.resultNext.disabled = !payload.hasNext;
    refs.result.hidden = false;
  }

  function hideResult() {
    refs.result.hidden = true;
  }

  function toast(message, tone = "info") {
    if (!refs.toast) return;
    refs.toast.textContent = message;
    refs.toast.dataset.tone = tone;
    refs.toast.hidden = false;
    if (toastTimer && typeof clearTimeout === "function") clearTimeout(toastTimer);
    if (typeof setTimeout === "function") {
      toastTimer = setTimeout(() => {
        refs.toast.hidden = true;
      }, 2400);
    }
  }

  function setLocale(next) {
    locale = next === "en" ? "en" : "zh";
    document.documentElement.lang = locale === "en" ? "en" : "zh-CN";
    document.title = t("docTitle");
    if (refs.btnLang) refs.btnLang.textContent = t("langSwitch");
    for (const node of document.querySelectorAll("[data-i18n]")) {
      const key = node.getAttribute("data-i18n");
      const value = t(key);
      if (value !== key) node.textContent = value;
    }
    for (const node of document.querySelectorAll("[data-i18n-aria]")) {
      const key = node.getAttribute("data-i18n-aria");
      const value = t(key);
      if (value !== key) node.setAttribute("aria-label", value);
    }
    if (current) sync(current);
    if (refs.result.hidden === false && current?.result) showResult(current.result);
  }

  function setSound(on) {
    if (!refs.btnSound) return;
    refs.btnSound.dataset.on = String(on);
    refs.btnSound.textContent = on ? "♪" : "✕";
    refs.btnSound.setAttribute("aria-pressed", String(on));
  }

  function setHeld(kind) {
    heldStamp = kind === STAMP.GUILTY ? STAMP.GUILTY : STAMP.CLEAR;
    syncHeldTools();
  }

  function bindStatic() {
    refs.btnCases?.addEventListener("click", openDrawer);
    refs.drawerClose?.addEventListener("click", closeDrawer);
    refs.btnHelp?.addEventListener("click", openHelp);
    refs.helpClose?.addEventListener("click", closeHelp);
    refs.pauseResume?.addEventListener("click", () => actions.resume());
    refs.pauseReset?.addEventListener("click", () => {
      closePause();
      actions.reset();
    });
    refs.btnReset?.addEventListener("click", () => actions.reset());
    refs.btnPause?.addEventListener("click", () => actions.pauseToggle());
    refs.btnLang?.addEventListener("click", () => actions.toggleLocale());
    refs.btnSound?.addEventListener("click", () => actions.toggleSound());
    refs.sealBtn?.addEventListener("click", () => actions.seal());
    refs.slotWeapon?.addEventListener("click", () => openPicker("weapon"));
    refs.slotClue?.addEventListener("click", () => openPicker("clue"));
    refs.pickerClose?.addEventListener("click", closePicker);
    refs.inspectClose?.addEventListener("click", closeInspector);
    refs.inspectPick?.addEventListener("click", () => {
      if (inspecting) actions.pickClue(inspecting);
      closeInspector();
    });
    refs.resultNext?.addEventListener("click", () => {
      hideResult();
      actions.nextCase();
    });
    refs.resultCases?.addEventListener("click", () => {
      hideResult();
      openDrawer();
    });
    for (const tool of refs.stampTools) {
      tool.addEventListener("click", () => {
        setHeld(tool.dataset.stamp);
        actions.onPickStamp?.(heldStamp);
      });
    }
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".suspect")) clearInsight();
      if (!event.target.closest("#inspector") && !event.target.closest(".tag") && !event.target.closest(".chip")) {
        if (inspecting && !event.target.closest("#inspector")) closeInspector();
      }
      if (!event.target.closest("#picker") && !event.target.closest(".seal-slot")) {
        if (pickerMode) closePicker();
      }
    });
  }

  bindStatic();

  return {
    sync,
    setLocale,
    setSound,
    setHeld,
    updateClock(elapsed) {
      if (refs.watchTime) refs.watchTime.textContent = formatDuration(elapsed);
    },
    toast,
    showResult,
    hideResult,
    openDrawer,
    closeDrawer,
    openHelp,
    closeHelp,
    openPause,
    closePause,
    renderDrawer,
    get heldStamp() {
      return heldStamp;
    },
    get drawerOpen() {
      return !refs.drawer.hidden;
    },
    get helpOpen() {
      return !refs.help.hidden;
    },
    get pauseOpen() {
      return !refs.pause.hidden;
    },
    get resultOpen() {
      return !refs.result.hidden;
    },
    get inspectorOpen() {
      return !refs.inspector.hidden;
    },
    closeAll() {
      closeInspector();
      closePicker();
      closeDrawer();
      closeHelp();
      closePause();
      hideResult();
    },
  };
}
