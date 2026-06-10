// Vercel serverless function — GDPR data export
// Route: GET /api/gdpr-export
// Auth: Bearer token у Authorization header (Supabase JWT)
//
// Повертає JSON з усіма даними юзера.
// Вимагає SUPABASE_SERVICE_ROLE_KEY у Vercel env vars.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xpaibteyntflrixmigfx.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function query(table, filter, serviceKey) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${filter}`;
  const res = await fetch(url, {
    headers: {
      apikey:        serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept:        'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Query failed for "${table}" (${res.status}): ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function verifyJwt(token) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey:        SERVICE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!SERVICE_KEY) {
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = await verifyJwt(token);
  if (!user?.id) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const uid = user.id;
  const uidFilter = `user_id=eq.${uid}`;

  let profile, recipes, cookbooks, gdprRequests;
  try {
    [profile, recipes, cookbooks, gdprRequests] = await Promise.all([
      query('profiles', `id=eq.${uid}`, SERVICE_KEY),
      query('recipes',  `${uidFilter}&deleted_at=is.null`, SERVICE_KEY),
      query('cookbooks', uidFilter, SERVICE_KEY),
      query('gdpr_requests', uidFilter, SERVICE_KEY),
    ]);
  } catch (err) {
    console.error('GDPR export failed:', err);
    // Логуємо невдалу спробу — НЕ віддаємо неповний архів як успіх
    await logRequest(uid, 'failed').catch(() => {});
    return res.status(500).json({ error: 'Export failed. Please try again.' });
  }

  // Логуємо успішний export запит
  await logRequest(uid, 'completed').catch(() => {});

  const exportData = {
    exported_at: new Date().toISOString(),
    user_id: uid,
    email: user.email,
    profile: profile[0] || null,
    recipes,
    cookbooks,
    gdpr_requests: gdprRequests,
  };

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="mintofood-export-${uid.slice(0, 8)}.json"`);
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(exportData);
}

function logRequest(uid, status) {
  return fetch(`${SUPABASE_URL}/rest/v1/gdpr_requests`, {
    method: 'POST',
    headers: {
      apikey:        SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer:         'return=minimal',
    },
    body: JSON.stringify({ user_id: uid, type: 'export', status, completed_at: new Date().toISOString() }),
  });
}
