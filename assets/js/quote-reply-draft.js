/* Drafts the first reply to a waiting quote as a mailto link. Friday never sends it: the designer's own mail app opens with the draft.
   Only fields the quote already stores are used (destination, dates, group size, traveller email). Missing ones are left out. */
(function () {
  'use strict';

  var EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

  function clean(value, max) {
    return typeof value === 'string' ? value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, max || 200) : '';
  }

  function datesText(dates) {
    var start = dates && clean(dates.start, 20), end = dates && clean(dates.end, 20);
    if (start && end) return start + ' to ' + end;
    return start || end || '';
  }

  function travellersText(count) {
    var n = typeof count === 'number' ? count : parseInt(count, 10);
    if (!Number.isInteger(n) || n < 1 || n > 99) return '';
    return n === 1 ? '1 traveller' : n + ' travellers';
  }

  /* Returns { to, subject, body, href } for a quote with a usable email, or null. */
  function build(quote) {
    var to = quote && clean(quote.customerEmail, 320);
    if (!to || !EMAIL.test(to)) return null;
    var snap = (quote && quote.snapshot) || {};
    var destination = clean(snap.destination, 120);
    var dates = datesText(snap.dates);
    var group = travellersText(snap.travelers);

    var subject = destination ? 'Your Friday trip to ' + destination : 'Your Friday trip';
    var trip = destination ? 'your ' + destination + ' trip' : 'your trip';
    var details = [dates, group].filter(Boolean).join(', ');
    var lines = [
      'Hello,',
      '',
      'Thank you for planning ' + trip + (details ? ' (' + details + ')' : '') + ' with Friday.',
      '',
      'I am reviewing your plan now and will come back to you with your quote shortly. If anything has changed since you wrote to us, just reply to this email.',
      '',
      'Warm regards,',
      'Friday'
    ];
    var body = lines.join('\n');
    var href = 'mailto:' + encodeURIComponent(to) +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
    return { to: to, subject: subject, body: body, href: href };
  }

  window.FridayQuoteReplyDraft = { build: build };
})();
