import { supabase } from './supabaseClient.js';

const LANG_KEY = 'minto-language';
const THEME_KEY = 'minto-theme';
const THEME_HINT_KEY = 'minto-theme-hint';
const UNIT_SYSTEM_KEY = 'minto-unit-system';
const COPIED_DAY_KEY = 'minto-copied-day';
const COPIED_WEEK_KEY = 'minto-copied-week';
const WELCOME_INTRO_SEEN_KEY = 'minto-welcome-intro-seen';
const WELCOME_SEEN_ON_KEY = 'minto-welcome-seen-on';

const DEFAULT_PREFERENCES = Object.freeze({
  language: 'ua',
  theme: 'light',
  unit_system: 'metric',
  copied_day: null,
  copied_week: null,
  welcome_intro_seen: false,
  welcome_seen_on: null,
});

const DEFAULT_HEALTH_PROFILE = Object.freeze({
  age: null,
  height: null,
  weight: null,
  gender: 'female',
  activity: 1.375,
  goal: 'maintain',
  calories: 2000,
  protein: 100,
  fat: 70,
  carbs: 250,
  water: 2.5,
  target_weight: null,
});

function clone(value) {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeLang(lang) {
  if (lang === 'uk') return 'ua';
  return ['ua', 'en', 'pl'].includes(lang) ? lang : DEFAULT_PREFERENCES.language;
}

function normalizeTheme(theme) {
  return theme === 'dark' ? 'dark' : 'light';
}

function normalizeUnitSystem(unitSystem) {
  return unitSystem === 'imperial' ? 'imperial' : 'metric';
}

function readLocal(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key, value) {
  try {
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
      return;
    }

    localStorage.setItem(key, value);
  } catch {}
}

function readJson(key) {
  const raw = readLocal(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readThemeHint() {
  return normalizeTheme(readLocal(THEME_HINT_KEY));
}

function writeThemeHint(theme) {
  writeLocal(THEME_HINT_KEY, normalizeTheme(theme));
}

function readLocalPreferences() {
  return {
    language: normalizeLang(readLocal(LANG_KEY)),
    theme: normalizeTheme(readLocal(THEME_KEY) || readLocal(THEME_HINT_KEY)),
    unit_system: normalizeUnitSystem(readLocal(UNIT_SYSTEM_KEY)),
    copied_day: clone(readJson(COPIED_DAY_KEY)),
    copied_week: clone(readJson(COPIED_WEEK_KEY)),
    welcome_intro_seen: readLocal(WELCOME_INTRO_SEEN_KEY) === 'true',
    welcome_seen_on: readLocal(WELCOME_SEEN_ON_KEY) || null,
  };
}

let preferencesCache = {
  ...DEFAULT_PREFERENCES,
  ...readLocalPreferences(),
  theme: normalizeTheme(readLocal(THEME_KEY) || readLocal(THEME_HINT_KEY)),
};
let healthProfileCache = { ...DEFAULT_HEALTH_PROFILE };
let loadedUserId = null;
let hasLoaded = false;
let loadingPromise = null;

function applyPreferences(data = {}) {
  preferencesCache = {
    ...preferencesCache,
    language: normalizeLang(data.language ?? preferencesCache.language),
    theme: normalizeTheme(data.theme ?? preferencesCache.theme),
    unit_system: normalizeUnitSystem(data.unit_system ?? preferencesCache.unit_system),
    copied_day: clone(data.copied_day ?? preferencesCache.copied_day),
    copied_week: clone(data.copied_week ?? preferencesCache.copied_week),
    welcome_intro_seen: Boolean(data.welcome_intro_seen ?? preferencesCache.welcome_intro_seen),
    welcome_seen_on: data.welcome_seen_on ?? preferencesCache.welcome_seen_on,
  };
  writeThemeHint(preferencesCache.theme);
}

function syncPreferencesFromLocal() {
  preferencesCache = {
    ...DEFAULT_PREFERENCES,
    ...readLocalPreferences(),
    theme: normalizeTheme(readLocal(THEME_KEY) || readLocal(THEME_HINT_KEY)),
  };
  writeThemeHint(preferencesCache.theme);
}

function persistPreferences(patch = {}) {
  applyPreferences(patch);

  if ('language' in patch) {
    writeLocal(LANG_KEY, preferencesCache.language);
  }

  if ('theme' in patch) {
    writeLocal(THEME_KEY, preferencesCache.theme);
    writeThemeHint(preferencesCache.theme);
  }

  if ('unit_system' in patch) {
    writeLocal(UNIT_SYSTEM_KEY, preferencesCache.unit_system);
  }

  if ('copied_day' in patch) {
    writeLocal(COPIED_DAY_KEY, preferencesCache.copied_day === null ? null : JSON.stringify(preferencesCache.copied_day));
  }

  if ('copied_week' in patch) {
    writeLocal(COPIED_WEEK_KEY, preferencesCache.copied_week === null ? null : JSON.stringify(preferencesCache.copied_week));
  }

  if ('welcome_intro_seen' in patch) {
    writeLocal(WELCOME_INTRO_SEEN_KEY, preferencesCache.welcome_intro_seen ? 'true' : 'false');
  }

  if ('welcome_seen_on' in patch) {
    writeLocal(WELCOME_SEEN_ON_KEY, preferencesCache.welcome_seen_on);
  }
}

function applyHealthProfile(data = {}) {
  healthProfileCache = {
    ...healthProfileCache,
    ...data,
  };
}

function resetHealthProfileCache() {
  healthProfileCache = { ...DEFAULT_HEALTH_PROFILE };
}

async function resolveUser(user = null) {
  if (user) return user;

  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.warn('[storage] auth session lookup failed:', error.message);
    }

    if (session?.user) {
      return session.user;
    }
  } catch (error) {
    console.warn('[storage] auth session lookup threw:', error?.message ?? error);
  }

  try {
    const {
      data: { user: currentUser },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.warn('[storage] auth user lookup failed:', error.message);
    }

    return currentUser ?? null;
  } catch (error) {
    console.warn('[storage] auth user lookup threw:', error?.message ?? error);
    return null;
  }
}

