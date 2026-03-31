// =============================================================
// auth.js — спільний модуль авторизації
// Підключається на всіх сторінках
// =============================================================

import { supabase } from './supabaseClient.js';
import { showToast } from './utils.js';

// =============================================================
// СТАН
// =============================================================

let currentUser = null;

// Callback який викликається при зміні стану авторизації
let onAuthChangeCallback = null;

// =============================================================
// ІНІЦІАЛІЗАЦІЯ — викликати на кожній сторінці
// =============================================================

export async function initAuth(onAuthChange = null) {
  onAuthChangeCallback = onAuthChange;

  // Створюємо модальне вікно логіну якщо ще немає
  if (
    !document.getElementById('auth-modal') ||
    !document.getElementById('auth-modal').querySelector('.auth-modal__window')
  ) {
    const existing = document.getElementById('auth-modal');
    if (existing) existing.remove();
    document.body.appendChild(createAuthModalHTML());
    initAuthModal();
  }

  // Слухаємо зміни стану авторизації
  supabase.auth.onAuthStateChange(async (event, session) => {
    currentUser = session?.user || null;

    updateAuthUI();

    if (onAuthChangeCallback) {
      onAuthChangeCallback(event, currentUser);
    }

    // Закриваємо модалку після успішного логіну
    if (event === 'SIGNED_IN') {
      closeAuthModal();
      showToast('Ласкаво просимо! 👋');
    }

    if (event === 'SIGNED_OUT') {
      showToast('Ви вийшли з акаунту');
    }
  });

  // Перевіряємо поточну сесію
  const {
    data: { session },
  } = await supabase.auth.getSession();
  currentUser = session?.user || null;
  updateAuthUI();

  return currentUser;
}

// =============================================================
// ОТРИМАТИ ПОТОЧНОГО КОРИСТУВАЧА
// =============================================================

export function getCurrentUser() {
  return currentUser;
}

// =============================================================
// ПЕРЕВІРКА ЧИ ЗАЛОГІНЕНИЙ
// =============================================================

export function isLoggedIn() {
  return currentUser !== null;
}

// =============================================================
// ВИМАГАТИ ЛОГІН ДЛЯ ДІЇ
// Якщо не залогінений — відкриває модалку і повертає false
// =============================================================

export function requireAuth(action = null) {
  if (isLoggedIn()) {
    return true;
  }

  // Зберігаємо дію щоб виконати після логіну
  if (action) {
    pendingAction = action;
  }

  openAuthModal();
  return false;
}

let pendingAction = null;

// =============================================================
// ЛОГІН ЧЕРЕЗ GOOGLE
// =============================================================

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.href,
    },
  });

  if (error) {
    console.error('Помилка Google логіну:', error);
    showToast('Помилка входу через Google', 'error');
  }
}

// =============================================================
// ЛОГІН ЧЕРЕЗ EMAIL + ПАРОЛЬ
// =============================================================

export async function signInWithEmail(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error('Помилка email логіну:', error);
    return { error: getErrorMessage(error.message) };
  }

  return { error: null };
}

// =============================================================
// РЕЄСТРАЦІЯ ЧЕРЕЗ EMAIL + ПАРОЛЬ
// =============================================================

export async function signUpWithEmail(email, password, name = '') {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
    },
  });

  if (error) {
    console.error('Помилка реєстрації:', error);
    return { error: getErrorMessage(error.message) };
  }

  return { error: null, message: 'Перевірте пошту для підтвердження' };
}

// =============================================================
// ВИХІД
// =============================================================

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Помилка виходу:', error);
  }
}

// =============================================================
// ОНОВЛЕННЯ UI — ім'я і кнопка в хедері
// =============================================================

function updateAuthUI() {
  const lang = localStorage.getItem('lang') || 'ua';
  const texts = {
    ua: { signIn: 'Увійти', signOut: 'Вийти' },
    pl: { signIn: 'Zaloguj się', signOut: 'Wyloguj się' },
    en: { signIn: 'Sign in', signOut: 'Sign out' },
  };
  const t = texts[lang] || texts.ua;

  const authBtnEl = document.getElementById('headerAuthBtn');
  if (!authBtnEl) return;

  if (currentUser) {
    const name =
      currentUser.user_metadata?.full_name ||
      currentUser.user_metadata?.name ||
      currentUser.email?.split('@')[0] ||
      'Профіль';

    authBtnEl.textContent = name;
    authBtnEl.href = 'profile.html';
    authBtnEl.onclick = null;

    // Ховаємо кнопку виходу з хедера якщо є
    const signOutBtn = document.getElementById('headerSignOutBtn');
    if (signOutBtn) signOutBtn.style.display = 'none';
  } else {
    authBtnEl.textContent = t.signIn;
    authBtnEl.href = '#';
    authBtnEl.onclick = (e) => {
      e.preventDefault();
      openAuthModal();
    };

    // Ховаємо кнопку виходу якщо є
    const signOutBtn = document.getElementById('headerSignOutBtn');
    if (signOutBtn) signOutBtn.style.display = 'none';
  }
}

// =============================================================
// МОДАЛЬНЕ ВІКНО АВТОРИЗАЦІЇ
// =============================================================

