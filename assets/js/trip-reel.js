/* Reel to itinerary: a source-led, price-free planning flow. */
(function () {
  'use strict';
  var FT = window.FridayTrip = window.FridayTrip || {}, doc = document;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  function webUrl(raw) { try { var u = new URL(raw); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch (_) { return ''; } }
  function request(path, method, data) { if (!FT.backend || !FT.backend.user) return Promise.reject(new Error('Sign in to create and save a reel itinerary.')); return FT.backend.request(path, method || 'GET', data); }
  function open(opts) {
    opts = opts || {};
    if (!FT.ui || !FT.ui.modal) return;
    var body = doc.createElement('div'), state = { draft: null, dirty: false, busy: false, confirmedFallback: false, userId: FT.backend && FT.backend.user && FT.backend.user.id };
    function fields(d) {
      d = d || {};
      return '<p class="fx-hint">Share a public reel and confirm the exact place. Friday will make an itinerary draft with cited stops. It will not estimate or show prices.</p>' +
        '<label class="fx-field fx-label">Public reel URL<input class="fx-input" data-r="url" type="url" required maxlength="1000" placeholder="https://www.instagram.com/reel/…" value="' + esc(d.source && d.source.url || opts.url || '') + '"></label>' +
        '<label class="fx-field fx-label">Exact place from the reel<input class="fx-input" data-r="placeName" required maxlength="160" placeholder="Place, venue or landmark" value="' + esc(d.placeName || opts.placeName || '') + '"></label>' +
        '<label class="fx-field fx-label">Destination (city and country)<input class="fx-input" data-r="destination" required maxlength="160" placeholder="City, country" value="' + esc(d.destination || '') + '"></label>' +
        '<div class="fx-row2"><label class="fx-field fx-label">Days<input class="fx-input" data-r="days" type="number" min="1" max="21" required value="' + esc(d.days && d.days.length || 3) + '"></label><label class="fx-field fx-label">Travelers<input class="fx-input" data-r="travelers" type="number" min="1" max="30" required value="' + esc(d.travelers || 2) + '"></label></div>' +
        '<div class="fx-row2"><label class="fx-field fx-label">Start date (optional)<input class="fx-input" data-r="startDate" type="date" value="' + esc(d.dates && d.dates.start || '') + '"></label><label class="fx-field fx-label">Pace<select class="fx-input" data-r="pace"><option value="relaxed">Relaxed</option><option value="balanced" selected>Balanced</option><option value="active">Full days</option></select></label></div>' +
        '<label class="fx-field fx-label">Caption or context (optional)<textarea class="fx-input" data-r="caption" rows="2" maxlength="1200" placeholder="Anything Friday should know">' + esc(opts.caption || '') + '</textarea></label>' +
        '<label class="fx-check"><input type="checkbox" data-r="destinationConfirmed" required ' + (d.kind === 'reel' ? 'checked' : '') + '> I confirm this is the exact place and destination I want to plan around.</label><p class="fx-error" role="alert" hidden></p><div data-reel-result></div>';
    }
    function showError(text) { var e = body.querySelector('.fx-error'); if (e) { e.textContent = text; e.hidden = false; } }
    function sameOwner() { return (FT.backend && FT.backend.user && FT.backend.user.id) === state.userId; }
    function inputs() { var x = {}; body.querySelectorAll('[data-r]').forEach(function (el) { x[el.dataset.r] = el.type === 'checkbox' ? el.checked : el.value; }); return x; }
    function safeUrl(raw) { var href = webUrl(raw); try { var u = new URL(href); return href && u.hostname.includes('.') ? href : ''; } catch (_) { return ''; } }
    function renderDraft(d) {
      state.draft = d; state.dirty = false;
      var result = body.querySelector('[data-reel-result]'), days = d.days || [];
      var reelHref = d.source && webUrl(d.source.url);
      result.innerHTML = '<section class="fx-integration-card"><strong>' + esc(d.placeName || d.destination) + ' · ' + esc(days.length) + ' days</strong><p>' + esc(d.destination) + ' · ' + esc(d.dates && d.dates.start || 'Date not set') + (d.dates && d.dates.end ? ' to ' + esc(d.dates.end) : '') + ' · ' + esc(d.travelers) + ' travelers</p><p class="fx-hint">No prices or cost estimates are included. Places and schedules need your review; availability and opening hours are not confirmed.</p>' + (reelHref ? '<p>Reel: <a href="' + esc(reelHref) + '" target="_blank" rel="noopener noreferrer">' + esc(reelHref) + '</a> · ' + esc(d.source.status || 'checked') + '</p>' : '') +
      days.map(function (day, di) { return '<article class="fx-integration-card" data-day="' + di + '"><strong>Day ' + (di + 1) + ': ' + esc(day.title || d.destination) + '</strong>' + (day.date ? '<p>' + esc(day.date) + '</p>' : '') + '<label class="fx-field fx-label">Day notes<textarea class="fx-input" data-note="' + di + '" rows="2">' + esc(day.notes || '') + '</textarea></label><ol>' + (day.items || []).map(function (it, ii) { var sourceHref = webUrl(it.sourceUrl), provenance = typeof it.provenance === 'string' ? it.provenance : it.provenance ? JSON.stringify(it.provenance) : ''; return '<li data-stop="' + di + ':' + ii + '"><strong>' + esc(it.title || 'Stop') + '</strong>' + (it.description ? '<p>' + esc(it.description) + '</p>' : '') + (provenance ? '<p class="fx-hint">' + esc(provenance) + '</p>' : '') + (sourceHref ? '<p><a href="' + esc(sourceHref) + '" target="_blank" rel="noopener noreferrer">Source</a></p>' : '') + '<button type="button" class="fx-btn fx-btn--line" data-remove="' + di + ':' + ii + '">Remove stop</button> <button type="button" class="fx-btn fx-btn--line" data-up="' + di + ':' + ii + '" ' + (ii ? '' : 'disabled') + '>Move up</button> <button type="button" class="fx-btn fx-btn--line" data-down="' + di + ':' + ii + '" ' + (ii === (day.items || []).length - 1 ? 'disabled' : '') + '>Move down</button></li>'; }).join('') + '</ol></article>'; }).join('') +
        (d.warnings && d.warnings.length ? '<h3>Review notes</h3><ul>' + d.warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>' : '') + '<label class="fx-field fx-label">Changes for Friday<textarea class="fx-input" data-instructions rows="3">' + esc(d.instructions || '') + '</textarea></label><p class="fx-hint">Describe changes here. Friday can refine listed stops; ask for new places in your notes so they can be researched before inclusion.</p><label class="fx-check"><input type="checkbox" data-review> I reviewed the complete itinerary, dates, travelers, sources and caveats.</label></section>';
      ['url','placeName','destination','days','pace'].forEach(function (key) { var input = body.querySelector('[data-r="' + key + '"]'); if (input) input.disabled = true; });
    }
    function markDirty(e) {
      if (e && e.target.matches('[data-review]')) return;
      if (!state.draft) return; state.dirty = true;
      var dlg = body.closest('[role="dialog"]'); if (dlg) Array.from(dlg.querySelectorAll('button')).filter(function (b) { return b.textContent === 'Send for a human quote'; }).forEach(function (b) { b.disabled = true; });
    }
    function collectDays() {
      var days = state.draft ? state.draft.days.map(function (d) { return Object.assign({}, d, { items: (d.items || []).map(function (x) { return Object.assign({}, x); }) }); }) : [];
      body.querySelectorAll('[data-note]').forEach(function (n) { days[Number(n.dataset.note)].notes = n.value; });
      return days;
    }
    function adoptChanges() {
      var days = collectDays(), action = body._action;
      if (action) { var pieces = action.split(':'), kind = pieces[0], di = Number(pieces[1]), i = Number(pieces[2]), day = days[di]; if (day) { if (kind === 'remove') day.items.splice(i, 1); else { var other = kind === 'up' ? i - 1 : i + 1; if (day.items[i] && day.items[other]) { var tmp = day.items[i]; day.items[i] = day.items[other]; day.items[other] = tmp; } } } body._action = null; }
      state.draft.days = days; state.draft.instructions = body.querySelector('[data-instructions]').value; renderDraft(state.draft); markDirty();
    }
    function saveDraft() {
      var x = inputs(), url = safeUrl(x.url); if (!url) throw new Error('Enter a valid public reel URL.');
      if (!x.placeName.trim() || !x.destination.trim()) throw new Error('Enter the exact place and its city and country.');
      if (!x.destinationConfirmed) throw new Error('Confirm the exact place and destination first.');
      if (!(Number(x.days) >= 1 && Number(x.days) <= 21) || !(Number(x.travelers) >= 1 && Number(x.travelers) <= 30)) throw new Error('Choose 1–21 days and 1–30 travelers.');
      var days = collectDays(); days.forEach(function (d, i) { var n = body.querySelector('[data-note="' + i + '"]'); if (n) d.notes = n.value; });
      return { url: url, placeName: x.placeName.trim(), destination: x.destination.trim(), days: Number(x.days), startDate: x.startDate || undefined, travelers: Number(x.travelers), pace: x.pace, caption: x.caption.trim(), destinationConfirmed: true, allowUnverifiedReel: state.confirmedFallback || undefined, version: state.draft && state.draft.version, draftDays: state.draft ? days : undefined, instructions: state.draft ? body.querySelector('[data-instructions]').value : undefined };
    }
    async function generate() {
      if (state.busy) return; var payload; try { payload = saveDraft(); } catch (e) { showError(e.message); return; } if (!sameOwner()) { showError('Your account changed. Reopen this flow under the current account.'); return; } state.busy = true; var result = body.querySelector('[data-reel-result]'); result.innerHTML = '<p class="fx-hint">Checking the reel and building a sourced itinerary…</p>';
      try {
        var response = state.draft ? await request('/api/friday/reels/' + encodeURIComponent(state.draft.id), 'PATCH', { version: state.draft.version, days: payload.draftDays, instructions: payload.instructions, startDate: payload.startDate || null, travelers: payload.travelers }) : await request('/api/friday/reels', 'POST', payload);
        if (!sameOwner()) throw new Error('Your account changed while Friday was checking the reel. Reopen this flow under the current account.');
        if (response.needsConfirmation) { state.pendingEvidence = response.evidence; var evidence = response.evidence, evidenceText = Array.isArray(evidence) ? evidence.map(function (e) { return typeof e === 'string' ? e : e.message || e.title || JSON.stringify(e); }).join(' · ') : typeof evidence === 'string' ? evidence : evidence ? evidence.message || evidence.summary || JSON.stringify(evidence) : ''; result.innerHTML = '<section class="fx-integration-card"><strong>Friday could not read the reel confidently.</strong><p>' + esc(evidenceText || 'The public post may be unavailable or may not identify the place clearly.') + '</p>' + (response.questions || []).map(function (q) { return '<p>' + esc(q) + '</p>'; }).join('') + '<p>Friday will use the exact place and destination you confirmed, and will label the reel as unverified.</p><button class="fx-btn fx-btn--ink" type="button" data-confirm-fallback>Plan from my confirmed place instead</button></section>'; return; }
        if (!response.draft) throw new Error('Friday did not return an itinerary draft.'); renderDraft(response.draft);
      } catch (e) { showError(e.message || 'Friday could not create this itinerary.'); result.innerHTML = '<p class="fx-hint">Check the reel URL and place details, then try again.</p>'; }
      finally { state.busy = false; }
    }
    body.innerHTML = fields(opts.draft);
    body.addEventListener('click', function (event) {
      var b = event.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-confirm-fallback')) { state.confirmedFallback = true; generate(); }
      else if (b.hasAttribute('data-remove') || b.hasAttribute('data-up') || b.hasAttribute('data-down')) { var kind = b.hasAttribute('data-remove') ? 'remove' : b.hasAttribute('data-up') ? 'up' : 'down'; body._action = kind + ':' + b.getAttribute('data-' + kind); adoptChanges(); }
    });
    var modal = FT.ui.modal({ title: 'Plan from a reel', body: body, actions: [{ label: 'Done' }, { label: 'Create itinerary', primary: true, onClick: function (_, button) { button.disabled = true; generate().finally(function () { button.disabled = false; }); } }, { label: 'Save changes', onClick: async function (_, button) { if (!state.draft || state.busy) return; if (!sameOwner()) { showError('Your account changed. Reopen the draft under the current account.'); return; } button.disabled = true; state.busy = true; try { var p = saveDraft(); var r = await request('/api/friday/reels/' + encodeURIComponent(state.draft.id), 'PATCH', { version: state.draft.version, days: p.draftDays, instructions: p.instructions, startDate: p.startDate || null, travelers: p.travelers }); if (!sameOwner()) throw new Error('Your account changed while changes were saving. Reopen the draft under the current account.'); renderDraft(r.draft || r); } catch (e) { showError(e.message || 'Could not save changes.'); } finally { state.busy = false; button.disabled = false; } } }, { label: 'Send for a human quote', onClick: async function (_, button) {
      if (!state.draft || state.dirty || state.busy) { showError('Save your latest changes before requesting a quote.'); return; }
      if (!sameOwner()) { showError('Your account changed. Reopen the draft under the current account.'); return; }
      if (!body.querySelector('[data-review]').checked) { showError('Review the complete itinerary before requesting a quote.'); return; }
      button.disabled = true; state.busy = true;
      try { var r = await request('/api/friday/handoffs', 'POST', { draftId: state.draft.id, version: state.draft.version, confirmed: true }); if (!sameOwner()) throw new Error('Your account changed while the request was being recorded. Check your account before trying again.'); var handoff = r.handoff || {}, notification = handoff.notification, notificationStatus = notification && (notification.status || notification.state) || handoff.notificationStatus || handoff.emailStatus || 'not provided'; var status = handoff.status || 'queued'; body.querySelector('[data-reel-result]').insertAdjacentHTML('beforeend', '<p role="status">Request status: ' + esc(status) + '. Notification status: ' + esc(notificationStatus) + '. Friday has recorded the request; this status does not confirm delivery.</p>'); }
      catch (e) { showError(e.message || 'The quote request could not be recorded.'); } finally { state.busy = false; button.disabled = false; }
    } }] });
    var send = Array.from(modal.el.querySelectorAll('button')).find(function (b) { return b.textContent === 'Send for a human quote'; }); if (send) send.disabled = true;
    body.addEventListener('input', function (e) { if (state.draft && !e.target.matches('[data-review]')) markDirty(e); });
    body.addEventListener('change', function (e) { if (state.draft && e.target.matches('[data-review]')) { var s = modal.el && Array.from(modal.el.querySelectorAll('button')).find(function (b) { return b.textContent === 'Send for a human quote'; }); if (s) s.disabled = !e.target.checked || state.dirty; } });
    if (opts.draft) renderDraft(opts.draft); else if (opts.draftId) request('/api/friday/drafts').then(function (r) { var d = (r.drafts || []).find(function (x) { return x.id === opts.draftId && x.kind === 'reel'; }); if (d) { body.innerHTML = fields(d); renderDraft(d); } }).catch(showError);
    else request('/api/friday/drafts').then(function (r) { var drafts = (r.drafts || []).filter(function (d) { return d.kind === 'reel'; }); if (!drafts.length) return; var section = doc.createElement('details'); section.className = 'fx-resume'; section.innerHTML = '<summary>Saved reel itineraries</summary>' + drafts.map(function (d) { return '<button class="fx-btn fx-btn--line" type="button" data-load-draft="' + esc(d.id) + '">' + esc(d.placeName || d.destination) + ' · ' + esc((d.dates || {}).start || 'Dates to confirm') + '</button>'; }).join(''); body.insertBefore(section, body.querySelector('.fx-error')); section.addEventListener('click', function (e) { var b = e.target.closest('[data-load-draft]'); if (!b) return; var d = drafts.find(function (x) { return x.id === b.dataset.loadDraft; }); if (!d) return; body.innerHTML = fields(d); renderDraft(d); }); }).catch(function () {});
  }
  FT.reel = { open: open };
})();
