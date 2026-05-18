// Vercel Cron — GDPR Hard Delete
// Schedule: щодня о 02:00 UTC (vercel.json)
// Знаходить юзерів з минулим grace period і повністю видаляє їх дані.
//
// Послідовність:
//   1. RPC hard_delete_user_data() — видаляє всі прикладні дані
//   2. Supabase Admin API deleteUser() — видаляє запис auth.users
//
// Вимагає: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY у Vercel env vars.

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SERVICE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET      = process.env.CRON_SECRET;

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

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`fetchDueUsers: ${res.status} ${await res.text()}`);
  return res.json();
}

async function hardDeleteData(userId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/hard_delete_user_data`, {
    method:  'POST',
    headers: HEADERS,
    body:    JSON.stringify({ p_user_id: userId }),
  });
  if (!res.ok) throw new Error(`hard_delete_user_data(${userId}): ${res.status} ${await res.text()}`);
  return res.json();
}

async function deleteAuthUser(userId) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method:  'DELETE',
    headers: HEADERS,
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`deleteAuthUser(${userId}): ${res.status} ${await res.text()}`);
  }
}

export default async function handler(req, res) {
  // Vercel Cron передає Authorization: Bearer <CRON_SECRET>
  if (CRON_SECRET) {
    const auth = (req.headers.authorization || '').replace('Bearer ', '');
    if (auth !== CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing env vars' });
  }

  let dueUsers;
  try {
    dueUsers = await fetchDueUsers();
  } catch (err) {
    console.error('[gdpr-cron] fetchDueUsers failed:', err.message);
    return res.status(500).json({ error: err.message });
  }

  if (!dueUsers.length) {
    return res.status(200).json({ deleted: 0, message: 'No users pending deletion' });
  }

  const results = [];

  for (const { id: userId } of dueUsers) {
    try {
      const deleted = await hardDeleteData(userId);
      await deleteAuthUser(userId);
      results.push({ userId, status: 'ok', deleted });
      console.log(`[gdpr-cron] deleted user ${userId}:`, deleted);
    } catch (err) {
      results.push({ userId, status: 'error', error: err.message });
      console.error(`[gdpr-cron] failed for user ${userId}:`, err.message);
    }
  }

  const ok    = results.filter(r => r.status === 'ok').length;
  const error = results.filter(r => r.status === 'error').length;

  return res.status(200).json({ deleted: ok, errors: error, results });
}
