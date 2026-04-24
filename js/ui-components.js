// =====================================
// UI COMPONENTS — спільні UI компоненти
// =====================================

// =====================================
// CUSTOM SELECT
// =====================================

/**
 * Ініціалізує кастомний селект
 * @param {string} selectId - ID контейнера селекту
 * @param {string} inputId - ID hidden input для значення
 * @param {Function} onChange - Колбек при зміні значення (опціонально)
 */
export function initCustomSelect(selectId, inputId, onChange = null) {
  const select = document.getElementById(selectId);
  const input = document.getElementById(inputId);
  if (!select || !input) return;

  const trigger = select.querySelector('.custom-select__trigger');
  const triggerText = trigger?.querySelector('span');
  const options = select.querySelectorAll('.custom-select__option');

  if (!trigger || !triggerText) return;

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    // Закриваємо інші селекти
    document.querySelectorAll('.custom-select').forEach((s) => {
      if (s !== select) s.classList.remove('open');
    });
    select.classList.toggle('open');
  });

  options.forEach((option) => {
    option.addEventListener('click', () => {
      options.forEach((o) => o.classList.remove('selected'));
      option.classList.add('selected');
      triggerText.textContent = option.textContent;
      input.value = option.dataset.value;
      select.classList.remove('open');

      if (onChange) {
        onChange(option.dataset.value, option);
      }
    });
  });
}

/**
 * Програмно встановлює значення селекту
 * @param {string} selectId - ID контейнера селекту
 * @param {string} inputId - ID hidden input
 * @param {string} value - Значення для встановлення
 */
export function setSelectValue(selectId, inputId, value) {
  const select = document.getElementById(selectId);
  const input = document.getElementById(inputId);
  if (!select || !input) return;

  input.value = value;
  const option = select.querySelector(`[data-value="${value}"]`);
  if (option) {
    select
      .querySelectorAll('.custom-select__option')
      .forEach((o) => o.classList.remove('selected'));
    option.classList.add('selected');
    const triggerSpan = select.querySelector('.custom-select__trigger span');
    if (triggerSpan) {
      triggerSpan.textContent = option.textContent;
    }
  }
}

/**
 * Закриває всі відкриті селекти (викликати на document click)
 */
export function closeAllSelects() {
  document.querySelectorAll('.custom-select').forEach((s) => s.classList.remove('open'));
}

/**
 * Ініціалізує глобальний слухач для закриття селектів
 */
export function initSelectsGlobalListener() {
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select')) {
      closeAllSelects();
    }
  });
}

// =====================================
// CONFIRM MODAL
// =====================================

/**
 * Показує модалку підтвердження
 * @param {Object} options
 * @param {string} options.title - Заголовок
 * @param {string} options.message - Текст повідомлення
 * @param {string} options.confirmText - Текст кнопки підтвердження
 * @param {string} options.cancelText - Текст кнопки скасування
 * @param {Function} options.onConfirm - Колбек при підтвердженні
 * @param {Function} options.onCancel - Колбек при скасуванні
 */
export function showConfirmModal({
  title = 'Підтвердження',
  message = 'Ви впевнені?',
  confirmText = 'Так',
  cancelText = 'Ні',
  onConfirm = () => {},
  onCancel = () => {},
}) {
  // Шукаємо існуючу модалку або створюємо нову
  let modal = document.getElementById('ui-confirm-modal');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'ui-confirm-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-card confirm-box">
        <h3 class="confirm-title"></h3>
        <p class="confirm-message"></p>
       <div class="confirm-btns">
          <button class="confirm-yes btn-confirm btn-danger"></button>
          <button class="confirm-no btn-secondary"></button>
       </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const titleEl = modal.querySelector('.confirm-title');
  const messageEl = modal.querySelector('.confirm-message');
  const yesBtn = modal.querySelector('.confirm-yes');
  const noBtn = modal.querySelector('.confirm-no');

  titleEl.textContent = title;
  messageEl.textContent = message;
  yesBtn.textContent = confirmText;
  noBtn.textContent = cancelText;

  modal.classList.add('is-active');
  modal.hidden = false;

  const close = () => {
    modal.classList.remove('is-active');
    modal.hidden = true;
  };

  yesBtn.onclick = () => {
    close();
    onConfirm();
  };

  noBtn.onclick = () => {
    close();
    onCancel();
  };

  // Закриття по кліку на overlay
  modal.onclick = (e) => {
    if (e.target === modal) {
      close();
      onCancel();
    }
  };
}

