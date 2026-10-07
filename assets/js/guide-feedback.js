/* "Was this useful?" on public guides. Anonymous: a random id in localStorage identifies the browser; the server stores only a hash. */
(function () {
  'use strict';
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
  function post(slug, vote, note) {
    var body = { slug: slug, vote: vote };
    if (note) body.note = note;
    return fetch('/api/guide-feedback', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Friday-Viewer': viewerId() }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Friday could not save that just now.'); return j; }); });
  }
  function mount(root) {
    var slug = root.getAttribute('data-guide-feedback'), key = 'friday.guide-vote.' + slug;
    var buttons = root.querySelectorAll('[data-gf-vote]'), form = root.querySelector('[data-gf-note]'), status = root.querySelector('[data-gf-status]');
    var vote = store(key) === 'yes' || store(key) === 'no' ? store(key) : '';
    function show() {
      for (var i = 0; i < buttons.length; i++) buttons[i].setAttribute('aria-pressed', String(buttons[i].getAttribute('data-gf-vote') === vote));
      form.hidden = !vote;
    }
    function track(name, extra) {
      try { var A = window.FridayAnalytics; if (A && A.track) { var id = A.uuid(); A.track(name, Object.assign({ event_id: id, guide: slug, vote: vote }, extra), id); } } catch (e) { /* analytics is best effort */ }
    }
    show();
    Array.prototype.forEach.call(buttons, function (button) {
      button.addEventListener('click', function () {
        var chosen = button.getAttribute('data-gf-vote');
        status.textContent = '';
        post(slug, chosen).then(function () {
          vote = chosen; store(key, vote); show(); track('guide_feedback_voted');
          status.textContent = 'Thanks. Add a note below if you like.';
        }).catch(function (e) { status.textContent = e.message; });
      });
    });
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var note = form.elements.note.value.trim().slice(0, 280);
      if (!note) { status.textContent = 'Write a note first, or just leave it at your answer.'; return; }
      post(slug, vote, note).then(function () { track('guide_feedback_note', { note_length: note.length }); form.elements.note.value = ''; status.textContent = 'Thank you, that reaches the Friday team.'; })
        .catch(function (e) { status.textContent = e.message; });
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-guide-feedback]'), mount);
})();
