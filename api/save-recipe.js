// Vercel serverless function — save a recipe WITH inseparable image moderation.
// Route: POST /api/save-recipe
// Auth:  Bearer token (Supabase JWT) in Authorization header
//
// Why server-side: moderation must score the EXACT photo that gets persisted.
// If the client saved the recipe and then called a separate "moderate this id"
// endpoint, it could pass a clean photo with a dirty recipe's id and forge a
// safe score. Here the score and the write happen together, server-side, so
// they cannot be decoupled.
//
// This endpoint owns ONLY the recipe row + moderation. Ingredients, cookbooks
// and the unmatched-terms queue stay on the client (they don't touch the photo
// or the score, and their RLS already works). The client calls this first, then
// wires up ingredients/books against the returned recipe id.
//
// Body:
//   {
//     recipe: { name_ua, kcal, protein, fat, carbs, fiber, total_weight,
//               category, ingredients, steps, image },
//     editingRecipeId: string | null,
//     isPublicSubmission: boolean,
//     imageIsNew: boolean            // moderate only a freshly chosen photo
//   }
// Reply: { recipe, flagged, score, provider }
//
// SECURITY: the service role bypasses RLS, so THIS function re-implements the
// ownership checks RLS used to enforce — user_id is forced to the JWT subject,
// and edits are constrained to rows the caller owns.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xpaibteyntflrixmigfx.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Roadmap said "> 0.8"; we flag at ">= threshold" — the stricter reading, so a
// borderline photo scoring exactly 0.8 is queued rather than auto-published.
const NSFW_THRESHOLD = Number(process.env.IMAGE_NSFW_THRESHOLD || '0.8');
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

// Rate limit on provider calls per user, to protect the moderation quota from a
// single authenticated abuser. Over the limit we DON'T call the provider — the
// recipe is still queued (status pending + flagged) for a human to review, so
// nothing NSFW slips through; we just stop burning paid API calls.
const MODERATION_RATE_LIMIT = Number(process.env.IMAGE_MOD_RATE_PER_HOUR || '20');

// Only these recipe fields are accepted from the client; everything else
// (user_id, status, moderation columns) is decided here.
const ALLOWED_FIELDS = [
  'name_ua', 'kcal', 'protein', 'fat', 'carbs', 'fiber',
  'total_weight', 'category', 'ingredients', 'steps', 'image',
];

// Fields that require re-moderation when an already-published recipe is edited
// (mirrors the client's previous moderatedFields list).
const MODERATED_EDIT_FIELDS = ['image', 'steps', 'name_ua'];

// recipes.id is an integer. Accept number or numeric string; anything else → null.
function normalizeRecipeId(v) {
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  if (typeof v === 'string' && /^\d+$/.test(v)) return Number(v);
  return null;
}

async function verifyJwt(token) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

// Thin REST helpers (service role).
async function rest(method, path, body, extraHeaders = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey:         SERVICE_KEY,
      Authorization:  `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`${method} ${path} (${res.status}): ${text.slice(0, 200)}`);
  }
  return data;
}

// ── Image moderation ────────────────────────────────────────────────────────

function decodeDataUri(dataUri) {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUri);
  if (!match) throw new Error('invalid data URI');
  return { bytes: Buffer.from(match[2], 'base64'), mime: match[1] };
}

async function moderateWithSightengine(image) {
  const user = process.env.SIGHTENGINE_USER;
  const secret = process.env.SIGHTENGINE_SECRET;

  let res;
  if (/^https?:\/\//i.test(image)) {
    const params = new URLSearchParams({
      models: 'nudity-2.1', api_user: user, api_secret: secret, url: image,
    });
    res = await fetch(`https://api.sightengine.com/1.0/check.json?${params}`);
  } else {
    const { bytes, mime } = decodeDataUri(image);
    const form = new FormData();
    form.set('models', 'nudity-2.1');
    form.set('api_user', user);
    form.set('api_secret', secret);
    form.set('media', new Blob([bytes], { type: mime }), 'upload');
    res = await fetch('https://api.sightengine.com/1.0/check.json', { method: 'POST', body: form });
  }

  const data = await res.json();
  if (data.status !== 'success') {
    throw new Error(`sightengine: ${data.error?.message || 'unknown error'}`);
  }
  const n = data.nudity || {};
  const score = Math.max(
    n.sexual_activity ?? 0,
    n.sexual_display ?? 0,
    n.erotica ?? 0,
    (n.very_suggestive ?? 0) * 0.6,
  );
  return { score, provider: 'sightengine', raw: { nudity: n } };
}

