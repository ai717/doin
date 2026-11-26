// main.mjs — 装配入口

import { UI } from './ui.mjs';
import { applyToDOM, getLang } from './i18n.mjs';

document.addEventListener('DOMContentLoaded', () => {
  applyToDOM();
  // 语言按钮初始文本
  const btnLang = document.getElementById('btn-lang');
  if (btnLang) btnLang.textContent = getLang() === 'en' ? '中' : 'EN';
  new UI();
});
