// ============================================================
//  MEAL ACCORDION + SUMMARY
//  Розгортання/згортання прийомів їжі + показ статистики
//  у згорнутому стані (кількість страв · ккал)
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const meals = document.querySelectorAll('.meal');

  meals.forEach((meal) => {
    const header = meal.querySelector('.meal__header');
    const recipes = meal.querySelector('.meal__recipes');
    if (!header || !recipes) return;

    header.addEventListener('click', (e) => {
      if (e.target.closest('.meal__add')) return;

      if (meal.classList.contains('is-open')) {
        // Закриваємо: фіксуємо поточну висоту → анімуємо до 0
        recipes.style.height = recipes.scrollHeight + 'px';
        meal.classList.remove('is-open');
        requestAnimationFrame(() => {
          recipes.style.height = '0px';
        });
      } else {
        // Відкриваємо: додаємо клас → вимірюємо → анімуємо до реальної висоти
        meal.classList.add('is-open');
        const targetHeight = recipes.scrollHeight;
        recipes.style.height = '0px';
        requestAnimationFrame(() => {
          recipes.style.height = targetHeight + 'px';
        });
        recipes.addEventListener('transitionend', () => {
          recipes.style.height = 'auto';
        }, { once: true });
      }
    });
  });

  // Слідкуємо за змінами в .meal__recipes — оновлюємо summary
  observeMealContent();
});

// ============================================================
//  УКРАЇНСЬКА ПЛЮРАЛІЗАЦІЯ
// ============================================================

function getDishWord(count) {
  const lastTwo = count % 100;
  const lastOne = count % 10;

  if (lastTwo >= 11 && lastTwo <= 14) return 'страв';
  if (lastOne === 1) return 'страва';
  if (lastOne >= 2 && lastOne <= 4) return 'страви';
  return 'страв';
}

// ============================================================
//  ПІДРАХУНОК ССУМИ КАЛОРІЙ ДЛЯ MEAL
// ============================================================
//  Шукає всі .meal__recipe-kcal в .meal__recipes та парсить число
//  з рядка "149 ккал · Б 5.2 · Ж 16.4 · В 0.2"
// ============================================================

function calculateMealKcal(list) {
  let total = 0;

  list.querySelectorAll('.meal__recipe-kcal').forEach((el) => {
    // Витягуємо перше число з тексту "149 ккал · ..."
    const match = el.textContent.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      total += parseFloat(match[1]) || 0;
    }
  });

  return Math.round(total);
}

// ============================================================
//  ОНОВЛЕННЯ SUMMARY ДЛЯ ОДНОГО MEAL
// ============================================================

function updateMealSummary(meal, list) {
  const summaryEl = meal.querySelector('.meal__summary');
  if (!summaryEl) return;

  const itemsCount = list.children.length;
  const hasItems = itemsCount > 0;

  // Toggle класу для індикатора-точки
  meal.classList.toggle('meal--has-items', hasItems);

  if (!hasItems) {
    // Порожньо — нічого не показуємо
    summaryEl.innerHTML = '';
    return;
  }

  const totalKcal = calculateMealKcal(list);
  const dishWord = getDishWord(itemsCount);

  summaryEl.innerHTML = `
    <span class="meal__summary-count">${itemsCount} ${dishWord}</span>
    <span class="meal__summary-divider">·</span>
    <span class="meal__summary-kcal">${totalKcal} ккал</span>
  `;
}

// ============================================================
//  СПОСТЕРЕЖЕННЯ ЗА КОНТЕНТОМ
// ============================================================
//  Коли в .meal__recipes змінюється список <li> —
//  оновлюємо summary для цього meal
// ============================================================

function observeMealContent() {
  const lists = document.querySelectorAll('.meal__recipes');

  lists.forEach((list) => {
    const meal = list.closest('.meal');
    if (!meal) return;

    // Початкова перевірка
    updateMealSummary(meal, list);

    // Слухаємо зміни в DOM
    const observer = new MutationObserver(() => {
      updateMealSummary(meal, list);
    });

    observer.observe(list, {
      childList: true,
      subtree: true, // важливо: для відстеження змін в дочірніх елементах
      characterData: true, // для змін текстового контенту (якщо ккал перерахується)
    });
  });
}
