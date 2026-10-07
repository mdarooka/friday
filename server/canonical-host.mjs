// Friday has one public origin. Other hosts permanently redirect there.
// The Hexclave Deploy origin stays in APP_ORIGIN_ALIASES so direct API calls
// (health checks, and the Vercel rewrite that proxies with that Host) keep working.
export const CANONICAL_ORIGIN = 'https://fridaytravel.vercel.app';
export const ROBOTS_NOINDEX = 'noindex, nofollow';

// Planner, staff consoles, the ChatGPT return page, and the share alias.
// Sign-in, email verification, and account screens render on these documents.
export const PRIVATE_PAGES = [
  '/trip', '/trip.html',
  '/app', '/app.html',
  '/admin', '/admin.html',
  '/admin-villas', '/admin-villas.html',
  '/chatgpt-callback.html',
];

// Owner-scoped and staff APIs. Public catalog routes (health, villas, destinations,
// airports, capabilities) stay off this list.
export const PRIVATE_API_PREFIXES = [
  '/api/shared',
  '/api/auth',
  '/api/admin',
  '/api/newsletter/unsubscribe',
  '/api/trips',
  '/api/places',
  '/api/lists',
  '/api/bookings',
  '/api/memories',
  '/api/alerts',
  '/api/imports',
  '/api/profile',
  '/api/research',
  '/api/itineraries',
  '/api/friday',
  '/api/ai-conversations',
  '/api/integrations',
  '/api/callbacks',
  '/api/place-details',
  '/api/place-photo',
];

const PRIVATE_PAGE_SET = new Set(PRIVATE_PAGES);

function matchesPrefix(path, prefix) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function isPrivateSurface(pathname = '/', search = '') {
  const path = String(pathname || '/');
  if (PRIVATE_PAGE_SET.has(path)) return true;
  if (PRIVATE_API_PREFIXES.some(prefix => matchesPrefix(path, prefix))) return true;
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  return params.has('share');
}

export function ensureRobotsMeta(html) {
  const source = String(html);
  const tag = '<meta name="robots" content="noindex, nofollow">';
  if (/<meta\s+name=["']robots["']/i.test(source)) {
    return source.replace(/<meta\s+name=["']robots["'][^>]*>/gi, tag);
  }
  if (/<\/head>/i.test(source)) return source.replace(/<\/head>/i, `${tag}</head>`);
  return source.replace(/<head[^>]*>/i, match => `${match}${tag}`);
}

export function firstHeaderValue(value) {
  return String(value || '').split(',')[0].trim().toLowerCase();
}

export function isLoopbackHost(host) {
  const value = String(host || '').trim().toLowerCase();
  const bare = value.startsWith('[') ? value.slice(1, value.indexOf(']')) : value.replace(/:\d+$/, '');
  return ['localhost', '127.0.0.1', '::1'].includes(bare);
}

// When Vercel rewrites to Hexclave, the connection Host is the Deploy hostname and
// X-Forwarded-Host is the host the visitor typed. Trust that forwarded host only
// in that case. The redirect target is always the canonical origin, never the header.
export function visitorHost({ hostHeader, forwardedHost, trustProxy = false, internalHosts = new Set() }) {
  const connection = firstHeaderValue(hostHeader);
  const forwarded = trustProxy ? firstHeaderValue(forwardedHost) : '';
  const internal = internalHosts instanceof Set ? internalHosts : new Set(internalHosts);
  if (forwarded && internal.has(connection)) return forwarded;
  return connection;
}

export function hostPolicy({ publicHost, canonicalOrigin, internalHosts = new Set(), pathname = '/', search = '', production = false }) {
  const canonical = new URL(canonicalOrigin).origin;
  const canonicalHost = new URL(canonical).host.toLowerCase();
  const host = String(publicHost || '').trim().toLowerCase();
  const internal = internalHosts instanceof Set ? internalHosts : new Set([...internalHosts].map(value => String(value).toLowerCase()));
  const path = pathname === '/index.html' ? '/' : (pathname || '/');
  const location = `${canonical}${path}${search || ''}`;
  if (!production || !host || isLoopbackHost(host) || host === canonicalHost) {
    return { action: 'serve', location: null, robots: null };
  }
  // API on the direct Deploy host is the proxy backend and the platform health check.
  if (internal.has(host) && String(pathname || '').startsWith('/api/')) {
    return { action: 'serve', location: null, robots: 'noindex, nofollow' };
  }
  return { action: 'redirect', location, robots: 'noindex, nofollow' };
}

function rebasePageUrl(value, officialOrigin) {
  const origin = new URL(officialOrigin).origin;
  try {
    const target = new URL(value, origin);
    return `${origin}${target.pathname}${target.search}${target.hash}`;
  } catch {
    return value;
  }
}

function rebaseOwnedAsset(value, officialOrigin) {
  const origin = new URL(officialOrigin).origin;
  try {
    const target = new URL(value, origin);
    const absolute = /^[a-z][a-z0-9+.-]*:/i.test(String(value));
    const owned = !absolute || target.origin === origin || target.hostname === 'fridaytravel.vercel.app' || target.hostname.endsWith('.vercel.app') || target.hostname.endsWith('.deploy.built-with-hexclave.com');
    if (!owned) return value;
    return `${origin}${target.pathname}${target.search}${target.hash}`;
  } catch {
    return value;
  }
}

export function rewritePublicHtml(html, officialOrigin) {
  return String(html)
    .replace(/(<link\s+rel="canonical"\s+href=")([^"]*)(")/gi, (_, before, value, after) => `${before}${rebasePageUrl(value, officialOrigin)}${after}`)
    .replace(/(<meta\s+property="og:url"\s+content=")([^"]*)(")/gi, (_, before, value, after) => `${before}${rebasePageUrl(value, officialOrigin)}${after}`)
    .replace(/(<meta\s+name="twitter:url"\s+content=")([^"]*)(")/gi, (_, before, value, after) => `${before}${rebasePageUrl(value, officialOrigin)}${after}`)
    .replace(/(<meta\s+property="og:image"\s+content=")([^"]*)(")/gi, (_, before, value, after) => `${before}${rebaseOwnedAsset(value, officialOrigin)}${after}`)
    .replace(/(<meta\s+name="twitter:image"\s+content=")([^"]*)(")/gi, (_, before, value, after) => `${before}${rebaseOwnedAsset(value, officialOrigin)}${after}`);
}

export function rewriteSitemapOrigins(xml, officialOrigin) {
  const origin = new URL(officialOrigin).origin;
  return String(xml).replace(/(<loc>)\s*https?:\/\/[^/<]+/gi, `$1${origin}`);
}

export function rewriteRobotsSitemap(text, officialOrigin) {
  const origin = new URL(officialOrigin).origin;
  const directive = `Sitemap: ${origin}/sitemap.xml`;
  const body = String(text);
  if (/^Sitemap:\s+\S+/m.test(body)) return body.replace(/^Sitemap:\s+\S+/m, directive);
  return `${body.trimEnd()}\n${directive}\n`;
}

export function hiddenRobotsTxt(officialOrigin) {
  const origin = new URL(officialOrigin).origin;
  return `User-agent: *\nDisallow: /\nSitemap: ${origin}/sitemap.xml\n`;
}
