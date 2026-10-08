import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ensureRobotsMeta, hostPolicy, isPrivateSurface, isPublicProxyRequest, PROXY_HEADER, PRIVATE_API_PREFIXES, PRIVATE_PAGES, rewritePublicHtml, rewriteRobotsSitemap, rewriteSitemapOrigins, hiddenRobotsTxt, visitorHost } from '../server/canonical-host.mjs';
import { startApp } from './helpers.mjs';

const canonical = 'https://fridaytravel.vercel.app';
const deploy = 'https://deploy.example';
const internalHosts = new Set(['deploy.example']);

function raw(server, url, headers = {}, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: url, method, headers }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('host policy redirects public aliases and keeps internal API on the deploy host', () => {
  const base = { canonicalOrigin: canonical, internalHosts, production: true };
  assert.deepEqual(hostPolicy({ ...base, publicHost: 'fridaytravel.vercel.app', pathname: '/about.html' }), { action: 'serve', location: null, robots: null });
  assert.deepEqual(hostPolicy({ ...base, publicHost: 'friday-travel-peach.vercel.app', pathname: '/kerala-guide.html', search: '?x=1' }).location, 'https://fridaytravel.vercel.app/kerala-guide.html?x=1');
  assert.equal(hostPolicy({ ...base, publicHost: 'preview-abc.vercel.app', pathname: '/api/health' }).action, 'redirect');
  assert.equal(hostPolicy({ ...base, publicHost: 'deploy.example', pathname: '/api/health' }).action, 'serve');
  assert.equal(hostPolicy({ ...base, publicHost: 'deploy.example', pathname: '/api/health' }).robots, 'noindex, nofollow');
  assert.equal(hostPolicy({ ...base, publicHost: 'deploy.example', pathname: '/index.html', search: '?from=direct' }).location, 'https://fridaytravel.vercel.app/?from=direct');
  assert.equal(hostPolicy({ ...base, publicHost: '127.0.0.1:9', pathname: '/about.html', production: true }).action, 'serve');
  assert.equal(hostPolicy({ ...base, publicHost: 'friday-travel-peach.vercel.app', pathname: '/', production: false }).action, 'serve');
  assert.equal(visitorHost({ hostHeader: 'deploy.example', forwardedHost: 'fridaytravel.vercel.app', trustProxy: true, internalHosts }), 'fridaytravel.vercel.app');
  assert.equal(visitorHost({ hostHeader: 'deploy.example', forwardedHost: 'friday-travel-peach.vercel.app, deploy.example', trustProxy: true, internalHosts }), 'friday-travel-peach.vercel.app');
  assert.equal(visitorHost({ hostHeader: 'fridaytravel.vercel.app', forwardedHost: 'evil.example', trustProxy: true, internalHosts }), 'fridaytravel.vercel.app');
  assert.equal(visitorHost({ hostHeader: 'deploy.example', forwardedHost: 'fridaytravel.vercel.app', trustProxy: false, internalHosts }), 'deploy.example');
});

test('served metadata is rebased onto the configured origin and external images stay put', () => {
  const html = rewritePublicHtml('<link rel="canonical" href="about.html"><meta property="og:url" content="https://friday-travel-peach.vercel.app/about.html"><meta property="og:image" content="https://friday-travel-peach.vercel.app/assets/images/friday-social.jpg"><meta property="og:image" content="https://images.example/garden.jpg"><meta name="twitter:image" content="assets/images/friday-social.jpg">', canonical);
  assert.match(html, /rel="canonical" href="https:\/\/fridaytravel\.vercel\.app\/about\.html"/);
  assert.match(html, /property="og:url" content="https:\/\/fridaytravel\.vercel\.app\/about\.html"/);
  assert.match(html, /property="og:image" content="https:\/\/fridaytravel\.vercel\.app\/assets\/images\/friday-social\.jpg"/);
  assert.match(html, /property="og:image" content="https:\/\/images\.example\/garden\.jpg"/);
  assert.match(html, /name="twitter:image" content="https:\/\/fridaytravel\.vercel\.app\/assets\/images\/friday-social\.jpg"/);
  assert.match(rewriteSitemapOrigins('<loc>https://friday-travel-peach.vercel.app/about.html</loc>', canonical), /<loc>https:\/\/fridaytravel\.vercel\.app\/about\.html<\/loc>/);
  assert.match(rewriteRobotsSitemap('User-agent: *\nAllow: /\n', canonical), /Sitemap: https:\/\/fridaytravel\.vercel\.app\/sitemap\.xml/);
  assert.equal(hiddenRobotsTxt(canonical), 'User-agent: *\nDisallow: /\nSitemap: https://fridaytravel.vercel.app/sitemap.xml\n');
});

