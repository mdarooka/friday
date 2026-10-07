/* Friday Operations Console: client controller */
(function () {
  'use strict';

  var $ = function (selector, context) { return (context || document).querySelector(selector); };
  var $$ = function (selector, context) { return Array.prototype.slice.call((context || document).querySelectorAll(selector)); };

  var esc = function (val) {
    return String(val == null ? '' : val).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  };

  var QUOTE_REPLY_SLA_HOURS = 30;

  var safeUrl = function (url) {
    try {
      var u = new URL(url, location.href);
      return ['http:', 'https:'].indexOf(u.protocol) >= 0 ? u.href : '';
    } catch (e) {
      return '';
    }
  };

  var formatDate = function (iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return String(iso);
    }
  };

  var badge = function (status) {
    var s = String(status || 'unknown').toLowerCase();
    return '<span class="admin-badge badge--' + esc(s) + '">' + esc(status || 'unknown') + '</span>';
  };

  var empty = function (text) {
    return '<p class="villa-state">' + esc(text) + '</p>';
  };

  /* Application state */
  var state = {
    user: null,
    capabilities: {},
    setup: {},
    activeTab: 'villas',
    selectedVillaId: null,
    selectedQuoteId: null,
    selectedAiEventKey: null,
    briefings: [],
    dataRequests: [],
    emailConfigured: false,
    quotes: [],
    aiEvents: [],
    aiNextBefore: null,
    currentPreview: null
  };

  /* Elements */
  var dom = {};

  function cacheDom() {
    dom.page = $('[data-admin-page="hub"]');
    if (!dom.page) return false;
    dom.userBar = $('[data-admin-user-bar]', dom.page);
    dom.userName = $('[data-admin-user-name]', dom.page);
    dom.logoutBtn = $('[data-admin-logout]', dom.page);
    dom.login = $('[data-admin-login]', dom.page);
    dom.loginForm = $('[data-admin-login-form]', dom.page);
    dom.loginNote = $('[data-admin-login-note]', dom.page);
    dom.state = $('[data-admin-state]', dom.page);
    dom.workspace = $('[data-admin-workspace]', dom.page);
    dom.tabs = $$('.admin-tab', dom.page);
    dom.panels = $$('.admin-panel', dom.page);

    /* Villas */
    dom.villaList = $('[data-admin-villas]', dom.page);
    dom.villaEditor = $('[data-villa-editor]', dom.page);
    dom.villaNewBtn = $('[data-villa-new]', dom.page);
    dom.curatedList = $('[data-curated-list]', dom.page);
    dom.addCuratedBtn = $('[data-add-curated]', dom.page);
    dom.saveVillaBtn = $('[data-save-villa]', dom.page);
    dom.publishVillaBtn = $('[data-publish-villa]', dom.page);
    dom.deleteVillaBtn = $('[data-delete-villa]', dom.page);
    dom.cancelEditorBtn = $('[data-cancel-editor]', dom.page);
    dom.editorNote = $('[data-editor-note]', dom.page);
    dom.editorKicker = $('[data-editor-kicker]', dom.page);
    dom.editorTitle = $('[data-editor-title]', dom.page);
    dom.submissions = $('[data-admin-submissions]', dom.page);

    /* Quotes */
    dom.quoteSetupNote = $('[data-quote-setup-note]', dom.page);
    dom.quotesList = $('[data-admin-quotes]', dom.page);
    dom.quoteDrawer = $('[data-quote-drawer]', dom.page);
    dom.closeQuoteDrawerBtn = $('[data-close-quote-drawer]', dom.page);
    dom.quoteTitle = $('[data-quote-title]', dom.page);
    dom.quoteSummaryInfo = $('[data-quote-summary-info]', dom.page);
    dom.quoteForm = $('[data-quote-form]', dom.page);
    dom.previewQuoteBtn = $('[data-preview-quote-btn]', dom.page);
    dom.quotePreviewBox = $('[data-quote-preview-box]', dom.page);
    dom.previewTo = $('[data-preview-to]', dom.page);
    dom.previewSubject = $('[data-preview-subject]', dom.page);
    dom.previewText = $('[data-preview-text]', dom.page);
    dom.sendQuoteBtn = $('[data-send-quote-btn]', dom.page);
    dom.quoteNote = $('[data-quote-note]', dom.page);

    /* AI Review */
    dom.aiFilterForm = $('[data-ai-filter-form]', dom.page);
    dom.aiFilterResetBtn = $('[data-ai-filter-reset]', dom.page);
    dom.aiList = $('[data-admin-ai-list]', dom.page);
    dom.aiInspector = $('[data-ai-inspector]', dom.page);
    dom.closeAiInspectorBtn = $('[data-close-ai-inspector]', dom.page);
    dom.inspectorDl = $('[data-inspector-dl]', dom.page);
    dom.inspectorContent = $('[data-inspector-content]', dom.page);
    dom.aiLoadMoreBtn = $('[data-ai-load-more]', dom.page);
    dom.briefings = $('[data-admin-briefings]', dom.page);
    dom.briefingSetup = $('[data-briefing-setup]', dom.page);
    dom.autoBriefings = $('[data-admin-auto-briefings]', dom.page);
    dom.autoBriefingSetup = $('[data-auto-briefing-setup]', dom.page);
    dom.dataRequests = $('[data-admin-data-requests]', dom.page);
    dom.dataRequestNote = $('[data-data-request-note]', dom.page);

    /* Comms */
    dom.enquiriesTable = $('[data-admin-enquiries-table]', dom.page);
    dom.subscribersTable = $('[data-admin-subscribers-table]', dom.page);
    dom.outboxTable = $('[data-admin-outbox-table]', dom.page);

    return true;
  }

  function showLogin(msg) {
    if (dom.userBar) dom.userBar.hidden = true;
    if (dom.workspace) dom.workspace.hidden = true;
    if (dom.state) dom.state.hidden = true;
    if (dom.login) {
      dom.login.hidden = false;
      if (dom.loginNote) dom.loginNote.textContent = msg || '';
    }
  }

  function showWorkspace(user) {
    if (dom.login) dom.login.hidden = true;
    if (dom.state) dom.state.hidden = true;
    if (dom.workspace) dom.workspace.hidden = false;
    if (dom.userBar) {
      dom.userBar.hidden = false;
      if (dom.userName) dom.userName.textContent = user.name || user.email || 'Admin';
    }
  }

  /* ---------------- Tabs ---------------- */

  function initialTab() {
    var key = (location.hash || '').replace(/^#/, '').toLowerCase();
    return dom.tabs.some(function (t) { return t.dataset.tab === key; }) ? key : 'villas';
  }

  function switchTab(tabKey) {
    state.activeTab = tabKey;
    dom.tabs.forEach(function (t) {
      var active = t.dataset.tab === tabKey;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', String(active));
    });
    dom.panels.forEach(function (p) {
      var active = p.dataset.panel === tabKey;
      p.hidden = !active;
      p.classList.toggle('is-active', active);
    });

    if (tabKey === 'villas') loadVillasTab();
    else if (tabKey === 'quotes') loadQuotesTab();
    else if (tabKey === 'briefings') loadBriefingsTab();
    else if (tabKey === 'ai') loadAiTab(true);
    else if (tabKey === 'comms') loadCommsTab();
    else if (tabKey === 'data-requests') loadDataRequestsTab();
  }

  /* ---------------- Trip briefings ---------------- */

  function loadBriefingsTab() {
    dom.briefings.innerHTML = empty('Loading upcoming trips…');
    return FridayAdmin.request('/api/admin/briefings').then(function (res) {
      state.emailConfigured = !!res.emailConfigured;
      dom.briefingSetup.textContent = state.emailConfigured ? '' : 'Email delivery is not configured. Sending is disabled.';
      state.briefings = res.briefings || [];
      renderBriefings(state.briefings);
    }).catch(function (err) { dom.briefings.innerHTML = empty('Could not load trip briefings: ' + err.message); }).then(loadAutoBriefings);
  }

  function loadAutoBriefings() {
    if (!dom.autoBriefings) return;
    dom.autoBriefings.innerHTML = empty('Loading automatic briefings…');
    return FridayAdmin.request('/api/admin/briefings/runs').then(function (res) {
      dom.autoBriefingSetup.textContent = 'Mode: ' + res.mode + ' · Dry-run days: ' + res.dryRunDays + '/' + res.requiredDryRunDays;
      var items = res.items || [];
      if (!items.length) { dom.autoBriefings.innerHTML = empty('No automatic briefing runs yet. Runs happen daily at 09:00 IST.'); return; }
      dom.autoBriefings.innerHTML = '<table class="admin-table"><thead><tr><th>Run</th><th>Trip</th><th>Departure</th><th>Outcome</th></tr></thead><tbody>' + items.map(function (row) {
        return '<tr><td>' + esc(row.runDate) + ' · ' + esc(row.mode) + '</td><td><strong>' + esc(row.title) + '</strong></td><td>' + esc(row.departureDate) + ' · ' + esc(row.daysBeforeDeparture) + ' days</td><td>' + esc(String(row.outcome).replace(/_/g, ' ')) + '</td></tr>';
      }).join('') + '</tbody></table>';
    }).catch(function (err) { dom.autoBriefings.innerHTML = empty('Could not load automatic briefings: ' + err.message); });
  }

  function renderBriefings(rows) {
    if (!rows.length) { dom.briefings.innerHTML = empty('No dated trips with linked bookings are due in the next 30 days.'); return; }
    dom.briefings.innerHTML = '<table class="admin-table"><thead><tr><th>Trip</th><th>Departure</th><th>Bookings</th><th>Action</th></tr></thead><tbody>' + rows.map(function (row) {
      var allowed = !!row.eligible && state.emailConfigured;
      return '<tr><td><strong>' + esc(row.title) + '</strong></td><td>' + esc(row.departureDate) + ' · ' + esc(row.daysBeforeDeparture) + ' days</td><td>' + esc(row.bookingCount) + '</td><td><button class="btn btn--solid" type="button" data-send-briefing="' + esc(row.tripId) + '" data-days-before="' + esc(row.daysBeforeDeparture) + '" ' + (allowed ? '' : 'disabled') + '>Send briefing</button><small>' + (allowed ? '' : esc(row.reason || 'Email delivery is not configured.')) + '</small></td></tr>';
    }).join('') + '</tbody></table>';
  }

  /* ---------------- Data requests ---------------- */

  function loadDataRequestsTab() {
    dom.dataRequests.innerHTML = empty('Loading data requests…');
    return FridayAdmin.request('/api/admin/data-requests').then(function (res) {
      state.dataRequests = res.requests || [];
      renderDataRequests(state.dataRequests);
    }).catch(function (err) { dom.dataRequests.innerHTML = empty('Could not load data requests: ' + err.message); });
  }

  function renderDataRequests(rows) {
    if (!rows.length) { dom.dataRequests.innerHTML = empty('No account deletion requests are waiting.'); return; }
    dom.dataRequests.innerHTML = '<table class="admin-table admin-table--data-requests"><thead><tr><th>Account</th><th>Requested</th><th>Due</th><th>Status</th><th>Action</th></tr></thead><tbody>' + rows.map(function (row) {
      var waiting = row.status !== 'completed';
      return '<tr><td data-label="Account">' + esc(row.requester_email) + '</td><td data-label="Requested">' + esc(formatDate(row.created)) + '</td><td data-label="Due">' + esc(formatDate(row.due_at)) + '</td><td data-label="Status">' + badge(row.status) + '</td><td data-label="Action">' + (waiting ? '<button class="btn btn--danger" type="button" data-complete-data-request="' + esc(row.id) + '">' + (row.status === 'account_deletion_pending' ? 'Retry account deletion' : 'Delete account data') + '</button>' : 'Complete') + '</td></tr>';
    }).join('') + '</tbody></table>';
  }

  /* ---------------- Tab 1: Villas ---------------- */

  function loadVillasTab() {
    dom.villaList.innerHTML = empty('Loading villas…');
    dom.submissions.innerHTML = empty('Loading submissions…');

    return Promise.all([
      FridayAdmin.request('/api/admin/villas'),
      FridayAdmin.request('/api/admin/villa-submissions')
    ]).then(function (results) {
      renderVillas(results[0].villas || []);
      renderSubmissions(results[1].submissions || []);
    }).catch(function (err) {
      dom.villaList.innerHTML = empty('Could not load villas: ' + err.message);
      dom.submissions.innerHTML = empty('Could not load submissions: ' + err.message);
    });
  }

  function renderVillas(rows) {
    if (!rows.length) {
      dom.villaList.innerHTML = empty('No villas yet. Add a draft when you have owner-approved details.');
      return;
    }
    dom.villaList.innerHTML = rows.map(function (v) {
      var isSel = state.selectedVillaId === v.id;
      return '<button class="villa-admin__row' + (isSel ? ' is-selected' : '') + '" type="button" data-edit-villa="' + esc(v.id) + '">' +
        '<span><strong>' + esc(v.name) + '</strong><small>' + esc(v.city || '') + '</small></span>' +
        badge(v.status || 'draft') +
        '</button>';
    }).join('');
  }

  function renderSubmissions(rows) {
    if (!rows.length) {
      dom.submissions.innerHTML = empty('There are no owner introductions to review.');
      return;
    }
    dom.submissions.innerHTML = rows.map(function (s) {
      var map = safeUrl(s.mapsUrl);
      return '<article class="villa-submission">' +
        '<div>' + badge(s.status || 'new') + '<h3 style="margin-top:0.4rem">' + esc(s.villaName || 'Villa introduction') + '</h3><p>' + esc(s.city || '') + '</p></div>' +
        '<div><p><strong>' + esc(s.contactName || '') + '</strong> &middot; <a href="mailto:' + esc(s.email || '') + '">' + esc(s.email || '') + '</a></p>' +
        (s.phone ? '<p>' + esc(s.phone) + '</p>' : '') +
        (s.description ? '<p>' + esc(s.description) + '</p>' : '') +
        (map ? '<p><a class="link" href="' + esc(map) + '" target="_blank" rel="noopener noreferrer">Open owner map link &rarr;</a></p>' : '') +
        '</div>' +
        '<div class="villa-submission__actions">' +
        (s.status !== 'reviewed' ? '<button class="btn" type="button" data-submission-status="reviewed" data-id="' + esc(s.id) + '">Mark reviewed</button>' : '') +
        (s.status !== 'rejected' ? '<button class="btn btn--danger" type="button" data-submission-status="rejected" data-id="' + esc(s.id) + '">Decline</button>' : '') +
        '</div>' +
        '</article>';
    }).join('');
  }

  function editorNew() {
    state.selectedVillaId = null;
    dom.villaEditor.reset();
    dom.villaEditor.elements.id.value = '';
    dom.villaEditor.hidden = false;
    dom.curatedList.innerHTML = '';
    dom.editorKicker.textContent = 'New listing';
    dom.editorTitle.textContent = 'Villa details';
    dom.saveVillaBtn.textContent = 'Save draft';
    dom.publishVillaBtn.hidden = true;
    dom.deleteVillaBtn.hidden = true;
    dom.editorNote.textContent = '';
  }

  function editorEdit(id, savedMsg) {
    state.selectedVillaId = id;
    FridayAdmin.request('/api/admin/villas/' + encodeURIComponent(id)).then(function (res) {
      var v = res.villa;
      if (!v) throw new Error('Villa not found.');
      dom.villaEditor.reset();
      dom.villaEditor.elements.id.value = v.id;
      ['name', 'city', 'address', 'googleMapsUrl', 'googlePlaceId', 'lat', 'lng', 'bedrooms', 'maxGuests', 'description'].forEach(function (k) {
        dom.villaEditor.elements[k].value = v[k] == null ? '' : v[k];
      });
      dom.villaEditor.elements.amenities.value = (v.amenities || []).join(', ');
      dom.villaEditor.hidden = false;
      renderCurated(v.nearby || []);
      dom.editorKicker.textContent = v.status === 'published' ? 'Published listing' : 'Draft listing';
      dom.editorTitle.textContent = v.name;
      dom.saveVillaBtn.textContent = 'Save changes';
      dom.publishVillaBtn.hidden = v.status === 'published';
      dom.deleteVillaBtn.hidden = false;
      dom.editorNote.textContent = savedMsg || '';
    }).catch(function (err) {
      dom.editorNote.textContent = err.message;
    });
  }

  function collectVillaData() {
    var f = dom.villaEditor.elements;
    var lat = f.lat.value.trim(), lng = f.lng.value.trim();
    var nearby = $$('[data-curated-row]', dom.villaEditor).map(function (row) {
      var val = function (name) { return $('[name="' + name + '"]', row).value.trim(); };
      var id = val('placeId'), name = val('placeName');
      if (!name) throw new Error('Give each verified nearby place a name, or remove the empty row.');
      return {
        id: id || 'host-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        name: name,
        category: val('placeCategory') || 'things-to-do',
        description: val('placeDescription'),
        mapsUrl: val('placeMapsUrl'),
        lat: val('placeLat') ? Number(val('placeLat')) : null,
        lng: val('placeLng') ? Number(val('placeLng')) : null
      };
    });
    return {
      name: f.name.value.trim(),
      city: f.city.value.trim(),
      address: f.address.value.trim(),
      googleMapsUrl: f.googleMapsUrl.value.trim(),
      googlePlaceId: f.googlePlaceId.value.trim(),
      lat: lat ? Number(lat) : null,
      lng: lng ? Number(lng) : null,
      bedrooms: f.bedrooms.value ? Number(f.bedrooms.value) : null,
      maxGuests: f.maxGuests.value ? Number(f.maxGuests.value) : null,
      description: f.description.value.trim(),
      amenities: f.amenities.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean),
      nearby: nearby
    };
  }

  function renderCurated(rows) {
    dom.curatedList.innerHTML = (rows || []).map(function (p) {
      return '<div class="villa-curated-row" data-curated-row>' +
        '<input type="hidden" name="placeId" value="' + esc(p.id || '') + '">' +
        '<label class="villa-label">Place name<input class="villa-input" name="placeName" maxlength="180" value="' + esc(p.name || '') + '" required></label>' +
        '<label class="villa-label">Category<select class="villa-input" name="placeCategory">' +
        '<option value="things-to-do" ' + (p.category === 'things-to-do' ? 'selected' : '') + '>Things to do</option>' +
        '<option value="restaurants" ' + (p.category === 'restaurants' ? 'selected' : '') + '>Restaurants</option>' +
        '<option value="cafes" ' + (p.category === 'cafes' ? 'selected' : '') + '>Caf&eacute;s</option>' +
        '</select></label>' +
        '<label class="villa-label villa-curated-wide">Short note<input class="villa-input" name="placeDescription" maxlength="500" value="' + esc(p.description || '') + '"></label>' +
        '<label class="villa-label villa-curated-wide">Google Maps link<input class="villa-input" name="placeMapsUrl" type="url" value="' + esc(p.mapsUrl || '') + '"></label>' +
        '<div class="villa-admin__fields villa-curated-wide">' +
        '<label class="villa-label">Latitude<input class="villa-input" name="placeLat" type="number" step="any" min="-90" max="90" value="' + (p.lat == null ? '' : esc(p.lat)) + '"></label>' +
        '<label class="villa-label">Longitude<input class="villa-input" name="placeLng" type="number" step="any" min="-180" max="180" value="' + (p.lng == null ? '' : esc(p.lng)) + '"></label>' +
        '</div>' +
        '<button class="villa-text-button villa-curated-wide" type="button" data-remove-curated style="color:#922b21">Remove this place</button>' +
        '</div>';
    }).join('');
  }

  function addCuratedRow() {
    dom.curatedList.insertAdjacentHTML('beforeend',
      '<div class="villa-curated-row" data-curated-row>' +
      '<input type="hidden" name="placeId">' +
      '<label class="villa-label">Place name<input class="villa-input" name="placeName" maxlength="180" required></label>' +
      '<label class="villa-label">Category<select class="villa-input" name="placeCategory">' +
      '<option value="things-to-do">Things to do</option>' +
      '<option value="restaurants">Restaurants</option>' +
      '<option value="cafes">Caf&eacute;s</option>' +
      '</select></label>' +
      '<label class="villa-label villa-curated-wide">Short note<input class="villa-input" name="placeDescription" maxlength="500"></label>' +
      '<label class="villa-label villa-curated-wide">Google Maps link<input class="villa-input" name="placeMapsUrl" type="url"></label>' +
      '<div class="villa-admin__fields villa-curated-wide">' +
      '<label class="villa-label">Latitude<input class="villa-input" name="placeLat" type="number" step="any" min="-90" max="90"></label>' +
      '<label class="villa-label">Longitude<input class="villa-input" name="placeLng" type="number" step="any" min="-180" max="180"></label>' +
      '</div>' +
      '<button class="villa-text-button villa-curated-wide" type="button" data-remove-curated style="color:#922b21">Remove this place</button>' +
      '</div>');
  }

  /* ---------------- Tab 2: Quotes ---------------- */

  function loadQuotesTab() {
    dom.quotesList.innerHTML = empty('Loading quote requests…');
    if (dom.quoteDrawer) dom.quoteDrawer.hidden = true;

    if (state.setup) {
      if (dom.quoteSetupNote) {
        dom.quoteSetupNote.textContent = state.setup.emailConfigured
          ? 'Email delivery is configured via Hexclave.'
          : 'Email delivery is not configured on this server (preview available).';
      }
    }

    FridayAdmin.request('/api/admin/quotes').then(function (res) {
      state.quotes = res.quotes || [];
      renderQuotes(state.quotes);
    }).catch(function (err) {
      dom.quotesList.innerHTML = empty('Could not load quotes: ' + err.message);
    });
  }

  function renderQuotes(quotes) {
    if (!quotes.length) {
      dom.quotesList.innerHTML = empty('No client quote requests in the queue.');
      return;
    }

    var orderedQuotes = quotes.slice().sort(function (a, b) {
      var aOpen = a.kind !== 'callback' && a.status === 'pending' && !a.firstReplyAt;
      var bOpen = b.kind !== 'callback' && b.status === 'pending' && !b.firstReplyAt;
      if (aOpen !== bOpen) return aOpen ? -1 : 1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    dom.quotesList.innerHTML = orderedQuotes.map(function (q) {
      var isSel = state.selectedQuoteId === q.id;
      var snap = q.snapshot || {};
      var isCallback = q.kind === 'callback';
      var isVillaEnquiry = q.kind === 'villa_enquiry';
      var villaName = isVillaEnquiry ? q.villa && q.villa.name : q.villaName;
      var dest = isCallback ? (villaName ? 'Villa: ' + villaName : ((q.tripContext && (q.tripContext.name || q.tripContext.destination)) || 'Call me back')) : (isVillaEnquiry ? 'Villa: ' + (villaName || 'Friday stay') : (snap.destination || 'Unspecified destination'));
      var dates = isCallback ? esc(q.phone || '') + ' · ' + esc(q.bestTime || 'time not set') : ((snap.dates && (snap.dates.start || snap.dates.end))
        ? (snap.dates.start || '') + ' &ndash; ' + (snap.dates.end || '')
        : 'Dates flexible');
      var qInfo = q.quote;
      var amountDisplay = isCallback ? 'Callback request' : (isVillaEnquiry ? 'Villa enquiry' : (qInfo ? esc(qInfo.currency) + ' ' + Number(qInfo.amount).toFixed(2) : 'Unquoted'));
      var villaMeta = isVillaEnquiry ? [q.villa && q.villa.city, q.villa && q.villa.guests ? 'Sleeps up to ' + q.villa.guests : ''].filter(Boolean).map(esc).join(' · ') : '';
      var isOpen = !isCallback && !isVillaEnquiry && q.status === 'pending' && !q.firstReplyAt;
      var waitingMarkup = '';
      if (isOpen) {
        var waitedMs = Math.max(0, Date.now() - new Date(q.createdAt).getTime());
        var waitedHours = Math.floor(waitedMs / 3600000);
        var waitedLabel = waitedHours < 1 ? 'Waiting less than an hour' : (waitedHours < 24 ? 'Waiting ' + waitedHours + 'h' : 'Waiting ' + Math.floor(waitedHours / 24) + 'd ' + (waitedHours % 24) + 'h');
        waitingMarkup = '<div class="admin-quote-card__waiting">' + esc(waitedLabel) + (waitedMs > QUOTE_REPLY_SLA_HOURS * 60 * 60 * 1000 ? ' <span class="admin-badge badge--overdue">Over ' + QUOTE_REPLY_SLA_HOURS + 'h</span>' : '') + '</div><button class="btn admin-quote-card__reply" type="button" data-mark-quote-replied="' + esc(q.id) + '">Mark replied</button>';
      } else if (q.firstReplyAt) {
        waitingMarkup = '<div class="admin-quote-card__waiting">First reply · ' + esc(formatDate(q.firstReplyAt)) + '</div>';
      }

      return '<div class="admin-quote-card' + (isSel ? ' is-selected' : '') + (isCallback && q.status === 'done' ? ' is-done' : '') + '" data-open-quote="' + esc(q.id) + '">' +
        '<div class="admin-quote-card__head">' +
        '<span class="admin-quote-card__client">' + esc(isCallback || isVillaEnquiry ? (q.name || q.customerEmail || 'Guest') : (q.customerEmail || 'Guest')) + '</span>' +
        (isCallback ? '<span class="admin-badge">Callback' + (q.status === 'done' ? ' · done' : '') + '</span>' : (isVillaEnquiry ? '<span class="admin-badge">Villa enquiry</span>' : badge(q.status))) +
        '</div>' +
        '<h4 class="admin-quote-card__dest">' + esc(dest) + '</h4>' +
        '<div class="admin-quote-card__meta">' + (isCallback ? dates + ' · ' + esc(q.entryPoint || '') + (q.checklist ? ' · checklist ' + esc(q.checklist.done + '/' + q.checklist.total) : '') : (isVillaEnquiry ? villaMeta : dates + ' · ' + esc(snap.travelers || 1) + ' travellers')) + '</div>' +
        '<div class="admin-quote-card__amount">' + amountDisplay + '</div>' + waitingMarkup +
        '</div>';
    }).join('');
  }

  function checklistHtml(c) {
    if (!c) return '';
    var labels = {}; (c.items || []).forEach(function (i) { labels[i.id] = i.label; });
    var answers = c.answers || {};
    var ids = Object.keys(answers);
    return '<p><strong>Pre-quote checklist:</strong> ' + esc(c.done + '/' + c.total) + ' complete</p>' + (ids.length ? '<ul>' + ids.map(function (id) { return '<li>' + esc(labels[id] || id) + ': ' + esc(answers[id].text || 'ticked, no detail') + '</li>'; }).join('') + '</ul>' : '');
  }

  function openQuoteDrawer(id) {
    state.selectedQuoteId = id;
    state.currentPreview = null;
    var q = state.quotes.find(function (item) { return item.id === id; });
    if (!q) return;

    dom.quoteDrawer.hidden = false;
    dom.quoteNote.textContent = '';
    dom.quotePreviewBox.hidden = true;
    dom.quoteForm.hidden = q.kind === 'callback' || q.kind === 'villa_enquiry';
    if (q.kind === 'villa_enquiry') {
      var v = q.villa || {}, data = q.data || {};
      var composition = Array.isArray(data.composition) ? data.composition.join(', ') : (data.composition || '');
      dom.quoteTitle.textContent = 'Villa enquiry';
      dom.quoteSummaryInfo.innerHTML = '<p><strong>Name:</strong> ' + esc(q.name || '') + '</p><p><strong>Email:</strong> <a href="mailto:' + esc(q.customerEmail || '') + '">' + esc(q.customerEmail || '') + '</a></p><p><strong>Villa:</strong> ' + esc(v.name || '') + '</p><p><strong>City:</strong> ' + esc(v.city || '') + '</p><p><strong>Guest capacity:</strong> ' + esc(v.guests || 'Not listed') + '</p>' + (data.when ? '<p><strong>When:</strong> ' + esc(data.when) + '</p>' : '') + (data.who ? '<p><strong>Who is travelling:</strong> ' + esc(data.who) + '</p>' : '') + (composition ? '<p><strong>Help with:</strong> ' + esc(composition) + '</p>' : '') + (data.shape ? '<p><strong>Request:</strong> ' + esc(data.shape) + '</p>' : '') + (data.last ? '<p><strong>Additional details:</strong> ' + esc(data.last) + '</p>' : '') + '<p><strong>Received:</strong> ' + esc(formatDate(q.createdAt)) + '</p>';
      dom.quoteNote.textContent = 'Contact this traveler about the villa. This enquiry is saved for the Friday team and is not a quote email to send.';
      renderQuotes(state.quotes);
      return;
    }
    if (q.kind === 'callback') {
      dom.quoteTitle.textContent = 'Callback request';
      var tripLink = q.tripId ? '<p><strong>Trip:</strong> <a href="trip.html#/trip/' + encodeURIComponent(q.tripId) + '" target="_blank" rel="noopener noreferrer">Open planner trip</a></p>' : '';
      var tripContext = q.tripContext || {};
      var tripSummary = q.tripContext ? '<p><strong>Trip:</strong> ' + esc(tripContext.name || 'Your trip') + (tripContext.destination ? ' · ' + esc(tripContext.destination) : '') + '</p>' + ((tripContext.startDate || tripContext.endDate) ? '<p><strong>Dates:</strong> ' + esc(tripContext.startDate || 'Not set') + (tripContext.endDate ? ' to ' + esc(tripContext.endDate) : '') + '</p>' : '') : '';
      dom.quoteSummaryInfo.innerHTML = '<p><strong>Name:</strong> ' + esc(q.name || '') + '</p><p><strong>Phone:</strong> <a href="tel:' + esc(q.phone || '') + '">' + esc(q.phone || '') + '</a></p><p><strong>Best time:</strong> ' + esc(q.bestTime || '') + '</p><p><strong>From:</strong> ' + esc(q.entryPoint || '') + '</p>' + (q.topic ? '<p><strong>About:</strong> ' + esc(q.topic) + '</p>' : '') + (q.villaName ? '<p><strong>Villa:</strong> ' + esc(q.villaName) + '</p><p><strong>City:</strong> ' + esc(q.villaCity || '') + '</p><p><strong>Guest capacity:</strong> ' + esc(q.villaGuests || 'Not listed') + '</p>' : '') + tripSummary + tripLink + '<p><strong>Received:</strong> ' + esc(formatDate(q.createdAt)) + '</p>' + checklistHtml(q.checklist) + '<p><button type="button" class="villa-text-button" data-callback-status="' + esc(q.id) + '" data-next-status="' + (q.status === 'done' ? 'open' : 'done') + '">' + (q.status === 'done' ? 'Reopen' : 'Mark done') + '</button></p>';
      dom.quoteNote.textContent = 'Call this traveler at their preferred time. This is a callback request, not a quote to send.';
      renderQuotes(state.quotes);
      return;
    }
    dom.quoteForm.hidden = false;
    dom.quoteTitle.textContent = 'Quote for ' + (q.customerEmail || 'client');

    var snap = q.snapshot || {};
    var itemsList = (snap.items || []).map(function (i) { return i.title; }).filter(Boolean).join(', ');
    var summaryHtml = '<p><strong>Client:</strong> ' + esc(q.customerEmail || '') + '</p>' +
      '<p><strong>Destination:</strong> ' + esc(snap.destination || '—') + '</p>' +
      '<p><strong>Dates:</strong> ' + esc(snap.dates?.start || '') + ' to ' + esc(snap.dates?.end || '') + '</p>' +
      '<p><strong>Travelers:</strong> ' + esc(snap.travelers || '—') + '</p>' +
      '<p><strong>Budget:</strong> ' + esc(snap.flexibleBudget ? 'Flexible' : (snap.budget || '—')) + '</p>' +
      (itemsList ? '<p><strong>Selected listings:</strong> ' + esc(itemsList) + '</p>' : '') +
      (snap.instructions ? '<p><strong>Client notes:</strong> <em>' + esc(snap.instructions) + '</em></p>' : '') +
      bookingVerifyHtml(snap.selectedBookings);

    dom.quoteSummaryInfo.innerHTML = summaryHtml;

    var f = dom.quoteForm.elements;
    f.quoteId.value = q.id;
    f.amount.value = q.quote ? q.quote.amount : '';
    f.currency.value = q.quote ? q.quote.currency : 'USD';
    f.details.value = q.quote ? q.quote.details : '';

    var isPending = q.status === 'pending';
    f.amount.disabled = !isPending;
    f.currency.disabled = !isPending;
    f.details.disabled = !isPending;
    dom.previewQuoteBtn.disabled = !isPending;

    if (!isPending) {
      dom.quoteNote.textContent = 'This quote was already submitted (' + q.status + ') and is locked for changes.';
    }

    renderQuotes(state.quotes);
  }

  /* Booking confidence: quote admins can mark a booking the traveller attached to this request as verified. */
  function bookingVerifyHtml(bookings) {
    var list = (bookings || []).filter(function (b) { return b && b.id; });
    if (!list.length) return '';
    return '<div data-booking-verify><p><strong>Attached bookings:</strong></p>' + list.map(function (b) {
      return '<p data-booking-row="' + esc(b.id) + '">' + esc(b.title || 'Booking') + ' <button type="button" class="villa-text-button" data-verify-booking="' + esc(b.id) + '" data-verified="true">Mark verified</button> <button type="button" class="villa-text-button" data-verify-booking="' + esc(b.id) + '" data-verified="false">Clear</button> <span class="villa-form-note" data-booking-state role="status"></span></p>';
    }).join('') + '</div>';
  }
  function setCallbackStatus(btn) {
    var id = btn.dataset.callbackStatus, next = btn.dataset.nextStatus;
    btn.disabled = true; dom.quoteNote.textContent = 'Saving…';
    FridayAdmin.request('/api/admin/callbacks/' + encodeURIComponent(id) + '/status', 'POST', { status: next })
      .then(function (res) {
        var q = state.quotes.find(function (item) { return item.id === id; });
        if (q) q.status = res.callback.status;
        openQuoteDrawer(id);
        dom.quoteNote.textContent = next === 'done' ? 'Marked done.' : 'Reopened.';
      })
      .catch(function (err) { dom.quoteNote.textContent = err.message || 'Could not update this callback.'; btn.disabled = false; });
  }
  function verifyBooking(btn) {
    var row = btn.closest('[data-booking-row]'), note = row && row.querySelector('[data-booking-state]');
    var verified = btn.dataset.verified === 'true';
    btn.disabled = true; if (note) note.textContent = 'Saving…';
    FridayAdmin.request('/api/admin/bookings/' + encodeURIComponent(btn.dataset.verifyBooking) + '/verify', 'POST', { verified: verified })
      .then(function (res) { if (note) note.textContent = res.booking && res.booking.verification ? 'Verified by you' : 'Verification cleared'; })
      .catch(function (err) { if (note) note.textContent = err.message || 'Could not update this booking.'; })
      .then(function () { btn.disabled = false; });
  }

  function previewQuote() {
    var f = dom.quoteForm.elements;
    var id = f.quoteId.value;
    var amount = Number(f.amount.value);
    var currency = f.currency.value.trim().toUpperCase();
    var details = f.details.value.trim();

    if (!amount || amount < 0) {
      dom.quoteNote.textContent = 'Enter a valid quote amount.';
      return;
    }
    if (!currency || currency.length !== 3) {
      dom.quoteNote.textContent = 'Enter a 3-letter currency code (e.g. USD).';
      return;
    }
    if (!details) {
      dom.quoteNote.textContent = 'Enter quote inclusions and details.';
      return;
    }

    dom.quoteNote.textContent = 'Generating preview…';
    dom.previewQuoteBtn.disabled = true;

    FridayAdmin.request('/api/admin/quotes/' + encodeURIComponent(id) + '/preview', 'POST', {
      amount: amount,
      currency: currency,
      details: details
    }).then(function (res) {
      state.currentPreview = res.preview;
      dom.quotePreviewBox.hidden = false;
      dom.previewTo.textContent = res.preview.to || '';
      dom.previewSubject.textContent = res.preview.subject || '';
      dom.previewText.textContent = res.preview.text || '';
      dom.quoteNote.textContent = 'Preview generated. Verify before delivery.';
    }).catch(function (err) {
      dom.quoteNote.textContent = err.message;
    }).finally(function () {
      dom.previewQuoteBtn.disabled = false;
    });
  }

  function sendQuote() {
    if (!state.currentPreview || !state.currentPreview.previewHash) {
      dom.quoteNote.textContent = 'Generate a preview before sending.';
      return;
    }

    var f = dom.quoteForm.elements;
    var id = f.quoteId.value;
    var amount = Number(f.amount.value);
    var currency = f.currency.value.trim().toUpperCase();
    var details = f.details.value.trim();

    dom.sendQuoteBtn.disabled = true;
    dom.quoteNote.textContent = 'Delivering quote to client…';

    FridayAdmin.request('/api/admin/quotes/' + encodeURIComponent(id) + '/send', 'POST', {
      amount: amount,
      currency: currency,
      details: details,
      previewHash: state.currentPreview.previewHash
    }).then(function (res) {
      dom.quoteNote.textContent = 'Quote delivered! Status: ' + (res.quote ? res.quote.status : 'sent');
      loadQuotesTab();
    }).catch(function (err) {
      dom.quoteNote.textContent = 'Delivery failed: ' + err.message;
    }).finally(function () {
      dom.sendQuoteBtn.disabled = false;
    });
  }

  /* ---------------- Tab 3: AI Review ---------------- */

  function loadAiTab(reset) {
    if (reset) {
      state.aiEvents = [];
      state.aiNextBefore = null;
      dom.aiList.innerHTML = empty('Loading AI conversation events…');
    }
    if (dom.aiInspector) dom.aiInspector.hidden = true;

    var form = dom.aiFilterForm;
    var convId = form.conversationId.value.trim();
    var ownerId = form.ownerId.value.trim();

    var params = [];
    if (convId) params.push('conversationId=' + encodeURIComponent(convId));
    if (ownerId) params.push('ownerId=' + encodeURIComponent(ownerId));
    if (!reset && state.aiNextBefore) params.push('before=' + encodeURIComponent(state.aiNextBefore));
    params.push('limit=50');

    var url = '/api/admin/ai-conversations' + (params.length ? '?' + params.join('&') : '');

    return FridayAdmin.request(url).then(function (res) {
      var newEvents = res.events || [];
      state.aiEvents = reset ? newEvents : state.aiEvents.concat(newEvents);
      state.aiNextBefore = res.nextBefore || null;

      renderAiEvents(state.aiEvents);
      dom.aiLoadMoreBtn.hidden = !state.aiNextBefore;
    }).catch(function (err) {
      dom.aiList.innerHTML = empty('Could not load AI events: ' + err.message);
      dom.aiLoadMoreBtn.hidden = true;
    });
  }

  function renderAiEvents(events) {
    if (!events.length) {
      dom.aiList.innerHTML = empty('No AI conversation events matching the filter.');
      return;
    }

    dom.aiList.innerHTML = events.map(function (ev) {
      var isSel = state.selectedAiEventKey === ev.event_key;
      return '<div class="admin-ai-row' + (isSel ? ' is-selected' : '') + '" data-inspect-event="' + esc(ev.event_key) + '">' +
        '<div class="admin-ai-row__top">' +
        '<span class="admin-ai-row__type">' + esc(ev.event_type || 'event') + (ev.role ? ' &middot; ' + esc(ev.role) : '') + '</span>' +
        badge(ev.status) +
        '</div>' +
        '<div class="admin-ai-row__meta">' +
        '<span>Thread: ' + esc(ev.conversation_id || '—') + '</span> &middot; ' +
        '<span>' + formatDate(ev.created) + '</span>' +
        '</div>' +
        '</div>';
    }).join('');
  }

  function inspectAiEvent(eventKey) {
    state.selectedAiEventKey = eventKey;
    var ev = state.aiEvents.find(function (item) { return item.event_key === eventKey; });
    if (!ev) return;

    dom.aiInspector.hidden = false;
    var dlHtml = '<dt>Event Key</dt><dd>' + esc(ev.event_key) + '</dd>' +
      '<dt>Conversation</dt><dd>' + esc(ev.conversation_id) + '</dd>' +
      '<dt>Owner ID</dt><dd>' + esc(ev.owner_id) + '</dd>' +
      (ev.trip_id ? '<dt>Trip ID</dt><dd>' + esc(ev.trip_id) + '</dd>' : '') +
      '<dt>Event Type</dt><dd>' + esc(ev.event_type) + '</dd>' +
      (ev.role ? '<dt>Role</dt><dd>' + esc(ev.role) + '</dd>' : '') +
      '<dt>Status</dt><dd>' + badge(ev.status) + '</dd>' +
      '<dt>Created</dt><dd>' + formatDate(ev.created) + '</dd>' +
      '<dt>Updated</dt><dd>' + formatDate(ev.updated) + '</dd>';

    dom.inspectorDl.innerHTML = dlHtml;

    var formatted = ev.content;
    try {
      var parsed = JSON.parse(ev.content);
      formatted = JSON.stringify(parsed, null, 2);
    } catch (e) {}

    dom.inspectorContent.textContent = formatted || '';
    renderAiEvents(state.aiEvents);
  }

  /* ---------------- Tab 4: Comms ---------------- */

  function loadCommsTab() {
    dom.enquiriesTable.innerHTML = empty('Loading enquiries…');
    dom.subscribersTable.innerHTML = empty('Loading subscribers…');
    dom.outboxTable.innerHTML = empty('Loading outbox metadata…');

    FridayAdmin.request('/api/admin/enquiries').then(function (res) {
      renderEnquiries(res.enquiries || []);
    }).catch(function (err) {
      dom.enquiriesTable.innerHTML = empty('Failed to load enquiries: ' + err.message);
    });

    FridayAdmin.request('/api/admin/newsletter-subscribers').then(function (res) {
      renderSubscribers(res.subscribers || []);
    }).catch(function (err) {
      dom.subscribersTable.innerHTML = empty('Failed to load subscribers: ' + err.message);
    });

    FridayAdmin.request('/api/admin/email-outbox').then(function (res) {
      renderOutbox(res.messages || []);
    }).catch(function (err) {
      dom.outboxTable.innerHTML = empty('Failed to load outbox: ' + err.message);
    });
  }

  function renderEnquiries(rows) {
    if (!rows.length) {
      dom.enquiriesTable.innerHTML = empty('No commission enquiries recorded yet.');
      return;
    }
    var html = '<table class="admin-table">' +
      '<thead><tr><th>Name</th><th>Email</th><th>Trip notes</th><th>Details</th><th>Received</th></tr></thead>' +
      '<tbody>' + rows.map(function (row) {
        var d = row.data || {};
        var details = [
          d.destination ? 'Dest: ' + d.destination : '',
          d.dates ? 'Dates: ' + d.dates : '',
          d.budget ? 'Budget: ' + d.budget : '',
          d.guests ? 'Guests: ' + d.guests : ''
        ].filter(Boolean).join(' · ');
        return '<tr>' +
          '<td><strong>' + esc(d.name || '—') + '</strong></td>' +
          '<td><a href="mailto:' + esc(d.email || '') + '">' + esc(d.email || '—') + '</a></td>' +
          '<td>' + esc(d.shape || d.notes || d.message || '—') + '</td>' +
          '<td>' + esc(details || '—') + '</td>' +
          '<td>' + formatDate(row.created) + '</td>' +
          '</tr>';
      }).join('') +
      '</tbody></table>';
    dom.enquiriesTable.innerHTML = html;
  }

  function renderSubscribers(rows) {
    if (!rows.length) {
      dom.subscribersTable.innerHTML = empty('No newsletter subscribers registered yet.');
      return;
    }
    var html = '<table class="admin-table">' +
      '<thead><tr><th>Email</th><th>Status</th><th>Source</th><th>Consented</th><th>Unsubscribed</th></tr></thead>' +
      '<tbody>' + rows.map(function (row) {
        return '<tr>' +
          '<td><strong>' + esc(row.email) + '</strong></td>' +
          '<td>' + badge(row.status) + '</td>' +
          '<td>' + esc(row.source || 'website') + '</td>' +
          '<td>' + formatDate(row.consentAt || row.consent_at || row.created) + '</td>' +
          '<td>' + formatDate(row.unsubscribedAt || row.unsubscribed_at) + '</td>' +
          '</tr>';
      }).join('') +
      '</tbody></table>';
    dom.subscribersTable.innerHTML = html;
  }

  function renderOutbox(rows) {
    if (!rows.length) {
      dom.outboxTable.innerHTML = empty('No outbox messages recorded yet.');
      return;
    }
    var html = '<table class="admin-table">' +
      '<thead><tr><th>ID</th><th>Type</th><th>Status</th><th>Attempted</th><th>Created</th></tr></thead>' +
      '<tbody>' + rows.map(function (row) {
        return '<tr>' +
          '<td><code>' + esc((row.id || '').slice(0, 12)) + '&hellip;</code></td>' +
          '<td>' + esc(row.kind || 'email') + '</td>' +
          '<td>' + badge(row.status) + '</td>' +
          '<td>' + formatDate(row.attemptedAt || row.attempted_at) + '</td>' +
          '<td>' + formatDate(row.created) + '</td>' +
          '</tr>';
      }).join('') +
      '</tbody></table>';
    dom.outboxTable.innerHTML = html;
  }

  /* ---------------- Event Listeners ---------------- */

  function setupEvents() {
    /* Login Form */
    dom.loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = dom.loginForm.elements;
      dom.loginNote.textContent = 'Signing in…';
      FridayAdmin.login(f.email.value.trim(), f.password.value).then(function () {
        return boot();
      }).catch(function (err) {
        dom.loginNote.textContent = err.message || 'Email or password incorrect.';
      });
    });

    /* Logout */
    dom.logoutBtn.addEventListener('click', function () {
      FridayAdmin.logout().then(function () {
        location.reload();
      });
    });

    /* Tab clicking */
    dom.tabs.forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchTab(btn.dataset.tab);
      });
    });

    /* Page Click Delegations */
    dom.page.addEventListener('click', function (e) {
      /* Villa actions */
      var addVilla = e.target.closest('[data-villa-new]');
      var editVilla = e.target.closest('[data-edit-villa]');
      var cancelEditor = e.target.closest('[data-cancel-editor]');
      var publishVilla = e.target.closest('[data-publish-villa]');
      var deleteVilla = e.target.closest('[data-delete-villa]');
      var addCurated = e.target.closest('[data-add-curated]');
      var removeCurated = e.target.closest('[data-remove-curated]');
      var subStatus = e.target.closest('[data-submission-status]');

      if (addVilla) editorNew();
      if (editVilla) editorEdit(editVilla.dataset.editVilla);
      if (cancelEditor) {
        dom.villaEditor.hidden = true;
        state.selectedVillaId = null;
      }
      if (addCurated) addCuratedRow();
      if (removeCurated) removeCurated.closest('[data-curated-row]').remove();

      if (publishVilla && state.selectedVillaId) {
        var publishedData;
        try {
          publishedData = Object.assign(collectVillaData(), { status: 'published' });
        } catch (err) {
          dom.editorNote.textContent = err.message;
          return;
        }
        publishVilla.disabled = true;
        FridayAdmin.request('/api/admin/villas/' + encodeURIComponent(state.selectedVillaId), 'PATCH', { villa: publishedData })
          .then(function () {
            return loadVillasTab().then(function () {
              editorEdit(state.selectedVillaId, 'Villa published to collection.');
            });
          })
          .catch(function (err) { dom.editorNote.textContent = err.message; })
          .finally(function () { publishVilla.disabled = false; });
      }

      if (deleteVilla && state.selectedVillaId) {
        if (!confirm('Are you sure you want to delete this villa?')) return;
        deleteVilla.disabled = true;
        FridayAdmin.request('/api/admin/villas/' + encodeURIComponent(state.selectedVillaId), 'DELETE')
          .then(function () {
            dom.villaEditor.hidden = true;
            state.selectedVillaId = null;
            return loadVillasTab();
          })
          .catch(function (err) { dom.editorNote.textContent = err.message; })
          .finally(function () { deleteVilla.disabled = false; });
      }

      if (subStatus) {
        var subId = subStatus.dataset.id;
        var status = subStatus.dataset.submissionStatus;
        subStatus.disabled = true;
        FridayAdmin.request('/api/admin/villa-submissions/' + encodeURIComponent(subId), 'PATCH', { status: status })
          .then(function () { return loadVillasTab(); })
          .catch(function (err) { alert('Could not update submission: ' + err.message); })
          .finally(function () { subStatus.disabled = false; });
      }

      var completeDataRequest = e.target.closest('[data-complete-data-request]');
      if (completeDataRequest) {
        if (!confirm('Delete this traveller’s Friday data, revoke their share links and Google connections, and remove their sign-in account? This cannot be undone.')) return;
        completeDataRequest.disabled = true;
        dom.dataRequestNote.textContent = 'Deleting Friday data and the sign-in account…';
        FridayAdmin.request('/api/admin/data-requests/' + encodeURIComponent(completeDataRequest.dataset.completeDataRequest) + '/complete', 'POST', {})
          .then(function (res) {
            dom.dataRequestNote.textContent = res.request.status === 'account_deletion_pending' ? (res.message || 'Friday data is deleted; sign-in removal still needs a retry.') : 'Friday data and the sign-in account were deleted.';
            return loadDataRequestsTab();
          })
          .catch(function (err) { dom.dataRequestNote.textContent = 'Could not complete deletion: ' + err.message; completeDataRequest.disabled = false; });
      }

      /* Trip briefing send */
      var sendBriefing = e.target.closest('[data-send-briefing]');
      if (sendBriefing && !sendBriefing.disabled) {
        sendBriefing.disabled = true;
        var tripId = sendBriefing.dataset.sendBriefing;
        var requestId = window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'briefing_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        FridayAdmin.request('/api/admin/briefings/' + encodeURIComponent(tripId) + '/send', 'POST', { requestId: requestId })
          .then(function (res) {
            return loadBriefingsTab().then(function () { dom.briefingSetup.textContent = 'Briefing accepted for delivery.'; });
          })
          .catch(function (err) { dom.briefingSetup.textContent = err.message || 'Friday could not confirm delivery.'; sendBriefing.disabled = false; });
      }

      /* Quote actions */
      var markReplied = e.target.closest('[data-mark-quote-replied]');
      if (markReplied) {
        e.preventDefault();
        e.stopPropagation();
        markReplied.disabled = true;
        FridayAdmin.request('/api/admin/quotes/' + encodeURIComponent(markReplied.dataset.markQuoteReplied) + '/replied', 'POST', {})
          .then(function (res) {
            if (window.FridayAnalytics && res.reply) window.FridayAnalytics.track('quote_replied', { hours_waited: res.reply.hoursWaited }, markReplied.dataset.markQuoteReplied);
            return loadQuotesTab();
          })
          .catch(function (err) { markReplied.disabled = false; dom.quoteSetupNote.textContent = 'Could not mark this quote replied: ' + err.message; });
        return;
      }
      var cbBtn = e.target.closest('[data-callback-status]');
      if (cbBtn) { setCallbackStatus(cbBtn); return; }
      var verifyBtn = e.target.closest('[data-verify-booking]');
      if (verifyBtn) { verifyBooking(verifyBtn); return; }
      var openQuote = e.target.closest('[data-open-quote]');
      var closeQuoteDrawer = e.target.closest('[data-close-quote-drawer]');

      if (openQuote) openQuoteDrawer(openQuote.dataset.openQuote);
      if (closeQuoteDrawer) {
        dom.quoteDrawer.hidden = true;
        state.selectedQuoteId = null;
        renderQuotes(state.quotes);
      }

      /* AI actions */
      var inspectEvent = e.target.closest('[data-inspect-event]');
      var closeAiInspector = e.target.closest('[data-close-ai-inspector]');

      if (inspectEvent) inspectAiEvent(inspectEvent.dataset.inspectEvent);
      if (closeAiInspector) {
        dom.aiInspector.hidden = true;
        state.selectedAiEventKey = null;
        renderAiEvents(state.aiEvents);
      }
    });

    /* Villa editor form submit */
    dom.villaEditor.addEventListener('submit', function (e) {
      e.preventDefault();
      var data;
      try {
        data = collectVillaData();
      } catch (err) {
        dom.editorNote.textContent = err.message;
        return;
      }
      if (!data.name || !data.city) {
        dom.editorNote.textContent = 'Add a villa name and city first.';
        return;
      }
      var isEdit = !!state.selectedVillaId;
      var endpoint = isEdit ? '/api/admin/villas/' + encodeURIComponent(state.selectedVillaId) : '/api/admin/villas';
      var method = isEdit ? 'PATCH' : 'POST';

      dom.saveVillaBtn.disabled = true;
      dom.editorNote.textContent = 'Saving…';

      FridayAdmin.request(endpoint, method, { villa: data }).then(function (res) {
        state.selectedVillaId = res.villa.id;
        return loadVillasTab().then(function () {
          editorEdit(state.selectedVillaId, 'Changes saved successfully.');
        });
      }).catch(function (err) {
        dom.editorNote.textContent = err.message;
      }).finally(function () {
        dom.saveVillaBtn.disabled = false;
      });
    });

    /* Quote Preview & Send buttons */
    dom.previewQuoteBtn.addEventListener('click', previewQuote);
    dom.sendQuoteBtn.addEventListener('click', sendQuote);

    /* AI Filter form */
    dom.aiFilterForm.addEventListener('submit', function (e) {
      e.preventDefault();
      loadAiTab(true);
    });

    dom.aiFilterResetBtn.addEventListener('click', function () {
      dom.aiFilterForm.reset();
      loadAiTab(true);
    });

    dom.aiLoadMoreBtn.addEventListener('click', function () {
      loadAiTab(false);
    });
  }

  /* ---------------- Boot ---------------- */

  function boot() {
    if (!cacheDom()) return;

    dom.state.hidden = false;
    dom.state.textContent = 'Checking team access…';

    return FridayAdmin.init().then(function (initResult) {
      state.user = initResult.user;
      state.capabilities = initResult.capabilities || {};

      if (!state.user) {
        showLogin('Please sign in with your Friday team account.');
        return;
      }

      return FridayAdmin.getStatus().then(function (statusRes) {
        state.setup = statusRes.setup || {};
        showWorkspace(state.user);
        switchTab(initialTab());
      }).catch(function (err) {
        if (err.status === 403) {
          showLogin(err.message || 'This account does not have Friday admin access.');
        } else {
          showWorkspace(state.user);
          switchTab(initialTab());
        }
      });
    }).catch(function (err) {
      showLogin(err.message);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (cacheDom()) {
      setupEvents();
      boot();
    }
  });

})();
