'use strict';

/* Body fragments for Friday's villa directory, owner submission and team console. */
function villasBody() {
  return `<div class="villa-site" data-villa-page="index">
    <section class="villa-hero">
      <p class="eyebrow">A Friday stay</p>
      <h1 class="villa-title">A place to<br><em>begin.</em></h1>
      <p class="villa-lede">Private homes, chosen for the way they make a journey feel.</p>
      <form class="villa-search" data-villa-search role="search">
        <label for="villa-location">Where would you like to stay?</label>
        <div class="villa-search__row"><input id="villa-location" name="location" type="search" autocomplete="off" placeholder="City or region"><button class="btn btn--solid" type="submit">Find a villa <span class="arrow">&rarr;</span></button></div>
      </form>
    </section>
    <section class="villa-results wrap">
      <div class="villa-section-head"><div><p class="eyebrow">The collection</p><h2 class="h2">Somewhere considered.</h2></div><p class="villa-result-count" data-villa-count></p></div>
      <div class="villa-grid" data-villa-list aria-live="polite"><p class="villa-state">Finding Friday stays&hellip;</p></div>
    </section>
    <section class="villa-host-cta inverse"><div class="wrap villa-host-cta__in"><div><p class="eyebrow">For villa owners</p><h2 class="h2">A good home deserves<br>the right guests.</h2><p class="card__d">Tell us about your property. Friday reviews every home before it joins the collection.</p></div><a class="btn" href="partner.html">Introduce your villa <span class="arrow">&rarr;</span></a></div></section>
  </div>`;
}

function villaBody() {
  return `<div class="villa-site villa-site--detail" data-villa-page="detail">
    <section class="villa-detail wrap"><a class="villa-back" href="villas.html">&larr; All Friday stays</a><div data-villa-detail><p class="villa-state">Opening this home&hellip;</p></div></section>
  </div>`;
}

function villaSubmissionBody() {
  return `<div class="villa-site" data-villa-page="submission">
    <section class="villa-detail wrap"><a class="villa-back" href="villas.html">&larr; Browse Friday stays</a><div class="villa-detail__hero"><div><p class="eyebrow">For villa owners</p><h1 class="villa-detail__name">Introduce<br>your home.</h1><p class="villa-detail__copy">Tell the Friday team about your villa. Every home is reviewed before it is published.</p></div><div class="villa-detail__art" aria-hidden="true"><span>f</span></div></div>
      <form class="villa-owner-form" data-villa-submission>
        <label class="villa-label">Your name<input class="villa-input" name="contactName" autocomplete="name" required maxlength="120"></label>
        <label class="villa-label">Email<input class="villa-input" name="email" type="email" autocomplete="email" required maxlength="254"></label>
        <label class="villa-label">Phone <span class="villa-hint">Optional</span><input class="villa-input" name="phone" type="tel" autocomplete="tel" maxlength="40"></label>
        <label class="villa-label">Villa name<input class="villa-input" name="villaName" required maxlength="160"></label>
        <label class="villa-label">City or region<input class="villa-input" name="city" required maxlength="120"></label>
        <label class="villa-label">Address <span class="villa-hint">Optional</span><input class="villa-input" name="address" maxlength="400"></label>
        <label class="villa-label villa-owner-form__wide">Google Maps link <span class="villa-hint">Use a public pin or place link</span><input class="villa-input" name="mapsUrl" type="url" required maxlength="1000" placeholder="https://maps.google.com/…"></label>
        <label class="villa-label">Latitude <span class="villa-hint">Optional, from the map pin</span><input class="villa-input" name="lat" type="number" step="any" min="-90" max="90"></label>
        <label class="villa-label">Longitude <span class="villa-hint">Optional, from the map pin</span><input class="villa-input" name="lng" type="number" step="any" min="-180" max="180"></label>
        <label class="villa-label">Bedrooms<input class="villa-input" name="bedrooms" type="number" min="1" max="100"></label>
        <label class="villa-label">Sleeps<input class="villa-input" name="maxGuests" type="number" min="1" max="500"></label>
        <label class="villa-label villa-owner-form__wide">Tell us about the home<textarea class="villa-input" name="description" maxlength="3000" rows="5"></textarea></label>
        <label class="villa-label">Website <span class="villa-hint">Optional</span><input class="villa-input" name="website" type="url" maxlength="1000"></label>
        <label class="villa-label">Photo link <span class="villa-hint">Optional</span><input class="villa-input" name="photosUrl" type="url" maxlength="1000"></label>
        <label class="villa-owner-form__consent villa-owner-form__wide"><input type="checkbox" name="consent" required><span>I agree that Friday may contact me about this villa submission.</span></label>
        <label class="sr" aria-hidden="true">Leave this field empty<input name="websiteTrap" tabindex="-1" autocomplete="off"></label>
        <p class="villa-form-note villa-owner-form__wide" data-submission-note role="status"></p>
        <button class="btn btn--solid villa-owner-form__wide" type="submit">Send introduction <span class="arrow">&rarr;</span></button>
      </form>
    </section>
  </div>`;
}

