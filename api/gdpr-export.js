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

  // GDPR Art. 15/20 — export має містити ВСІ персональні дані юзера,
  // включно з health-даними (user_profiles, meals, water, weight_records, user_activities)
  let profile, healthProfile, recipes, cookbooks, meals, water, weekMeals,
      weightRecords, userActivities, streaks, shoppingLists, shoppingItems, gdprRequests,
      scannedCorrections, scannedNameCorrections, pendingUpdates, recipeReports;
  try {
    [profile, healthProfile, recipes, cookbooks, meals, water, weekMeals,
     weightRecords, userActivities, streaks, shoppingLists, shoppingItems, gdprRequests,
     scannedCorrections, scannedNameCorrections, pendingUpdates, recipeReports] = await Promise.all([
      query('profiles', `id=eq.${uid}`, SERVICE_KEY),
      query('user_profiles', uidFilter, SERVICE_KEY),
      query('recipes',  `${uidFilter}&deleted_at=is.null`, SERVICE_KEY),
      query('cookbooks', uidFilter, SERVICE_KEY),
      query('meals', uidFilter, SERVICE_KEY),
      query('water', uidFilter, SERVICE_KEY),
      query('week_meals', uidFilter, SERVICE_KEY),
      query('weight_records', uidFilter, SERVICE_KEY),
      query('user_activities', uidFilter, SERVICE_KEY),
      query('user_streaks', uidFilter, SERVICE_KEY),
      query('shopping_lists', uidFilter, SERVICE_KEY),
      query('shopping_items', uidFilter, SERVICE_KEY),
      query('gdpr_requests', uidFilter, SERVICE_KEY),
      query('scanned_product_corrections', uidFilter, SERVICE_KEY),
      query('scanned_product_name_corrections', uidFilter, SERVICE_KEY),
      query('recipe_pending_updates', uidFilter, SERVICE_KEY),
      query('recipe_reports', uidFilter, SERVICE_KEY),
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
    health_profile: healthProfile[0] || null,
    recipes,
    cookbooks,
    meals,
    water,
    week_meals: weekMeals,
    weight_records: weightRecords,
    activities: userActivities,
    streaks,
    shopping_lists: shoppingLists,
    shopping_items: shoppingItems,
    gdpr_requests: gdprRequests,
    scanned_product_corrections: scannedCorrections,
    scanned_product_name_corrections: scannedNameCorrections,
    recipe_pending_updates: pendingUpdates,
    recipe_reports: recipeReports,
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
