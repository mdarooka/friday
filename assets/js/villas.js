/* Public villa discovery, owner interest and allowlisted team console. */
(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var api = function (path, method, data) {
    var o = { method: method || 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' } };
    if (data !== undefined) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(data); }
    return fetch(path, o).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw Object.assign(new Error(j.error || 'Friday could not complete that request.'), { status: r.status }); return j; }); });
  };
  var safeUrl = function (v) { try { var u = new URL(v, location.href); return ['http:', 'https:'].indexOf(u.protocol) >= 0 ? u.href : ''; } catch (e) { return ''; } };
  var toQuery = function (obj) { return Object.keys(obj).filter(function (k) { return obj[k] !== '' && obj[k] != null; }).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]); }).join('&'); };
  function categoryLabel(value) { return ({ 'things-to-do': 'Things to do', restaurants: 'Restaurants', cafes: 'Cafés', food: 'Food', nature: 'Nature', culture: 'Culture', wellness: 'Wellbeing', family: 'Time together' })[String(value || '').toLowerCase()] || String(value || '').replace(/[-_]+/g, ' '); }
  function focusLabel(value) { return String(value || '').split(/[,·|]/).map(function (x) { return categoryLabel(x.trim()); }).filter(Boolean).join(' · '); }

  function villaCard(v) {
    return '<a class="villa-card" href="villa.html?id=' + encodeURIComponent(v.id) + '"><div class="villa-card__art" aria-hidden="true"><span class="villa-card__glyph"></span></div><div class="villa-card__body"><p class="villa-card__city">' + esc(v.city || '') + '</p><h3 class="villa-card__name">' + esc(v.name || 'Friday stay') + '</h3><div class="villa-card__meta">' + (v.bedrooms ? '<span>' + esc(v.bedrooms) + ' bedrooms</span>' : '') + (v.maxGuests ? '<span>Sleeps ' + esc(v.maxGuests) + '</span>' : '') + '</div>' + (v.description ? '<p class="villa-card__desc">' + esc(v.description) + '</p>' : '') + '<span class="villa-card__link">Explore this home &rarr;</span></div></a>';
  }
  function initIndex(root) {
    var list = $('[data-villa-list]', root), count = $('[data-villa-count]', root), form = $('[data-villa-search]', root), input = $('#villa-location', root), q = new URLSearchParams(location.search).get('location') || new URLSearchParams(location.search).get('q') || '';
    input.value = q;
    function draw(items) {
      var term = input.value.trim().toLowerCase();
      var shown = items.filter(function (v) { return !term || [v.name, v.city, v.address, v.description].join(' ').toLowerCase().indexOf(term) >= 0; });
      count.textContent = shown.length ? shown.length + (shown.length === 1 ? ' home' : ' homes') : '';
      list.innerHTML = shown.length ? shown.map(villaCard).join('') : '<div class="villa-empty"><h3>' + (items.length ? 'No homes in that area yet.' : 'The collection is taking shape.') + '</h3><p>' + (items.length ? 'Try a nearby town or region.' : 'Friday only publishes homes that have been reviewed. Please check back soon or introduce a villa you love.') + '</p></div>';
    }
    form.addEventListener('submit', function (e) { e.preventDefault(); var next = new URL(location.href); next.searchParams.set('location', input.value.trim()); history.replaceState(null, '', next.pathname + next.search); api('/api/villas').then(function (r) { draw(r.villas || []); }).catch(function () { list.innerHTML = '<p class="villa-state">The collection could not load. Please try again.</p>'; }); });
    input.addEventListener('input', function () { if (!input.value.trim()) draw(window.__fridayVillas || []); else draw(window.__fridayVillas || []); });
    api('/api/villas').then(function (r) { window.__fridayVillas = r.villas || []; draw(window.__fridayVillas); }).catch(function () { list.innerHTML = '<div class="villa-empty"><h3>We could not load the collection.</h3><p>Please try again in a moment.</p><button type="button" class="villa-chip" data-retry>Try again</button></div>'; list.addEventListener('click', function (e) { if (e.target.closest('[data-retry]')) api('/api/villas').then(function (r) { window.__fridayVillas = r.villas || []; draw(window.__fridayVillas); }); }); });
  }

  function detailHero(v) {
    var map = safeUrl(v.googleMapsUrl);
    return '<section class="villa-detail__hero"><div class="villa-detail__art" aria-hidden="true"><span></span></div><div><p class="eyebrow">' + esc(v.city || 'Friday stay') + '</p><h1 class="villa-detail__name">' + esc(v.name || 'A Friday stay') + '</h1><p class="villa-detail__copy">' + esc(v.description || '') + '</p><div class="villa-detail__facts">' + (v.bedrooms ? '<span>' + esc(v.bedrooms) + ' bedrooms</span>' : '') + (v.maxGuests ? '<span>Up to ' + esc(v.maxGuests) + ' guests</span>' : '') + '</div><div class="villa-detail__actions">' + (map ? '<a class="btn" href="' + esc(map) + '" target="_blank" rel="noopener noreferrer">View location <span class="arrow">&rarr;</span></a>' : '') + '<a class="btn btn--solid" href="#villa-plan">Plan around this home <span class="arrow">&darr;</span></a></div></div></section>';
  }
  function initDetail(root) {
    var host = $('[data-villa-detail]', root), id = new URLSearchParams(location.search).get('id');
    if (!id) { host.innerHTML = '<div class="villa-empty"><h3>Choose a home first.</h3><p>Return to the collection and open a published villa.</p></div>'; return; }
    api('/api/villas/' + encodeURIComponent(id)).then(function (r) {
      var v = r.villa;
      if (!v) throw new Error('This home is not available.');
      host.innerHTML = detailHero(v) + '<section class="villa-detail__section"><p class="eyebrow">At the house</p><h2>Room to settle in.</h2><ul class="villa-amenities">' + (v.amenities || []).map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul></section><section class="villa-detail__section villa-nearby" data-nearby><p class="eyebrow">Around here</p><h2>Good things, nearby.</h2><div class="villa-nearby__tools" role="group" aria-label="Nearby categories"><button type="button" class="villa-chip" data-nearby-category="things-to-do" aria-pressed="true">Things to do</button><button type="button" class="villa-chip" data-nearby-category="restaurants" aria-pressed="false">Restaurants</button><button type="button" class="villa-chip" data-nearby-category="cafes" aria-pressed="false">Caf&eacute;s</button></div><p class="villa-nearby__meta" data-nearby-meta>Nearby suggestions use this home’s published location.</p><div class="villa-place-grid" data-nearby-list></div></section><section class="villa-detail__section" id="villa-plan" data-plan><p class="eyebrow">Make it a journey</p><h2>Plan around this home.</h2><p class="villa-plan-intro">Choose a few details. Friday will shape a proposal around the villa; you can edit it before it reaches your trip planner.</p><form class="villa-plan-form" data-plan-form><label>Days away<select name="days"><option value="2">2 days</option><option value="3" selected>3 days</option><option value="4">4 days</option><option value="5">5 days</option><option value="6">6 days</option><option value="7">7 days</option></select></label><label>How would you like to move?<select name="pace"><option value="relaxed">Slow and easy</option><option value="balanced" selected>A little of everything</option><option value="active">Full days</option></select></label><label>What sounds good?<select name="interests"><option value="food,nature,culture">Food, nature and culture</option><option value="food">Food and local tables</option><option value="nature">Nature and the outdoors</option><option value="culture">Art, history and culture</option><option value="wellness">Wellbeing and slow days</option><option value="family">Time together</option></select></label><button class="btn btn--solid" type="submit">Suggest a plan <span class="arrow">&rarr;</span></button></form><div class="villa-plan-review" data-plan-review aria-live="polite"></div></section>';
      initNearby(host, v);
      initPlan(host, v);
    }).catch(function (e) { host.innerHTML = '<div class="villa-empty"><h3>We could not open this home.</h3><p>' + esc(e.message) + '</p><a class="btn" href="villas.html">Back to the collection</a></div>'; });
  }
  function placeCard(p) {
    var map = safeUrl(p.mapsUrl);
    return '<article class="villa-place"><div><h3>' + esc(p.name || 'Nearby suggestion') + '</h3>' + (p.category ? '<p>' + esc(p.category) + '</p>' : '') + (p.description ? '<p>' + esc(p.description) + '</p>' : '') + (p.address ? '<p>' + esc(p.address) + '</p>' : '') + (map ? '<p><a href="' + esc(map) + '" target="_blank" rel="noopener noreferrer">View in Maps</a></p>' : '') + '</div></article>';
  }
  function initNearby(root, villa) {
    var section = $('[data-nearby]', root), list = $('[data-nearby-list]', section), meta = $('[data-nearby-meta]', section), current = 'things-to-do';
    function load(category) {
      current = category; $$('[data-nearby-category]', section).forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.nearbyCategory === category)); });
      list.innerHTML = '<p class="villa-state">Looking nearby&hellip;</p>'; meta.textContent = 'Searching around ' + (villa.city || 'this home') + '…';
      api('/api/villas/' + encodeURIComponent(villa.id) + '/nearby?' + toQuery({ category: category, radius: '10000' })).then(function (r) {
        var rows = Array.isArray(r.nearby) ? r.nearby : [];
        meta.textContent = (r.attribution ? 'Suggestions from ' + r.attribution + '. ' : '') + (r.provider === 'google' ? 'Current places around this home.' : 'Friday host recommendations.');
        list.innerHTML = rows.length ? rows.map(function (p) { return placeCard(p, false); }).join('') : '<div class="villa-empty"><h3>No published suggestions yet.</h3><p>There are no verified nearby places in this category. Try another category or ask Friday to plan from this home.</p></div>';
      }).catch(function (e) { meta.textContent = e.message; list.innerHTML = '<p class="villa-state">Nearby suggestions are unavailable right now.</p>'; });
    }
    section.addEventListener('click', function (e) { var b = e.target.closest('[data-nearby-category]'); if (b) load(b.dataset.nearbyCategory); });
    load(current);
  }
  function initPlan(root, villa) {
    var form = $('[data-plan-form]', root), panel = $('[data-plan-review]', root), selectedPlan = null;
    form.addEventListener('submit', function (e) {
      e.preventDefault(); var data = new FormData(form), button = $('button[type="submit"]', form), days = Number(data.get('days'));
      button.disabled = true; button.textContent = 'Shaping your days…'; panel.innerHTML = '<p class="villa-state">Finding a good rhythm around this home&hellip;</p>';
      api('/api/villas/' + encodeURIComponent(villa.id) + '/plan', 'POST', { days: days, pace: data.get('pace'), interests: String(data.get('interests') || '').split(',').filter(Boolean) }).then(function (r) {
        selectedPlan = r; var groups = (r.days || []).map(function (day) {
        return '<section class="villa-plan-day"><h3>Day ' + esc(day.day) + (day.focus ? ' · ' + esc(focusLabel(day.focus)) : '') + '</h3><ul>' + (day.stops || []).map(function (stop) { return '<li><label><input type="checkbox" data-plan-stop value="' + esc(stop.id) + '" checked> ' + esc(stop.name || 'Nearby suggestion') + (stop.category ? ' · ' + esc(categoryLabel(stop.category)) : '') + '</label></li>'; }).join('') + '</ul></section>';
        }).join('');
        if (!groups) throw new Error('Friday could not build a grounded plan for this home yet.');
        panel.innerHTML = (r.fallbackReason ? '<p class="villa-plan-review__note">Live planning is unavailable, so Friday used the verified nearby places to make a simple starting plan.</p>' : '') + '<p class="villa-plan-review__note">Review each stop. Untick anything you would rather skip; Friday will carry your selected stops into a new trip only when you choose Create trip.</p>' + groups + '<div class="villa-plan-review__footer"><span class="villa-nearby__meta">' + esc(r.provider === 'local' ? 'Built from the published villa and verified nearby suggestions.' : 'Proposal ready for your review.') + '</span><button class="btn btn--solid" type="button" data-create-villa-trip>Create trip <span class="arrow">&rarr;</span></button></div>';
      }).catch(function (err) { selectedPlan = null; panel.innerHTML = '<p class="villa-state">' + esc(err.message) + '</p>'; }).finally(function () { button.disabled = false; button.innerHTML = 'Suggest a plan <span class="arrow">&rarr;</span>'; });
    });
    panel.addEventListener('click', function (e) {
      var create = e.target.closest('[data-create-villa-trip]'); if (!create || !selectedPlan) return;
      var chosen = {};
      $$('[data-plan-stop]:checked', panel).forEach(function (cb) { chosen[cb.value] = true; });
      var days = (selectedPlan.days || []).map(function (day, i) {
        var stops = (day.stops || []).filter(function (s) { return chosen[s.id]; }).map(function (s) {
          var curated = s.source === 'curated' || String(s.attribution || '').toLowerCase().indexOf('villa') >= 0;
          return curated ? { id: s.id, name: s.name, description: s.description || '', category: s.category || '', mapsUrl: safeUrl(s.mapsUrl), lat: s.lat, lng: s.lng, attribution: s.attribution || 'Villa host', source: 'curated' } : { id: s.id, source: 'google', category: s.category || '', attribution: 'Google Maps' };
        });
        return { day: i + 1, stops: stops };
      }).filter(function (d) { return d.stops.length; });
      if (!days.length) { panel.insertAdjacentHTML('afterbegin', '<p class="villa-form-note" role="status">Keep at least one stop to create a trip.</p>'); return; }
      var payload = { version: 1, villa: { id: villa.id, name: villa.name, city: villa.city || '', address: villa.address || '', lat: Number.isFinite(villa.lat) ? villa.lat : null, lng: Number.isFinite(villa.lng) ? villa.lng : null, googleMapsUrl: safeUrl(villa.googleMapsUrl) }, days: days };
      try { sessionStorage.setItem('friday.villa.plan.v1', JSON.stringify(payload)); location.href = 'trip.html#/'; } catch (err) { panel.insertAdjacentHTML('afterbegin', '<p class="villa-form-note" role="status">Your browser could not pass the reviewed plan to Friday. Please try again.</p>'); }
    });
  }

  function initAdmin(root) {
    var login = $('[data-admin-login]', root), loginForm = $('[data-admin-login-form]', root), loginNote = $('[data-admin-login-note]', root), state = $('[data-admin-state]', root), workspace = $('[data-admin-workspace]', root), villaList = $('[data-admin-villas]', root), submissions = $('[data-admin-submissions]', root), editor = $('[data-villa-editor]', root), currentId = '';
    function showLogin(message) { login.hidden = false; workspace.hidden = true; state.hidden = true; loginNote.textContent = message || ''; }
    function empty(text) { return '<p class="villa-state">' + esc(text) + '</p>'; }
    function renderVillas(rows) {
      villaList.innerHTML = rows.length ? rows.map(function (v) { return '<button class="villa-admin__row" type="button" data-edit-villa="' + esc(v.id) + '"><span><strong>' + esc(v.name) + '</strong><small>' + esc(v.city || '') + '</small></span><span class="villa-status">' + esc(v.status || 'draft') + '</span></button>'; }).join('') : empty('No villas yet. Add a draft when you have owner-approved details.');
    }
    function renderSubmissions(rows) {
      submissions.innerHTML = rows.length ? rows.map(function (s) {
        var map = safeUrl(s.mapsUrl);
        return '<article class="villa-submission"><div><span class="villa-status">' + esc(s.status || 'new') + '</span><h3>' + esc(s.villaName || 'Villa introduction') + '</h3><p>' + esc(s.city || '') + '</p></div><div><p>' + esc(s.contactName || '') + ' · <a href="mailto:' + esc(s.email || '') + '">' + esc(s.email || '') + '</a></p>' + (s.phone ? '<p>' + esc(s.phone) + '</p>' : '') + (s.description ? '<p>' + esc(s.description) + '</p>' : '') + (map ? '<p><a href="' + esc(map) + '" target="_blank" rel="noopener noreferrer">Open owner map link</a></p>' : '') + '</div><div class="villa-submission__actions"><button type="button" data-submission-status="reviewed" data-id="' + esc(s.id) + '">Mark reviewed</button><button type="button" data-submission-status="rejected" data-id="' + esc(s.id) + '">Decline</button></div></article>';
      }).join('') : empty('There are no owner introductions to review.');
    }
    function refresh() {
      state.hidden = false; state.textContent = 'Loading villa workspace…';
      return Promise.all([api('/api/admin/villas'), api('/api/admin/villa-submissions')]).then(function (rs) {
        login.hidden = true; state.hidden = true; workspace.hidden = false;
        renderVillas(rs[0].villas || []); renderSubmissions(rs[1].submissions || []);
      });
    }
    function editorNew() {
      currentId = ''; editor.reset(); editor.elements.id.value = ''; editor.hidden = false;
      $('[data-curated-list]', editor).innerHTML = '';
      $('[data-editor-kicker]', editor).textContent = 'New listing'; $('[data-editor-title]', editor).textContent = 'Villa details';
      $('[data-save-villa]', editor).textContent = 'Save draft'; $('[data-publish-villa]', editor).hidden = true; $('[data-editor-note]', editor).textContent = '';
    }
    function editorEdit(id, savedMessage) {
      api('/api/admin/villas/' + encodeURIComponent(id)).then(function (r) {
        var v = r.villa; if (!v) throw new Error('Villa not found.'); currentId = v.id; editor.reset(); editor.elements.id.value = v.id;
        ['name', 'city', 'address', 'googleMapsUrl', 'googlePlaceId', 'lat', 'lng', 'bedrooms', 'maxGuests', 'description'].forEach(function (k) { editor.elements[k].value = v[k] == null ? '' : v[k]; });
        editor.elements.amenities.value = (v.amenities || []).join(', '); editor.hidden = false; renderCurated(v.nearby || []);
        $('[data-editor-kicker]', editor).textContent = v.status === 'published' ? 'Published listing' : 'Draft listing'; $('[data-editor-title]', editor).textContent = v.name;
        $('[data-save-villa]', editor).textContent = 'Save changes'; $('[data-publish-villa]', editor).hidden = v.status === 'published'; $('[data-editor-note]', editor).textContent = savedMessage || '';
      }).catch(function (e) { state.hidden = false; state.textContent = e.message; });
    }
    function collect() {
      var f = editor.elements, lat = f.lat.value.trim(), lng = f.lng.value.trim();
      var nearby = $$('[data-curated-row]', editor).map(function (row) {
        var value = function (name) { return $('[name="' + name + '"]', row).value.trim(); };
        var id = value('placeId'), name = value('placeName');
        if (!name) throw new Error('Give each verified nearby place a name, or remove the empty row.');
        return { id: id || 'host-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), name: name, category: value('placeCategory') || 'things-to-do', description: value('placeDescription'), mapsUrl: value('placeMapsUrl'), lat: value('placeLat') ? Number(value('placeLat')) : null, lng: value('placeLng') ? Number(value('placeLng')) : null };
      });
      return { name: f.name.value.trim(), city: f.city.value.trim(), address: f.address.value.trim(), googleMapsUrl: f.googleMapsUrl.value.trim(), googlePlaceId: f.googlePlaceId.value.trim(), lat: lat ? Number(lat) : null, lng: lng ? Number(lng) : null, bedrooms: f.bedrooms.value ? Number(f.bedrooms.value) : null, maxGuests: f.maxGuests.value ? Number(f.maxGuests.value) : null, description: f.description.value.trim(), amenities: f.amenities.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean), nearby: nearby };
    }
    function renderCurated(rows) {
      var list = $('[data-curated-list]', editor);
      list.innerHTML = (rows || []).map(function (p) {
        return '<div class="villa-curated-row" data-curated-row><input type="hidden" name="placeId" value="' + esc(p.id || '') + '"><label class="villa-label">Place name<input class="villa-input" name="placeName" maxlength="180" value="' + esc(p.name || '') + '" required></label><label class="villa-label">Category<select class="villa-input" name="placeCategory"><option value="things-to-do" ' + (p.category === 'things-to-do' ? 'selected' : '') + '>Things to do</option><option value="restaurants" ' + (p.category === 'restaurants' ? 'selected' : '') + '>Restaurants</option><option value="cafes" ' + (p.category === 'cafes' ? 'selected' : '') + '>Caf&eacute;s</option></select></label><label class="villa-label villa-curated-wide">Short note<input class="villa-input" name="placeDescription" maxlength="500" value="' + esc(p.description || '') + '"></label><label class="villa-label villa-curated-wide">Google Maps link<input class="villa-input" name="placeMapsUrl" type="url" value="' + esc(p.mapsUrl || '') + '"></label><div class="villa-admin__fields villa-curated-wide"><label class="villa-label">Latitude<input class="villa-input" name="placeLat" type="number" step="any" min="-90" max="90" value="' + (p.lat == null ? '' : esc(p.lat)) + '"></label><label class="villa-label">Longitude<input class="villa-input" name="placeLng" type="number" step="any" min="-180" max="180" value="' + (p.lng == null ? '' : esc(p.lng)) + '"></label></div><button class="villa-curated-wide" type="button" data-remove-curated>Remove this place</button></div>';
      }).join('');
    }
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault(); var f = loginForm.elements; loginNote.textContent = 'Signing in…';
      api('/api/auth/login', 'POST', { email: f.email.value.trim(), password: f.password.value }).then(refresh).catch(function (err) {
        if (err.status === 503) loginNote.textContent = err.message || 'Villa team access is not configured. Ask the Friday team administrator.';
        else if (err.status === 401) loginNote.textContent = err.message || 'Email or password is incorrect.';
        else if (err.status === 403) loginNote.textContent = err.message || 'This account does not have villa team access.';
        else loginNote.textContent = err.message;
      });
    });
    root.addEventListener('click', function (e) {
      var add = e.target.closest('[data-villa-new]'), edit = e.target.closest('[data-edit-villa]'), cancel = e.target.closest('[data-cancel-editor]'), publish = e.target.closest('[data-publish-villa]'), statusBtn = e.target.closest('[data-submission-status]'), addCurated = e.target.closest('[data-add-curated]'), removeCurated = e.target.closest('[data-remove-curated]');
      if (add) editorNew();
      if (edit) editorEdit(edit.dataset.editVilla);
      if (cancel) editor.hidden = true;
      if (addCurated) $('[data-curated-list]', editor).insertAdjacentHTML('beforeend', '<div class="villa-curated-row" data-curated-row><input type="hidden" name="placeId"><label class="villa-label">Place name<input class="villa-input" name="placeName" maxlength="180" required></label><label class="villa-label">Category<select class="villa-input" name="placeCategory"><option value="things-to-do">Things to do</option><option value="restaurants">Restaurants</option><option value="cafes">Caf&eacute;s</option></select></label><label class="villa-label villa-curated-wide">Short note<input class="villa-input" name="placeDescription" maxlength="500"></label><label class="villa-label villa-curated-wide">Google Maps link<input class="villa-input" name="placeMapsUrl" type="url"></label><div class="villa-admin__fields villa-curated-wide"><label class="villa-label">Latitude<input class="villa-input" name="placeLat" type="number" step="any" min="-90" max="90"></label><label class="villa-label">Longitude<input class="villa-input" name="placeLng" type="number" step="any" min="-180" max="180"></label></div><button class="villa-curated-wide" type="button" data-remove-curated>Remove this place</button></div>');
      if (removeCurated) removeCurated.closest('[data-curated-row]').remove();
      if (publish && currentId) {
        var published;
        try { published = Object.assign(collect(), { status: 'published' }); } catch (err) { $('[data-editor-note]', editor).textContent = err.message; return; }
        publish.disabled = true; api('/api/admin/villas/' + encodeURIComponent(currentId), 'PATCH', { villa: published }).then(refresh).catch(function (err) { $('[data-editor-note]', editor).textContent = err.message; }).finally(function () { publish.disabled = false; });
      }
      if (statusBtn) { statusBtn.disabled = true; api('/api/admin/villa-submissions/' + encodeURIComponent(statusBtn.dataset.id), 'PATCH', { status: statusBtn.dataset.submissionStatus }).then(refresh).catch(function (err) { state.hidden = false; state.textContent = err.message; }).finally(function () { statusBtn.disabled = false; }); }
    });
    editor.addEventListener('submit', function (e) {
      e.preventDefault(); var note = $('[data-editor-note]', editor), data;
      try { data = collect(); } catch (err) { note.textContent = err.message; return; }
      if (!data.name || !data.city) { note.textContent = 'Add a villa name and city first.'; return; }
      var endpoint = currentId ? '/api/admin/villas/' + encodeURIComponent(currentId) : '/api/admin/villas';
      var method = currentId ? 'PATCH' : 'POST'; $('[data-save-villa]', editor).disabled = true; note.textContent = 'Saving…';
      api(endpoint, method, { villa: data }).then(function (r) { currentId = r.villa.id; return refresh().then(function () { editorEdit(currentId, 'Changes saved.'); }); }).catch(function (err) { note.textContent = err.message; }).finally(function () { $('[data-save-villa]', editor).disabled = false; });
    });
    refresh().catch(function (e) {
      if (e.status === 401) showLogin('Sign in with your Friday team account.');
      else if (e.status === 403) showLogin(e.message || 'This account is not on the villa team allowlist.');
      else if (e.status === 503) showLogin(e.message || 'Villa team access is not configured. Ask the Friday team administrator.');
      else { state.hidden = false; state.textContent = e.message; }
    });
  }
  function initSubmission(root) {
    var form = $('[data-villa-submission]', root), note = $('[data-submission-note]', root);
    form.addEventListener('submit', function (e) {
      e.preventDefault(); var f = form.elements;
      var data = { contactName: f.contactName.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(), villaName: f.villaName.value.trim(), city: f.city.value.trim(), address: f.address.value.trim(), mapsUrl: f.mapsUrl.value.trim(), lat: f.lat.value ? Number(f.lat.value) : undefined, lng: f.lng.value ? Number(f.lng.value) : undefined, bedrooms: f.bedrooms.value ? Number(f.bedrooms.value) : undefined, maxGuests: f.maxGuests.value ? Number(f.maxGuests.value) : undefined, description: f.description.value.trim(), website: f.website.value.trim(), photosUrl: f.photosUrl.value.trim(), consent: f.consent.checked, websiteTrap: f.websiteTrap.value };
      var button = $('button[type="submit"]', form); button.disabled = true; note.textContent = 'Sending your introduction…';
      api('/api/villa-submissions', 'POST', data).then(function () { form.reset(); note.textContent = 'Thank you. Your introduction is with the Friday team for review.'; }).catch(function (err) { note.textContent = err.message || 'We could not send this introduction. Please try again.'; }).finally(function () { button.disabled = false; });
    });
  }
  document.addEventListener('DOMContentLoaded', function () {
    var root = $('[data-villa-page]'); if (!root) return;
    var page = root.dataset.villaPage;
    if (page === 'index') initIndex(root);
    else if (page === 'detail') initDetail(root);
    else if (page === 'admin') initAdmin(root);
    else if (page === 'submission') initSubmission(root);
  });
})();
