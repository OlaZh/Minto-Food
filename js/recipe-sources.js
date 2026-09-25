import { supabase } from './supabaseClient.js';
import { getLang } from './storage.js';
import { escapeHTML, showToast } from './utils.js';
import { SOURCE_BUCKET, normalizeSourceUrl } from './recipe-source-rules.js';

const words = {
  ua: {
    saving: 'Зберігаємо…', sourcePrivate: 'Це джерело бачите лише ви.',
    manual: 'Ввести вручну', manualHint: 'Інгредієнти та кроки приготування',
    saved: 'Додати скріншот', savedHint: 'Збережіть фото, відео чи посилання на потім',
    title: 'Назва', link: 'Посилання на рецепт', add: 'Додати фото чи відео',
    limits: 'Фото до 10 МБ · відео до 50 МБ', cover: 'Обкладинка', noCover: 'Без обкладинки',
    remove: 'Видалити', private: 'Тільки для вас у ваших книгах', books: 'Зберегти в книгу',
    save: 'Зберегти', cancel: 'Скасувати', original: 'Оригінал', source: 'Джерело',
    convert: 'Перетворити на рецепт', copy: 'Скопіювати підказку для ШІ', copied: 'Підказку скопійовано. Додайте скріншот у свій ШІ-чат.',
    prompt: 'Витягни рецепт із доданих скріншотів. Інгредієнти запиши кожен з нового рядка у форматі «продукт — кількість та одиниця виміру». Потім запиши пронумеровані кроки приготування. Не вигадуй відсутніх кількостей: познач невідоме. Відповідай українською.',
    name_required: 'Вкажіть назву.', image_too_large: 'Фото має бути до 10 МБ.', video_too_large: 'Відео має бути до 50 МБ.',
    invalid_source_files: 'Оберіть фото або відео підтримуваного формату.', invalid_source_url: 'Вставте повне посилання, що починається з https:// або http://.',
    source_conflict: 'Запис уже змінено. Відкрийте його знову.', source_unavailable: 'Джерело недоступне. Відкрийте форму знову.',
    error: 'Не вдалося зберегти. Ваші дані залишилися у формі. Спробуйте ще раз.', loadError: 'Не вдалося завантажити джерело.',
    savedToast: 'Збережено у ваших книгах', close: 'Закрити', zoomIn: 'Збільшити', zoomOut: 'Зменшити', copyError: 'Не вдалося скопіювати. Скопіюйте текст підказки нижче.',
  },
  en: {
    saving: 'Saving…', sourcePrivate: 'Only you can see this source.',
    manual: 'Enter manually', manualHint: 'Ingredients and preparation steps', saved: 'Add a screenshot', savedHint: 'Keep photos, videos or a link for later',
    title: 'Name', link: 'Recipe link', add: 'Add photos or videos', limits: 'Photos up to 10 MB · videos up to 50 MB', cover: 'Cover', noCover: 'No cover', remove: 'Remove',
    private: 'Only for you in your books', books: 'Save to book', save: 'Save', cancel: 'Cancel', original: 'Original', source: 'Source', convert: 'Convert to recipe',
    copy: 'Copy AI prompt', copied: 'Prompt copied. Add the screenshot to your AI chat.',
    prompt: 'Extract the recipe from the attached screenshots. Write each ingredient on a new line as “product — quantity and unit”. Then write numbered preparation steps. Do not invent missing quantities: mark them as unknown. Respond in English.',
    name_required: 'Enter a name.', image_too_large: 'Photos must be 10 MB or smaller.', video_too_large: 'Videos must be 50 MB or smaller.', invalid_source_files: 'Choose a supported photo or video.',
    invalid_source_url: 'Enter a full link starting with https:// or http://.', source_conflict: 'This entry has changed. Please reopen it.', source_unavailable: 'Source unavailable. Please reopen the form.',
    error: 'Could not save. Your entries are still in the form. Please retry.', loadError: 'Could not load the source.', savedToast: 'Saved to your books', close: 'Close', zoomIn: 'Zoom in', zoomOut: 'Zoom out', copyError: 'Could not copy. Copy the prompt below.',
  },
  pl: {
    saving: 'Zapisywanie…', sourcePrivate: 'Tylko Ty widzisz to źródło.',
    manual: 'Wpisz ręcznie', manualHint: 'Składniki i kroki przygotowania', saved: 'Dodaj zrzut ekranu', savedHint: 'Zachowaj zdjęcia, filmy lub link na później',
    title: 'Nazwa', link: 'Link do przepisu', add: 'Dodaj zdjęcia lub filmy', limits: 'Zdjęcia do 10 MB · filmy do 50 MB', cover: 'Okładka', noCover: 'Bez okładki', remove: 'Usuń',
    private: 'Tylko dla Ciebie w Twoich książkach', books: 'Zapisz w książce', save: 'Zapisz', cancel: 'Anuluj', original: 'Oryginał', source: 'Źródło', convert: 'Przekształć w przepis',
    copy: 'Skopiuj polecenie dla AI', copied: 'Polecenie skopiowane. Dodaj zrzut ekranu w swoim czacie AI.',
    prompt: 'Odczytaj przepis z załączonych zrzutów ekranu. Każdy składnik zapisz w nowym wierszu w formacie „produkt — ilość i jednostka”. Następnie zapisz ponumerowane kroki przygotowania. Nie wymyślaj brakujących ilości: oznacz je jako nieznane. Odpowiedz po polsku.',
    name_required: 'Wpisz nazwę.', image_too_large: 'Zdjęcie może mieć do 10 MB.', video_too_large: 'Film może mieć do 50 MB.', invalid_source_files: 'Wybierz obsługiwane zdjęcie lub film.',
    invalid_source_url: 'Wklej pełny link zaczynający się od https:// lub http://.', source_conflict: 'Wpis został zmieniony. Otwórz go ponownie.', source_unavailable: 'Źródło jest niedostępne. Otwórz formularz ponownie.',
    error: 'Nie udało się zapisać. Dane pozostały w formularzu. Spróbuj ponownie.', loadError: 'Nie udało się wczytać źródła.', savedToast: 'Zapisano w Twoich książkach', close: 'Zamknij', zoomIn: 'Powiększ', zoomOut: 'Pomniejsz', copyError: 'Nie udało się skopiować. Skopiuj tekst poniżej.',
  },
};
export const sourceText = key => (words[getLang()] || words.ua)[key] || words.ua[key] || words.ua.error;

