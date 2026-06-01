import { getTheme, loadUserStorage, setTheme } from './storage.js';

document.addEventListener('DOMContentLoaded', async () => {
  await loadUserStorage();

  const themeToggle = document.querySelector('.theme-toggle');
  const root = document.documentElement;

  if (getTheme() === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else {
    root.removeAttribute('data-theme');
  }

  if (!themeToggle) return;

  themeToggle.addEventListener('click', async () => {
    root.classList.add('theme-transition');

    const nextTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';

    if (nextTheme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }

    await setTheme(nextTheme);

    requestAnimationFrame(() => {
      root.classList.remove('theme-transition');
    });
  });
});