function adminVillasBody() {
  return `<div class="villa-site villa-admin wrap" data-villa-page="admin">
    <section class="villa-admin__head"><div><p class="eyebrow">Friday team</p></div><a class="villa-back" href="index.html">Back to Friday</a></section>
    <section class="villa-admin__login" data-admin-login hidden><div class="villa-admin__card"><p class="eyebrow">Team access</p><h2 class="h3">Sign in to continue</h2><p class="card__d">Use your Friday team account. The planner can remain in guest mode.</p><form data-admin-login-form><label class="villa-label" for="admin-email">Email</label><input class="villa-input" id="admin-email" name="email" type="email" autocomplete="username" required><label class="villa-label" for="admin-password">Password</label><input class="villa-input" id="admin-password" name="password" type="password" autocomplete="current-password" required><button class="btn btn--solid" type="submit">Sign in</button><p class="villa-form-note" data-admin-login-note role="status"></p></form></div></section>
    <p class="villa-state" data-admin-state>Checking team access&hellip;</p>
    <div class="villa-admin__workspace" data-admin-workspace hidden>
      <section class="villa-admin__section"><div class="villa-section-head"><div><p class="eyebrow">Published and in progress</p><h2 class="h2">Your villas</h2></div><button type="button" class="btn btn--solid" data-villa-new>+ Add a villa</button></div><div class="villa-admin__split"><div class="villa-admin__list" data-admin-villas></div><form class="villa-admin__editor" data-villa-editor hidden>
        <input type="hidden" name="id"><p class="eyebrow" data-editor-kicker>New listing</p><h3 class="h3" data-editor-title>Villa details</h3>
        <label class="villa-label">Villa name<input class="villa-input" name="name" required maxlength="120"></label>
        <label class="villa-label">City or region<input class="villa-input" name="city" required maxlength="120"></label>
        <label class="villa-label">Address<input class="villa-input" name="address" maxlength="400"></label>
        <label class="villa-label">Google Maps link<input class="villa-input" name="googleMapsUrl" type="url" placeholder="https://maps.google.com/…"></label>
        <label class="villa-label">Google Place ID <input class="villa-input" name="googlePlaceId" maxlength="180"></label>
        <div class="villa-admin__fields"><label class="villa-label">Latitude<input class="villa-input" name="lat" type="number" step="any" min="-90" max="90"></label><label class="villa-label">Longitude<input class="villa-input" name="lng" type="number" step="any" min="-180" max="180"></label></div>
        <div class="villa-admin__fields"><label class="villa-label">Bedrooms<input class="villa-input" name="bedrooms" type="number" min="0" max="100"></label><label class="villa-label">Sleeps<input class="villa-input" name="maxGuests" type="number" min="1" max="500"></label></div>
        <label class="villa-label">Description<textarea class="villa-input" name="description" rows="4" maxlength="5000"></textarea></label>
        <label class="villa-label">Amenities <span class="villa-hint">Separate each with a comma</span><input class="villa-input" name="amenities" placeholder="Pool, chef, garden"></label>
        <div class="villa-label">Verified nearby places <span class="villa-hint">Add places the villa team has personally verified. Google results stay temporary.</span></div>
        <div class="villa-curated-list" data-curated-list></div><button class="villa-text-button" type="button" data-add-curated>+ Add a verified place</button>
        <p class="villa-form-note" data-editor-note role="status"></p><div class="villa-admin__actions"><button class="btn btn--solid" type="submit" data-save-villa>Save draft</button><button class="btn" type="button" data-publish-villa hidden>Publish</button><button class="villa-text-button" type="button" data-cancel-editor>Cancel</button></div>
      </form></div></section>
      <section class="villa-admin__section"><div class="villa-section-head"><div><p class="eyebrow">Owner introductions</p><h2 class="h2">Submissions</h2></div></div><div class="villa-submissions" data-admin-submissions></div></section>
    </div>
  </div>`;
}

module.exports = { villasBody, villaBody, villaSubmissionBody, adminVillasBody };
