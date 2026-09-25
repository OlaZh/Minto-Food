import { PGlite } from '../node_modules/.cache/recipe-media-qa/node_modules/@electric-sql/pglite/dist/index.js';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const db = new PGlite();
const owner='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222';
const source='33333333-3333-4333-8333-333333333333';
const photo={path:`${owner}/${source}/photo`,name:'Screenshot.png',kind:'image',mime:'image/png',size:10485760};
const video={path:`${owner}/${source}/video`,name:'Video.mp4',kind:'video',mime:'video/mp4',size:52428800};
let passed=0;
async function check(name, fn){await fn();console.log('PASS '+name);passed++;}
const asRole=async(role,id=owner)=>{
  await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.role','${role}',false); SELECT set_config('request.jwt.claim.sub','${id}',false); SET ROLE ${role};`);
};
const save=(overrides={})=>{
  const p={user:owner,source,recipe:null,name:'Мафіни з гарбуза',url:'https://www.tiktok.com/@author/video/123',files:[photo,video],cover:photo.path,books:['1','2'],version:0,...overrides};
  return db.query('SELECT * FROM public.save_saved_recipe($1,$2,$3,$4,$5,$6::jsonb,$7,$8::text[],$9)',
    [p.user,p.source,p.recipe,p.name,p.url,JSON.stringify(p.files),p.cover,p.books,p.version]).then(r=>r.rows[0]);
};
try{
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated,service_role;
    CREATE TABLE profiles(id uuid PRIMARY KEY,deletion_scheduled_for timestamptz,is_admin boolean DEFAULT false);
    INSERT INTO profiles(id,is_admin) VALUES('${owner}',false),('${other}',true);
    CREATE TABLE recipes(id serial PRIMARY KEY,user_id uuid,name_ua text,image text,is_public boolean DEFAULT false,status text DEFAULT 'draft');
    ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
    CREATE POLICY old_broad_recipes ON recipes FOR ALL TO anon,authenticated USING(true) WITH CHECK(true);
    GRANT ALL ON recipes TO anon,authenticated,service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated,service_role;
    CREATE TABLE cookbooks(id integer PRIMARY KEY,user_id uuid);
    INSERT INTO cookbooks VALUES(1,'${owner}'),(2,'${owner}'),(3,'${other}');
    CREATE TABLE cookbook_recipes(id serial PRIMARY KEY,cookbook_id integer,recipe_id integer REFERENCES recipes ON DELETE CASCADE,UNIQUE(cookbook_id,recipe_id));
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb,created_at timestamptz DEFAULT now(),UNIQUE(bucket_id,name));
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT ALL ON storage.objects TO anon,authenticated,service_role;
    CREATE POLICY old_broad_storage ON storage.objects FOR ALL TO anon,authenticated USING(true) WITH CHECK(true);
    INSERT INTO recipes(name_ua,user_id) VALUES('Existing','${owner}');
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/20260924_1200_saved_recipes.sql',import.meta.url),'utf8'));
  await check('existing recipes default to manual',async()=>assert.equal((await db.query('SELECT entry_type FROM recipes')).rows[0].entry_type,'manual'));
  await asRole('authenticated');
  await check('reserving an upload folder does not create a recipe',async()=>{
    await db.query('SELECT prepare_recipe_source($1)',[source]);assert.equal((await db.query('SELECT count(*)::int n FROM recipes')).rows[0].n,1);
  });
  await check('owner can upload immutable files only to the reserved folder',async()=>{
    for(const file of [photo,video])await db.query('INSERT INTO storage.objects(bucket_id,name,metadata) VALUES($1,$2,$3)', ['recipe-sources',file.path,{mimetype:file.mime,size:file.size}]);
    await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('recipe-sources','arbitrary/file')"),/row-level security/);
    assert.equal((await db.query("UPDATE storage.objects SET metadata='{}' WHERE bucket_id='recipe-sources' RETURNING *")).rows.length,0);
    assert.equal((await db.query("DELETE FROM storage.objects WHERE bucket_id='recipe-sources' RETURNING *")).rows.length,0);
  });
  await check('reading originals works in a read-only transaction',async()=>{
    await db.exec('BEGIN READ ONLY');
    assert.equal((await db.query("SELECT * FROM storage.objects WHERE bucket_id='recipe-sources'")).rows.length,2);
    await db.exec('COMMIT');
  });
  await check('client cannot create a saved row or call service save RPC',async()=>{
    await assert.rejects(db.query("INSERT INTO recipes(entry_type) VALUES('saved')"),/save API/);
    await assert.rejects(save(),/permission denied/);
  });
  await asRole('service_role');
  let recipe;
  await check('one save atomically stores title, link, files, cover and two books',async()=>{
    recipe=await save();assert.equal(recipe.entry_type,'saved');assert.equal(recipe.is_public,false);assert.equal(recipe.image,null);
    await asRole('postgres');
    assert.equal((await db.query('SELECT count(*)::int n FROM cookbook_recipes WHERE recipe_id=$1',[recipe.id])).rows[0].n,2);
    const row=(await db.query('SELECT * FROM recipe_sources')).rows[0];assert.equal(row.recipe_id,recipe.id);assert.equal(row.files.length,2);assert.equal(row.cover_path,photo.path);
    await asRole('service_role');
  });
  await check('retry after a lost response returns the same recipe',async()=>assert.equal((await save()).id,recipe.id));
  await check('stale edit cannot overwrite the source',async()=>assert.rejects(save({recipe:recipe.id}),/source_conflict/));
  await check('video cannot be the cover',async()=>assert.rejects(save({recipe:recipe.id,version:1,cover:video.path}),/invalid_source_cover/));
  await check('foreign book rolls back the full edit',async()=>{
    await assert.rejects(save({recipe:recipe.id,version:1,name:'Must not persist',books:['3']}),/invalid_source_books/);
    assert.equal((await db.query('SELECT name_ua FROM recipes WHERE id=$1',[recipe.id])).rows[0].name_ua,'Мафіни з гарбуза');
  });
  await asRole('postgres');
  await check('direct book insertion cannot attach a saved entry to another owner',async()=>{
    await assert.rejects(db.query('INSERT INTO cookbook_recipes(cookbook_id,recipe_id) VALUES(3,$1)',[recipe.id]),/owner's books/);
  });
  await asRole('service_role');
  await check('metadata spoofing cannot bypass file limits',async()=>assert.rejects(save({recipe:recipe.id,version:1,files:[{...photo,size:1}],cover:photo.path}),/invalid_source_files/));
  await asRole('postgres');
  await db.query("UPDATE storage.objects SET metadata=jsonb_set(metadata,'{size}','10485761') WHERE name=$1",[photo.path]);
  await asRole('service_role');
  await check('actual image size over 10 MB is rejected',async()=>assert.rejects(save({recipe:recipe.id,version:1,files:[{...photo,size:10485761}]}),/image_too_large/));
  await asRole('postgres');
  await db.query("UPDATE storage.objects SET metadata=jsonb_set(metadata,'{size}','10485760') WHERE name=$1",[photo.path]);
  await db.query("UPDATE storage.objects SET metadata=jsonb_set(metadata,'{size}','52428801') WHERE name=$1",[video.path]);
  await asRole('service_role');
  await check('actual video size over 50 MB is rejected',async()=>assert.rejects(save({recipe:recipe.id,version:1,files:[{...video,size:52428801}],cover:null}),/video_too_large/));
  await asRole('postgres');
  await db.query("UPDATE storage.objects SET metadata=jsonb_set(metadata,'{size}','52428800') WHERE name=$1",[video.path]);
  await check('postflight checks report every protection enabled',async()=>{
    const sql=await readFile(new URL('../supabase/checks/saved_recipes_postflight.sql',import.meta.url),'utf8');
    for(const [key,value] of Object.entries((await db.query(sql)).rows[0]))assert.equal(value,true,key);
  });
  await asRole('authenticated',other);
  await check('another user including admin cannot read saved rows, sources or objects',async()=>{
    assert.equal((await db.query('SELECT * FROM recipes WHERE id=$1',[recipe.id])).rows.length,0);
    assert.equal((await db.query('SELECT * FROM recipe_sources')).rows.length,0);
    assert.equal((await db.query("SELECT * FROM storage.objects WHERE bucket_id='recipe-sources'")).rows.length,0);
    await assert.rejects(db.query('SELECT prepare_recipe_source($1)',[source]),/unavailable/);
  });
  await asRole('anon','');
  await check('guests cannot read sources even with old broad storage policy',async()=>{
    assert.equal((await db.query("SELECT * FROM storage.objects WHERE bucket_id='recipe-sources'")).rows.length,0);
    await assert.rejects(db.query('SELECT * FROM recipe_sources'),/permission denied/);
  });
  await asRole('authenticated');
  await check('saved entries cannot be published or converted by direct client update',async()=>{
    await assert.rejects(db.query("UPDATE recipes SET is_public=true,status='published' WHERE id=$1",[recipe.id]),/recipes_saved_private_check/);
    await assert.rejects(db.query("UPDATE recipes SET entry_type='manual' WHERE id=$1",[recipe.id]),/save API/);
  });
  await asRole('service_role');
  await check('removing a file queues it without altering other files or the recipe ID',async()=>{
    const changed=await save({recipe:recipe.id,version:1,files:[photo],cover:null});assert.equal(changed.id,recipe.id);
    const row=(await db.query('SELECT * FROM recipe_sources')).rows[0];assert.equal(row.cover_path,null);assert.deepEqual(row.cleanup_paths,[video.path]);
    await assert.rejects(save({recipe:recipe.id,version:2,files:[photo,video]}),/invalid_source_files/);
  });
  await asRole('postgres');
  await check('abandoned uploads from failed edits are claimed without touching attached files',async()=>{
    const abandoned=`${owner}/${source}/interrupted`;
    await db.query("INSERT INTO storage.objects(bucket_id,name,metadata,created_at) VALUES('recipe-sources',$1,'{}',now()-interval '2 days')",[abandoned]);
    await db.query("UPDATE storage.objects SET created_at=now()-interval '2 days' WHERE name=$1",[photo.path]);
    const rows=(await db.query('SELECT * FROM claim_recipe_source_cleanup(NULL)')).rows;
    assert.ok(rows[0].cleanup_paths.includes(abandoned));assert.ok(!rows[0].cleanup_paths.includes(photo.path));
    await asRole('authenticated');
    await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('recipe-sources',$1)",[abandoned]),/row-level security/);
  });
  await asRole('service_role');
  await check('conversion preserves row ID, book memberships and private originals',async()=>{
    await db.query("UPDATE recipes SET entry_type='manual',name_ua='Text recipe',is_public=true,status='published' WHERE id=$1",[recipe.id]);
    assert.equal((await db.query('SELECT * FROM recipe_sources')).rows[0].recipe_id,recipe.id);
    await asRole('postgres');assert.equal((await db.query('SELECT count(*)::int n FROM cookbook_recipes WHERE recipe_id=$1',[recipe.id])).rows[0].n,2);
    await asRole('authenticated',other);assert.equal((await db.query('SELECT * FROM recipes WHERE id=$1',[recipe.id])).rows.length,1);
    assert.equal((await db.query('SELECT * FROM recipe_sources')).rows.length,0);
    assert.equal((await db.query("SELECT * FROM storage.objects WHERE bucket_id='recipe-sources'")).rows.length,0);
    await asRole('authenticated');assert.equal((await db.query('SELECT * FROM recipe_sources')).rows.length,1);
  });
  await check('deleting recipe retains retired source metadata until Storage cleanup',async()=>{
    await db.query('DELETE FROM recipes WHERE id=$1',[recipe.id]);await asRole('service_role');
    const rows=(await db.query('SELECT * FROM claim_recipe_source_cleanup(NULL)')).rows;
    assert.equal(rows.length,1);assert.ok(rows[0].retired_at);assert.equal(rows[0].recipe_id,null);
    await asRole('authenticated');assert.equal((await db.query('SELECT * FROM recipe_sources')).rows.length,0);
    await assert.rejects(db.query('SELECT prepare_recipe_source($1)',[source]),/unavailable/);
  });
  await asRole('postgres');
  await check('profile hard deletion cannot lose uncleaned private sources',async()=>assert.rejects(db.query('DELETE FROM profiles WHERE id=$1',[owner]),/foreign key constraint/));
  await check('rollback refuses private data and succeeds only after cleanup',async()=>{
    const rollback=await readFile(new URL('../supabase/migrations/20260924_1200_saved_recipes_rollback.sql',import.meta.url),'utf8');
    await assert.rejects(db.exec(rollback),/private sources still exist/);await db.exec('ROLLBACK');
    // Fixture-only equivalent of successful Storage API cleanup.
    await db.exec("DELETE FROM storage.objects WHERE bucket_id='recipe-sources'; DELETE FROM recipe_sources; DELETE FROM storage.buckets WHERE id='recipe-sources';");
    await db.exec(rollback);
    assert.equal((await db.query("SELECT to_regclass('public.recipe_sources') AS sources")).rows[0].sources,null);
    assert.equal((await db.query("SELECT name_ua FROM recipes WHERE id=1")).rows[0].name_ua,'Existing');
  });
  console.log(`${passed} SQL checks passed`);
}catch(error){console.error(error.message, error.where || '');process.exitCode=1;}finally{await db.close();}
