/* Optional account integrations for the authenticated Friday planner.
   Keeps consent, extraction review, and advisory fare checks user initiated. */
(function () {
  'use strict';
  var FT = window.FridayTrip = window.FridayTrip || {};
  var doc = document;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var backend = function () { if (!FT.backend || !FT.backend.user) throw new Error('Sign in to use account integrations.'); return FT.backend; };
  function conversationContext(trip) {
    if (!trip && FT.store && FT.store.trip) trip = FT.store.trip();
    return { conversationId: trip && trip.activeThreadId || 'planner_' + Math.random().toString(36).slice(2, 12), tripId: trip && (trip.serverId || trip.id) || undefined, ownerId:FT.backend&&(FT.backend.user&&FT.backend.user.id||FT.backend.capabilities.auditOwnerId) };
  }
  // Always return a promise so every UI caller can handle a missing session in its normal catch path.
  var request = function (path, method, body) { return Promise.resolve().then(function () { return backend().request(path, method || 'GET', body); }); };
  var notify = function (message, error) { if (FT.ui && FT.ui.toast) FT.ui.toast(message, !!error); };

  function signedOutGuidance(title, message) {
    if (!FT.ui || !FT.ui.modal) return;
    var body = doc.createElement('div');
    body.innerHTML = '<p class="fx-hint">' + esc(message) + '</p><p class="fx-hint">You can sign in or create an account from Account in your planner settings.</p>';
    FT.ui.modal({ title: title, body: body, actions: [
      { label: 'Done' },
      { label: 'Account settings', primary: true, onClick: function (close) { close(); window.location.hash = '#/preferences'; } }
    ] });
  }

  function reviewImport(url, note, onSave) {
    if (!FT.ui || !FT.ui.modal) return Promise.reject(new Error('Friday dialogs are not ready.'));
    var body = doc.createElement('div');
    body.innerHTML = '<p class="fx-hint">Friday will check this public post and suggest only places supported by its cited content. Nothing is saved until you choose.</p><p class="fx-error" role="alert" hidden></p><div data-import-result><p class="fx-hint">Checking the link…</p></div>';
    var close;
    var promise = new Promise(function (resolve) {
      close = FT.ui.modal({ title: 'Review post suggestions', body: body, actions: [
        { label: 'Cancel', onClick: function (c) { c(); resolve(null); } },
        { label: 'Save selected', primary: true, onClick: async function (c, button) {
          if (button.disabled) return;
          button.disabled = true;
          var priorError = body.querySelector('.fx-error'); priorError.hidden = true;
          try {
            var result = body._result;
            if (!result) return;
            var chosen = Array.from(body.querySelectorAll('[data-place-check]:checked')).map(function (el) { return result.places[Number(el.value)]; });
            if (typeof onSave !== 'function') throw new Error('Pass an onSave callback to decide how approved suggestions are stored.');
            await onSave({ url: result.url || url, note: note || '', result: result, places: chosen });
            c(); resolve({ url: result.url || url, result: result, places: chosen });
          } catch (e) { var err = body.querySelector('.fx-error'); err.textContent = e.message || 'Could not save these suggestions.'; err.hidden = false; }
          finally { button.disabled = false; }
        } }
      ], onClose: function () { resolve(null); } });
      backend().extractPost(url, note, conversationContext()).then(function (result) {
        body._result = result;
        var host = '';
        try { host = new URL(result.url || url).hostname; } catch (e) { /* omit */ }
        var places = Array.isArray(result.places) ? result.places : [];
        body.querySelector('[data-import-result]').innerHTML = '<h3>' + esc(result.title || host || 'Saved link') + '</h3>' +
          (result.summary ? '<p>' + esc(result.summary) + '</p>' : '<p class="fx-hint">No verified post summary was available. You can still keep the original link.</p>') +
          (places.length ? '<fieldset class="fx-integration-list"><legend>Places mentioned in this post</legend>' + places.map(function (p, i) { return '<label><input type="checkbox" data-place-check value="' + i + '" checked><span><strong>' + esc(p.title) + '</strong>' + (p.description ? '<br>' + esc(p.description) : '') + '</span></label>'; }).join('') + '</fieldset>' : '<p class="fx-hint">No places could be verified from this post. You can save the link and add your own note.</p>') +
          (Array.isArray(result.sources) && result.sources.length ? '<p class="fx-hint">Verified source: ' + result.sources.map(function (s) { return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.title || s.url) + '</a>'; }).join(' · ') + '</p>' : '');
      }).catch(function (e) { body._result = { url: url, extracted: false, title: '', summary: '', places: [], sources: [] }; var box = body.querySelector('[data-import-result]'); box.innerHTML = '<p class="fx-hint">The link could not be checked. You can still save it as inspiration with your own note.</p>'; var err = body.querySelector('.fx-error'); err.textContent = e.message || 'Post extraction is unavailable.'; err.hidden = false; });
    });
    return promise;
  }

  async function connectionStatus() { return request('/api/integrations/google/status'); }
  function openFridayPlan(opts) {
    opts = opts || {};
    if (!FT.ui || !FT.ui.modal) return;
    if (!FT.backend || !FT.backend.user) { signedOutGuidance('Plan around bookings', 'Sign in to use saved bookings in Friday’s planner. Friday has not started a trip or changed your browser drafts.'); return; }
    var trip = null, snapshot = FT.store && FT.store.get ? FT.store.get() : {};
    if (opts.tripId) trip = (snapshot.trips || []).find(function (t) { return t.serverId === opts.tripId || t.id === opts.tripId; }) || null;
    if (!trip && FT.store && FT.store.trip) trip = FT.store.trip();
    if (!trip && FT.trips && FT.trips.create) { trip = FT.trips.create(); if (FT.trips.open) FT.trips.open(trip.id); }
    var body = doc.createElement('div'), state = { scope: opts.scope || 'upcoming', draft: opts.draft || null, draftFresh: false, text: opts.message || '', answers: Object.assign({}, opts.answers || {}), listings: Array.from(new Set((opts.listingIds || []).concat(opts.draft && opts.draft.listingIds || []))), workflowId: opts.workflowId || ('friday_' + Math.random().toString(36).slice(2, 10)), conversationId:opts.conversationId || opts.workflowId || ('friday_' + Math.random().toString(36).slice(2, 10)), ownerId:opts.ownerId||FT.backend.auditOwnerId };
    function field(label,key,type,value,attrs) { var input = type === 'textarea' ? '<textarea class="fx-input" data-answer="' + esc(key) + '" ' + (attrs || '') + '>' + esc(value || '') + '</textarea>' : '<input class="fx-input" data-answer="' + esc(key) + '" type="' + (type || 'text') + '" value="' + esc(value || '') + '" ' + (attrs || '') + '>'; return '<label class="fx-field fx-label">' + esc(label) + input + '</label>'; }
    function renderIntro() {
      var bookings = FT.store && FT.store.get ? (FT.store.get().bookings || []) : [];
      var ambiguous = bookings.filter(function (b) { return b.dateStatus === 'needs-clarification'; });
      body.innerHTML = '<p class="fx-hint">Confirm the details below.</p>' +
        (ambiguous.length ? '<details class="fx-integration-card"><summary>Review ' + ambiguous.length + ' booking' + (ambiguous.length === 1 ? '' : 's') + ' with unclear dates</summary><p class="fx-hint">Choose the emails to consider and confirm exact dates below.</p>' + ambiguous.map(function (b) { var selected=(state.answers.bookingIds||[]).indexOf(b.serverId||b.id)>=0; return '<label><input type="checkbox" data-booking-choice="' + esc(b.serverId||b.id) + '" ' + (selected?'checked':'') + '><span><strong>' + esc(b.title || b.name || 'Travel booking') + '</strong>' + (b.start || b.end ? ' · ' + esc(b.start || 'date unclear') + (b.end ? ' to ' + esc(b.end) : '') : ' · dates unclear') + '</span></label>'; }).join('') + '</details>' : '') +
        '<label class="fx-field fx-label">Trip request<textarea class="fx-input" data-plan-message rows="2" placeholder="Add a trip or package request">' + esc(state.text) + '</textarea></label>' +
        '<label class="fx-check"><input type="checkbox" data-plan-past ' + (state.scope === 'all' ? 'checked' : '') + '> Include past bookings</label><details class="fx-resume"><summary>Saved drafts</summary><div data-saved-drafts><span class="fx-hint">Loading…</span></div></details><div data-plan-result></div><p class="fx-error" role="alert" hidden></p>';
    }
    function error(message) { var e = body.querySelector('.fx-error'); if (e) { e.textContent = message; e.hidden = false; } }
    async function submit(close) {
      state.text = body.querySelector('[data-plan-message]').value.trim(); state.scope = body.querySelector('[data-plan-past]').checked ? 'all' : 'upcoming';
        body.querySelectorAll('[data-answer]').forEach(function (el) { if (el.dataset.answer === 'bookingIds' && el.value) state.answers.bookingIds = [el.value]; else if (el.type === 'checkbox') state.answers[el.dataset.answer] = el.checked; else state.answers[el.dataset.answer] = el.type === 'number' ? Number(el.value) : el.value; });
      var selectedBookings = Array.from(body.querySelectorAll('[data-booking-choice]:checked')).map(function (el) { return el.dataset.bookingChoice; });
      if (selectedBookings.length) state.answers.bookingIds = selectedBookings;
      state.answers.listingIds = state.listings.slice();
      try {
        var edit = body.querySelector('[data-edit-instructions]');
        state.pendingInstructions = edit ? edit.value : (state.pendingInstructions !== undefined ? state.pendingInstructions : state.draft && state.draft.instructions || state.text || '');
        state.answers.instructions = state.pendingInstructions;
        var payload = { message: state.text || 'Help me plan around my travel bookings', scope: state.scope, answers: state.answers, listingIds: state.listings, conversationId:state.conversationId, ownerId:state.ownerId };
        if (trip && trip.serverId) payload.tripId = trip.serverId;
        if (state.draft) { payload.draftId = state.draft.id; payload.draftVersion = state.draft.version; }
        var result = body.querySelector('[data-plan-result]'); result.innerHTML = '<p class="fx-hint">Checking your bookings and Friday listings…</p>';
        var data = await request('/api/friday/plan', 'POST', payload), questionSet = data.questions || [];
        var remaining = questionSet.filter(function (q) { return q.key !== 'listingIds' && q.required !== false; });
        var canRecommend = !!(state.answers.destination || state.draft && state.draft.destination);
        if (canRecommend && !remaining.length && data.listings && data.listings.length && FT.chat && FT.chat.addFridayRecommendations) {
          FT.chat.addFridayRecommendations(trip && trip.id, state.text, data.listings, { workflowId: state.workflowId, draft: data.draft || state.draft, answers: Object.assign({}, state.answers, { listingIds: state.listings }), scope: state.scope });
          if (!state.listings.length && !state.draft) { close(); if (trip && FT.trips && FT.trips.open) FT.trips.open(trip.id); return; }
        }
        state.draft = data.draft || state.draft; state.draftFresh = !!data.draft && questionSet.length === 0; state.listings = state.listings || [];
        var sendButton = body.closest('[role="dialog"]') && Array.from(body.closest('[role="dialog"]').querySelectorAll('button')).find(function (b) { return b.textContent === 'Send for a human quote'; }); if (sendButton) sendButton.disabled = !state.draftFresh;
        var qLabel = { bookingIds: 'Booking', destination: 'Destination', startDate: 'Start', endDate: 'End', travelers: 'Travelers', budget: 'Budget', flexibleBudget: 'Flexible budget', bookingDateConflict: 'Booking dates' };
        var usable = questionSet.filter(function (q) { return q.key !== 'listingIds'; }), byKey = Object.create(null); usable.forEach(function (q) { byKey[q.key] = q; });
        function questionField(q) { var value = state.answers[q.key] || ''; if (Array.isArray(q.options) && q.options.length) return '<label class="fx-field fx-label">' + esc(qLabel[q.key] || q.label) + '<select class="fx-input" data-answer="' + esc(q.key) + '" ' + (q.required ? 'required' : '') + '><option value="">Choose…</option>' + q.options.map(function (o) { var v = typeof o === 'object' ? (o.value || o.id || o.label) : o, label = typeof o === 'object' ? (o.label || o.title || o.value || o.id) : o; return '<option value="' + esc(v) + '" ' + (String(v) === String(value) ? 'selected' : '') + '>' + esc(label) + (typeof o === 'object' && o.start ? ' · ' + esc(o.start) + (o.end ? '–' + esc(o.end) : '') : '') + '</option>'; }).join('') + '</select></label>' + (q.key === 'bookingDateConflict' ? '<p class="fx-hint">' + esc(q.label) + '</p>' : ''); if (q.key === 'flexibleBudget') return '<label class="fx-check"><input type="checkbox" data-answer="flexibleBudget" ' + (value ? 'checked' : '') + '> ' + esc(qLabel[q.key]) + '</label>'; var attrs = (q.required ? 'required ' : '') + (q.key === 'budget' ? 'placeholder="Amount + currency, or flexible"' : ''); return field(qLabel[q.key] || q.label, q.key, q.key === 'startDate' || q.key === 'endDate' ? 'date' : (q.key === 'travelers' ? 'number' : 'text'), value, attrs) + (q.key === 'bookingDateConflict' ? '<p class="fx-hint">' + esc(q.label) + '</p>' : ''); }
        var questions = usable.filter(function (q) { return ['startDate','endDate','travelers','budget'].indexOf(q.key) < 0; }).map(questionField).join('');
        if (byKey.startDate || byKey.endDate) questions = '<div class="fx-row2">' + (byKey.startDate ? questionField(byKey.startDate) : '<div></div>') + (byKey.endDate ? questionField(byKey.endDate) : '<div></div>') + '</div>' + questions;
        if (byKey.travelers || byKey.budget) questions = '<div class="fx-row2">' + (byKey.travelers ? questionField(byKey.travelers) : '<div></div>') + (byKey.budget ? questionField(byKey.budget) : '<div></div>') + '</div>' + questions;
        var editClarification = questionSet.some(function (q) { return /^instructions_\d+$/.test(q.key); });
        if (editClarification) questions += '<label class="fx-check"><input type="checkbox" data-answer="designerReview" ' + (state.answers.designerReview ? 'checked' : '') + '> Let the travel designer handle this change</label>';
        if (state.draft) state.listings = state.draft.listingIds || state.listings;
        function segmentsMarkup(items) { return (items || []).map(function (s) { var day = s.d || s.day || '', title = s.t || s.title || s.name || 'Travel experience', desc = s.x || s.description || ''; return '<li>' + (day ? '<strong>' + esc(day) + ' · </strong>' : '') + esc(title) + (desc ? ' — ' + esc(desc) : '') + '</li>'; }).join(''); }
        if (data.draft && questionSet.length === 0) {
          state.pendingInstructions = data.draft.instructions || state.pendingInstructions || '';
          Object.keys(state.answers).forEach(function (key) { if (/^instructions_\d+$/.test(key)) delete state.answers[key]; });
          delete state.answers.designerReview;
        }
        var noMatches = canRecommend && !remaining.length && !(data.listings || []).length && !state.listings.length;
        result.innerHTML = (questionSet.length ? '<p class="fx-hint">Add any missing trip details.</p>' : '') + (questions ? '<h3>Trip details</h3>' + questions : '') + (data.text && !questions && !state.draft && !(data.listings || []).length ? '<p class="fx-hint">' + esc(data.text) + '</p>' : '') + (noMatches ? '<p class="fx-hint">No matching Friday listings yet. Change the destination or trip request, then review again.</p><label class="fx-field fx-label">Destination<input class="fx-input" data-answer="destination" value="' + esc(state.answers.destination || '') + '"></label>' : '') + (state.draft ? '<section class="fx-integration-card"><div><strong>Package draft</strong><p>' + esc(state.draft.destination || '') + ' · ' + esc((state.draft.dates || {}).start || '') + '–' + esc((state.draft.dates || {}).end || '') + ' · ' + esc(state.draft.travelers || '') + ' travelers · ' + esc(state.draft.budget || 'Flexible budget') + '</p>' + (state.draft.editSummary ? '<p class="fx-hint">' + esc(state.draft.editSummary) + '</p>' : '') + '<details><summary>Package details</summary>' + (state.draft.items || []).map(function (x) { return '<article><strong>' + esc(x.title) + '</strong>' + (x.editSummary ? '<p>' + esc(x.editSummary) + '</p>' : '') + (x.customizationRequest ? '<p><strong>Requested edits:</strong> ' + esc(x.customizationRequest) + '</p>' : '') + (x.proposedSegments && x.proposedSegments.length ? '<p>Included</p><ul>' + segmentsMarkup(x.proposedSegments) + '</ul>' : '') + (x.removedSegments && x.removedSegments.length ? '<p>Removed</p><ul>' + segmentsMarkup(x.removedSegments) + '</ul>' : '') + '</article>'; }).join('') + '</details><label class="fx-field fx-label">Package changes<textarea class="fx-input" data-edit-instructions rows="2">' + esc(state.pendingInstructions !== undefined ? state.pendingInstructions : state.draft.instructions || '') + '</textarea></label></div></section>' : '');
        result.querySelectorAll('[data-answer]').forEach(function (el) { el.addEventListener('change', function () { state.answers[el.dataset.answer] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : (el.dataset.answer === 'bookingIds' ? [el.value] : el.value); }); });
      } catch (e) { result.innerHTML = ''; error(e.message || 'Friday could not check this request.'); }
    }
    renderIntro();
    var close = FT.ui.modal({ title: 'Plan around bookings', body: body, actions: [
      { label: 'Done' },
      { label: 'Review with Friday', primary: true, onClick: function (c, button) { button.disabled = true; submit(c).finally(function () { button.disabled = false; }); } },
      { label: 'Send for a human quote', onClick: async function (c, button) {
        if (!state.draft || !state.draftFresh) { error('Review the latest version with Friday before sending it for a quote.'); return; }
        button.disabled = true;
        try { var r = await request('/api/friday/handoffs', 'POST', { draftId: state.draft.id, version: state.draft.version, confirmed: true }); if (window.FridayQuoteAnalytics) window.FridayQuoteAnalytics.track(window.FridayQuoteAnalytics.plannerPath(), r.handoff && r.handoff.id); body.querySelector('[data-plan-result]').insertAdjacentHTML('beforeend', '<p role="status">Sent to Friday’s team for a quote. Status: ' + esc(r.handoff.status) + (r.handoff.customerEmail ? ' · Customer email: ' + esc(r.handoff.customerEmail) : '') + '</p>'); }
        catch (e) { error(e.message || 'Could not send this draft.'); } finally { button.disabled = false; }
      } }
    ] });
    var sendQuoteButton = Array.from(close.el.querySelectorAll('button')).find(function (b) { return b.textContent === 'Send for a human quote'; }); if (sendQuoteButton) sendQuoteButton.disabled = true;
    function clearDesignerReview() { delete state.answers.designerReview; var choice = body.querySelector('[data-answer="designerReview"]'); if (choice) choice.checked = false; }
    function markDraftDirty() { if (!state.draft) return; state.draftFresh = false; var dlg = body.closest('[role="dialog"]'), send = dlg && Array.from(dlg.querySelectorAll('button')).find(function (b) { return b.textContent === 'Send for a human quote'; }); if (send) send.disabled = true; }
    body.addEventListener('input', function (e) { if (e.target.matches('[data-edit-instructions]')) state.text = e.target.value; if (e.target.matches('[data-edit-instructions], [data-plan-message]')) clearDesignerReview(); markDraftDirty(); });
    body.addEventListener('change', function (e) { if (e.target.matches('[data-edit-instructions]')) clearDesignerReview(); markDraftDirty(); });
    request('/api/friday/drafts').then(function (r) { var drafts = (r.drafts || []).filter(function (d) { return d.kind !== 'reel'; }), slot = body.querySelector('[data-saved-drafts]'); if (!slot) return; slot.innerHTML = drafts.length ? drafts.map(function (d) { return '<button class="fx-btn fx-btn--line" type="button" data-resume-draft="' + esc(d.id) + '">' + esc(d.destination || 'Trip draft') + ' · ' + esc((d.dates || {}).start || 'Dates to confirm') + '</button>'; }).join('') : '<span class="fx-hint">No saved package drafts.</span>'; slot.addEventListener('click', function (e) { var b = e.target.closest('[data-resume-draft]'); if (!b) return; var d = drafts.find(function (x) { return x.id === b.dataset.resumeDraft; }); if (d) { state.draft = d; state.draftFresh = false; state.answers = { destination: d.destination, startDate: d.dates && d.dates.start, endDate: d.dates && d.dates.end, travelers: d.travelers, budget: d.budget, listingIds: d.listingIds || [] }; state.listings = d.listingIds || []; state.pendingInstructions = d.instructions || ''; state.text = d.instructions || ''; renderIntro(); body.querySelector('[data-plan-message]').value = 'Continue editing this saved travel package'; } }); }).catch(function () {});
    return close;
  }
  async function openConnections(opts) {
    opts = opts || {};
    if (!FT.backend || !FT.backend.user) { signedOutGuidance('Email connection', 'Sign in to connect email and manage private booking confirmations. Friday has not accessed your mailbox.'); return; }
    var body = doc.createElement('div');
    body.innerHTML = '<p class="fx-hint">By connecting, you agree to Friday’s <a href="terms.html">Terms of Use</a> and <a href="privacy.html">Privacy Policy</a>. Friday will only read Gmail messages matching travel-confirmation searches and, when you sync, up to 100 upcoming events from your primary Calendar during the next two years. The first Gmail scan searches up to 300 matching messages. Both connections are read-only: Friday never sends mail or changes calendar events. Later syncs happen only when you ask.</p><div data-google-status><p class="fx-hint">Loading connection status…</p></div><p class="fx-error" role="alert" hidden></p>';
    function error(message) { var e = body.querySelector('.fx-error'); e.textContent = message; e.hidden = false; }
    function render(data) {
      var connected = (data.connections || []).reduce(function (m, x) { m[x.kind] = x; return m; }, {});
      body.querySelector('[data-google-status]').innerHTML = (!data.configured ? '<p class="fx-hint">Email connection isn’t available yet. You can still add bookings by hand.</p>' : '') +
        ['gmail', 'calendar'].map(function (kind) {
          var label = kind === 'gmail' ? 'Gmail' : 'Calendar', c = connected[kind];
          return '<section class="fx-integration-card"><div><strong>' + label + '</strong><p class="fx-hint">' + (c ? (kind === 'gmail' ? 'Connected with read-only access. Friday checks upcoming and ongoing travel bookings; unclear dates need your review.' : 'Connected with read-only access.') : 'Not connected.') + '</p></div><div class="fx-integration-actions">' +
            (c ? '<button class="fx-btn fx-btn--line" type="button" data-google-sync="' + kind + '">Sync confirmations</button><button class="fx-btn fx-btn--line" type="button" data-google-disconnect="' + kind + '">Disconnect</button>' : '<button class="fx-btn fx-btn--ink" type="button" data-google-connect="' + kind + '" ' + (!data.configured ? 'disabled' : '') + '>Connect ' + label + '</button>') + '</div></section>';
        }).join('');
    }
    var fridayStatus = await request('/api/friday/status').catch(function () { return { quoteAdmin: false }; });
    var actions = [{ label: 'Done' }, { label: 'Plan around bookings', primary: true, onClick: function (c) { c(); openFridayPlan({ tripId: opts.tripId }); } }];
    if (fridayStatus.quoteAdmin) actions.push({ label: 'Quote queue', onClick: function (c) { c(); openQuoteQueue(); } });
    var close = FT.ui.modal({ title: 'Connections', body: body, actions: actions });
    body.addEventListener('click', async function (event) {
      var button = event.target.closest('button'); if (!button) return;
      var kind = button.getAttribute('data-google-connect') || button.getAttribute('data-google-sync') || button.getAttribute('data-google-disconnect');
      if (!kind) return;
      button.disabled = true;
      try {
        if (button.hasAttribute('data-google-connect')) {
          var start = await request('/api/integrations/google/start', 'POST', { kind: kind });
          if (!start.authorizationUrl) throw new Error('Google did not provide a consent page.');
          window.location.assign(start.authorizationUrl); return;
        }
        if (button.hasAttribute('data-google-sync')) {
          var synced = await request('/api/integrations/google/sync', 'POST', { kind: kind, tripId: opts.tripId || undefined });
          if (backend().refresh) await backend().refresh();
          notify((synced.imported || 0) + ' travel records imported from ' + (kind === 'gmail' ? 'Gmail' : 'Calendar'));
        } else {
          var accepted = await FT.ui.confirm('Disconnect ' + (kind === 'gmail' ? 'Gmail' : 'Calendar') + ' from Friday?', { title: 'Disconnect Google account', okLabel: 'Disconnect', danger: true });
          if (!accepted) return;
          await request('/api/integrations/google/disconnect', 'POST', { kind: kind });
        }
        render(await connectionStatus());
        if (typeof opts.onChange === 'function') opts.onChange();
      } catch (e) { error(e.message || 'Google connection could not be updated.'); }
      finally { button.disabled = false; }
    });
    try { render(await connectionStatus()); } catch (e) { error(e.message || 'Could not load Google connection status.'); }
    return close;
  }

  function openQuoteQueue() {
    var body = doc.createElement('div');
    body.innerHTML = '<p class="fx-hint">Review each customer request, set a quote, then check the exact email preview before sending.</p><div data-quote-queue><p class="fx-hint">Loading quote requests…</p></div><p class="fx-error" role="alert" hidden></p>';
    var close = FT.ui.modal({ title: 'Human quote queue', body: body, actions: [{ label: 'Done' }] });
    request('/api/admin/quotes').then(function (data) {
      var quotes = data.quotes || [];
      body.querySelector('[data-quote-queue]').innerHTML = quotes.length ? quotes.map(function (q) { var attempted = ['provider_accepted','delivery_unknown','sent'].indexOf(q.status) >= 0, snap = q.snapshot || {}; var items = snap.items || []; var details = items.map(function (i) { var seg = function (xs) { return (xs || []).map(function (s) { return '<li>' + esc(s.d ? s.d + ' · ' : '') + esc(s.t || s.title || s.name || 'Travel experience') + (s.x ? ' — ' + esc(s.x) : '') + '</li>'; }).join(''); }; return '<article><strong>' + esc(i.title) + '</strong><p>' + esc(i.description || '') + '</p>' + (i.customizationRequest ? '<p><strong>Requested changes:</strong> ' + esc(i.customizationRequest) + '</p>' : '') + (i.proposedSegments && i.proposedSegments.length ? '<p>Included</p><ul>' + seg(i.proposedSegments) + '</ul>' : '') + (i.removedSegments && i.removedSegments.length ? '<p>Removed</p><ul>' + seg(i.removedSegments) + '</ul>' : '') + '</article>'; }).join('');
        if (snap.kind === 'reel') { details = (snap.days || []).map(function (day, index) { return '<article><strong>Day ' + (index + 1) + ': ' + esc(day.title || snap.destination) + '</strong>' + (day.date ? '<p>' + esc(day.date) + '</p>' : '') + (day.notes ? '<p>' + esc(day.notes) + '</p>' : '') + '<ol>' + (day.items || []).map(function (it) { return '<li><strong>' + esc(it.title || 'Stop') + '</strong>' + (it.description ? '<p>' + esc(it.description) + '</p>' : '') + (it.provenance ? '<p>' + esc(it.provenance) + '</p>' : '') + (it.sourceUrl ? '<p><a href="' + esc(it.sourceUrl) + '" target="_blank" rel="noopener noreferrer">Source</a></p>' : '') + '</li>'; }).join('') + '</ol></article>'; }).join('') + (snap.source ? '<p>Reel source: ' + esc(snap.source.status || '') + ' · <a href="' + esc(snap.source.url || '') + '" target="_blank" rel="noopener noreferrer">' + esc(snap.source.url || '') + '</a></p>' : '') + (snap.warnings && snap.warnings.length ? '<strong>Review notes</strong><ul>' + snap.warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>' : '') + '<p><strong>Requested changes:</strong> ' + esc(snap.instructions || 'None') + '</p>'; }
        return '<section class="fx-integration-card" data-quote-card="' + esc(q.id) + '"><div><strong>' + esc(q.customerEmail || 'Customer') + '</strong><p>' + esc(snap.placeName || snap.destination || q.destination || 'Travel package') + ' · ' + esc((snap.dates && snap.dates.start) || '') + ' to ' + esc((snap.dates && snap.dates.end) || '') + (snap.travelers ? ' · ' + esc(snap.travelers) + ' travelers' : '') + '</p><details><summary>' + (snap.kind === 'reel' ? 'Review complete reel itinerary' : 'Review requested package') + '</summary>' + details + '<p>' + esc(snap.instructions || '') + '</p></details>' + (attempted ? '<p role="status">Status: ' + esc(q.status) + ' · This request cannot be sent again.</p>' : '<button class="fx-btn fx-btn--ink" type="button" data-quote="' + esc(q.id) + '">Prepare quote</button>') + '</div></section>'; }).join('') : '<p class="fx-hint">No quote requests are waiting.</p>';
      body.querySelectorAll('[data-quote]').forEach(function (button) { button.addEventListener('click', function () {
        var q = quotes.find(function (x) { return x.id === button.dataset.quote; }); if (!q) return;
        var quoteBody = doc.createElement('div'), previewHash = null;
        quoteBody.innerHTML = '<p><strong>To:</strong> ' + esc(q.customerEmail || 'Customer email unavailable') + '</p><label class="fx-field fx-label">Amount<input class="fx-input" type="number" min="0" step="0.01" data-amount required></label><label class="fx-field fx-label">Currency<select class="fx-input" data-currency><option>USD</option><option>EUR</option><option>GBP</option><option>INR</option></select></label><label class="fx-field fx-label">Quote details<textarea class="fx-input" data-details rows="4" required></textarea></label><button class="fx-btn fx-btn--line" type="button" data-preview>Generate exact email preview</button><section class="fx-integration-card"><strong>Email preview</strong><pre data-email-preview>Generate a preview before sending.</pre></section><p class="fx-error" role="alert" hidden></p>';
        function values() { return { amount: Number(quoteBody.querySelector('[data-amount]').value), currency: quoteBody.querySelector('[data-currency]').value, details: quoteBody.querySelector('[data-details]').value.trim() }; }
        quoteBody.addEventListener('input', function () { previewHash = null; var send = quoteBody.closest('[role="dialog"]') && Array.from(quoteBody.closest('[role="dialog"]').querySelectorAll('button')).find(function (x) { return x.textContent === 'Send quoted price'; }); if (send) send.disabled = true; });
        var quoteClose = FT.ui.modal({ title: 'Prepare customer quote', body: quoteBody, actions: [{ label: 'Cancel' }, { label: 'Send quoted price', primary: true, onClick: async function (c, send) {
          var v = values(); if (!(v.amount > 0) || !v.details || !previewHash) { var err = quoteBody.querySelector('.fx-error'); err.textContent = 'Enter a valid quote and generate its exact email preview before sending.'; err.hidden = false; return; }
          send.disabled = true;
          try { var sent = await request('/api/admin/quotes/' + encodeURIComponent(q.id) + '/send', 'POST', Object.assign({}, v, { previewHash: previewHash })); q.status = sent.quote && sent.quote.status || 'delivery_unknown'; var card = Array.from(body.querySelectorAll('[data-quote-card]')).find(function (x) { return x.dataset.quoteCard === q.id; }); if (card) { var action = card.querySelector('[data-quote]'); if (action) action.remove(); card.querySelector('div').insertAdjacentHTML('beforeend', '<p role="status">Status: ' + esc(q.status) + '. Provider acceptance does not confirm delivery.</p>'); } c(); }
          catch (e) { var err = quoteBody.querySelector('.fx-error'); err.textContent = e.message || 'Quote could not be sent.'; err.hidden = false; send.disabled = false; }
        } }] });
        var initiallyDisabledSend = Array.from(quoteClose.el.querySelectorAll('button')).find(function (x) { return x.textContent === 'Send quoted price'; }); if (initiallyDisabledSend) initiallyDisabledSend.disabled = true;
        quoteBody.addEventListener('change', function () { previewHash = null; var dlg = quoteBody.closest('[role="dialog"]'), send = dlg && Array.from(dlg.querySelectorAll('button')).find(function (x) { return x.textContent === 'Send quoted price'; }); if (send) send.disabled = true; });
        quoteBody.querySelector('[data-preview]').addEventListener('click', async function (event) { var previewButton = event.currentTarget, v = values(); if (!(v.amount > 0) || !v.details) { var err = quoteBody.querySelector('.fx-error'); err.textContent = 'Enter a valid price and quote details.'; err.hidden = false; return; } previewButton.disabled = true; try { var result = await request('/api/admin/quotes/' + encodeURIComponent(q.id) + '/preview', 'POST', v); previewHash = result.preview.previewHash; quoteBody.querySelector('[data-email-preview]').textContent = 'To: ' + result.preview.to + '\nSubject: ' + result.preview.subject + '\n\n' + result.preview.text; var dlg = quoteBody.closest('[role="dialog"]'), send = dlg && Array.from(dlg.querySelectorAll('button')).find(function (x) { return x.textContent === 'Send quoted price'; }); if (send) send.disabled = false; } catch (e) { var err = quoteBody.querySelector('.fx-error'); err.textContent = e.message || 'Preview could not be generated.'; err.hidden = false; } finally { previewButton.disabled = false; } });
      }); });
    }).catch(function (e) { body.querySelector('[data-quote-queue]').textContent = e.message || 'Could not load the quote queue.'; });
    return close;
  }

  function checkFare(alert) {
    if (!FT.ui || !FT.ui.modal) return Promise.reject(new Error('Friday dialogs are not ready.'));
    var body = doc.createElement('div');
    body.innerHTML = '<p class="fx-hint">This is an on-demand web research advisory. It does not check supplier inventory, confirm a fare, match a target price, or run automatically.</p><div class="fx-integration-result" data-fare-result></div><p class="fx-error" role="alert" hidden></p>';
    var close;
    return new Promise(function (resolve, reject) {
      close = FT.ui.modal({ title: 'Check route research', body: body, actions: [
        { label: 'Close' },
        { label: 'Check now', primary: true, onClick: async function (c, button) {
          button.disabled = true; var priorError = body.querySelector('.fx-error'); priorError.hidden = true; var resultBox = body.querySelector('[data-fare-result]'); resultBox.innerHTML = '<p class="fx-hint">Checking current sources…</p>';
          try {
            var result = await backend().checkFareAlert(alert,conversationContext());
            resultBox.innerHTML = '<p>' + esc(result.text || 'No advisory was returned.') + '</p><p class="fx-hint">Checked ' + esc(result.checkedAt || '') + ' · Advisory only; availability and target-price status are unknown.</p>' + (result.sources || []).map(function (s) { return '<p><a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.title || s.url) + '</a></p>'; }).join('');
            resolve(result);
          } catch (e) { resultBox.innerHTML = '<p class="fx-hint">The advisory could not be checked. Try again when research is available.</p>'; var err = body.querySelector('.fx-error'); err.textContent = e.message || 'Could not check this route.'; err.hidden = false; }
          finally { button.disabled = false; }
        } }
      ], onClose: function () { resolve(null); } });
    });
  }

  function watchRecordId() { return 'fw_' + Math.random().toString(36).slice(2, 10); }
  function openFareWatch(existing) {
    if (!FT.ui || !FT.ui.modal || !FT.store) throw new Error('Friday planner is not ready.');
    var profile = backend().user.profile || {};
    var airports = Array.isArray(profile.airports) ? profile.airports : [];
    var originOptions = airports.map(function (code) { return '<option value="' + esc(code) + '" ' + (existing && existing.origin === code ? 'selected' : '') + '>' + esc(code) + '</option>'; }).join('');
    if (existing && !airports.includes(existing.origin)) originOptions += '<option selected value="' + esc(existing.origin) + '">' + esc(existing.origin) + '</option>';
    var body = doc.createElement('div');
    body.className = 'fx-form';
    body.innerHTML = '<p class="fx-hint">Friday can run an on-demand web research advisory for this route. It cannot monitor supplier inventory, confirm current fares, or notify you automatically.</p>' +
      '<div class="fx-field"><label class="fx-label" for="fw-origin">Departure airport</label><select class="fx-input" id="fw-origin">' + originOptions + '</select></div>' +
      '<div class="fx-field"><label class="fx-label" for="fw-destination">Destination</label><input class="fx-input" id="fw-destination" maxlength="120" value="' + esc(existing && existing.destination || '') + '" placeholder="City or airport code"></div>' +
      '<div class="fx-field"><label class="fx-label" for="fw-depart">Departure date</label><input class="fx-input" id="fw-depart" type="date" value="' + esc(existing && existing.departDate || '') + '"></div>' +
      '<div class="fx-field"><label class="fx-label" for="fw-return">Return date (optional)</label><input class="fx-input" id="fw-return" type="date" value="' + esc(existing && existing.returnDate || '') + '"></div>' +
      '<div class="fx-field"><label class="fx-label" for="fw-currency">Currency</label><input class="fx-input" id="fw-currency" maxlength="3" value="' + esc(existing && existing.currency || 'USD') + '" placeholder="USD"></div>' +
      '<div class="fx-field"><label class="fx-label" for="fw-target">Target price (optional)</label><input class="fx-input" id="fw-target" type="number" min="0" step="0.01" value="' + esc(existing && existing.targetPrice != null ? existing.targetPrice : '') + '"></div>' +
      '<p class="fx-error" role="alert" hidden></p>';
    function getValues() {
      var origin = body.querySelector('#fw-origin').value.trim().toUpperCase();
      var destination = body.querySelector('#fw-destination').value.trim();
      var departDate = body.querySelector('#fw-depart').value;
      var returnDate = body.querySelector('#fw-return').value;
      var currency = body.querySelector('#fw-currency').value.trim().toUpperCase();
      var rawTarget = body.querySelector('#fw-target').value;
      var targetPrice = rawTarget === '' ? null : Number(rawTarget);
      var validDate = function (value) { if (!value) return true; if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; var time = Date.parse(value + 'T00:00:00Z'); return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value; };
      if (!origin) throw new Error('Set a home city and choose a departure airport first.');
      if (!destination) throw new Error('Add a destination.');
      if (!departDate || !validDate(departDate)) throw new Error('Choose a valid departure date.');
      if (!validDate(returnDate) || returnDate && departDate && returnDate < departDate) throw new Error('Choose a return date on or after departure.');
      if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Enter a three-letter currency code.');
      if (targetPrice !== null && (!Number.isFinite(targetPrice) || targetPrice < 0)) throw new Error('Enter a valid target price.');
      return { kind: 'fare-watch', title: origin + ' → ' + destination, origin: origin, destination: destination, departDate: departDate, returnDate: returnDate, currency: currency, targetPrice: targetPrice, at: new Date().toISOString(), done: false, text: 'On-demand advisory only; no live fare monitoring.' };
    }
    return new Promise(function (resolve) {
      FT.ui.modal({ title: existing ? 'Edit fare watch' : 'Watch a route', body: body, actions: [
        { label: 'Cancel' },
        { label: existing ? 'Save changes' : 'Save route', primary: true, onClick: function (close) {
          try {
            var values = getValues();
            FT.store.update(function (state) {
              if (existing) { var prior = state.notifications.find(function (x) { return x.id === existing.id; }); if (prior) Object.assign(prior, values); }
              else state.notifications.unshift(Object.assign({ id: watchRecordId() }, values));
            });
            close(); resolve(values);
          } catch (e) { var error = body.querySelector('.fx-error'); error.textContent = e.message; error.hidden = false; }
        } }
      ], onClose: function () { resolve(null); } });
    });
  }

  function openFareWatches() {
    if (!FT.ui || !FT.ui.modal || !FT.store) throw new Error('Friday planner is not ready.');
    var body = doc.createElement('div');
    function watches() { var state = FT.store.get(); return (state.notifications || []).filter(function (x) { return x.kind === 'fare-watch'; }); }
    function render() {
      var list = watches();
      body.innerHTML = '<p class="fx-hint">Route reminders are saved to your account. Checks are on demand and advisory; no background supplier polling or notifications are active.</p>' +
        (list.length ? '<div class="fx-integration-list">' + list.map(function (w) { return '<article class="fx-integration-card"><div><strong>' + esc(w.origin) + ' → ' + esc(w.destination) + '</strong><p class="fx-hint">' + esc(w.departDate || 'Dates not set') + (w.returnDate ? ' – ' + esc(w.returnDate) : '') + (w.targetPrice != null ? ' · Target ' + esc(w.currency || 'USD') + ' ' + esc(w.targetPrice) : '') + '</p></div><div class="fx-integration-actions"><button class="fx-btn fx-btn--line" type="button" data-fare-edit="' + esc(w.id) + '">Edit</button><button class="fx-btn fx-btn--line" type="button" data-fare-check="' + esc(w.id) + '">Check now</button><button class="fx-btn fx-btn--line" type="button" data-fare-remove="' + esc(w.id) + '">Remove</button></div></article>'; }).join('') + '</div>' : '<p class="fx-hint">No saved routes yet.</p>') + '<p class="fx-error" role="alert" hidden></p>';
    }
    render();
    var close = FT.ui.modal({ title: 'Fare watches', body: body, actions: [{ label: 'Done' }, { label: 'Add a route', primary: true, onClick: function () { openFareWatch().then(render); } }] });
    body.addEventListener('click', async function (event) {
      var button = event.target.closest('button'); if (!button) return;
      var watch = watches().find(function (x) { return x.id === (button.getAttribute('data-fare-edit') || button.getAttribute('data-fare-check') || button.getAttribute('data-fare-remove')); });
      if (!watch) return;
      if (button.hasAttribute('data-fare-edit')) { await openFareWatch(watch); render(); }
      else if (button.hasAttribute('data-fare-remove')) {
        var yes = await FT.ui.confirm('Remove this saved route?', { title: 'Remove fare watch', okLabel: 'Remove', danger: true });
        if (yes) { FT.store.update(function (state) { state.notifications = state.notifications.filter(function (x) { return x.id !== watch.id; }); }); render(); }
      } else {
        button.disabled = true;
        try { await checkFare(watch); } catch (e) { var err = body.querySelector('.fx-error'); if (err) { err.textContent = e.message || 'Could not check route.'; err.hidden = false; } }
        finally { button.disabled = false; }
      }
    });
    return close;
  }

  function editMemory(existing) {
    if (!FT.ui || !FT.ui.modal || !FT.store) throw new Error('Friday planner is not ready.');
    var body = doc.createElement('div'); body.className = 'fx-form';
    body.innerHTML = '<p class="fx-hint">Only add details you want Friday to remember. Memories are not inferred from your travel activity.</p><div class="fx-field"><label class="fx-label" for="fm-text">What should Friday remember?</label><textarea class="fx-input" id="fm-text" rows="4" maxlength="1000">' + esc(existing && (existing.text || existing.notes) || '') + '</textarea></div><div class="fx-field"><label class="fx-label" for="fm-city">City (optional)</label><input class="fx-input" id="fm-city" maxlength="120" value="' + esc(existing && existing.city || '') + '"></div><p class="fx-error" role="alert" hidden></p>';
    return new Promise(function (resolve) {
      FT.ui.modal({ title: existing ? 'Edit a memory' : 'Add a memory', body: body, actions: [
        { label: 'Cancel' }, { label: existing ? 'Save memory' : 'Remember this', primary: true, onClick: function (close) {
          var text = body.querySelector('#fm-text').value.trim(), city = body.querySelector('#fm-city').value.trim();
          if (!text) { var error = body.querySelector('.fx-error'); error.textContent = 'Add a detail you want Friday to remember.'; error.hidden = false; return; }
          FT.store.update(function (state) {
            if (existing) { var item = state.memory.find(function (x) { return x.id === existing.id; }); if (item) { item.text = text; item.city = city; item.at = new Date().toISOString(); } }
            else state.memory.unshift({ id: 'mem_' + Math.random().toString(36).slice(2, 10), text: text, city: city, at: new Date().toISOString() });
          }); close(); resolve(true);
        } }
      ], onClose: function () { resolve(false); } });
    });
  }

  function openMemories() {
    if (!FT.ui || !FT.ui.modal || !FT.store) throw new Error('Friday planner is not ready.');
    var body = doc.createElement('div');
    function list() { return FT.store.get().memory || []; }
    function render() {
      var memories = list();
      body.innerHTML = '<p class="fx-hint">Friday uses only details you choose to save here.</p>' + (memories.length ? '<div class="fx-integration-list">' + memories.map(function (m) { return '<article class="fx-integration-card"><div><strong>' + esc(m.city || 'Travel preference') + '</strong><p>' + esc(m.text || m.notes || '') + '</p></div><div class="fx-integration-actions"><button class="fx-btn fx-btn--line" type="button" data-memory-edit="' + esc(m.id) + '">Edit</button><button class="fx-btn fx-btn--line" type="button" data-memory-remove="' + esc(m.id) + '">Remove</button></div></article>'; }).join('') + '</div>' : '<p class="fx-hint">No memories saved.</p>');
    }
    render();
    var close = FT.ui.modal({ title: 'Friday memory', body: body, actions: [{ label: 'Done' }, { label: 'Add a memory', primary: true, onClick: function () { editMemory().then(render); } }] });
    body.addEventListener('click', async function (event) {
      var button = event.target.closest('button'); if (!button) return;
      var memory = list().find(function (x) { return x.id === (button.getAttribute('data-memory-edit') || button.getAttribute('data-memory-remove')); });
      if (!memory) return;
      if (button.hasAttribute('data-memory-edit')) { await editMemory(memory); render(); }
      else if (await FT.ui.confirm('Remove this memory from Friday?', { title: 'Remove memory', okLabel: 'Remove', danger: true })) { FT.store.update(function (state) { state.memory = state.memory.filter(function (x) { return x.id !== memory.id; }); }); render(); }
    });
    return close;
  }

  FT.integrations = { reviewImport: reviewImport, openConnections: openConnections, openFridayPlan: openFridayPlan, shouldUseFridayPlan: function (text) { return /\b(villas?|(?:travel\s+)?packages?)\b/i.test(text || '') || /\b(my|existing|upcoming|these|the)\s+(bookings?|reservations?|confirmations?)\b/i.test(text || '') || /\b(plan|work around|use)\b.{0,80}\b(bookings?|reservations?|confirmations?)\b/i.test(text || ''); }, shouldDecline: function (text) { var s = String(text || ''); if (/\b(trip|travel|booking|villa|package|hotel|reservation|itinerary|visa|airport|flight|destination|nights?)\b/i.test(s)) return false; return /\b(write|generate|debug|review|explain|build|fix|compose|draft)\b.{0,60}\b(code|python|javascript|typescript|sql|program|script|software|app|poem|essay|short story|recipe)\b|\b(homework help|help with homework|solve (this )?(equation|math problem)|political debate|stock price|medical diagnosis)\b/i.test(s); }, connectionStatus: connectionStatus, checkFare: checkFare, openFareWatch: openFareWatch, openFareWatches: openFareWatches, editMemory: editMemory, openMemories: openMemories };
})();
