/* ============================================================
   PRODUCT GUIDE PAGE JS (FINAL)
   ============================================================ */

/* -----------------------------
   1. Дані продуктів (приклад)
   ----------------------------- */

const products = [
  {
    id: 1,
    name: 'Куряче філе',
    shortDesc: 'Нежирне джерело білка.',
    image: 'img/chicken.jpg',
    macros: { kcal: 113, protein: 23, fat: 1.9, carbs: 0 },
    tags: ['білковий', 'дієтичний', 'спортсменам'],

    /* ДОДАНО НОВІ ПОЛЯ ДЛЯ ФІЛЬТРІВ */
    macrosType: 'protein',
    gi: 'low',
    type: 'meat',
    purpose: ['diet', 'sport'],
    timeOfDay: ['morning', 'day', 'evening'],

    benefits: [
      'Високий вміст білка',
      'Низький вміст жиру',
      'Добре для відновлення після тренування',
    ],

    harm: [
      'Може бути сухим при неправильному приготуванні',
      'У великій кількості може перевантажувати травлення',
    ],

    whenToEat: [
      'Вранці — добре для білкового сніданку',
      'Вдень — оптимально для обіду',
      'Ввечері — можна без важких соусів',
      'Перед тренуванням — легке джерело білка',
      'Після тренування — ідеально',
    ],

    whenNotToEat: ['Перед сном у великій кількості', 'При проблемах зі шлунком'],

    goodComb: ['Овочі', 'Крупи', 'Зелень'],
    badComb: ['Жирні соуси', 'Смажена картопля'],

    reaction: ['Довго тримає ситість', 'Стабілізує рівень цукру', 'Допомагає відновленню м’язів'],

    myths: [{ myth: 'Міф: курка суха', truth: 'Правда: при правильному приготуванні соковита' }],

    recipes: ['Курка з овочами', 'Філе в йогуртовому маринаді', 'Салат з куркою'],

    substitutes: {
      can: ['Індичка', 'Кролик'],
      cannot: ['Яйця'],
    },

    similar: ['Індичка', 'Кролик', 'Тунець'],
  },
];

/* -----------------------------
   2. Елементи DOM
   ----------------------------- */

const searchInput = document.querySelector('.product-search__input');
const productCards = document.querySelectorAll('.product-card-mini');
const modal = document.querySelector('[data-modal="product"]');

/* -----------------------------
   3. Відкриття модалки
   ----------------------------- */

