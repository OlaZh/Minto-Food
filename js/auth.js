// =============================================================
// auth.js — спільний модуль авторизації
// Підключається на всіх сторінках
// =============================================================

import { supabase } from './supabaseClient.js';
import { showToast } from './utils.js';
import { lockScroll, unlockScroll } from './scroll-lock.js';
import { t } from './i18n-apply.js';
import { iconChevronDown, iconUser, iconShield, iconLogOut, iconEye } from './icons.js';
import { getAdminAppOrigin, getMainSiteUrl } from './runtime-config.js';

// =============================================================
// СТАН
// =============================================================

let currentUser = null;
let onAuthChangeCallback = null;

// isAdmin кеш на сесію — null = не перевірено, true/false = відомо
let _isAdminCache = null;

// true = юзер прийшов за посиланням з листа "reset password".
// Поки прапорець активний, SIGNED_IN не закриває модалку і не запускає
// post-login логіку — спершу юзер має задати новий пароль.
let _recoveryFlow = false;

// Recovery-маркери в URL (Supabase додає їх у hash після кліку в листі).
// Best-effort: detectSessionInUrl може встигнути почистити hash, тому
// основний сигнал — подія PASSWORD_RECOVERY в onAuthStateChange.
function _detectRecoveryFromUrl() {
  const hash = window.location.hash || '';
  if (hash.includes('type=recovery')) return 'recovery';
  if (hash.includes('error_code=otp_expired') || hash.includes('error=access_denied')) {
    return 'expired';
  }
  return null;
}

// =============================================================
// ІНІЦІАЛІЗАЦІЯ — викликати на кожній сторінці
// =============================================================

const _SUPABASE_REF = 'xpaibteyntflrixmigfx';