test('vercel proxy redirects every non-canonical host, noindexes private paths, and signs proxied requests', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const routes = config.routes;
  for (const legacyOnly of ['redirects', 'rewrites', 'headers']) assert.equal(config[legacyOnly], undefined, `${legacyOnly} cannot be combined with routes`);
  const hostRedirect = routes[0];
  const pattern = new RegExp(hostRedirect.has[0].value);
  assert.equal(hostRedirect.status, 308);
  assert.equal(hostRedirect.headers.Location, 'https://fridaytravel.vercel.app/$1');
  assert.match(hostRedirect.headers['X-Robots-Tag'], /noindex/);
  assert.equal(pattern.test('fridaytravel.vercel.app'), false);
  assert.equal(pattern.test('friday-travel-peach.vercel.app'), true);
  assert.equal(pattern.test('friday-travel-git-main-user.vercel.app'), true);
  assert.equal(routes[1].headers.Location, 'https://fridaytravel.vercel.app/');
  assert.equal(new RegExp(routes[1].src).test('/index.html'), true);

  const proxy = routes.at(-1);
  assert.equal(proxy.dest.includes('deploy.built-with-hexclave.com'), true);
  assert.deepEqual(proxy.transforms, [{ type: 'request.headers', op: 'set', target: { key: PROXY_HEADER }, args: '$FRIDAY_PROXY_SECRET', env: ['FRIDAY_PROXY_SECRET'] }]);

  const pathRules = routes.slice(2, -1);
  for (const rule of pathRules) {
    assert.equal(rule.continue, true, rule.src);
    assert.equal(rule.headers['X-Robots-Tag'], 'noindex, nofollow', rule.src);
  }
  const covers = path => pathRules.some(rule => new RegExp(rule.src).test(path));
  const publicPaths = ['/', '/index.html', '/about.html', '/kerala-guide.html', '/field-notes.html', '/privacy.html', '/terms.html', '/api/health', '/api/villas', '/api/destinations', '/api/airports', '/api/capabilities', '/api/tripsx'];
  for (const path of publicPaths) assert.equal(covers(path), false, `${path} must not be noindexed`);
  for (const path of [...PRIVATE_PAGES, ...PRIVATE_API_PREFIXES]) {
    assert.equal(covers(path), true, path);
    if (path.startsWith('/api/')) assert.equal(covers(`${path}/abc`), true, `${path}/abc`);
  }
});