function openProductModal(product) {
  modal.querySelectorAll('.accordion__content').forEach((el) => el.classList.remove('open'));
  modal.querySelectorAll('.accordion__toggle').forEach((el) => el.classList.remove('active'));
  if (!modal) return;

  const titleEl = modal.querySelector('[data-i18n="productName"]');
  if (titleEl) titleEl.textContent = product.name;

  const imgEl = modal.querySelector('.product-modal__image');
  if (imgEl) imgEl.src = product.image;

  const descEl = modal.querySelector('[data-i18n="productShortDesc"]');
  if (descEl) descEl.textContent = product.shortDesc;

  const kcalEl = modal.querySelector('[data-i18n="kcal"]');
  const proteinEl = modal.querySelector('[data-i18n="protein"]');
  const fatEl = modal.querySelector('[data-i18n="fat"]');
  const carbsEl = modal.querySelector('[data-i18n="carbs"]');

  if (kcalEl) kcalEl.textContent = product.macros.kcal + ' ккал';
  if (proteinEl) proteinEl.textContent = product.macros.protein + 'Б';
  if (fatEl) fatEl.textContent = product.macros.fat + 'Ж';
  if (carbsEl) carbsEl.textContent = product.macros.carbs + 'В';

  const tagsContainer = modal.querySelector('.product-modal__tags');
  if (tagsContainer) {
    tagsContainer.innerHTML = '';
    product.tags.forEach((tag) => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = tag;
      tagsContainer.appendChild(span);
    });
  }

  const benefitsList =
    modal
      .querySelector('[data-i18n="benefit1"]')
      ?.closest('.accordion__content')
      ?.querySelector('.accordion__list') || null;
  fillList(benefitsList, product.benefits);

  const harmList =
    modal
      .querySelector('[data-i18n="harm1"]')
      ?.closest('.accordion__content')
      ?.querySelector('.accordion__list') || null;
  fillList(harmList, product.harm);

  const whenToEatList =
    modal
      .querySelector('[data-i18n="eatMorning"]')
      ?.closest('.accordion__content')
      ?.querySelector('.accordion__list') || null;
  fillList(whenToEatList, product.whenToEat);

  const whenNotToEatList =
    modal
      .querySelector('[data-i18n="notEatNight"]')
      ?.closest('.accordion__content')
      ?.querySelector('.accordion__list') || null;
  fillList(whenNotToEatList, product.whenNotToEat);

  const reactionList =
    modal
      .querySelector('[data-i18n="reaction1"]')
      ?.closest('.accordion__content')
      ?.querySelector('.accordion__list') || null;
  fillList(reactionList, product.reaction);

  const combContent = modal.querySelector('[data-i18n="goodComb"]')?.closest('.accordion__content');
  if (combContent) {
    const combLists = combContent.querySelectorAll('.accordion__list');
    fillList(combLists[0], product.goodComb);
    fillList(combLists[1], product.badComb);
  }

  const mythsContent = modal.querySelector('[data-i18n="myth1"]')?.closest('.accordion__content');
  if (mythsContent) {
    const mythsList = mythsContent.querySelector('.accordion__list');
    mythsList.innerHTML = '';
    product.myths.forEach((item) => {
      mythsList.innerHTML += `<li>${item.myth}</li><li>${item.truth}</li>`;
    });
  }

  const recipesContent = modal.querySelector('[data-i18n="recipes"]')?.closest('.accordion');
  if (recipesContent) {
    const recipesCarousel = recipesContent.querySelector('.product-modal__carousel');
    recipesCarousel.innerHTML = '';
    product.recipes.forEach((r) => {
      const div = document.createElement('div');
      div.className = 'product-modal__recipe';
      div.textContent = r;
      recipesCarousel.appendChild(div);
    });
  }

  const subsContent = modal
    .querySelector('[data-i18n="canSubstitute"]')
    ?.closest('.accordion__content');
  if (subsContent) {
    const subsLists = subsContent.querySelectorAll('.accordion__list');
    fillList(subsLists[0], product.substitutes.can);
    fillList(subsLists[1], product.substitutes.cannot);
  }

  const similarContent =
    modal.querySelector('[data-i18n="similar1"]')?.closest('.accordion__content') ||
    modal.querySelector('[data-i18n="similarProducts"]')?.closest('.accordion__content');

  if (similarContent) {
    const similarCarousel = similarContent.querySelector('.product-modal__carousel');
    similarCarousel.innerHTML = '';
    product.similar.forEach((s) => {
      const div = document.createElement('div');
      div.className = 'product-modal__similar';
      div.textContent = s;
      similarCarousel.appendChild(div);
    });
  }

  modal.hidden = false;
}

/* -----------------------------
   4. Допоміжна функція
   ----------------------------- */

function fillList(listElement, items) {
  if (!listElement || !items) return;
  listElement.innerHTML = '';
  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    listElement.appendChild(li);
  });
}

/* -----------------------------
   5. Закриття модалки
   ----------------------------- */

document.addEventListener('click', (e) => {
  if (e.target.matches('[data-modal-close]')) {
    const modalToClose = e.target.closest('.modal');
    if (modalToClose) modalToClose.hidden = true;
  }
});

/* -----------------------------
   6. Клік по міні-картці
   ----------------------------- */

productCards.forEach((card) => {
  card.addEventListener('click', () => {
    const id = Number(card.dataset.productId);
    if (!id) return;

    const product = products.find((p) => p.id === id);
    if (product) openProductModal(product);
  });
});

/* -----------------------------
   7. Пошук продуктів
   ----------------------------- */

if (searchInput) {
  searchInput.addEventListener('input', () => {
    const value = searchInput.value.toLowerCase().trim();

    productCards.forEach((card) => {
      const titleEl = card.querySelector('.product-card-mini__title');
      if (!titleEl) return;

      const title = titleEl.textContent.toLowerCase();
      card.style.display = title.includes(value) ? '' : 'none';
    });
  });
}

