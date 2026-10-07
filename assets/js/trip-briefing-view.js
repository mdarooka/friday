(function () {
  'use strict';
  var FT = window.FridayTrip = window.FridayTrip || {};
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }
  function itemHtml(item) {
    return '<li>' + (item.time ? '<strong>' + esc(item.time) + ' · </strong>' : '') + esc(item.title || 'Stop') +
      (item.address ? '<span class="friday-briefing__detail">' + esc(item.address) + '</span>' : '') +
      (item.notes ? '<p>' + esc(item.notes) + '</p>' : '') + '</li>';
  }
  function render(main, briefing) {
    var days = Array.isArray(briefing.days) ? briefing.days : [];
    var bookings = Array.isArray(briefing.bookings) ? briefing.bookings : [];
    var tripDays = days.length ? days.map(function (day, index) {
      return '<article class="friday-briefing__day"><p class="friday-briefing__eyebrow">Day ' + (index + 1) + (day.date ? ' · ' + esc(day.date) : '') + '</p>' +
        '<h2>' + esc(day.title || 'A day in your trip') + '</h2>' +
        (day.notes ? '<p class="friday-briefing__note">' + esc(day.notes) + '</p>' : '') +
        (day.items && day.items.length ? '<ol>' + day.items.map(itemHtml).join('') + '</ol>' : '<p class="friday-briefing__empty">No stops saved for this day.</p>') + '</article>';
    }).join('') : '<p class="friday-briefing__empty">No day-by-day plan has been saved yet.</p>';
    var stay = briefing.stay ? '<div class="friday-briefing__stay"><h3>' + esc(briefing.stay.name) + '</h3>' +
      (briefing.stay.start ? '<p>' + esc(briefing.stay.start) + (briefing.stay.end ? ' – ' + esc(briefing.stay.end) : '') + '</p>' : '') +
      (briefing.stay.address ? '<p>' + esc(briefing.stay.address) + '</p>' : '') +
      '<p class="friday-briefing__muted">A planned stay, not a confirmed reservation.</p></div>' : '<p class="friday-briefing__empty">No stay has been added to this trip yet.</p>';
    var bookingRows = bookings.length ? '<ul class="friday-briefing__bookings">' + bookings.map(function (booking) {
      return '<li><strong>' + esc(booking.title) + '</strong>' +
        (booking.date ? '<span>' + esc(booking.date) + (booking.time ? ' · ' + esc(booking.time) : '') + (booking.end ? ' – ' + esc(booking.end) : '') + '</span>' : '') +
        '<span>' + (booking.confirmed ? 'Date marked confirmed' : 'Confirmation needed') + '</span>' +
        (booking.reference ? '<span>Reference: ' + esc(booking.reference) + '</span>' : '') +
        (booking.location ? '<span>' + esc(booking.location) + '</span>' : '') + '</li>';
    }).join('') + '</ul>' : '<p class="friday-briefing__empty">No bookings have been linked to this trip yet.</p>';
    var questions = Array.isArray(briefing.questions) && briefing.questions.length ? '<ul>' + briefing.questions.map(function (question) { return '<li>' + esc(question) + '</li>'; }).join('') + '</ul>' : '<p class="friday-briefing__empty">No open questions are saved for this trip.</p>';
    main.innerHTML = '<article class="friday-briefing"><header class="friday-briefing__hero"><a class="friday-briefing__wordmark" href="trip.html">Friday</a>' +
      '<p class="friday-briefing__eyebrow">Your trip briefing</p><h1>' + esc(briefing.title || 'Your Friday trip') + '</h1>' +
      (briefing.destination ? '<p class="friday-briefing__destination">' + esc(briefing.destination) + '</p>' : '') +
      '<p class="friday-briefing__dates">' + esc(briefing.dateLabel || 'Dates to confirm') + '</p>' +
      '<div class="friday-briefing__actions"><button type="button" class="fx-btn fx-btn--ink" data-print-briefing>Print or save</button><a class="fx-btn fx-btn--line" href="trip.html">Back to planner</a></div></header>' +
      '<section class="friday-briefing__section"><p class="friday-briefing__eyebrow">The plan</p><h2>Day by day</h2>' + tripDays + '</section>' +
      '<section class="friday-briefing__section"><p class="friday-briefing__eyebrow">Where you stay</p>' + stay + '</section>' +
      '<section class="friday-briefing__section"><p class="friday-briefing__eyebrow">Bookings and confirmations</p><h2>What your trip holds</h2>' + bookingRows + '</section>' +
      '<section class="friday-briefing__section"><p class="friday-briefing__eyebrow">Before you go</p><h2>Things to confirm</h2>' + questions + '</section>' +
      '<footer class="friday-briefing__contact"><p class="friday-briefing__eyebrow">Friday is here to help</p><h2>Need a hand?</h2><p>Email <a href="mailto:' + esc(briefing.contactEmail) + '">' + esc(briefing.contactEmail) + '</a>. ' + esc(briefing.replyPromise) + '</p><a href="contact.html">Contact Friday</a></footer></article>';
    main.querySelector('[data-print-briefing]').addEventListener('click', function () { window.print(); });
    document.body.classList.add('fx-briefing-page');
    var app = document.querySelector('[data-app]'); if (app) app.classList.add('fx-briefing-app');
    var side = document.querySelector('[data-side]'); if (side) side.hidden = true;
    var nav = document.querySelector('.fx-start-header__nav'); if (nav) nav.hidden = true;
    if (window.FridayAnalytics) window.FridayAnalytics.track('$page-view', { path: '/trip-briefing.html' });
  }
  function showMessage(main, title, message, retry) {
    main.innerHTML = '<section class="friday-briefing__state"><a class="friday-briefing__wordmark" href="trip.html">Friday</a><p class="friday-briefing__eyebrow">Your trip briefing</p><h1>' + esc(title) + '</h1><p>' + esc(message) + '</p>' +
      (retry ? '<button type="button" class="fx-btn fx-btn--ink" data-retry-briefing>Try again</button>' : '') + '<a class="fx-btn fx-btn--line" href="trip.html">Back to planner</a></section>';
    document.body.classList.add('fx-briefing-page');
    var side = document.querySelector('[data-side]'); if (side) side.hidden = true;
    var nav = document.querySelector('.fx-start-header__nav'); if (nav) nav.hidden = true;
  }
  FT.briefingView = { render: render, showMessage: showMessage };
})();
