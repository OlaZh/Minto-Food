// ============================================================
// admin.js — головний контролер адмінки
// ============================================================

import { requireAdmin, initConfirmModal, initDrawer } from './admin-utils.js';
import { loadStats } from './admin-stats.js';
import { initReports } from './admin-reports.js';
import { initRecipes } from './admin-recipes.js';
import { initProducts } from './admin-products.js';
import { initUsers } from './admin-users.js';
import { initArchive } from './admin-archive.js';

const SECTIONS = ['reports', 'recipes', 'products', 'users', 'archive'];
let _activeSection = 'reports';
let _initialized = {
  reports: false,
  recipes: false,
  products: false,
  users: false,
  archive: false,
};
const _isMobile = window.innerWidth < 1024;

async function init() {
  const ok = await requireAdmin();
  if (!ok) return;

  initConfirmModal();
  initDrawer();

  if (_isMobile) {
    document.getElementById('adminMobileHeader').hidden = false;
    document.getElementById('adminMobileTabs').hidden = false;
    document.getElementById('adminLayout').classList.add('admin-layout--mobile');
    initMobileTabs();
    initThemeToggle('#adminMobileThemeToggle');
  } else {
    initThemeToggle('.admin-sidebar .theme-toggle');
    initSidebar();
  }

  await Promise.all([loadStats(), initSection('reports')]);
}

function initSidebar() {
  document.querySelectorAll('.admin-sidebar__item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      if (section) switchSection(section);
    });
  });
}

function initMobileTabs() {
  document.querySelectorAll('.admin-mobile-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      if (section) switchSection(section);
    });
  });
}

async function switchSection(name) {
  if (name === _activeSection) return;

  document.querySelectorAll('.admin-sidebar__item').forEach((btn) => {
    btn.classList.toggle('admin-sidebar__item--active', btn.dataset.section === name);
  });

  document.querySelectorAll('.admin-mobile-tab').forEach((btn) => {
    btn.classList.toggle('admin-mobile-tab--active', btn.dataset.section === name);
  });

  SECTIONS.forEach((s) => {
    const el = document.getElementById(`section${capitalize(s)}`);
    if (el) el.classList.toggle('admin-section--hidden', s !== name);
  });

  _activeSection = name;

  if (!_initialized[name]) {
    await initSection(name);
  }

  if (_isMobile) window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function initSection(name) {
  _initialized[name] = true;
  switch (name) {
    case 'reports':
      return initReports();
    case 'recipes':
      return initRecipes();
    case 'products':
      return initProducts();
    case 'users':
      return initUsers();
    case 'archive':
      return initArchive();
  }
}

function initThemeToggle(selector) {
  document.querySelector(selector)?.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.removeItem('theme');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    }
  });
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

init();
