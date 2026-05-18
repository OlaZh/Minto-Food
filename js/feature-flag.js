import { supabase } from './supabaseClient.js';

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 хвилин

async function loadFlags() {
  const now = Date.now();
  if (_cache && now - _cacheTime < CACHE_TTL) return _cache;

  const { data } = await supabase
    .from('feature_flags')
    .select('key, rollout_pct, target_users')
    .eq('enabled', true);

  _cache = data || [];
  _cacheTime = now;
  return _cache;
}

/**
 * Перевіряє чи увімкнена фіча для поточного юзера.
 * @param {string} key — ключ флага (наприклад 'ai_scan_enabled')
 * @param {string|null} userId — auth.uid() або null для анон
 */
export async function isEnabled(key, userId = null) {
  try {
    const flags = await loadFlags();
    const flag = flags.find(f => f.key === key);
    if (!flag) return false;

    // Якщо юзер у target_users — завжди увімкнено
    if (userId && flag.target_users?.includes(userId)) return true;

    // Інакше — стохастичний rollout за userId
    if (flag.rollout_pct >= 100) return true;
    if (flag.rollout_pct <= 0) return false;

    // Детермінований хеш userId → 0-99, щоб юзер завжди бачив одне й те саме
    const hash = userId ? simpleHash(key + userId) % 100 : Math.random() * 100;
    return hash < flag.rollout_pct;
  } catch {
    return false;
  }
}

/** Скидає кеш (наприклад після toggle у адмінці) */
export function invalidateFlagCache() {
  _cache = null;
  _cacheTime = 0;
}

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) >>> 0;
  }
  return h;
}
