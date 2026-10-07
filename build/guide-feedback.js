'use strict';
/* Reusable "Was this useful?" prompt for public guides. In a guide body, add one line:
     ${guideFeedback('kerala')}
   The slug is lowercase letters, digits and hyphens. The snippet brings its own stylesheet and script. */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function guideFeedback(slug) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 40) throw new Error(`guideFeedback: invalid slug "${slug}"`);
  return `<link rel="stylesheet" href="assets/css/guide-feedback.css">
<section class="section section--tight guide-feedback" data-guide-feedback="${esc(slug)}" aria-labelledby="gf-${esc(slug)}"><div class="wrap">
  <p class="eyebrow">Was this useful?</p>
  <h2 class="h3 guide-feedback__q" id="gf-${esc(slug)}">Did this guide help you plan?</h2>
  <div class="guide-feedback__row" role="group" aria-labelledby="gf-${esc(slug)}">
    <button type="button" class="btn guide-feedback__btn" data-gf-vote="yes" aria-pressed="false">Yes</button>
    <button type="button" class="btn guide-feedback__btn" data-gf-vote="no" aria-pressed="false">Not really</button>
  </div>
  <form class="guide-feedback__note" data-gf-note hidden>
    <label for="gf-note-${esc(slug)}">Anything we should fix or add? <span>(optional, up to 280 characters)</span></label>
    <textarea id="gf-note-${esc(slug)}" name="note" rows="3" maxlength="280"></textarea>
    <button type="submit" class="link">Send note <span class="arrow">&rarr;</span></button>
  </form>
  <p class="guide-feedback__status" data-gf-status role="status" aria-live="polite"></p>
</div></section>
<script src="assets/js/guide-feedback.js" defer></script>`;
}
module.exports = { guideFeedback };
