/*
 * House knowledge: a travel company's planning skill file plus reference notes, read once at startup
 * and folded into the Claude itinerary provider's system prompt. Layout: <dir>/SKILL.md and <dir>/references/*.md.
 * Only an allowlist of SKILL.md sections is kept, local-path lines are dropped, and client names and
 * sample file names are redacted. A missing or empty folder yields an empty result, never an error.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Older (0.1.x) and newer (0.5.x) skill-file headings for the same material.
export const DEFAULT_SECTIONS = ['Procedure', 'Pitfalls', 'Sightseeing specificity', 'Indian traveler knowledge', 'Diet & culture', 'Sample evidence', 'Sample evidence (historical only)'];
export const DEFAULT_MAX_CHARS = 60000;

const PATH_LINE = /\/Users\/|Downloads\/|C:\\/i;
const HONORIFIC = /\b(?:Mrs|Mr|Ms|Dr)\b\.?[ \t]*[A-Z][\w'’-]*(?:[ \t]+[A-Z][\w'’-]*)?/g;
const QUOTED_FILE = /(["'`])[^"'`\n]+\.(?:pdf|docx)\1/gi;
const BARE_FILE = /[^\s"'`()<>[\]\\/]+\.(?:pdf|docx)\b/gi;

function stripFrontMatter(text) {
  const m = /^\uFEFF?---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  return m ? text.slice(m[0].length) : text;
}

function dropPathLines(text) {
  return text.split('\n').filter((l) => !PATH_LINE.test(l)).join('\n');
}

function redact(text) {
  return text
    .replace(QUOTED_FILE, '[sample file]')
    .replace(BARE_FILE, '[sample file]')
    .replace(HONORIFIC, '[client]');
}

function clean(text) {
  return redact(dropPathLines(text.replace(/\r\n?/g, '\n'))).trim();
}

/** SKILL.md body -> [{ heading, body }] for each `## ` section (text before the first one is ignored). */
function splitSections(body) {
  const out = [];
  let cur = null;
  let fence = false;
  body.split('\n').forEach((line) => {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const m = !fence && /^##[ \t]+(.+?)[ \t#]*$/.exec(line);
    if (m) { cur = { heading: m[1].trim(), lines: [line] }; out.push(cur); } else if (cur) cur.lines.push(line);
  });
  return out.map((s) => ({ heading: s.heading, body: s.lines.join('\n') }));
}

function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch (e) { return null; }
}

/**
 * loadKnowledge(dir, { maxChars, sections }) -> { text, sources, chars, skipped }
 * `sources` are relative file names that contributed text; `skipped` are pieces left out for size.
 */
export function loadKnowledge(dir, opts = {}) {
  const maxChars = Number.isFinite(opts.maxChars) && opts.maxChars > 0 ? opts.maxChars : DEFAULT_MAX_CHARS;
  const allow = new Set((opts.sections && opts.sections.length ? opts.sections : DEFAULT_SECTIONS).map((s) => String(s).trim().toLowerCase()));
  const empty = { text: '', sources: [], chars: 0, skipped: [] };
  if (!dir) return empty;

  const pieces = [];   // { source, label, text }
  const skill = readText(path.join(dir, 'SKILL.md'));
  if (skill !== null) {
    splitSections(stripFrontMatter(skill.replace(/\r\n?/g, '\n'))).forEach((s) => {
      if (!allow.has(s.heading.toLowerCase())) return;
      const text = clean(s.body);
      if (text) pieces.push({ source: 'SKILL.md', label: 'SKILL.md: ' + s.heading, text });
    });
  }
  let names = [];
  try { names = fs.readdirSync(path.join(dir, 'references')).filter((n) => /\.md$/i.test(n)).sort(); } catch (e) { /* no references */ }
  names.forEach((n) => {
    const raw = readText(path.join(dir, 'references', n));
    const text = raw === null ? '' : clean(raw);
    if (text) pieces.push({ source: 'references/' + n, label: 'references/' + n, text });
  });

  const kept = [];
  const skipped = [];
  let size = 0;
  pieces.forEach((p) => {
    const add = p.text.length + (kept.length ? 2 : 0);
    if (size + add <= maxChars) { kept.push(p); size += add; } else skipped.push(p.label);
  });
  const text = kept.map((p) => p.text).join('\n\n');
  const sources = [];
  kept.forEach((p) => { if (!sources.includes(p.source)) sources.push(p.source); });
  return { text, sources, chars: text.length, skipped };
}


const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Knowledge settings from env vars: KNOWLEDGE (off disables), KNOWLEDGE_DIR, KNOWLEDGE_MAX_CHARS, KNOWLEDGE_SECTIONS. */
export function knowledgeConfig(env = process.env) {
  const n = Number(env.KNOWLEDGE_MAX_CHARS);
  return {
    enabled: (env.KNOWLEDGE || '').trim().toLowerCase() !== 'off',
    dir: path.resolve(ROOT, env.KNOWLEDGE_DIR || 'server/knowledge/kusum'),
    maxChars: env.KNOWLEDGE_MAX_CHARS !== undefined && env.KNOWLEDGE_MAX_CHARS !== '' && Number.isFinite(n) ? n : DEFAULT_MAX_CHARS,
    sections: env.KNOWLEDGE_SECTIONS ? env.KNOWLEDGE_SECTIONS.split(',').map((x) => x.trim()).filter(Boolean) : null
  };
}

/** Load the knowledge the env asks for; an empty result when disabled. */
export function loadKnowledgeFromEnv(env = process.env) {
  const k = knowledgeConfig(env);
  return k.enabled ? loadKnowledge(k.dir, { maxChars: k.maxChars, sections: k.sections }) : { text: '', sources: [], chars: 0, skipped: [] };
}
