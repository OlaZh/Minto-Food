import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceFileKind, normalizeSourceUrl } from '../js/recipe-source-rules.js';
import { cleanupRecipeSources } from '../api/_lib/recipe-source-cleanup.js';
process.env.SUPABASE_SERVICE_ROLE_KEY='test-service';
const {default:handler}=await import('../api/save-recipe.js');
const calls=[];
let original={id:42,user_id:'owner',entry_type:'saved',is_public:false,status:'draft',image:null};
let rpcError=null;
const realFetch=globalThis.fetch;
const response=(data,status=200)=>({ok:status<400,status,json:async()=>data,text:async()=>JSON.stringify(data)});
globalThis.fetch=async(url,options={})=>{
  const body=options.body?JSON.parse(options.body):null;calls.push({url,method:options.method||'GET',body});
  if(url.includes('/auth/v1/user'))return response({id:'owner'});
  if(url.includes('/rpc/check_rate_limit'))return response(true);
  if(url.includes('/rpc/save_saved_recipe'))return rpcError?response({message:rpcError},400):response(original);
  if(url.includes('/rest/v1/recipes'))return response(options.method==='PATCH'?[{...original,...body}]:[original]);
  if(url.includes('/rest/v1/profiles'))return response([{}]);
  throw new Error('Unexpected request '+url);
};
async function run(body){
  calls.length=0;
  const res={code:null,body:null,headers:{},status(code){this.code=code;return this;},json(body){this.body=body;return this;},setHeader(k,v){this.headers[k]=v;}};
  await handler({method:'POST',headers:{authorization:'Bearer token'},body},res);return res;
}
const savedBody={entryType:'saved',recipe:{name_ua:'Мафіни'},source:{id:'source',version:0,source_url:'https://tiktok.com/example',files:[],cover_path:null},bookIds:[1,2]};
test('saved API forces actor, passes books/source atomically and never calls moderation',async()=>{
  const res=await run({...savedBody,recipe:{...savedBody.recipe,user_id:'attacker',image:'https://private.example/image'}});
  assert.equal(res.code,200);assert.equal(res.headers['Cache-Control'],'no-store');
  const rpc=calls.find(c=>c.url.includes('/rpc/save_saved_recipe'));assert.equal(rpc.body.p_user_id,'owner');assert.deepEqual(rpc.body.p_books,['1','2']);assert.ok(!('image' in rpc.body));
  assert.equal(calls.length,3);
});
test('saved API refuses publication before save or moderation',async()=>{
  const res=await run({...savedBody,isPublicSubmission:true});assert.equal(res.code,400);assert.equal(res.body.error,'saved_recipe_private');
  assert.ok(!calls.some(c=>c.url.includes('save_saved_recipe')));
});
test('unsafe link is rejected before any write',async()=>{
  const res=await run({...savedBody,source:{...savedBody.source,source_url:'javascript:alert(1)'}});assert.equal(res.body.error,'invalid_source_url');
  assert.ok(!calls.some(c=>c.url.includes('save_saved_recipe')));
});
test('stale source error is returned without fallback creation',async()=>{
  rpcError='source_conflict';try{const res=await run(savedBody);assert.equal(res.body.error,'source_conflict');assert.ok(!calls.some(c=>c.url.endsWith('/recipes')));}finally{rpcError=null;}
});
test('manual edit of saved entry requires explicit conversion',async()=>{
  const res=await run({recipe:{name_ua:'Name'},editingRecipeId:42});assert.equal(res.body.error,'conversion_required');assert.ok(!calls.some(c=>c.method==='PATCH'));
});
test('conversion updates the same row and leaves source/book tables alone',async()=>{
  const res=await run({recipe:{name_ua:'Мафіни',steps:'1. Змішати'},editingRecipeId:42,convertSaved:true});
  assert.equal(res.code,200);assert.equal(res.body.recipe.id,42);assert.equal(res.body.recipe.entry_type,'manual');
  const write=calls.find(c=>c.method==='PATCH');assert.ok(write.url.includes('id=eq.42&user_id=eq.owner'));assert.equal(write.body.entry_type,'manual');
  assert.ok(!calls.some(c=>/sources|cookbook|sightengine/.test(c.url)));
});
test('another user cannot convert an entry',async()=>{
  const before=original;original={...original,user_id:'another'};
  try{const res=await run({recipe:{name_ua:'Name'},editingRecipeId:42,convertSaved:true});assert.equal(res.code,403);assert.ok(!calls.some(c=>c.method==='PATCH'));}finally{original=before;}
});
test('client limits accept exact bounds and reject oversized/unsupported files',()=>{
  assert.equal(sourceFileKind({type:'image/png',size:10485760}),'image');
  assert.equal(sourceFileKind({type:'video/mp4',size:52428800}),'video');
  assert.throws(()=>sourceFileKind({type:'image/png',size:10485761}),/image_too_large/);
  assert.throws(()=>sourceFileKind({type:'video/mp4',size:52428801}),/video_too_large/);
  assert.throws(()=>sourceFileKind({type:'image/svg+xml',size:100}),/invalid_source_files/);
  assert.equal(normalizeSourceUrl(''), '');assert.throws(()=>normalizeSourceUrl('https://user:password@example.com'),/invalid_source_url/);
});
test('cleanup retains metadata on Storage failure and deletes it only after confirming empty folder',async()=>{
  const savedFetch=globalThis.fetch;
  let filesRemain=true, failDelete=true, metadataDeleted=false;
  globalThis.fetch=async(url,options)=>{
    if(url.includes('claim_recipe_source_cleanup'))return response([{id:'source',user_id:'owner',retired_at:'now'}]);
    if(url.includes('/object/list/'))return response(filesRemain?[{id:'file',name:'image'}]:[]);
    if(url.includes('/object/')){if(failDelete)return response({},503);filesRemain=false;return response([]);}
    if(options.method==='DELETE'){assert.equal(filesRemain,false);metadataDeleted=true;return response(null,204);}
    throw new Error(url);
  };
  try{
    await assert.rejects(cleanupRecipeSources('https://test',{}),/503/);assert.equal(metadataDeleted,false);
    failDelete=false;await cleanupRecipeSources('https://test',{});assert.equal(metadataDeleted,true);
  }finally{globalThis.fetch=savedFetch;}
});
test.after(()=>{globalThis.fetch=realFetch;});
