/* ============================================================
   1. Дані продуктів (приклад)
   ============================================================ */

const products = [
  {
    id: 1,
    name: 'Куряче філе',
    shortDesc: 'Нежирне джерело білка.',
    image: 'img/chicken.jpg',
    macros: { kcal: 113, protein: 23, fat: 1.9, carbs: 0 },
    tags: ['білковий', 'дієтичний', 'спортсменам'],

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

/* ============================================================
   2. Елементи DOM
   ============================================================ */

const productCards = document.querySelectorAll('.product-card-mini');
const modal = document.querySelector('[data-modal="product"]');

/* ============================================================
   3. Відкриття модалки
   ============================================================ */

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

/* ============================================================
   4. Допоміжна функція
   ============================================================ */

function fillList(listElement, items) {
  if (!listElement || !items) return;
  listElement.innerHTML = '';
  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    listElement.appendChild(li);
  });
}

/* ============================================================
   5. Закриття модалки
   ============================================================ */

document.addEventListener('click', (e) => {
  if (e.target.matches('[data-modal-close]')) {
    const modalToClose = e.target.closest('.modal');
    if (modalToClose) modalToClose.hidden = true;
  }
});

/* ============================================================
   6. Клік по міні-картці
   ============================================================ */

productCards.forEach((card) => {
  card.addEventListener('click', () => {
    const id = Number(card.dataset.productId);
    if (!id) return;

    const product = products.find((p) => p.id === id);
    if (product) openProductModal(product);
  });
});

/* ============================================================
   7. Акордеони
   ============================================================ */

document.addEventListener('click', (e) => {
  if (!e.target.classList.contains('accordion__toggle')) return;

  const content = e.target.nextElementSibling;
  if (!content) return;

  content.classList.toggle('open');
  e.target.classList.toggle('active');
});

/* ============================================================
   8. ПІДФІЛЬТРИ ТА СИСТЕМА ЧІПСІВ (ОНОВЛЕНО: БЕЗ НАШАРУВАНЬ)
   ============================================================ */

(function () {
  const initFilterSystem = () => {
    const inputEl = document.querySelector('.product-search__input');
    const containerEl = document.querySelector('.product-search');
    const filterBtns = document.querySelectorAll('.product-filters__item');
    const subGroups = document.querySelectorAll('.subfilter-group');

    if (!inputEl || filterBtns.length === 0) return;

    // 1. Фільтрація продуктів
    const activeFilterProducts = () => {
      const text = inputEl.value.trim().toLowerCase();
      const chips = [...document.querySelectorAll('.search-chip')].map((c) =>
        c.dataset.value.toLowerCase(),
      );

      productCards.forEach((card) => {
        const title = card.querySelector('.product-card-mini__title')?.textContent.toLowerCase() || '';
        const tags = [...card.querySelectorAll('.tag')].map((t) => t.textContent.toLowerCase());

        let isVisible = true;
        if (text && !title.includes(text)) isVisible = false;

        chips.forEach((chip) => {
          const matchTitle = title.includes(chip);
          const matchTags = tags.some((tag) => tag.includes(chip));
          if (!matchTitle && !matchTags) isVisible = false;
        });

        card.style.display = isVisible ? '' : 'none';
      });
    };

    // 2. Додавання чіпса
    const addNewChip = (label) => {
      if (document.querySelector(`.search-chip[data-value="${label}"]`)) return;

      const chip = document.createElement('span');
      chip.className = 'search-chip';
      chip.dataset.value = label;
      chip.innerHTML = `${label}<button class="chip-remove">✕</button>`;

      chip.querySelector('.chip-remove').onclick = (e) => {
        e.stopPropagation();
        chip.remove();
        activeFilterProducts();
      };

      containerEl.insertBefore(chip, inputEl);
      activeFilterProducts();
    };

    // 3. Клік по фільтрах (ГОРЯЧА ПРАВКА: прибирає нашарування)
    filterBtns.forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const target = btn.dataset.filter;
        const targetGroup = document.querySelector(`.subfilter-group[data-subfilter="${target}"]`);
        
        const wasActive = targetGroup?.classList.contains('active');

        // Спочатку ГАРАНТОВАНО закриваємо абсолютно всі підменю
        subGroups.forEach((g) => g.classList.remove('active'));
        filterBtns.forEach((b) => b.classList.remove('is-active'));

        // Відкриваємо тільки те, на яке натиснули (якщо воно не було вже відкрите)
        if (targetGroup && !wasActive) {
          targetGroup.classList.add('active');
          btn.classList.add('is-active');
        }
      };
    });

    // 4. Клік по елементу підменю (Закриваємо шторку після вибору)
    subGroups.forEach((group) => {
      group.onclick = (e) => {
        const item = e.target.closest('.subfilter-item');
        if (!item) return;

        addNewChip(item.textContent.trim());
        
        // Вибрали? Ховаємо меню, щоб побачити результат
        group.classList.remove('active');
        filterBtns.forEach((b) => b.classList.remove('is-active'));
      };
    });

    // 5. Пошук при вводі
    inputEl.oninput = () => {
      subGroups.forEach((g) => g.classList.remove('active'));
      filterBtns.forEach((b) => b.classList.remove('is-active'));
      activeFilterProducts();
    };

    // 6. Закриття при кліку повз (ОНОВЛЕНО)
    document.addEventListener('click', (e) => {
      // Якщо клікнули не по фільтрах і не по самому меню — ховаємо все
      if (!e.target.closest('.product-filters') && !e.target.closest('.subfilter-group')) {
        subGroups.forEach((g) => g.classList.remove('active'));
        filterBtns.forEach((b) => b.classList.remove('is-active'));
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFilterSystem);
  } else {
    initFilterSystem();
  }
})();