// Синхронно читає кешовану сесію з localStorage щоб уникнути FOUC
function _readCachedUser() {
  try {
    const raw = localStorage.getItem(`sb-${_SUPABASE_REF}-auth-token`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.user ?? null;
  } catch {
    return null;
  }
}

// Очищає всі ключі авторизації Supabase з localStorage негайно
function _clearAuthStorage() {
  try {
    [`sb-${_SUPABASE_REF}-auth-token`, `sb-${_SUPABASE_REF}-auth-token-code-verifier`].forEach(
      (key) => localStorage.removeItem(key),
    );
  } catch {}
}

export async function initAuth(onAuthChange = null) {
  onAuthChangeCallback = onAuthChange;

  // Прийшли за посиланням з листа reset password? Фіксуємо до того,
  // як Supabase обробить hash і викличе SIGNED_IN.
  const recoveryMarker = _detectRecoveryFromUrl();
  if (recoveryMarker === 'recovery') _recoveryFlow = true;

  // Швидке відновлення з кешу — прибирає "моргання" при завантаженні
  if (!currentUser) {
    currentUser = _readCachedUser();
    if (currentUser) updateAuthUI();
  }

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

  // Відновлюємо клікабельний гостьовий CTA одразу, не чекаючи getSession().
  if (!currentUser) {
    updateAuthUI();
  }

  // Посилання з листа застаріло/використане — кажемо про це і одразу
  // відкриваємо форму повторного запиту листа.
  if (recoveryMarker === 'expired') {
    showToast(t('authRecoveryExpired'), 'error');
    openAuthModal('reset');
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  // Слухаємо зміни стану авторизації
  supabase.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;

    updateAuthUI();

    if (onAuthChangeCallback) {
      onAuthChangeCallback(event, currentUser);
    }

    // Юзер прийшов за посиланням з листа reset password —
    // показуємо форму нового пароля замість звичайного post-login флоу.
    if (event === 'PASSWORD_RECOVERY') {
      _recoveryFlow = true;
      openAuthModal('new-password');
      return;
    }

    // Закриваємо модалку після успішного логіну
    if (event === 'SIGNED_IN') {
      // Під час recovery сесія вже є, але пароль ще старий — не закриваємо
      // модалку і не запускаємо onboarding/welcome, поки не збережено новий.
      if (_recoveryFlow) {
        openAuthModal('new-password');
        return;
      }
      closeAuthModal();

      const userId = session?.user?.id;
      const signedInUser = session?.user;

      // ВАЖЛИВО: колбек onAuthStateChange має лишатися синхронним. Навіть якщо
      // всередині немає прямого await, async-колбек все одно повертає Promise і
      // може тримати внутрішній auth-лок Supabase. Це знову ламає getSession()
      // та пов'язані запити на сторінці рецепта. Тому post-login роботу
      // остаточно відв'язуємо через setTimeout.
      window.setTimeout(() => {
        void (async () => {
          // Перевіряємо чи обраний нікнейм — якщо ні, показуємо onboarding
          if (signedInUser) {
            const { checkOnboarding } = await import('./onboarding.js');
            await checkOnboarding(signedInUser);
          }

          // Тост "Ласкаво просимо!" — раз на день при першому вході.
          // Дата останнього показу зберігається в БД (profiles.welcome_seen_on),
          // тому не залежить від пристрою чи чистки кешу.
          if (userId) await _maybeShowDailyWelcome(userId);

          // Виконуємо відкладену дію (працює для email/password І Google OAuth).
          // Для email/password submit-обробник більше дію не запускає — лише тут.
          runPendingAction();

          // Якщо є збережена чернетка рецепта, а логін стався на іншій сторінці
          // (логін часто редіректить на головну) — повертаємо на recipes.html,
          // де restorePendingRecipeDraft() відновить форму.
          try {
            if (sessionStorage.getItem('mintofood:pending-recipe') &&
                !location.pathname.endsWith('/recipes.html') &&
                !location.pathname.endsWith('recipes.html')) {
              location.href = 'recipes.html';
            }
          } catch (_) {}
        })().catch((err) => console.error('[auth] SIGNED_IN handler failed:', err));
      }, 0);
    }

    if (event === 'SIGNED_OUT') {
      _isAdminCache = null;
      showToast(t('authSignedOut'));
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

// Показує тост "Ласкаво просимо!" не частіше разу на день.
// Джерело правди — profiles.welcome_seen_on (тип date), тому вітання
// з'являється раз на день незалежно від пристрою чи стану localStorage.
async function _maybeShowDailyWelcome(userId) {
  // Локальна дата у форматі YYYY-MM-DD ("сьогодні" в поясі користувача)
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  try {
    const { data } = await supabase
      .from('profiles')
      .select('welcome_seen_on')
      .eq('id', userId)
      .maybeSingle();

    if (data?.welcome_seen_on === today) return; // вже вітали сьогодні

    showToast(t('authWelcome'));

    await supabase
      .from('profiles')
      .update({ welcome_seen_on: today })
      .eq('id', userId);
  } catch (e) {
    console.warn('Welcome toast: помилка перевірки/запису welcome_seen_on', e);
  }
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
// ПЕРЕВІРКА РОЛІ АДМІНА
// =============================================================

export async function isAdmin() {
  if (!currentUser) return false;
  if (_isAdminCache !== null) return _isAdminCache;

  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', currentUser.id)
    .maybeSingle();

  _isAdminCache = !error && data?.is_admin === true;
  return _isAdminCache;
}

// =============================================================
// ВИМАГАТИ ЛОГІН ДЛЯ ДІЇ
// Якщо не залогінений — відкриває модалку і повертає false
// =============================================================

export function requireAuth(action = null) {
  if (isLoggedIn()) {
    return true;
  }

  // Зберігаємо дію щоб виконати після логіну (в межах однієї сторінки).
  // Дії, що мають пережити навігацію після логіну (напр. збереження рецепта),
  // зберігаються окремо у sessionStorage — див. recipe-modal.js.
  if (action) {
    pendingAction = action;
  }

  openAuthModal();
  return false;
}

let pendingAction = null;

// Виконує відкладену дію один раз і одразу очищає її, щоб уникнути
// повторного запуску. Викликається з гілки SIGNED_IN (спільна для
// email/password і Google OAuth).
function runPendingAction() {
  if (!pendingAction) return;
  const action = pendingAction;
  pendingAction = null;
  Promise.resolve(action()).catch((e) => console.error('pendingAction threw:', e));
}

// =============================================================
// ЛОГІН ЧЕРЕЗ GOOGLE
// =============================================================

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getMainSiteUrl(),
    },
  });

  if (error) {
    console.error('Помилка Google логіну:', error);
    showToast(t('authGoogleError'), 'error');
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

  return { error: null, message: t('authCheckEmail') };
}

// =============================================================
// ВІДНОВЛЕННЯ ПАРОЛЯ
// =============================================================

// Крок 1: юзер вводить email → Supabase шле лист з посиланням.
// redirectTo веде на головну — там initAuth() ловить PASSWORD_RECOVERY
// і відкриває форму нового пароля.
export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getMainSiteUrl(),
  });

  if (error) {
    console.error('Помилка запиту reset password:', error);
    return { error: getErrorMessage(error.message) };
  }

  return { error: null };
}

