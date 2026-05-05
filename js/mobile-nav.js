import { lockScroll, unlockScroll } from './scroll-lock.js';

(() => {
  const burger = document.querySelector('.header__burger');
  const nav = document.querySelector('.header__nav');
  const overlay = document.querySelector('.header__nav-overlay');

  if (!burger || !nav || !overlay) return;

  function openMenu() {
    nav.classList.add('is-open');
    overlay.classList.add('is-open');
    burger.classList.add('is-active');
    burger.setAttribute('aria-expanded', 'true');
    lockScroll('mobile-nav');
  }

  function closeMenu() {
    nav.classList.remove('is-open');
    overlay.classList.remove('is-open');
    burger.classList.remove('is-active');
    burger.setAttribute('aria-expanded', 'false');
    unlockScroll('mobile-nav');
  }

  burger.addEventListener('click', () => {
    const isOpen = nav.classList.contains('is-open');
    isOpen ? closeMenu() : openMenu();
  });

  overlay.addEventListener('click', closeMenu);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  nav.querySelectorAll('.header__nav-link').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  const mq = window.matchMedia('(min-width: 769px)');
  mq.addEventListener('change', (e) => {
    if (e.matches) closeMenu();
  });
})();
