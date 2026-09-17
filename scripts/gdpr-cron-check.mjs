// Security regression tests for api/cron/gdpr-hard-delete.js.
// Proves that the destructive endpoint fails closed before any Supabase call.
// Run: node --test scripts/gdpr-cron-check.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const handlerUrl = pathToFileURL(resolve(scriptDir, '../api/cron/gdpr-hard-delete.js')).href;

function mockResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function importHandler(name, env) {
  const previous = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
  };

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    const module = await import(`${handlerUrl}?test=${encodeURIComponent(name)}`);
    return module.default;
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function run(handler, authorization) {
  let fetchCalls = 0;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetchCalls++;
    return {
      ok: true,
      status: 200,
      json: async () => [],
      text: async () => '[]',
    };
  };

  try {
    const response = mockResponse();
    await handler({ headers: authorization ? { authorization } : {} }, response);
    return { response, fetchCalls };
  } finally {
    globalThis.fetch = previousFetch;
  }
}

test('missing CRON_SECRET fails closed before Supabase access', async () => {
  const handler = await importHandler('missing-secret', {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    CRON_SECRET: undefined,
  });
  const { response, fetchCalls } = await run(handler);

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { error: 'Server misconfigured' });
  assert.equal(fetchCalls, 0);
});

test('missing Authorization is rejected before Supabase access', async () => {
  const handler = await importHandler('missing-auth', {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    CRON_SECRET: 'test-cron-secret',
  });
  const { response, fetchCalls } = await run(handler);

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: 'Unauthorized' });
  assert.equal(fetchCalls, 0);
});

test('wrong Bearer token is rejected before Supabase access', async () => {
  const handler = await importHandler('wrong-auth', {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    CRON_SECRET: 'test-cron-secret',
  });
  const { response, fetchCalls } = await run(handler, 'Bearer wrong-secret');

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: 'Unauthorized' });
  assert.equal(fetchCalls, 0);
});

test('correct Bearer token reaches the cron handler', async () => {
  const handler = await importHandler('correct-auth', {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    CRON_SECRET: 'test-cron-secret',
  });
  const { response, fetchCalls } = await run(handler, 'Bearer test-cron-secret');

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { deleted: 0, message: 'No users pending deletion' });
  assert.equal(fetchCalls, 2); // due profiles + durable jobs (including profile-less retries)
});

async function cleanupHarness(options = {}) {
  const owner='11111111-1111-4111-8111-111111111111';
  const destination='retained/22222222-2222-4222-8222-222222222222';
  const files = new Set([`${owner}/private`,`${owner}/public`]);
  let tasks=[{ source_path:`${owner}/private`,destination_path:null,phase:'delete' },
    { source_path:`${owner}/public`,destination_path:destination,phase:'copy' }];
  let due = options.resuming ? [] : [{id:owner}], job=!!options.resuming, auth=true;
  const calls=[];
  const fail={ ...options };
  let clockOffset=0;
  const handler=await importHandler(`cleanup-${Math.random()}`,{
    SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-service-key',CRON_SECRET:'secret',
  });
  const batch=()=>({token:'lease',files:tasks.slice(0,50).map(f=>({...f}))});
  const json=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data,text:async()=>JSON.stringify(data)});
  const fetchMock=async(url,opts={})=>{
    const body=opts.body?JSON.parse(opts.body):null;
    calls.push({url,method:opts.method||'GET',body});
    if(url.includes('/profiles?')) return json(due);
    if(url.includes('/rpc/hard_delete_user_data')) {
      if(fail.grace) return json({message:'Grace period'},400);
      due=[];job=true;return json({recipes_deleted:1,recipes_anonymized:1});
    }
    if(url.includes('/recipe_media_cleanup_jobs?'))return json(job?[{user_id:owner}]:[]);
    if(url.includes('/rpc/recipe_media_cleanup_step')){
      if(!job)return json(null);
      const action=body.p_action;
      if(action==='claim')return json(fail.leased?null:batch());
      if(action==='release')return json(null);
      if(action==='copy_done'){
        if(fail.ack){fail.ack=false;return json({error:'lost ack'},500)}
        assert.ok(files.has(destination),'copy must exist before SQL switches references');
        tasks.find(t=>t.source_path===body.p_source).phase='delete';
        if(fail.budget){fail.budget=false;clockOffset+=30000}
        return json(batch());
      }
      if(action==='delete_done'){
        if(fail.deleteAck){fail.deleteAck=false;return json({error:'lost delete ack'},500)}
        if(files.has(body.p_source))return json({error:'source not deleted'},400);
        tasks=tasks.filter(t=>t.source_path!==body.p_source);return json(batch());
      }
      if(action==='finish'){
        assert.equal(tasks.length,0);assert.equal(auth,false);
        if(fail.finish){fail.finish=false;return json({error:'lost ack'},500)}
        job=false;return json({done:true});
      }
    }
    if(url.endsWith('/storage/v1/object/copy')){
      assert.equal(body.bucketId,'recipe-attachments');assert.ok(files.has(body.sourceKey));
      if(fail.copy)return json({error:'Storage unavailable'},503);
      if(files.has(body.destinationKey))return json({error:'Duplicate',statusCode:'409'},400);
      files.add(body.destinationKey);return json({Key:body.destinationKey});
    }
    if(url.endsWith('/storage/v1/object/recipe-attachments')){
      if(fail.remove)return json({error:'Storage unavailable'},503);
      if(body.prefixes.every(source=>!files.has(source)))return json({error:'Not found'},404);
      if(!fail.falseDelete)for(const source of body.prefixes){
        if(source.endsWith('/public'))assert.equal(tasks.find(t=>t.source_path===source).phase,'delete','public reference must be switched before source removal');
        files.delete(source);
      }
      return json([]);
    }
    if(url.includes('/auth/v1/admin/users/')){
      assert.equal(tasks.length,0,'all files must finish before Auth deletion');
      if(fail.auth)return json({error:'Auth unavailable'},503);
      const status=auth?200:404;auth=false;return json({},status);
    }
    throw Error('Unexpected request '+url);
  };
  return {
    calls,fail,files,destination,owner,
    state:()=>({job,auth,tasks:tasks.map(t=>({...t})),due}),
    async run(){const previous=globalThis.fetch, previousNow=Date.now;globalThis.fetch=fetchMock;Date.now=()=>previousNow()+clockOffset;
      try{const response=mockResponse();await handler({headers:{authorization:'Bearer secret'}},response);return response}
      finally{globalThis.fetch=previous;Date.now=previousNow}
    },
  };
}

