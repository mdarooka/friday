'use strict';

const CANONICAL_SITE_ORIGIN = 'https://fridaytravel.vercel.app';

function siteOrigin(env = process.env) {
  const configured = String(env.PUBLIC_SITE_ORIGIN || env.APP_ORIGIN || '').trim();
  if (!configured) return CANONICAL_SITE_ORIGIN;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(configured) ? configured : `https://${configured}`);
    if (!['http:', 'https:'].includes(url.protocol)) return CANONICAL_SITE_ORIGIN;
    return url.origin;
  } catch (_) {
    return CANONICAL_SITE_ORIGIN;
  }
}

function publicUrl(path, origin = siteOrigin()) {
  const value = String(path || '').trim();
  const pathname = !value || value === '/' || value.replace(/^\/+/, '') === 'index.html'
    ? '/'
    : `/${value.replace(/^\/+/, '')}`;
  return origin ? `${origin}${pathname}` : pathname;
}

function sitemapXml(pages, origin = siteOrigin()) {
  const escapeXml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const urls = origin ? pages.map(page => `  <url><loc>${escapeXml(publicUrl(page, origin))}</loc></url>`).join('\n') : '';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls ? `\n${urls}\n` : ''}</urlset>\n`;
}

function robotsTxt(origin = siteOrigin()) {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /trip.html',
    'Disallow: /trip',
    'Disallow: /app.html',
    'Disallow: /app',
    'Disallow: /admin.html',
    'Disallow: /admin',
    'Disallow: /admin-villas.html',
    'Disallow: /admin-villas',
    'Disallow: /chatgpt-callback.html',
    'Disallow: /api/',
    'Disallow: /.data/',
    ...(origin ? [`Sitemap: ${publicUrl('sitemap.xml', origin)}`] : []),
    '',
  ].join('\n');
}

module.exports = { CANONICAL_SITE_ORIGIN, siteOrigin, publicUrl, sitemapXml, robotsTxt };