// =====================================
// GENERIC MODAL
// =====================================

/**
 * Відкриває модалку по ID
 * @param {string} modalId - ID модалки
 */
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  modal.classList.add('active', 'is-active');
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
}

/**
 * Закриває модалку по ID
 * @param {string} modalId - ID модалки
 */
export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  modal.classList.remove('active', 'is-active');
  modal.hidden = true;
  document.body.style.overflow = '';
}

/**
 * Ініціалізує модалку з кнопками закриття та overlay
 * @param {string} modalId - ID модалки
 * @param {Object} options
 * @param {string} options.closeSelector - Селектор кнопки закриття
 * @param {string} options.overlaySelector - Селектор overlay
 * @param {Function} options.onClose - Колбек при закритті
 */
export function initModal(modalId, options = {}) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  const {
    closeSelector = '.modal__close',
    overlaySelector = '.modal__overlay',
    onClose = () => {},
  } = options;

  const closeBtn = modal.querySelector(closeSelector);
  const overlay = modal.querySelector(overlaySelector);

  const close = () => {
    closeModal(modalId);
    onClose();
  };

  if (closeBtn) {
    closeBtn.addEventListener('click', close);
  }

  if (overlay) {
    overlay.addEventListener('click', close);
  }

  // Закриття по Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) {
      close();
    }
  });
}

// =====================================
// TABS
// =====================================

/**
 * Ініціалізує табси
 * @param {Object} options
 * @param {string} options.buttonsSelector - Селектор кнопок табів
 * @param {string} options.sectionsSelector - Селектор секцій контенту
 * @param {string} options.activeClass - Клас активного табу
 * @param {Function} options.onTabChange - Колбек при зміні табу (tab, section)
 */
export function initTabs({
  buttonsSelector,
  sectionsSelector,
  activeClass = 'active',
  onTabChange = () => {},
}) {
  const buttons = document.querySelectorAll(buttonsSelector);
  const sections = document.querySelectorAll(sectionsSelector);

  if (!buttons.length || !sections.length) return;

  // Початковий стан — перший таб активний
  sections.forEach((section, index) => {
    if (index === 0) {
      section.removeAttribute('hidden');
      section.style.display = 'block';
    } else {
      section.setAttribute('hidden', '');
      section.style.display = 'none';
    }
  });

  buttons[0]?.classList.add(activeClass);
  buttons[0]?.setAttribute('aria-selected', 'true');

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      // Деактивуємо всі кнопки
      buttons.forEach((b) => {
        b.classList.remove(activeClass);
        b.setAttribute('aria-selected', 'false');
      });

      // Активуємо поточну кнопку
      btn.classList.add(activeClass);
      btn.setAttribute('aria-selected', 'true');

      const tab = btn.dataset.tab;

      // Перемикаємо секції
      sections.forEach((section) => {
        const sectionTab = section.dataset.profileSection || section.dataset.tab;
        const isActive = sectionTab === tab;

        if (isActive) {
          section.removeAttribute('hidden');
          section.style.display = 'block';
          onTabChange(tab, section);
        } else {
          section.setAttribute('hidden', '');
          section.style.display = 'none';
        }
      });
    });
  });
}

// =====================================
// LOADING INDICATOR
// =====================================

/**
 * Показує індикатор завантаження
 * @param {string|HTMLElement} container - Контейнер або його селектор
 * @param {string} message - Повідомлення
 */
export function showLoading(container, message = 'Завантаження...') {
  const el = typeof container === 'string' ? document.querySelector(container) : container;
  if (!el) return;

  el.innerHTML = `
    <div class="loading-indicator">
      <div class="loading-spinner"></div>
      <span class="loading-text">${message}</span>
    </div>
  `;
}

/**
 * Показує стан "пусто"
 * @param {string|HTMLElement} container - Контейнер або його селектор
 * @param {string} icon - Емодзі іконка
 * @param {string} message - Повідомлення
 */
export function showEmpty(container, icon = '📭', message = 'Немає даних') {
  const el = typeof container === 'string' ? document.querySelector(container) : container;
  if (!el) return;

  el.innerHTML = `
    <div class="empty-state">
      <span class="empty-icon">${icon}</span>
      <p class="empty-text">${message}</p>
    </div>
  `;
}
