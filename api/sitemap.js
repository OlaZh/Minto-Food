// Vercel serverless function — генерує динамічний sitemap.xml
// Маршрут: GET /sitemap.xml (via vercel.json rewrite)

const SUPABASE_URL  = process.env.SUPABASE_URL  || 'https://xpaibteyntflrixmigfx.supabase.co';
const SUPABASE_KEY  = process.env.SUPABASE_ANON_KEY || 'sb_publishable_5aziCmaq0rxAJ24MznPycw_eY5iVZxZ';
const SITE_BASE     = process.env.SITE_BASE || 'https://mintofood.com';
const LANGS         = ['uk', 'en', 'pl'];

const STATIC_PAGES = [
  { path: '/',                  priority: '1.0', changefreq: 'weekly'  },
  { path: '/recipes.html',      priority: '0.9', changefreq: 'daily'   },
  { path: '/product-guide.html',priority: '0.7', changefreq: 'weekly'  },
];

function xmlEsc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toW3CDate(iso) {
  if (!iso) return new Date().toISOString().slice(0, 10);
  return iso.slice(0, 10);
}

export default async function handler(req, res) {
  try {
    // Fetch all published, non-deleted recipes with slug
    const apiUrl = `${SUPABASE_URL}/rest/v1/recipes?select=slug,updated_at&status=eq.published&deleted_at=is.null&slug=not.is.null&order=updated_at.desc`;

    const response = await fetch(apiUrl, {
      headers: {
        apikey:        SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Accept:        'application/json',
      },
    });

    const recipes = response.ok ? await response.json() : [];

    const urlEntries = [];

    // Static pages with hreflang alternates
    for (const page of STATIC_PAGES) {
      const url = `${SITE_BASE}${page.path}`;
      const alternates = LANGS.map(
        lang => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${xmlEsc(url)}?lang=${lang}"/>`
      ).join('\n');

      urlEntries.push(`  <url>
    <loc>${xmlEsc(url)}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
${alternates}
  </url>`);
    }

    // Recipe pages with hreflang alternates
    for (const recipe of recipes) {
      if (!recipe.slug) continue;
      const base = `${SITE_BASE}/recipe/${xmlEsc(recipe.slug)}`;
      const lastmod = toW3CDate(recipe.updated_at);

      const alternates = LANGS.map(
        lang => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${base}?lang=${lang}"/>`
      ).join('\n');

      urlEntries.push(`  <url>
    <loc>${base}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
${alternates}
  </url>`);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlEntries.join('\n')}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    // Cache 1 hour on CDN, revalidate in background
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).send(xml);
  } catch (err) {
    res.status(500).send(`<?xml version="1.0"?><error>${xmlEsc(err.message)}</error>`);
  }
}