async function upsertHealthProfileFields(fields) {
  const user = await resolveUser();
  if (!user) return false;

  const payload = { user_id: user.id, ...fields };
  const { error } = await supabase.from('user_profiles').upsert(payload, { onConflict: 'user_id' });

  if (error) {
    console.warn('[storage] user_profiles upsert failed:', error.message);
    return false;
  }

  return true;
}

export async function saveProfileFields(fields, user = null) {
  const resolvedUser = await resolveUser(user);
  if (!resolvedUser) return false;

  const { data: existingProfile, error: profileLookupError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', resolvedUser.id)
    .maybeSingle();

  if (profileLookupError) {
    console.warn('[storage] profiles lookup failed:', profileLookupError.message);
    return false;
  }

  const payload = { id: resolvedUser.id, ...fields };
  const query = existingProfile
    ? supabase.from('profiles').update(fields).eq('id', resolvedUser.id)
    : supabase.from('profiles').insert(payload);

  const { error } = await query;

  if (error) {
    console.warn('[storage] profiles save failed:', error.message);
    return false;
  }

  return true;
}

export async function loadUserStorage(user = null, { force = false } = {}) {
  syncPreferencesFromLocal();

  let resolvedUser = null;

  try {
    resolvedUser = await resolveUser(user);
  } catch (error) {
    console.warn('[storage] failed to resolve auth user during bootstrap:', error?.message ?? error);
  }

  const userId = resolvedUser?.id ?? null;

  if (!force && hasLoaded && loadedUserId === userId) {
    return {
      preferences: { ...preferencesCache },
      healthProfile: { ...healthProfileCache },
    };
  }

  if (!force && loadingPromise && loadedUserId === userId) {
    return loadingPromise;
  }

  if (!userId) {
    loadedUserId = null;
    hasLoaded = true;
    resetHealthProfileCache();
    return {
      preferences: { ...preferencesCache },
      healthProfile: { ...healthProfileCache },
    };
  }

  loadedUserId = userId;
  loadingPromise = (async () => {
    resetHealthProfileCache();

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('age, height, weight, gender, activity, goal, calories, protein, fat, carbs, water, target_weight')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        applyHealthProfile(data);
      } else if (error) {
        console.warn('[storage] user_profiles load failed:', error.message);
      }
    } catch (error) {
      console.warn('[storage] load bootstrap failed:', error?.message ?? error);
      resetHealthProfileCache();
    }

    hasLoaded = true;
    return {
      preferences: { ...preferencesCache },
      healthProfile: { ...healthProfileCache },
    };
  })();

  try {
    return await loadingPromise;
  } finally {
    loadingPromise = null;
  }
}

