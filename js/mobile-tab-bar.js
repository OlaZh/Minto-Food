// ============================================================
//  MOBILE TAB BAR — інжектується на всі сторінки
//  Активна вкладка визначається автоматично по URL
// ============================================================

(() => {
  // Мапа: частина URL → data-tab значення
  const PAGE_MAP = [
    { match: 'week-menu',     tab: 'week'    },
    { match: 'recipes',       tab: 'recipes' },
    { match: 'product-guide', tab: 'guide'   },
    { match: 'cookbook',      tab: 'more'    },
    { match: 'profile',       tab: 'more'    },
    { match: 'index',         tab: 'day'     },
  ];

  function getActiveTab() {
    const path = window.location.pathname;
    for (const { match, tab } of PAGE_MAP) {
      if (path.includes(match)) return tab;
    }
    return 'day'; // index.html або корінь
  }

  const ICONS = {
    day: `<svg class="mobile-tab-bar__icon" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    week: `<svg class="mobile-tab-bar__icon" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    recipes: `<svg class="mobile-tab-bar__icon" viewBox="0 0 24 24"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>`,
    guide: `<svg class="mobile-tab-bar__icon" viewBox="0 0 24 24"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`,
    more: `<svg class="mobile-tab-bar__icon" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/></svg>`,
  };

  const TABS = [
    { tab: 'day',     href: 'index.html',         label: 'День'     },
    { tab: 'week',    href: 'week-menu.html',      label: 'Тиждень'  },
    { tab: 'recipes', href: 'recipes.html',        label: 'Рецепти'  },
    { tab: 'guide',   href: 'product-guide.html',  label: 'Путівник' },
    { tab: 'more',    href: null,                  label: 'Ще'       },
  ];

  const SHEET_LINKS = [
    {
      href: 'cookbook.html',
      label: 'Книга рецептів',
      icon: `<svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
    },
    {
      href: 'profile.html',
      label: 'Профіль',
      icon: `<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    },
    {
      href: '#',
      label: 'Список покупок',
      icon: `<svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
    },
  ];

  function buildTabBar(activeTab) {
    const items = TABS.map(({ tab, href, label }) => {
      const isActive = activeTab === tab;
      const isMore = tab === 'more';
      const tag = isMore ? 'button' : 'a';
      const attrs = isMore
        ? `type="button" aria-haspopup="true" aria-expanded="false" data-more-btn`
        : `href="${href}"`;

      return `
        <${tag} class="mobile-tab-bar__item${isActive ? ' is-active' : ''}" data-tab="${tab}" ${attrs}>
          ${ICONS[tab]}
          <span class="mobile-tab-bar__label">${label}</span>
        </${tag}>
      `;
    }).join('');

    return `<nav class="mobile-tab-bar" role="navigation" aria-label="Навігація">${items}</nav>`;
  }

  function buildBottomSheet() {
    const links = SHEET_LINKS.map(({ href, label, icon }) => `
      <a href="${href}" class="bottom-sheet__link">${icon}${label}</a>
    `).join('');

    return `
      <div class="bottom-sheet" id="more-sheet" aria-hidden="true">
        <div class="bottom-sheet__overlay" data-sheet-close></div>
        <div class="bottom-sheet__card">
          <div class="bottom-sheet__handle"></div>
          <p class="bottom-sheet__title">Інше</p>
          ${links}
        </div>
      </div>
    `;
  }

  function init() {
    const activeTab = getActiveTab();

    // Вставляємо таб-бар
    document.body.insertAdjacentHTML('beforeend', buildTabBar(activeTab));
    document.body.insertAdjacentHTML('beforeend', buildBottomSheet());

    const sheet = document.getElementById('more-sheet');
    const moreBtn = document.querySelector('[data-more-btn]');

    function openSheet() {
      sheet.classList.add('is-open');
      sheet.removeAttribute('aria-hidden');
      moreBtn?.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }

    function closeSheet() {
      sheet.classList.remove('is-open');
      sheet.setAttribute('aria-hidden', 'true');
      moreBtn?.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    moreBtn?.addEventListener('click', () => {
      sheet.classList.contains('is-open') ? closeSheet() : openSheet();
    });

    sheet.querySelector('[data-sheet-close]')?.addEventListener('click', closeSheet);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSheet();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
