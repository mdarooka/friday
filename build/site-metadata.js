'use strict';

function siteOrigin(env = process.env) {
  const configured = env.PUBLIC_SITE_ORIGIN || env.APP_ORIGIN ||
    (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` :
      env.VERCEL_URL ? `https://${env.VERCEL_URL}` : 'https://fridaytravel.vercel.app');
  if (!configured) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(configured) ? configured : `https://${configured}`);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.origin;
  } catch (_) {
    return null;
  }
}

function publicUrl(path, origin = siteOrigin()) {
  const cleanPath = String(path || '').replace(/^\/+/, '');
  return origin ? `${origin}/${cleanPath}` : cleanPath;
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
    'Disallow: /api/',
    'Disallow: /.data/',
    ...(origin ? [`Sitemap: ${publicUrl('sitemap.xml', origin)}`] : []),
    '',
  ].join('\n');
}

module.exports = { siteOrigin, publicUrl, sitemapXml, robotsTxt };
