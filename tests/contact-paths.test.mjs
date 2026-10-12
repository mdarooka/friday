import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('the contact page offers quote and callback at the top and keeps both forms', async () => {
  const html = await read('contact.html');
  const choice = html.indexOf('class="contact-paths"');
  const callback = html.indexOf('id="callback-title"');
  const quote = html.indexOf('id="quote"');
  assert.ok(choice > -1 && choice < callback && callback < quote);
  assert.match(html, /<a class="btn btn--solid" href="#quote">Request a quote<\/a>/);
  assert.match(html, /<a class="btn" href="#callback-title">Call me back<\/a>/);
  assert.match(html, /data-callback-form/);
  assert.match(html, /id="quote" data-commission/);
  const css = await read('assets/css/friday.css');
  assert.match(css, /#quote, #callback-title, \.callback-card \{ scroll-margin-top: 5\.5rem; \}/);
  assert.match(css, /\.contact-paths \.btn \{ min-height: 44px; \}/);
});

test('planner controls have a 44px box on small screens', async () => {
  const css = await read('assets/css/trip-chat.css');
  const rule = css.slice(css.lastIndexOf('@media (max-width: 720px)'));
  assert.match(rule, /min-width: 44px;/);
  assert.match(rule, /min-height: 44px;/);
  for (const selector of ['.fx-btn', '.fx-icon-btn', '.fx-seg__btn', '.wsp-btn', '.wsp-iconbtn', '.ch-pill', '.fm-btn', '.fx-new__suggestion']) {
    assert.match(rule, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(rule, /\.fx-chip:not\(\.fx-chip--mono\)/);
});
