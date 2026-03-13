console.log('meals.js запустився');

import { updateStats } from './stats.js';
import { searchFood } from './food-api.js';
import { i18n } from './i18n.js';
// Імпортуємо клієнт Supabase
import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
  // ================== LANGUAGE ==================
  let lang = localStorage.getItem('lang') || 'ua';

  const langSwitcher = document.getElementById('langSwitcher');
  if (langSwitcher) {
    langSwitcher.value = lang;
    langSwitcher.addEventListener('change', () => {
      lang = langSwitcher.value;
      localStorage.setItem('lang', lang);
      renderAllMeals();
      renderSummary();
    });
  }

  function t(key) {
    return i18n[lang][key];
  }

  // ================== STATE ==================
  const mealsState = {
    breakfast: [],
    snack1: [],
    lunch: [],
    snack2: [],
    dinner: [],
  };

  // Додаємо змінну для поточної обраної дати (за замовчуванням - сьогодні)
  let currentSelectedDate = new Date().toISOString().split('T')[0];

  const STORAGE_KEY = 'mealsState';
  let activeMealKey = null;
  let selectedFood = null;
  let editingIndex = null;

  const summaryValue = document.querySelector('.day-summary__value');

  // ================== DAILY NORM ==================
  const dailyNorm = Number(localStorage.getItem('dailyCaloriesNorm')) || 0;

  // ================== STORAGE & SUPABASE ==================

  // Функція для завантаження даних із Supabase за конкретну дату
  async function loadMealsFromSupabase(date) {
    const { data, error } = await supabase.from('meals').select('*').eq('date', date);

    if (error) {
      console.error('Помилка завантаження з Supabase:', error);
      return;
    }

    // Очищаємо поточний стан перед завантаженням нових даних
    Object.keys(mealsState).forEach((key) => (mealsState[key] = []));

    // Розподіляємо отримані дані по категоріях
    data.forEach((item) => {
      if (mealsState[item.meal_type]) {
        mealsState[item.meal_type].push({
          id: item.id, // зберігаємо ID для видалення
          name: item.name,
          weight: item.weight,
          kcal: item.kcal,
          protein: item.protein,
          fat: item.fat,
          carbs: item.carbs,
        });
      }
    });

    renderAllMeals();
    renderSummary();
  }

  function saveMealsToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mealsState));
  }

  // Функція завантаження (тепер пріоритет на Supabase)
  async function initData() {
    // Спочатку спробуємо завантажити з бази
    await loadMealsFromSupabase(currentSelectedDate);

    // Якщо база порожня, можна підтягнути з localStorage (опціонально)
    if (Object.values(mealsState).flat().length === 0) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.keys(mealsState).forEach((mealKey) => {
          mealsState[mealKey] = parsed[mealKey] || [];
        });
        renderAllMeals();
        renderSummary();
      }
    }
  }

  async function clearDay() {
    // Видаляємо з бази за цей день
    const { error } = await supabase.from('meals').delete().eq('date', currentSelectedDate);

    if (!error) {
      localStorage.removeItem(STORAGE_KEY);
      Object.keys(mealsState).forEach((mealKey) => {
        mealsState[mealKey] = [];
        renderMeal(mealKey);
      });
      renderSummary();
    }
  }

  // ================== RENDER ==================
  function renderAllMeals() {
    Object.keys(mealsState).forEach(renderMeal);
  }

  function renderMeal(mealKey) {
    const mealBlock = document.querySelector(`.meal[data-meal="${mealKey}"]`);
    if (!mealBlock) return;

    const list = mealBlock.querySelector('.meal__recipes');
    list.innerHTML = '';

    mealsState[mealKey].forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'meal__recipe';

      li.innerHTML = `
      <div class="meal__recipe-line">
        <div class="meal__recipe-info">
          <div class="meal__recipe-name">${item.name}</div>
          <div class="meal__recipe-kcal">
            ${item.kcal} ${t('kcal')} · 
            ${t('protein')} ${item.protein} · 
            ${t('fat')} ${item.fat} · 
            ${t('carbs')} ${item.carbs}
          </div>
        </div>
        <button class="meal__delete-btn" data-index="${index}">🗑</button>
      </div>
    `;

      li.addEventListener('click', (e) => {
        if (e.target.closest('.meal__delete-btn')) return;
        editingIndex = index;
        openModal(mealKey, item);
      });

      const deleteBtn = li.querySelector('.meal__delete-btn');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openDeleteConfirm(mealKey, index);
      });

      list.appendChild(li);
    });
  }

  // ================== SUMMARY ==================
  function renderSummary() {
    const total = Object.values(mealsState)
      .flat()
      .reduce(
        (acc, item) => {
          acc.kcal += item.kcal;
          acc.protein += item.protein;
          acc.fat += item.fat;
          acc.carbs += item.carbs;
          return acc;
        },
        { kcal: 0, protein: 0, fat: 0, carbs: 0 },
      );

    if (summaryValue) {
      summaryValue.textContent = `${total.kcal} ${t('kcal')} · ${t('protein')} ${total.protein.toFixed(1)} · ${t('fat')} ${total.fat.toFixed(1)} · ${t('carbs')} ${total.carbs.toFixed(1)}`;
    }

    const progress = dailyNorm ? total.kcal / dailyNorm : 0;

    updateStats({
      ...total,
      dailyNorm,
      progress,
    });
  }

  // ================== DELETE CONFIRM ==================
  function openDeleteConfirm(mealKey, index) {
    const modal = document.getElementById('confirm-modal');
    if (!modal) return;

    modal.classList.add('active');
    modal.hidden = false;

    const yes = document.getElementById('confirm-yes');
    const no = document.getElementById('confirm-no');

    yes.onclick = async () => {
      const itemToDelete = mealsState[mealKey][index];

      // Видаляємо з бази, якщо є ID, або просто фільтруємо за датою/назвою
      const { error } = await supabase.from('meals').delete().match({
        meal_type: mealKey,
        name: itemToDelete.name,
        date: currentSelectedDate,
      });

      if (!error) {
        mealsState[mealKey].splice(index, 1);
        saveMealsToStorage();
        renderMeal(mealKey);
        renderSummary();
      }

      modal.classList.remove('active');
      modal.hidden = true;
    };

    no.onclick = () => {
      modal.classList.remove('active');
      modal.hidden = true;
    };
  }

  // ================== MODAL ELEMENTS ==================
  const modal = document.getElementById('addFoodModal');
  const overlay = modal.querySelector('.modal__overlay');
  const closeBtn = modal.querySelector('.modal__close');
  const confirmBtn = modal.querySelector('.modal__confirm');
  const resultsList = modal.querySelector('#foodResults');
  const body = modal.querySelector('.modal__body');

  let nameInput = body.querySelector('.modal__input');
  if (!nameInput) {
    nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = t('addProduct');
    nameInput.className = 'modal__input';
    body.prepend(nameInput);
  }

  const weightInput = body.querySelector('.modal__weight');
  weightInput.placeholder = t('weight');

  // ================== MODAL LOGIC ==================
  function updateConfirmState() {
    const weight = Number(weightInput.value);
    confirmBtn.disabled = !(selectedFood && weight > 0);
  }

  function openModal(mealKey, item = null) {
    activeMealKey = mealKey;
    selectedFood = null;

    resultsList.innerHTML = '';
    confirmBtn.disabled = true;

    nameInput.value = item ? item.name.replace(/\s\(.*?\)$/, '') : '';
    weightInput.value = item ? item.weight : '';

    modal.hidden = false;
    nameInput.focus();
  }

  function closeModal() {
    modal.hidden = true;
    activeMealKey = null;
    selectedFood = null;
    editingIndex = null;

    nameInput.value = '';
    weightInput.value = '';
    resultsList.innerHTML = '';
  }

  // ================== SEARCH ==================
  async function handleSearch() {
    const query = nameInput.value.trim();
    resultsList.innerHTML = '';
    selectedFood = null;
    confirmBtn.disabled = true;

    if (!query) return;

    const results = await searchFood(query);
    if (!results.length) return;

    results.forEach((food) => {
      const li = document.createElement('li');
      li.className = 'modal__item';

      li.textContent = `${food.name} — ${food.kcal} ${t('kcal')} / ${t('per100')}`;

      li.addEventListener('click', () => {
        selectedFood = food;

        nameInput.value = food.name;

        [...resultsList.children].forEach((el) => el.classList.remove('modal__item--active'));
        li.classList.add('modal__item--active');

        updateConfirmState();

        if (weightInput) weightInput.focus();
      });

      resultsList.appendChild(li);
    });
  }

  // ================== ADD FOOD ==================
  async function addSelectedFood() {
    if (!activeMealKey || !selectedFood) return;

    const grams = Number(weightInput.value);
    if (grams <= 0) return;

    const factor = grams / 100;

    const newItem = {
      name: `${selectedFood.name} (${grams} г)`,
      weight: grams,
      kcal: Math.round(selectedFood.kcal * factor),
      protein: Number((selectedFood.protein * factor).toFixed(1)),
      fat: Number((selectedFood.fat * factor).toFixed(1)),
      carbs: Number((selectedFood.carbs * factor).toFixed(1)),
    };

    // Зберігаємо в Supabase
    const { error } = await supabase.from('meals').insert([
      {
        meal_type: activeMealKey,
        name: newItem.name,
        weight: newItem.weight,
        kcal: newItem.kcal,
        protein: newItem.protein,
        fat: newItem.fat,
        carbs: newItem.carbs,
        date: currentSelectedDate,
      },
    ]);

    if (!error) {
      if (editingIndex !== null) {
        mealsState[activeMealKey][editingIndex] = newItem;
      } else {
        mealsState[activeMealKey].push(newItem);
      }

      renderMeal(activeMealKey);
      renderSummary();
      saveMealsToStorage();
      closeModal();
    } else {
      alert('Помилка збереження в базу');
    }
  }

  // ================== SIDEBAR DAYS LOGIC ==================
  // Налаштовуємо кліки по днях тижня
  function initSidebarDays() {
    const dayButtons = document.querySelectorAll('.days-list__item'); // перевір цей селектор у себе в HTML

    dayButtons.forEach((btn, index) => {
      btn.addEventListener('click', () => {
        // Вираховуємо дату (це спрощений приклад, краще використовувати dayjs)
        const now = new Date();
        const currentDay = now.getDay() || 7; // 1-7
        const diff = index + 1 - currentDay;
        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() + diff);

        currentSelectedDate = targetDate.toISOString().split('T')[0];

        // Візуальне перемикання активного класу
        dayButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        loadMealsFromSupabase(currentSelectedDate);
      });
    });
  }

  // ================== EVENTS ==================
  document.querySelectorAll('.meal__add').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mealBlock = btn.closest('.meal');
      if (!mealBlock) return;

      const mealKey = mealBlock.dataset.meal;
      if (!mealKey) return;

      editingIndex = null;
      openModal(mealKey);
    });
  });

  nameInput.addEventListener('input', handleSearch);
  weightInput.addEventListener('input', updateConfirmState);

  confirmBtn.textContent = t('add');
  confirmBtn.addEventListener('click', addSelectedFood);

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', closeModal);

  const clearBtn = document.getElementById('clearDayBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearDay);
  }

  // ================== INIT ==================
  initSidebarDays();
  initData();
});
