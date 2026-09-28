import {
  clearRun,
  normalizeBoard,
  normalizeDifficulty,
  readBest,
  readBoard,
  readDifficulty,
  readMuted,
  readRun,
  recordBest,
  writeBoard,
  writeDifficulty,
  writeMuted,
  writeRun,
} from "./storage.mjs";
import { format, htmlLang, loadLocale, saveLocale, strings } from "./i18n.mjs";
import {
  BagRandomizer,
  BOARD_CONFIGS,
  createMatrix,
  createPiece,
  collide,
  dropIntervalFor,
  dropPosition,
  findFullRows,
  levelForLines,
  mergeInto,
  removeRows,
  rotateWithKick,
  scoreForLines,
  SHAPES,
} from "./engine.mjs";

// 文案双表在 js/i18n.mjs；这里保持 I18N[locale].key 的既有调用形状。
const I18N = { zh: strings("zh"), en: strings("en") };

(function () {
    class SoundEngine {
        constructor() {
            this.ctx = null;
            this.muted = readMuted();
        }

        init() {
            if (!this.ctx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                this.ctx = new AudioCtx();
            }
        }

        toggleMute() {
            this.muted = writeMuted(!this.muted);
            return this.muted;
        }

        play(type) {
            if (this.muted) return;
            this.init();
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }

            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);

            if (type === 'move') {
                osc.frequency.setValueAtTime(160, now);
                osc.frequency.exponentialRampToValueAtTime(70, now + 0.04);
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.linearRampToValueAtTime(0.001, now + 0.04);
                osc.start(now);
                osc.stop(now + 0.04);
            } else if (type === 'drop') {
                osc.frequency.setValueAtTime(75, now);
                osc.frequency.exponentialRampToValueAtTime(25, now + 0.08);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.linearRampToValueAtTime(0.001, now + 0.08);
                osc.start(now);
                osc.stop(now + 0.08);
            } else if (type === 'clear') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.setValueAtTime(660, now + 0.06);
                osc.frequency.setValueAtTime(880, now + 0.12);
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.linearRampToValueAtTime(0.001, now + 0.22);
                osc.start(now);
                osc.stop(now + 0.22);
            } else if (type === 'gameover') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.linearRampToValueAtTime(40, now + 0.4);
                gain.gain.setValueAtTime(0.18, now);
                gain.gain.linearRampToValueAtTime(0.001, now + 0.4);
                osc.start(now);
                osc.stop(now + 0.4);
            }
        }
    }

    const bagRandomizer = new BagRandomizer(Object.keys(SHAPES));

    const canvas = document.getElementById('tetris');
    const ctx = canvas.getContext('2d');
    const screenGlass = document.getElementById('screen-glass');
    const screenFrame = document.getElementById('screen-frame');
    const nextCanvas = document.getElementById('next-canvas');
    const nextCtx = nextCanvas.getContext('2d');

    const scoreEl = document.getElementById('score');
    const highScoreEl = document.getElementById('high-score');
    const levelEl = document.getElementById('level');
    const linesEl = document.getElementById('lines');

    const overlay = document.getElementById('game-overlay');
    const startBtn = document.getElementById('start-btn');
    const overlayTitle = document.getElementById('overlay-title');
    const overlayMsg = document.getElementById('overlay-msg');

    const diffPills = document.getElementById('diff-pills');
    const boardPills = document.getElementById('board-pills');

    const helpOverlay = document.getElementById('help-overlay');
    const helpBtn = document.getElementById('help-btn');
    const closeHelpBtn = document.getElementById('close-help-btn');
    const helpTitle = document.getElementById('help-title');
    const helpText = document.getElementById('help-text');

    const pauseBtn = document.getElementById('pause-btn');
    const soundBtn = document.getElementById('sound-btn');
    const langBtn = document.getElementById('lang-btn');

    const sounds = new SoundEngine();

    let lang = loadLocale();
    let currentDiff = readDifficulty();
    let currentBoard = readBoard();

    let cols = BOARD_CONFIGS[currentBoard].cols;
    let rows = BOARD_CONFIGS[currentBoard].rows;
    let blockSize = 24;

    let highScore = readBest(currentBoard, currentDiff);

    let grid = createMatrix(cols, rows);
    let score = 0;
    let lines = 0;
    let level = 1;
    let gameOver = false;
    let isRunning = false;
    let isPaused = false;
    let hasSavedProgress = false;

    let isDropLocked = false;
    let dropCounter = 0;
    let dropInterval = dropIntervalFor(currentDiff, 1);
    let lastTime = 0;

    let piece = null;
    let nextPiece = null;
    let particles = [];

    // 智能布局：撑满横向视口，严格锁定 1:1 正方形
    function updateDimensions() {
        const frameRect = screenFrame.getBoundingClientRect();
        const availableW = frameRect.width;
        const availableH = frameRect.height;

        const sizeByHeight = Math.floor(availableH / rows);
        const sizeByWidth = Math.floor(availableW / cols);
        blockSize = Math.max(14, Math.min(sizeByHeight, sizeByWidth));

        const pixelW = cols * blockSize;
        const pixelH = rows * blockSize;

        canvas.width = pixelW;
        canvas.height = pixelH;
        canvas.style.width = pixelW + 'px';
        canvas.style.height = pixelH + 'px';

        screenGlass.style.width = pixelW + 'px';
        screenGlass.style.height = pixelH + 'px';

        if (nextPiece) drawNextPiece();
    }

    window.addEventListener('resize', updateDimensions);

    // 出块横坐标依赖当前棋盘宽度，cols 属于 main 的布局状态，故在此包一层。
    function spawnPiece(type) {
        return createPiece(type, cols);
    }

    function spawnNextPiece() {
        return spawnPiece(bagRandomizer.next());
    }

    function updateLanguage() {
        document.documentElement.lang = htmlLang(lang);
        document.title = I18N[lang].docTitle;
        langBtn.innerText = lang === 'zh' ? '中文' : 'EN';
        helpTitle.innerText = I18N[lang].helpTitle;
        helpText.innerHTML = I18N[lang].helpContent;
        closeHelpBtn.innerText = I18N[lang].btnConfirm;

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (I18N[lang][key]) {
                el.innerText = I18N[lang][key];
            }
        });

        diffPills.querySelectorAll('.pill-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.val === currentDiff);
        });
        boardPills.querySelectorAll('.pill-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.val === currentBoard);
        });

        if (isPaused) {
            overlayTitle.innerText = I18N[lang].titlePause;
            overlayMsg.innerText = I18N[lang].msgPause;
            startBtn.innerText = I18N[lang].btnResume;
        } else if (!isRunning) {
            if (gameOver) {
                overlayTitle.innerText = I18N[lang].titleOver;
                overlayMsg.innerText = format(I18N[lang].msgOver, score);
                startBtn.innerText = I18N[lang].btnRestart;
            } else if (hasSavedProgress) {
                overlayTitle.innerText = I18N[lang].titleResume;
                overlayMsg.innerText = I18N[lang].msgResume;
                startBtn.innerText = I18N[lang].btnResume;
            } else {
                overlayTitle.innerText = I18N[lang].titleStart;
                overlayMsg.innerText = I18N[lang].msgStart;
                startBtn.innerText = I18N[lang].btnStart;
            }
        }
    }

    function saveState() {
        if (gameOver || !isRunning) return;
        writeRun(currentBoard, currentDiff, {
            grid,
            score,
            lines,
            level,
            piece,
            nextPieceType: nextPiece ? nextPiece.type : null,
            bag: bagRandomizer.bag
        });
    }

    function clearSavedState() {
        clearRun(currentBoard, currentDiff);
        hasSavedProgress = false;
    }

    // 快照形状已由 storage 的白名单校验；这里再核一次维度与数值，坏档直接当没有存档。
    function loadState() {
        const state = readRun(currentBoard, currentDiff);
        if (!state) return false;
        if (state.grid.length !== rows || state.grid.some(row => row.length !== cols)) return false;

        grid = state.grid;
        score = Number(state.score) || 0;
        lines = Number(state.lines) || 0;
        level = Math.max(1, Number(state.level) || 1);
        piece = state.piece;
        nextPiece = spawnPiece(SHAPES[state.nextPieceType] ? state.nextPieceType : 'I');
        if (Array.isArray(state.bag)) bagRandomizer.bag = state.bag;

        dropInterval = dropIntervalFor(currentDiff, level);
        return true;
    }

    function rotate() {
        if (!isRunning || isPaused || gameOver) return;
        const rotated = rotateWithKick(grid, piece);
        // 墙踢全部失败时保持原姿态：不能像旧实现那样只还原 matrix 却留下累加的 pos.x 偏移。
        if (!rotated) return;
        piece = rotated;
        sounds.play('move');
        saveState();
    }

    function move(dir) {
        if (!isRunning || isPaused || gameOver) return;
        piece.pos.x += dir;
        if (collide(grid, piece)) {
            piece.pos.x -= dir;
        } else {
            sounds.play('move');
            saveState();
        }
    }

    function hardDrop() {
        if (!isRunning || isPaused || gameOver || isDropLocked) return;
        piece.pos.y = dropPosition(grid, piece);
        // 防连落锁由 drop() 在方块真正合并后置位；提前置位会被 drop 的 isManual 守卫直接吞掉。
        drop(true);
    }

    function drop(isManual = false) {
        if (!isRunning || isPaused || gameOver) return;
        if (isManual && isDropLocked) return;

        piece.pos.y++;
        if (collide(grid, piece)) {
            piece.pos.y--;
            mergeInto(grid, piece);
            sounds.play('drop');
            clearLines();
            resetPiece();
            if (isManual) {
                isDropLocked = true;
            }
        }
        dropCounter = 0;
        saveState();
    }

    function createExplosion(y) {
        for (let x = 0; x < cols; x++) {
            for (let i = 0; i < 3; i++) {
                particles.push({
                    x: x * blockSize + blockSize / 2,
                    y: y * blockSize + blockSize / 2,
                    vx: (Math.random() - 0.5) * 6,
                    vy: (Math.random() - 0.5) * 6,
                    alpha: 1,
                    color: grid[y][x] || '#00f0ff'
                });
            }
        }
    }

    function clearLines() {
        const fullRows = findFullRows(grid);
        if (fullRows.length === 0) return;

        // 先取色再删行：爆炸粒子要用被消掉那一行的原色。
        fullRows.forEach(y => createExplosion(y));
        grid = removeRows(grid, fullRows);

        sounds.play('clear');
        score += scoreForLines(fullRows.length, level);
        lines += fullRows.length;
        level = levelForLines(lines);
        dropInterval = dropIntervalFor(currentDiff, level);

        if (score > highScore) {
            highScore = recordBest(currentBoard, currentDiff, score);
        }
        updateUI();
    }

    function resetPiece() {
        piece = nextPiece;
        nextPiece = spawnNextPiece();
        drawNextPiece();
        if (collide(grid, piece)) {
            gameOver = true;
            isRunning = false;
            sounds.play('gameover');
            clearSavedState();
            overlayTitle.innerText = I18N[lang].titleOver;
            overlayMsg.innerText = I18N[lang].msgOver.replace('{score}', score);
            startBtn.innerText = I18N[lang].btnRestart;
            overlay.classList.remove('hidden');
        }
    }

    function updateUI() {
        scoreEl.innerText = score;
        highScoreEl.innerText = highScore;
        levelEl.innerText = level;
        linesEl.innerText = lines;
    }

    function drawNextPiece() {
        nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
        if (!nextPiece) return;
        const m = nextPiece.matrix;
        const size = 9;
        const offsetX = (nextCanvas.width - m[0].length * size) / 2;
        const offsetY = (nextCanvas.height - m.length * size) / 2;

        m.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    drawBlock(nextCtx, offsetX + x * size, offsetY + y * size, size, nextPiece.color);
                }
            });
        });
    }

    function drawBlock(c, px, py, size, color) {
        c.fillStyle = color;
        c.fillRect(px + 1, py + 1, size - 2, size - 2);

        c.fillStyle = 'rgba(255, 255, 255, 0.35)';
        c.fillRect(px + 1, py + 1, size - 2, 2);
        c.fillRect(px + 1, py + 1, 2, size - 2);

        c.fillStyle = 'rgba(0, 0, 0, 0.35)';
        c.fillRect(px + 1, py + size - 3, size - 2, 2);
        c.fillRect(px + size - 3, py + 1, 2, size - 2);
    }

    function drawGhostPiece() {
        const ghostY = dropPosition(grid, piece);
        piece.matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(
                        (piece.pos.x + x) * blockSize + 1,
                        (ghostY + y) * blockSize + 1,
                        blockSize - 2,
                        blockSize - 2
                    );
                }
            });
        });
    }

    function drawParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= 0.04;
            if (p.alpha <= 0) {
                particles.splice(i, 1);
            } else {
                ctx.save();
                ctx.globalAlpha = p.alpha;
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x, p.y, 3, 3);
                ctx.restore();
            }
        }
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= cols; x++) {
            ctx.beginPath();
            ctx.moveTo(x * blockSize, 0);
            ctx.lineTo(x * blockSize, rows * blockSize);
            ctx.stroke();
        }
        for (let y = 0; y <= rows; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * blockSize);
            ctx.lineTo(cols * blockSize, y * blockSize);
            ctx.stroke();
        }

        grid.forEach((row, y) => {
            row.forEach((color, x) => {
                if (color !== 0) {
                    drawBlock(ctx, x * blockSize, y * blockSize, blockSize, color);
                }
            });
        });

        if (piece && isRunning) {
            drawGhostPiece();
            piece.matrix.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value !== 0) {
                        drawBlock(
                            ctx,
                            (piece.pos.x + x) * blockSize,
                            (piece.pos.y + y) * blockSize,
                            blockSize,
                            piece.color
                        );
                    }
                });
            });
        }

        drawParticles();
    }

    function update(time = 0) {
        const deltaTime = time - lastTime;
        lastTime = time;

        if (isRunning && !isPaused && !gameOver) {
            dropCounter += deltaTime;
            if (dropCounter > dropInterval) {
                drop(false);
            }
        }

        draw();
        requestAnimationFrame(update);
    }

    function togglePause() {
        if (!isRunning) {
            if (gameOver) return;
            resumeOrStart();
            return;
        }

        isPaused = !isPaused;
        pauseBtn.innerText = isPaused ? '▶' : '⏸';

        if (isPaused) {
            overlayTitle.innerText = I18N[lang].titlePause;
            overlayMsg.innerText = I18N[lang].msgPause;
            startBtn.innerText = I18N[lang].btnResume;
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }

    function startNewGame() {
        clearSavedState();
        bagRandomizer.reset();
        grid = createMatrix(cols, rows);
        score = 0;
        lines = 0;
        level = 1;
        dropInterval = dropIntervalFor(currentDiff, 1);
        gameOver = false;
        isRunning = true;
        isPaused = false;
        isDropLocked = false;
        particles = [];
        pauseBtn.innerText = '⏸';
        updateUI();

        nextPiece = spawnNextPiece();
        resetPiece();
        saveState();

        overlay.classList.add('hidden');
    }

    function resumeOrStart() {
        sounds.init();
        if (isPaused) {
            togglePause();
            return;
        }
        if (hasSavedProgress && loadState()) {
            gameOver = false;
            isRunning = true;
            isPaused = false;
            particles = [];
            pauseBtn.innerText = '⏸';
            updateUI();
            drawNextPiece();
            overlay.classList.add('hidden');
        } else {
            startNewGame();
        }
    }

    // 键盘监听
    document.addEventListener('keydown', e => {
        if (e.code === 'KeyP' || e.code === 'Escape') {
            togglePause();
            return;
        }

        if (!isRunning || isPaused || gameOver) return;

        switch (e.code) {
            case 'ArrowLeft':
            case 'KeyA':
                move(-1);
                break;
            case 'ArrowRight':
            case 'KeyD':
                move(1);
                break;
            case 'ArrowDown':
            case 'KeyS':
                drop(true);
                break;
            case 'ArrowUp':
            case 'KeyW':
                rotate();
                break;
            case 'Space':
                e.preventDefault();
                hardDrop();
                break;
        }
    });

    document.addEventListener('keyup', e => {
        if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'Space') {
            isDropLocked = false;
        }
    });

    // 虚拟手柄按键
    const bindBtn = (id, onDown, onUp) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            onDown();
        });
        if (onUp) {
            el.addEventListener('pointerup', onUp);
            el.addEventListener('pointercancel', onUp);
            el.addEventListener('pointerleave', onUp);
        }
    };

    bindBtn('btn-left', () => move(-1));
    bindBtn('btn-right', () => move(1));
    bindBtn('btn-down', () => drop(true), () => { isDropLocked = false; });
    bindBtn('btn-hard', () => hardDrop(), () => { isDropLocked = false; });
    bindBtn('btn-rotate', () => rotate());

    // 统一指针手势引擎
    let ptrStartX = 0;
    let ptrStartY = 0;
    let ptrTotalMoveX = 0;
    let ptrTotalMoveY = 0;
    let isPointerDown = false;
    let lastTapTime = 0;

    canvas.addEventListener('pointerdown', e => {
        if (!isRunning || isPaused || gameOver) return;
        if (e.button !== undefined && e.button !== 0) return;

        canvas.setPointerCapture(e.pointerId);
        isPointerDown = true;
        ptrStartX = e.clientX;
        ptrStartY = e.clientY;
        ptrTotalMoveX = 0;
        ptrTotalMoveY = 0;

        const now = Date.now();
        if (now - lastTapTime < 260) {
            hardDrop();
            lastTapTime = 0;
        } else {
            lastTapTime = now;
        }
    });

    canvas.addEventListener('pointermove', e => {
        if (!isPointerDown || !isRunning || isPaused || gameOver) return;

        const deltaX = e.clientX - ptrStartX;
        const deltaY = e.clientY - ptrStartY;
        const step = blockSize * 0.8;

        ptrTotalMoveX += Math.abs(deltaX);
        ptrTotalMoveY += Math.abs(deltaY);

        if (Math.abs(deltaX) > step) {
            move(deltaX > 0 ? 1 : -1);
            ptrStartX = e.clientX;
        }

        if (deltaY > step * 1.3) {
            drop(true);
            ptrStartY = e.clientY;
        }
    });

    const handlePointerEnd = (e) => {
        if (!isPointerDown) return;
        isPointerDown = false;
        isDropLocked = false;
        try {
            if (canvas.hasPointerCapture(e.pointerId)) {
                canvas.releasePointerCapture(e.pointerId);
            }
        } catch (_) {}

        if (!isRunning || isPaused || gameOver) return;

        const totalDiffY = e.clientY - ptrStartY;
        if (totalDiffY < -28) {
            rotate();
            return;
        }
        if (ptrTotalMoveX < 8 && ptrTotalMoveY < 8) {
            rotate();
        }
    };

    canvas.addEventListener('pointerup', handlePointerEnd);
    canvas.addEventListener('pointercancel', handlePointerEnd);

    // 交互按键
    startBtn.addEventListener('click', resumeOrStart);
    pauseBtn.addEventListener('click', togglePause);

    soundBtn.addEventListener('click', () => {
        const isMuted = sounds.toggleMute();
        soundBtn.innerText = isMuted ? '🔇' : '🔊';
    });

    langBtn.addEventListener('click', () => {
        lang = lang === 'zh' ? 'en' : 'zh';
        saveLocale(lang);
        updateLanguage();
    });

    helpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isRunning && !isPaused && !gameOver) {
            togglePause();
        }
        helpOverlay.classList.remove('hidden');
    });

    closeHelpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        helpOverlay.classList.add('hidden');
    });

    // 底部外露选择器事件
    diffPills.addEventListener('click', e => {
        const btn = e.target.closest('.pill-btn');
        if (!btn) return;

        const next = normalizeDifficulty(btn.dataset.val);
        if (next === currentDiff) return;

        currentDiff = next;
        writeDifficulty(currentDiff);
        diffPills.querySelectorAll('.pill-btn').forEach(b => b.classList.toggle('active', b.dataset.val === currentDiff));

        highScore = readBest(currentBoard, currentDiff);
        startNewGame();
        updateLanguage();
    });

    boardPills.addEventListener('click', e => {
        const btn = e.target.closest('.pill-btn');
        if (!btn) return;

        const next = normalizeBoard(btn.dataset.val);
        if (next === currentBoard) return;

        currentBoard = next;
        writeBoard(currentBoard);
        boardPills.querySelectorAll('.pill-btn').forEach(b => b.classList.toggle('active', b.dataset.val === currentBoard));

        const cfg = BOARD_CONFIGS[currentBoard];
        cols = cfg.cols;
        rows = cfg.rows;

        updateDimensions();
        highScore = readBest(currentBoard, currentDiff);
        startNewGame();
        updateLanguage();
    });

    // 初始化启动
    soundBtn.innerText = sounds.muted ? '🔇' : '🔊';
    updateDimensions();
    highScoreEl.innerText = highScore;
    hasSavedProgress = !!readRun(currentBoard, currentDiff);
    updateLanguage();

    requestAnimationFrame(update);
})();
