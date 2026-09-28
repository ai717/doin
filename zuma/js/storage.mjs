const SAVE_KEY = 'doin.zuma.v1';

const defaultData = {
    bestScore: 0,
    level: 1
};

export function loadSave() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (typeof parsed.bestScore === 'number' && typeof parsed.level === 'number') {
                return parsed;
            }
        }
    } catch (e) {
        console.warn("存档读取失败，使用默认值", e);
    }
    return { ...defaultData };
}

export function saveSave(data) {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn("存档写入失败", e);
    }
}
