import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const script = await read('assets/js/native-page-analytics.js');

function loadCapture({ projectId = 'friday-project' } = {}) {
  const options = [];
  const calls = [];
  class FakeHexclaveClientApp {
    constructor(config) { options.push(config); }
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
  return { window, options, calls };
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
});

test('capture remains limited to villas and contact pages', async () => {
  for (const path of ['villas.html', 'villa.html', 'contact.html']) {
    const html = await read(path);
    assert.equal((html.match(/assets\/js\/native-page-analytics\.js/g) || []).length, 1, `${path} includes capture once`);
  }
  for (const path of ['index.html', 'about.html', 'departures.html', 'privacy.html']) {
    const html = await read(path);
    assert.equal(html.includes('assets/js/native-page-analytics.js'), false, `${path} is unchanged`);
  }
});
