// ui.mjs — 唯一碰 DOM 的层：HUD、车库、浮层、locale。不持有规则状态。

import { format } from "./i18n.mjs";
import { BIKES, BRAWL_COUNT, GETAWAY_COUNT, LEAGUE_COUNT, raceSpec } from "./levels.mjs";
import { computePlace, nearestTarget, playerOf } from "./engine.mjs";
import { isBrawlUnlocked, isGetawayUnlocked, isLeagueUnlocked } from "./storage.mjs";

const BIKE_NAME = ["bikeRat", "bikeStreet", "bikeSport", "bikeSunset"];
const TIER_NAME = ["tierRats", "tierStreet", "tierGang", "tierSunset"];
const TRACK_NAME = ["trackCoast", "trackDesert", "trackMountain", "trackCity", "trackCanyon"];

export function createUI(handlers = {}) {
  const el = (id) => document.getElementById(id);
  const dom = {
    backText: el("back-text"),
    appTitleMain: el("app-title-main"),
    appSubtitle: el("app-subtitle"),
    btnSound: el("btn-sound"),
    btnLang: el("btn-lang"),
    btnHelp: el("btn-help"),
    modeChips: [...document.querySelectorAll(".mode-chip")],
    valSpeed: el("val-speed"),
    valPlace: el("val-place"),
    valCash: el("val-cash"),
    valKo: el("val-ko"),
    barStamina: el("bar-stamina"),
    barBike: el("bar-bike"),
    barRival: el("bar-rival"),
    valRival: el("val-rival"),
    valWeapon: el("val-weapon"),
    valAlert: el("val-alert"),
    valQuota: el("val-quota"),
    labelSpeed: el("label-speed"),
    labelPlace: el("label-place"),
    labelStamina: el("label-stamina"),
    labelBike: el("label-bike"),
    labelCash: el("label-cash"),
    labelKo: el("label-ko"),
    labelRival: el("label-rival"),
    labelWeapon: el("label-weapon"),
    labelAlert: el("label-alert"),
    labelQuota: el("label-quota"),
    keyHint: el("key-hint"),
    labelCruise: el("label-cruise"),
    chkCruise: el("chk-cruise"),
    toast: el("toast"),
    garage: el("panel-garage"),
    pause: el("panel-pause"),
    result: el("panel-result"),
    help: el("panel-help"),
    garageKicker: el("garage-kicker"),
    garageTitle: el("garage-title"),
    garageDesc: el("garage-desc"),
    garageBikesTitle: el("garage-bikes-title"),
    garageRacesTitle: el("garage-races-title"),
    bikeShelf: el("bike-shelf"),
    raceGrid: el("race-grid"),
    trophyLine: el("trophy-line"),
    pauseTitle: el("pause-title"),
    pauseDesc: el("pause-desc"),
    btnResume: el("btn-resume"),
    btnRetryPause: el("btn-retry-pause"),
    btnGaragePause: el("btn-garage-pause"),
    resultTitle: el("result-title"),
    resultStars: [...el("result-stars").querySelectorAll(".star")],
    resPlace: el("res-place"),
    resKo: el("res-ko"),
    resCash: el("res-cash"),
    resTime: el("res-time"),
    resCrashes: el("res-crashes"),
    resFly: el("res-fly"),
    labelResPlace: el("label-res-place"),
    labelResKo: el("label-res-ko"),
    labelResCash: el("label-res-cash"),
    labelResTime: el("label-res-time"),
    labelResCrashes: el("label-res-crashes"),
    labelResFly: el("label-res-fly"),
    resultHint: el("result-hint"),
    btnRetry: el("btn-retry"),
    btnNext: el("btn-next"),
    btnGarage: el("btn-garage"),
    helpTitle: el("help-title"),
    helpClose: el("btn-help-close"),
    padAccel: el("pad-accel"),
    padBrake: el("pad-brake"),
    padLeft: el("pad-left"),
    padRight: el("pad-right"),
    padPunch: el("pad-punch"),
    padKick: el("pad-kick"),
    padPause: el("pad-pause"),
    padAccelLabel: el("pad-accel-label"),
    padBrakeLabel: el("pad-brake-label"),
    padLeftLabel: el("pad-left-label"),
    padRightLabel: el("pad-right-label"),
    padPunchLabel: el("pad-punch-label"),
    padKickLabel: el("pad-kick-label"),
    padPauseLabel: el("pad-pause-label"),
  };

  let t = {};
  let toastTimer = 0;

  function open(id, on) {
    const node = dom[id];
    if (!node) return;
    node.classList.toggle("is-open", !!on);
  }

  function bump(node) {
    if (!node) return;
    node.classList.remove("is-bump");
    void node.offsetWidth;
    node.classList.add("is-bump");
  }

  function toast(msg) {
    if (!msg) return;
    dom.toast.textContent = msg;
    dom.toast.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dom.toast.classList.remove("is-on"), 1400);
  }

  function applyLocale(dict) {
    t = dict;
    document.title = t.docTitle;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", t.metaDesc);
    document.documentElement.lang = document.documentElement.lang;
    dom.backText.textContent = t.back;
    dom.appTitleMain.textContent = t.appTitle;
    dom.appSubtitle.textContent = t.appSubtitle;
    dom.btnLang.textContent = t.langSwitch;
    dom.labelSpeed.textContent = t.hudSpeed;
    dom.labelPlace.textContent = t.hudPlace;
    dom.labelStamina.textContent = t.hudStamina;
    dom.labelBike.textContent = t.hudBike;
    dom.labelCash.textContent = t.hudCash;
    dom.labelKo.textContent = t.hudKo;
    dom.labelRival.textContent = t.hudRival;
    dom.labelWeapon.textContent = t.hudWeapon;
    dom.labelAlert.textContent = t.hudAlert;
    dom.labelQuota.textContent = t.hudQuota;
    dom.keyHint.textContent = t.keyHint;
    dom.labelCruise.textContent = t.hudCruise;
    el("mode-league").textContent = t.modeLeague;
    el("mode-brawl").textContent = t.modeBrawl;
    el("mode-getaway").textContent = t.modeGetaway;
    dom.garageKicker.textContent = t.garageKicker;
    dom.garageTitle.textContent = t.garageTitle;
    dom.garageDesc.textContent = t.garageDesc;
    dom.garageBikesTitle.textContent = t.garageBikes;
    dom.garageRacesTitle.textContent = t.garageRaces;
    dom.pauseTitle.textContent = t.pauseTitle;
    dom.pauseDesc.textContent = t.pauseDesc;
    dom.btnResume.textContent = t.btnResume;
    dom.btnRetryPause.textContent = t.btnRetry;
    dom.btnGaragePause.textContent = t.btnGarage;
    dom.labelResPlace.textContent = t.resultPlace;
    dom.labelResKo.textContent = t.resultKo;
    dom.labelResCash.textContent = t.resultCash;
    dom.labelResTime.textContent = t.resultTime;
    dom.labelResCrashes.textContent = t.resultCrashes;
    dom.labelResFly.textContent = t.resultFly;
    dom.btnRetry.textContent = t.btnAgain;
    dom.btnNext.textContent = t.btnNext;
    dom.btnGarage.textContent = t.btnGarage;
    dom.helpTitle.textContent = t.helpTitle;
    for (let i = 1; i <= 6; i += 1) {
      const n = el(`help${i}`);
      if (n) n.textContent = t[`help${i}`];
    }
    dom.helpClose.textContent = t.helpClose;
    if (dom.padAccelLabel) dom.padAccelLabel.textContent = t.padAccel;
    if (dom.padBrakeLabel) dom.padBrakeLabel.textContent = t.padBrake;
    if (dom.padLeftLabel) dom.padLeftLabel.textContent = t.padLeft;
    if (dom.padRightLabel) dom.padRightLabel.textContent = t.padRight;
    if (dom.padPunchLabel) dom.padPunchLabel.textContent = t.padPunch;
    if (dom.padKickLabel) dom.padKickLabel.textContent = t.padKick;
    if (dom.padPauseLabel) dom.padPauseLabel.textContent = t.btnPause;
    const canvas = el("stage-canvas");
    if (canvas) canvas.setAttribute("aria-label", t.canvasAria);
  }

  function setSound(on) {
    dom.btnSound.setAttribute("aria-pressed", on ? "true" : "false");
    dom.btnSound.querySelector(".bar-glyph").textContent = on ? "🔊" : "🔇";
  }

  function setMode(mode) {
    for (const chip of dom.modeChips) {
      const on = chip.dataset.mode === mode;
      chip.classList.toggle("is-active", on);
      chip.setAttribute("aria-selected", on ? "true" : "false");
    }
  }

  function setCruise(on) {
    dom.chkCruise.checked = !!on;
  }

  function renderGarage(data, game) {
    const p = data.progress;
    dom.bikeShelf.innerHTML = "";
    BIKES.forEach((bike) => {
      const owned = p.owned.includes(bike.id);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bike-card";
      if (game.bikeId === bike.id) btn.classList.add("is-on");
      btn.innerHTML = `<span class="bike-name">${t[BIKE_NAME[bike.id]]}</span>
        <span>${owned ? t.btnOwned : bike.cost ? format(t.bikeCost, { n: bike.cost }) : t.bikeFree}</span>
        <span>${format(t.statSpeed, { n: bike.maxSpeed })}</span>`;
      btn.addEventListener("click", () => handlers.pickBike?.(bike.id, owned));
      dom.bikeShelf.appendChild(btn);
    });

    const count = game.mode === "brawl" ? BRAWL_COUNT : game.mode === "getaway" ? GETAWAY_COUNT : LEAGUE_COUNT;
    const stars = game.mode === "brawl" ? p.brawlStars : game.mode === "getaway" ? p.getawayStars : p.leagueStars;
    dom.raceGrid.innerHTML = "";
    for (let i = 0; i < count; i += 1) {
      const spec = raceSpec(game.mode, i);
      const unlocked =
        game.mode === "brawl" ? isBrawlUnlocked(data, i) : game.mode === "getaway" ? isGetawayUnlocked(data, i) : isLeagueUnlocked(data, i);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "race-card";
      if (!unlocked) btn.classList.add("is-locked");
      if (game.raceId === i) btn.classList.add("is-on");
      const title =
        game.mode === "league"
          ? `${t[TIER_NAME[spec.tier]]} · ${t[TRACK_NAME[spec.trackIndex]]}`
          : t[TRACK_NAME[spec.trackIndex]];
      const sub =
        game.mode === "brawl"
          ? format(t.raceQuota, { n: spec.quota })
          : game.mode === "getaway"
            ? t.raceEscape
            : spec.qualify === 1
              ? t.raceMustFirst
              : format(t.raceQualify, { n: spec.qualify });
      const st = "★".repeat(stars[i] || 0) + "☆".repeat(3 - (stars[i] || 0));
      btn.innerHTML = `<span class="bike-name">${title}</span><span>${sub}</span><span class="star-row">${st}</span>`;
      btn.addEventListener("click", () => handlers.pickRace?.(i, unlocked));
      dom.raceGrid.appendChild(btn);
    }
    dom.trophyLine.textContent = `${format(t.trophyKo, { n: p.knockouts })} · ${format(t.trophyFly, { n: Math.round(p.farthestFly) })} · ${format(t.trophyPerfect, { n: p.leaguePerfect })}`;
    dom.valCash.textContent = format(t.cashValue, { n: p.cash });
  }

  function syncRace(race, data) {
    if (!race) return;
    const player = playerOf(race);
    const kmh = Math.round(player.speed * 3.6);
    if (dom.valSpeed.textContent !== String(kmh)) {
      dom.valSpeed.textContent = format(t.speedValue, { n: kmh });
      if (kmh > 80) bump(dom.valSpeed);
    }
    const place = computePlace(race, player);
    const placeText = format(t.placeValue, { n: place });
    if (dom.valPlace.textContent !== placeText) {
      dom.valPlace.textContent = placeText;
      bump(dom.valPlace);
    }
    dom.barStamina.style.transform = `scaleX(${Math.max(0, player.stamina / 100)})`;
    dom.barBike.style.transform = `scaleX(${Math.max(0, player.bikeHp / Math.max(1, player.maxHp))})`;
    dom.valKo.textContent = format(t.koValue, { n: race.stats.knockouts });
    dom.valCash.textContent = format(t.cashValue, { n: data.progress.cash });
    const rival = nearestTarget(race, player, 16, 1.2);
    if (rival) {
      dom.barRival.style.transform = `scaleX(${Math.max(0, rival.stamina / 100)})`;
      dom.valRival.textContent = rival.kind === "cop" ? t.alertHot : rival.weapon === "club" ? t.weaponClub : t.hudRival;
    } else {
      dom.barRival.style.transform = "scaleX(0)";
      dom.valRival.textContent = t.rivalNone;
    }
    dom.valWeapon.textContent = player.weapon === "club" ? t.weaponClub : t.weaponFist;
    const alert = race.stats.bust > 0.4 || race.riders.some((r) => r.kind === "cop" && !r.wrecked);
    dom.valAlert.textContent = race.stats.bust > 0.7 ? t.alertHot : alert ? t.alertWatch : t.alertQuiet;
    if (race.mode === "brawl") dom.valQuota.textContent = format(t.quotaValue, { n: race.stats.knockouts, need: race.spec.quota });
    else if (race.mode === "getaway") dom.valQuota.textContent = `${Math.round(race.stats.bust * 100)}%`;
    else dom.valQuota.textContent = format(t.placeValue, { n: place });
  }

  function showResult(result) {
    open("result", true);
    open("pause", false);
    open("garage", false);
    dom.resultTitle.textContent = result.won ? t.resultWin : t.resultLose;
    dom.resultStars.forEach((n, i) => n.classList.toggle("is-on", i < (result.stars || 0)));
    dom.resPlace.textContent = format(t.placeValue, { n: result.place || "—" });
    dom.resKo.textContent = String(result.knockouts || 0);
    dom.resCash.textContent = format(t.cashValue, { n: result.cash || 0 });
    dom.resTime.textContent = `${(result.time || 0).toFixed(1)}s`;
    dom.resCrashes.textContent = String(result.crashes || 0);
    dom.resFly.textContent = `${Math.round(result.farthestFly || 0)}`;
    const reasonKey = {
      qualify: "reasonQualify",
      place: "reasonPlace",
      quota: "reasonQuota",
      "quota-fail": "reasonQuotaFail",
      escape: "reasonEscape",
      wrecked: "reasonWrecked",
      busted: "reasonBusted",
    }[result.reason];
    const hint = result.mode === "brawl" ? t.starHintBrawl : result.mode === "getaway" ? t.starHintGetaway : t.starHintLeague;
    dom.resultHint.textContent = `${reasonKey ? t[reasonKey] + " · " : ""}${hint}`;
    dom.btnNext.hidden = !result.won;
  }

  function bind() {
    el("back-home");
    dom.btnSound.addEventListener("click", () => handlers.toggleSound?.());
    dom.btnLang.addEventListener("click", () => handlers.toggleLang?.());
    dom.btnHelp.addEventListener("click", () => handlers.toggleHelp?.());
    dom.helpClose.addEventListener("click", () => handlers.closeHelp?.());
    dom.btnResume.addEventListener("click", () => handlers.resume?.());
    dom.btnRetry.addEventListener("click", () => handlers.retry?.());
    dom.btnRetryPause.addEventListener("click", () => handlers.retry?.());
    dom.btnNext.addEventListener("click", () => handlers.next?.());
    dom.btnGarage.addEventListener("click", () => handlers.garage?.());
    dom.btnGaragePause.addEventListener("click", () => handlers.garage?.());
    dom.chkCruise.addEventListener("change", () => handlers.setCruise?.(dom.chkCruise.checked));
    for (const chip of dom.modeChips) {
      chip.addEventListener("click", () => handlers.setMode?.(chip.dataset.mode));
    }
    const hold = (node, on, off) => {
      if (!node) return;
      const start = (ev) => {
        ev.preventDefault();
        on();
      };
      const end = (ev) => {
        ev.preventDefault();
        off();
      };
      node.addEventListener("pointerdown", start);
      node.addEventListener("pointerup", end);
      node.addEventListener("pointerleave", end);
      node.addEventListener("pointercancel", end);
    };
    hold(dom.padAccel, () => handlers.hold?.("accel", true), () => handlers.hold?.("accel", false));
    hold(dom.padBrake, () => handlers.hold?.("brake", true), () => handlers.hold?.("brake", false));
    hold(dom.padLeft, () => handlers.hold?.("left", true), () => handlers.hold?.("left", false));
    hold(dom.padRight, () => handlers.hold?.("right", true), () => handlers.hold?.("right", false));
    dom.padPunch.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      handlers.punch?.();
    });
    dom.padKick.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      handlers.kick?.();
    });
    dom.padPause.addEventListener("click", () => handlers.pause?.());
    el("stage-canvas").addEventListener("pointerdown", (ev) => {
      if (ev.button === 0) handlers.punch?.();
    });
  }

  bind();

  return {
    applyLocale,
    setSound,
    setMode,
    setCruise,
    renderGarage,
    syncRace,
    showResult,
    toast,
    openGarage: () => {
      open("garage", true);
      open("result", false);
      open("pause", false);
    },
    closeGarage: () => open("garage", false),
    openPause: () => open("pause", true),
    closePause: () => open("pause", false),
    closeResult: () => open("result", false),
    openHelp: () => open("help", true),
    closeHelp: () => open("help", false),
    isHelpOpen: () => dom.help.classList.contains("is-open"),
  };
}
