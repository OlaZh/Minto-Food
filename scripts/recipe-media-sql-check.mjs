// Local PostgreSQL (WASM) checks, not a live Supabase/Storage test.
// npm.cmd install --prefix node_modules/.cache/recipe-media-qa --no-audit --no-fund --package-lock=false @electric-sql/pglite
// node scripts/recipe-media-sql-check.mjs
import { PGlite } from '../node_modules/.cache/recipe-media-qa/node_modules/@electric-sql/pglite/dist/index.js';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PGlite();
const owner = '11111111-1111-4111-8111-111111111111', stranger = '22222222-2222-4222-8222-222222222222', admin = '33333333-3333-4333-8333-333333333333';
let passed = 0;
async function as(role, uid, fn) {
  await db.exec(`SET ROLE ${role}`);
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claims', $2, false)", [uid || '', JSON.stringify({ role, sub: uid })]);
  try { return await fn(); } finally { await db.exec('RESET ROLE'); }
}
const get = review => db.query('SELECT public.get_recipe_media(1, $1) AS media', [!!review]).then(r => r.rows[0].media);
const save = (revision, items) => db.query('SELECT public.save_recipe_media(1, $1, $2::jsonb) AS revision', [revision, JSON.stringify(items)]).then(r => r.rows[0].revision);
const review = (revision, approve) => db.query('SELECT public.review_recipe_media(1, $1, $2)', [revision, approve]);
const file = name => ({ section: 'ingredients', kind: 'image', storage_path: `${owner}/${name}`, filename: `${name}.png` });
const check = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array($1, '/') $$;
    CREATE TABLE storage.buckets(id text PRIMARY KEY, name text, public boolean);
    CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(), bucket_id text, name text, metadata jsonb, owner_id text, owner uuid);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA auth, storage, public TO anon, authenticated, service_role;
    GRANT ALL ON storage.objects TO anon, authenticated;
    -- Deliberately broad old policy: new restrictive guards MUST override it.
    CREATE POLICY old_broad_policy ON storage.objects FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    CREATE TABLE public.profiles(id uuid PRIMARY KEY, is_admin boolean, deletion_scheduled_for timestamptz);
    CREATE TABLE public.recipes(id integer PRIMARY KEY, user_id uuid, deleted_at timestamptz, is_public boolean DEFAULT false,
      status text DEFAULT 'draft', has_pending_update boolean DEFAULT false, is_image_flagged boolean DEFAULT false,
      image_nsfw_score numeric, image_moderated_at timestamptz, moderation_note text, name_ua text, steps text, ingredients text,
      image text, kcal numeric, protein numeric, fat numeric, carbs numeric, fiber numeric, total_weight numeric, category text, author text);
    GRANT ALL ON public.recipes TO authenticated;
    CREATE TABLE public.recipe_pending_updates(id uuid DEFAULT gen_random_uuid(), recipe_id integer, user_id uuid, changes jsonb);
    -- Existing moderation functions represented by their relevant side effects.
    CREATE FUNCTION public.apply_pending_update(integer) RETURNS integer LANGUAGE plpgsql AS $$ BEGIN
      UPDATE public.recipes SET has_pending_update=false, status='published' WHERE id=$1;
      DELETE FROM public.recipe_pending_updates WHERE recipe_id=$1; RETURN $1; END $$;
    CREATE FUNCTION public.discard_pending_update(integer) RETURNS integer LANGUAGE plpgsql AS $$ BEGIN
      UPDATE public.recipes SET has_pending_update=false WHERE id=$1;
      DELETE FROM public.recipe_pending_updates WHERE recipe_id=$1; RETURN $1; END $$;
    INSERT INTO profiles(id,is_admin) VALUES ('${owner}', false), ('${stranger}', false), ('${admin}', true);
    INSERT INTO auth.users(id) VALUES ('${owner}'), ('${stranger}'), ('${admin}');
    INSERT INTO recipes(id,user_id) VALUES (1,'${owner}');
    INSERT INTO storage.objects(bucket_id,name,metadata) VALUES
      ('recipe-attachments','${owner}/one','{"mimetype":"image/png","size":123}'),
      ('recipe-attachments','${owner}/two','{"mimetype":"image/png","size":124}'),
      ('recipe-attachments','${stranger}/secret','{"mimetype":"image/png","size":125}');
  `);
  // Tables consumed by the REAL existing GDPR function. Storage HTTP is still
  // simulated; PostgreSQL executes the existing deletion and new wrapper.
  for (const table of ['meals','water','week_meals','weight_records','user_activities','user_streaks','shopping_items','shopping_lists','recipe_ratings','api_rate_limits','scanned_product_corrections','scanned_product_name_corrections','user_profiles']) {
    await db.exec(`CREATE TABLE public.${table}(user_id uuid)`);
  }
  await db.exec(`CREATE TABLE public.cookbooks(id integer,user_id uuid);
    CREATE TABLE public.cookbook_recipes(cookbook_id integer);
    CREATE TABLE public.recipe_ingredients_raw(recipe_id integer);
    CREATE TABLE public.recipe_reports(user_id uuid,resolved_by uuid);
    CREATE TABLE public.feature_flags(updated_by uuid);
    CREATE TABLE public.gdpr_requests(user_id uuid,type text,status text,completed_at timestamptz);`);
  await db.exec(await readFile(new URL('../supabase/migrations/20260729_1100_gdpr_hard_delete_v3.sql',import.meta.url),'utf8'));
  await check('migration executes', () => readFile(new URL('../supabase/migrations/20260915_1000_recipe_attachments.sql', import.meta.url), 'utf8').then(sql => db.exec(sql)));
  await check('read-only installation checks all return true',async()=>{
    const checks=await db.exec(await readFile(new URL('../supabase/checks/recipe_media_postflight.sql',import.meta.url),'utf8'));
    for(const result of checks) for(const row of result.rows) for(const value of Object.values(row))assert.equal(value,true);
  });
  let v1, v2;
  await check('owner saves private screenshot with no text recipe', async () => {
    v1 = await as('authenticated', owner, () => save(null, [file('one')]));
    const media = await as('authenticated', owner, () => get()); assert.equal(media.items.length, 1);
  });
  await check('private metadata and storage hidden from other user and moderator', async () => {
    for (const uid of [stranger, admin]) await as('authenticated', uid, async () => {
      await assert.rejects(get(), /not_authorized/); await assert.rejects(get(true), /not_authorized/);
      assert.equal((await db.query('SELECT * FROM recipe_attachments')).rows.length, 0);
      assert.equal((await db.query('SELECT * FROM storage.objects WHERE name=$1', [`${owner}/one`])).rows.length, 0);
    });
  });
  await check('stranger cannot attach own/foreign files to another recipe', () => as('authenticated', stranger, () => assert.rejects(save(v1, []), /not_authorized/)));
  await check('owner cannot attach another owner file', () => as('authenticated', owner, () => assert.rejects(save(v1, [{ ...file('one'), storage_path: `${stranger}/secret` }]), /invalid_media_owner/)));
  await check('stale edit rejected without changing current snapshot', () => as('authenticated', owner, () => assert.rejects(save(null, []), /media_conflict/)));
  await check('direct approval column update/insert forbidden', () => as('authenticated', owner, async () => {
    await assert.rejects(db.query('UPDATE recipes SET published_media_revision=$1 WHERE id=1', [v1]), /use_recipe_media_rpc/);
    await assert.rejects(db.query('INSERT INTO recipes(id,user_id,media_revision) VALUES (2,$1,$2)', [owner,v1]), /use_recipe_media_rpc/);
  }));
  await check('immutable files cannot be overwritten or deleted while linked', () => as('authenticated', owner, async () => {
    assert.equal((await db.query("UPDATE storage.objects SET metadata='{}' WHERE name=$1 RETURNING id", [`${owner}/one`])).rows.length, 0);
    assert.equal((await db.query('DELETE FROM storage.objects WHERE name=$1 RETURNING id', [`${owner}/one`])).rows.length, 0);
  }));
  await check('foreign uploads denied despite broad old storage policy', () => as('authenticated', stranger, () => assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES ('recipe-attachments',$1)", [`${owner}/forged`]), /row-level security/)));
  await check('private recipe cannot be approved even by administrator', () => as('authenticated', admin, () => assert.rejects(review(v1,true), /not_public/)));
  await db.exec("UPDATE recipes SET is_public=true, status='pending' WHERE id=1");
  await check('pending public files still hidden from anonymous readers', () => as('anon', null, async () => {
    await assert.rejects(get(), /not_authorized/);
    assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length, 0);
  }));
  await check('owner cannot approve own public attachments', () => as('authenticated', owner, () => assert.rejects(review(v1,true), /not_authorized/)));
  await check('admin can see and approve exact public submission', () => as('authenticated', admin, async () => {
    assert.equal((await get(true)).revision,v1); await review(v1,true);
  }));
  await check('anonymous readers see approved snapshot and only its file', () => as('anon', null, async () => {
    assert.equal((await get()).revision,v1);
    assert.deepEqual((await db.query('SELECT name FROM storage.objects')).rows.map(r=>r.name),[`${owner}/one`]);
  }));
  v2 = await as('authenticated', owner, () => save(v1,[file('two')]));
  await check('edit stages new media, original public snapshot remains visible', () => as('anon', null, async () => {
    assert.equal((await get()).revision,v1);
    assert.deepEqual((await db.query('SELECT name FROM storage.objects')).rows.map(r=>r.name),[`${owner}/one`]);
  }));
  await check('moderator stale revision rejected', () => as('authenticated', admin, () => assert.rejects(review(v1,true), /media_conflict/)));
  await check('reject staged edit restores owner snapshot', async () => {
    await as('authenticated', admin, () => review(v2,false));
    assert.equal((await as('authenticated', owner, () => get())).revision,v1);
  });
  await check('moderator cannot read withdrawn attachment history', () => as('authenticated',admin,async()=>{
    assert.equal((await db.query('SELECT * FROM recipe_attachments WHERE revision=$1',[v2])).rows.length,0);
    assert.equal((await db.query('SELECT * FROM storage.objects WHERE name=$1',[`${owner}/two`])).rows.length,0);
  }));
  v2 = await as('authenticated', owner, () => save(v1,[]));
  await check('removing all attachments is reviewable and preserves old public files until approval', async () => {
    assert.equal((await as('anon',null,()=>get())).items.length,1);
    await as('authenticated',admin,()=>review(v2,true));
    assert.equal((await as('anon',null,()=>get())).items.length,0);
    assert.equal((await as('anon',null,()=>db.query('SELECT * FROM storage.objects'))).rows.length,0);
  });
  await check('returning to private applies edits and clears moderation atomically', async () => {
    await as('authenticated',owner,()=>save(v2,[file('one')]));
    const rows = await as('service_role',null,()=>db.query('SELECT * FROM public.save_private_recipe(1,$1,$2::jsonb)',[owner,JSON.stringify({name_ua:'Private', image:'private-image'})]));
    assert.equal(rows.rows[0].image,'private-image'); assert.equal(rows.rows[0].has_pending_update,false);
    assert.equal((await db.query('SELECT * FROM recipe_pending_updates')).rows.length,0);
    await as('anon',null,()=>assert.rejects(get(), /not_authorized/));
  });
  const gdpr = () => as('service_role',null,()=>db.query('SELECT public.hard_delete_user_data($1)',[owner]));
  const step = (action,token=null,source=null) => as('service_role',null,()=>db.query(
    'SELECT public.recipe_media_cleanup_step($1,$2,$3,$4) AS value',[owner,action,token,source]).then(r=>r.rows[0].value));
  const publicRevision='44444444-4444-4444-8444-444444444444';
  await db.exec(`
    INSERT INTO recipes(id,user_id,is_public,status,media_revision,published_media_revision)
      VALUES(2,'${owner}',true,'published','${publicRevision}','${publicRevision}');
    INSERT INTO recipe_attachments(recipe_id,revision,position,section,kind,storage_path)
      VALUES(2,'${publicRevision}',0,'ingredients','image','${owner}/two');
    INSERT INTO storage.objects(bucket_id,name,metadata) VALUES
      ('recipe-attachments','${owner}/orphan','{"mimetype":"image/png","size":7}'),
      ('recipe-attachments','${owner}/private-history','{"mimetype":"image/png","size":8}');
    INSERT INTO recipe_attachments(recipe_id,revision,position,section,kind,storage_path)
      VALUES(2,gen_random_uuid(),0,'ingredients','image','${owner}/private-history');
    INSERT INTO storage.objects(bucket_id,name,metadata)
      SELECT 'recipe-attachments','${owner}/batch-'||n,'{"mimetype":"image/png","size":1}'::jsonb FROM generate_series(1,60) n;
    UPDATE storage.objects SET owner_id='${owner}', owner='${owner}' WHERE name LIKE '${owner}/%';
    UPDATE profiles SET deletion_scheduled_for=now()+interval '1 day' WHERE id='${owner}';
  `);
  await check('GDPR grace period blocks cleanup and data deletion', async()=>{
    await assert.rejects(gdpr(),/Grace period/);
    assert.equal((await db.query('SELECT * FROM recipe_media_cleanup_jobs')).rows.length,0);
    assert.equal((await db.query('SELECT * FROM recipes WHERE id=1')).rows.length,1);
  });
  await db.exec(`UPDATE profiles SET deletion_scheduled_for=now()-interval '1 day' WHERE id='${owner}';
    INSERT INTO meals VALUES('${owner}');
    CREATE FUNCTION fail_legacy_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated_legacy_failure'; END $$;
    CREATE TRIGGER fail_legacy_delete BEFORE DELETE ON meals FOR EACH ROW EXECUTE FUNCTION fail_legacy_delete();`);
  await check('failure in real legacy GDPR function rolls back queue and pruning', async()=>{
    await assert.rejects(gdpr(),/simulated_legacy_failure/);
    assert.equal((await db.query('SELECT * FROM recipe_media_cleanup_jobs')).rows.length,0);
    assert.equal((await db.query('SELECT * FROM recipe_attachments WHERE storage_path=$1',[`${owner}/private-history`])).rows.length,1);
  });
  await db.exec('DROP TRIGGER fail_legacy_delete ON meals; DROP FUNCTION fail_legacy_delete()');
  await check('only service role can delete accounts or run/read cleanup jobs',async()=>{
    for(const role of ['anon','authenticated']) await as(role,owner,async()=>{
      await assert.rejects(db.query('SELECT public.hard_delete_user_data($1)',[owner]),/permission denied/);
      await assert.rejects(db.query("SELECT public.recipe_media_cleanup_step($1,'claim')",[owner]),/permission denied/);
      await assert.rejects(db.query('SELECT * FROM recipe_media_cleanup_jobs'),/permission denied/);
    });
    await as('service_role',null,()=>assert.rejects(db.query('SELECT public.hard_delete_user_data_without_media($1)',[owner]),/permission denied/));
  });
  await check('real GDPR function deletes private recipe, anonymizes public, queues all owner files',async()=>{
    await gdpr();
    assert.equal((await db.query('SELECT * FROM recipes WHERE id=1')).rows.length,0);
    assert.equal((await db.query('SELECT user_id FROM recipes WHERE id=2')).rows[0].user_id,null);
    assert.equal((await db.query('SELECT * FROM profiles WHERE id=$1',[owner])).rows.length,0);
    const files=(await db.query('SELECT * FROM recipe_media_cleanup_files')).rows;
    assert.equal(files.length,64);assert.equal(files.filter(f=>f.phase==='copy').length,1);
    assert.equal(files.find(f=>f.phase==='copy').source_path,`${owner}/two`);
    assert.equal((await db.query('SELECT * FROM storage.objects WHERE name LIKE $1',[`${owner}/%`])).rows.length,64);
  });
  await check('preparation retry works after profile removal without duplicating jobs',async()=>{
    await gdpr();assert.equal((await db.query('SELECT * FROM recipe_media_cleanup_jobs')).rows.length,1);
    assert.equal((await db.query('SELECT * FROM recipe_media_cleanup_files')).rows.length,64);
  });
  await check('stale JWT cannot upload new files after cleanup inventory',()=>as('authenticated',owner,()=>assert.rejects(
    db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('recipe-attachments',$1)",[`${owner}/late`]),/row-level security/)));
  let batch=await step('claim'), token=batch.token;
  await check('large inventories return bounded batches without dropping remaining tasks',async()=>{
    assert.equal(batch.files.length,50);assert.equal((await db.query('SELECT count(*)::integer AS n FROM recipe_media_cleanup_files')).rows[0].n,64);
  });
  await check('concurrent worker cannot claim an active lease',async()=>assert.equal(await step('claim'),null));
  await check('incorrect lease cannot modify cleanup state',()=>assert.rejects(step('next',publicRevision),/cleanup_lease_lost/));
  await db.exec("UPDATE recipe_media_cleanup_jobs SET lease_until=now()-interval '1 minute'");
  const previousToken=token;batch=await step('claim');token=batch.token;
  await check('expired worker lease can be reclaimed; old token is rejected',async()=>{
    assert.notEqual(token,previousToken);await assert.rejects(step('next',previousToken),/cleanup_lease_lost/);
  });
  const retained=(await db.query("SELECT * FROM recipe_media_cleanup_files WHERE phase='copy'")).rows[0];
  await check('public source cannot be removed before a copy is verified',async()=>{
    await assert.rejects(step('copy_done',token,retained.source_path),/cleanup_copy_not_verified/);
    assert.equal((await db.query('SELECT storage_path FROM recipe_attachments WHERE recipe_id=2')).rows[0].storage_path,retained.source_path);
  });
  await db.query(`INSERT INTO storage.objects(bucket_id,name,metadata,owner_id)
    SELECT bucket_id,$1,metadata,$2 FROM storage.objects WHERE name=$3`,[retained.destination_path,owner,retained.source_path]);
  await check('copy still owned by deleted user cannot replace public source',()=>assert.rejects(step('copy_done',token,retained.source_path),/cleanup_copy_not_verified/));
  await db.query('UPDATE storage.objects SET owner_id=NULL WHERE name=$1',[retained.destination_path]);
  await check('verified ownerless copy switches public references without losing accessibility',async()=>{
    batch=await step('copy_done',token,retained.source_path);
    const media=await as('anon',null,()=>db.query('SELECT public.get_recipe_media(2) AS media'));
    assert.equal(media.rows[0].media.items[0].storage_path,retained.destination_path);
    const files=await as('anon',null,()=>db.query('SELECT name FROM storage.objects'));
    assert.deepEqual(files.rows.map(f=>f.name),[retained.destination_path]);
  });
  await check('false success from Storage delete cannot drop a queue item',()=>assert.rejects(step('delete_done',token,retained.source_path),/cleanup_source_not_deleted/));
  await check('account completion blocked while files remain',()=>assert.rejects(step('finish',token),/cleanup_incomplete/));
  while(batch.files.length){
    const f=batch.files[0];assert.equal(f.phase,'delete');
    // Simulate Storage HTTP deleting an object; NEVER do this against live DB.
    await db.query("DELETE FROM storage.objects WHERE bucket_id='recipe-attachments' AND name=$1",[f.source_path]);
    batch=await step('delete_done',token,f.source_path);
  }
  await check('auth deletion failure keeps empty job retryable',async()=>{
    await assert.rejects(step('finish',token),/cleanup_incomplete/);
    await step('release',token);batch=await step('claim');token=batch.token;
    assert.equal(batch.files.length,0);
  });
  await db.query('DELETE FROM auth.users WHERE id=$1',[owner]);
  await check('completion clears queue only after files and auth account are gone',async()=>{
    assert.equal((await step('finish',token)).done,true);assert.equal(await step('finish',token),null);
    assert.equal((await db.query('SELECT * FROM recipe_media_cleanup_jobs')).rows.length,0);
    assert.equal((await db.query('SELECT * FROM storage.objects WHERE name=$1',[retained.destination_path])).rows.length,1);
    assert.equal((await db.query('SELECT * FROM storage.objects WHERE name=$1',[`${stranger}/secret`])).rows.length,1);
  });
  await check('rerunning the migration refuses to overwrite installed data',async()=>{
    await assert.rejects(db.exec(await readFile(new URL('../supabase/migrations/20260915_1000_recipe_attachments.sql',import.meta.url),'utf8')),/already exist/);
    await db.exec('ROLLBACK');
    assert.equal((await db.query('SELECT * FROM recipes WHERE id=2')).rows.length,1);
  });
  console.log(`${passed} local PostgreSQL checks passed`);
} finally { await db.close(); }
