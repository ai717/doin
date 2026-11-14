import { Match3Engine, SPECIAL_TYPES } from './engine.mjs';
import { ScoreManager } from './score.mjs';
import { StorageManager } from './storage.mjs';
import { AudioManager } from './audio.mjs';
import { getLevelConfig, LEVEL_CONFIGS } from './levels.mjs';
import { i18n } from './i18n.mjs';

export const GAME_STATES = {
  IDLE: 'IDLE',
  BUSY: 'BUSY',
  OVER: 'OVER'
};

export class GameManager {
  constructor(uiManager) {
    this.ui = uiManager;
    this.scoreMgr = new ScoreManager(0);
    this.audio = new AudioManager(true);

    this.currentLevelId = 1;
    this.levelConfig = getLevelConfig(1);
    this.engine = new Match3Engine(this.levelConfig.colors);

    this.state = GAME_STATES.IDLE;
    this.selected = null;
    this.movesLeft = this.levelConfig.moves;
    this.currentGoals = {};
    this.bufferedMove = null;

    this.saveData = StorageManager.load();
  }

  init() {
    this.audio.enabled = this.saveData.soundEnabled;
    this.ui.setAudioIcon(this.audio.enabled);
    this.ui.setLangTag(i18n.getLanguage());

    this.currentLevelId = this.saveData.unlockedLevel || 1;
    this.loadLevel(this.currentLevelId);
  }

  loadLevel(levelId) {
    this.currentLevelId = levelId;
    this.levelConfig = getLevelConfig(levelId);
    this.engine = new Match3Engine(this.levelConfig.colors);

    this.state = GAME_STATES.IDLE;
    this.selected = null;
    this.bufferedMove = null;
    this.movesLeft = this.levelConfig.moves;
    this.scoreMgr.reset();

    this.currentGoals = { ...this.levelConfig.goals };

    this.engine.initBoard();
    this.ui.renderInitialBoard(this.engine.grid, (r, c) => this.handleTileClick(r, c));
    this.updateHUD();
  }

  updateHUD() {
    this.ui.updateHUD(
      this.currentGoals,
      this.movesLeft,
      this.scoreMgr.getScore(),
      this.levelConfig,
      i18n
    );
  }

  async handleTileClick(r, c) {
    if (this.state === GAME_STATES.OVER) return;

    this.ui.clearHint();

    if (!this.selected) {
      this.selected = { r, c };
      this.ui.setSelected(this.selected, true);
      this.audio.playSelect();
      return;
    }

    const prev = { ...this.selected };
    this.selected = null;
    this.ui.setSelected(prev, false);

    if (prev.r === r && prev.c === c) return;

    if (this.engine.areAdjacent(prev, { r, c })) {
      if (this.state === GAME_STATES.BUSY) {
        // 下落动画中缓冲玩家点击意图，平滑执行
        this.bufferedMove = { p1: prev, p2: { r, c } };
      } else {
        await this.executePlayerMove(prev, { r, c });
      }
    } else {
      this.selected = { r, c };
      this.ui.setSelected(this.selected, true);
      this.audio.playSelect();
    }
  }

  async executePlayerMove(p1, p2) {
    this.state = GAME_STATES.BUSY;
    this.audio.playSwap();

    await this.ui.animateSwap(p1, p2);
    this.engine.swap(p1, p2);

    const t1 = this.engine.grid[p1.r][p1.c];
    const t2 = this.engine.grid[p2.r][p2.c];

    const isRainbowSwap = (t1 && t1.special === SPECIAL_TYPES.RAINBOW) || (t2 && t2.special === SPECIAL_TYPES.RAINBOW);

    let initialMatches = [];
    let initialCreations = [];

    if (isRainbowSwap) {
      const nonRainbow = (t1 && t1.special === SPECIAL_TYPES.RAINBOW) ? t2 : t1;
      const targetColor = nonRainbow && nonRainbow.color !== 0 ? nonRainbow.color : 1;
      this.audio.playRainbow();
      initialMatches = this.engine.triggerRainbowClear(targetColor);
    } else {
      const analysis = this.engine.resolveMatchAnalysis(p2);
      if (analysis.matches.length === 0) {
        this.audio.playInvalid();
        await this.ui.animateSwap(p1, p2);
        this.engine.swap(p1, p2);
        this.finishBusyCycle();
        return;
      }
      initialMatches = this.engine.expandSpecialElimination(analysis.matches);
      initialCreations = analysis.creations;
    }

    this.movesLeft--;
    let combo = 1;
    let clearedList = initialMatches;
    let currentCreations = initialCreations;

    while (clearedList.length > 0) {
      this.audio.playMatch(combo);
      if (combo > 1) {
        this.ui.showCombo(i18n.t('comboText', { n: combo }));
      }

      // 统计收集进度
      clearedList.forEach(p => {
        const tile = this.engine.grid[p.r][p.c];
        if (tile && this.currentGoals[tile.color] !== undefined) {
          this.currentGoals[tile.color] = Math.max(0, this.currentGoals[tile.color] - 1);
        }
      });

      this.scoreMgr.calculateMatchScore(clearedList.length, combo);
      this.updateHUD();

      // 1. 闪烁预备（明确可见消除过程）
      await this.ui.animatePreBurst(clearedList);

      // 2. 爆炸消除
      await this.ui.animateElimination(clearedList, currentCreations);

      const creationMap = new Map();
      currentCreations.forEach(c => creationMap.set(`${c.r},${c.c}`, c));

      clearedList.forEach(p => {
        const key = `${p.r},${p.c}`;
        if (creationMap.has(key)) {
          const spec = creationMap.get(key);
          const newSpecialData = this.engine.createTileData(spec.color, spec.special);
          this.engine.grid[p.r][p.c] = newSpecialData;
          this.ui.updateTileVisual(p.r, p.c, newSpecialData);
        } else {
          this.engine.grid[p.r][p.c] = null;
        }
      });

      // 3. 严格同步下落流水线
      const dropSteps = this.engine.dropAndFill();
      await this.ui.animateDropsAndSpawns(dropSteps);

      // 4. 强力兜底保真：确保每一列绝对满格无空位
      this.ui.synchronizeBoard(this.engine.grid);

      // 5. 沉稳停顿 220ms，让视线清晰辨识新格局
      await new Promise((r) => setTimeout(r, 220));

      const cascadeAnalysis = this.engine.resolveMatchAnalysis(null);
      if (cascadeAnalysis.matches.length > 0) {
        clearedList = this.engine.expandSpecialElimination(cascadeAnalysis.matches);
        currentCreations = cascadeAnalysis.creations;
        combo++;
      } else {
        clearedList = [];
        currentCreations = [];
      }
    }

    const isGoalsCompleted = Object.values(this.currentGoals).every(remain => remain <= 0);

    if (isGoalsCompleted || this.movesLeft <= 0) {
      this.state = GAME_STATES.OVER;
      this.finalizeGame(isGoalsCompleted);
      return;
    }

    // 严密死局检测与自动洗牌
    if (!this.engine.hasPossibleMoves()) {
      this.ui.showShuffleBanner(i18n.t('shuffling'));
      await new Promise((r) => setTimeout(r, 600));
      this.engine.shuffleBoard();
      this.ui.renderInitialBoard(this.engine.grid, (r, c) => this.handleTileClick(r, c));
    }

    this.finishBusyCycle();
  }

