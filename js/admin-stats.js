// ============================================================
// admin-stats.js — Top stats bar
// ============================================================

import { supabase } from './supabaseClient.js';
import { getCachedStats, setCachedStats } from './admin-utils.js';

export async function loadStats() {
  const cached = getCachedStats();
  if (cached) {
    renderStats(cached);
    return cached;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [reportsRes, recipesTodayRes, activeUsersRes, userProductsRes] = await Promise.all([
    supabase
      .from('recipe_reports')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),

    supabase
      .from('recipes')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),

    supabase
      .from('meals')
      .select('user_id', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo),

    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .not('user_id', 'is', null),
  ]);

  const stats = {
    reports:      reportsRes.count  ?? 0,
    recipesToday: recipesTodayRes.count ?? 0,
    activeUsers:  activeUsersRes.count  ?? 0,
    userProducts: userProductsRes.count ?? 0,
  };

  setCachedStats(stats);
  renderStats(stats);
  return stats;
}

function renderStats(stats) {
  _setVal('statReportsVal', stats.reports);
  _setVal('statRecipesTodayVal', stats.recipesToday);
  _setVal('statActiveUsersVal', stats.activeUsers);
  _setVal('statUserProductsVal', stats.userProducts);

  const reportsPill = document.getElementById('statReports');
  if (reportsPill) {
    reportsPill.classList.toggle('admin-stats-bar__pill--alert', stats.reports > 0);
  }

  const recipesPill = document.getElementById('statRecipesToday');
  if (recipesPill) {
    recipesPill.classList.toggle('admin-stats-bar__pill--alert', stats.recipesToday > 0);
  }

  updateSidebarBadge('sidebarReportsCount', stats.reports);
  updateSidebarBadge('sidebarRecipesCount', stats.recipesToday);
  updateSidebarBadge('sidebarProductsCount', stats.userProducts);
}

function _setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

export function updateSidebarBadge(id, count) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = count;
  el.hidden = count === 0;
}
