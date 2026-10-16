// Tank Assault - the only layer that touches the DOM.
// It builds one welded machine: a sunken sand tray up top, a commander console welded to
// the same chassis below, and one overlay slot for menus, briefings and after-action reports.
import { LEVELS, ENDGAMES } from "./levels.mjs";
import { MODE_CAMPAIGN, MODE_BREAKTHROUGH, MODE_LAST_STAND } from "./game.mjs";
import * as store from "./storage.mjs";
import { t, format, normalizeLang } from "./i18n.mjs";

const STATIC_IDS = ["back-home", "btn-sound", "btn-help", "game-title", "btn-lang"];

function h(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined && text !== null) el.textContent = String(text);
  return el;
}

function mmss(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export class UI {
  constructor({ root, game, renderer, audio }) {
    this.root = root;
    this.game = game;
    this.renderer = renderer;
    this.audio = audio;
    this.lang = "zh";
    this.overlay = "menu";
    this.helpReturn = "menu";
    this.i18n = []; // permanent nodes: the console, machines and static header
    this.tempI18n = []; // nodes owned by whatever overlay is on screen right now
    this.nodes = {};
    this.tape = [];
    this.build();
  }

  /* ------------------------------------------------------------------ helpers */

  tr(key, vars) {
    return vars ? format(key, this.lang, vars) : t(key, this.lang);
  }

  // Overlay content is rebuilt on every language switch, so its nodes register into a
  // second list that is thrown away when the overlay changes.
  // attr may list several targets ("title,aria-label"); all of them get the same string.
  mark(el, key, attr) {
    const list = this.building ? this.tempI18n : this.i18n;
    const attrs = attr ? String(attr).split(/[,:]/).map((s) => s.trim()).filter(Boolean) : null;
    list.push({ el, key, attr: attrs && attrs.length === 1 ? attrs[0] : null, attrs: attrs && attrs.length > 1 ? attrs : null });
    this.paint({ el, key, attr: attrs && attrs.length === 1 ? attrs[0] : null, attrs: attrs && attrs.length > 1 ? attrs : null });
    return el;
  }

  paint(item) {
    const value = this.tr(item.key);
    if (item.attrs) for (const a of item.attrs) item.el.setAttribute?.(a, value);
    else if (item.attr) item.el.setAttribute?.(item.attr, value);
    else item.el.textContent = value;
  }

  node(id, tag, cls, text) {
    const el = h(tag, cls, text);
    this.nodes[id] = el;
    return el;
  }

  button(action, labelKey, cls = "brass-btn", data = null) {
    const btn = h("button", cls);
    btn.setAttribute("type", "button");
    btn.setAttribute("data-action", action);
    this.mark(btn, labelKey);
    if (data) for (const [k, v] of Object.entries(data)) btn.setAttribute(`data-${k}`, String(v));
    btn.addEventListener("click", () => this.handle(action, data));
    return btn;
  }

  /* -------------------------------------------------------------------- build */

  build() {
    const root = this.root;
    root.replaceChildren();

    const machine = h("div", "machine");

    /* ---- sunken sand tray ---- */
    const tray = h("div", "tray");
    const frame = h("div", "tray-frame");
    const canvas = this.node("field", "canvas", "field-canvas");
    canvas.setAttribute("touch-action", "none");
    const ruler = h("div", "tray-ruler");
    for (let i = 0; i < 13; i += 1) ruler.appendChild(h("span", "tick"));
    const tapeWrap = this.node("tape", "div", "tape");
    tapeWrap.appendChild(h("div", "tape-head"));
    this.tapeList = h("div", "tape-lines");
    tapeWrap.appendChild(this.tapeList);
    frame.append(canvas, ruler);
    tray.appendChild(frame);
    machine.appendChild(tray);
    // the tape slides out from under the tray instead of covering the battlefield
    machine.appendChild(tapeWrap);

    /* ---- commander console, welded to the same chassis ---- */
    const console_ = h("div", "console");

    const readouts = h("div", "readouts");
    this.gaugeEnemy = this.gauge(readouts, "hudEnemy", "val-enemy");
    this.gaugeLives = this.gauge(readouts, "hudLives", "val-lives");
    readouts.appendChild(this.stat("hudBase", "val-base", "stat-base"));
    readouts.appendChild(this.stat("hudScore", "val-score"));
    readouts.appendChild(this.stat("hudTime", "val-time"));
    readouts.appendChild(this.stat("hudWave", "val-wave", "stat-wave"));
    readouts.appendChild(this.stat("hudAmmo", "val-ammo", "stat-ammo"));
    console_.appendChild(readouts);

    const controls = h("div", "controls");

    const dpad = h("div", "dpad");
    for (const dir of ["up", "left", "right", "down"]) {
      const key = h("button", `pad pad-${dir}`);
      key.setAttribute("type", "button");
      key.setAttribute("data-dir", dir);
      key.setAttribute("aria-label", dir);
      key.appendChild(h("span", "pad-glyph"));
      key.addEventListener("pointerdown", (ev) => {
        ev.preventDefault?.();
        this.game.move({ up: 0, right: 1, down: 2, left: 3 }[dir]);
      });
      key.addEventListener("pointerup", () => this.game.stop());
      key.addEventListener("pointerleave", () => this.game.stop());
      dpad.appendChild(key);
    }
    controls.appendChild(dpad);

    const lamps = this.node("lamps", "div", "lamps");
    this.lampEls = {};
    const LAMP_KEYS = { shield: "p_helmet", freeze: "p_clock", steelBase: "o_fortify", jam: "o_jam" };
    for (const [kind, key] of Object.entries(LAMP_KEYS)) {
      const lamp = h("div", "lamp");
      lamp.appendChild(h("span", "lamp-bulb"));
      const label = h("span", "lamp-label");
      this.mark(label, key);
      lamp.appendChild(label);
      lamps.appendChild(lamp);
      this.lampEls[kind] = lamp;
    }
    controls.appendChild(lamps);

    const fire = h("div", "fire-group");
    const orderBtn = this.node("btn-order", "button", "order-btn");
    orderBtn.setAttribute("type", "button");
    orderBtn.setAttribute("data-action", "order");
    const orderName = this.node("val-order", "span", "order-name");
    const orderCharge = h("span", "order-charge");
    this.chargeFill = h("i", "charge-fill");
    orderCharge.appendChild(this.chargeFill);
    this.node("keycap-order", "span", "keycap", "K");
    orderBtn.append(orderName, orderCharge, this.nodes["keycap-order"]);
    orderBtn.addEventListener("click", () => {
      this.audio?.play?.("click");
      this.game.order();
    });
    fire.appendChild(orderBtn);

    const fireBtn = h("button", "fire-btn");
    fireBtn.setAttribute("type", "button");
    fireBtn.setAttribute("data-action", "fire");
    fireBtn.appendChild(h("span", "fire-dot"));
    fireBtn.appendChild(this.node("keycap-fire", "span", "keycap", "SPACE"));
    fireBtn.addEventListener("pointerdown", (ev) => {
      ev?.preventDefault?.();
      this.game.fire();
    });
    fireBtn.addEventListener("click", () => this.game.fire());
    fire.appendChild(fireBtn);
    controls.appendChild(fire);

    console_.appendChild(controls);
    machine.appendChild(console_);

    root.appendChild(machine);

    this.overlayEl = this.node("overlay-layer", "div", "overlay-layer");
    this.overlayBody = h("div", "overlay-body");
    this.overlayEl.appendChild(this.overlayBody);
    root.appendChild(this.overlayEl);

    if (this.renderer) this.renderer.attach(canvas);

    this.applyStatic();
    this.showOverlay("menu");
  }

  gauge(parent, labelKey, valueId) {
    const g = h("div", "gauge");
    const dial = h("div", "gauge-dial");
    const needle = h("i", "gauge-needle");
    dial.appendChild(needle);
    const meta = h("div", "gauge-meta");
    const label = h("span", "gauge-label");
    this.mark(label, labelKey);
    const value = this.node(valueId, "span", "gauge-value", "0");
    meta.append(label, value);
    g.append(dial, meta);
    parent.appendChild(g);
    g.needle = needle;
    return g;
  }

  stat(labelKey, valueId, extra) {
    const box = h("div", `stat${extra ? ` ${extra}` : ""}`);
    const label = h("span", "stat-label");
    this.mark(label, labelKey);
    const value = this.node(valueId, "span", "stat-value", "--");
    box.append(label, value);
    return box;
  }

  applyStatic() {
    for (const id of STATIC_IDS) {
      const el = document.getElementById(id);
      if (!el) continue;
      const key = el.getAttribute("data-i18n");
      if (!key) continue;
    const attr = el.getAttribute("data-i18n-attr");
    this.mark(el, key, attr);
  }
  }

  /* ------------------------------------------------------------------ language */

  setLang(lang) {
    this.lang = normalizeLang(lang);
    for (const item of this.i18n.concat(this.tempI18n)) this.paint(item);
    document.documentElement?.setAttribute?.("lang", this.lang === "en" ? "en" : "zh-CN");
    // the tab title and the crawler blurb follow the language too, otherwise the
    // browser chrome stays Chinese while the whole page reads English
    document.title = this.tr("docTitle");
    document.querySelector?.('meta[name="description"]')?.setAttribute?.("content", this.tr("docDesc"));
    this.repaintTape();
    if (this.overlay !== "none") this.renderOverlay();
    this.updateHud();
    return this.lang;
  }

  /* ------------------------------------------------------------------ overlays */

  isOverlayOpen() {
    return !this.overlayEl.classList.contains("hidden");
  }

  showOverlay(name) {
    this.overlay = name;
    if (name === "none") {
      this.overlayEl.classList.add("hidden");
      this.game.setPaused(false);
      return;
    }
    this.renderOverlay();
    this.overlayEl.classList.remove("hidden");
    this.game.setPaused(true);
  }

  closeOverlay() {
    this.showOverlay("none");
  }

  showPlay() {
    this.showOverlay("none");
    this.updateHud();
  }

  showMenu() {
    this.showOverlay("menu");
  }

  showCampaign() {
    this.showOverlay("campaign");
  }

  showPuzzle() {
    this.showOverlay("puzzle");
  }

  showPause() {
    this.showOverlay("pause");
  }

  // The briefing borrows the screen: closing it returns exactly where you came from.
  showHelp() {
    if (this.overlay !== "help") this.helpReturn = this.overlay === "none" ? "none" : this.overlay;
    this.showOverlay("help");
  }

  showResult(result) {
    this.result = result;
    this.showOverlay("result");
  }

  renderOverlay() {
    const body = this.overlayBody;
    body.replaceChildren();
    this.building = true;
    this.tempI18n = [];
    switch (this.overlay) {
      case "menu":
        this.renderMenu(body);
        break;
      case "campaign":
        this.renderCampaign(body);
        break;
      case "puzzle":
        this.renderPuzzle(body);
        break;
      case "pause":
        this.renderPause(body);
        break;
      case "result":
        this.renderResult(body);
        break;
      case "help":
        this.renderHelp(body);
        break;
      default:
        break;
    }
    this.building = false;
  }

  panel(titleKey, subtitleKey) {
    const card = h("div", "panel");
    const head = h("div", "panel-head");
    const title = h("h2", "panel-title");
    this.mark(title, titleKey);
    head.appendChild(title);
    if (subtitleKey) {
      const sub = h("p", "panel-sub");
      this.mark(sub, subtitleKey);
      head.appendChild(sub);
    }
    card.appendChild(head);
    return card;
  }

  renderMenu(body) {
    const card = this.panel("menuTitle", "menuHint");
    const list = h("div", "mode-list");

    const modes = [
      { action: "campaign", key: "modeCampaign", sub: "modeCampaignSub", cls: "mode-campaign" },
      { action: "siege", key: "modeSiege", sub: "modeSiegeSub", cls: "mode-siege" },
      { action: "puzzle", key: "modePuzzle", sub: "modePuzzleSub", cls: "mode-puzzle" },
    ];
    for (const m of modes) {
      const btn = h("button", `mode-card ${m.cls}`);
      btn.setAttribute("type", "button");
      btn.setAttribute("data-action", m.action);
      const name = h("span", "mode-name");
      this.mark(name, m.key);
      const sub = h("span", "mode-sub");
      this.mark(sub, m.sub);
      btn.append(name, sub);
      btn.addEventListener("click", () => this.handle(m.action));
      list.appendChild(btn);
    }
    card.appendChild(list);

    const rec = this.game.data.records;
    const grid = h("div", "record-grid");
    grid.appendChild(this.record("recStars", `${rec.stars}/${LEVELS.length * 3}`));
    grid.appendChild(this.record("recCleared", `${rec.cleared}/${LEVELS.length}`));
    grid.appendChild(this.record("recWave", String(rec.bestWave)));
    grid.appendChild(this.record("recHold", mmss(rec.bestHold)));
    grid.appendChild(this.record("recKills", String(rec.kills)));
    grid.appendChild(this.record("recRicochet", String(rec.ricochets)));
    grid.appendChild(this.record("recCombo", String(rec.maxCombo)));
    grid.appendChild(this.record("recAcc", `${Math.round(store.accuracy(this.game.data) * 100)}%`));
    card.appendChild(grid);

    const foot = h("div", "panel-foot");
    foot.appendChild(this.button("help", "btnHelp", "brass-btn ghost"));
    const hint = h("button", "toggle-btn");
    hint.setAttribute("type", "button");
    hint.setAttribute("data-action", "hints");
    const hintLabel = h("span");
    this.mark(hintLabel, "assistLabel");
    const hintState = this.node("val-hints", "span", "toggle-state");
    hintState.textContent = this.game.data.hints ? this.tr("assistOn") : this.tr("assistOff");
    hint.classList.toggle("on", Boolean(this.game.data.hints));
    hint.append(hintLabel, hintState);
    hint.addEventListener("click", () => this.handle("hints"));
    foot.appendChild(hint);
    card.appendChild(foot);

    body.appendChild(card);
  }

  record(labelKey, value) {
    const box = h("div", "record");
    const label = h("span", "record-label");
    this.mark(label, labelKey);
    const val = h("span", "record-value", value);
    box.append(label, val);
    return box;
  }

  renderCampaign(body) {
    const card = this.panel("modeCampaign", "modeCampaignSub");
    const data = this.game.data;
    for (let ch = 1; ch <= 6; ch += 1) {
      const chapter = h("div", "chapter");
      const head = h("div", "chapter-head");
      const name = h("h3", "chapter-name");
      this.mark(name, `chapter_${ch}`);
      head.appendChild(name);
      if (data.medals[String(ch)]) {
        const medal = h("span", "medal");
        medal.setAttribute("title", "medal");
        head.appendChild(medal);
      }
      chapter.appendChild(head);

      const row = h("div", "stage-row");
      const stages = LEVELS.filter((lv) => lv.chapter === ch);
      for (let i = 0; i < stages.length; i += 1) {
        const lv = stages[i];
        const globalIdx = LEVELS.indexOf(lv);
        const unlocked = globalIdx < data.campaignUnlocked;
        const entry = data.campaign[lv.id];
        const btn = h("button", `stage-btn${unlocked ? "" : " locked"}${entry ? " done" : ""}`);
        btn.setAttribute("type", "button");
        btn.setAttribute("data-action", "play");
        btn.setAttribute("data-mode", MODE_CAMPAIGN);
        btn.setAttribute("data-index", String(globalIdx));
        btn.disabled = !unlocked;
        const num = h("span", "stage-num", String(i + 1));
        const stars = h("span", "stage-stars");
        for (let s = 0; s < 3; s += 1) {
          const pip = h("i", `pip${entry && s < entry.stars ? " on" : ""}`);
          stars.appendChild(pip);
        }
        btn.append(num, stars);
        if (lv.fortress) btn.appendChild(h("span", "stage-tag"));
        btn.addEventListener("click", () => {
          if (!unlocked) return;
          this.handle("play", { mode: MODE_CAMPAIGN, index: globalIdx });
        });
        row.appendChild(btn);
      }
      chapter.appendChild(row);
      card.appendChild(chapter);
    }
    const foot = h("div", "panel-foot");
    foot.appendChild(this.button("menu", "btnMenu", "brass-btn ghost"));
    card.appendChild(foot);
    body.appendChild(card);
  }

  renderPuzzle(body) {
    const card = this.panel("modePuzzle", "modePuzzleSub");
    const data = this.game.data;
    const row = h("div", "puzzle-grid");
    ENDGAMES.forEach((lv, i) => {
      const unlocked = i < data.endgameUnlocked;
      const entry = data.endgames[lv.id];
      const btn = h("button", `puzzle-btn${unlocked ? "" : " locked"}${entry?.cleared ? " done" : ""}`);
      btn.setAttribute("type", "button");
      btn.setAttribute("data-action", "play");
      btn.disabled = !unlocked;
      const num = h("span", "puzzle-num");
      this.mark(num, "puzzle", { n: i + 1 });
      btn.appendChild(num);
      const hint = h("span", "puzzle-hint", `${lv.ammo}`);
      btn.appendChild(hint);
      btn.addEventListener("click", () => {
        if (!unlocked) return;
        this.handle("play", { mode: MODE_BREAKTHROUGH, index: i });
      });
      row.appendChild(btn);
    });
    card.appendChild(row);
    const foot = h("div", "panel-foot");
    foot.appendChild(this.button("menu", "btnMenu", "brass-btn ghost"));
    card.appendChild(foot);
    body.appendChild(card);
  }

  renderPause(body) {
    const card = this.panel("paused");
    const foot = h("div", "panel-foot");
    foot.appendChild(this.button("resume", "btnResume"));
    foot.appendChild(this.button("restart", "btnRestart", "brass-btn ghost"));
    foot.appendChild(this.button("help", "btnHelp", "brass-btn ghost"));
    foot.appendChild(this.button("menu", "btnMenu", "brass-btn ghost"));
    card.appendChild(foot);
    body.appendChild(card);
  }

  renderResult(body) {
    const r = this.result;
    if (!r) return;
    const cleared = r.outcome === "cleared";
    let titleKey = "resultCleared";
    if (!cleared) {
      const reason = this.game.lostReason ?? "";
      titleKey =
        reason === "time" ? "resultLostTime" : reason === "ammo" ? "resultLostAmmo" : reason === "lives" ? "resultLostLives" : "resultLostBase";
      if (r.mode === MODE_LAST_STAND) titleKey = "resultSiegeEnd";
    }
    const card = this.panel(titleKey);
    card.classList.add(cleared ? "win" : "lose");

    if (cleared && r.stars) {
      const row = h("div", "star-row");
      const keys = ["starBase", "starTime", "starLoss"];
      const vals = [r.stars.baseIntact, r.stars.underPar, r.stars.noLoss];
      keys.forEach((k, i) => {
        const stamp = h("div", `stamp${vals[i] ? " on" : ""}`);
        stamp.style.setProperty("--delay", `${120 + i * 180}ms`);
        const label = h("span", "stamp-label");
        this.mark(label, k);
        stamp.appendChild(label);
        row.appendChild(stamp);
      });
      card.appendChild(row);
    }

    const tape = h("div", "tape-report");
    const rows = [
      ["statTime", mmss(r.time)],
      ["statScore", String(r.score)],
      ["statBricks", String(r.stats.bricks)],
      ["statRicochet", String(r.stats.ricochets)],
      ["statAcc", r.stats.shots > 0 ? `${Math.round((r.stats.hits / r.stats.shots) * 100)}%` : "0%"],
      ["statCombo", String(r.bestCombo)],
    ];
    if (r.mode === MODE_LAST_STAND) {
      rows.push(["statWave", String(r.wave)]);
      rows.push(["statHold", mmss(r.time)]);
    }
    if (r.mode === MODE_BREAKTHROUGH) rows.push(["statAmmo", String(r.ammoLeft)]);
    for (const [key, value] of rows) {
      const line = h("div", "tape-line");
      const label = h("span", "tape-label");
      this.mark(label, key);
      line.append(label, h("span", "tape-value", value));
      tape.appendChild(line);
    }
    card.appendChild(tape);

    const foot = h("div", "panel-foot");
    if (cleared && r.mode !== MODE_LAST_STAND) {
      const idx = this.game.index ?? 0;
      const hasNext = r.mode === MODE_CAMPAIGN ? idx + 1 < LEVELS.length : idx + 1 < ENDGAMES.length;
      if (hasNext) foot.appendChild(this.button("next", "btnNext"));
    }
    foot.appendChild(this.button("retry", "btnRetry", cleared ? "brass-btn ghost" : "brass-btn"));
    if (r.mode === MODE_CAMPAIGN) foot.appendChild(this.button("map", "btnMap", "brass-btn ghost"));
    else foot.appendChild(this.button("menu", "btnMenu", "brass-btn ghost"));
    card.appendChild(foot);
    body.appendChild(card);
  }

  renderHelp(body) {
    const card = this.panel("helpTitle");
    const list = h("div", "help-body");
    for (const key of ["helpBody", "helpKeys", "helpRicochet", "helpOrders", "helpModes"]) {
      const p = h("p", "help-para");
      this.mark(p, key);
      list.appendChild(p);
    }
    card.appendChild(list);
    card.appendChild(this.keyLegend());
    const foot = h("div", "panel-foot");
    foot.appendChild(this.button("close", "btnClose"));
    card.appendChild(foot);
    body.appendChild(card);
  }

  // Keyboard bindings are invisible otherwise, so the keys get their own panel.
  keyLegend() {
    const wrap = h("div", "keys-card");
    const title = h("h3", "keys-title");
    this.mark(title, "keysTitle");
    wrap.appendChild(title);
    const rows = [
      ["keyMove", "keyMoveVal"],
      ["keyFire", "keyFireVal"],
      ["keyOrder", "keyOrderVal"],
      ["keyPause", "keyPauseVal"],
      ["keyRestart", "keyRestartVal"],
    ];
    const grid = h("div", "keys-grid");
    for (const [labelKey, valueKey] of rows) {
      const row = h("div", "keys-row");
      const label = h("span", "keys-label");
      this.mark(label, labelKey);
      const value = h("span", "keys-value");
      this.mark(value, valueKey);
      row.append(label, value);
      grid.appendChild(row);
    }
    wrap.appendChild(grid);
    return wrap;
  }

  /* -------------------------------------------------------------------- actions */

  handle(action, payload = null) {
    switch (action) {
      case "campaign":
        this.audio?.play?.("click");
        this.showOverlay("campaign");
        break;
      case "puzzle":
        this.audio?.play?.("click");
        this.showOverlay("puzzle");
        break;
      case "siege":
        this.audio?.play?.("click");
        this.game.start(MODE_LAST_STAND, 0);
        break;
      case "play":
        this.audio?.play?.("click");
        this.game.start(payload?.mode ?? MODE_CAMPAIGN, Number(payload?.index ?? 0));
        break;
      case "resume":
        this.audio?.play?.("click");
        this.showOverlay("none");
        break;
      case "restart":
      case "retry":
        this.audio?.play?.("click");
        this.showOverlay("none");
        this.game.restart();
        break;
      case "next":
        this.audio?.play?.("click");
        this.showOverlay("none");
        if (!this.game.next()) this.showMenu();
        break;
      case "map":
        this.audio?.play?.("click");
        this.showOverlay("campaign");
        break;
      case "menu":
        this.audio?.play?.("click");
        this.showOverlay("menu");
        break;
      case "help":
        this.audio?.play?.("click");
        this.showHelp();
        break;
      case "close":
        this.audio?.play?.("click");
        this.showOverlay(this.helpReturn === "none" ? "none" : this.helpReturn);
        break;
      case "hints": {
        const on = this.game.setHints(!this.game.data.hints);
        if (this.renderer) this.renderer.hints = on;
        this.showOverlay("menu");
        break;
      }
      case "order":
        this.game.order();
        break;
      case "fire":
        this.game.fire();
        break;
      default:
        break;
    }
  }

  /* ----------------------------------------------------------------------- HUD */

  updateHud() {
    const hud = this.game.hud();
    if (!hud) return;
    const set = (id, value) => {
      const el = this.nodes[id];
      if (el) el.textContent = String(value);
    };
    set("val-enemy", `${hud.remaining}/${hud.total}`);
    set("val-lives", hud.lives);
    set("val-base", `${hud.baseHp}/${hud.maxBaseHp}`);
    set("val-score", hud.score);
    set("val-time", hud.timeLimit > 0 ? mmss(hud.timeLeft) : mmss(hud.time));
    set("val-wave", hud.wave);
    set("val-ammo", hud.ammoMax > 0 ? `${hud.ammo}/${hud.ammoMax}` : "--");
    set("val-order", this.tr(`o_${hud.order}`));

    const enemyRatio = hud.total > 0 ? 1 - hud.remaining / hud.total : 0;
    this.setNeedle(this.gaugeEnemy, enemyRatio);
    this.setNeedle(this.gaugeLives, Math.min(1, hud.lives / 5));
    if (this.chargeFill) this.chargeFill.style.width = `${Math.round((hud.charge / hud.chargeMax) * 100)}%`;
    const orderEl = this.nodes["btn-order"];
    if (orderEl) orderEl.classList.toggle("ready", hud.charge >= hud.chargeMax);

    const lampOn = {
      shield: hud.shield || hud.grace,
      freeze: hud.freeze,
      steelBase: hud.steelBase,
      jam: hud.freeze,
    };
    for (const [kind, on] of Object.entries(lampOn)) {
      this.lampEls[kind]?.classList.toggle("on", Boolean(on));
    }
  }

  setNeedle(gauge, ratio) {
    if (!gauge || !gauge.needle) return;
    const deg = -90 + Math.max(0, Math.min(1, ratio)) * 180;
    gauge.needle.style.transform = `rotate(${deg}deg)`;
  }

  /* ---------------------------------------------------------------- telegraph */

  pushTape(key, vars, build) {
    // Tape lines outlive language switches, so each keeps a resolver and is
    // repainted from scratch whenever the language changes.
    const make = build ?? (() => (vars ? format(key, this.lang, vars) : t(key, this.lang)));
    const line = h("div", "tape-line", make());
    this.tape.push({ el: line, make });
    this.tapeList?.appendChild(line);
    while (this.tape.length > 3) {
      this.tape.shift().el.remove?.();
    }
  }

  repaintTape() {
    // the trim in pushTape keeps this list in sync with the DOM, so every item is live
    for (const item of this.tape) item.el.textContent = item.make();
  }

  describe(event) {
    switch (event.type) {
      case "kill":
        this.pushTape("tapeKill", null, () =>
          format("tapeKill", this.lang, { type: this.tr(`e_${event.kind}`), score: event.score })
        );
        break;
      case "baseHit":
        this.pushTape("tapeBase", { hp: event.hp });
        break;
      case "pickup":
        this.pushTape("tapePick", { kind: this.tr(`p_${event.kind}`) });
        break;
      case "wave":
        this.pushTape("tapeWave", { n: event.wave });
        break;
      case "start":
        this.pushTape("tapeReady");
        break;
      default:
        break;
    }
  }

  clearTape() {
    this.tape.length = 0;
    if (this.tapeList) this.tapeList.replaceChildren();
  }
}
