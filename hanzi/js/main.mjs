/**
 * Glyph Craft (字灵拆拆乐) - Main Assembly & Event Coordination
 * Full in-place bilingual hot update, drag-and-drop alchemy, swipe slicing, sound.
 */

import { GameController } from './game.mjs';
import { InkWorldRenderer } from './ui.mjs';
import { playSound, setMuted, isAudioMuted } from './audio.mjs';
import { getCurrentLang, setCurrentLang, t, STRINGS } from './i18n.mjs';
import { GLYPH_CATALOG } from './data.mjs';
import { getTotalLevels } from './levels.mjs';

document.addEventListener('DOMContentLoaded', () => {
  const controller = new GameController();
  const canvas = document.getElementById('stage-canvas');
  const renderer = new InkWorldRenderer(canvas);

  let currentLang = getCurrentLang();
  let draggedGlyphUid = null;
  let isSlicing = false;
  let sliceStart = null;

  // Audio setup
  controller.init();
  setMuted(!controller.storageData.soundEnabled);

  // Initial render & DOM binding
  setupDOMElements();
  updateUI();
  startRenderLoop();

  // Listen to controller events
  controller.onStateChange = () => {
    updateUI();
  };

  controller.onVictory = ({ level, assessment }) => {
    playSound('victory_fanfare');
    showWonDialog(level, assessment);
  };

  function startRenderLoop() {
    function loop() {
      const state = controller.getState();
      if (state.engine && !state.paused) {
        renderer.render(state.engine, currentLang);
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  function setupDOMElements() {
    // Language switch
    const langBtn = document.getElementById('lang-toggle');
    if (langBtn) {
      langBtn.addEventListener('click', () => {
        currentLang = currentLang === 'zh' ? 'en' : 'zh';
        setCurrentLang(currentLang);
        applyLanguageToDOM();
        renderer.render(controller.getState().engine, currentLang);
      });
    }

    // Audio switch
    const soundBtn = document.getElementById('sound-toggle');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        const nextMuted = !isAudioMuted();
        setMuted(nextMuted);
        controller.storageData.soundEnabled = !nextMuted;
        updateSoundButtonLabel();
        if (!nextMuted) playSound('stone_thud');
      });
    }

    // Undo button
    const undoBtn = document.getElementById('undo-btn');
    if (undoBtn) {
      undoBtn.addEventListener('click', () => {
        const res = controller.undo();
        if (res.success) playSound('stone_thud');
      });
    }

    // Reset button
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        controller.resetLevel();
        playSound('stone_thud');
      });
    }

    // Rules dialog toggle
    const rulesBtn = document.getElementById('rules-btn');
    const rulesDialog = document.getElementById('rules-dialog');
    const closeRulesBtn = document.getElementById('close-rules-btn');
    if (rulesBtn && rulesDialog) {
      rulesBtn.addEventListener('click', () => {
        rulesDialog.showModal();
        playSound('stone_thud');
      });
    }
    if (closeRulesBtn && rulesDialog) {
      closeRulesBtn.addEventListener('click', () => rulesDialog.close());
    }

    // Levels dialog toggle
    const levelsBtn = document.getElementById('levels-btn');
    const levelsDialog = document.getElementById('levels-dialog');
    const closeLevelsBtn = document.getElementById('close-levels-btn');
    if (levelsBtn && levelsDialog) {
      levelsBtn.addEventListener('click', () => {
        renderLevelsList();
        levelsDialog.showModal();
        playSound('stone_thud');
      });
    }
    if (closeLevelsBtn && levelsDialog) {
      closeLevelsBtn.addEventListener('click', () => levelsDialog.close());
    }

    // Codex dialog toggle
    const codexBtn = document.getElementById('codex-btn');
    const codexDialog = document.getElementById('codex-dialog');
    const closeCodexBtn = document.getElementById('close-codex-btn');
    if (codexBtn && codexDialog) {
      codexBtn.addEventListener('click', () => {
        renderCodexList();
        codexDialog.showModal();
        playSound('stone_thud');
      });
    }
    if (closeCodexBtn && codexDialog) {
      closeCodexBtn.addEventListener('click', () => codexDialog.close());
    }

    // Won dialog buttons
    const nextLvlBtn = document.getElementById('won-next-btn');
    const retryLvlBtn = document.getElementById('won-retry-btn');
    const selectLvlBtn = document.getElementById('won-select-btn');
    const wonDialog = document.getElementById('won-dialog');
    if (nextLvlBtn && wonDialog) {
      nextLvlBtn.addEventListener('click', () => {
        wonDialog.close();
        const nextId = controller.currentLevelId + 1;
        if (nextId <= getTotalLevels()) {
          controller.startLevel(nextId);
        } else {
          controller.startLevel(1);
        }
      });
    }
    if (retryLvlBtn && wonDialog) {
      retryLvlBtn.addEventListener('click', () => {
        wonDialog.close();
        controller.resetLevel();
      });
    }
    if (selectLvlBtn && wonDialog && levelsDialog) {
      selectLvlBtn.addEventListener('click', () => {
        wonDialog.close();
        renderLevelsList();
        levelsDialog.showModal();
      });
    }

    // Canvas events (Drag and drop target & Slicing)
    setupCanvasInteractions();

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (key === 'z' || key === 'u') {
        const res = controller.undo();
        if (res.success) playSound('stone_thud');
      } else if (key === 'r') {
        controller.resetLevel();
        playSound('stone_thud');
      } else if (key === 'p' || key === 'escape') {
        const paused = controller.togglePause();
        const pauseDialog = document.getElementById('pause-dialog');
        if (pauseDialog) {
          if (paused) pauseDialog.showModal();
          else pauseDialog.close();
        }
      }
    });

    const resumeBtn = document.getElementById('resume-btn');
    const pauseDialog = document.getElementById('pause-dialog');
    if (resumeBtn && pauseDialog) {
      resumeBtn.addEventListener('click', () => {
        controller.togglePause(false);
        pauseDialog.close();
      });
    }

    // Page visibility auto-pause
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        controller.togglePause(true);
        if (pauseDialog && !pauseDialog.open) pauseDialog.showModal();
      }
    });
    window.addEventListener('blur', () => {
      controller.togglePause(true);
      if (pauseDialog && !pauseDialog.open) pauseDialog.showModal();
    });

    applyLanguageToDOM();
    updateSoundButtonLabel();
  }

  function setupCanvasInteractions() {
    canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const cx = (e.clientX - rect.left) * scaleX;
      const cy = (e.clientY - rect.top) * scaleY;
      const state = controller.getState();
      const obs = renderer.getObstacleAt(cx, cy, state.engine.obstacles);
      renderer.setHoverObstacle(obs ? obs.id : null);
    });

    canvas.addEventListener('dragleave', () => {
      renderer.setHoverObstacle(null);
    });

    canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      renderer.setHoverObstacle(null);
      if (!draggedGlyphUid) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const cx = (e.clientX - rect.left) * scaleX;
      const cy = (e.clientY - rect.top) * scaleY;

      const state = controller.getState();
      const obs = renderer.getObstacleAt(cx, cy, state.engine.obstacles);
      if (obs) {
        const res = controller.applyGlyph(draggedGlyphUid, obs.id);
        if (res.success) {
          playSound(res.sound || 'fire_burn');
          renderer.addReactionParticles(obs.x, obs.y, res.sound);
        }
      }
      draggedGlyphUid = null;
    });

    // Touch and swipe slice on canvas
    canvas.addEventListener('mousedown', (e) => {
      isSlicing = true;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      sliceStart = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!isSlicing || !sliceStart) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const curX = (e.clientX - rect.left) * scaleX;
      const curY = (e.clientY - rect.top) * scaleY;
      renderer.setSliceLine({
        startX: sliceStart.x,
        startY: sliceStart.y,
        endX: curX,
        endY: curY
      });
    });

    window.addEventListener('mouseup', (e) => {
      if (!isSlicing) return;
      isSlicing = false;
      renderer.setSliceLine(null);
      if (sliceStart) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const endX = (e.clientX - rect.left) * scaleX;
        const endY = (e.clientY - rect.top) * scaleY;
        const midX = (sliceStart.x + endX) / 2;
        const midY = (sliceStart.y + endY) / 2;

        const state = controller.getState();
        const obs = renderer.getObstacleAt(midX, midY, state.engine.obstacles);
        if (obs) {
          const res = controller.sliceObstacle(obs.id);
          if (res.success) {
            playSound(res.sound || 'slice_crack');
            renderer.addReactionParticles(obs.x, obs.y, 'slice');
          }
        }
        sliceStart = null;
      }
    });
  }

  function updateUI() {
    const state = controller.getState();
    const curLevel = state.level;

    // Header info
    const chapElem = document.getElementById('chapter-display');
    if (chapElem) chapElem.textContent = t(`chap_${curLevel.chapterId}_title`, currentLang);

    const lvlElem = document.getElementById('level-name-display');
    if (lvlElem) lvlElem.textContent = `${curLevel.id}. ${t(curLevel.nameKey, currentLang)}`;

    const stepsElem = document.getElementById('steps-count-display');
    if (stepsElem) stepsElem.textContent = `${state.engine.steps} / ★ ${curLevel.optimalSteps}`;

    // Render tray glyph seals
    renderTray(state.engine.trayGlyphs);
  }

  function renderTray(trayGlyphs) {
    const container = document.getElementById('tray-glyphs-container');
    if (!container) return;
    container.innerHTML = '';

    trayGlyphs.forEach((glyph) => {
      const card = document.createElement('div');
      card.className = 'glyph-seal-card';
      card.setAttribute('draggable', 'true');
      card.dataset.uid = glyph.uid;

      card.innerHTML = `
        <div class="seal-inner">
          <div class="seal-char">${glyph.char}</div>
          <div class="seal-meta">
            <span class="seal-icon">${glyph.icon}</span>
            <span class="seal-en">${glyph.enName}</span>
          </div>
        </div>
      `;

      // Drag and drop within tray
      card.addEventListener('dragstart', (e) => {
        draggedGlyphUid = glyph.uid;
        e.dataTransfer.setData('text/plain', glyph.uid);
        card.classList.add('dragging');
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        card.classList.add('drag-over');
      });

      card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over');
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');
        if (draggedGlyphUid && draggedGlyphUid !== glyph.uid) {
          const res = controller.synthesize(draggedGlyphUid, glyph.uid);
          if (res.success) {
            playSound(res.sound || 'zither_chord');
          }
          draggedGlyphUid = null;
        }
      });

      // Double-click to disassemble
      card.addEventListener('dblclick', () => {
        const res = controller.disassemble(glyph.uid);
        if (res.success) {
          playSound(res.sound || 'slice_crack');
        }
      });

      container.appendChild(card);
    });
  }

  function renderLevelsList() {
    const container = document.getElementById('levels-grid');
    if (!container) return;
    container.innerHTML = '';

    const state = controller.getState();
    const highestLevel = state.storage.highestLevel || 1;
    const starsMap = state.storage.levelStars || {};

    for (let i = 1; i <= getTotalLevels(); i++) {
      const isUnlocked = i <= highestLevel;
      const stars = starsMap[i] || 0;
      const isCurrent = i === controller.currentLevelId;

      const item = document.createElement('button');
      item.className = `level-pill ${isUnlocked ? 'unlocked' : 'locked'} ${isCurrent ? 'current' : ''}`;
      item.disabled = !isUnlocked;

      const starStr = isUnlocked ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '🔒';
      item.innerHTML = `
        <span class="pill-num">${i}</span>
        <span class="pill-stars">${starStr}</span>
      `;

      if (isUnlocked) {
        item.addEventListener('click', () => {
          controller.startLevel(i);
          document.getElementById('levels-dialog').close();
          playSound('stone_thud');
        });
      }

      container.appendChild(item);
    }
  }

  function renderCodexList() {
    const container = document.getElementById('codex-grid');
    if (!container) return;
    container.innerHTML = '';

    const state = controller.getState();
    const unlockedSet = new Set(state.storage.unlockedCodex || []);

    const catalogKeys = Object.keys(GLYPH_CATALOG);
    catalogKeys.forEach(id => {
      const meta = GLYPH_CATALOG[id];
      const isDiscovered = unlockedSet.has(id);

      const card = document.createElement('div');
      card.className = `codex-card ${isDiscovered ? 'unlocked' : 'locked'}`;

      if (isDiscovered) {
        card.innerHTML = `
          <div class="codex-seal-icon">${meta.char}</div>
          <div class="codex-info">
            <div class="codex-name">${meta.char} (${meta.enName} ${meta.icon})</div>
            <div class="codex-desc">${t(meta.descriptionKey, currentLang)}</div>
          </div>
        `;
      } else {
        card.innerHTML = `
          <div class="codex-seal-icon">?</div>
          <div class="codex-info">
            <div class="codex-name">???</div>
            <div class="codex-desc">${t('codex_hint_locked', currentLang)}</div>
          </div>
        `;
      }

      container.appendChild(card);
    });
  }

  function showWonDialog(level, assessment) {
    const wonDialog = document.getElementById('won-dialog');
    if (!wonDialog) return;

    const poemElem = document.getElementById('won-poem-text');
    if (poemElem) poemElem.textContent = t(level.poemKey, currentLang);

    const starsElem = document.getElementById('won-stars-display');
    if (starsElem) {
      starsElem.textContent = '★'.repeat(assessment.stars) + '☆'.repeat(3 - assessment.stars);
    }

    const check1 = document.getElementById('won-check-1');
    const check2 = document.getElementById('won-check-2');
    const check3 = document.getElementById('won-check-3');

    if (check1) check1.className = assessment.star1 ? 'active' : '';
    if (check2) check2.className = assessment.star2 ? 'active' : '';
    if (check3) check3.className = assessment.star3 ? 'active' : '';

    wonDialog.showModal();
  }

  function applyLanguageToDOM() {
    document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        el.textContent = t(key, currentLang);
      }
    });

    const langBtn = document.getElementById('lang-toggle');
    if (langBtn) {
      langBtn.textContent = currentLang === 'zh' ? 'English' : '中文';
    }

    updateSoundButtonLabel();
    updateUI();
  }

  function updateSoundButtonLabel() {
    const soundBtn = document.getElementById('sound-toggle');
    if (soundBtn) {
      soundBtn.textContent = isAudioMuted() ? t('sound_off', currentLang) : t('sound_on', currentLang);
    }
  }
});
