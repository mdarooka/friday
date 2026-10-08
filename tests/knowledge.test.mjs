import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startApp } from './helpers.mjs';
import { loadKnowledge, knowledgeConfig } from '../server/knowledge/index.mjs';
import { createClaudeProvider, KNOWLEDGE_PREAMBLE, buildPrompt } from '../server/itinerary/providers/claude.mjs';
import { getDestination } from '../server/itinerary/catalog.mjs';

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'knowledge');

test('allowlisted sections are kept, others excluded, front matter stripped', () => {
  const k = loadKnowledge(FIX);
  assert.ok(k.text.includes('## Procedure') && k.text.includes('## Pitfalls') && k.text.includes('## Sample evidence'));
  assert.ok(!/Delivery PDFs|Supplier portals|supplier portal|logo/.test(k.text));
  assert.ok(!k.text.includes('Intro text') && !k.text.includes('fake-planner') && !k.text.includes('---'));
  assert.deepEqual(k.sources, ['SKILL.md', 'references/a-food.md', 'references/b-rest.md']);
  assert.equal(k.chars, k.text.length);
});

test('newer skill-file headings are recognised', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'know-'));
  fs.writeFileSync(path.join(dir, 'SKILL.md'), '---\nversion: 0.5.0\n---\n## Diet & culture\nAct on volunteered labels.\n\n## Sample evidence (historical only)\nOld trips.\n\n## Supplier confirmations\nInternal only.\n');
  const k = loadKnowledge(dir);
  assert.ok(k.text.includes('Act on volunteered labels') && k.text.includes('Old trips.'));
  assert.ok(!k.text.includes('Internal only'));
});

test('KNOWLEDGE_SECTIONS style override replaces the allowlist', () => {
  const k = loadKnowledge(FIX, { sections: ['pitfalls'] });
  assert.ok(k.text.includes('## Pitfalls') && !k.text.includes('## Procedure'));
});

test('lines with local paths are dropped, in SKILL sections and references', () => {
  const k = loadKnowledge(FIX);
  assert.ok(!k.text.includes('/Users/') && !k.text.includes('C:\\'));
  assert.ok(k.text.includes('Keep arrival days light') && k.text.includes('Name the real places'));
  assert.ok(k.text.includes('Veg-only guests'));
});

test('client names and sample file names are redacted', () => {
  const k = loadKnowledge(FIX);
  assert.ok(!k.text.includes('Test Person') && !k.text.includes('Sample Client'));
  assert.ok(k.text.includes('[client]'));
  assert.ok(!/\.(pdf|docx)/.test(k.text) && k.text.includes('[sample file]'));
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'kn-'));
  fs.writeFileSync(path.join(r, 'SKILL.md'), '## Procedure\nMr.Suni X, Ms. A B and Dr Z, Mr. Q Rs went. Drive on.\n');
  assert.equal(loadKnowledge(r).text.split('\n')[1], '[client], [client] and [client], [client] went. Drive on.');
  fs.rmSync(r, { recursive: true });
});

test('cap: SKILL sections first, then references in order, skipped recorded', () => {
  const all = loadKnowledge(FIX);
  const small = loadKnowledge(FIX, { maxChars: all.chars - 10 });
  assert.ok(small.chars <= all.chars - 10);
  assert.deepEqual(small.skipped, ['references/b-rest.md']);
  assert.deepEqual(small.sources, ['SKILL.md', 'references/a-food.md']);
  const tiny = loadKnowledge(FIX, { maxChars: 120 });
  assert.ok(tiny.chars <= 120);
  assert.ok(tiny.skipped.some((s) => s.startsWith('references/')));
});

test('a missing or empty folder gives an empty result without throwing', () => {
  assert.deepEqual(loadKnowledge(path.join(FIX, 'nope')), { text: '', sources: [], chars: 0, skipped: [] });
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'kn-'));
  assert.equal(loadKnowledge(r).text, '');
  fs.rmSync(r, { recursive: true });
});

test('config: defaults, overrides and KNOWLEDGE=off', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const d = knowledgeConfig({});
  assert.equal(d.enabled, true);
  assert.equal(d.dir, path.join(root, 'server/knowledge/kusum'));
  assert.equal(d.maxChars, 60000);
  assert.equal(d.sections, null);
  const c = knowledgeConfig({ KNOWLEDGE: 'off', KNOWLEDGE_MAX_CHARS: '500', KNOWLEDGE_SECTIONS: 'A, B', KNOWLEDGE_DIR: 'x/y' });
  assert.deepEqual([c.enabled, c.maxChars, c.sections, c.dir], [false, 500, ['A', 'B'], path.join(root, 'x/y')]);
});

const goa = getDestination('goa');
const request = { destination: 'goa', types: ['Beach downtime'], days: 1, dates: { start: '2027-01-10' }, pace: 'normal', base: null };

test('claude system prompt: current text, then preamble, then knowledge', async () => {
  const knowledge = loadKnowledge(FIX);
  let body;
  const fetchMock = async (u, init) => { body = JSON.parse(init.body); return { ok: true, status: 200, json: async () => ({ content: [{ type: 'tool_use', name: 'submit_itinerary', input: { days: [] } }] }) }; };
  const p = createClaudeProvider({ apiKey: 'k', model: 'm', fetch: fetchMock, knowledge });
  await assert.rejects(p.generate(goa, request), /usable days/);
  const sys = body.system;
  const base = buildPrompt(goa, request).system;
  assert.ok(sys.startsWith(base));
  const i = sys.indexOf(KNOWLEDGE_PREAMBLE), j = sys.indexOf('## Procedure');
  assert.ok(i > base.length - 1 && j > i);
  assert.ok(sys.includes('never state prices') || /never state prices/.test(KNOWLEDGE_PREAMBLE));
  assert.equal(body.tools[0].strict, true);
  assert.equal(buildPrompt(goa, request, { text: '' }).system, base);
});

test('health reports knowledge sources; off and missing report none', async (t) => {
  const get = async (env) => {
    const logs = [];
    const app = await startApp(t, { env, log: (m) => logs.push(m) });
    return { j: (await app.request('/api/health')).result, logs };
  };
  const on = await get({ KNOWLEDGE_DIR: FIX });
  assert.deepEqual(on.j.knowledge.sources, ['SKILL.md', 'references/a-food.md', 'references/b-rest.md']);
  assert.ok(on.j.knowledge.chars > 0);
  assert.ok(on.logs.includes('knowledge: 3 files, ' + on.j.knowledge.chars + ' chars'));
  assert.ok(!on.logs.join('\n').includes('Veg-only'));
  const off = await get({ KNOWLEDGE_DIR: FIX, KNOWLEDGE: 'off' });
  assert.deepEqual(off.j.knowledge, { sources: [], chars: 0 });
  assert.ok(off.logs.includes('knowledge: none'));
  assert.deepEqual((await get({ KNOWLEDGE_DIR: path.join(FIX, 'missing') })).j.knowledge, { sources: [], chars: 0 });
});
