import { getTheme, loadUserStorage, setTheme } from './storage.js';

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else {
    root.removeAttribute('data-theme');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;
  const themeToggle = document.querySelector('.theme-toggle');

  // 1) Навішуємо обробник одразу — він не повинен залежати від того,
  //    чи вдалося завантажити налаштування з БД. Раніше виняток у
  //    loadUserStorage() вбивав цей колбек ДО addEventListener, і
  //    перемикач лишався мертвим (тема не перемикалась узагалі).
  if (themeToggle) {
    themeToggle.addEventListener('click', async () => {
      root.classList.add('theme-transition');

      const nextTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);

      try {
        await setTheme(nextTheme);
      } catch (err) {
        console.warn('[theme] failed to persist theme:', err);
      }

      requestAnimationFrame(() => {
        root.classList.remove('theme-transition');
      });
    });
  }

  // 2) Початкове застосування збереженої теми — окремо й безпечно.
  (async () => {
    try {
      await loadUserStorage();
      applyTheme(getTheme());
    } catch (err) {
      console.warn('[theme] failed to load stored theme:', err);
    }
  })();
});
