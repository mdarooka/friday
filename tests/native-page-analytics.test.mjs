import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const script = await read('assets/js/native-page-analytics.js');

function loadCapture({ projectId = 'friday-project' } = {}) {
  const options = [];
  const calls = [];
  const users = [];
  class FakeHexclaveClientApp {
    constructor(config) { options.push(config); }
    getUser(query) { users.push(query); return Promise.resolve({ id: 'anon' }); }
  }
  const window = { FakeHexclaveClientApp };
  const source = script.replace(
    "import('https://esm.sh/@hexclave/js@1.0.125')",
    'Promise.resolve({ HexclaveClientApp: window.FakeHexclaveClientApp })',
  );
  const context = {
    window,
    Promise,
    Error,
    fetch: async (path, init) => {
      calls.push({ path, init });
      return { ok: true, json: async () => ({ hexclaveProjectId: projectId }) };
    },
  };
  vm.runInNewContext(source, context);
  return { window, options, calls, users };
}

test('public villa enquiry capture uses native page and click analytics without session replays', async () => {
  const fixture = loadCapture();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.calls[0].path, '/api/capabilities');
  assert.equal(fixture.calls[0].init.credentials, 'same-origin');
  assert.equal(fixture.options.length, 1);
  const options = fixture.options[0];
  assert.equal(options.projectId, 'friday-project');
  assert.equal(options.tokenStore, 'cookie');
  assert.equal(options.devTool, false);
  assert.equal(options.automaticSideEffects, true);
  assert.deepEqual(JSON.parse(JSON.stringify(options.analytics)), { enabled: true, replays: { enabled: false } });
  assert.equal(fixture.window.FridayNativePageAnalytics.ready, true);
  assert.deepEqual(JSON.parse(JSON.stringify(fixture.users)), [{ or: 'anonymous' }]);
  assert.equal(typeof fixture.window.FridayNativePageAnalytics.client.then, 'function');
});

test('native page views load once on every public page and stay off the admin console', async () => {
  for (const path of ['index.html', 'about.html', 'departures.html', 'privacy.html', 'villas.html', 'villa.html', 'contact.html', 'guides.html', '404.html']) {
    const html = await read(path);
    assert.equal((html.match(/assets\/js\/native-page-analytics\.js/g) || []).length, 1, `${path} includes capture once`);
    assert.match(html, /native-page-analytics\.js"><\/script>\s*<script src="assets\/js\/friday-analytics\.js"/, `${path} starts the analytics client before custom events`);
  }
  for (const path of ['admin.html', 'admin-villas.html']) {
    const html = await read(path);
    assert.equal(html.includes('assets/js/native-page-analytics.js'), false, `${path} does not record public page views`);
  }
});

test('friday-analytics reuses the native page-view client when it is already on the page', async () => {
  const native = await read('assets/js/native-page-analytics.js');
  const shared = await read('assets/js/friday-analytics.js');
  const options = [];
  class FakeHexclaveClientApp {
    constructor(config) { options.push(config); }
    getUser() { return Promise.resolve({}); }
  }
  const window = { FakeHexclaveClientApp, addEventListener() {} };
  const context = {
    window,
    location: { pathname: '/about.html', search: '' },
    document: { referrer: '', addEventListener() {} },
    URL, URLSearchParams, Symbol, Math, Date, JSON, Promise, Error,
    crypto: { randomUUID: () => 'id-1' },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    fetch: async () => ({ ok: true, json: async () => ({ hexclaveProjectId: 'friday-project' }) }),
  };
  const source = (native + '\n' + shared).replaceAll(
    "import('https://esm.sh/@hexclave/js@1.0.125')",
    'Promise.resolve({ HexclaveClientApp: window.FakeHexclaveClientApp })',
  );
  vm.runInNewContext(source, context);
  await window.FridayAnalytics.track('public_page_viewed', { path: '/about.html' }, 'about');
  assert.equal(options.length, 1);
  assert.equal(options[0].analytics.enabled, true);
  assert.equal(options[0].automaticSideEffects, true);
});

test('privacy policy discloses page and click analytics on public pages', async () => {
  const privacy = await read('privacy.html');
  assert.ok(privacy.includes('Friday’s public pages also record page visits and clicks through Hexclave Analytics.'));
});