function pickProvider() {
  if (process.env.SIGHTENGINE_USER && process.env.SIGHTENGINE_SECRET) {
    return moderateWithSightengine;
  }
  return async () => ({ score: 0, provider: 'stub', raw: { note: 'no provider configured' } });
}

// Validate + score a photo. Returns { flagged, score, provider, raw }.
// Fails OPEN (flagged:false) on provider error — a moderation outage must not
// block saving — but records the error decision for audit.
async function scoreImage(image) {
  if (typeof image !== 'string' || !image.trim()) {
    return { flagged: false, score: null, provider: 'none', raw: null };
  }
  if (image.startsWith('data:')) {
    // Must be a real base64 image with a non-empty payload.
    const m = /^data:image\/[a-z0-9.+-]+;base64,([a-z0-9+/=\s]+)$/i.exec(image);
    if (!m || m[1].replace(/\s/g, '').length < 16) {
      return { flagged: false, score: null, provider: 'invalid', raw: { note: 'unscorable data URI' } };
    }
    if (image.length * 0.75 > MAX_IMAGE_BYTES) {
      const err = new Error('image too large');
      err.tooLarge = true;
      throw err;
    }
  } else if (!/^https?:\/\//i.test(image)) {
    // A non-empty value that is neither a data URI nor an http(s) URL is not a
    // real image — mark it 'invalid' so the handler rejects it (we won't store
    // a "photo" we cannot moderate). (Empty values never reach here — the
    // handler only scores a non-empty new photo.)
    return { flagged: false, score: null, provider: 'invalid', raw: { note: 'not an image (neither data URI nor URL)' } };
  }

  const provider = pickProvider();
  const result = await provider(image);
  const flagged = typeof result.score === 'number' && result.score >= NSFW_THRESHOLD;
  return { flagged, score: result.score, provider: result.provider, raw: result.raw };
}

function logDecision(uid, recipeId, provider, score, decision, raw) {
  return rest('POST', 'image_moderation_log', {
    recipe_id: recipeId, user_id: uid, provider, nsfw_score: score, decision, raw,
  }, { Prefer: 'return=minimal' }).catch(() => { /* best-effort */ });
}

// Atomically reserve a provider-call slot for this user via the advisory-locked
// RPC. Returns:
//   * a reservation id (uuid) — a slot was taken; caller may call the provider
//   * null                    — user is over the hourly limit; caller queues
//   * 'unreserved' sentinel   — the RPC itself errored (should be rare once
//                               grants are in place). We fail OPEN on scoring so
//                               a transient DB fault doesn't break moderation
//                               entirely; the limit is momentarily not enforced.
//                               (Note: this is only "rare" because service_role
//                               HAS execute on the RPC — see the GRANTs in the
//                               migration; without them it would ALWAYS land
//                               here and the limit would never apply.)
async function reserveSlot(uid) {
  try {
    const out = await rest('POST', 'rpc/reserve_moderation_slot',
      { p_user_id: uid, p_limit: MODERATION_RATE_LIMIT });
    return out || null;
  } catch (err) {
    console.error('reserve_moderation_slot failed:', err);
    return 'unreserved';
  }
}

