import { supabase } from './supabaseClient.js';
import { getLang } from './storage.js';

const BUCKET = 'recipe-attachments';
const editorResets = new Set();
const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif'];
const videoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'];
const words = {
  ua: { ingredients: 'Фото інгредієнтів', steps: 'Фото й відео приготування', video: 'Відеорецепти', add: 'Додати файли', paste: 'Можна вставити скріншот сюди через Ctrl+V', link: 'Посилання на відео', addLink: 'Додати посилання', remove: 'Прибрати', up: 'Вище', down: 'Нижче', open: 'Відкрити', failed: 'Не вдалося завантажити вкладення. Спробуйте ще раз.', type: 'Оберіть фото або відеофайл підтримуваного формату.', url: 'Вставте повне посилання http:// або https://.', savedPart: 'Рецепт збережено, але вкладення ще ні. Вони залишилися у формі. Спробуйте зберегти ще раз.', conflict: 'Вкладення змінені в іншій вкладці. Відкрийте рецепт заново перед редагуванням.', draftError: 'Не вдалося зберегти файли в чернетці. Форма залишилася відкритою.' },
  en: { ingredients: 'Ingredient photos', steps: 'Preparation photos and videos', video: 'Video recipes', add: 'Add files', paste: 'Paste a screenshot here with Ctrl+V', link: 'Video link', addLink: 'Add link', remove: 'Remove', up: 'Move up', down: 'Move down', open: 'Open', failed: 'Could not load attachments. Please try again.', type: 'Choose a supported image or video file.', url: 'Paste a complete http:// or https:// link.', savedPart: 'The recipe was saved, but its attachments were not. They remain in the form. Please save again.', conflict: 'Attachments changed in another tab. Reopen the recipe before editing.', draftError: 'Could not save the files in the draft. The form remains open.' },
  pl: { ingredients: 'Zdjęcia składników', steps: 'Zdjęcia i filmy przygotowania', video: 'Przepisy wideo', add: 'Dodaj pliki', paste: 'Wklej tutaj zrzut ekranu przez Ctrl+V', link: 'Link do filmu', addLink: 'Dodaj link', remove: 'Usuń', up: 'Wyżej', down: 'Niżej', open: 'Otwórz', failed: 'Nie udało się wczytać załączników. Spróbuj ponownie.', type: 'Wybierz obsługiwane zdjęcie lub plik wideo.', url: 'Wklej pełny link http:// lub https://.', savedPart: 'Przepis zapisano, ale załączniki nie zostały zapisane. Pozostają w formularzu. Spróbuj ponownie.', conflict: 'Załączniki zmieniły się w innej karcie. Otwórz przepis ponownie.', draftError: 'Nie udało się zapisać plików w szkicu. Formularz pozostał otwarty.' },
};
export function mediaText(key) { return (words[getLang()] || words.ua)[key] || key; }
export function normalizeVideoLink(value) {
  const url = new URL(value.trim());
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('invalid_video_url');
  return url.href;
}
export function mediaKind(type) {
  if (imageTypes.includes(type)) return 'image';
  if (videoTypes.includes(type)) return 'video';
  throw new Error('invalid_media_type');
}
function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}
function button(text, action) {
  const el = node('button', 'recipe-media__button', text);
  el.type = 'button';
  el.addEventListener('click', action);
  return el;
}
async function signedURL(path) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error || !data?.signedUrl) throw error || new Error('media_url_missing');
  return data.signedUrl;
}
async function getMedia(recipeId) {
  const { data, error } = await supabase.rpc('get_recipe_media', { p_recipe_id: Number(recipeId) });
  if (error) throw error;
  return { ...data, items: await Promise.all(data.items.map(async item => ({
    ...item, previewURL: item.storage_path ? await signedURL(item.storage_path) : null,
  }))) };
}
function openButton(item, onError) {
  return button(mediaText('open'), async () => {
    const popup = window.open('about:blank', '_blank');
    if (!popup) return;
    popup.opener = null;
    try { popup.location.href = item.file ? item.previewURL : await signedURL(item.storage_path); }
    catch { popup.close(); onError?.(); }
  });
}
function preview(item, url) {
  if (item.kind === 'link') {
    const link = node('a', 'recipe-media__link', item.external_url);
    link.href = normalizeVideoLink(item.external_url);
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    return link;
  }
  const media = node(item.kind === 'image' ? 'img' : 'video', 'recipe-media__preview');
  if (item.kind === 'image') { media.alt = item.filename || mediaText(item.section); media.loading = 'lazy'; }
  else { media.controls = true; media.preload = 'none'; media.playsInline = true; }
  media.src = url;
  return media;
}