  finishBusyCycle() {
    this.state = GAME_STATES.IDLE;
    if (this.bufferedMove) {
      const nextMove = this.bufferedMove;
      this.bufferedMove = null;
      setTimeout(() => {
        this.executePlayerMove(nextMove.p1, nextMove.p2);
      }, 10);
    }
  }

  finalizeGame(isWin) {
    let movesBonus = 0;
    if (isWin) {
      movesBonus = this.movesLeft * 150;
      this.scoreMgr.addPoints(movesBonus);
      this.audio.playWin();
    } else {
      this.audio.playDefeat();
    }

    const finalScore = this.scoreMgr.getScore();
    let starCount = 0;
    if (isWin) {
      const th = this.levelConfig.starThresholdMoves;
      if (this.movesLeft >= th[2]) starCount = 3;
      else if (this.movesLeft >= th[1]) starCount = 2;
      else starCount = 1;
    }

    const curBest = this.saveData.highScores[this.currentLevelId] || 0;
    if (finalScore > curBest) {
      this.saveData.highScores[this.currentLevelId] = finalScore;
    }

    if (isWin) {
      const curStars = this.saveData.levelStars[this.currentLevelId] || 0;
      if (starCount > curStars) this.saveData.levelStars[this.currentLevelId] = starCount;

      if (this.currentLevelId === this.saveData.unlockedLevel && this.currentLevelId < LEVEL_CONFIGS.length) {
        this.saveData.unlockedLevel = this.currentLevelId + 1;
      }
    }

    StorageManager.save(this.saveData);
    this.updateHUD();
    this.ui.showResultModal(isWin, finalScore, movesBonus, starCount, i18n);
  }

  showHint() {
    if (this.state !== GAME_STATES.IDLE) return;
    const move = this.engine.getPossibleMove();
    if (move) {
      this.ui.showHint(move);
    }
  }

  toggleSound() {
    const enabled = this.audio.toggle();
    this.ui.setAudioIcon(enabled);
    this.saveData.soundEnabled = enabled;
    StorageManager.save(this.saveData);
  }

  toggleLanguage() {
    const lang = i18n.toggleLanguage();
    this.ui.setLangTag(lang);
    this.refreshTexts();
    this.updateHUD();
  }

  refreshTexts() {
    document.getElementById('i18n-game-title').textContent = i18n.t('gameTitle');
    document.getElementById('i18n-nav-level').textContent = i18n.t('levelSelect');
    document.getElementById('i18n-label-score').textContent = i18n.t('score');
    document.getElementById('i18n-label-moves').textContent = i18n.t('moves');
    document.getElementById('i18n-label-target').textContent = i18n.t('target');
    document.getElementById('i18n-btn-hint').textContent = i18n.t('hint');
    document.getElementById('i18n-btn-restart').textContent = i18n.t('restart');
    document.getElementById('i18n-level-select-title').textContent = i18n.t('levelSelectTitle');

    document.getElementById('i18n-res-score-label').textContent = i18n.t('resScoreLabel');
    document.getElementById('i18n-res-moves-label').textContent = i18n.t('resMovesLabel');
    document.getElementById('i18n-res-best-label').textContent = i18n.t('resBestLabel');
    document.getElementById('i18n-btn-replay').textContent = i18n.t('btnReplay');
    document.getElementById('i18n-btn-next').textContent = i18n.t('btnNext');
  }

  openLevelSelect() {
    this.ui.renderLevelSelector(
      LEVEL_CONFIGS,
      this.saveData.unlockedLevel,
      this.saveData.levelStars,
      (lvlId) => this.loadLevel(lvlId)
    );
    this.ui.levelModal.classList.remove('hidden');
  }

  nextLevel() {
    this.ui.hideResultModal();
    if (this.currentLevelId < LEVEL_CONFIGS.length) {
      this.loadLevel(this.currentLevelId + 1);
    } else {
      this.loadLevel(1);
    }
  }
}
