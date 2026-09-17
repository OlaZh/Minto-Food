// Vercel Cron — GDPR Hard Delete
// Schedule: щодня о 02:00 UTC (vercel.json)
// Знаходить юзерів з минулим grace period і повністю видаляє їх дані.
//
// Послідовність:
//   1. RPC hard_delete_user_data() — дані та стійка черга файлів в одній транзакції
//   2. Storage API — зберігає публічні копії, видаляє приватні/старі файли
//   3. Supabase Admin API deleteUser(), потім закриває запис черги
//
// Вимагає: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY і CRON_SECRET у Vercel env vars.

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SERVICE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET      = process.env.CRON_SECRET;
const BUCKET = 'recipe-attachments';

const HEADERS = {
  apikey:          SERVICE_KEY,
  Authorization:   `Bearer ${SERVICE_KEY}`,
  'Content-Type':  'application/json',
};

async function fetchDueUsers() {
  const url = `${SUPABASE_URL}/rest/v1/profiles`
    + `?select=id`
    + `&deletion_scheduled_for=lte.${new Date().toISOString()}`
    + `&deletion_scheduled_for=not.is.null`;

  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`fetchDueUsers: ${res.status} ${await res.text()}`);
  return res.json();
}

async function hardDeleteData(userId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/hard_delete_user_data`, {
    method:  'POST',
    headers: HEADERS,
    body:    JSON.stringify({ p_user_id: userId }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`hard_delete_user_data(${userId}): ${res.status} ${await res.text()}`);
  return res.json();
}

async function cleanupStep(userId, action, token = null, source = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/recipe_media_cleanup_step`, {
    method: 'POST', headers: HEADERS, signal: AbortSignal.timeout(10000),
    body: JSON.stringify({ p_user_id: userId, p_action: action, p_token: token, p_source: source }),
  });
  if (!res.ok) throw new Error(`cleanup ${action}: HTTP ${res.status}`);
  return res.json();
}

async function fetchCleanupJobs() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/recipe_media_cleanup_jobs?select=user_id&order=last_attempt_at.asc.nullsfirst,created_at.asc&limit=100`, {
    headers: HEADERS, signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`fetchCleanupJobs: HTTP ${res.status}`);
  return res.json();
}

async function processCleanup(userId, deadline) {
  let batch = await cleanupStep(userId, 'claim');
  if (!batch) return false; // another worker holds the lease
  const token = batch.token;
  try {
    while (batch.files.length) {
      if (Date.now() >= deadline) return false;
      const file = batch.files[0];
      // Source/destination come only from the guarded SQL queue. Still fail
      // closed if a malformed job would point outside this account/bucket.
      if (!file.source_path.startsWith(`${userId}/`) || file.source_path.includes('..')) throw new Error('Invalid cleanup path');
      if (file.phase === 'copy') {
        if (!/^retained\/[0-9a-f-]{36}$/.test(file.destination_path)) throw new Error('Invalid retained path');
        const copied = await fetch(`${SUPABASE_URL}/storage/v1/object/copy`, {
          method: 'POST', headers: HEADERS, signal: AbortSignal.timeout(10000),
          body: JSON.stringify({ bucketId: BUCKET, sourceKey: file.source_path, destinationKey: file.destination_path }),
        });
        if (!copied.ok) {
          const error = await copied.json().catch(() => ({}));
          // Retry after a successful copy whose acknowledgement was lost.
          if (copied.status !== 409 && error.statusCode !== '409' && error.error !== 'Duplicate' && error.code !== 'Duplicate') {
            throw new Error(`copyRecipeFile: HTTP ${copied.status}`);
          }
        }
        // Checks the copy's existence, size/type and lack of an owner before
        // atomically switching recipe references away from the source path.
        batch = await cleanupStep(userId, 'copy_done', token, file.source_path);
      } else if (file.phase === 'delete') {
        const removed = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
          method: 'DELETE', headers: HEADERS, signal: AbortSignal.timeout(10000),
          body: JSON.stringify({ prefixes: [file.source_path] }),
        });
        if (!removed.ok && removed.status !== 404) throw new Error(`deleteRecipeFile: HTTP ${removed.status}`);
        // A 200/404 alone is insufficient: the RPC verifies Storage metadata
        // no longer contains this file, then removes just that queue item.
        batch = await cleanupStep(userId, 'delete_done', token, file.source_path);
      } else { throw new Error('Invalid cleanup phase'); }
    }
    if (Date.now() >= deadline) return false;
    await deleteAuthUser(userId);
    await cleanupStep(userId, 'finish', token);
    return true;
  } finally {
    // If the process is killed instead, lease expiry enables the next run.
    await cleanupStep(userId, 'release', token).catch(() => {});
  }
}

async function deleteAuthUser(userId) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method:  'DELETE',
    headers: HEADERS,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`deleteAuthUser(${userId}): ${res.status} ${await res.text()}`);
  }
}

export default async function handler(req, res) {
  // Vercel Cron передає Authorization: Bearer <CRON_SECRET>
  // Fail closed: відсутній server-side secret ніколи не вимикає захист endpoint.
  if (!CRON_SECRET) {
    console.error('[gdpr-cron] CRON_SECRET is not configured');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  if (req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing env vars' });
  }

  const deadline = Date.now() + 25000;
  let dueUsers;
  try {
    dueUsers = await fetchDueUsers();
  } catch (err) {
    console.error('[gdpr-cron] fetchDueUsers failed:', err.message);
    return res.status(500).json({ error: err.message });
  }

  const results = new Map();

  for (const { id: userId } of dueUsers) {
    if (Date.now() >= deadline) break;
    try {
      const deleted = await hardDeleteData(userId);
      results.set(userId, { userId, status: 'pending', deleted });
    } catch (err) {
      results.set(userId, { userId, status: 'error', error: err.message });
      console.error(`[gdpr-cron] failed for user ${userId}:`, err.message);
    }
  }

  // Always retry this queue, even when the original profiles no longer exist.
  let jobs;
  try { jobs = await fetchCleanupJobs(); }
  catch (err) { return res.status(500).json({ error: err.message }); }
  if (!dueUsers.length && !jobs.length) {
    return res.status(200).json({ deleted: 0, message: 'No users pending deletion' });
  }
  for (const { user_id: userId } of jobs) {
    if (Date.now() >= deadline) break;
    try {
      const done = await processCleanup(userId, deadline);
      results.set(userId, { ...results.get(userId), userId, status: done ? 'ok' : 'pending' });
    } catch (err) {
      results.set(userId, { userId, status: 'error', error: err.message });
      console.error(`[gdpr-cron] cleanup failed for user ${userId}:`, err.message);
    }
  }

  const rows = [...results.values()];
  const ok    = rows.filter(r => r.status === 'ok').length;
  const error = rows.filter(r => r.status === 'error').length;

  return res.status(200).json({ deleted: ok, errors: error, pending: rows.filter(r => r.status === 'pending').length, results: rows });
}
