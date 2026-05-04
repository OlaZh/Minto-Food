// ============================================================
//  LANG SWITCHER UI — кастомний dropdown замість пігулок
// ============================================================

(() => {
  const LABELS = { ua: 'UA', pl: 'PL', en: 'EN' };

  function init() {
    const select = document.getElementById('langSwitcher');
    if (!select) return;

    const wrapper = select.closest('.lang-switcher');
    if (!wrapper) return;

    select.style.cssText = 'position:absolute;opacity:0;width:0;height:0;pointer-events:none';

    const currentLang = localStorage.getItem('lang') || select.value || 'ua';
    select.value = currentLang;

    // Будуємо dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'lang-dropdown';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lang-dropdown__btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = `<span class="lang-dropdown__current">${LABELS[currentLang]}</span><svg class="lang-dropdown__chevron" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    const menu = document.createElement('ul');
    menu.className = 'lang-dropdown__menu';
    menu.setAttribute('role', 'listbox');
    menu.hidden = true;

    Object.entries(LABELS).forEach(([code, label]) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', code === currentLang ? 'true' : 'false');
      const opt = document.createElement('button');
      opt.type = 'button';
      opt.className = 'lang-dropdown__option' + (code === currentLang ? ' is-active' : '');
      opt.dataset.lang = code;
      opt.textContent = label;
      opt.addEventListener('click', () => select_lang(code));
      li.appendChild(opt);
      menu.appendChild(li);
    });

    dropdown.appendChild(btn);
    dropdown.appendChild(menu);
    wrapper.appendChild(dropdown);

    function select_lang(code) {
      select.value = code;
      select.dispatchEvent(new Event('change'));
      localStorage.setItem('lang', code);
      btn.querySelector('.lang-dropdown__current').textContent = LABELS[code];
      menu.querySelectorAll('.lang-dropdown__option').forEach((o) => {
        o.classList.toggle('is-active', o.dataset.lang === code);
        o.closest('[role=option]').setAttribute('aria-selected', o.dataset.lang === code ? 'true' : 'false');
      });
      close_menu();
    }

    function open_menu() {
      menu.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      btn.classList.add('is-open');
    }

    function close_menu() {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      btn.classList.remove('is-open');
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.hidden ? open_menu() : close_menu();
    });

    document.addEventListener('click', () => close_menu());
    menu.addEventListener('click', (e) => e.stopPropagation());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close_menu();
    });

    // Синхронізація якщо select змінюється програмно
    select.addEventListener('change', () => {
      const code = select.value;
      btn.querySelector('.lang-dropdown__current').textContent = LABELS[code] || code.toUpperCase();
      menu.querySelectorAll('.lang-dropdown__option').forEach((o) =>
        o.classList.toggle('is-active', o.dataset.lang === code)
      );
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
