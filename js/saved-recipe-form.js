import { supabase } from './supabaseClient.js';
import { showToast } from './utils.js';
import { createInlineBookSelector, refreshBooks, getRecipeBooks, getSelectedBooksFromContainer, ensureDefaultBook } from './book-selector.js';
import { SOURCE_BUCKET, SOURCE_IMAGE_TYPES, SOURCE_VIDEO_TYPES, sourceFileKind, normalizeSourceUrl } from './recipe-source-rules.js';
import { getRecipeSource, signedSourceFiles, sourceText, openSourceImage } from './recipe-sources.js';

// Each opening owns its draft, object URLs and async lifetime; nothing survives logout/close.
export function mountSavedRecipeForm(host, recipe, { onSaved, onCancel, onBusy }) {
  let disposed=false, busy=false, ready=false;
  let source=null, ownerId=null;
  let persistedRecipeId=recipe?.id ?? null;
  let files=[], cover=null;
  const sourceId=crypto.randomUUID();
  const localUrls=new Set();
  host.innerHTML=`<div class="modal-card__header"><h2>${sourceText('saved')}</h2><p>${sourceText('private')}</p></div>
    <form class="preview-form saved-recipe-form"><fieldset disabled>
      <div class="preview-form__content">
        <div class="form-group"><label for="sr-name">${sourceText('title')}</label><input id="sr-name" required type="text"></div>
        <div class="form-group"><label for="sr-link">${sourceText('link')}</label><input id="sr-link" type="url" placeholder="https://…"></div>
        <div class="form-group"><button type="button" class="btn-upload" data-add>${sourceText('add')}</button>
          <input type="file" data-files multiple accept="${[...SOURCE_IMAGE_TYPES,...SOURCE_VIDEO_TYPES].join(',')}" hidden>
          <p class="source-hint">${sourceText('limits')}</p><div class="source-files" data-previews></div>
          <label class="source-cover"><input type="radio" name="source-cover" data-no-cover checked> ${sourceText('noCover')}</label>
        </div>
        <div class="recipe-books-section" ${recipe ? 'hidden' : ''}><h4>${sourceText('books')}</h4><div id="sr-books"></div></div>
      </div>
      <div class="preview-form__footer"><button type="button" class="btn-secondary" data-cancel>${sourceText('cancel')}</button><button type="submit" class="btn-save">${sourceText('save')}</button></div>
    </fieldset><p role="status" data-status></p></form>`;
  const form=host.querySelector('form');
  const status=form.querySelector('[data-status]');
  const fieldset=form.querySelector('fieldset');
  const nameInput=form.querySelector('#sr-name'), linkInput=form.querySelector('#sr-link');
  nameInput.value=recipe?.name_ua || '';
  const renderFiles=() => {
    const grid=form.querySelector('[data-previews]');grid.replaceChildren();
    form.querySelector('[data-no-cover]').checked=!cover;
    files.forEach(file=>{
      const item=document.createElement('div');item.className='source-file';
      const media=document.createElement(file.kind==='image'?'img':'video');media.src=file.url;media.setAttribute('aria-label',file.name);
      if(file.kind==='video'){media.controls=true;media.preload='metadata';media.playsInline=true;}
      else {media.alt=file.name;const zoom=document.createElement('button');zoom.type='button';zoom.append(media);zoom.addEventListener('click',()=>openSourceImage(file.url,file.name));item.append(zoom);}
      if(file.kind==='video') item.append(media);
      const caption=document.createElement('span');caption.textContent=file.name;item.append(caption);
      if(file.kind==='image'){
        const label=document.createElement('label');label.className='source-cover';
        const radio=document.createElement('input');radio.type='radio';radio.name='source-cover';radio.checked=cover===file.key;
        radio.addEventListener('change',()=>{cover=file.key;});label.append(radio,document.createTextNode(sourceText('cover')));item.append(label);
      }
      const remove=document.createElement('button');remove.type='button';remove.className='source-remove';remove.textContent=sourceText('remove');
      remove.addEventListener('click',()=>{files=files.filter(f=>f!==file);if(cover===file.key)cover=null;renderFiles();});item.append(remove);grid.append(item);
    });
  };
  form.querySelector('[data-no-cover]').addEventListener('change',()=>{cover=null;});
  form.querySelector('[data-add]').addEventListener('click',()=>form.querySelector('[data-files]').click());
  form.querySelector('[data-cancel]').addEventListener('click',onCancel);
  form.querySelector('[data-files]').addEventListener('change',event=>{
    for(const file of event.target.files){
      try{
        const kind=sourceFileKind(file);const url=URL.createObjectURL(file);localUrls.add(url);
        files.push({key:crypto.randomUUID(),name:file.name,mime:file.type,size:file.size,kind,url,blob:file});
      }catch(error){showToast(sourceText(error.message),'error');}
    }
    event.target.value='';renderFiles();
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!ready||busy||disposed)return;
    busy=true;onBusy(true);fieldset.disabled=true;form.setAttribute('aria-busy','true');status.textContent=sourceText('saving');
    try{
      const name=nameInput.value.trim();if(!name)throw new Error('name_required');
      const url=normalizeSourceUrl(linkInput.value);
      const {data:{session}}=await supabase.auth.getSession();
      if(disposed||session?.user?.id!==ownerId)throw new Error('source_unavailable');
      const {data:prepared,error:prepareError}=await supabase.rpc('prepare_recipe_source',{p_id:source?.id || sourceId});
      if(prepareError)throw prepareError;
      // New-form retries reuse the reserved folder and recover an already committed recipe ID.
      const preparedSource=Array.isArray(prepared)?prepared[0]:prepared;
      if(!source)source=preparedSource;
      if(!source?.id)throw new Error('source_unavailable');
      if(!recipe && preparedSource?.recipe_id){
        persistedRecipeId=preparedSource.recipe_id;
        source.version=preparedSource.version;
      }
      for(const file of files){
        if(file.blob&&!file.uploaded){
          if(disposed)throw new Error('source_unavailable');
          file.path ||= `${ownerId}/${source.id}/${file.key}`;
          const {error}=await supabase.storage.from(SOURCE_BUCKET).upload(file.path,file.blob,{contentType:file.mime,upsert:false});
          if(error){
            // A lost upload response may leave a complete object. Reconcile only our immutable path.
            const {data:info,error:infoError}=await supabase.storage.from(SOURCE_BUCKET).info(file.path);
            if(infoError || Number(info?.size ?? info?.metadata?.size)!==file.size)throw error;
          }
          file.uploaded=true;
        }
      }
      let books=recipe?await getRecipeBooks(recipe.id):getSelectedBooksFromContainer('sr-books');
      if(!books.length){const book=await ensureDefaultBook();if(!book)throw new Error('invalid_source_books');books=[book.id];}
      if(disposed)throw new Error('source_unavailable');
      const response=await fetch('/api/save-recipe',{
        method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},
        body:JSON.stringify({entryType:'saved',recipe:{name_ua:name},editingRecipeId:persistedRecipeId,isPublicSubmission:false,bookIds:books,
          source:{id:source.id,version:source.version,source_url:url,cover_path:files.find(file=>file.key===cover)?.path || null,
            files:files.map(({path,name,mime,size,kind})=>({path,name,mime,size,kind}))}}),
      });
      const result=await response.json();if(!response.ok)throw new Error(result.error);
      if(!result.recipe?.id)throw new Error('save_failed');
      if(!disposed){showToast(sourceText('savedToast'));busy=false;onBusy(false);onSaved(result.recipe);}
    }catch(error){if(!disposed){status.textContent=sourceText(error.message);showToast(status.textContent,'error');}}
    finally{busy=false;if(!disposed){fieldset.disabled=false;form.setAttribute('aria-busy','false');onBusy(false);}}
  });
  (async()=>{
    const {data:{user}}=await supabase.auth.getUser();ownerId=user?.id;
    if(!ownerId)throw new Error('source_unavailable');
    if(recipe){
      source=await getRecipeSource(recipe.id);if(!source)throw new Error('source_unavailable');
      const signed=await signedSourceFiles(source);if(disposed)return;
      files=signed.map(file=>({...file,key:file.path}));cover=source.cover_path;linkInput.value=source.source_url;renderFiles();
    }
    await refreshBooks();const selected=recipe?await getRecipeBooks(recipe.id):[];
    if(disposed)return;
    createInlineBookSelector('sr-books',selected);ready=true;fieldset.disabled=false;nameInput.focus();
  })().catch(error=>{if(!disposed){status.textContent=sourceText(error.message);fieldset.disabled=false;form.querySelectorAll('input,button[type=submit],[data-add]').forEach(el=>{el.disabled=true;});}});
  return ()=>{disposed=true;for(const url of localUrls)URL.revokeObjectURL(url);host.replaceChildren();};
}
