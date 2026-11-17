// Anti-FOUC: застосувати тему до першого рендеру.
// Підключається СИНХРОННО в <head> (без defer/async), щоб уникнути мигання.
document.documentElement.classList.add('no-transition');

(function () {
  const theme = localStorage.getItem('theme');
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();

// Знімаємо no-transition ПІСЛЯ першого рендеру, щоб колірні transitions ожили.
// Double rAF гарантує, що клас діяв під час першого paint (без мигання теми),
// а знявся одразу після нього. Без цього transitions лишались би вимкненими
// назавжди на сторінках, які не мають власного знімача (лише recipe-page.js мав).
function clearNoTransition() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.documentElement.classList.remove('no-transition');
    });
  });
}

if (document.readyState === 'loading') {
  // Чекаємо, поки DOM буде готовий, аби transitions вмикались після реального контенту.
  document.addEventListener('DOMContentLoaded', clearNoTransition, { once: true });
} else {
  clearNoTransition();
}
