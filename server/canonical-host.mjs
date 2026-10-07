// Friday has one public origin. Other hosts permanently redirect there.
// The Hexclave Deploy origin stays in APP_ORIGIN_ALIASES so direct API calls
// (health checks, and the Vercel rewrite that proxies with that Host) keep working.
export const CANONICAL_ORIGIN = 'https://fridaytravel.vercel.app';

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