let authEpoch = 0;
let authOwner;
supabase.auth.onAuthStateChange((event, session) => {
  const nextOwner = session?.user?.id ?? null;
  if (event === 'SIGNED_OUT' || (event === 'SIGNED_IN' && authOwner !== undefined && nextOwner !== authOwner)) {
    authEpoch++;
    document.querySelectorAll('[data-private-source]').forEach(el => el.remove());
    document.querySelectorAll('img[data-private-cover]').forEach(el => el.removeAttribute('src'));
  }
  authOwner = nextOwner;
});

export async function getRecipeSource(recipeId) {
  const epoch = authEpoch;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from('recipe_sources').select('*').eq('recipe_id', recipeId).eq('user_id', user.id).maybeSingle();
  if (epoch !== authEpoch) return null;
  if (error) throw error;
  return data;
}

export async function signedSourceFiles(source) {
  if (!source?.files?.length) return [];
  const epoch = authEpoch;
  const { data, error } = await supabase.storage.from(SOURCE_BUCKET).createSignedUrls(source.files.map(file => file.path), 300);
  if (error) throw error;
  if (epoch !== authEpoch) return [];
  return source.files.map(file => ({ ...file, url: data.find(item => item.path === file.path)?.signedUrl || '' }));
}

// This only attaches ephemeral owner URLs in memory. Never persist them as recipes.image.
export async function attachPrivateCovers(recipes) {
  const epoch = authEpoch;
  const ids = recipes.filter(recipe => recipe?.entry_type === 'saved').map(recipe => recipe.id);
  if (!ids.length) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data, error } = await supabase.from('recipe_sources').select('recipe_id,cover_path').eq('user_id', user.id).in('recipe_id', ids);
  if (error) return; // A missing cover still renders the placeholder.
  const sources = (data || []).filter(source => source.cover_path);
  if (!sources.length) return;
  const { data: signed } = await supabase.storage.from(SOURCE_BUCKET).createSignedUrls(sources.map(source => source.cover_path), 300);
  if (epoch !== authEpoch) return;
  for (const recipe of recipes) {
    const source = sources.find(item => item.recipe_id === recipe.id);
    recipe.privateCover = source ? signed?.find(item => item.path === source.cover_path)?.signedUrl : null;
  }
}

