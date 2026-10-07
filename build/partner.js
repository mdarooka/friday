'use strict';

const { Plate, eyebrow } = require('./templates');

/** Public first contact for villa owners. The admin workflow reviews every lead before publication. */
function partnerBody() {
  return `
<section class="phero wrap partner-hero">
  <div class="phero__grid">
    <div class="phero__title">
      ${eyebrow('For villa owners')}
      <h1 class="h1" style="margin-top:1.1rem" data-reveal>A place can be<br><em>part of a journey.</em></h1>
      <p class="lede" style="margin-top:1.6rem" data-reveal>Introduce your villa to Friday. We are building a considered collection of places to stay, each rooted in its setting and useful to the people travelling nearby.</p>
    </div>
    <div class="phero__side">
      <div class="partner-hero__note" data-reveal>
        <p class="eyebrow">A considered first step</p>
        <p>Share the place and where to find it. Our team will review your introduction and get in touch if it may suit the collection.</p>
      </div>
    </div>
  </div>
  <div class="partner-hero__plate" data-reveal="mask">${Plate('partner-villa', { ratio: 'w', scene: 'terraces', tone: 'moss', svgRatio: 'panorama' })}</div>
</section>

<section class="section partner-intro">
  <div class="wrap">
    <div class="grid">
      <div class="c-3 c-md-12">${eyebrow('More than a pin on a map')}</div>
      <div class="c-6 c-md-12 prose" data-reveal>
        <h2 class="h2">The location helps<br>shape the stay.</h2>
        <p>With a precise map location, Friday can understand the landscape around a home and help guests plan thoughtful days nearby. We are building this as part of the Friday travel experience; submitting a property does not guarantee inclusion or publication.</p>
      </div>
      <div class="c-3 c-md-12 partner-intro__aside" data-reveal>
        <span class="partner-intro__number">01</span>
        <p>Introduce the property</p>
        <span class="partner-intro__number">02</span>
        <p>Friday reviews the details</p>
        <span class="partner-intro__number">03</span>
        <p>We follow up personally</p>
      </div>
    </div>
  </div>
</section>

<section class="section inverse partner-form-section" id="introduce">
  <div class="wrap">
    <div class="grid">
      <div class="c-4 c-md-12 partner-form-lede">
        ${eyebrow('List your villa', 'eyebrow--accent')}
        <h2 class="h2" style="margin-top:1rem">Tell us about<br>your place.</h2>
        <p class="lede" style="margin-top:1.3rem">A few useful details are enough to begin. You can share more with us later.</p>
        <p class="partner-privacy">Your contact details are sent to Friday for review. We will not publish your property from this form.</p>
      </div>
      <div class="c-7 s-8 c-md-12">
        <form class="partner-form" data-villa-submission novalidate>
          <div class="partner-form__group">
            <p class="eyebrow eyebrow--accent">01 &middot; Your contact</p>
            <div class="partner-fields">
              <label class="partner-field"><span>Your name <i>Required</i></span><input name="contactName" autocomplete="name" required maxlength="100"></label>
              <label class="partner-field"><span>Email address <i>Required</i></span><input name="email" type="email" autocomplete="email" required maxlength="254"></label>
              <label class="partner-field"><span>Phone number <i>Optional</i></span><input name="phone" type="tel" autocomplete="tel" maxlength="40"></label>
            </div>
          </div>
          <div class="partner-form__group">
            <p class="eyebrow eyebrow--accent">02 &middot; The property</p>
            <div class="partner-fields">
              <label class="partner-field"><span>Villa or property name <i>Required</i></span><input name="villaName" required maxlength="140"></label>
              <label class="partner-field"><span>City or region <i>Required</i></span><input name="city" required maxlength="120" placeholder="For example, Alibaug"></label>
              <label class="partner-field partner-field--wide"><span>Google Maps link <i>Optional, helps us locate the property</i></span><input name="mapsUrl" type="url" inputmode="url" placeholder="https://maps.google.com/..." maxlength="1000"></label>
              <label class="partner-field"><span>Bedrooms <i>Optional</i></span><input name="bedrooms" type="number" min="1" max="100" inputmode="numeric"></label>
              <label class="partner-field"><span>Maximum guests <i>Optional</i></span><input name="maxGuests" type="number" min="1" max="500" inputmode="numeric"></label>
              <label class="partner-field"><span>Website <i>Optional</i></span><input name="website" type="url" inputmode="url" placeholder="https://" maxlength="1000"></label>
              <label class="partner-field"><span>Property photos <i>Optional link</i></span><input name="photosUrl" type="url" inputmode="url" placeholder="https://" maxlength="1000"></label>
              <label class="partner-field partner-field--wide"><span>A little about the place <i>Optional</i></span><textarea name="description" rows="4" maxlength="2500" placeholder="What makes this place and its setting distinctive?"></textarea></label>
            </div>
          </div>
          <label class="partner-consent"><input type="checkbox" name="consent" required><span>I agree that Friday may use these details to review this introduction and contact me about the property.</span></label>
          <div class="partner-trap" aria-hidden="true"><label>Leave this field empty<input name="websiteTrap" tabindex="-1" autocomplete="off"></label></div>
          <div class="partner-submit">
            <button class="btn btn--solid" type="submit">Send your introduction <span class="arrow">&rarr;</span></button>
            <p class="partner-form__status" data-villa-status role="status" aria-live="polite"></p>
          </div>
        </form>
      </div>
    </div>
  </div>
</section>

<section class="section section--tight">
  <div class="wrap partner-closing">
    ${eyebrow('For a thoughtful collection')}
    <h2 class="h2" data-reveal>Good places make<br>room for <em>good days.</em></h2>
    <p class="lede" data-reveal>We are interested in homes with a strong sense of place and owners who care about the experience around them.</p>
    <p data-reveal><a class="link" href="villas.html">Explore Friday villas <span class="arrow">&rarr;</span></a></p>
  </div>
</section>`;
}

module.exports = { partnerBody };