// Крок 2: юзер прийшов з листа (recovery-сесія активна) → зберігаємо новий пароль.
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    console.error('Помилка зміни пароля:', error);
    return { error: getErrorMessage(error.message) };
  }

  return { error: null };
}

// =============================================================
// ВИХІД
// =============================================================

export async function signOut() {
  // Видаляємо storage одразу — до мережевого запиту Supabase
  _clearAuthStorage();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Помилка виходу:', error);
  }
}

// =============================================================
// ОНОВЛЕННЯ UI — аватар і кнопка в хедері
// =============================================================

function updateAuthUI() {
  const authBtnEl = document.getElementById('headerAuthBtn');
  if (!authBtnEl) return;

  if (currentUser) {
    const fullName =
      currentUser.user_metadata?.full_name ||
      currentUser.user_metadata?.name ||
      currentUser.email?.split('@')[0] ||
      t('authProfileFallback');
    const firstName = fullName.split(' ')[0];
    const initials = fullName
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    const avatarUrl = currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture;

    // Ensure wrapper exists
    let wrap = document.getElementById('headerUserArea');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'headerUserArea';
      wrap.className = 'header__user-area';
      authBtnEl.parentNode.insertBefore(wrap, authBtnEl);
      wrap.appendChild(authBtnEl);
    }

    authBtnEl.className = 'header__avatar-btn';
    authBtnEl.removeAttribute('data-i18n');
    authBtnEl.href = '#';
    authBtnEl.innerHTML = `
      <div class="header__avatar"${!avatarUrl ? ` data-initials="${initials}"` : ''}>
        ${avatarUrl ? `<img src="${avatarUrl}" alt="${firstName}" class="header__avatar-img">` : ''}
      </div>
      <span class="header__avatar-name">${firstName}</span>
      ${iconChevronDown.replace('<svg ', '<svg class="header__avatar-chevron" width="12" height="12" aria-hidden="true" ')}
    `;
    authBtnEl.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleUserDropdown();
    };

    ensureUserDropdown(wrap);
  } else {
    // Remove wrapper if exists, restore authBtnEl to parent
    const wrap = document.getElementById('headerUserArea');
    if (wrap) {
      wrap.parentNode.insertBefore(authBtnEl, wrap);
      wrap.remove();
    }

    document.getElementById('headerUserDropdown')?.remove();

    authBtnEl.className = 'header__profile-name';
    authBtnEl.innerHTML = t('authSignIn');
    authBtnEl.removeAttribute('data-i18n');
    authBtnEl.href = '#';
    authBtnEl.onclick = (e) => {
      e.preventDefault();
      openAuthModal();
    };
  }
}

// =============================================================
// DROPDOWN АВАТАРА
// =============================================================

function ensureUserDropdown(wrap) {
  if (document.getElementById('headerUserDropdown')) return;

  const dropdown = document.createElement('div');
  dropdown.id = 'headerUserDropdown';
  dropdown.className = 'header__user-dropdown';
  dropdown.setAttribute('hidden', '');
  dropdown.innerHTML = `
    <a href="profile.html" class="header__user-dropdown-item">
      ${iconUser.replace('<svg ', '<svg width="16" height="16" aria-hidden="true" ')}
      ${t('authMyProfile')}
    </a>
    <a href="#" class="header__user-dropdown-item header__user-dropdown-item--admin" id="headerAdminLink" hidden>
      ${iconShield.replace('<svg ', '<svg width="16" height="16" aria-hidden="true" ')}
      ${t('authAdminPanel')}
    </a>
    <div class="header__user-dropdown-divider"></div>
    <button type="button" class="header__user-dropdown-item header__user-dropdown-item--danger" id="headerSignOutDropdownBtn">
      ${iconLogOut.replace('<svg ', '<svg width="16" height="16" aria-hidden="true" ')}
      ${t('authSignOut')}
    </button>
  `;

  wrap.appendChild(dropdown);

  isAdmin().then((admin) => {
    const adminLink = document.getElementById('headerAdminLink');
    if (adminLink) adminLink.hidden = !admin;
    const mobileAdminLink = document.getElementById('mobileAdminLink');
    if (mobileAdminLink) mobileAdminLink.hidden = !admin;
  });

  document.getElementById('headerAdminLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    openAdminPanel();
  });

  document.getElementById('headerSignOutDropdownBtn')?.addEventListener('click', async () => {
    closeUserDropdown();
    // Оновлюємо UI одразу — signOut() сам очистить storage
    currentUser = null;
    _isAdminCache = null;
    updateAuthUI();
    await signOut();
  });

  document.addEventListener('click', (e) => {
    const avatarBtn = document.getElementById('headerAuthBtn');
    if (!avatarBtn?.contains(e.target) && !dropdown.contains(e.target)) {
      closeUserDropdown();
    }
  });
}