export function openSourceImage(url, name) {
  const dialog = document.createElement('dialog');
  dialog.className = 'source-zoom';
  dialog.dataset.privateSource = '';
  dialog.innerHTML = `<div class="source-zoom__tools"><button type="button" data-zoom="out" aria-label="${sourceText('zoomOut')}">−</button><button type="button" data-zoom="in" aria-label="${sourceText('zoomIn')}">+</button><button type="button" data-close>${sourceText('close')}</button></div><div class="source-zoom__stage"><img alt=""></div>`;
  const img = dialog.querySelector('img'); img.src = url; img.alt = name || '';
  const stage = dialog.querySelector('.source-zoom__stage');
  let scale = 1, x = 0, y = 0;
  const pointers = new Map();
  let previous = null;
  const paint = () => { img.style.transform = `translate(${x}px, ${y}px) scale(${scale})`; };
  const position = () => {
    const points = [...pointers.values()];
    return { x: points.reduce((n,p) => n+p.x,0)/points.length, y: points.reduce((n,p) => n+p.y,0)/points.length,
      distance: points.length === 2 ? Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y) : 0 };
  };
  stage.addEventListener('pointerdown', event => {
    stage.setPointerCapture(event.pointerId); pointers.set(event.pointerId,{x:event.clientX,y:event.clientY}); previous=position();
  });
  stage.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY}); const next=position();
    if (previous.distance && next.distance) scale=Math.max(1,Math.min(8,scale*next.distance/previous.distance));
    if (scale>1) { x+=next.x-previous.x; y+=next.y-previous.y; } else { x=0; y=0; }
    previous=next; paint();
  });
  for (const type of ['pointerup','pointercancel','lostpointercapture']) stage.addEventListener(type,event => { pointers.delete(event.pointerId); previous=position(); });
  dialog.querySelectorAll('[data-zoom]').forEach(button => button.addEventListener('click',() => {
    scale=Math.max(1,Math.min(8,scale*(button.dataset.zoom==='in'?1.5:1/1.5))); if(scale===1){x=0;y=0;} paint();
  }));
  dialog.querySelector('[data-close]').addEventListener('click',() => dialog.close());
  dialog.addEventListener('close',() => dialog.remove());
  document.body.append(dialog); dialog.showModal();
}

export async function renderSourcePanel(host, source, { original = false, open = false } = {}) {
  host.replaceChildren();
  if (!source) return;
  const epoch = authEpoch;
  const panel = document.createElement('details');
  panel.className = 'recipe-source'; panel.open = open; panel.dataset.privateSource = '';
  panel.innerHTML = `<summary>${sourceText(original?'original':'source')}</summary><div class="recipe-source__body"><p class="source-hint">${sourceText('sourcePrivate')}</p><div class="source-files"></div><button type="button" class="btn-secondary source-copy">${sourceText('copy')}</button></div>`;
  host.append(panel);
  const body = panel.querySelector('.recipe-source__body');
  if (source.source_url) {
    try {
      const link = document.createElement('a'); link.href = normalizeSourceUrl(source.source_url); link.textContent = source.source_url;
      link.target = '_blank'; link.rel = 'noopener noreferrer'; body.prepend(link);
    } catch { /* Never activate a legacy unsafe URL. */ }
  }
  panel.querySelector('.source-copy').addEventListener('click',async () => {
    try { await navigator.clipboard.writeText(sourceText('prompt')); showToast(sourceText('copied')); }
    catch {
      showToast(sourceText('copyError'),'error');
      let field=body.querySelector('textarea');
      if(!field){field=document.createElement('textarea');field.readOnly=true;field.value=sourceText('prompt');body.append(field);}
      field.focus();field.select();
    }
  });
  try {
    const files = await signedSourceFiles(source);
    if (!panel.isConnected || epoch !== authEpoch) return;
    for (const file of files) {
      const item = document.createElement(file.kind==='image'?'button':'div'); item.className='source-file';
      if(file.kind==='image') {
        item.type='button';item.innerHTML=`<img src="${escapeHTML(file.url)}" alt="${escapeHTML(file.name || '')}" loading="lazy">`;
        item.addEventListener('click',()=>openSourceImage(file.url,file.name));
      } else { const video=document.createElement('video');video.src=file.url;video.controls=true;video.preload='metadata';video.playsInline=true;item.append(video); }
      panel.querySelector('.source-files').append(item);
    }
  } catch { const error=document.createElement('p');error.textContent=sourceText('loadError');body.append(error); }
}
