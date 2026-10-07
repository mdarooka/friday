/* Friends' reactions and comments on a shared plan.
   Viewer side: mountShared(main, token) adds a quiet reaction row and comment toggle under each stop of the read-only shared view.
   Owner side: ownerPanel(tripId) returns an element summarising what friends said, with hide / delete. All user text is set with textContent. */
(function () {
  'use strict';
  var FT = (window.FridayTrip = window.FridayTrip || {});
  var REACTIONS = [['yes', 'Yes'], ['love', 'Love it'], ['unsure', 'Not sure']];
  var LABEL = { yes: 'Yes', love: 'Love it', unsure: 'Not sure' };

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function when(iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
  function store(key, value) {
    try { if (value === undefined) return window.localStorage.getItem(key); window.localStorage.setItem(key, value); } catch (e) { /* storage may be unavailable */ }
    return null;
  }
  function viewerId() {
    var id = store('friday.viewer.v1');
    if (id && /^[A-Za-z0-9_-]{16,64}$/.test(id)) return id;
    var bytes = new Uint8Array(18);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes); else for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    id = btoa(String.fromCharCode.apply(null, bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    store('friday.viewer.v1', id);
    return id;
  }
  function call(url, method, data, viewer) {
    var headers = { Accept: 'application/json' };
    if (viewer) headers['X-Friday-Viewer'] = viewer;
    var opts = { method: method || 'GET', credentials: 'same-origin', headers: headers };
    if (data !== undefined) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(data); }
    return fetch(url, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw Object.assign(new Error(j.error || 'Friday could not save that just now.'), { status: r.status });
        return j;
      });
    });
  }

  function mountShared(main, token) {
    if (!token || !main) return;
    var base = '/api/shared/' + encodeURIComponent(token) + '/feedback', vid = viewerId(), data = null, name = store('friday.viewer-name.v1') || '';
    var days = main.querySelectorAll('.fx-shared__day');
    var boxes = {};   // stop key -> { box, counts, buttons, list, note }

    function stopAt(d, i) { return data && data.stops.filter(function (s) { return s.day === d && s.item === i; })[0]; }
    function paint() {
      Object.keys(boxes).forEach(function (key) {
        var b = boxes[key], counts = data.reactions[key] || {}, mine = data.mine[key] || '';
        b.buttons.forEach(function (btn) {
          var v = btn.getAttribute('data-value'), n = counts[v] || 0;
          btn.textContent = LABEL[v] + (n ? ' · ' + n : '');
          btn.classList.toggle('is-on', mine === v); btn.setAttribute('aria-pressed', mine === v ? 'true' : 'false');
        });
        var mineComments = data.comments.filter(function (c) { return c.stopKey === key; });
        b.toggle.textContent = mineComments.length ? 'Comments · ' + mineComments.length : 'Comment';
        b.list.textContent = '';
        mineComments.forEach(function (c) {
          var row = el('div', 'fx-fb__comment');
          row.appendChild(el('p', 'fx-fb__text', c.text));
          var meta = el('span', 'fx-fb__meta', (c.name || 'A friend') + (when(c.created) ? ' · ' + when(c.created) : ''));
          row.appendChild(meta);
          if (c.mine) {
            var del = el('button', 'fx-link fx-fb__del', 'Delete'); del.type = 'button';
            del.addEventListener('click', function () { call(base + '/' + encodeURIComponent(c.id), 'DELETE', undefined, vid).then(refresh).catch(function (e) { b.note.textContent = e.message; }); });
            meta.appendChild(document.createTextNode(' · ')); meta.appendChild(del);
          }
          b.list.appendChild(row);
        });
      });
    }
    function refresh() { return call(base, 'GET', undefined, vid).then(function (j) { data = j; paint(); }); }

    days.forEach(function (section, d) {
      section.querySelectorAll('ol > li').forEach(function (li, i) {
        var stop = stopAt(d, i); if (!stop) return;
        var key = stop.key, wrap = el('div', 'fx-fb'), row = el('div', 'fx-fb__row'), buttons = [];
        REACTIONS.forEach(function (r) {
          var btn = el('button', 'fx-chip fx-fb__react', r[1]); btn.type = 'button'; btn.setAttribute('data-value', r[0]); btn.setAttribute('aria-pressed', 'false');
          btn.addEventListener('click', function () {
            btn.disabled = true;
            call(base, 'POST', { kind: 'reaction', stopKey: key, value: r[0], name: name }, vid).then(refresh).catch(function (e) { boxes[key].note.textContent = e.message; }).then(function () { btn.disabled = false; });
          });
          buttons.push(btn); row.appendChild(btn);
        });
        var toggle = el('button', 'fx-link fx-fb__toggle', 'Comment'); toggle.type = 'button'; toggle.setAttribute('aria-expanded', 'false');
        row.appendChild(toggle); wrap.appendChild(row);
        var panel = el('div', 'fx-fb__panel'); panel.hidden = true;
        var list = el('div', 'fx-fb__list'), form = el('form', 'fx-fb__form'), note = el('p', 'fx-hint fx-fb__note');
        var nameInput = el('input', 'fx-input'); nameInput.type = 'text'; nameInput.maxLength = 40; nameInput.placeholder = 'Your name (optional)'; nameInput.setAttribute('aria-label', 'Your name (optional)'); nameInput.value = name; nameInput.autocomplete = 'nickname';
        var text = el('textarea', 'fx-input'); text.maxLength = 280; text.rows = 2; text.placeholder = 'Add a note for the planner'; text.setAttribute('aria-label', 'Comment on this stop');
        var send = el('button', 'fx-btn fx-btn--ink fx-btn--sm', 'Post comment'); send.type = 'submit';
        form.appendChild(nameInput); form.appendChild(text); form.appendChild(send);
        panel.appendChild(list); panel.appendChild(form); panel.appendChild(note); wrap.appendChild(panel);
        toggle.addEventListener('click', function () { panel.hidden = !panel.hidden; toggle.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true'); if (!panel.hidden) text.focus(); });
        form.addEventListener('submit', function (e) {
          e.preventDefault(); var value = text.value.trim(); if (!value) return;
          name = nameInput.value.trim().slice(0, 40); store('friday.viewer-name.v1', name);
          send.disabled = true; note.textContent = '';
          call(base, 'POST', { kind: 'comment', stopKey: key, value: value, name: name }, vid).then(function () { text.value = ''; return refresh(); }).catch(function (err) { note.textContent = err.message; }).then(function () { send.disabled = false; });
        });
        li.appendChild(wrap);
        boxes[key] = { box: wrap, buttons: buttons, toggle: toggle, list: list, note: note };
      });
    });
  }

  function ownerPanel(tripId, request) {
    var root = el('details', 'fx-fb-owner'), sum = el('summary', null, 'Friends’ feedback'), body = el('div', 'fx-fb-owner__body');
    root.appendChild(sum); root.appendChild(body);
    var url = '/api/trips/' + encodeURIComponent(tripId) + '/feedback';
    function load() {
      body.textContent = 'Loading…';
      request(url).then(function (j) {
        body.textContent = '';
        var any = false;
        j.stops.forEach(function (s) {
          var counts = j.reactions[s.key] || {}, cs = j.comments.filter(function (c) { return c.stopKey === s.key; });
          var tally = REACTIONS.filter(function (r) { return counts[r[0]]; }).map(function (r) { return r[1] + ' ' + counts[r[0]]; }).join(' · ');
          if (!tally && !cs.length) return;
          any = true; section(s.title || 'A stop', tally, cs);
        });
        var orphans = j.comments.filter(function (c) { return c.removedStop; });
        if (orphans.length) { any = true; section('Stops no longer in the plan', '', orphans); }
        if (!any) body.appendChild(el('p', 'fx-hint', 'No feedback yet. Create a share link and friends can react to each stop or leave a note, without an account.'));
      }).catch(function (e) { body.textContent = e && e.status === 404 ? 'Save this journey first to see feedback.' : (e.message || 'Could not load feedback.'); });
    }
    function section(title, tally, comments) {
      var s = el('div', 'fx-fb-owner__stop'); s.appendChild(el('strong', null, title));
      if (tally) s.appendChild(el('span', 'fx-fb__meta', tally));
      comments.forEach(function (c) {
        var row = el('div', 'fx-fb__comment' + (c.hidden ? ' is-hidden' : ''));
        row.appendChild(el('p', 'fx-fb__text', c.text));
        var meta = el('span', 'fx-fb__meta', (c.name || 'A friend') + (when(c.created) ? ' · ' + when(c.created) : '') + (c.hidden ? ' · hidden' : ''));
        [[c.hidden ? 'Show' : 'Hide', function () { return request(url + '/' + encodeURIComponent(c.id), 'POST', { hidden: !c.hidden }); }],
         ['Delete', function () { return request(url + '/' + encodeURIComponent(c.id), 'DELETE', {}); }]].forEach(function (a) {
          var b = el('button', 'fx-link fx-fb__del', a[0]); b.type = 'button';
          b.addEventListener('click', function () { a[1]().then(load).catch(function (e) { meta.textContent = e.message; }); });
          meta.appendChild(document.createTextNode(' · ')); meta.appendChild(b);
        });
        row.appendChild(meta); s.appendChild(row);
      });
      body.appendChild(s);
    }
    root.addEventListener('toggle', function () { if (root.open) load(); });
    return root;
  }

  FT.feedback = { mountShared: mountShared, ownerPanel: ownerPanel };
})();
