// =====================================
// UI COMPONENTS — спільні UI компоненти
// =====================================

import { iconInbox } from './icons.js';

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
      // innerHTML, а не textContent — опція може містити іконку (.nav-icon)
      triggerText.innerHTML = option.innerHTML;
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
      // innerHTML, а не textContent — опція може містити іконку (.nav-icon)
      triggerSpan.innerHTML = option.innerHTML;
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

// Примітка: спільні openModal/closeModal/initModal/initTabs видалено в
// межах C3 — це були мертві експорти (0 імпортів). Кожна модалка має
// власну автономну логіку показу (cookbook/meals — локальні open/close,
// система B — .is-active/.is-open). Саме існування цих функцій з трьома
// контрактами (active+is-active+hidden) і створювало ілюзію
// «непослідовного контракту», описану в аудиті.

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
export function showEmpty(container, icon = iconInbox, message = 'Немає даних') {
  const el = typeof container === 'string' ? document.querySelector(container) : container;
  if (!el) return;

  el.innerHTML = `
    <div class="empty-state">
      <span class="empty-icon">${icon}</span>
      <p class="empty-text">${message}</p>
    </div>
  `;
}
