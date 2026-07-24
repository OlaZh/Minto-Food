// Кнопка "Спробувати ще раз" на 500-сторінці (без inline onclick, CSP).
document.getElementById('errRetryBtn')?.addEventListener('click', () => {
  location.reload();
});