export function createRecipeMediaEditor(containers) {
  let items = [], revision = null, dirty = false, generation = 0, loadError = false;
  let busy = false;
  const urls = new Set();
  const lists = new Map();
  const status = new Map();
  const controls = [];
  function setBusy(value) { busy = value; for (const el of controls) el.disabled = value; render(); }
  function release() { for (const url of urls) URL.revokeObjectURL(url); urls.clear(); }
  function render() {
    for (const [section, list] of lists) {
      list.replaceChildren();
      const group = items.filter(item => item.section === section);
      for (const item of group) {
        const row = node('li', 'recipe-media__item');
        if (item.kind === 'link' || item.previewURL) row.appendChild(preview(item, item.previewURL));
        row.appendChild(node('span', 'recipe-media__filename', item.filename));
        const actions = node('div', 'recipe-media__actions');
        for (const [key, delta] of [['up', -1], ['down', 1]]) {
          const adjacent = group[group.indexOf(item) + delta];
          const move = button(mediaText(key), () => {
            if (busy || !adjacent) return;
            const a = items.indexOf(item), b = items.indexOf(adjacent);
            [items[a], items[b]] = [items[b], items[a]]; dirty = true; render();
          });
          move.disabled = busy || !adjacent; actions.appendChild(move);
        }
        const remove = button(mediaText('remove'), () => {
          if (busy) return;
          items = items.filter(other => other !== item); dirty = true; render();
        });
        remove.disabled = busy; actions.appendChild(remove);
        if (item.kind !== 'link') {
          actions.appendChild(openButton(item, () => { status.get(section).textContent = mediaText('failed'); }));
        }
        row.appendChild(actions); list.appendChild(row);
      }
    }
  }
  function addFiles(files, section) {
    if (busy) return;
    status.get(section).textContent = '';
    for (const file of files) {
      try {
        const kind = mediaKind(file.type);
        if ((section === 'ingredients' && kind !== 'image') || (section === 'video' && kind !== 'video')) throw new Error('invalid_media_type');
        const previewURL = URL.createObjectURL(file); urls.add(previewURL);
        items.push({ section, kind, filename: file.name, file, previewURL }); dirty = true;
      } catch { status.get(section).textContent = mediaText('type'); }
    }
    render();
  }
  for (const [section, container] of Object.entries(containers)) {
    if (!container) continue;
    container.replaceChildren(); container.classList.add('recipe-media'); container.dataset.recipeMedia = 'editor';
    container.appendChild(node('h3', 'recipe-media__title', mediaText(section)));
    const message = node('p', 'recipe-media__status'); message.setAttribute('role', 'status'); status.set(section, message);
    {
      const input = node('input'); input.type = 'file'; input.multiple = true; input.hidden = true;
      input.accept = (section === 'video' ? videoTypes : [...imageTypes, ...(section === 'steps' ? videoTypes : [])]).join(',');
      input.addEventListener('change', () => { addFiles(input.files, section); input.value = ''; });
      const add = button(mediaText('add'), () => input.click()); controls.push(input, add);
      container.append(input, add);
      if (section !== 'video') {
        const paste = node('div', 'recipe-media__paste', mediaText('paste'));
        paste.tabIndex = 0;
        paste.addEventListener('paste', event => {
          const files = [...(event.clipboardData?.files || [])];
          if (files.length) { event.preventDefault(); addFiles(files, section); }
        });
        container.appendChild(paste);
      }
    }
    if (section === 'video') {
      const input = node('input', 'recipe-media__url'); input.type = 'url'; input.placeholder = mediaText('link'); input.setAttribute('aria-label', mediaText('link'));
      const add = button(mediaText('addLink'), () => {
        if (busy) return;
        try {
          items.push({ section, kind: 'link', external_url: normalizeVideoLink(input.value), filename: '' });
          input.value = ''; message.textContent = ''; dirty = true; render();
        } catch { message.textContent = mediaText('url'); }
      });
      controls.push(input, add); container.append(input, add);
    }
    const list = node('ul', 'recipe-media__list'); lists.set(section, list); container.append(message, list);
  }
  const reset = () => {
    generation++; release(); items = []; revision = null; dirty = false; loadError = false;
    for (const message of status.values()) message.textContent = '';
    setBusy(false);
  };
  editorResets.add(reset);
  return {
    reset,
    snapshot: () => items.map(({ previewURL, ...item }) => item),
    restore(rows = []) {
      reset(); items = rows.map(item => {
        if (!item.file) return item;
        const previewURL = URL.createObjectURL(item.file); urls.add(previewURL);
        return { ...item, previewURL };
      }); dirty = items.length > 0; render();
    },
    async load(recipeId, hasRevision) {
      reset();
      if (!hasRevision) return;
      const version = generation;
      setBusy(true);
      try {
        const data = await getMedia(recipeId);
        if (version !== generation) return;
        revision = data.revision; items = data.items;
      } catch {
        if (version !== generation) return;
        loadError = true;
        for (const message of status.values()) message.textContent = mediaText('failed');
      } finally { if (version === generation) setBusy(false); }
    },
    async save(recipeId, userId) {
      if (loadError || busy) throw new Error('media_not_loaded');
      if (!dirty) return revision;
      const version = generation;
      setBusy(true);
      try {
        for (const item of items) {
          if (!item.file || item.storage_path) continue;
          const path = `${userId}/${crypto.randomUUID()}`;
          const { error } = await supabase.storage.from(BUCKET).upload(path, item.file, { contentType: item.file.type, upsert: false, cacheControl: '0' });
          if (error) throw error;
          if (version !== generation) throw new Error('media_cancelled');
          item.storage_path = path;
        }
        const manifest = items.map(({ section, kind, storage_path, external_url, filename }) => ({ section, kind, storage_path, external_url, filename }));
        const { data, error } = await supabase.rpc('save_recipe_media', { p_recipe_id: Number(recipeId), p_base_revision: revision, p_items: manifest });
        if (error) throw error;
        if (version !== generation) return;
        revision = data; dirty = false;
        return revision;
      } finally { if (version === generation) setBusy(false); }
    },
  };
}