/* -----------------------------
   8. Акордеони
   ----------------------------- */

document.addEventListener('click', (e) => {
  if (!e.target.classList.contains('accordion__toggle')) return;

  const content = e.target.nextElementSibling;
  if (!content) return;

  content.classList.toggle('open');
  e.target.classList.toggle('active');
});

/* -----------------------------
   9. Активні фільтри (старе)
   ----------------------------- */

document.querySelectorAll('.product-filters__item').forEach((btn) => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('is-active');
  });
});

/* ============================================================
   10. DROPDOWN‑ФІЛЬТРИ (НОВЕ)
   ============================================================ */

/* Структура фільтрів */
const filterOptions = {
  macros: [
    { value: 'protein', label: 'Білкові' },
    { value: 'fat', label: 'Жирні' },
    { value: 'carbs', label: 'Вуглеводні' },
    { value: 'lowKcal', label: 'Низькокалорійні' },
    { value: 'balanced', label: 'Збалансовані' },
  ],
  gi: [
    { value: 'low', label: 'Низький ГІ' },
    { value: 'medium', label: 'Середній ГІ' },
    { value: 'high', label: 'Високий ГІ' },
  ],
  type: [
    { value: 'meat', label: 'М’ясо' },
    { value: 'fish', label: 'Риба' },
    { value: 'fruit', label: 'Фрукти' },
    { value: 'vegetable', label: 'Овочі' },
    { value: 'grain', label: 'Крупи' },
    { value: 'dairy', label: 'Молочка' },
    { value: 'nuts', label: 'Горіхи' },
    { value: 'drink', label: 'Напої' },
  ],
  purpose: [
    { value: 'diet', label: 'Дієта' },
    { value: 'weightGain', label: 'Набір ваги' },
    { value: 'sport', label: 'Спорт' },
    { value: 'healthy', label: 'Здорове харчування' },
    { value: 'snack', label: 'Перекус' },
  ],
  timeOfDay: [
    { value: 'morning', label: 'Ранок' },
    { value: 'day', label: 'День' },
    { value: 'evening', label: 'Вечір' },
    { value: 'snack', label: 'Перекус' },
  ],
};

/* Активні фільтри */
const activeFilters = {
  macros: null,
  gi: null,
  type: null,
  purpose: null,
  timeOfDay: null,
};

/* Генерація dropdown */
document.querySelectorAll('.product-filters__item').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();

    const filterType = btn.dataset.filter;
    if (!filterType) return;

    document.querySelectorAll('.filter-dropdown').forEach((d) => d.remove());

    const dropdown = document.createElement('div');
    dropdown.className = 'filter-dropdown';

    filterOptions[filterType].forEach((opt) => {
      const optionBtn = document.createElement('button');
      optionBtn.textContent = opt.label;
      optionBtn.dataset.value = opt.value;

      optionBtn.addEventListener('click', () => {
        activeFilters[filterType] = opt.value;
        applyFilters();
        dropdown.remove();
      });

      dropdown.appendChild(optionBtn);
    });

    btn.appendChild(dropdown);
    dropdown.classList.add('open');
  });
});

/* Закриття dropdown при кліку поза ним */
document.addEventListener('click', () => {
  document.querySelectorAll('.filter-dropdown').forEach((d) => d.remove());
});

/* Логіка фільтрації */
function applyFilters() {
  productCards.forEach((card) => {
    const id = Number(card.dataset.productId);
    const product = products.find((p) => p.id === id);
    if (!product) return;

    let visible = true;

    if (activeFilters.macros && product.macrosType !== activeFilters.macros) visible = false;
    if (activeFilters.gi && product.gi !== activeFilters.gi) visible = false;
    if (activeFilters.type && product.type !== activeFilters.type) visible = false;
    if (activeFilters.purpose && !product.purpose.includes(activeFilters.purpose)) visible = false;
    if (activeFilters.timeOfDay && !product.timeOfDay.includes(activeFilters.timeOfDay))
      visible = false;

    card.style.display = visible ? '' : 'none';
  });
}
