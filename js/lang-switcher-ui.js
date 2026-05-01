// ============================================================
//  LANG SWITCHER UI — перетворює native <select> у пігулки
//  Підключається на всіх сторінках, нічого не ламає.
// ============================================================

(() => {
  const LABELS = { ua: 'UA', pl: 'PL', en: 'EN' };

  function init() {
    const select = document.getElementById('langSwitcher');
    if (!select) return;

    const wrapper = select.closest('.lang-switcher');
    if (!wrapper) return;

    // Ховаємо нативний select (залишаємо в DOM — JS слухає його)
    select.style.cssText = 'position:absolute;opacity:0;width:0;height:0;pointer-events:none';

    // Будуємо пігулки
    const pills = document.createElement('div');
    pills.className = 'lang-pills';

    const currentLang = localStorage.getItem('lang') || select.value || 'ua';
    select.value = currentLang;

    Object.entries(LABELS).forEach(([code, label]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lang-pill' + (code === currentLang ? ' is-active' : '');
      btn.dataset.lang = code;
      btn.textContent = label;
      btn.addEventListener('click', () => {
        select.value = code;
        select.dispatchEvent(new Event('change'));
        pills
          .querySelectorAll('.lang-pill')
          .forEach((b) => b.classList.toggle('is-active', b.dataset.lang === code));
        localStorage.setItem('lang', code);
      });
      pills.appendChild(btn);
    });

    wrapper.appendChild(pills);

    // Синхронізація коли select змінюється програмно (наприклад, з profile.js)
    select.addEventListener('change', () => {
      pills
        .querySelectorAll('.lang-pill')
        .forEach((b) => b.classList.toggle('is-active', b.dataset.lang === select.value));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
