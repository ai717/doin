const dict = {
    zh: {
        title: "祖玛传奇",
        subtitle: "阿兹特克符文秘境",
        start: "探索秘境",
        select_diff: "选择难度",
        diff_easy: "简单",
        diff_medium: "中等",
        diff_hard: "困难",
        score: "分数",
        best: "最高",
        paused: "战局暂歇",
        resume: "继续",
        restart: "重新开局",
        to_menu: "返回主界面",
        gameover: "秘境坍塌",
        final_score: "最终得分",
        try_again: "再试一次",
        victory: "秘境肃清！",
        next_level: "晋级挑战"
        ,back_home: "返回首页"
    },
    en: {
        title: "ZUMA LEGEND",
        subtitle: "TEMPLE OF AZTEC RUNES",
        start: "ENTER TEMPLE",
        select_diff: "SELECT DIFFICULTY",
        diff_easy: "Easy",
        diff_medium: "Medium",
        diff_hard: "Hard",
        score: "Score",
        best: "Best",
        paused: "TEMPLE REST",
        resume: "Resume",
        restart: "Restart",
        to_menu: "Main Menu",
        gameover: "TEMPLE COLLAPSE",
        final_score: "Final Score",
        try_again: "Try Again",
        victory: "TEMPLE CLEARED!",
        next_level: "Next Rank"
        ,back_home: "Home"
    }
};

const LANG_KEY = 'doin.lang';
let currentLang = 'zh';

export function initI18n() {
    try {
        const stored = localStorage.getItem(LANG_KEY);
        if (stored && dict[stored]) {
            currentLang = stored;
        }
    } catch {
        // localStorage 安全回退
    }
    applyTranslations();
}

export function toggleLang() {
    currentLang = currentLang === 'zh' ? 'en' : 'zh';
    try {
        localStorage.setItem(LANG_KEY, currentLang);
    } catch {
        // 安全降级
    }
    applyTranslations();
    updateLangBtn();
}

export function getCurrentLang() {
    return currentLang;
}

export function applyTranslations() {
    const nodes = document.querySelectorAll('[data-i18n]');
    nodes.forEach(node => {
        const key = node.getAttribute('data-i18n');
        if (dict[currentLang] && dict[currentLang][key]) {
            node.innerText = dict[currentLang][key];
        }
    });
}

function updateLangBtn() {
    const btn = document.getElementById('btn-lang');
    if (btn) {
        btn.innerText = currentLang === 'zh' ? '🌐 EN' : '🌐 中文';
    }
}
