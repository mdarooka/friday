'use strict';

/* Body fragment for Friday's unified admin console. */
function adminBody() {
  return `<div class="villa-site villa-admin admin-hub wrap" data-admin-page="hub">
    <section class="villa-admin__head">
      <div>
        <p class="eyebrow">Friday team &middot; Console</p>
        <h1 class="h2">Operations Console</h1>
      </div>
      <div class="admin-user-bar" data-admin-user-bar hidden>
        <span class="admin-user-name" data-admin-user-name></span>
        <button type="button" class="villa-text-button" data-admin-logout>Sign out</button>
        <a class="villa-back" href="index.html">&larr; Back to Friday</a>
      </div>
    </section>

    <section class="villa-admin__login" data-admin-login hidden>
      <div class="villa-admin__card">
        <p class="eyebrow">Team access</p>
        <h2 class="h3">Sign in to continue</h2>
        <p class="card__d">Use your Friday team account to access operations.</p>
        <form data-admin-login-form>
          <label class="villa-label" for="admin-email">Email</label>
          <input class="villa-input" id="admin-email" name="email" type="email" autocomplete="username" required>
          <label class="villa-label" for="admin-password">Password</label>
          <input class="villa-input" id="admin-password" name="password" type="password" autocomplete="current-password" required>
          <button class="btn btn--solid" type="submit">Sign in</button>
          <p class="villa-form-note" data-admin-login-note role="status"></p>
        </form>
      </div>
    </section>

    <p class="villa-state" data-admin-state>Checking team access&hellip;</p>

    <div class="admin-workspace" data-admin-workspace hidden>
      <nav class="admin-tabs" role="tablist" aria-label="Admin console navigation">
        <button type="button" class="admin-tab is-active" role="tab" aria-selected="true" data-tab="villas">Villas &amp; Submissions</button>
        <button type="button" class="admin-tab" role="tab" aria-selected="false" data-tab="quotes">Quote Delivery</button>
        <button type="button" class="admin-tab" role="tab" aria-selected="false" data-tab="ai">AI Conversation Review</button>
        <button type="button" class="admin-tab" role="tab" aria-selected="false" data-tab="comms">Enquiries &amp; Outbox</button>
      </nav>

      <!-- Tab 1: Villas & Stays -->
      <div class="admin-panel is-active" data-panel="villas" role="tabpanel">
        <section class="villa-admin__section">
          <div class="villa-section-head">
            <div>
              <p class="eyebrow">Published &amp; in progress</p>
              <h2 class="h3">Your villas</h2>
            </div>
            <button type="button" class="btn btn--solid" data-villa-new>+ Add a villa</button>
          </div>
          <div class="villa-admin__split">
            <div class="villa-admin__list" data-admin-villas></div>
            <form class="villa-admin__editor" data-villa-editor hidden>
              <input type="hidden" name="id">
              <p class="eyebrow" data-editor-kicker>New listing</p>
              <h3 class="h3" data-editor-title>Villa details</h3>
              <label class="villa-label">Villa name<input class="villa-input" name="name" required maxlength="120"></label>
              <label class="villa-label">City or region<input class="villa-input" name="city" required maxlength="120"></label>
              <label class="villa-label">Address<input class="villa-input" name="address" maxlength="400"></label>
              <label class="villa-label">Google Maps link<input class="villa-input" name="googleMapsUrl" type="url" placeholder="https://maps.google.com/…"></label>
              <label class="villa-label">Google Place ID<input class="villa-input" name="googlePlaceId" maxlength="180"></label>
              <div class="villa-admin__fields">
                <label class="villa-label">Latitude<input class="villa-input" name="lat" type="number" step="any" min="-90" max="90"></label>
                <label class="villa-label">Longitude<input class="villa-input" name="lng" type="number" step="any" min="-180" max="180"></label>
              </div>
              <div class="villa-admin__fields">
                <label class="villa-label">Bedrooms<input class="villa-input" name="bedrooms" type="number" min="0" max="100"></label>
                <label class="villa-label">Sleeps<input class="villa-input" name="maxGuests" type="number" min="1" max="500"></label>
              </div>
              <label class="villa-label">Description<textarea class="villa-input" name="description" rows="4" maxlength="5000"></textarea></label>
              <label class="villa-label">Amenities <span class="villa-hint">Separate each with a comma</span><input class="villa-input" name="amenities" placeholder="Pool, chef, garden"></label>
              <div class="villa-label">Verified nearby places <span class="villa-hint">Add places the villa team has personally verified. Google results stay temporary.</span></div>
              <div class="villa-curated-list" data-curated-list></div>
              <button class="villa-text-button" type="button" data-add-curated>+ Add a verified place</button>
              <p class="villa-form-note" data-editor-note role="status"></p>
              <div class="villa-admin__actions">
                <button class="btn btn--solid" type="submit" data-save-villa>Save draft</button>
                <button class="btn" type="button" data-publish-villa hidden>Publish</button>
                <button class="btn btn--danger" type="button" data-delete-villa hidden>Delete</button>
                <button class="villa-text-button" type="button" data-cancel-editor>Cancel</button>
              </div>
            </form>
          </div>
        </section>
        <section class="villa-admin__section">
          <div class="villa-section-head">
            <div>
              <p class="eyebrow">Owner introductions</p>
              <h2 class="h3">Submissions</h2>
            </div>
          </div>
          <div class="villa-submissions" data-admin-submissions></div>
        </section>
      </div>

      <!-- Tab 2: Quote Delivery -->
      <div class="admin-panel" data-panel="quotes" role="tabpanel" hidden>
        <section class="villa-admin__section">
          <div class="villa-section-head">
            <div>
              <p class="eyebrow">Client requests</p>
              <h2 class="h3">Quotes queue</h2>
            </div>
            <p class="admin-setup-note" data-quote-setup-note></p>
          </div>
          <div class="admin-quotes-split">
            <div class="admin-quotes-list" data-admin-quotes></div>
            <div class="admin-quote-drawer" data-quote-drawer hidden>
              <div class="villa-admin__card">
                <div class="drawer-header">
                  <div>
                    <p class="eyebrow">Quote proposal</p>
                    <h3 class="h3" data-quote-title>Prepare quote</h3>
                  </div>
                  <button type="button" class="villa-text-button" data-close-quote-drawer>&times; Close</button>
                </div>
                <div class="quote-summary-info" data-quote-summary-info></div>
                <form data-quote-form>
                  <input type="hidden" name="quoteId">
                  <div class="villa-admin__fields">
                    <label class="villa-label">Amount<input class="villa-input" name="amount" type="number" step="0.01" min="0" required></label>
                    <label class="villa-label">Currency<input class="villa-input" name="currency" value="USD" maxlength="3" required></label>
                  </div>
                  <label class="villa-label">Quote details &amp; inclusions<textarea class="villa-input" name="details" rows="5" required placeholder="Design fee, curated experiences, villa reservations, and special inclusions..."></textarea></label>
                  <div class="villa-admin__actions">
                    <button class="btn btn--solid" type="button" data-preview-quote-btn>Preview quote email</button>
                  </div>
                </form>
                <div class="quote-preview-box" data-quote-preview-box hidden>
                  <p class="eyebrow">Generated email preview</p>
                  <div class="quote-preview-header">
                    <p><strong>To:</strong> <span data-preview-to></span></p>
                    <p><strong>Subject:</strong> <span data-preview-subject></span></p>
                  </div>
                  <pre class="quote-preview-text" data-preview-text></pre>
                  <div class="villa-admin__actions">
                    <button class="btn btn--solid" type="button" data-send-quote-btn>Deliver quote to client</button>
                  </div>
                </div>
                <p class="villa-form-note" data-quote-note role="status"></p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- Tab 3: AI Conversation Review -->
      <div class="admin-panel" data-panel="ai" role="tabpanel" hidden>
        <section class="villa-admin__section">
          <div class="villa-section-head">
            <div>
              <p class="eyebrow">Audit &amp; transcripts</p>
              <h2 class="h3">AI conversation events</h2>
            </div>
          </div>
          <form class="admin-ai-filter" data-ai-filter-form>
            <div class="admin-filter-fields">
              <label class="villa-label">Conversation ID<input class="villa-input" name="conversationId" placeholder="Filter by thread ID…"></label>
              <label class="villa-label">Owner ID<input class="villa-input" name="ownerId" placeholder="Filter by user ID…"></label>
            </div>
            <div class="admin-filter-actions">
              <button class="btn btn--solid" type="submit">Filter events</button>
              <button class="btn" type="button" data-ai-filter-reset>Reset</button>
            </div>
          </form>
          <div class="admin-ai-split">
            <div class="admin-ai-list" data-admin-ai-list></div>
            <div class="admin-ai-inspector" data-ai-inspector hidden>
              <div class="villa-admin__card">
                <div class="drawer-header">
                  <div>
                    <p class="eyebrow" data-inspector-meta>Event details</p>
                    <h3 class="h3" data-inspector-title>Payload inspector</h3>
                  </div>
                  <button type="button" class="villa-text-button" data-close-ai-inspector>&times; Close</button>
                </div>
                <dl class="ai-event-details" data-inspector-dl></dl>
                <div class="villa-label">JSON content</div>
                <pre class="ai-event-content" data-inspector-content></pre>
              </div>
            </div>
          </div>
          <div class="admin-ai-pagination">
            <button type="button" class="btn" data-ai-load-more hidden>Load older events</button>
          </div>
        </section>
      </div>

      <!-- Tab 4: Enquiries & Outbox -->
      <div class="admin-panel" data-panel="comms" role="tabpanel" hidden>
        <section class="villa-admin__section">
          <div class="villa-section-head">
            <div>
              <p class="eyebrow">Outreach &amp; requests</p>
              <h2 class="h3">Commission enquiries</h2>
            </div>
          </div>
          <div class="admin-table-container" data-admin-enquiries-table></div>
        </section>
        <section class="villa-admin__section">
          <div class="villa-section-head">
            <div>
              <p class="eyebrow">Marketing consent</p>
              <h2 class="h3">Newsletter subscribers</h2>
            </div>
          </div>
          <div class="admin-table-container" data-admin-subscribers-table></div>
        </section>
        <section class="villa-admin__section">
          <div class="villa-section-head">
            <div>
              <p class="eyebrow">Durable delivery</p>
              <h2 class="h3">Email outbox metadata</h2>
            </div>
          </div>
          <div class="admin-table-container" data-admin-outbox-table></div>
        </section>
      </div>
    </div>
  </div>`;
}

module.exports = { adminBody };