function toggleUserDropdown() {
  const dropdown = document.getElementById('headerUserDropdown');
  if (!dropdown) return;
  dropdown.hidden ? openUserDropdown() : closeUserDropdown();
}

function openUserDropdown() {
  const dropdown = document.getElementById('headerUserDropdown');
  if (dropdown) {
    dropdown.hidden = false;
    document.getElementById('headerAuthBtn')?.classList.add('is-open');
  }
}

function closeUserDropdown() {
  const dropdown = document.getElementById('headerUserDropdown');
  if (dropdown) {
    dropdown.hidden = true;
    document.getElementById('headerAuthBtn')?.classList.remove('is-open');
  }
}

// =============================================================
// МОДАЛЬНЕ ВІКНО АВТОРИЗАЦІЇ
// =============================================================

function createAuthModalHTML() {
  const div = document.createElement('div');
  div.innerHTML = `
    <div id="auth-modal" class="auth-modal">
      <div class="auth-modal__overlay"></div>
      <div class="auth-modal__window">
        <button class="auth-modal__close" id="authModalClose">&times;</button>

        <!-- ВКЛАДКИ -->
        <div class="auth-modal__tabs">
          <button class="auth-modal__tab auth-modal__tab--active" data-auth-tab="login">
            ${t('authTabLogin')}
          </button>
          <button class="auth-modal__tab" data-auth-tab="register">
            ${t('authTabRegister')}
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
            ${t('authLoginWithGoogle')}
          </button>

          <div class="auth-modal__divider">
            <span>${t('authOr')}</span>
          </div>
<form class="auth-modal__form" id="loginForm" onsubmit="event.preventDefault(); return false;">
            <div class="form-group">
              <label>${t('authEmailLabel')}</label>
              <input type="email" id="loginEmail" placeholder="your@email.com" required />
            </div>
            <div class="form-group">
              <label>${t('authPasswordLabel')}</label>
              <div class="form-group__password-wrap">
                <input type="password" id="loginPassword" placeholder="••••••••" required />
                <button type="button" class="form-group__eye" data-target="loginPassword" aria-label="${t('authShowPassword')}">
                  ${iconEye.replace('<svg ', '<svg width="18" height="18" ')}
                </button>
              </div>
            </div>
            <p class="auth-modal__error" id="loginError" hidden></p>
            <button type="submit" class="auth-modal__submit">${t('authLoginSubmit')}</button>
          </form>

          <p class="auth-modal__switch">
            <button class="auth-modal__switch-btn" data-auth-tab="reset">${t('authForgotPassword')}</button>
          </p>

          <p class="auth-modal__switch">
            ${t('authNoAccount')}
            <button class="auth-modal__switch-btn" data-auth-tab="register">${t('authRegisterCta')}</button>
          </p>
        </div>

        <!-- ЗАПИТ ЛИСТА ДЛЯ ВІДНОВЛЕННЯ ПАРОЛЯ -->
        <div class="auth-modal__content" data-auth-content="reset" hidden>
          <h3 class="auth-modal__subtitle">${t('authResetTitle')}</h3>
          <p class="auth-modal__hint">${t('authResetInstructions')}</p>

          <form class="auth-modal__form" id="resetForm" onsubmit="event.preventDefault(); return false;">
            <div class="form-group">
              <label>${t('authEmailLabel')}</label>
              <input type="email" id="resetEmail" placeholder="your@email.com" required autocomplete="email" />
            </div>
            <p class="auth-modal__error" id="resetError" hidden></p>
            <p class="auth-modal__success" id="resetSuccess" hidden></p>
            <button type="submit" class="auth-modal__submit" id="resetSubmitBtn">${t('authResetSend')}</button>
          </form>

          <p class="auth-modal__switch">
            <button class="auth-modal__switch-btn" data-auth-tab="login">${t('authBackToLogin')}</button>
          </p>
        </div>

        <!-- НОВИЙ ПАРОЛЬ (юзер прийшов за посиланням з листа) -->
        <div class="auth-modal__content" data-auth-content="new-password" hidden>
          <h3 class="auth-modal__subtitle">${t('authNewPasswordTitle')}</h3>

          <form class="auth-modal__form" id="newPasswordForm" onsubmit="event.preventDefault(); return false;">
            <div class="form-group">
              <label>${t('authNewPasswordLabel')}</label>
              <div class="form-group__password-wrap">
                <input type="password" id="newPassword" placeholder="${t('authPasswordMinPlaceholder')}" required minlength="6" autocomplete="new-password" />
                <button type="button" class="form-group__eye" data-target="newPassword" aria-label="${t('authShowPassword')}">
                  ${iconEye.replace('<svg ', '<svg width="18" height="18" ')}
                </button>
              </div>
            </div>
            <div class="form-group">
              <label>${t('authNewPasswordRepeatLabel')}</label>
              <div class="form-group__password-wrap">
                <input type="password" id="newPasswordRepeat" placeholder="••••••••" required minlength="6" autocomplete="new-password" />
                <button type="button" class="form-group__eye" data-target="newPasswordRepeat" aria-label="${t('authShowPassword')}">
                  ${iconEye.replace('<svg ', '<svg width="18" height="18" ')}
                </button>
              </div>
            </div>
            <p class="auth-modal__error" id="newPasswordError" hidden></p>
            <button type="submit" class="auth-modal__submit" id="newPasswordSubmitBtn">${t('authNewPasswordSave')}</button>
          </form>
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
            ${t('authRegisterWithGoogle')}
          </button>
          <p class="auth-modal__oauth-consent">${t('authOauthConsentBefore')} <a href="terms.html" target="_blank" rel="noopener">${t('authTermsLink')}</a> ${t('authConsentAnd')} <a href="privacy.html" target="_blank" rel="noopener">${t('authPrivacyLink')}</a>.</p>

          <div class="auth-modal__divider">
            <span>${t('authOr')}</span>
          </div>

          <form class="auth-modal__form" id="registerForm" onsubmit="event.preventDefault(); return false;">
            <div class="form-group">
              <label>${t('authNameLabel')}</label>
              <input type="text" id="registerName" placeholder="${t('authNamePlaceholder')}" />
            </div>
            <div class="form-group">
              <label>${t('authEmailLabel')}</label>
              <input type="email" id="registerEmail" placeholder="your@email.com" required />
            </div>
            <div class="form-group">
              <label>${t('authPasswordLabel')}</label>
              <div class="form-group__password-wrap">
                <input type="password" id="registerPassword" placeholder="${t('authPasswordMinPlaceholder')}" required />
                <button type="button" class="form-group__eye" data-target="registerPassword" aria-label="${t('authShowPassword')}">
                  ${iconEye.replace('<svg ', '<svg width="18" height="18" ')}
                </button>
              </div>
            </div>
            <div class="form-group form-group--consent">
              <label class="form-group__consent-label">
                <input type="checkbox" id="registerAgeConsent" />
                <span>${t('authAgeConsentBefore')} <a href="terms.html" target="_blank" rel="noopener">${t('authTermsLink')}</a> ${t('authConsentAnd')} <a href="privacy.html" target="_blank" rel="noopener">${t('authPrivacyLink')}</a>.</span>
              </label>
            </div>
            <p class="auth-modal__error" id="registerError" hidden></p>
            <p class="auth-modal__success" id="registerSuccess" hidden></p>
            <button type="submit" class="auth-modal__submit" id="registerSubmitBtn" disabled>${t('authCreateAccount')}</button>
          </form>

          <p class="auth-modal__switch">
            ${t('authHaveAccount')}
            <button class="auth-modal__switch-btn" data-auth-tab="login">${t('authTabLogin')}</button>
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

  // Показати/сховати пароль
  modal.querySelectorAll('.form-group__eye').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      btn.classList.toggle('form-group__eye--active', isHidden);
    });
  });

  // Форма логіну
  document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');

    const { error } = await signInWithEmail(email, password);

    if (error) {
      errorEl.textContent = error;
      errorEl.hidden = false;
    } else {
      errorEl.hidden = true;
      // pendingAction виконається у гілці SIGNED_IN (onAuthStateChange),
      // спільній для email/password і Google OAuth — тут не дублюємо.
    }
  });

  // Форма запиту листа для відновлення пароля
  document.getElementById('resetForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const email = document.getElementById('resetEmail').value;
    const errorEl = document.getElementById('resetError');
    const successEl = document.getElementById('resetSuccess');
    const submitBtn = document.getElementById('resetSubmitBtn');

    submitBtn.disabled = true;
    const { error } = await requestPasswordReset(email);
    submitBtn.disabled = false;

    if (error) {
      errorEl.textContent = error;
      errorEl.hidden = false;
      successEl.hidden = true;
    } else {
      errorEl.hidden = true;
      successEl.textContent = t('authResetSent');
      successEl.hidden = false;
    }
  });

  // Форма нового пароля (recovery-флоу)
  document.getElementById('newPasswordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const password = document.getElementById('newPassword').value;
    const passwordRepeat = document.getElementById('newPasswordRepeat').value;
    const errorEl = document.getElementById('newPasswordError');
    const submitBtn = document.getElementById('newPasswordSubmitBtn');

    if (password.length < 6) {
      errorEl.textContent = t('authErrPasswordShort');
      errorEl.hidden = false;
      return;
    }
    if (password !== passwordRepeat) {
      errorEl.textContent = t('authNewPasswordMismatch');
      errorEl.hidden = false;
      return;
    }

    submitBtn.disabled = true;
    const { error } = await updatePassword(password);
    submitBtn.disabled = false;

    if (error) {
      errorEl.textContent = error;
      errorEl.hidden = false;
      return;
    }

    errorEl.hidden = true;
    _recoveryFlow = false;
    closeAuthModal();
    showToast(t('authPasswordUpdated'));
  });

  // Age consent — увімкнути/вимкнути кнопку реєстрації
  document.getElementById('registerAgeConsent')?.addEventListener('change', (e) => {
    const btn = document.getElementById('registerSubmitBtn');
    if (btn) btn.disabled = !e.target.checked;
  });

  // Форма реєстрації
  document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const errorEl = document.getElementById('registerError');
    const successEl = document.getElementById('registerSuccess');

    // Age gate (GDPR ЄС — мінімальний вік 16 років)
    if (!document.getElementById('registerAgeConsent')?.checked) {
      errorEl.textContent = t('authAgeRequired');
      errorEl.hidden = false;
      successEl.hidden = true;
      return;
    }

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

  // Вкладки "Вхід/Реєстрація" ховаємо на службових екранах
  // (відновлення пароля, новий пароль)
  const tabsRow = modal.querySelector('.auth-modal__tabs');
  if (tabsRow) tabsRow.hidden = tabName !== 'login' && tabName !== 'register';

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
    modal.classList.add('is-open');
    switchAuthTab(tab);
    lockScroll('auth-modal');
  }
}

export function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.classList.remove('is-open');
    unlockScroll('auth-modal');
  }
  // Якщо юзер закрив модалку, не зберігши новий пароль — recovery-сесія
  // лишається чинною (він залогінений), але флоу вважаємо завершеним,
  // щоб наступні SIGNED_IN поводились як звичайний вхід.
  _recoveryFlow = false;
}

// =============================================================
// ХЕЛПЕРИ
// =============================================================

function getErrorMessage(message) {
  const errors = {
    'Invalid login credentials': t('authErrInvalid'),
    'Email not confirmed': t('authErrNotConfirmed'),
    'User already registered': t('authErrAlreadyRegistered'),
    'Password should be at least 6 characters': t('authErrPasswordShort'),
  };
  return errors[message] || t('authErrGeneric');
}

// =============================================================
// ВІДКРИТИ АДМІН-ПАНЕЛЬ — передає сесію безпечним POST у цій самій вкладці
// =============================================================

export async function openAdminPanel() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    showToast(t('authLoginFirst'), 'error');
    return;
  }

  const transferUrl = new URL('/auth/transfer/session', getAdminAppOrigin());
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = transferUrl.toString();
  form.hidden = true;

  const fields = {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
  };

  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}
