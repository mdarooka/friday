import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

const GUIDE_QUOTES = [
  ['goa-guide.html', 'contact.html?quote_path=guide&amp;destination=goa#quote', 'Goa'],
  ['rajasthan-guide.html', 'contact.html?quote_path=guide&amp;destination=rajasthan#quote', 'Rajasthan'],
  ['kerala-guide.html', 'contact.html?quote_path=guide&amp;destination=kerala#quote', 'Kerala'],
  ['srilanka-guide.html', 'contact.html?quote_path=guide&amp;destination=srilanka#quote', 'Sri Lanka'],
  ['ladakh-guide.html', 'contact.html?quote_path=guide&amp;destination=ladakh#quote', 'Ladakh'],
  ['mumbai-quiet-weekend.html', 'contact.html?from=mumbai-quiet-weekend&amp;quote_path=guide&amp;destination=mumbai-quiet-weekend#quote', 'Mumbai weekend'],
];

function quoteHref(html) {
  const tag = html.match(/<a\b[^>]*data-guide-cta="quote"[^>]*>/);
  assert.ok(tag, 'quote call to action');
  const href = tag[0].match(/\bhref="([^"]+)"/);
  assert.ok(href, 'quote href');
  return href[1];
}

test('guide quote links open the enquiry form with the place in the address', async () => {
  for (const [file, href] of GUIDE_QUOTES) {
    assert.equal(quoteHref(await read(file)), href, file);
  }
  const contact = await read('contact.html');
  const css = await read('assets/css/friday.css');
  assert.match(contact, /<form class="form" id="quote" data-commission/);
  assert.match(contact, /id="f-shape" name="shape"/);
  assert.match(css, /#quote[^{]*\{[^}]*scroll-margin-top:/);
});

function element(tag, attrs = {}, children = []) {
  const node = {
    tag,
    attrs: { ...attrs },
    children,
    value: '',
    hidden: false,
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener() {},
    setAttribute(name, value) { this.attrs[name] = value; },
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; },
    hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name); },
    appendChild(child) { this.children.push(child); return child; },
    querySelector(selector) { return find(this, selector); },
    querySelectorAll(selector) { return findAll(this, selector); },
    scrollIntoView() { this.scrolled = (this.scrolled || 0) + 1; },
  };
  if (attrs.id) node.id = attrs.id;
  return node;
}

function matches(node, selector) {
  const sel = selector.trim();
  if (!sel || !node || !node.attrs) return false;
  if (sel.includes(',')) return sel.split(',').some((part) => matches(node, part));
  if (sel.startsWith('#')) return node.id === sel.slice(1);
  if (sel.startsWith('.')) return String(node.attrs.class || '').split(/\s+/).includes(sel.slice(1));
  const attr = sel.match(/^\[([^\]=]+)(?:=["']?([^"'\]]+)["']?)?\]$/);
  if (attr) {
    if (!Object.prototype.hasOwnProperty.call(node.attrs, attr[1])) return false;
    return attr[2] == null || node.attrs[attr[1]] === attr[2];
  }
  return node.tag === sel;
}

function walk(node, visit) {
  visit(node);
  for (const child of node.children || []) walk(child, visit);
}

function find(root, selector) {
  let found = null;
  walk(root, (node) => { if (!found && matches(node, selector)) found = node; });
  return found;
}

function findAll(root, selector) {
  const found = [];
  walk(root, (node) => { if (matches(node, selector)) found.push(node); });
  return found;
}

async function openContact(search, hash) {
  const shape = element('textarea', { name: 'shape', id: 'f-shape' });
  const quote = element('form', { id: 'quote', class: 'form', 'data-commission': '' }, [shape]);
  const body = element('body', {}, [quote]);
  const document = {
    body,
    documentElement: element('html'),
    readyState: 'complete',
    addEventListener() {},
    createElement: (tag) => element(tag),
    getElementById: (id) => find(body, `#${id}`),
    querySelector: (selector) => find(body, selector),
    querySelectorAll: (selector) => findAll(body, selector),
  };
  const window = {
    document,
    scrollY: 0,
    innerHeight: 800,
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    addEventListener() {},
    fetch: async () => ({ ok: true, json: async () => ({}) }),
  };
  const location = { search, hash, pathname: '/contact.html', href: `http://127.0.0.1/contact.html${search}${hash}` };
  const script = await read('assets/js/friday.js');
  vm.runInNewContext(script, {
    window, document, location, fetch: window.fetch, URLSearchParams, Object, Array, String, Promise, console,
  });
  return { shape, quote };
}

test('the quote form is filled with the guide place and scrolled into view', async () => {
  for (const [file, href, label] of GUIDE_QUOTES) {
    const params = new URLSearchParams(href.replace(/&amp;/g, '&').replace(/^[^?]*\?/, '').replace(/#.*$/, ''));
    const opened = await openContact(`?${params.toString()}`, '#quote');
    assert.equal(opened.shape.value, label, file);
    assert.equal(opened.quote.scrolled, 1, file);
  }
  const blank = await openContact('', '');
  assert.equal(blank.shape.value, '');
  assert.equal(blank.quote.scrolled, undefined);
  const named = await openContact('?destination=Goa', '#quote');
  assert.equal(named.shape.value, 'Goa');
});
