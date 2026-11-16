/**
 * Immortal Box (摸鱼开箱修仙传) - Score & Cultivation Titles
 * Zero DOM, pure calculation.
 */

export function getCultivationTitle(realmId = 1) {
  if (realmId >= 21) return { id: 'immortal', key: 'title_immortal', icon: '🌌' };
  if (realmId >= 19) return { id: 'sovereign', key: 'title_sovereign', icon: '👑' };
  if (realmId >= 14) return { id: 'patriarch', key: 'title_patriarch', icon: '🔮' };
  if (realmId >= 10) return { id: 'paragon', key: 'title_paragon', icon: '✨' };
  if (realmId >= 5) return { id: 'master', key: 'title_master', icon: '⚔️' };
  return { id: 'novice', key: 'title_novice', icon: '🌱' };
}

export function formatNumber(num) {
  if (typeof num !== 'number' || isNaN(num)) return '0';
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  }
  if (num >= 10000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return Math.round(num).toString();
}
