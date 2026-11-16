// Volley Bombard — the only layer allowed to touch DOM/Canvas.
// Renders game state into the sand-table DOM, draws trajectories and
// explosion particles on the fx canvas, and plays matched audio cues.

import * as E from "./engine.mjs";
import * as Audio from "./audio.mjs";
import { t } from "./i18n.mjs";

const WORLD = E.WORLD;

const $ = (sel, root = document) => root.querySelector(sel);

export function createUi({ game, onIntent } = {}) {
  const el = {};
  let lang = "zh";
  let canvas = null;
  let ctx = null;
  let blockEls = new Map(); // id -> element
  let lastBlockSig = "";
  let shellEls = new Map(); // id -> element
  let bannerTimer = null;
  let toastTimer = null;
  let trail = []; // {x,y,life}
  let particles = [];
  let mode = { mode: "2p", aiLevel: "veteran", terrain: "hill" };

  function init() {
    el.backHome = $("#back-home");
    el.tabletop = $("#tabletop");
    el.sky = $("#sky");
    el.hill = $("#hill");
    el.blocksLayer = $("#blocks-layer");
    el.shellsLayer = $("#shells-layer");
    el.canvas = $("#fx-canvas");
    el.banner = $("#banner");
    el.bannerText = $("#banner-text");
    el.toast = $("#toast");
    el.turnGuide = $("#turn-guide");
    el.turnGuideText = $("#turn-guide-text");
    el.floatsLayer = $("#floats-layer");
    el.barrels = [$("#barrel-0"), $("#barrel-1")];
    el.powerBoxes = [$("#power-box-0"), $("#power-box-1")];
    el.weaponDescs = [$("#weapon-desc-0"), $("#weapon-desc-1")];
    el.windMark = $("#wind-flag-mark");
    el.windValue = $("#wind-value");
    el.chipRound = $("#chip-round");
    el.turnDots = [$("#turn-0"), $("#turn-1")];
    el.consoles = [$(".console-side.west"), $(".console-side.east")];
    el.angles = [$("#angle-0"), $("#angle-1")];
    el.powers = [$("#power-0"), $("#power-1")];
    el.powerFills = [$("#power-fill-0"), $("#power-fill-1")];
    el.weaponRows = [$("#weapons-0"), $("#weapons-1")];
    el.fireBtns = [$("#btn-fire-0"), $("#btn-fire-1")];
    el.blocks = [$("#p1-blocks"), $("#p2-blocks")];
    el.shots = [$("#p1-shots"), $("#p2-shots")];
    el.hits = [$("#p1-hits"), $("#p2-hits")];
    el.bests = [$("#p1-best"), $("#p2-best")];
    el.scores = [$("#score-p1"), $("#score-p2")];
    el.tags = [$("#tag-p1"), $("#tag-p2")];
    el.ovHelp = $("#ov-help");
    el.ovPause = $("#ov-pause");
    el.ovMode = $("#ov-mode");
    el.ovResult = $("#ov-result");
    el.btnPause = $("#btn-pause");
    el.btnSound = $("#btn-sound");
    el.btnLang = $("#btn-lang");
    el.btnMode = $("#btn-mode");
    el.btnHelp = $("#btn-help");
    el.btnResume = $("#btn-resume");
    el.btnRestart = $("#btn-restart");
    el.btnPauseMode = $("#btn-pause-mode");
    el.seg2p = $("#seg-mode-2p");
    el.segAi = $("#seg-mode-ai");
    el.segAiLevel = $("#seg-ai");
    el.segTerrain = $("#seg-terrain");
    el.btnApplyMode = $("#btn-apply-mode");
    el.btnResultPrimary = $("#btn-result-primary");
    el.btnResultSecondary = $("#btn-result-secondary");
    el.btnResultMode = $("#btn-result-mode");
    el.resultEyebrow = $("#result-eyebrow");
    el.resultTitle = $("#result-title");
    el.resultDetail = $("#result-detail");
    el.resultRecs = $("#result-recs");
    el.statMatches = $("#stat-matches");
    el.statP1 = $("#stat-p1");
    el.statP2 = $("#stat-p2");
    el.statHit = $("#stat-hit");
    el.statSingle = $("#stat-single");

    canvas = el.canvas;
    ctx = canvas.getContext("2d");
    buildTerrainPieces();
    buildWeaponRows();
  }

  // ---- static terrain pieces (plinth + wind flag) ----

  function buildTerrainPieces() {
    // plinths under both forts
    E.PLINTHS.forEach((p) => {
      const d = document.createElement("div");
      d.className = "plinth";
      d.style.left = pctX((p.x0 + p.x1) / 2 - (p.x1 - p.x0) / 2);
      d.style.width = pctW(p.x1 - p.x0);
      el.sky.appendChild(d);
    });
    // hilltop wind flag
    const flag = $("#windflag");
    if (flag) updateWindFlag(0, flag);
  }

  function buildWeaponRows() {
    el.weaponRows.forEach((row, side) => {
      row.innerHTML = "";
      E.WEAPON_IDS.forEach((id) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "weapon-chip";
        b.dataset.weapon = id;
        b.dataset.i18n = `weapon${cap(id)}`;
        b.setAttribute("role", "radio");
        b.addEventListener("click", () => intent("weapon", { side, weapon: id }));
        row.appendChild(b);
      });
    });
  }

  function cap(s) {
    return s ? s[0].toUpperCase() + s.slice(1) : s;
  }

  // ---- coordinate mapping ----

  function pctX(x) {
    return `${(x / WORLD.w) * 100}%`;
  }
  function pctW(w) {
    return `${(w / WORLD.w) * 100}%`;
  }
  function pctY(y) {
    return `${(1 - y / WORLD.h) * 100}%`;
  }
  function pctH(h) {
    return `${(h / WORLD.h) * 100}%`;
  }

  // ---- full match render ----

  function renderMatch(view) {
    if (!view) return;
    // blocks：签名不变就不重建 DOM，避免拖动瞄准时每帧重建 30 个节点
    const raw = game.raw;
    const sig = raw.blocks.map((b) => `${b.id}:${b.hp}:${b.x}:${b.y}`).join("|");
    if (sig !== lastBlockSig) {
      lastBlockSig = sig;
      el.blocksLayer.innerHTML = "";
      blockEls.clear();
      raw.blocks.forEach((b) => {
        if (b.hp <= 0) return;
        const d = document.createElement("div");
        d.className = `block ${b.side === 0 ? "west" : "east"}`;
        d.style.left = pctX(b.x);
        d.style.bottom = pctY(b.y + E.BLOCK_H);
        d.style.width = pctW(E.BLOCK_W);
        d.style.height = pctH(E.BLOCK_H);
        if (b.hp < E.BLOCK_HP) d.classList.add(b.hp <= 8 ? "hurt2" : "hurt1");
        el.blocksLayer.appendChild(d);
        blockEls.set(b.id, d);
      });
    }
    // flags
    raw.flags.forEach((f) => renderFlag(f));
    // stats
    view.players.forEach((p, i) => {
      el.blocks[i].textContent = view.blocks[i];
      el.shots[i].textContent = p.shots;
      el.hits[i].textContent = `${p.shots ? Math.round((p.hits / p.shots) * 100) : 0}%`;
      el.bests[i].textContent = p.bestDamage;
    });
    el.scores[0].textContent = view.roundWins ? view.roundWins[0] : 0;
    el.scores[1].textContent = view.roundWins ? view.roundWins[1] : 0;
    renderRound(view.round);
    renderWind(view.wind);
    renderTurn(view);
    renderConsoles(view);
    renderSegs(view);
  }

  function renderFlag(f) {
    const old = el.sky.querySelector(`.flag-pole[data-side="${f.side}"]`);
    if (old) old.remove();

    const pole = document.createElement("div");
    pole.className = "flag-pole";
    pole.dataset.side = String(f.side);
    const fortCenter = E.PLINTHS[f.side];
    pole.style.left = pctX((fortCenter.x0 + fortCenter.x1) / 2 - 2);
    pole.style.bottom = pctY(f.down ? E.PLINTH_H : f.y + E.FLAG_H);
    pole.style.height = pctH(E.FLAG_H + 8);
    const cloth = document.createElement("i");
    cloth.className = `flag-cloth ${f.side === 1 ? "east" : ""} ${f.down ? "down" : ""}`;
    cloth.style.left = "2px";
    cloth.style.bottom = pctH(E.FLAG_H - 6);
    cloth.style.width = pctW(24);
    pole.appendChild(cloth);
    el.sky.appendChild(pole);
  }

  function renderRound(round) {
    el.chipRound.textContent = t("roundLabel", lang, { n: Math.min(round, E.MAX_ROUNDS) });
  }

  function renderWind(wind) {
    el.windValue.textContent = windLabel(wind);
    const track = $("#wind-track");
    if (track) {
      const pos = 50 + (wind / (E.WIND_MAX || 5)) * 46;
      el.windMark.style.left = `${pos}%`;
    }
    updateWindFlag(wind, $("#windflag"));
  }

  function windLabel(wind) {
    if (wind === 0) return t("windNone", lang);
    return wind < 0 ? t("windLeft", lang, { n: Math.abs(wind) }) : t("windRight", lang, { n: wind });
  }

  function updateWindFlag(wind, flag) {
    if (!flag) return;
    flag.classList.toggle("dir-neg", wind < 0);
    flag.classList.toggle("str-0", wind === 0);
    flag.style.transform = `rotate(${wind * 2.4}deg)`;
    flag.style.left = "49.2%";
    flag.style.bottom = "58%";
  }

  function renderTurn(view) {
    el.turnDots.forEach((dot, i) => {
      const on = view.turn === i && view.phase !== "over";
      dot.parentElement.classList.toggle("active", on);
    });
    document.body.dataset.turn = String(view.turn);

    if (el.turnGuideText) {
      if (view.phase === "flight") {
        el.turnGuideText.textContent = t("turnGuideFlying", lang);
      } else if (view.phase === "aim") {
        if (view.mode === "ai") {
          el.turnGuideText.textContent = view.turn === 0 ? t("turnGuideWaitingAi", lang) : t("turnGuideYourTurn", lang);
        } else {
          el.turnGuideText.textContent = view.turn === 0 ? t("turnGuideP1Turn", lang) : t("turnGuideP2Turn", lang);
        }
      } else {
        el.turnGuideText.textContent = "";
      }
    }
  }

  function renderConsoles(view) {
    const raw = game.raw;
    view.players.forEach((p, i) => {
      // AI 模式下西军归 AI 操控，玩家侧控制台整体禁用，避免"点了没反应"
      const locked = view.mode === "ai" && i === 0;
      const shell = el.consoles[i];
      if (shell) {
        shell.classList.toggle("is-locked", locked);
        [...shell.querySelectorAll("button")].forEach((b) => {
          b.disabled = locked;
        });
      }
      el.angles[i].textContent = `${Math.round(p.angle)}°`;
      el.powers[i].textContent = Math.round(p.power);
      el.powerFills[i].style.width = `${Math.round(p.power)}%`;
      const row = el.weaponRows[i];
      [...row.children].forEach((chip) => {
        const mine = view.players[i].weapon === chip.dataset.weapon;
        chip.setAttribute("aria-pressed", mine ? "true" : "false");
        chip.hidden = !raw.weapons.includes(chip.dataset.weapon);
      });
      if (el.weaponDescs && el.weaponDescs[i]) {
        el.weaponDescs[i].textContent = t(`weapon${cap(p.weapon)}Desc`, lang);
      }
      if (el.barrels && el.barrels[i]) {
        const deg = i === 0 ? -p.angle : p.angle;
        el.barrels[i].style.transform = `rotate(${deg}deg)`;
      }
      el.fireBtns[i].disabled = locked || view.phase !== "aim" || view.turn !== i;
    });
  }

  function renderSegs(view) {
    if (el.seg2p) el.seg2p.setAttribute("aria-pressed", view.mode === "2p" ? "true" : "false");
    if (el.segAi) el.segAi.setAttribute("aria-pressed", view.mode === "ai" ? "true" : "false");
    if (el.segAiLevel) {
      [...el.segAiLevel.children].forEach((b) => {
        b.setAttribute("aria-pressed", b.dataset.level === view.aiLevel ? "true" : "false");
      });
    }
    if (el.segTerrain) {
      [...el.segTerrain.children].forEach((b) => {
        b.setAttribute("aria-pressed", b.dataset.terrain === view.terrain ? "true" : "false");
      });
    }
  }

  // ---- frame-level render (shells, trails, particles) ----

  function renderFrame(view) {
    const raw = game.raw;
    // shells: reconcile DOM nodes
    const seen = new Set();
    raw.shells.forEach((s) => {
      seen.add(s.id);
      let node = shellEls.get(s.id);
      if (!node) {
        node = document.createElement("div");
        node.className = "shell";
        node.dataset.weapon = s.weapon;
        el.shellsLayer.appendChild(node);
        shellEls.set(s.id, node);
        trail.length = 0;
      }
      node.style.left = pctX(s.x - E.SHELL_RADIUS);
      node.style.bottom = pctY(s.y + E.SHELL_RADIUS);
      node.style.width = pctW(E.SHELL_RADIUS * 2);
      node.style.height = pctH(E.SHELL_RADIUS * 2);
      node.classList.toggle("stuck", !!s.attached);
      trail.push({ x: s.x, y: s.y, life: 1 });
      if (trail.length > 60) trail.shift();
    });
    for (const [id, node] of shellEls) {
      if (!seen.has(id)) {
        node.remove();
        shellEls.delete(id);
      }
    }
    drawFx();
  }

  function drawFx() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Aiming trajectory preview
    const raw = game.raw;
    if (raw && raw.phase === "aim") {
      const activeSide = raw.turn;
      const isAi = mode.mode === "ai" && activeSide === 0;
      if (!isAi) {
        const pts = E.previewPath(raw, activeSide);
        if (pts && pts.length > 1) {
          ctx.save();
          const isWest = activeSide === 0;
          if (ctx.setLineDash) {
            ctx.setLineDash([5, 5]);
            ctx.lineDashOffset = -performance.now() * 0.015;
          }
          ctx.lineWidth = 2.2;
          ctx.strokeStyle = isWest ? "rgba(235, 120, 60, 0.75)" : "rgba(80, 170, 240, 0.75)";
          ctx.shadowColor = isWest ? "rgba(235, 100, 40, 0.5)" : "rgba(60, 150, 240, 0.5)";
          ctx.shadowBlur = 6;
          ctx.beginPath();
          pts.forEach((p, i) => {
            const x = (p.x / WORLD.w) * canvas.width;
            const y = (1 - p.y / WORLD.h) * canvas.height;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.stroke();

          // Reticle at landing endpoint
          const end = pts[pts.length - 1];
          const endX = (end.x / WORLD.w) * canvas.width;
          const endY = (1 - end.y / WORLD.h) * canvas.height;
          if (ctx.setLineDash) ctx.setLineDash([]);
          ctx.lineWidth = 1.8;
          ctx.strokeStyle = isWest ? "rgba(255, 180, 60, 0.9)" : "rgba(100, 200, 255, 0.9)";
          ctx.beginPath();
          ctx.arc(endX, endY, 6, 0, Math.PI * 2);
          ctx.moveTo(endX - 9, endY);
          ctx.lineTo(endX + 9, endY);
          ctx.moveTo(endX, endY - 9);
          ctx.lineTo(endX, endY + 9);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // trail
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255, 244, 214, 0.55)";
    ctx.beginPath();
    trail.forEach((p, i) => {
      const x = (p.x / WORLD.w) * canvas.width;
      const y = (1 - p.y / WORLD.h) * canvas.height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    // particles
    particles = particles.filter((p) => p.life > 0);
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy -= 300 / 60;
      p.life -= 0.03;
      ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${Math.max(p.life, 0)})`;
      const x = (p.x / WORLD.w) * canvas.width;
      const y = (1 - p.y / WORLD.h) * canvas.height;
      ctx.fillRect(x - p.s / 2, y - p.s / 2, p.s, p.s);
    });
  }

  function spawnDamageFloat(x, y, text, isCrit = false) {
    if (!el.floatsLayer) return;
    const item = document.createElement("div");
    item.className = isCrit ? "damage-float crit" : "damage-float";
    item.textContent = text;
    item.style.left = pctX(x);
    item.style.bottom = pctY(y);
    el.floatsLayer.appendChild(item);
    setTimeout(() => item.remove(), 880);
  }

  function burst(x, y, opts = {}) {
    const n = opts.n ?? 26;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (opts.speed ?? 3) * (0.4 + Math.random());
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        s: 3 + Math.random() * 3,
        r: 240 + Math.floor(Math.random() * 15),
        g: 170 + Math.floor(Math.random() * 60),
        b: 60 + Math.floor(Math.random() * 60),
        life: 0.8 + Math.random() * 0.5,
      });
    }
  }

  // ---- events from controller ----

  function handleEvents(events) {
    events.forEach((ev) => {
      switch (ev.type) {
        case "explode": {
          burst(ev.x, ev.y, { n: ev.radius > 40 ? 40 : 20 });
          Audio.play("boom");
          break;
        }
        case "fire":
          if (el.barrels && el.barrels[ev.side]) {
            el.barrels[ev.side].classList.add("recoil");
            setTimeout(() => el.barrels[ev.side].classList.remove("recoil"), 240);
          }
          break;
        case "blockDamage":
          if (ev.hp <= 0) Audio.play("thud");
          spawnDamageFloat(ev.x ?? 500, ev.y ?? 100, `-${ev.dmg || 15}`);
          break;
        case "blockDestroy":
          flashBlock(ev.id);
          spawnDamageFloat(ev.x ?? 500, ev.y ?? 100, `-${ev.dmg || 20}`, true);
          break;
        case "flagDamage":
          spawnDamageFloat(ev.x ?? 500, ev.y ?? 120, `-${ev.dmg || 20}`, true);
          break;
        case "collapse":
          Audio.play("collapse");
          break;
        case "flagDown":
          showBanner(t("bannerFlagDown", lang));
          Audio.play("flagdown");
          break;
        case "windChange":
          showBanner(t("bannerWindShift", lang));
          break;
        case "turnStart":
          showBanner(t("bannerTurn", lang, { name: playerName(ev.side) }));
          Audio.play("turn");
          break;
        case "matchOver": {
          const humanWon = mode.mode === "ai" ? ev.winner === 1 : ev.winner !== "draw";
          showResult(ev);
          Audio.play(humanWon ? "win" : "lose");
          break;
        }
        default:
          break;
      }
    });
  }

  function flashBlock(id) {
    const node = blockEls.get(id);
    if (!node) return;
    node.classList.add("destroyed");
    setTimeout(() => {
      const b = game.raw.blocks.find((x) => x.id === id);
      if (!b || b.hp <= 0) node.remove();
    }, 260);
  }

  function playerName(side) {
    // side 0 是西军：AI 模式下由 AI 操控
    if (mode.mode === "ai") return side === 0 ? t("aiLabel", lang) : t("you", lang);
    return t(side === 0 ? "player1" : "player2", lang);
  }

  function showBanner(text) {
    if (!el.banner) return;
    el.bannerText.textContent = text;
    el.banner.classList.add("show");
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.banner.classList.remove("show"), 1400);
  }

  function showToast(text) {
    if (!el.toast) return;
    el.toast.textContent = text;
    el.toast.hidden = false;
    el.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.classList.remove("show");
    }, 1800);
  }

  function showResult(ev) {
    el.resultEyebrow.textContent = ev.cause === "blocks" ? t("resultByBlocks", lang) : t("resultFlagFall", lang);
    if (ev.winner === "draw") el.resultTitle.textContent = t("resultDraw", lang);
    else if (mode.mode === "ai") el.resultTitle.textContent = t(ev.winner === 1 ? "resultWinYou" : "resultWinAi", lang);
    else el.resultTitle.textContent = t(ev.winner === 0 ? "resultWinP1" : "resultWinP2", lang);
    const [a, b] = ev.blocksStanding ?? [0, 0];
    el.resultDetail.textContent = t("resultBlocks", lang, { a, b });
    el.btnResultPrimary.textContent = t("btnRematch", lang);
    el.btnResultSecondary.textContent = t("btnChangeMode", lang);
    el.ovResult.hidden = false;
  }

  function hideResult() {
    el.ovResult.hidden = true;
  }

  function setLang(next) {
    lang = next;
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      const key = node.getAttribute("data-i18n");
      node.textContent = t(key, lang);
    });
    document.querySelectorAll("[data-i18n-attr]").forEach((node) => {
      const spec = node.getAttribute("data-i18n-attr") ?? "";
      const [attr, key] = spec.split(":");
      if (attr && key) node.setAttribute(attr, t(key, lang));
    });
    document.title = t("docTitle", lang);
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
    if (el.btnLang) el.btnLang.textContent = t("langBtn", lang);
    renderAll();
  }

  function renderAll() {
    const view = game.view();
    if (view) renderMatch(view);
  }

  function intent(type, payload = {}) {
    if (typeof onIntent === "function") onIntent(type, payload);
  }

  function openOverlay(name) {
    const map = { help: el.ovHelp, pause: el.ovPause, mode: el.ovMode };
    const node = map[name];
    if (node) node.hidden = false;
  }

  function closeOverlays() {
    [el.ovHelp, el.ovPause, el.ovMode].forEach((n) => {
      if (n) n.hidden = true;
    });
  }

  function overlayOpen() {
    return [el.ovHelp, el.ovPause, el.ovMode, el.ovResult].some((n) => n && !n.hidden);
  }

  function setPausePressed(on) {
    if (el.btnPause) el.btnPause.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function setSoundPressed(on) {
    if (el.btnSound) el.btnSound.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function setTags(view) {
    if (!view) return;
    el.tags[0].textContent = mode.mode === "ai" ? t("aiLabel", lang) : "";
    el.tags[1].textContent = mode.mode === "ai" ? t("you", lang) : "";
  }

  function setMode(m) {
    mode = { ...mode, ...m };
  }

  function getMode() {
    return { ...mode };
  }

  return {
    init,
    renderMatch,
    renderFrame,
    renderAll,
    handleEvents,
    setLang,
    showToast,
    showBanner,
    openOverlay,
    closeOverlays,
    overlayOpen,
    setPausePressed,
    setSoundPressed,
    setTags,
    setMode,
    getMode,
    hideResult,
    burst,
    el,
  };
}