function finalizeReservation(reservation, recipeId, provider, score, decision, raw) {
  if (!reservation || reservation === 'unreserved') {
    return logDecision(null, recipeId, provider, score, decision, raw);
  }
  return rest('POST', 'rpc/finalize_moderation_slot', {
    p_reservation: reservation, p_recipe_id: recipeId,
    p_provider: provider, p_score: score, p_decision: decision, p_raw: raw ?? null,
  }, { Prefer: 'return=minimal' }).catch((err) => console.error('finalize_moderation_slot failed:', err));
}

// Release a reserved slot when the request aborts before saving (invalid/too
// large) — rewrite it as a terminal error row so it still counts as usage but
// carries no recipe.
function releaseReservation(reservation, decision, note) {
  if (!reservation || reservation === 'unreserved') return Promise.resolve();
  return rest('POST', 'rpc/finalize_moderation_slot', {
    p_reservation: reservation, p_recipe_id: null,
    p_provider: 'error', p_score: null, p_decision: decision, p_raw: { note },
  }, { Prefer: 'return=minimal' }).catch(() => {});
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SERVICE_KEY) return res.status(500).json({ error: 'Server misconfiguration' });

  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const user = await verifyJwt(token);
  if (!user?.id) return res.status(401).json({ error: 'Invalid token' });
  const uid = user.id;

  const inRecipe = req.body?.recipe;
  if (!inRecipe || typeof inRecipe !== 'object') {
    return res.status(400).json({ error: 'Missing recipe' });
  }
  const editingRecipeId = normalizeRecipeId(req.body?.editingRecipeId);
  const isPublicSubmission = req.body?.isPublicSubmission === true;

  // Whitelist fields; never trust client-sent user_id/status/moderation columns.
  const fields = {};
  for (const k of ALLOWED_FIELDS) if (k in inRecipe) fields[k] = inRecipe[k];

  // Server-side public validation (never rely on the client having done it).
  if (isPublicSubmission) {
    const name = (fields.name_ua || '').trim();
    const hasIngredients = !!(fields.ingredients || '').trim();
    const hasSteps = !!(fields.steps || '').trim();
    if (!name) return res.status(400).json({ error: 'name_required' });
    if (!hasIngredients && !hasSteps) return res.status(400).json({ error: 'content_required' });
  }

  // Ownership: on edit the row must belong to the caller.
  let original = null;
  if (editingRecipeId !== null) {
    const rows = await rest('GET', `recipes?id=eq.${editingRecipeId}&select=*`);
    original = rows?.[0] || null;
    if (!original) return res.status(404).json({ error: 'not_found' });
    if (original.user_id !== uid) return res.status(403).json({ error: 'forbidden' });
  }

  // The SERVER decides whether the photo is new — never trust the client. A
  // create with a photo is new; an edit is new iff the photo differs from the
  // stored one. This closes the "imageIsNew:false" bypass.
  const newPhoto = (fields.image ?? '').trim();
  const imageIsNew = editingRecipeId === null
    ? newPhoto.length > 0
    : newPhoto !== ((original.image ?? '').trim());

  // Shadow-banned authors always go to the queue.
  const profile = (await rest('GET', `profiles?id=eq.${uid}&select=is_shadow_banned`))?.[0];
  const isShadowBanned = profile?.is_shadow_banned === true;

  // Moderate the EXACT photo we are about to persist.
  // `reservation` holds an atomically-reserved rate-limit slot (a pre-written
  // log row) that we finalize with the real decision after scoring.
  let moderation = { flagged: false, score: null, provider: 'skip', raw: null };
  let reservation = null;
  if (imageIsNew && newPhoto) {
    reservation = await reserveSlot(uid);
    if (!reservation) {
      // Over the per-user hourly limit — don't call the provider. Queue for
      // manual review so nothing NSFW slips through; just stop burning quota.
      moderation = { flagged: true, score: null, provider: 'rate_limited', raw: { note: 'moderation rate limit; queued for manual review' } };
    } else {
      try {
        moderation = await scoreImage(fields.image);
      } catch (err) {
        if (err.tooLarge) { await releaseReservation(reservation, 'error', 'too_large'); return res.status(413).json({ error: 'image_too_large' }); }
        console.error('Image moderation failed:', err);
        moderation = { flagged: false, score: null, provider: 'error', raw: { message: String(err).slice(0, 200) } };
      }
      // An unscorable image (garbage data URI) is rejected — we won't store a
      // photo we cannot moderate. Release the reserved slot first.
      if (moderation.provider === 'invalid') {
        await releaseReservation(reservation, 'error', 'invalid');
        return res.status(400).json({ error: 'invalid_image' });
      }
    }
  }

  const moderationCols = imageIsNew
    ? {
        is_image_flagged: moderation.flagged,
        image_nsfw_score: moderation.score,
        image_moderated_at: new Date().toISOString(),
      }
    : {}; // unchanged photo → leave existing moderation state untouched

  try {
    let saved;
    const stageInfo = { staged: false };

    if (editingRecipeId === null) {
      // ── Create ── status is decided here, never taken from the client.
      const status = (isShadowBanned || isPublicSubmission) ? 'pending' : 'draft';
      const row = { ...fields, user_id: uid, status, is_public: isPublicSubmission, ...moderationCols };
      saved = (await rest('POST', 'recipes', row, { Prefer: 'return=representation' }))?.[0];
    } else if (original.status === 'published') {
      // ── Edit of a published recipe: moderated fields are STAGED ──
      // The live recipe stays published (unless switched to private, below);
      // moderated changes go to recipe_pending_updates for review.
      const direct = {};
      const pending = {};
      for (const k of Object.keys(fields)) {
        if (MODERATED_EDIT_FIELDS.includes(k)) {
          const changed = fields[k] !== original[k] && !(fields[k] == null && original[k] == null);
          if (changed) pending[k] = fields[k];
        } else {
          direct[k] = fields[k];
        }
      }
      direct.is_public = isPublicSubmission;
      // Switching a published recipe to private un-publishes it immediately.
      if (!isPublicSubmission) direct.status = 'draft';

      await rest('POST', 'rpc/stage_recipe_update', {
        p_recipe_id: editingRecipeId,
        p_user_id: uid,
        p_direct: direct,
        p_pending: pending,
        p_image_flagged: imageIsNew && 'image' in pending ? moderation.flagged : false,
        p_image_score: imageIsNew && 'image' in pending ? moderation.score : null,
      }, { Prefer: 'return=minimal' });

      stageInfo.staged = 'image' in pending;
      saved = (await rest('GET', `recipes?id=eq.${editingRecipeId}&select=*`))?.[0];
    } else {
      // ── Edit of a draft/pending recipe: write through, recompute status ──
      const status = (isShadowBanned || isPublicSubmission) ? 'pending' : 'draft';
      const row = { ...fields, is_public: isPublicSubmission, status, ...moderationCols };
      saved = (await rest('PATCH', `recipes?id=eq.${editingRecipeId}&user_id=eq.${uid}`, row, { Prefer: 'return=representation' }))?.[0];
    }

    // Audit the decision (recipe id known now).
    if (imageIsNew && saved?.id) {
      const decision = moderation.provider === 'error' ? 'error' : (moderation.flagged ? 'flagged' : 'approved');
      if (reservation) {
        // Rewrite the reserved slot with the final decision.
        await finalizeReservation(reservation, saved.id, moderation.provider, moderation.score, decision, moderation.raw);
      } else {
        // No reservation was taken (rate-limited / skip) — write a fresh row.
        await logDecision(uid, saved.id, moderation.provider, moderation.score, decision, moderation.raw);
      }
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      recipe: saved,
      flagged: moderation.flagged,
      score: moderation.score,
      provider: moderation.provider,
      staged: stageInfo.staged,
    });
  } catch (err) {
    console.error('save-recipe failed:', err);
    return res.status(500).json({ error: 'save_failed' });
  }
}
