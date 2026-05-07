// ============================================================
// admin.js — головний контролер адмінки
// ============================================================

import { requireAdmin, initConfirmModal, initDrawer } from './admin-utils.js';
import { loadStats } from './admin-stats.js';
import { initReports, loadReports } from './admin-reports.js';
import { initRecipes, loadRecipes } from './admin-recipes.js';
import { initProducts, loadProducts } from './admin-products.js';
import { initUsers, loadUsers } from './admin-users.js';
import { initArchive } from './admin-archive.js';

const SECTIONS = ['reports', 'recipes', 'products', 'users', 'archive'];
let _activeSection = 'reports';
let _initialized = { reports: false, recipes: false, products: false, users: false, archive: false };

async function init() {
  // Мобільний block — показуємо якщо <1024px
  if (window.innerWidth < 1024) {
    document.getElementById('adminMobileBlock').hidden  = false;
    document.getElementById('adminLayout').style.display = 'none';
    return;
  }

  // Guard — redirect якщо не адмін
  const ok = await requireAdmin();
  if (!ok) return;

  initConfirmModal();
  initDrawer();
  initThemeToggle();
  initSidebar();

  // Завантажуємо stats + першу секцію паралельно
  await Promise.all([
    loadStats(),
    initSection('reports'),
  ]);
}

function initSidebar() {
  document.querySelectorAll('.admin-sidebar__item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      if (section) switchSection(section);
    });
  });
}

async function switchSection(name) {
  if (name === _activeSection) return;

  // Sidebar active state
  document.querySelectorAll('.admin-sidebar__item').forEach((btn) => {
    btn.classList.toggle('admin-sidebar__item--active', btn.dataset.section === name);
  });

  // Sections visibility
  SECTIONS.forEach((s) => {
    const el = document.getElementById(`section${capitalize(s)}`);
    if (el) el.classList.toggle('admin-section--hidden', s !== name);
  });

  _activeSection = name;

  if (!_initialized[name]) {
    await initSection(name);
  }
}

async function initSection(name) {
  _initialized[name] = true;
  switch (name) {
    case 'reports':  return initReports();
    case 'recipes':  return initRecipes();
    case 'products': return initProducts();
    case 'users':    return initUsers();
    case 'archive':  return initArchive();
  }
}

function initThemeToggle() {
  document.querySelector('.admin-sidebar .theme-toggle')?.addEventListener('click', () => {
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
