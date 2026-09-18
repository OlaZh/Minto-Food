// Real Chrome + real recipe form/media modules; Supabase/API are local doubles.
// No live writes, no provider calls. Clipboard is a synthetic clipboard event.
// node scripts/recipe-media-browser-check.mjs
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { startChrome, delay } from './lib/chrome-cdp.mjs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root,'node_modules/.cache/recipe-media-browser',new Date().toISOString().replace(/[:.]/g,'-'));
const profile = path.join(output,'chrome-profile');
const stubs = {
  'supabaseClient.js': `export const supabase = window.qa.supabase;`,
  'storage.js': `export const getLang=()=> 'ua';`,
  'auth.js': `export const requireAuth=()=>{window.qa.authRequested=true};`,
  'i18n-apply.js': `import {i18n} from './i18n.js'; export const t=key=>i18n.ua[key]||key; export const formatText=(key,args)=>t(key).replace(/\\{(\\w+)\\}/g,(_,k)=>args[k]||'');`,
  'scroll-lock.js': `export const lockScroll=()=>{}, unlockScroll=()=>{};`,
  'parse-food.js': `export const parseIngredientsText=()=>{throw Error('parser forbidden')}, findProductMatch=parseIngredientsText, findAllMatches=parseIngredientsText, resolveScannedProduct=parseIngredientsText, isDirectUnit=parseIngredientsText, learnAlias=parseIngredientsText;`,
  'barcode-scanner.js': `export const scanBarcode=()=>{throw Error('scanner forbidden')};`,
  'utils.js': `export const showToast=(text)=>window.qa.toasts.push(text); export const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); export const setInputVal=(id,v)=>document.getElementById(id).value=v||''; export const toBase64=()=>{throw Error('main photo not tested')}; export async function withButtonLoading(btn,fn){if(btn.disabled)return;btn.disabled=true;try{return await fn()}finally{btn.disabled=false}};`,
  'book-selector.js': `export const initBookSelector=()=>{}, createInlineBookSelector=()=>{}, getRecipeBooks=async()=>[], getSelectedBooksFromContainer=()=>[], saveRecipeToBooks=async()=>true, saveRecipeToBook=async()=>true, ensureDefaultBook=async()=>({id:1,name:'QA'}), getBookName=()=> 'QA', refreshBooks=async()=>{};`,
  'ui-components.js': `export const initCustomSelect=()=>{}, setSelectValue=(_,id,v)=>document.getElementById(id).value=v, initSelectsGlobalListener=()=>{};`,
  'analytics.js': `export const track=()=>{};`,
};
const fixture = `
window.qa={uploads:[],rows:[],manifests:[],saved:[],toasts:[],revision:null,items:[],failUpload:false,failLoad:false,failSave:false,user:{id:'qa-owner'}};
const q=window.qa;
q.supabase={auth:{getUser:async()=>({data:{user:q.user}}),getSession:async()=>({data:{session:{access_token:'qa'}}}),onAuthStateChange:fn=>{q.onAuth=fn}},
 storage:{from:()=>({upload:async(path,file,opts)=>{q.uploads.push({path,name:file.name,opts});return q.failUpload?{error:{message:'upload failed'}}:{}},createSignedUrl:async path=>({data:{signedUrl:q.urls?.[path]||'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1sAAAAASUVORK5CYII='}})})},
 rpc:async(name,args)=>{if(name==='get_recipe_media')return q.failLoad?{error:Error('load failed')}:{data:{revision:q.revision,items:q.items}};
 if(name==='save_recipe_media'){if(q.failSave)return {error:Error('save failed')};if(args.p_base_revision!==q.revision)return {error:Error('media_conflict')};q.manifests.push(args);q.revision=crypto.randomUUID();q.items=args.p_items;return {data:q.revision}};throw Error('Unexpected RPC '+name)}};
window.fetch=async(url,opts)=>{if(url!=='/api/save-recipe')throw Error('Unexpected fetch '+url);let b=JSON.parse(opts.body);q.rows.push(b);return{ok:true,json:async()=>({recipe:{id:b.editingRecipeId||42,user_id:'qa-owner',status:'draft',...b.recipe}})}};
const form=await import('/js/recipe-modal.js'); const media=await import('/js/recipe-media.js'); q.form=form;q.media=media;
await form.initRecipeModal();await form.openRecipeModal(data=>q.saved.push(data));q.ready=true;
`;
const config=JSON.parse(await fs.readFile(path.join(root,'vercel.json'),'utf8'));
const server=http.createServer(async(req,res)=>{
  try {
    const name=new URL(req.url,'http://localhost').pathname;
    for(const header of config.headers[0].headers) res.setHeader(header.key,header.value);
    if(name==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="uk"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/css/main.css"><body><script type="module" src="/fixture.js"></script></body></html>');return}
    if(name==='/fixture.js'){res.setHeader('Content-Type','text/javascript');res.end(fixture);return}
    if(name.startsWith('/js/')&&stubs[path.basename(name)]){res.setHeader('Content-Type','text/javascript');res.end(stubs[path.basename(name)]);return}
    if(!/^\/(js\/[-\w]+\.js|css\/main\.css|fonts\/[-\w./]+)$/.test(name)){res.writeHead(404).end();return}
    res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'font/woff2');res.end(await fs.readFile(path.join(root,name.slice(1))));
  } catch {res.writeHead(404).end()}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
let chrome, count=0;
try{
  chrome=await startChrome(profile);
  const {send}=chrome;
  for(const width of [1440,390]){
    const {targetId}=await send('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});const command=(m,p={})=>send(m,p,sessionId);
    const evaluate=async expression=>{const r=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value};
    const check=async(name,expression)=>{assert.equal(await evaluate(expression),true,name);count++;console.log(`PASS ${width} ${name}`)};
    await command('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:900,deviceScaleFactor:1,mobile:false});
    await command('Page.navigate',{url:origin});
    for(let i=0;i<80;i++){if(await evaluate('!!window.qa?.ready'))break;await delay(100)}
    await check('form opens with three distinct upload controls',`document.querySelectorAll('.recipe-media input[type=file]').length===3 && document.querySelector('#rm-image-file')!==null`);
    await check('no repeated calculation-disabled banners',`!document.body.innerText.includes('тимчасово') && document.querySelector('#ingredientList').hidden`);
    await evaluate(`document.getElementById('rm-name').value='Рецепт зі скриншотів';document.getElementById('rm-calories').value='125,5';
      window.addFiles=(id,names,type='image/png')=>{const d=new DataTransfer();for(const name of names){let bytes=new Uint8Array([1,2,3]);if(type==='image/png'){const c=document.createElement('canvas');c.width=600;c.height=200;const g=c.getContext('2d');g.fillStyle='#f5f0df';g.fillRect(0,0,600,200);g.fillStyle='#253725';g.font='24px sans-serif';g.fillText('Інгредієнти: борошно, молоко, яйця',25,65);bytes=Uint8Array.from(atob(c.toDataURL().split(',')[1]),c=>c.charCodeAt(0))}d.items.add(new File([bytes],name,{type}))}const input=document.querySelector('#'+id+' input[type=file]');input.files=d.files;input.dispatchEvent(new Event('change',{bubbles:true}))};
      addFiles('rm-ingredient-media',['first.png','second.png']);addFiles('rm-video-media',['recipe.mp4'],'video/mp4');
      const clip=new DataTransfer();clip.items.add(new File(['clip'],'steps.png',{type:'image/png'}));document.querySelector('#rm-step-media .recipe-media__paste').dispatchEvent(new ClipboardEvent('paste',{clipboardData:clip,bubbles:true}));
      const url=document.querySelector('#rm-video-media input[type=url]');url.value='https://youtube.com/watch?v=example';url.nextElementSibling.click();`);
    await check('multiple screenshots, pasted step, video file and link retained',`document.querySelectorAll('.recipe-media__item').length===5 && document.querySelectorAll('.recipe-media video').length===1`);
    await evaluate(`document.querySelector('#rm-ingredient-media li:last-child button').click()`);
    await check('order changes',`document.querySelector('#rm-ingredient-media .recipe-media__filename').textContent==='second.png'`);
    await check('unsafe links rejected',`(()=>{for(const url of ['javascript:alert(1)','data:text/html,bad','https://user:pass@example.com']){try{qa.media.normalizeVideoLink(url);return false}catch{}}return true})()`);
    await evaluate(`document.querySelector('#rm-ingredient-media').scrollIntoView({block:'center'})`);
    await check('upload button visible and clickable',`(()=>{const b=document.querySelector('#rm-ingredient-media button'),r=b.getBoundingClientRect();return b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})()`);
    const shot=await command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(output,`attachments-${width}.png`),Buffer.from(shot.data,'base64'));
    await check('no horizontal form overflow',`document.querySelector('.preview-form__content').scrollWidth<=document.querySelector('.preview-form__content').clientWidth+1`);
    await evaluate(`qa.failUpload=true;document.getElementById('recipe-modal-form').requestSubmit()`);
    for(let i=0;i<50;i++){if(await evaluate('qa.rows.length===1 && !document.querySelector(".btn-save").disabled'))break;await delay(30)}
    await check('upload failure keeps all attachments in open form',`qa.rows.length===1 && qa.manifests.length===0 && document.querySelectorAll('.recipe-media__item').length===5 && document.querySelector('#recipe-create-modal.is-active')!==null`);
    await evaluate(`qa.failUpload=false;qa.failSave=true;document.getElementById('recipe-modal-form').requestSubmit()`);
    for(let i=0;i<50;i++){if(await evaluate('qa.rows.length===2 && !document.querySelector(".btn-save").disabled'))break;await delay(30)}
    const uploadCount=await evaluate('qa.uploads.length');
    await evaluate(`qa.failSave=false;document.getElementById('recipe-modal-form').requestSubmit()`);
    for(let i=0;i<50;i++){if(await evaluate('qa.saved.length===1'))break;await delay(30)}
    await check('retry updates same recipe and does not upload successful files twice',`qa.rows.length===3 && qa.rows[0].editingRecipeId===null && qa.rows[1].editingRecipeId===42 && qa.rows[2].editingRecipeId===42 && qa.uploads.length===${uploadCount}`);
    await check('saved manifest contains ordered screenshots, video and URL; nutrition per100 unchanged',`qa.manifests.length===1 && qa.items.length===5 && qa.items[0].filename==='second.png' && qa.saved[0].kcal===125.5 && qa.saved[0].media_revision===qa.revision`);
    await evaluate(`(async()=>{await qa.form.openRecipeModalForEdit(qa.saved[0])})()`);
    await check('reopen restores attachments and hides one-time nutrition hint',`document.querySelectorAll('.recipe-media__item').length===5 && !document.body.innerText.includes('КБЖВ на 100 г готової страви:')`);
    await evaluate(`(async()=>{qa.form.closeRecipeModal();qa.failLoad=true;await qa.form.openRecipeModalForEdit(qa.saved[0]);document.getElementById('recipe-modal-form').requestSubmit()})()`);
    await delay(100);
    await check('failed load never overwrites existing media with empty list',`qa.manifests.length===1 && document.querySelector('#recipe-create-modal.is-active')!==null`);
    await evaluate(`(async()=>{qa.failLoad=false;qa.form.closeRecipeModal();await qa.form.openRecipeModal();document.getElementById('rm-name').value='Draft';addFiles('rm-ingredient-media',['draft.png']);qa.user=null;document.getElementById('recipe-modal-form').requestSubmit()})()`);
    for(let i=0;i<50;i++){if(await evaluate('qa.authRequested===true'))break;await delay(30)}
    await check('guest screenshot survives as File in IndexedDB',`(async()=>{const rows=await qa.media.loadMediaDraft();return rows.length===1&&rows[0].file instanceof File&&rows[0].file.name==='draft.png'})()`);
    await evaluate(`qa.onAuth('SIGNED_OUT')`);await delay(50);
    await check('logout clears attachments and draft but preserves usable upload controls',`(async()=>document.querySelectorAll('.recipe-media__item').length===0 && document.querySelectorAll('.recipe-media input[type=file]').length===3 && (await qa.media.loadMediaDraft()).length===0)()`);
    await send('Target.closeTarget',{targetId});
  }
  await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:count,mode:'real browser, mocked API/Storage, synthetic clipboard',viewports:[1440,390]},null,2));
  console.log(`${count} browser checks passed. Artifacts: ${output}`);
}catch(error){console.error(error);process.exitCode=1}
finally{chrome?.close();server.closeAllConnections();server.close()}
