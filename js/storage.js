import { supabase } from './supabaseClient.js';

const THEME_HINT_KEY = 'minto-theme-hint';

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

function readThemeHint() {
  try {
    return normalizeTheme(localStorage.getItem(THEME_HINT_KEY));
  } catch {
    return DEFAULT_PREFERENCES.theme;
  }
}

function writeThemeHint(theme) {
  try {
    localStorage.setItem(THEME_HINT_KEY, normalizeTheme(theme));
  } catch {}
}

let preferencesCache = { ...DEFAULT_PREFERENCES, theme: readThemeHint() };
let healthProfileCache = { ...DEFAULT_HEALTH_PROFILE };
let loadedUserId = null;
let hasLoaded = false;
let loadingPromise = null;

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

function applyHealthProfile(data = {}) {
  healthProfileCache = {
    ...healthProfileCache,
    ...data,
  };
}

function resetCaches() {
  preferencesCache = { ...DEFAULT_PREFERENCES, theme: readThemeHint() };
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

async function saveProfileFields(fields, user = null) {
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

async function upsertProfileFields(fields) {
  const user = await resolveUser();
  if (!user) return false;
  return saveProfileFields(fields, user);
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

export async function loadUserStorage(user = null, { force = false } = {}) {
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
    resetCaches();
    return {
      preferences: { ...preferencesCache },
      healthProfile: { ...healthProfileCache },
    };
  }

  loadedUserId = userId;
  loadingPromise = (async () => {
    try {
      const [profileRes, healthRes] = await Promise.all([
        supabase
          .from('profiles')
          .select(
            'language, theme, unit_system, copied_day, copied_week, welcome_intro_seen, welcome_seen_on',
          )
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('user_profiles')
          .select('age, height, weight, gender, activity, goal, calories, protein, fat, carbs, water, target_weight')
          .eq('user_id', userId)
          .maybeSingle(),
      ]);

      resetCaches();

      if (!profileRes.error && profileRes.data) {
        applyPreferences(profileRes.data);
      } else if (profileRes.error) {
        console.warn('[storage] profiles load failed:', profileRes.error.message);
      }

      if (!healthRes.error && healthRes.data) {
        applyHealthProfile(healthRes.data);
      } else if (healthRes.error) {
        console.warn('[storage] user_profiles load failed:', healthRes.error.message);
      }
    } catch (error) {
      console.warn('[storage] load bootstrap failed:', error?.message ?? error);
      resetCaches();
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
  resetCaches();
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
  applyPreferences({ language: value });
  await upsertProfileFields({ language: value });
  document.dispatchEvent(new CustomEvent('storage:lang-changed', { detail: { lang: value } }));
  return value;
}

export function getTheme() {
  return normalizeTheme(preferencesCache.theme);
}

export async function setTheme(theme) {
  const value = normalizeTheme(theme);
  applyPreferences({ theme: value });
  await upsertProfileFields({ theme: value });
  return value;
}

export function getUnitSystem() {
  return normalizeUnitSystem(preferencesCache.unit_system);
}

export async function setUnitSystem(unitSystem) {
  const value = normalizeUnitSystem(unitSystem);
  applyPreferences({ unit_system: value });
  await upsertProfileFields({ unit_system: value });
  return value;
}

export function getCopiedDay() {
  return clone(preferencesCache.copied_day);
}

export async function saveCopiedDay(snapshot) {
  const value = clone(snapshot);
  applyPreferences({ copied_day: value });
  await upsertProfileFields({ copied_day: value });
  return value;
}

export function getCopiedWeek() {
  return clone(preferencesCache.copied_week);
}

export async function saveCopiedWeek(snapshot) {
  const value = clone(snapshot);
  applyPreferences({ copied_week: value });
  await upsertProfileFields({ copied_week: value });
  return value;
}

export async function clearCopiedState() {
  applyPreferences({ copied_day: null, copied_week: null });
  await upsertProfileFields({ copied_day: null, copied_week: null });
}

export function hasCompletedWelcomeIntro() {
  return preferencesCache.welcome_intro_seen === true;
}

export async function markWelcomeIntroSeen() {
  if (preferencesCache.welcome_intro_seen) {
    return true;
  }

  applyPreferences({ welcome_intro_seen: true });
  return upsertProfileFields({ welcome_intro_seen: true });
}

export function hasSeenWelcomeToday() {
  return preferencesCache.welcome_seen_on === todayIsoDate();
}

export async function markWelcomeSeenToday() {
  const value = todayIsoDate();

  if (preferencesCache.welcome_seen_on === value) {
    return null;
  }

  applyPreferences({ welcome_seen_on: value });
  await upsertProfileFields({ welcome_seen_on: value });
  return value;
}

export { saveProfileFields };
