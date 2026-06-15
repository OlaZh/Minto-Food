import { lockScroll, unlockScroll } from './scroll-lock.js';
import { isAdmin, openAdminPanel } from './auth.js';
import { i18n } from './i18n.js';
import { getLang } from './storage.js';
import {
  iconCalendar, iconGrid, iconUtensils, iconListChecks, iconMoreVertical,
  iconBookOpen, iconLeaf, iconUser, iconShield,
} from './icons.js';

(() => {
  const t = (key) => i18n[getLang()]?.[key] ?? i18n.ua[key] ?? key;

  const PAGE_MAP = [
    { match: 'week-menu', tab: 'week' },
    { match: 'recipes', tab: 'recipes' },
    { match: 'shopping-list', tab: 'shopping' },
    { match: 'product-guide', tab: 'more' },
    { match: 'cookbook', tab: 'more' },
    { match: 'profile', tab: 'more' },
    { match: 'index', tab: 'day' },
  ];

  function getActiveTab() {
    const path = window.location.pathname;
    for (const { match, tab } of PAGE_MAP) {
      if (path.includes(match)) return tab;
    }
    return 'day';
  }

  function tabIcon(svg) {
    return svg.replace('<svg ', '<svg class="mobile-tab-bar__icon" ');
  }

  const ICONS = {
    day:      tabIcon(iconCalendar),
    week:     tabIcon(iconGrid),
    recipes:  tabIcon(iconUtensils),
    shopping: tabIcon(iconListChecks),
    more:     tabIcon(iconMoreVertical),
  };

  const TABS = [
    { tab: 'day', href: 'index.html', label: t('navDay') },
    { tab: 'week', href: 'week-menu.html', label: t('navWeek') },
    { tab: 'recipes', href: 'recipes.html', label: t('navRecipes') },
    { tab: 'shopping', href: 'shopping-list.html', label: t('navShopping') },
    { tab: 'more', href: null, label: t('navMore') },
  ];

  const SHEET_LINKS = [
    { href: 'cookbook.html',     label: t('navCookbook'), icon: iconBookOpen },
    { href: 'product-guide.html',label: t('navGuide'),    icon: iconLeaf    },
    { href: 'profile.html',      label: t('navProfile'),  icon: iconUser    },
    { href: '#', label: t('navAdmin'), icon: iconShield, adminOnly: true },
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

    return `<nav class="mobile-tab-bar" role="navigation" aria-label="${t('navAriaLabel')}">${items}</nav>`;
  }

  function buildBottomSheet() {
    const links = SHEET_LINKS.map(
      ({ href, label, icon, adminOnly }) => `
      <a href="${href}" class="bottom-sheet__link"${adminOnly ? ' id="mobileAdminLink" hidden' : ''}>${icon}${label}</a>
    `,
    ).join('');

    return `
      <div class="bottom-sheet" id="more-sheet" aria-hidden="true">
        <div class="bottom-sheet__overlay" data-sheet-close></div>
        <div class="bottom-sheet__card">
          <div class="bottom-sheet__handle"></div>
          <p class="bottom-sheet__title">${t('navSheetTitle')}</p>
          ${links}
        </div>
      </div>
    `;
  }

  function init() {
    const activeTab = getActiveTab();

    document.body.insertAdjacentHTML('beforeend', buildTabBar(activeTab));
    document.body.insertAdjacentHTML('beforeend', buildBottomSheet());

    const sheet = document.getElementById('more-sheet');
    const moreBtn = document.querySelector('[data-more-btn]');

    function openSheet() {
      sheet.classList.add('is-open');
      sheet.removeAttribute('aria-hidden');
      moreBtn?.setAttribute('aria-expanded', 'true');
      lockScroll('mobile-tab-bar');
    }

    function closeSheet() {
      sheet.classList.remove('is-open');
      sheet.setAttribute('aria-hidden', 'true');
      moreBtn?.setAttribute('aria-expanded', 'false');
      unlockScroll('mobile-tab-bar');
    }

    moreBtn?.addEventListener('click', () => {
      sheet.classList.contains('is-open') ? closeSheet() : openSheet();
    });

    sheet.querySelector('[data-sheet-close]')?.addEventListener('click', closeSheet);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSheet();
    });

    isAdmin().then((admin) => {
      const adminLink = document.getElementById('mobileAdminLink');
      if (adminLink) {
        adminLink.hidden = !admin;
        adminLink.addEventListener('click', (e) => {
          e.preventDefault();
          openAdminPanel();
        });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