function createAuthModalHTML() {
  const div = document.createElement('div');
  div.innerHTML = `
    <div id="auth-modal" class="auth-modal" hidden>
      <div class="auth-modal__overlay"></div>
      <div class="auth-modal__window">
        <button class="auth-modal__close" id="authModalClose">&times;</button>

        <!-- ВКЛАДКИ -->
        <div class="auth-modal__tabs">
          <button class="auth-modal__tab auth-modal__tab--active" data-auth-tab="login">
            Увійти
          </button>
          <button class="auth-modal__tab" data-auth-tab="register">
            Реєстрація
          </button>
        </div>

        <!-- ЛОГІН -->
        <div class="auth-modal__content" data-auth-content="login">
          <button class="auth-modal__google-btn" id="authGoogleBtn">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Увійти через Google
          </button>

          <div class="auth-modal__divider">
            <span>або</span>
          </div>

          <form class="auth-modal__form" id="loginForm">
            <div class="form-group">
              <label>Email</label>
              <input type="email" id="loginEmail" placeholder="your@email.com" required />
            </div>
            <div class="form-group">
              <label>Пароль</label>
              <input type="password" id="loginPassword" placeholder="••••••••" required />
            </div>
            <p class="auth-modal__error" id="loginError" hidden></p>
            <button type="submit" class="auth-modal__submit">Увійти</button>
          </form>

          <p class="auth-modal__switch">
            Немає акаунту?
            <button class="auth-modal__switch-btn" data-auth-tab="register">Зареєструватись</button>
          </p>
        </div>

        <!-- РЕЄСТРАЦІЯ -->
        <div class="auth-modal__content" data-auth-content="register" hidden>
          <button class="auth-modal__google-btn" id="authGoogleBtnReg">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Зареєструватись через Google
          </button>

          <div class="auth-modal__divider">
            <span>або</span>
          </div>

          <form class="auth-modal__form" id="registerForm">
            <div class="form-group">
              <label>Ім'я</label>
              <input type="text" id="registerName" placeholder="Ваше ім'я" />
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" id="registerEmail" placeholder="your@email.com" required />
            </div>
            <div class="form-group">
              <label>Пароль</label>
              <input type="password" id="registerPassword" placeholder="Мінімум 6 символів" required />
            </div>
            <p class="auth-modal__error" id="registerError" hidden></p>
            <p class="auth-modal__success" id="registerSuccess" hidden></p>
            <button type="submit" class="auth-modal__submit">Створити акаунт</button>
          </form>

          <p class="auth-modal__switch">
            Вже є акаунт?
            <button class="auth-modal__switch-btn" data-auth-tab="login">Увійти</button>
          </p>
        </div>

      </div>
    </div>
  `;
  return div.firstElementChild;
}

function initAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;

  // Закриття
  document.getElementById('authModalClose')?.addEventListener('click', closeAuthModal);
  modal.querySelector('.auth-modal__overlay')?.addEventListener('click', closeAuthModal);

  // Перемикання вкладок
  modal.querySelectorAll('[data-auth-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchAuthTab(btn.dataset.authTab);
    });
  });

  // Google логін
  document.getElementById('authGoogleBtn')?.addEventListener('click', signInWithGoogle);
  document.getElementById('authGoogleBtnReg')?.addEventListener('click', signInWithGoogle);

  // Форма логіну
  document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');

    const { error } = await signInWithEmail(email, password);

    if (error) {
      errorEl.textContent = error;
      errorEl.hidden = false;
    } else {
      errorEl.hidden = true;

      // Виконуємо відкладену дію якщо є
      if (pendingAction) {
        pendingAction();
        pendingAction = null;
      }
    }
  });

  // Форма реєстрації
  document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const errorEl = document.getElementById('registerError');
    const successEl = document.getElementById('registerSuccess');

    const { error, message } = await signUpWithEmail(email, password, name);

    if (error) {
      errorEl.textContent = error;
      errorEl.hidden = false;
      successEl.hidden = true;
    } else {
      errorEl.hidden = true;
      successEl.textContent = message;
      successEl.hidden = false;
    }
  });
}

function switchAuthTab(tabName) {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;

  modal.querySelectorAll('.auth-modal__tab').forEach((tab) => {
    tab.classList.toggle('auth-modal__tab--active', tab.dataset.authTab === tabName);
  });

  modal.querySelectorAll('.auth-modal__content').forEach((content) => {
    content.hidden = content.dataset.authContent !== tabName;
  });
}

export function openAuthModal(tab = 'login') {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.hidden = false;
    switchAuthTab(tab);
    document.body.style.overflow = 'hidden';
  }
}

export function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.hidden = true;
    document.body.style.overflow = '';
  }
}

// =============================================================
// ХЕЛПЕРИ
// =============================================================

function getErrorMessage(message) {
  const errors = {
    'Invalid login credentials': 'Невірний email або пароль',
    'Email not confirmed': 'Підтвердіть email перед входом',
    'User already registered': 'Цей email вже зареєстрований',
    'Password should be at least 6 characters': 'Пароль має бути не менше 6 символів',
  };
  return errors[message] || 'Сталася помилка. Спробуйте ще раз.';
}
