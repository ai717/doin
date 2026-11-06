// UI 层：唯一碰 DOM 的地方。装配关卡列表、刷新 HUD、结算/帮助弹层、
// 按钮与移动端方向键事件。规则与计分一律不下沉到这里。
import { CHAPTERS, LEVEL_COUNT } from "./level.mjs";

export function createUI(handlers) {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const el = {
    title: $("#stage-title"),
    backHome: $("#back-home"),
    btnSound: $("#btn-sound"),
    btnLang: $("#btn-lang"),
    btnHelp: $("#btn-help"),
    chaptersTitle: $("#chapters-title"),
    levelList: $("#level-list"),
    hudLives: $("#hud-lives"),
    hudTime: $("#hud-time"),
    hudScore: $("#hud-score"),
    labelTime: $("#label-time"),
    labelScore: $("#label-score"),
    labelLevel: $("#label-level"),
    labelBest: $("#label-best"),
    labelStars: $("#label-stars"),
    infoLevel: $("#info-level"),
    infoBest: $("#info-best"),
    infoStars: $("#info-stars"),
    btnPrev: $("#btn-prev"),
    btnNext: $("#btn-next"),
    btnRestart: $("#btn-restart"),
    overlay: $("#overlay"),
    dlgTitle: $("#dlg-title"),
    dlgBody: $("#dlg-body"),
    dlgPrimary: $("#dlg-primary"),
    dlgSecondary: $("#dlg-secondary"),
    dlgClose: $("#dlg-close"),
  };

  const t = handlers.t;

  // 静态文案
  function applyLocale() {
    el.title.textContent = t("stageTitle");
    el.backHome.textContent = "← " + t("backHome");
    el.btnLang.textContent = t("langSwitch");
    el.chaptersTitle.textContent = t("chapters");
    el.labelTime.textContent = t("time");
    el.labelScore.textContent = t("score");
    el.labelLevel.textContent = t("level");
    el.labelBest.textContent = t("best");
    el.labelStars.textContent = t("stars");
    el.btnPrev.textContent = "◀ " + t("prev");
    el.btnNext.textContent = t("next") + " ▶";
    el.btnRestart.textContent = t("restart");
  }

  function starsText(stars) {
    return "★★★".slice(0, stars) + "☆☆☆".slice(stars);
  }

  // 关卡列表：5 章 × 8 关
  function buildLevels(progress) {
    el.levelList.textContent = "";
    for (let ci = 0; ci < CHAPTERS.length; ci += 1) {
      const chap = CHAPTERS[ci];
      const li = document.createElement("li");
      li.className = "chapter";
      const heading = document.createElement("h3");
      heading.textContent = t("chapter", ci + 1) + " · " + t(chap.titleKey);
      li.appendChild(heading);
      const grid = document.createElement("ol");
      grid.className = "level-grid";
      for (let j = 0; j < 8; j += 1) {
        const levelId = ci * 8 + j + 1;
        const unlocked = levelId <= progress.unlocked;
        const b = document.createElement("button");
        b.className = "lv";
        b.textContent = String(levelId);
        b.dataset.level = String(levelId);
        if (!unlocked) b.classList.add("locked");
        const best = progress.best[levelId];
        if (best && best.stars > 0) b.classList.add("cleared");
        b.addEventListener("click", () => handlers.selectLevel(levelId));
        const btnLi = document.createElement("li");
        btnLi.appendChild(b);
        grid.appendChild(btnLi);
      }
      li.appendChild(grid);
      el.levelList.appendChild(li);
    }
  }

  function refreshHUD({ state, score, levelId, best }) {
    el.hudLives.textContent = state ? String(state.lives) : "-";
    el.hudTime.textContent = state ? String(Math.max(0, Math.ceil(state.timer))) : "-";
    el.hudScore.textContent = String(score);
    el.infoLevel.textContent = String(levelId);
    el.infoBest.textContent = best && best.timeMs != null
      ? t("fmtTime", (best.timeMs / 1000).toFixed(1))
      : "--";
    el.infoStars.textContent = starsText(best ? best.stars : 0);
  }

  function showResult({ won, stars, timeMs, score, isRecord }) {
    el.dlgTitle.textContent = won ? t("wonTitle") : t("lostTitle");
    const lines = [];
    if (won) {
      lines.push(t("wonBody"));
      lines.push(t("stars") + "：" + starsText(stars));
      lines.push(t("score") + "：" + score);
      if (timeMs != null) lines.push(t("best") + "：" + t("fmtTime", (timeMs / 1000).toFixed(1)));
      if (isRecord) lines.push("★ " + t("newRecord"));
    } else {
      lines.push(t("lostBody"));
    }
    el.dlgBody.textContent = lines.join("\n");

    el.dlgPrimary.textContent = won ? t("next") : t("restart");
    el.dlgPrimary.style.display = "inline-block";
    el.dlgSecondary.textContent = t("restart");
    el.dlgClose.textContent = t("backHome");
    el.overlay.hidden = false;
  }

  function hideOverlay() {
    el.overlay.hidden = true;
  }

  function showHelp() {
    el.dlgTitle.textContent = t("helpTitle");
    el.dlgBody.textContent = t("helpBody");
    el.dlgPrimary.style.display = "none";
    el.dlgSecondary.style.display = "none";
    el.dlgClose.textContent = t("backHome");
    el.overlay.hidden = false;
  }

  function setSoundIcon(muted) {
    el.btnSound.textContent = muted ? "🔇" : "🔊";
    el.btnSound.setAttribute("aria-label", muted ? t("mutedLabel") : t("soundLabel"));
  }

  function bind() {
    el.btnSound.addEventListener("click", handlers.toggleSound);
    el.btnLang.addEventListener("click", handlers.toggleLang);
    el.btnHelp.addEventListener("click", showHelp);
    el.btnRestart.addEventListener("click", handlers.restart);
    el.btnPrev.addEventListener("click", handlers.prev);
    el.btnNext.addEventListener("click", handlers.next);
    el.dlgPrimary.addEventListener("click", handlers.dialogPrimary);
    el.dlgSecondary.addEventListener("click", handlers.restart);
    el.dlgClose.addEventListener("click", hideOverlay);
    el.overlay.addEventListener("click", (e) => {
      if (e.target === el.overlay) hideOverlay();
    });

    // 移动端方向键
    $$("#dpad .dpad-btn").forEach((btn) => {
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        handlers.dir(btn.dataset.dir);
      });
    });

    // 触屏四向滑动
    const board = $("#board-frame") || $("#board");
    let sx = 0;
    let sy = 0;
    const THRESHOLD = 24;
    board.addEventListener("pointerdown", (e) => {
      sx = e.clientX;
      sy = e.clientY;
    });
    board.addEventListener("pointerup", (e) => {
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return;
      if (Math.abs(dx) > Math.abs(dy)) handlers.dir(dx > 0 ? "right" : "left");
      else handlers.dir(dy > 0 ? "down" : "up");
    });
  }

  applyLocale();
  bind();

  return {
    buildLevels,
    refreshHUD,
    showResult,
    hideOverlay,
    showHelp,
    setSoundIcon,
  };
}

export { LEVEL_COUNT as TOTAL_LEVELS };