test('public pages canonicalize to fridaytravel.vercel.app and private pages do not', async () => {
  const publicPages = ['index.html', 'about.html', 'help.html', 'contact.html', 'partner.html', 'departures.html', 'villas.html', 'villa.html', 'kerala-guide.html', 'field-notes.html', 'privacy.html', 'terms.html'];
  const canonicalUrls = [];
  for (const file of publicPages) {
    const html = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(html, /<meta\s+name="robots"/i, file);
    const links = [...html.matchAll(/<link rel="canonical" href="([^"]+)">/g)].map(match => match[1]);
    assert.equal(links.length, 1, file);
    const expected = file === 'index.html' ? `${canonical}/` : `${canonical}/${file}`;
    assert.equal(links[0], expected, file);
    assert.match(html, new RegExp(`<meta property="og:url" content="${expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">`));
    assert.match(html, /<meta property="og:image" content="https:\/\/fridaytravel\.vercel\.app\/assets\/images\/[^\"]+">/);
    assert.match(html, /<meta name="twitter:image" content="https:\/\/fridaytravel\.vercel\.app\/assets\/images\/[^\"]+">/);
    assert.doesNotMatch(html, /friday-travel-peach/);
    canonicalUrls.push(links[0]);
  }
  for (const file of ['trip.html', 'app.html', 'admin.html', 'admin-villas.html', 'chatgpt-callback.html']) {
    const html = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(html, /<link rel="canonical"/i, file);
    assert.match(html, /<meta name="robots" content="noindex, nofollow">/, file);
  }
  const robots = await readFile(new URL('../robots.txt', import.meta.url), 'utf8');
  for (const path of ['/trip.html', '/app.html', '/admin.html', '/admin-villas.html', '/chatgpt-callback.html', '/api/']) {
    assert.match(robots, new RegExp(`Disallow: ${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  }
  const moved = await readFile(new URL('../salon.html', import.meta.url), 'utf8');
  assert.match(moved, /<link rel="canonical" href="https:\/\/fridaytravel\.vercel\.app\/departures\.html">/);
  const sitemap = await readFile(new URL('../sitemap.xml', import.meta.url), 'utf8');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  for (const url of canonicalUrls) assert.ok(urls.includes(url), url);
  assert.doesNotMatch(sitemap, /peach/);
});

test('private surfaces include planner, staff, share, and owner routes', () => {
  for (const path of PRIVATE_PAGES) assert.equal(isPrivateSurface(path), true, path);
  for (const path of ['/api/shared/abc', '/api/auth/signup', '/api/admin/status', '/api/trips/1/share', '/api/profile', '/api/newsletter/unsubscribe', '/api/itineraries', '/api/friday/plan']) {
    assert.equal(isPrivateSurface(path), true, path);
  }
  assert.equal(isPrivateSurface('/about.html', '?share=abc'), true);
  assert.equal(isPrivateSurface('/kerala-guide.html'), false);
  assert.equal(isPrivateSurface('/field-notes.html'), false);
  assert.equal(isPrivateSurface('/privacy.html'), false);
  assert.equal(isPrivateSurface('/terms.html'), false);
  assert.equal(isPrivateSurface('/api/health'), false);
  assert.equal(isPrivateSurface('/api/villas'), false);
  assert.equal(isPrivateSurface('/api/villas/11111111-1111-1111-1111-111111111111'), false);
  assert.equal(isPrivateSurface('/api/destinations'), false);
  assert.equal(isPrivateSurface('/api/airports'), false);
  assert.equal(isPrivateSurface('/api/capabilities'), false);
  assert.equal(ensureRobotsMeta('<head><meta name="robots" content="noindex"></head>'), '<head><meta name="robots" content="noindex, nofollow"></head>');
  assert.match(ensureRobotsMeta('<head><title>Friday</title></head>'), /<meta name="robots" content="noindex, nofollow"><\/head>/);
});

test('production redirects non-canonical hosts, noindexes only those responses, and keeps deploy API', async (t) => {
  const { server, request } = await startApp(t, {
    origin: canonical,
    env: {
      NODE_ENV: 'production',
      APP_ORIGIN: canonical,
      APP_ORIGIN_ALIASES: deploy,
      HEXCLAVE_INTERNAL_HOST: 'hxc-p-81-we-5b6199efcb56de4167.fly.dev',
      TRUST_PROXY: '1',
      SEARCH_INDEXING: 'on',
      AUTH_PROVIDER: 'local',
    },
  });
  const robotsTxt = await raw(server, '/robots.txt', { host: 'fridaytravel.vercel.app' });
  assert.equal(robotsTxt.status, 200);
  assert.doesNotMatch(robotsTxt.body, /Disallow: \/\n/);
  assert.match(robotsTxt.body, /Disallow: \/api\//);

  const page = await raw(server, '/kerala-guide.html', { host: 'fridaytravel.vercel.app' });
  assert.equal(page.status, 200);
  assert.equal(page.headers['x-robots-tag'], undefined);
  assert.match(page.body, /<link rel="canonical" href="https:\/\/fridaytravel\.vercel\.app\/kerala-guide\.html">/);

  const peach = await raw(server, '/kerala-guide.html?source=peach', { host: 'friday-travel-peach.vercel.app' });
  assert.equal(peach.status, 308);
  assert.equal(peach.headers.location, 'https://fridaytravel.vercel.app/kerala-guide.html?source=peach');
  assert.equal(peach.headers['x-robots-tag'], 'noindex, nofollow');

  const peachPost = await raw(server, '/api/auth/signup', { host: 'friday-travel-peach.vercel.app', 'content-type': 'application/json' }, 'POST');
  assert.equal(peachPost.status, 308);
  assert.equal(peachPost.headers.location, 'https://fridaytravel.vercel.app/api/auth/signup');

  const preview = await raw(server, '/villas.html', { host: 'friday-travel-git-main-user.vercel.app' });
  assert.equal(preview.status, 308);
  assert.equal(preview.headers.location, 'https://fridaytravel.vercel.app/villas.html');

  const directPage = await raw(server, '/about.html?from=deploy', { host: 'deploy.example' });
  assert.equal(directPage.status, 308);
  assert.equal(directPage.headers.location, 'https://fridaytravel.vercel.app/about.html?from=deploy');
  assert.equal(directPage.headers['x-robots-tag'], 'noindex, nofollow');

  const health = await raw(server, '/api/health', { host: 'deploy.example' });
  assert.equal(health.status, 200);
  assert.equal(health.headers['x-robots-tag'], 'noindex, nofollow');
  assert.match(health.body, /"ok":true/);

  const proxied = await raw(server, '/about.html', { host: 'deploy.example', 'x-forwarded-host': 'fridaytravel.vercel.app' });
  assert.equal(proxied.status, 200);
  assert.equal(proxied.headers['x-robots-tag'], undefined);
  assert.match(proxied.body, /<link rel="canonical" href="https:\/\/fridaytravel\.vercel\.app\/about\.html">/);

  const flyProxied = await raw(server, '/about.html', { host: 'hxc-p-81-we-5b6199efcb56de4167.fly.dev', 'x-forwarded-host': 'deploy.example' });
  assert.equal(flyProxied.status, 200);
  assert.match(flyProxied.body, /<link rel="canonical" href="https:\/\/fridaytravel\.vercel\.app\/about\.html">/);

  const proxiedPeach = await raw(server, '/help.html?via=proxy', { host: 'deploy.example', 'x-forwarded-host': 'friday-travel-peach.vercel.app' });
  assert.equal(proxiedPeach.status, 308);
  assert.equal(proxiedPeach.headers.location, 'https://fridaytravel.vercel.app/help.html?via=proxy');

  const home = await raw(server, '/index.html?src=legacy', { host: 'fridaytravel.vercel.app' });
  assert.equal(home.status, 308);
  assert.equal(home.headers.location, '/?src=legacy');
  assert.equal(home.headers['x-robots-tag'], undefined);

  const robotsMeta = '<meta name="robots" content="noindex, nofollow">';
  for (const path of ['/trip.html', '/app.html', '/admin.html', '/admin-villas.html', '/chatgpt-callback.html']) {
    const privatePage = await raw(server, path, { host: 'fridaytravel.vercel.app' });
    assert.equal(privatePage.status, 200, path);
    assert.equal(privatePage.headers['x-robots-tag'], 'noindex, nofollow', path);
    assert.match(privatePage.body, new RegExp(robotsMeta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), path);
  }
  for (const path of ['/field-notes.html', '/privacy.html', '/terms.html', '/about.html']) {
    const publicPage = await raw(server, path, { host: 'fridaytravel.vercel.app' });
    assert.equal(publicPage.status, 200, path);
    assert.equal(publicPage.headers['x-robots-tag'], undefined, path);
    assert.doesNotMatch(publicPage.body, /<meta\s+name="robots"/i, path);
  }
  for (const path of ['/api/health', '/api/villas', '/api/destinations', '/api/airports', '/api/capabilities']) {
    const catalog = await raw(server, path, { host: 'fridaytravel.vercel.app' });
    assert.equal(catalog.status, 200, path);
    assert.equal(catalog.headers['x-robots-tag'], undefined, path);
  }
  for (const path of ['/api/auth/me', '/api/admin/status', '/api/trips', '/api/profile']) {
    const owned = await raw(server, path, { host: 'fridaytravel.vercel.app' });
    assert.equal(owned.headers['x-robots-tag'], 'noindex, nofollow', path);
  }
  const aliasedTrip = await raw(server, '/trip.html?share=abc', { host: 'friday-travel-peach.vercel.app' });
  assert.equal(aliasedTrip.status, 308);
  assert.equal(aliasedTrip.headers['x-robots-tag'], 'noindex, nofollow');

  const account = name => ({ name, email: `${name}@example.com`, password: 'long test password 123' });
  const signedUp = await request('/api/auth/signup', 'POST', account('Canonical'), { headers: { Origin: canonical } });
  assert.equal(signedUp.status, 200);
  const trip = await request('/api/trips', 'POST', { data: { title: 'Kyoto', destination: 'Japan', days: [{ title: 'Temple', items: [{ title: 'Garden' }] }] } }, { cookie: signedUp.cookie, headers: { Origin: canonical } });
  assert.equal(trip.status, 201);
  const created = await request(`/api/trips/${trip.result.record.id}/share`, 'POST', {}, { cookie: signedUp.cookie, headers: { Origin: canonical } });
  assert.equal(created.status, 201);
  const token = new URL(created.result.share.url, canonical).searchParams.get('share');
  const sharedPage = await raw(server, `/app.html?share=${token}`, { host: 'fridaytravel.vercel.app', 'user-agent': 'Friday trip visitor' });
  assert.equal(sharedPage.status, 200);
  assert.equal(sharedPage.headers['x-robots-tag'], 'noindex, nofollow');
  assert.match(sharedPage.body, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(sharedPage.body, /property="og:title" content="Kyoto · a Friday itinerary"/);
  const sharedJson = await raw(server, `/api/shared/${token}`, { host: 'fridaytravel.vercel.app' });
  assert.equal(sharedJson.status, 200);
  assert.equal(sharedJson.headers['x-robots-tag'], 'noindex, nofollow');
  assert.match(sharedJson.body, /Kyoto/);
  assert.equal((await request('/api/auth/signup', 'POST', account('Deploy'), { headers: { Origin: deploy } })).status, 200);
  assert.equal((await request('/api/auth/signup', 'POST', account('Peach'), { headers: { Origin: 'https://friday-travel-peach.vercel.app' } })).status, 403);
});

test('with a proxy secret, only the Vercel-injected header serves the site and direct Deploy visits redirect', async (t) => {
  const secret = 'test proxy secret value';
  const fly = 'hxc-p-81-we-5b6199efcb56de4167.fly.dev';
  const { server } = await startApp(t, {
    origin: canonical,
    env: {
      NODE_ENV: 'production',
      APP_ORIGIN: canonical,
      APP_ORIGIN_ALIASES: deploy,
      HEXCLAVE_INTERNAL_HOST: fly,
      FRIDAY_PROXY_SECRET_SHA256: createHash('sha256').update(secret).digest('hex'),
      TRUST_PROXY: '1',
      AUTH_PROVIDER: 'local',
    },
  });
  const hop = { host: fly, 'x-forwarded-host': 'deploy.example' };
  const proxied = await raw(server, '/about.html', { ...hop, [PROXY_HEADER]: secret });
  assert.equal(proxied.status, 200);
  assert.match(proxied.body, /<link rel="canonical" href="https:\/\/fridaytravel\.vercel\.app\/about\.html">/);
  assert.equal((await raw(server, '/api/villas', { ...hop, [PROXY_HEADER]: secret })).status, 200);

  for (const headers of [hop, { ...hop, [PROXY_HEADER]: 'wrong' }, { host: 'deploy.example' }]) {
    const direct = await raw(server, '/about.html?from=deploy', headers);
    assert.equal(direct.status, 308);
    assert.equal(direct.headers.location, 'https://fridaytravel.vercel.app/about.html?from=deploy');
    const api = await raw(server, '/api/villas', headers);
    assert.equal(api.status, 308);
    assert.equal(api.headers.location, 'https://fridaytravel.vercel.app/api/villas');
  }
  assert.equal((await raw(server, '/api/health', hop)).status, 200, 'platform health check stays reachable');
  assert.equal((await raw(server, '/api/health', { host: 'deploy.example' })).status, 200);
});

test('proxy header check needs a well-formed hash and an exact match', () => {
  const digest = createHash('sha256').update('s3cret').digest('hex');
  assert.equal(isPublicProxyRequest('s3cret', digest), true);
  assert.equal(isPublicProxyRequest('s3cret', digest.toUpperCase()), true);
  assert.equal(isPublicProxyRequest('s3cre', digest), false);
  assert.equal(isPublicProxyRequest('', digest), false);
  assert.equal(isPublicProxyRequest('s3cret', ''), false);
  assert.equal(isPublicProxyRequest('s3cret', 'not-a-hash'), false);
});


test('search indexing is hidden by default while public previews work and private pages stay noindex', async (t) => {
  const { server, request } = await startApp(t, {
    origin: canonical,
    env: {
      NODE_ENV: 'production',
      APP_ORIGIN: canonical,
      APP_ORIGIN_ALIASES: deploy,
      TRUST_PROXY: '1',
      AUTH_PROVIDER: 'local',
    },
  });
  const page = await raw(server, '/about.html', { host: 'fridaytravel.vercel.app' });
  assert.equal(page.status, 200);
  assert.equal(page.headers['x-robots-tag'], 'noindex, nofollow');
  assert.match(page.body, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(page.body, /property="og:title"/);
  assert.match(page.body, /property="og:image" content="https:\/\/fridaytravel\.vercel\.app\//);

  const robots = await raw(server, '/robots.txt', { host: 'fridaytravel.vercel.app' });
  assert.equal(robots.status, 200);
  assert.equal(robots.headers['x-robots-tag'], 'noindex, nofollow');
  assert.match(robots.body, /^User-agent: \*\nDisallow: \/\n/);

  const privatePage = await raw(server, '/trip.html', { host: 'fridaytravel.vercel.app' });
  assert.equal(privatePage.status, 200);
  assert.equal(privatePage.headers['x-robots-tag'], 'noindex, nofollow');
  assert.match(privatePage.body, /<meta name="robots" content="noindex, nofollow">/);

  const otherHost = await raw(server, '/about.html?from=preview', { host: 'friday-travel-peach.vercel.app' });
  assert.equal(otherHost.status, 308);
  assert.equal(otherHost.headers.location, 'https://fridaytravel.vercel.app/about.html?from=preview');
  assert.equal(otherHost.headers['x-robots-tag'], 'noindex, nofollow');

  const health = await raw(server, '/api/health', { host: 'fridaytravel.vercel.app' });
  assert.equal(health.status, 200);
  assert.equal(health.headers['x-robots-tag'], 'noindex, nofollow');
  assert.match(health.body, /"ok":true/);

  const account = { name: 'Preview', email: 'preview@example.com', password: 'long test password 123' };
  const signedUp = await request('/api/auth/signup', 'POST', account, { headers: { Origin: canonical } });
  assert.equal(signedUp.status, 200);
  const trip = await request('/api/trips', 'POST', { data: { title: 'Kyoto preview', destination: 'Japan', days: [] } }, { cookie: signedUp.cookie, headers: { Origin: canonical } });
  assert.equal(trip.status, 201);
  const created = await request(`/api/trips/${trip.result.record.id}/share`, 'POST', {}, { cookie: signedUp.cookie, headers: { Origin: canonical } });
  assert.equal(created.status, 201);
  const token = new URL(created.result.share.url, canonical).searchParams.get('share');
  const socialPreview = await raw(server, `/app.html?share=${token}`, { host: 'fridaytravel.vercel.app', 'user-agent': 'facebookexternalhit/1.1' });
  assert.equal(socialPreview.status, 200);
  assert.equal(socialPreview.headers['x-robots-tag'], 'noindex, nofollow');
  assert.match(socialPreview.body, /property="og:title" content="Kyoto preview · a Friday itinerary"/);
  assert.match(socialPreview.body, /property="og:image"/);
});