export async function renderRecipeMedia(container, recipeId) {
  if (!container) return;
  const request = crypto.randomUUID();
  container.dataset.recipeMedia = 'view'; container.dataset.mediaRequest = request;
  container.replaceChildren();
  try {
    const { items } = await getMedia(recipeId);
    if (container.dataset.mediaRequest !== request || !container.isConnected) return;
    for (const section of ['ingredients', 'steps', 'video']) {
      const group = items.filter(item => item.section === section);
      if (!group.length) continue;
      const block = node('section', 'recipe-media'); block.appendChild(node('h3', 'recipe-media__title', mediaText(section)));
      for (const item of group) {
        const row = node('div', 'recipe-media__item'); row.appendChild(preview(item, item.previewURL));
        if (item.kind !== 'link') row.appendChild(openButton(item));
        block.appendChild(row);
      }
      container.appendChild(block);
    }
  } catch {
    if (container.dataset.mediaRequest === request) container.textContent = mediaText('failed');
  }
}

// Files survive an OAuth redirect without placing base64 video in sessionStorage.
async function draftStore(action, value) {
  let key = sessionStorage.getItem('minto:recipe-media-draft');
  if (!key && (action === 'get' || action === 'delete')) return [];
  if (!key) { key = crypto.randomUUID(); sessionStorage.setItem('minto:recipe-media-draft', key); }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('minto-recipe-drafts', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('media');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('media', action === 'get' ? 'readonly' : 'readwrite');
      const store = tx.objectStore('media');
      const op = action === 'get' ? store.get(key) : action === 'delete' ? store.delete(key) : store.put(value, key);
      tx.oncomplete = () => { db.close(); resolve(op.result || []); };
      tx.onerror = () => { db.close(); reject(tx.error); };
      tx.onabort = tx.onerror;
    };
  });
}
export const saveMediaDraft = rows => rows.length ? draftStore('put', rows) : draftStore('delete');
export const loadMediaDraft = () => draftStore('get');
export const clearMediaDraft = () => draftStore('delete');

supabase.auth.onAuthStateChange(event => {
  if (event !== 'SIGNED_OUT') return;
  for (const reset of editorResets) reset();
  document.querySelectorAll('[data-recipe-media="view"]').forEach(container => {
    container.dataset.mediaRequest = ''; container.replaceChildren();
  });
  clearMediaDraft().catch(() => {});
});
