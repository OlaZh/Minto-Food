console.log("meals.js запустився");
console.log(document.querySelectorAll(".meal__add"));

// js/meals.js
import { updateStats } from "./stats.js";
import { searchFood } from "./food-api.js";

document.addEventListener("DOMContentLoaded", () => {
  // ================== STATE ==================
  const mealsState = {
    breakfast: [],
    snack1: [],
    lunch: [],
    snack2: [],
    dinner: [],
  };

  const STORAGE_KEY = "mealsState";

  let activeMealKey = null;
  let selectedFood = null;
  let editingIndex = null;

  const summaryValue = document.querySelector(".day-summary__value");

  // ================== DAILY NORM ==================
  const dailyNorm = Number(localStorage.getItem("dailyCaloriesNorm")) || 0;

  // ================== STORAGE ==================
  function saveMealsToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mealsState));
  }

  function loadMealsFromStorage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    const parsed = JSON.parse(saved);

    Object.keys(mealsState).forEach((mealKey) => {
      mealsState[mealKey] = parsed[mealKey] || [];
      renderMeal(mealKey);
    });

    renderSummary();
  }

  function clearDay() {
    localStorage.removeItem(STORAGE_KEY);

    Object.keys(mealsState).forEach((mealKey) => {
      mealsState[mealKey] = [];
      renderMeal(mealKey);
    });

    renderSummary();
  }

  // ================== RENDER ==================
  function renderMeal(mealKey) {
    const mealBlock = document.querySelector(`.meal[data-meal="${mealKey}"]`);
    if (!mealBlock) return;

    const list = mealBlock.querySelector(".meal__recipes");
    list.innerHTML = "";

    mealsState[mealKey].forEach((item, index) => {
      const li = document.createElement("li");
      li.className = "meal__recipe";

      li.innerHTML = `
        <span class="meal__recipe-name">${item.name}</span>
        <span class="meal__recipe-kcal">
          ${item.kcal} ккал · Б ${item.protein} · Ж ${item.fat} · В ${item.carbs}
        </span>
      `;

      li.addEventListener("click", () => {
        editingIndex = index;
        openModal(mealKey, item);
      });

      list.appendChild(li);
    });
  }

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
      summaryValue.textContent = `${total.kcal} ккал · Б ${total.protein} · Ж ${total.fat} · В ${total.carbs}`;
    }

    // ===== PROGRESS =====
    const progress = dailyNorm ? total.kcal / dailyNorm : 0;

    updateStats({
      ...total,
      dailyNorm,
      progress,
    });
  }

  // ================== MODAL ELEMENTS ==================
  const modal = document.getElementById("addFoodModal");
  const overlay = modal.querySelector(".modal__overlay");
  const closeBtn = modal.querySelector(".modal__close");
  const confirmBtn = modal.querySelector(".modal__confirm");
  const resultsList = modal.querySelector("#foodResults");
  const body = modal.querySelector(".modal__body");

  // ===== INPUT NAME =====
  let nameInput = body.querySelector(".modal__input");
  if (!nameInput) {
    nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Назва продукту";
    nameInput.className = "modal__input";
    body.prepend(nameInput);
  }

  // ===== INPUT WEIGHT =====
  const weightInput = body.querySelector(".modal__weight");

  // ================== MODAL LOGIC ==================
  function updateConfirmState() {
    const weight = Number(weightInput.value);
    confirmBtn.disabled = !(selectedFood && weight > 0);
  }

  function openModal(mealKey, item = null) {
    activeMealKey = mealKey;
    selectedFood = null;

    resultsList.innerHTML = "";
    confirmBtn.disabled = true;

    nameInput.value = item ? item.name.replace(/\s\(.*?\)$/, "") : "";
    weightInput.value = item ? item.weight : "";

    modal.hidden = false;
    nameInput.focus();
  }

  function closeModal() {
    modal.hidden = true;
    activeMealKey = null;
    selectedFood = null;
    editingIndex = null;

    nameInput.value = "";
    weightInput.value = "";
    resultsList.innerHTML = "";
  }

  // ================== SEARCH ==================
  // ================== SEARCH ==================
  async function handleSearch() {
    const query = nameInput.value.trim();
    resultsList.innerHTML = "";
    selectedFood = null;
    confirmBtn.disabled = true;

    if (!query) return;

    const results = await searchFood(query);
    if (!results.length) return;

    results.forEach((food) => {
      const li = document.createElement("li");
      li.className = "modal__item";
      li.textContent = `${food.name} — ${food.kcal} ккал / 100г`;

      li.addEventListener("click", () => {
        selectedFood = food;

        // 1. Встановлюємо повну назву
        nameInput.value = food.name;

        // 2. Підсвічуємо вибраний елемент
        [...resultsList.children].forEach((el) =>
          el.classList.remove("modal__item--active"),
        );
        li.classList.add("modal__item--active");

        // 3. Оновлюємо стан кнопки "Додати"
        updateConfirmState();

        // 4. Переводимо фокус на вагу, щоб можна було одразу писати цифри
        if (weightInput) weightInput.focus();

        // СПИСОК БІЛЬШЕ НЕ ОЧИЩАЄМО, щоб він не "стрибав"
      });

      resultsList.appendChild(li);
    });
  }
  // ================== ADD FOOD ==================
  function addSelectedFood() {
    if (!activeMealKey || !selectedFood) return;

    const grams = Number(weightInput.value);
    if (grams <= 0) return;

    const factor = grams / 100;

    const newItem = {
      name: `${selectedFood.name} (${grams} г)`,
      weight: grams,
      kcal: Math.round(selectedFood.kcal * factor),
      protein: +(selectedFood.protein * factor).toFixed(1),
      fat: +(selectedFood.fat * factor).toFixed(1),
      carbs: +(selectedFood.carbs * factor).toFixed(1),
    };

    if (editingIndex !== null) {
      mealsState[activeMealKey][editingIndex] = newItem;
    } else {
      mealsState[activeMealKey].push(newItem);
    }

    renderMeal(activeMealKey);
    renderSummary();
    saveMealsToStorage();
    closeModal();
  }

  // ================== EVENTS ==================
  document.querySelectorAll(".meal__add").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mealBlock = btn.closest(".meal");
      if (!mealBlock) return;

      const mealKey = mealBlock.dataset.meal;
      if (!mealKey) return;

      editingIndex = null;
      openModal(mealKey);
    });
  });

  nameInput.addEventListener("input", handleSearch);
  weightInput.addEventListener("input", updateConfirmState);

  confirmBtn.addEventListener("click", addSelectedFood);
  closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", closeModal);

  const clearBtn = document.getElementById("clearDayBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", clearDay);
  }

  // ================== INIT ==================
  loadMealsFromStorage();
});
