// 入口主装配程序：双向绑定暂停面板难度、集成主界面回跳与无缝触控

import { initI18n, toggleLang } from './i18n.mjs?v=dev';
import { initUIElements } from './ui.mjs?v=dev';
import {
    initGame,
    startNewGame,
    handleAim,
    shootBall,
    togglePause,
    setDifficulty,
    goToMenu
} from './game.mjs?v=dev';

window.addEventListener('DOMContentLoaded', () => {
    initI18n();
    initUIElements();
    initGame();

    const btnStart = document.getElementById('btn-start');
    const btnLang = document.getElementById('btn-lang');
    const btnPause = document.getElementById('btn-pause');
    const btnResume = document.getElementById('btn-resume');
    const btnRestartPause = document.getElementById('btn-restart-pause');
    const btnMenuPause = document.getElementById('btn-menu-pause');
    const btnRestartOver = document.getElementById('btn-restart-over');
    const btnNext = document.getElementById('btn-next');
    const diffButtons = document.querySelectorAll('.diff-btn');
    const canvas = document.getElementById('game-canvas');

    // 难度按钮全局响应（支持主界面与暂停面板双向同步）
    diffButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const diff = e.currentTarget.getAttribute('data-diff');
            setDifficulty(diff);
        });
    });

    if (btnStart) {
        btnStart.addEventListener('click', () => startNewGame(false));
    }

    if (btnLang) {
        btnLang.addEventListener('click', toggleLang);
    }

    if (btnPause) {
        btnPause.addEventListener('click', togglePause);
    }

    if (btnResume) {
        btnResume.addEventListener('click', togglePause);
    }

    if (btnRestartPause) {
        btnRestartPause.addEventListener('click', () => {
            togglePause();
            startNewGame(false);
        });
    }

    if (btnMenuPause) {
        btnMenuPause.addEventListener('click', goToMenu);
    }

    if (btnRestartOver) {
        btnRestartOver.addEventListener('click', () => startNewGame(false));
    }

    if (btnNext) {
        btnNext.addEventListener('click', () => startNewGame(true));
    }

    // 瞄准与击发
    if (canvas) {
        window.addEventListener('mousemove', (e) => {
            handleAim(e.clientX, e.clientY);
        });

        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                handleAim(e.clientX, e.clientY);
                shootBall();
            }
        });

        canvas.addEventListener('touchstart', (e) => {
            if (e.touches && e.touches.length > 0) {
                const touch = e.touches[0];
                handleAim(touch.clientX, touch.clientY);
                shootBall();
            }
        }, { passive: true });

        canvas.addEventListener('touchmove', (e) => {
            if (e.touches && e.touches.length > 0) {
                const touch = e.touches[0];
                handleAim(touch.clientX, touch.clientY);
            }
        }, { passive: true });
    }
});
