// Read-only live schema check. Does not upload, write recipes, or execute SQL.
// node scripts/recipe-media-preflight.mjs
import { fileURLToPath } from 'node:url';
process.loadEnvFile(fileURLToPath(new URL('../.env.local', import.meta.url)));
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');
const base = 'https://xpaibteyntflrixmigfx.supabase.co';
for (const [check, endpoint] of [
  ['recipe revision columns', '/rest/v1/recipes?select=id,media_revision,published_media_revision&limit=0'],
  ['attachment table', '/rest/v1/recipe_attachments?select=recipe_id&limit=0'],
  ['private bucket', '/storage/v1/bucket/recipe-attachments'],
]) {
  try {
    const response = await fetch(base + endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    const data = await response.json();
    console.log(JSON.stringify({ check, status: response.status, ...(response.ok ? { present: true, ...(check === 'private bucket' ? { public: data.public } : {}) } : { code: data.code || data.error }) }));
    if (!response.ok || (check === 'private bucket' && data.public !== false)) process.exitCode = 1;
  } catch (error) { console.log(JSON.stringify({ check, error: error.cause?.code || error.name })); process.exitCode = 1; }
}
