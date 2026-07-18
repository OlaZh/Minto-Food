// ============================================================
//  STREAK — Логіка серії днів поспіль
// ============================================================
//  Працює з Supabase RPC функцією get_current_streak()
//  Тригер на meals автоматично оновлює streak при додаванні їжі
//  Цей модуль тільки ЧИТАЄ значення для UI
// ============================================================

import { supabase } from './supabaseClient.js';
import { iconGym, iconSprout, iconTrophy, iconStar } from './icons.js';
import { plural, showToast } from './utils.js';
import { t, formatText } from './i18n-apply.js';

// ============================================================
//  DOM ELEMENTS
// ============================================================

const streakCardEl = document.getElementById('streakCard');
const streakCountEl = document.getElementById('streakCount');
const streakSubEl = streakCardEl?.querySelector('.streak-card__sub');

const streakCountMobileEl = document.getElementById('streakCountMobile');
const streakSubMobileEl   = document.getElementById('streakSubMobile');

// ============================================================
//  МОТИВАЦІЙНІ ПОВІДОМЛЕННЯ
// ============================================================

/**
 * Повертає мотиваційне повідомлення в залежності від streak
 */
function getMotivationalText(streak, isActive) {
  if (!isActive || streak === 0) {
    return `${t('streakNew')} ${iconGym}`;
  }
  if (streak === 1) return `${t('streakStart')} ${iconSprout}`;
  if (streak < 3) return t('streakKeep');
  if (streak < 7) return t('streakGreat');
  if (streak < 14) return `${t('streakWeek')} ${iconTrophy}`;
  if (streak < 30) return t('streakResilient');
  if (streak < 100) return t('streakMonth');
  return `${t('streakLegend')} ${iconStar}`;
}

// ============================================================
//  ACTIVATION MILESTONES (Фаза 16)
// ============================================================
// Тост «Ти тримаєш серію N днів! 🌿» — лише коли серія ЗРОСЛА в межах
// цієї сесії (юзер щойно залогував їжу), не при кожному завантаженні
// сторінки. Прапорів у localStorage нема: інкремент до milestone
// трапляється раз на день, тож дубль неможливий.

const MILESTONES = [3, 7, 14, 30, 100];
let _lastSeenStreak = null;

function _maybeCelebrate(streak) {
  const prev = _lastSeenStreak;
  _lastSeenStreak = streak;
  if (prev === null || streak <= prev) return; // перший load або без росту
  if (!MILESTONES.includes(streak)) return;
  showToast(formatText('streakMilestone', { n: streak }), 'success', 5000);
}

/** Локалізований текст «N днів поспіль» (без числа на початку для desktop-варіанту). */
function streakDaysLabel(n) {
  const word = plural(n, [t('dayOne'), t('dayFew'), t('dayMany')]);
  return `${word} ${t('streakSuffix')}`;
}

// ============================================================
//  ОНОВЛЕННЯ UI
// ============================================================

function updateStreakUI({ current_streak, longest_streak, is_active }) {
  if (!streakCardEl) return;

  // Показуємо число (0 якщо серія обірвана)
  if (streakCountEl) {
    streakCountEl.textContent = current_streak;
  }

  // Оновлюємо текст "день поспіль" з правильною плюралізацією
  const countWrapper = streakCardEl.querySelector('.streak-card__count');
  if (countWrapper) {
    countWrapper.innerHTML = `<span id="streakCount">${current_streak}</span> ${streakDaysLabel(current_streak)}`;
  }

  // Мотиваційне повідомлення
  if (streakSubEl) {
    streakSubEl.innerHTML = getMotivationalText(current_streak, is_active);
  }

  // Mobile streak strip
  if (streakCountMobileEl) {
    streakCountMobileEl.textContent = `${current_streak} ${streakDaysLabel(current_streak)}`;
  }
  if (streakSubMobileEl) {
    streakSubMobileEl.innerHTML = getMotivationalText(current_streak, is_active);
  }

  // Стилізуємо картку залежно від стану
  streakCardEl.classList.toggle('streak-card--active', is_active && current_streak > 0);
  streakCardEl.classList.toggle('streak-card--inactive', !is_active || current_streak === 0);

  // Дата-атрибут для CSS-варіантів (наприклад, золото для streak >= 7)
  if (current_streak >= 30) {
    streakCardEl.dataset.tier = 'legend';
  } else if (current_streak >= 7) {
    streakCardEl.dataset.tier = 'gold';
  } else if (current_streak >= 3) {
    streakCardEl.dataset.tier = 'silver';
  } else {
    delete streakCardEl.dataset.tier;
  }
}

// ============================================================
//  ЗАВАНТАЖЕННЯ ЗІ SUPABASE
// ============================================================

/**
 * Завантажує streak поточного юзера і оновлює UI
 * Можна викликати після кожного додавання meal — щоб число оновилось одразу
 */
export async function loadStreak() {
  if (!streakCardEl) return null;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Анонімний юзер — streak = 0
    if (!user) {
      updateStreakUI({ current_streak: 0, longest_streak: 0, is_active: false });
      return null;
    }

    const { data, error } = await supabase.rpc('get_current_streak', {
      p_user_id: user.id,
    });

    if (error) {
      console.error('[Streak] RPC error:', error);
      updateStreakUI({ current_streak: 0, longest_streak: 0, is_active: false });
      return null;
    }

    // RPC повертає масив (навіть з одним рядком)
    const streakData = data?.[0] || {
      current_streak: 0,
      longest_streak: 0,
      is_active: false,
    };

    updateStreakUI(streakData);
    _maybeCelebrate(streakData.current_streak);
    return streakData;
  } catch (err) {
    console.error('[Streak] Unexpected error:', err);
    updateStreakUI({ current_streak: 0, longest_streak: 0, is_active: false });
    return null;
  }
}

// ============================================================
//  АВТОМАТИЧНЕ ЗАВАНТАЖЕННЯ ПРИ DOMContentLoaded
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  loadStreak();
});

// ============================================================
//  ЕКСПОРТ ДЛЯ INTEGRATION З MEALS.JS
// ============================================================
// Коли юзер додає meal — викликаємо loadStreak() щоб одразу оновити UI
// Це опційно: тригер у БД спрацьовує автоматично, нам треба лише перечитати

export { updateStreakUI };
