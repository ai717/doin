/**
 * Immortal Box (摸鱼开箱修仙传) - Main Assembly & Event Coordination
 * Full in-place bilingual hot update, auto-open loop, combat simulation, audio.
 */

import { GameController } from './game.mjs';
import { SanctuaryRenderer } from './ui.mjs';
import { playSound, setMuted, isAudioMuted } from './audio.mjs';
import { getCurrentLang, setCurrentLang, t } from './i18n.mjs';
import { SLOTS, SLOT_INFO, QUALITY_INFO, REALMS, CAULDRON_TIERS } from './data.mjs';
import { formatNumber, getCultivationTitle } from './score.mjs';
import { getBossById, calcAbyssBoss } from './levels.mjs';

document.addEventListener('DOMContentLoaded', () => {
  const controller = new GameController();
  const canvas = document.getElementById('stage-canvas');
  const renderer = new SanctuaryRenderer(canvas);

  let currentLang = getCurrentLang();
  let autoTimer = null;

  controller.init();
  setMuted(!controller.data.soundEnabled);

  setupDOMElements();
  updateUI();
  startRenderLoop();

  // If there are offline gains, show offline modal
  if (controller.offlineYield) {
    showOfflineModal(controller.offlineYield);
  }

  controller.onStateChange = () => {
    updateUI();
  };

  controller.onDrop = (item) => {
    const qInfo = QUALITY_INFO[item.quality];
    renderer.triggerOpen(qInfo.color);
    if (qInfo.tier >= 4) {
      playSound('gold_loot');
    } else {
      playSound('cauldron_strike');
    }
    showLootCard(item);
  };

  function startRenderLoop() {
    function loop() {
      renderer.render();
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
      });
    }

    // Audio switch
    const soundBtn = document.getElementById('sound-toggle');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        const nextMuted = !isAudioMuted();
        setMuted(nextMuted);
        controller.data.soundEnabled = !nextMuted;
        updateSoundButtonLabel();
        if (!nextMuted) playSound('cauldron_strike');
      });
    }

    // Open box button & canvas click
    const openBtn = document.getElementById('open-box-btn');
    if (openBtn) {
      openBtn.addEventListener('click', () => {
        if (controller.currentDrop) return;
        controller.openCauldron();
      });
    }
    if (canvas) {
      canvas.addEventListener('click', () => {
        if (controller.currentDrop) return;
        controller.openCauldron();
      });
    }

    // Equip & Smelt buttons
    const equipBtn = document.getElementById('equip-btn');
    if (equipBtn) {
      equipBtn.addEventListener('click', () => {
        const res = controller.equipCurrentDrop();
        if (res.success) {
          playSound('equip_jade');
          hideLootCard();
          if (controller.isAutoOpening) scheduleNextAutoOpen();
        }
      });
    }

    const smeltBtn = document.getElementById('smelt-btn');
    if (smeltBtn) {
      smeltBtn.addEventListener('click', () => {
        const res = controller.smeltCurrentDrop();
        if (res.success) {
          playSound('smelt_fire');
          hideLootCard();
          if (controller.isAutoOpening) scheduleNextAutoOpen();
        }
      });
    }

    // Auto open button & modal
    const autoBtn = document.getElementById('auto-btn');
    const autoModal = document.getElementById('auto-modal');
    const startAutoBtn = document.getElementById('start-auto-btn');
    const closeAutoBtn = document.getElementById('close-auto-btn');

    if (autoBtn && autoModal) {
      autoBtn.addEventListener('click', () => {
        if (controller.isAutoOpening) {
          stopAutoOpen();
        } else {
          autoModal.showModal();
        }
      });
    }
    if (closeAutoBtn && autoModal) {
      closeAutoBtn.addEventListener('click', () => autoModal.close());
    }
    if (startAutoBtn && autoModal) {
      startAutoBtn.addEventListener('click', () => {
        const qualitySelect = document.getElementById('auto-quality-select');
        const stopUpgradeCheck = document.getElementById('auto-upgrade-check');
        if (qualitySelect) controller.data.autoSettings.minQuality = qualitySelect.value;
        if (stopUpgradeCheck) controller.data.autoSettings.stopOnUpgrade = stopUpgradeCheck.checked;

        autoModal.close();
        startAutoOpen();
      });
    }

    // Tribulation modal
    const tribBtn = document.getElementById('tribulation-btn');
    const tribModal = document.getElementById('tribulation-modal');
    const closeTribBtn = document.getElementById('close-trib-btn');
    const challengeBossBtn = document.getElementById('challenge-boss-btn');

    if (tribBtn && tribModal) {
      tribBtn.addEventListener('click', () => {
        renderTribulationInfo();
        tribModal.showModal();
        playSound('cauldron_strike');
      });
    }
    if (closeTribBtn && tribModal) {
      closeTribBtn.addEventListener('click', () => tribModal.close());
    }
    if (challengeBossBtn) {
      challengeBossBtn.addEventListener('click', () => {
        playSound('lightning_thunder');
        const res = controller.startTribulation();
        renderCombatResult(res.result, document.getElementById('trib-combat-log'));
        if (res.result.won) {
          playSound('victory_fanfare');
        }
      });
    }

    // Abyss modal
    const abyssBtn = document.getElementById('abyss-btn');
    const abyssModal = document.getElementById('abyss-modal');
    const closeAbyssBtn = document.getElementById('close-abyss-btn');
    const challengeAbyssBtn = document.getElementById('challenge-abyss-btn');

    if (abyssBtn && abyssModal) {
      abyssBtn.addEventListener('click', () => {
        renderAbyssInfo();
        abyssModal.showModal();
        playSound('cauldron_strike');
      });
    }
    if (closeAbyssBtn && abyssModal) {
      closeAbyssBtn.addEventListener('click', () => abyssModal.close());
    }
    if (challengeAbyssBtn) {
      challengeAbyssBtn.addEventListener('click', () => {
        playSound('lightning_thunder');
        const nextFloor = controller.data.highestAbyssFloor + 1;
        const res = controller.startAbyssCombat(nextFloor);
        renderCombatResult(res.result, document.getElementById('abyss-combat-log'));
        if (res.result.won) {
          playSound('victory_fanfare');
          renderAbyssInfo();
        }
      });
    }

    // Cauldron upgrade modal
    const cauldronBtn = document.getElementById('cauldron-btn');
    const cauldronModal = document.getElementById('cauldron-modal');
    const closeCauldronBtn = document.getElementById('close-cauldron-btn');
    const upgradeCauldronBtn = document.getElementById('upgrade-cauldron-btn');

    if (cauldronBtn && cauldronModal) {
      cauldronBtn.addEventListener('click', () => {
        renderCauldronInfo();
        cauldronModal.showModal();
        playSound('cauldron_strike');
      });
    }
    if (closeCauldronBtn && cauldronModal) {
      closeCauldronBtn.addEventListener('click', () => cauldronModal.close());
    }
    if (upgradeCauldronBtn) {
      upgradeCauldronBtn.addEventListener('click', () => {
        const res = controller.upgradeCauldron();
        if (res.success) {
          playSound('victory_fanfare');
          renderCauldronInfo();
        }
      });
    }

    // Rules modal
    const rulesBtn = document.getElementById('rules-btn');
    const rulesModal = document.getElementById('rules-modal');
    const closeRulesBtn = document.getElementById('close-rules-btn');
    if (rulesBtn && rulesModal) {
      rulesBtn.addEventListener('click', () => {
        rulesModal.showModal();
        playSound('cauldron_strike');
      });
    }
    if (closeRulesBtn && rulesModal) {
      closeRulesBtn.addEventListener('click', () => rulesModal.close());
    }

    // Offline claim modal
    const claimOfflineBtn = document.getElementById('claim-offline-btn');
    const offlineModal = document.getElementById('offline-modal');
    if (claimOfflineBtn && offlineModal) {
      claimOfflineBtn.addEventListener('click', () => {
        controller.claimOfflineGains();
        offlineModal.close();
        playSound('victory_fanfare');
      });
    }

    // Auto pause on background
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && controller.isAutoOpening) {
        stopAutoOpen();
      }
    });

    applyLanguageToDOM();
    updateSoundButtonLabel();
  }

  function startAutoOpen() {
    controller.isAutoOpening = true;
    const autoBtn = document.getElementById('auto-btn');
    if (autoBtn) {
      autoBtn.textContent = t('auto_stop_btn', currentLang);
      autoBtn.classList.add('active-auto');
    }
    scheduleNextAutoOpen();
  }

  function stopAutoOpen() {
    controller.isAutoOpening = false;
    if (autoTimer) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
    const autoBtn = document.getElementById('auto-btn');
    if (autoBtn) {
      autoBtn.textContent = t('auto_btn', currentLang);
      autoBtn.classList.remove('active-auto');
    }
  }

  function scheduleNextAutoOpen() {
    if (!controller.isAutoOpening) return;
    if (controller.data.cauldronStones < 1) {
      stopAutoOpen();
      return;
    }

    autoTimer = setTimeout(() => {
      if (!controller.isAutoOpening) return;
      const res = controller.openCauldron();
      if (!res.success) {
        stopAutoOpen();
        return;
      }

      // Check auto stop conditions
      const item = res.drop;
      const qInfo = QUALITY_INFO[item.quality];
      const targetMinQuality = controller.data.autoSettings.minQuality || 'rare';
      const targetTier = QUALITY_INFO[targetMinQuality]?.tier || 3;

      const currentEquipped = controller.data.equipment[item.slot];
      const isUpgrade = !currentEquipped || item.cp > currentEquipped.cp;

      const shouldStopForQuality = qInfo.tier >= targetTier;
      const shouldStopForUpgrade = controller.data.autoSettings.stopOnUpgrade && isUpgrade;

      if (shouldStopForQuality || shouldStopForUpgrade) {
        // Pause auto open and let user decide
        stopAutoOpen();
      } else {
        // Auto smelt lower grade item and continue
        controller.smeltCurrentDrop();
        scheduleNextAutoOpen();
      }
    }, 450);
  }

  function showLootCard(item) {
    const card = document.getElementById('loot-card');
    if (!card) return;

    const sInfo = SLOT_INFO[item.slot];
    const qInfo = QUALITY_INFO[item.quality];
    const equipped = controller.data.equipment[item.slot];

    document.getElementById('loot-name').textContent = `${item.nameZh} (${item.enName})`;
    document.getElementById('loot-name').style.color = qInfo.color;
    document.getElementById('loot-icon').textContent = sInfo.icon;
    document.getElementById('loot-cp').textContent = `${t('combat_power', currentLang)}: ${formatNumber(item.cp)}`;

    // Stats Comparison
    const statsContainer = document.getElementById('loot-stats-compare');
    if (statsContainer) {
      statsContainer.innerHTML = `
        <div class="stat-compare-row">
          <span>${t('stat_hp', currentLang)}</span>
          <span>${item.hp} ${getDiffSpan(item.hp, equipped?.hp)}</span>
        </div>
        <div class="stat-compare-row">
          <span>${t('stat_atk', currentLang)}</span>
          <span>${item.atk} ${getDiffSpan(item.atk, equipped?.atk)}</span>
        </div>
        <div class="stat-compare-row">
          <span>${t('stat_def', currentLang)}</span>
          <span>${item.def} ${getDiffSpan(item.def, equipped?.def)}</span>
        </div>
        <div class="stat-compare-row">
          <span>${t('stat_spd', currentLang)}</span>
          <span>${item.spd} ${getDiffSpan(item.spd, equipped?.spd)}</span>
        </div>
      `;
    }

    // Affixes
    const affixesContainer = document.getElementById('loot-affixes');
    if (affixesContainer) {
      affixesContainer.innerHTML = '';
      if (item.affixes) {
        for (const [k, v] of Object.entries(item.affixes)) {
          const affRow = document.createElement('div');
          affRow.className = 'affix-chip';
          affRow.textContent = `+${v}% ${t(`affix_${k}`, currentLang)}`;
          affixesContainer.appendChild(affRow);
        }
      }
    }

    card.classList.remove('hidden');
  }

  function hideLootCard() {
    const card = document.getElementById('loot-card');
    if (card) card.classList.add('hidden');
  }

  function getDiffSpan(newVal, oldVal = 0) {
    const diff = newVal - oldVal;
    if (diff > 0) return `<span class="stat-up">+${diff}</span>`;
    if (diff < 0) return `<span class="stat-down">${diff}</span>`;
    return `<span class="stat-same">0</span>`;
  }

  function updateUI() {
    const data = controller.data;
    const stats = controller.playerStats;
    const curRealm = REALMS[data.realmId - 1];
    const titleInfo = getCultivationTitle(data.realmId);

    // Resources
    const spiritElem = document.getElementById('spirit-stones-val');
    if (spiritElem) spiritElem.textContent = formatNumber(data.spiritStones);

    const cauldronElem = document.getElementById('cauldron-stones-val');
    if (cauldronElem) cauldronElem.textContent = formatNumber(data.cauldronStones);

    const cpElem = document.getElementById('player-cp-val');
    if (cpElem) cpElem.textContent = formatNumber(stats.cp);

    // Realm info
    const realmElem = document.getElementById('realm-name-val');
    if (realmElem) realmElem.textContent = `${curRealm.nameZh} (${curRealm.enName})`;

    const titleElem = document.getElementById('realm-title-val');
    if (titleElem) titleElem.textContent = `${titleInfo.icon} ${t(titleInfo.key, currentLang)}`;

    const expElem = document.getElementById('exp-progress-bar');
    const expText = document.getElementById('exp-progress-text');
    if (expElem && expText) {
      const pct = Math.min(100, Math.round((data.exp / curRealm.maxExp) * 100));
      expElem.style.width = `${pct}%`;
      expText.textContent = `${data.exp} / ${curRealm.maxExp} (${pct}%)`;
    }

    // 8 Equipment Slots
    renderEquipmentSlots();

    // Secondary Affixes Display
    renderAffixRadar();
  }

  function renderEquipmentSlots() {
    const container = document.getElementById('equipment-slots-grid');
    if (!container) return;
    container.innerHTML = '';

    const allSlots = Object.values(SLOTS);
    allSlots.forEach(slotKey => {
      const sInfo = SLOT_INFO[slotKey];
      const item = controller.data.equipment[slotKey];

      const slotElem = document.createElement('div');
      slotElem.className = 'equip-slot';

      if (item) {
        const qInfo = QUALITY_INFO[item.quality];
        slotElem.style.borderColor = qInfo.color;
        slotElem.innerHTML = `
          <span class="slot-icon">${sInfo.icon}</span>
          <span class="slot-item-name" style="color: ${qInfo.color}">${item.nameZh}</span>
        `;
      } else {
        slotElem.innerHTML = `
          <span class="slot-icon">${sInfo.icon}</span>
          <span class="slot-empty-label">${t(slotKey === SLOTS.SWORD ? 'slot_sword' : 'no_gear_equipped', currentLang)}</span>
        `;
      }

      container.appendChild(slotElem);
    });
  }

  function renderAffixRadar() {
    const container = document.getElementById('affixes-summary');
    if (!container) return;
    container.innerHTML = '';

    const affs = controller.playerStats.affixes;
    const affKeys = ['crit', 'dodge', 'counter', 'combo', 'stun', 'lifesteal'];

    affKeys.forEach(k => {
      const val = affs[k] || 0;
      const chip = document.createElement('div');
      chip.className = 'affix-summary-chip';
      chip.innerHTML = `
        <span class="chip-name">${t(`affix_${k}`, currentLang)}</span>
        <span class="chip-val">${val.toFixed(1)}%</span>
      `;
      container.appendChild(chip);
    });
  }

  function renderTribulationInfo() {
    const boss = getBossById(controller.data.realmId);
    const title = document.getElementById('trib-boss-name');
    const desc = document.getElementById('trib-boss-stats');
    if (title) title.textContent = `${boss.nameZh} (${boss.enName})`;
    if (desc) {
      desc.textContent = `${t('stat_hp', currentLang)}: ${formatNumber(boss.hp)} | ${t('stat_atk', currentLang)}: ${formatNumber(boss.atk)} | ${t('stat_def', currentLang)}: ${formatNumber(boss.def)}`;
    }
  }

  function renderAbyssInfo() {
    const nextFloor = controller.data.highestAbyssFloor + 1;
    const boss = calcAbyssBoss(nextFloor);

    const title = document.getElementById('abyss-boss-name');
    const floorLbl = document.getElementById('abyss-floor-text');
    const stats = document.getElementById('abyss-boss-stats');

    if (floorLbl) floorLbl.textContent = `${t('abyss_floor_label', currentLang)}: ${nextFloor}`;
    if (title) title.textContent = `${boss.nameZh} (${boss.enName})`;
    if (stats) {
      stats.textContent = `${t('stat_hp', currentLang)}: ${formatNumber(boss.hp)} | ${t('stat_atk', currentLang)}: ${formatNumber(boss.atk)} | ${t('stat_def', currentLang)}: ${formatNumber(boss.def)}`;
    }
  }

  function renderCauldronInfo() {
    const lvl = controller.data.cauldronLevel;
    const tier = CAULDRON_TIERS[lvl - 1];
    const isMax = lvl >= 15;

    const lvlElem = document.getElementById('cauldron-cur-level');
    const costElem = document.getElementById('cauldron-cost-val');
    const btn = document.getElementById('upgrade-cauldron-btn');

    if (lvlElem) lvlElem.textContent = `${lvl} / 15`;
    if (costElem) {
      costElem.textContent = isMax ? t('cauldron_max_level', currentLang) : `${formatNumber(tier.cost)} ${t('spirit_stones', currentLang)}`;
    }
    if (btn) btn.disabled = isMax || controller.data.spiritStones < tier.cost;

    // Render probability bars
    const ratesContainer = document.getElementById('cauldron-rates-list');
    if (ratesContainer) {
      ratesContainer.innerHTML = '';
      const qKeys = [
        'quality_common',
        'quality_fine',
        'quality_rare',
        'quality_epic',
        'quality_legendary',
        'quality_mythic'
      ];
      tier.rates.forEach((rate, i) => {
        const row = document.createElement('div');
        row.className = 'rate-row';
        row.innerHTML = `
          <span>${t(qKeys[i], currentLang)}</span>
          <span>${(rate * 100).toFixed(1)}%</span>
        `;
        ratesContainer.appendChild(row);
      });
    }
  }

  function renderCombatResult(res, container) {
    if (!container) return;
    container.innerHTML = '';

    const summary = document.createElement('div');
    summary.className = `combat-summary-banner ${res.won ? 'victory' : 'defeat'}`;
    summary.textContent = res.won ? t('combat_victory', currentLang) : t('combat_defeat', currentLang);
    container.appendChild(summary);

    // Render turn logs
    res.logs.forEach(log => {
      const line = document.createElement('div');
      line.className = 'combat-log-line';
      if (log.action === 'crit') {
        line.innerHTML = `[T${log.turn}] 💥 <span class="actor-${log.actor}">${log.actor}</span> dealt CRIT ${log.damage} DMG!`;
      } else if (log.action === 'miss') {
        line.innerHTML = `[T${log.turn}] 💨 <span class="actor-${log.actor}">${log.actor}</span> missed / target dodged!`;
      } else if (log.action === 'counter') {
        line.innerHTML = `[T${log.turn}] 🛡️ <span class="actor-${log.actor}">${log.actor}</span> counter-attacked for ${log.damage} DMG!`;
      } else {
        line.innerHTML = `[T${log.turn}] <span class="actor-${log.actor}">${log.actor}</span> hit for ${log.damage} DMG. (Target HP: ${log.targetHp})`;
      }
      container.appendChild(line);
    });
  }

  function showOfflineModal(gains) {
    const modal = document.getElementById('offline-modal');
    const stonesElem = document.getElementById('offline-stones-val');
    const cauldronStonesElem = document.getElementById('offline-cauldron-val');
    if (stonesElem) stonesElem.textContent = formatNumber(gains.spiritStones);
    if (cauldronStonesElem) cauldronStonesElem.textContent = formatNumber(gains.cauldronStones);
    if (modal) modal.showModal();
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
