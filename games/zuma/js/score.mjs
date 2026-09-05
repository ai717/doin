import { loadSave, saveSave } from './storage.mjs?v=dev';
import { updateScoreUI } from './ui.mjs?v=dev';

let score = 0;
let saveData = loadSave();

export function addScore(points) {
    score += points;
    let newBest = false;
    
    if (score > saveData.bestScore) {
        saveData.bestScore = score;
        saveSave(saveData);
        newBest = true;
    }
    
    updateScoreUI(score, saveData.bestScore);
    return newBest;
}

export function resetScore() {
    score = 0;
    updateScoreUI(score, saveData.bestScore);
}

export function getScore() {
    return score;
}

export function getBestScore() {
    return saveData.bestScore;
}

export function getLevel() {
    return saveData.level;
}

export function nextLevel() {
    saveData.level += 1;
    saveSave(saveData);
}

export function resetLevel() {
    saveData.level = 1;
    saveSave(saveData);
}
