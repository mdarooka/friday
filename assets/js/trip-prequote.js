/* Optional "what we need from you" checklist shown after a callback request is saved (planner modal and contact page).
 * The items come from the server (server/prequote-checklist.mjs), which is where the owner edits them. Nothing here blocks the callback. */
(function () {
  'use strict';
  var doc = document;
  function el(tag, attrs, text) { var n = doc.createElement(tag); Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); }); if (text) n.textContent = text; return n; }
  function style() {
    if (doc.getElementById('prequote-style')) return;
    var s = el('style', { id: 'prequote-style' });
    s.textContent = '.prequote{margin-top:1.25rem;padding-top:1rem;border-top:1px solid currentColor;border-top-color:rgba(127,127,127,.35)}.prequote h3{font:inherit;font-weight:600;margin:0 0 .25rem}.prequote p{margin:0 0 .75rem;opacity:.8;font-size:.9em}.prequote__row{display:grid;gap:.25rem;margin:0 0 .75rem}.prequote__row label{display:flex;gap:.5rem;align-items:flex-start}.prequote__row input[type=text]{font:inherit;color:inherit;background:transparent;border:1px solid rgba(127,127,127,.5);padding:.45rem .6rem;width:100%;box-sizing:border-box}.prequote button{font:inherit;cursor:pointer}';
    doc.head.appendChild(s);
  }
  function mount(anchor, detail) {
    if (!anchor || !detail || !detail.id || !detail.checklistToken || anchor.querySelector('.prequote')) return;
    style();
    fetch('/api/callbacks/checklist-items', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (data) {
      var items = data.items || [];
      if (!items.length) return;
      var box = el('section', { class: 'prequote', 'aria-label': 'Optional checklist' });
      box.appendChild(el('h3', {}, 'Optional: help us make the call count'));
      box.appendChild(el('p', {}, 'Answer what you can now, or skip it and tell us on the call. Nothing here is required.'));
      var rows = items.map(function (item) {
        var row = el('div', { class: 'prequote__row' }), label = el('label'), tick = el('input', { type: 'checkbox' });
        label.appendChild(tick); label.appendChild(el('span', {}, item.label));
        var text = el('input', { type: 'text', maxlength: '200', placeholder: item.placeholder || '', 'aria-label': item.label });
        text.addEventListener('input', function () { if (text.value.trim()) tick.checked = true; });
        row.appendChild(label); row.appendChild(text); box.appendChild(row);
        return { id: item.id, tick: tick, text: text };
      });
      var save = el('button', { type: 'button', class: 'btn' }, 'Save answers'), status = el('p', { role: 'status', 'aria-live': 'polite' });
      save.addEventListener('click', function () {
        var answers = {}; rows.forEach(function (r) { if (r.tick.checked || r.text.value.trim()) answers[r.id] = { done: true, text: r.text.value.trim() }; });
        save.disabled = true; status.textContent = 'Saving…';
        /* The call was booked while signed in, so only that account can add to it. On the contact page the sign-in token comes from the shared helper (assets/js/friday.js); in the planner every request already carries it. */
        (window.FridayAuth ? window.FridayAuth.headers() : Promise.resolve({}))
          .then(function (extra) { return fetch('/api/callbacks/' + encodeURIComponent(detail.id) + '/checklist', { method: 'PUT', credentials: 'same-origin', headers: Object.assign({ 'Content-Type': 'application/json' }, extra), body: JSON.stringify({ checklistToken: detail.checklistToken, answers: answers }) }); })
          .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Could not save.'); return j; }); })
          .then(function (j) { status.textContent = 'Saved. ' + j.done + ' of ' + j.total + ' answered. Thank you.'; })
          .catch(function (e) { status.textContent = e.message || 'Could not save your answers. The call is still booked.'; })
          .then(function () { save.disabled = false; });
      });
      box.appendChild(save); box.appendChild(status); anchor.appendChild(box);
    }).catch(function () { /* optional: stay silent */ });
  }
  doc.addEventListener('friday:callback-saved', function (e) { mount(e.detail && e.detail.anchor, e.detail); });
})();
