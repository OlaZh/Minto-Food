import { getLang, setLang } from './storage.js';
import { iconChevronDown } from './icons.js';

(() => {
  const LABELS = { ua: 'UA', pl: 'PL', en: 'EN' };

  function init() {
    const select = document.getElementById('langSwitcher');
    if (!select) return;

    const wrapper = select.closest('.lang-switcher');
    if (!wrapper) return;

    select.style.cssText = 'position:absolute;opacity:0;width:0;height:0;pointer-events:none';

    const currentLang = getLang() || select.value || 'ua';
    select.value = currentLang;

    const dropdown = document.createElement('div');
    dropdown.className = 'lang-dropdown';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lang-dropdown__btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = `<span class="lang-dropdown__current">${LABELS[currentLang]}</span>${iconChevronDown.replace('<svg ', '<svg class="lang-dropdown__chevron" width="12" height="12" ')}`;

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
      opt.addEventListener('click', () => selectLang(code));

      li.appendChild(opt);
      menu.appendChild(li);
    });

    dropdown.appendChild(btn);
    dropdown.appendChild(menu);
    wrapper.appendChild(dropdown);

    function closeMenu() {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      btn.classList.remove('is-open');
    }

    function openMenu() {
      menu.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      btn.classList.add('is-open');
    }

    function syncUi(code) {
      btn.querySelector('.lang-dropdown__current').textContent = LABELS[code] || code.toUpperCase();
      menu.querySelectorAll('.lang-dropdown__option').forEach((option) => {
        const isActive = option.dataset.lang === code;
        option.classList.toggle('is-active', isActive);
        option.closest('[role=option]')?.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
    }

    function selectLang(code) {
      select.value = code;
      setLang(code);
      select.dispatchEvent(new Event('change'));
      syncUi(code);
      closeMenu();
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.hidden ? openMenu() : closeMenu();
    });

    document.addEventListener('click', closeMenu);
    menu.addEventListener('click', (e) => e.stopPropagation());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });

    select.addEventListener('change', () => {
      syncUi(select.value);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
