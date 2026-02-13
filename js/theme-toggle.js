document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.querySelector('.theme-toggle');
  const root = document.documentElement;

  if (!themeToggle) return;

  themeToggle.addEventListener('click', () => {
    // 🟢 вмикаємо анімацію ТІЛЬКИ при кліку
    root.classList.add('theme-transition');

    const isDark = root.getAttribute('data-theme') === 'dark';

    if (isDark) {
      root.removeAttribute('data-theme');
      localStorage.removeItem('theme');
    } else {
      root.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    }

    // 🟢 прибираємо клас після перемальовки
    requestAnimationFrame(() => {
      root.classList.remove('theme-transition');
    });
  });
});