export function clearStorageCache() {
  loadedUserId = null;
  hasLoaded = false;
  loadingPromise = null;
  syncPreferencesFromLocal();
  resetHealthProfileCache();
}

export function mergeUserProfileCache(patch = {}) {
  applyHealthProfile(patch);
}

export function getWaterNorm() {
  return Number(healthProfileCache.water) || DEFAULT_HEALTH_PROFILE.water;
}

export function getDailyCaloriesNorm() {
  return Number(healthProfileCache.calories) || DEFAULT_HEALTH_PROFILE.calories;
}

export function getProteinNorm() {
  return Number(healthProfileCache.protein) || DEFAULT_HEALTH_PROFILE.protein;
}

export function getFatNorm() {
  return Number(healthProfileCache.fat) || DEFAULT_HEALTH_PROFILE.fat;
}

export function getCarbsNorm() {
  return Number(healthProfileCache.carbs) || DEFAULT_HEALTH_PROFILE.carbs;
}

export function getAllNorms() {
  return {
    calories: getDailyCaloriesNorm(),
    protein: getProteinNorm(),
    fat: getFatNorm(),
    carbs: getCarbsNorm(),
    water: getWaterNorm(),
  };
}

export async function saveAllNorms(norms) {
  mergeUserProfileCache(norms);
  await upsertHealthProfileFields(norms);
}

export function getUserProfile() {
  return { ...healthProfileCache };
}

export async function saveUserProfile(profile) {
  mergeUserProfileCache(profile);
  await upsertHealthProfileFields(profile);
}

export function getWaterToday() {
  return 0;
}

export async function setWaterToday() {}

export async function resetWaterToday() {}

export function getLang() {
  return normalizeLang(preferencesCache.language);
}

export async function setLang(lang) {
  const value = normalizeLang(lang);
  persistPreferences({ language: value });
  document.dispatchEvent(new CustomEvent('storage:lang-changed', { detail: { lang: value } }));
  return value;
}

export function getTheme() {
  return normalizeTheme(preferencesCache.theme);
}

export async function setTheme(theme) {
  const value = normalizeTheme(theme);
  persistPreferences({ theme: value });
  return value;
}

export function getUnitSystem() {
  return normalizeUnitSystem(preferencesCache.unit_system);
}

export async function setUnitSystem(unitSystem) {
  const value = normalizeUnitSystem(unitSystem);
  persistPreferences({ unit_system: value });
  return value;
}

export function getCopiedDay() {
  return clone(preferencesCache.copied_day);
}

export async function saveCopiedDay(snapshot) {
  const value = clone(snapshot);
  persistPreferences({ copied_day: value });
  return value;
}

export function getCopiedWeek() {
  return clone(preferencesCache.copied_week);
}

export async function saveCopiedWeek(snapshot) {
  const value = clone(snapshot);
  persistPreferences({ copied_week: value });
  return value;
}

export async function clearCopiedState() {
  persistPreferences({ copied_day: null, copied_week: null });
}

export function hasCompletedWelcomeIntro() {
  return preferencesCache.welcome_intro_seen === true;
}

export async function markWelcomeIntroSeen() {
  if (preferencesCache.welcome_intro_seen) {
    return true;
  }

  persistPreferences({ welcome_intro_seen: true });
  return true;
}

export function hasSeenWelcomeToday() {
  return preferencesCache.welcome_seen_on === todayIsoDate();
}

export async function markWelcomeSeenToday() {
  const value = todayIsoDate();

  if (preferencesCache.welcome_seen_on === value) {
    return null;
  }

  persistPreferences({ welcome_seen_on: value });
  return value;
}
