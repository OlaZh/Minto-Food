// analytics-consent-gate.js — чиста consent-arbitration логіка для
// analytics.js, БЕЗ прямих залежностей від document/supabase/CDN URL. Усі
// side-effects (CDN import, SDK init, identify) передаються як callbacks —
// це дозволяє unit-тестувати arbitration-контракт (last-write-wins,
// race-safe identify) напряму, без DOM/мережевих моків.
//
// ─────────────────────────────────────────────────────────────
// LAST-WRITE-WINS ARBITRATION
//
// Проблема, яку це вирішує: consent (або необхідність re-identify) може
// змінитись ПОКИ триває будь-яка асинхронна операція — CDN import,
// supabase.auth.getSession(). Без явного arbitration останній РЕЗУЛЬТАТ
// асинхронного ланцюга перезаписує стан, навіть якщо юзер вже передумав ще
// раз (або відкликав згоду), поки той ланцюг виконувався.
//
// Модель: кожен виклик applyConsent(consent) синхронно (до будь-якого await)
// збільшує revision і записує desiredConsent — це ЄДИНЕ джерело правди про
// "чого хоче юзер ЗАРАЗ", видиме одразу наступному виклику.
//
// loadModule(deps) кешує ЛИШЕ сам CDN import (через deps.loadModule) — БЕЗ
// side-effects (без init, без opt_in, без capture). Це навмисно розділено,
// щоб два виклики applyConsent, які застали import "у польоті" й тому
// ділять один Promise, НЕ ділили б одну arbitration-перевірку — кожен з них
// робить СВОЮ перевірку revision-рівності після СВОГО await.
//
// identifyCurrentUser() має ту саму race: між стартом supabase.auth.
// getSession() і його завершенням могли змінитись consent або auth state.
// Після await перевіряються обидві ревізії, актуальна згода та SDK instance
// ПЕРЕД викликом identify().
// ─────────────────────────────────────────────────────────────

