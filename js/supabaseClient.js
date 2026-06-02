import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = 'https://xpaibteyntflrixmigfx.supabase.co';
const supabaseAnonKey = 'sb_publishable_5aziCmaq0rxAJ24MznPycw_eY5iVZxZ';
const AUTH_STORAGE_KEY = 'sb-xpaibteyntflrixmigfx-auth-token';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

function findSessionCandidate(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object') return null;
  if (seen.has(value)) return null;
  seen.add(value);

  if (value.access_token && value.refresh_token) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = findSessionCandidate(item, seen);
      if (candidate) return candidate;
    }
    return null;
  }

  for (const nested of Object.values(value)) {
    const candidate = findSessionCandidate(nested, seen);
    if (candidate) return candidate;
  }

  return null;
}

function readCachedSession() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return findSessionCandidate(JSON.parse(raw));
  } catch {
    return null;
  }
}

const originalGetSession = supabase.auth.getSession.bind(supabase.auth);
const originalGetUser = supabase.auth.getUser.bind(supabase.auth);
let restoreSessionPromise = null;

async function restoreSessionFromCache() {
  const cachedSession = readCachedSession();
  if (!cachedSession?.access_token || !cachedSession?.refresh_token) {
    return null;
  }

  try {
    const { data, error } = await supabase.auth.setSession({
      access_token: cachedSession.access_token,
      refresh_token: cachedSession.refresh_token,
    });

    if (error) {
      console.warn('[supabase] failed to restore cached session:', error.message);
      return null;
    }

    return data?.session ?? null;
  } catch (error) {
    console.warn('[supabase] failed to restore cached session:', error?.message ?? error);
    return null;
  }
}

export async function ensureSupabaseSession() {
  if (restoreSessionPromise) {
    return restoreSessionPromise;
  }

  restoreSessionPromise = (async () => {
    const current = await originalGetSession();
    if (current.data?.session) {
      return current.data.session;
    }

    return restoreSessionFromCache();
  })();

  try {
    return await restoreSessionPromise;
  } finally {
    restoreSessionPromise = null;
  }
}

supabase.auth.getSession = async (...args) => {
  const result = await originalGetSession(...args);

  if (args.length === 0 && !result.data?.session) {
    const restoredSession = await ensureSupabaseSession();
    if (restoredSession) {
      return { data: { session: restoredSession }, error: null };
    }
  }

  return result;
};

supabase.auth.getUser = async (...args) => {
  if (args.length === 0) {
    try {
      const session = await ensureSupabaseSession();

      if (session?.user) {
        return { data: { user: session.user }, error: null };
      }
    } catch {}
  }

  return originalGetUser(...args);
};

queueMicrotask(() => {
  ensureSupabaseSession().catch(() => {});
});
