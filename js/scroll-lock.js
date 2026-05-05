const activeScrollLocks = new Set();

function syncScrollState() {
  document.body.style.overflow = activeScrollLocks.size > 0 ? 'hidden' : '';
}

export function lockScroll(key = 'default') {
  activeScrollLocks.add(key);
  syncScrollState();
}

export function unlockScroll(key = 'default') {
  activeScrollLocks.delete(key);
  syncScrollState();
}

export function clearScrollLocks() {
  activeScrollLocks.clear();
  syncScrollState();
}
