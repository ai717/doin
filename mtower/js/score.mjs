/**
 * @file games/mtower/js/score.mjs
 * 魔塔 50 层计分与段位评定核心，UI 不得自算分。
 */

export function calculateScore(state) {
  if (!state || !state.hero) {
    return { score: 0, titleKey: 'title_novice', stars: 1 };
  }

  const { hp, atk, def, gold, keys } = state.hero;
  const keyScore = (keys.y || 0) * 50 + (keys.b || 0) * 150 + (keys.r || 0) * 400;
  const statScore = atk * 25 + def * 25 + gold * 2;
  const hpScore = Math.floor(hp * 0.8);
  const floorBonus = state.currentFloor * 300;

  const total = Math.max(0, hpScore + statScore + keyScore + floorBonus);

  let titleKey = 'title_novice';
  let stars = 1;

  if (state.status === 'won') {
    if (total >= 25000) {
      titleKey = 'title_god_slayer';
      stars = 3;
    } else if (total >= 14000) {
      titleKey = 'title_holy_paladin';
      stars = 3;
    } else if (total >= 7000) {
      titleKey = 'title_iron_champion';
      stars = 2;
    } else {
      titleKey = 'title_vanguard';
      stars = 2;
    }
  } else {
    if (state.currentFloor >= 30) {
      titleKey = 'title_iron_champion';
      stars = 2;
    } else if (state.currentFloor >= 15) {
      titleKey = 'title_vanguard';
      stars = 1;
    } else {
      titleKey = 'title_novice';
      stars = 1;
    }
  }

  return {
    score: total,
    titleKey,
    stars,
    hp,
    atk,
    def,
    gold,
    floor: state.currentFloor,
    steps: state.steps,
  };
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
