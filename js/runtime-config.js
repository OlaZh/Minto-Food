const DEFAULT_MAIN_SITE_URL = 'https://minto-food.vercel.app/';
const DEFAULT_ADMIN_APP_URL = 'https://minto-food-xv5f.vercel.app/';

function readMeta(name) {
  return document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || null;
}

function readGlobal(name) {
  return typeof window !== 'undefined' ? window[name] || null : null;
}

function readStorage(name) {
  try {
    return localStorage.getItem(name);
  } catch {
    return null;
  }
}

function resolveUrl(value, fallback) {
  return new URL(value || fallback, window.location.origin).toString();
}

export function getMainSiteUrl() {
  return resolveUrl(
    readMeta('minto-main-url') ||
      readGlobal('MINTO_MAIN_URL') ||
      readStorage('minto_main_url'),
    DEFAULT_MAIN_SITE_URL,
  );
}

export function getAdminAppUrl() {
  return resolveUrl(
    readMeta('minto-admin-url') ||
      readGlobal('MINTO_ADMIN_URL') ||
      readStorage('minto_admin_url'),
    DEFAULT_ADMIN_APP_URL,
  );
}

export function getAdminAppOrigin() {
  return new URL(getAdminAppUrl()).origin;
}
