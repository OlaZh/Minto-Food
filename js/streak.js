// ============================================================
//  STREAK — Логіка серії днів поспіль
// ============================================================
//  Працює з Supabase RPC функцією get_current_streak()
//  Тригер на meals автоматично оновлює streak при додаванні їжі
//  Цей модуль тільки ЧИТАЄ значення для UI
// ============================================================

import { supabase } from './supabaseClient.js';

// ============================================================
//  DOM ELEMENTS
// ============================================================

const streakCardEl = document.getElementById('streakCard');
const streakCountEl = document.getElementById('streakCount');
const streakSubEl = streakCardEl?.querySelector('.streak-card__sub');

const streakCountMobileEl = document.getElementById('streakCountMobile');
const streakSubMobileEl   = document.getElementById('streakSubMobile');

// ============================================================
//  УКРАЇНСЬКА ПЛЮРАЛІЗАЦІЯ
// ============================================================

/**
 * Повертає правильну форму слова "день" для українського числа
 * 1 день, 2-4 дні, 5+ днів
 */
function getDayWord(count) {
  const lastTwo = count % 100;
  const lastOne = count % 10;

  if (lastTwo >= 11 && lastTwo <= 14) return 'днів';
  if (lastOne === 1) return 'день';
  if (lastOne >= 2 && lastOne <= 4) return 'дні';
  return 'днів';
}

// ============================================================
//  МОТИВАЦІЙНІ ПОВІДОМЛЕННЯ
// ============================================================

/**
 * Повертає мотиваційне повідомлення в залежності від streak
 */
function getMotivationalText(streak, isActive) {
  if (!isActive || streak === 0) {
    return 'Почни нову серію! 💪';
  }
  if (streak === 1) return 'Класний початок! 🌱';
  if (streak < 3) return 'Так тримати!';
  if (streak < 7) return 'Видатні досягнення!';
  if (streak < 14) return 'Тиждень дисципліни! 🏆';
  if (streak < 30) return 'Неймовірна стійкість!';
  if (streak < 100) return 'Місяць поспіль — рекорд!';
  return 'Ти легенда! 🌟';
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
    countWrapper.innerHTML = `<span id="streakCount">${current_streak}</span> ${getDayWord(current_streak)} поспіль`;
  }

  // Мотиваційне повідомлення
  if (streakSubEl) {
    streakSubEl.textContent = getMotivationalText(current_streak, is_active);
  }

  // Mobile streak strip
  if (streakCountMobileEl) {
    streakCountMobileEl.textContent = `${current_streak} ${getDayWord(current_streak)} поспіль`;
  }
  if (streakSubMobileEl) {
    streakSubMobileEl.textContent = getMotivationalText(current_streak, is_active);
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
