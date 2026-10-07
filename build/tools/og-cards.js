'use strict';
/*
 * og-cards.js — renders assets/images/og/<key>.jpg (1200×630) for every destination and guide in build/social-cards.js.
 *
 *   node build/tools/og-cards.js            # all cards
 *   node build/tools/og-cards.js goa kyoto  # just these keys
 *
 * Needs a local Google Chrome (headless screenshot) and macOS `sips` (PNG → JPEG). No npm dependencies. The artwork is
 * the site's own plate() generator (build/art.js) so cards match the destination colour on the planner. Fonts are the
 * brand's Cormorant Garamond / Inter, loaded from Google Fonts when the machine is online.
 * After redrawing, bump CARD_VERSION in build/social-cards.js so chat apps re-fetch the images.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { plate } = require('../art');
const C = require('../social-cards');

const ROOT = path.join(__dirname, '..', '..');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function cardHtml(key) {
  const guide = key.endsWith('-guide');
  const id = guide ? key.slice(0, -6) : key;
  const d = C.DESTINATION_CARDS[id];
  const eyebrow = guide ? `The ${d.name} guide` : 'Plan a trip with Friday';
  const line = guide ? C.GUIDES[id].headline : d.tagline;
  const art = plate(`og-${id}`, { scene: d.scene, tone: d.tone, ratio: 'portrait' });
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<style>
:root{--paper:#F4F1EA;--ink:#15140F;--soft:#4A473D;--ochre:#B0552D;--serif:"Cormorant Garamond",Garamond,Georgia,serif;--sans:Inter,Arial,sans-serif}
*{box-sizing:border-box;margin:0}html,body{width:1200px;height:630px;overflow:hidden;background:var(--paper);color:var(--ink)}
.card{position:relative;width:1200px;height:630px;display:grid;grid-template-columns:660px 1fr}
.copy{padding:56px 40px 52px 72px;display:flex;flex-direction:column}
.wordmark{font:500 44px/1 var(--serif);letter-spacing:-.03em}
.main{margin:auto 0}
.eyebrow{font:500 15px/1 var(--sans);letter-spacing:.245em;text-transform:uppercase;color:var(--ochre)}
h1{font:400 ${d.name.length > 8 ? 128 : 148}px/.95 var(--serif);letter-spacing:-.04em;margin:22px 0 22px -4px;white-space:nowrap}
.line{font:italic 400 31px/1.25 var(--serif);color:var(--soft);max-width:520px}
.foot{display:flex;justify-content:space-between;border-top:1px solid #15140f29;padding-top:16px;font:400 14px/1 var(--sans);letter-spacing:.06em;color:var(--soft)}
.art{position:relative;overflow:hidden;background:#E3DCCD}
.art svg{position:absolute;inset:0;width:100%;height:100%}
.art:after{content:"";position:absolute;inset:18px;border:1px solid #f4f1ea99}
</style></head><body><div class="card">
<div class="copy"><div class="wordmark">Friday</div>
<div class="main"><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(d.name)}</h1><p class="line">${esc(line)}</p></div>
<div class="foot"><span>Go somewhere.</span><span>fridaytravel.vercel.app</span></div></div>
<div class="art">${art}</div></div></body></html>`;
}

function render(key, tmp) {
  const html = path.join(tmp, `${key}.html`), png = path.join(tmp, `${key}.png`);
  fs.writeFileSync(html, cardHtml(key));
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--window-size=${C.CARD_WIDTH},${C.CARD_HEIGHT}`, '--virtual-time-budget=8000', `--screenshot=${png}`, `file://${html}`], { stdio: 'ignore' });
  const out = path.join(ROOT, C.cardFile(key));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '86', png, '--out', out], { stdio: 'ignore' });
  return out;
}

const wanted = process.argv.slice(2);
const keys = wanted.length ? wanted : C.cardKeys();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'friday-og-'));
for (const key of keys) {
  if (!C.cardKeys().includes(key)) { console.error(`Unknown card "${key}"`); process.exitCode = 1; continue; }
  const out = render(key, tmp);
  console.log(`${path.relative(ROOT, out)}  ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
}
