console.log('meals.js запустився');

import { updateStats, updateWaterUI } from './stats.js';
import { searchFood } from './food-api.js';
import { i18n } from './i18n.js';
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

  // Хелпер для отримання локальної дати (без UTC зсуву)
  function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Поточна дата для фільтрації (за замовчуванням сьогодні)
  let currentSelectedDate = getLocalDateString();

  const STORAGE_KEY = 'mealsState';
  let activeMealKey = null;
  let selectedFood = null;
  let editingIndex = null;

  const summaryValue = document.querySelector('.day-summary__value');
  const dayDateDisplay = document.getElementById('dayDate');

  // ================== DAILY NORM ==================
  const dailyNorm = Number(localStorage.getItem('dailyCaloriesNorm')) || 0;

  // ================== SUPABASE LOGIC ==================

  // Завантаження даних з бази за конкретну дату
  async function loadMealsFromSupabase(date) {
    // Отримуємо поточного користувача
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let query = supabase.from('meals').select('*').eq('date', date);

    // Фільтрація: якщо залогінений — по ID, якщо ні — по null
    if (user) {
      query = query.eq('user_id', user.id);
    } else {
      query = query.is('user_id', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Помилка Supabase:', error);
      return;
    }

    // Очищаємо стан перед рендером нового дня
    Object.keys(mealsState).forEach((key) => (mealsState[key] = []));

    if (data) {
      data.forEach((item) => {
        if (mealsState[item.meal_type]) {
          mealsState[item.meal_type].push({
            id: item.id, // Важливо для видалення
            name: item.name,
            weight: item.weight,
            kcal: item.kcal,
            protein: item.protein,
            fat: item.fat,
            carbs: item.carbs,
          });
        }
      });
    }

    renderAllMeals();
    renderSummary();
    updateDateDisplay(date);
    loadWaterFromSupabase(date); // ДОДАНО: завантаження води при зміні дня
  }

  // --- ЛОГІКА ВОДИ (SUPABASE) ---

  async function loadWaterFromSupabase(date) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let query = supabase.from('water').select('amount').eq('date', date);

    if (user) {
      query = query.eq('user_id', user.id);
    } else {
      query = query.is('user_id', null);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Помилка води:', error);
      return;
    }

    const total = data ? data.reduce((acc, item) => acc + Number(item.amount), 0) : 0;
    updateWaterUI(total); // Викликаємо функцію зі stats.js для оновлення стакана
  }

  async function addWaterToSupabase(amount) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from('water').insert([
      {
        amount: amount,
        date: currentSelectedDate,
        user_id: user ? user.id : null,
      },
    ]);

    if (!error) {
      loadWaterFromSupabase(currentSelectedDate);
    }
  }

  async function resetWaterDay() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let query = supabase.from('water').delete().eq('date', currentSelectedDate);

    if (user) {
      query = query.eq('user_id', user.id);
    } else {
      query = query.is('user_id', null);
    }

    const { error } = await query;
    if (!error) {
      updateWaterUI(0);
    }
  }

  // --- КІНЕЦЬ ЛОГІКИ ВОДИ ---

  function updateDateDisplay(dateStr) {
    if (dayDateDisplay) {
      const options = { weekday: 'long', day: 'numeric', month: 'long' };
      const dateObj = new Date(dateStr);
      dayDateDisplay.textContent = dateObj.toLocaleDateString(
        lang === 'ua' ? 'uk-UA' : lang,
        options,
      );
    }
  }

  function saveMealsToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mealsState));
  }

  async function clearDay() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let query = supabase.from('meals').delete().eq('date', currentSelectedDate);

    if (user) {
      query = query.eq('user_id', user.id);
    } else {
      query = query.is('user_id', null);
    }

    const { error } = await query;

    if (!error) {
      Object.keys(mealsState).forEach((mealKey) => {
        mealsState[mealKey] = [];
        renderMeal(mealKey);
      });
      renderSummary();
      saveMealsToStorage();
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
          acc.kcal += Number(item.kcal) || 0;
          acc.protein += Number(item.protein) || 0;
          acc.fat += Number(item.fat) || 0;
          acc.carbs += Number(item.carbs) || 0;
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
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Видаляємо з Supabase по id, щоб уникнути видалення дублікатів з однаковою назвою
      let query = supabase.from('meals').delete().eq('id', itemToDelete.id);

      if (user) {
        query = query.eq('user_id', user.id);
      } else {
        query = query.is('user_id', null);
      }

      const { error } = await query;

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
    // Відновлення selectedFood для редагування (зберігаємо базу kcal/100g)
    selectedFood = item ? { ...item, kcal: item.kcal / (item.weight / 100) } : null;

    resultsList.innerHTML = '';
    confirmBtn.disabled = !item; // Якщо це редагування, кнопка активна одразу

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

    // Мітка грамів залежно від мови
    const gramsLabel = lang === 'ua' ? 'гр' : lang === 'pl' ? 'g' : 'g';

    const newItem = {
      name: `${selectedFood.name} (${grams} ${gramsLabel})`,
      weight: grams,
      kcal: Math.round(selectedFood.kcal * factor),
      protein: Number((selectedFood.protein * factor).toFixed(1)),
      fat: Number((selectedFood.fat * factor).toFixed(1)),
      carbs: Number((selectedFood.carbs * factor).toFixed(1)),
    };

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = {
      meal_type: activeMealKey,
      name: newItem.name,
      weight: newItem.weight,
      kcal: newItem.kcal,
      protein: newItem.protein,
      fat: newItem.fat,
      carbs: newItem.carbs,
      date: currentSelectedDate,
      user_id: user ? user.id : null,
    };

    let result;
    if (editingIndex !== null) {
      // Оновлюємо існуючий запис по id
      result = await supabase
        .from('meals')
        .update(payload)
        .eq('id', mealsState[activeMealKey][editingIndex].id);
    } else {
      // Створюємо новий запис
      result = await supabase.from('meals').insert([payload]);
    }

    if (!result.error) {
      loadMealsFromSupabase(currentSelectedDate);
      closeModal();
    }
  }

  // ================== SIDEBAR DAYS ==================
  function initDaysNavigation() {
    const dayButtons = document.querySelectorAll('.sidebar__day-btn');

    dayButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const dayName = btn.dataset.day;
        const today = new Date();
        const currentDayIndex = today.getDay() || 7;

        const targetDayIndex = {
          monday: 1,
          tuesday: 2,
          wednesday: 3,
          thursday: 4,
          friday: 5,
          saturday: 6,
          sunday: 7,
        }[dayName];

        const diff = targetDayIndex - currentDayIndex;
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + diff);

        currentSelectedDate = getLocalDateString(targetDate);

        dayButtons.forEach((b) => b.classList.remove('sidebar__day-btn--active'));
        btn.classList.add('sidebar__day-btn--active');

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

  // Обробка кнопок води
  document.querySelectorAll('.water-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const amount = parseFloat(btn.dataset.amount);
      if (!isNaN(amount)) {
        addWaterToSupabase(amount);
      }
    });
  });

  const resetWater = document.getElementById('resetWater');
  if (resetWater) {
    resetWater.addEventListener('click', resetWaterDay);
  }

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
  initDaysNavigation();
  loadMealsFromSupabase(currentSelectedDate);
});