// Створює новий, повністю ізольований consent-gate. Кожен виклик — окремий
// стан (жодних module-level globals) — важливо для паралельних unit-тестів.
//
// deps:
//   loadModule()       → Promise<Module|null>       — CDN import, БЕЗ side-effects
//   getApiKey()        → string|null                — синхронний читач ключа
//   initSdk(mod, key)  → SdkInstance                 — mod.default.init(...) + повернути SDK
//   getSession()       → Promise<{ userId }>         — обгортка над supabase.auth.getSession()
export function createConsentGate(deps) {
  let revision = 0;
  let desiredConsent = null;
  let hasConsentState = false;
  let identityRevision = 0;
  let instance = null; // ініціалізований SDK-інстанс, або null
  let loadInFlight = null;
  let identifiedUserId = null;

  function loadModuleOnce() {
    if (loadInFlight) return loadInFlight;
    loadInFlight = Promise.resolve()
      .then(() => deps.loadModule())
      .catch((e) => {
        deps.onLoadError?.(e);
        return null;
      })
      .finally(() => {
        loadInFlight = null;
      });
    return loadInFlight;
  }

  // Race-safe: revision захоплюється ПЕРЕД await getSession(). Якщо consent
  // змінився (revoke) поки чекали на сесію — identify НЕ застосовується,
  // навіть якщо сесія успішно повернулась.
  //
  // ВАЖЛИВО: перевіряємо САМЕ desiredConsent?.analytics, не лише !instance.
  // opt_out_capturing() (гілка applyConsent(false) нижче) НЕ занулює
  // instance — SDK-об'єкт лишається в пам'яті (той самий інстанс може
  // знадобитись для повторного opt-in). Тому "instance існує" НЕ означає
  // "юзер зараз дозволяє identify" — єдине надійне джерело правди про
  // ПОТОЧНИЙ дозвіл це desiredConsent. Без цієї перевірки: SIGNED_IN подія
  // після revoke все одно проходила б повз `if (!instance) return` (instance
  // усе ще truthy) і викликала getSession()+identify() на SDK, що технічно
  // в opt-out стані — реальний privacy-баг, знайдений рев'ю.
  async function identifyCurrentUser() {
    if (!instance || !desiredConsent?.analytics) return;
    const myConsentRevision = revision;
    const myIdentityRevision = identityRevision;
    const { userId } = await deps.getSession();
    if (revision !== myConsentRevision) return; // consent змінився під час запиту
    if (identityRevision !== myIdentityRevision) return; // auth state змінився під час запиту
    if (!instance || !desiredConsent?.analytics) return; // те саме, після await
    if (userId && userId !== identifiedUserId) {
      instance.identify(userId);
      identifiedUserId = userId;
    }
  }

  function resetIdentity() {
    identifiedUserId = null;
    instance?.reset();
  }

  async function applyConsent(consent) {
    const nextAnalytics = Boolean(consent?.analytics);

    // Повторна доставка того самого analytics-стану (наприклад,
    // consentUpdated + consentReady або синхронізація з БД після SIGNED_IN)
    // не є новою зміною згоди. Не робимо повторний opt-in/$pageview і не
    // інвалідовуємо актуальний identifyCurrentUser(), який міг уже чекати
    // на getSession(). Інші поля consent усе одно зберігаємо як останні.
    const sameAnalyticsState = hasConsentState && Boolean(desiredConsent?.analytics) === nextAnalytics;
    if (sameAnalyticsState) {
      desiredConsent = consent;
      // false→false не потребує дій. true→true теж no-op, якщо SDK уже
      // готовий; але без інстансу мусимо дозволити retry (ключ міг з'явитися
      // пізніше або попередній CDN load міг провалитися).
      if (!nextAnalytics || instance) return;
    } else {
      hasConsentState = true;
      revision += 1;
      desiredConsent = consent;
    }

    const myRevision = revision;

    if (nextAnalytics) {
      if (instance) {
        // SDK вже ініціалізований раніше в цій сесії (reject→accept) —
        // застосовуємо синхронно, без нового import(). Повторна згода сама
        // по собі не є новим переглядом сторінки, тому $pageview тут немає.
        instance.opt_in_capturing();
        await identifyCurrentUser();
        return;
      }

      const apiKey = deps.getApiKey();
      if (!apiKey) return; // жодного CDN-запиту без ключа

      const mod = await loadModuleOnce();

      // Ревізія розійшлася АБО поточний бажаний стан більше не "true" —
      // сталася новіша подія, поки чекали на import(). Не ініціалізуємо SDK
      // із застарілим наміром.
      if (revision !== myRevision || !desiredConsent?.analytics) return;
      if (!mod) return; // import провалився
      if (instance) return; // інший same-state waiter уже ініціалізував SDK

      instance = deps.initSdk(mod, apiKey);
      instance.opt_in_capturing();
      instance.capture('$pageview');
      await identifyCurrentUser();
    } else if (instance) {
      instance.opt_out_capturing();
      resetIdentity();
    }
  }

  // Довільний capture поза arbitration-циклом (напр. product-подія
  // recipe_created з recipe-modal.js) — no-op без актуальної analytics-згоди
  // або якщо SDK ще не активний. Синхронна перевірка, без revision-логіки:
  // тут немає
  // конкуруючої асинхронної операції, яку треба узгоджувати — просто
  // "чи є куди капчурити ЗАРАЗ".
  function capture(event, properties) {
    if (!desiredConsent?.analytics) return;
    instance?.capture(event, properties);
  }

  async function onSignedIn() {
    identityRevision += 1;
    await identifyCurrentUser();
  }

  function onSignedOut() {
    // Окрема auth-ревізія інвалідовує getSession(), який міг стартувати до
    // SIGNED_OUT. Consent revision тут не чіпаємо: згода на анонімну
    // аналітику може лишатись чинною і після виходу з акаунта.
    identityRevision += 1;
    resetIdentity();
  }

  return {
    applyConsent,
    capture,
    onSignedIn,
    onSignedOut,
    // Тестовий гетер — не для викликів з production-коду поза самим
    // модулем-обгорткою.
    _getState: () => ({ revision, identityRevision, desiredConsent, hasInstance: !!instance, identifiedUserId }),
  };
}