test('cleanup preserves public copy, removes private files, then deletes Auth and job',async()=>{
  const h=await cleanupHarness();const response=await h.run();
  assert.equal(response.body.deleted,1);assert.equal(response.body.errors,0);
  assert.deepEqual([...h.files],[h.destination]);assert.equal(h.state().job,false);
  assert.ok(h.calls.findIndex(c=>c.url.includes('hard_delete_user_data'))<h.calls.findIndex(c=>c.url.includes('/storage/')));
});
test('durable job resumes even if original profile has already disappeared',async()=>{
  const h=await cleanupHarness({resuming:true});assert.equal((await h.run()).body.deleted,1);
  assert.ok(!h.calls.some(c=>c.url.includes('hard_delete_user_data')));
});
for(const failure of ['copy','remove','falseDelete','auth'])test(`${failure} failure leaves retryable job and next run completes`,async()=>{
  const h=await cleanupHarness({[failure]:true});const first=await h.run();
  assert.equal(first.body.errors,1);assert.equal(h.state().job,true);assert.equal(h.state().auth,true);
  h.fail[failure]=false;assert.equal((await h.run()).body.deleted,1);assert.equal(h.state().job,false);
  assert.equal(h.calls.filter(c=>c.url.includes('hard_delete_user_data')).length,1);
});
test('lost copy acknowledgement retries duplicate copy safely before source deletion',async()=>{
  const h=await cleanupHarness({ack:true});assert.equal((await h.run()).body.errors,1);
  assert.ok(h.files.has(`${h.owner}/public`));assert.ok(h.files.has(h.destination));
  assert.equal((await h.run()).body.deleted,1);assert.deepEqual([...h.files],[h.destination]);
});
test('failure after Auth deletion retries its 404 and closes the durable job',async()=>{
  const h=await cleanupHarness({finish:true});assert.equal((await h.run()).body.errors,1);
  assert.equal(h.state().auth,false);assert.equal(h.state().job,true);
  assert.equal((await h.run()).body.deleted,1);assert.equal(h.state().job,false);
});
test('another worker lease prevents duplicate storage/auth operations',async()=>{
  const h=await cleanupHarness({resuming:true,leased:true});assert.equal((await h.run()).body.pending,1);
  assert.ok(!h.calls.some(c=>c.url.includes('/storage/')||c.url.includes('/auth/')));
});
test('grace-period rejection cannot trigger any file or auth deletion',async()=>{
  const h=await cleanupHarness({grace:true});assert.equal((await h.run()).body.errors,1);
  assert.equal(h.state().job,false);assert.ok(!h.calls.some(c=>c.url.includes('/storage/')||c.url.includes('/auth/')));
});
test('lost delete acknowledgement retries an already deleted file idempotently',async()=>{
  const h=await cleanupHarness({deleteAck:true});assert.equal((await h.run()).body.errors,1);
  assert.equal(h.state().job,true);assert.equal((await h.run()).body.deleted,1);
});
test('time budget defers remaining files and releases lease for the next run',async()=>{
  const h=await cleanupHarness({budget:true});assert.equal((await h.run()).body.pending,1);
  assert.equal(h.state().auth,true);assert.ok(h.files.has(`${h.owner}/public`));
  assert.equal(h.calls.at(-1).body.p_action,'release');assert.equal((await h.run()).body.deleted,1);
});
