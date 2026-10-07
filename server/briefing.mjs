const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = value => typeof value === 'string' && ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const clean = (value, max = 180) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function briefingDaysBefore(date, today = new Date().toISOString().slice(0, 10)) {
  if (!validDate(date) || !validDate(today)) return null;
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
}

function questionList(data) {
  const source = data.openQuestions || data.questions || data.clarifications || data.claudeState?.openQuestions || data.claudeState?.questions || [];
  if (!Array.isArray(source)) return [];
  return source.map(item => clean(typeof item === 'string' ? item : item?.question || item?.text || item?.label || item?.title, 300)).filter(Boolean).slice(0, 12);
}

export function prepareBriefing({ tripId, tripData, bookingRows = [], recipient, origin, now = new Date() }) {
  const state = tripData?.claudeState && typeof tripData.claudeState === 'object' ? tripData.claudeState : {};
  const linked = bookingRows.map(row => {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data || {};
    return { id: row.id, data };
  }).filter(({ data }) => data.tripId === tripId || data.claudeState?.tripId === tripId);
  const confirmed = linked.filter(({ data }) => data.dateStatus === 'confirmed' && validDate(data.start || data.date));
  const tripDate = tripData.startDate || state.startDate || state.prefs?.dates?.start || '';
  const matching = confirmed.filter(({ data }) => !tripDate || (data.start || data.date) === tripDate);
  const departureDate = validDate(tripDate) ? tripDate : (matching[0]?.data.start || matching[0]?.data.date || '');
  const daysBeforeDeparture = briefingDaysBefore(departureDate, now.toISOString().slice(0, 10));
  const eligible = !!departureDate && matching.length > 0 && daysBeforeDeparture !== null && daysBeforeDeparture >= 0 && daysBeforeDeparture <= 7;
  const bookings = linked.map(({ id, data }) => ({
    id,
    title: clean(data.title || data.name || data.type || 'Travel booking'),
    date: validDate(data.start || data.date) ? data.start || data.date : '',
    end: validDate(data.end) ? data.end : '',
    confirmed: data.dateStatus === 'confirmed',
  }));
  const questions = questionList(tripData);
  const title = clean(tripData.title || state.title || tripData.destination || 'Your Friday trip');
  const endDate = tripData.endDate || state.endDate || state.prefs?.dates?.end || '';
  const backUrl = `${String(origin || '').replace(/\/$/, '')}/trip.html?ref=briefing&trip=${encodeURIComponent(tripId)}`;
  const contact = `${String(origin || '').replace(/\/$/, '')}/contact.html`;
  const bookingLines = bookings.length ? bookings.map(item => `• ${item.title}${item.date ? ` · ${item.date}${item.end ? `–${item.end}` : ''}` : ''}${item.confirmed ? ' · confirmed date' : ' · date to confirm'}`).join('\n') : 'No bookings have been linked to this trip yet.';
  const questionLines = questions.length ? questions.map(item => `• ${item}`).join('\n') : 'No open questions are saved for this trip.';
  const htmlBookings = bookings.length ? `<ul>${bookings.map(item => `<li>${escapeHtml(item.title)}${item.date ? ` · ${escapeHtml(item.date)}${item.end ? `–${escapeHtml(item.end)}` : ''}` : ''}${item.confirmed ? ' · confirmed date' : ' · date to confirm'}</li>`).join('')}</ul>` : '<p>No bookings have been linked to this trip yet.</p>';
  const htmlQuestions = questions.length ? `<ul>${questions.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p>No open questions are saved for this trip.</p>';
  const dateLabel = departureDate ? `${departureDate}${validDate(endDate) ? ` to ${endDate}` : ''}` : 'Dates to confirm';
  const subject = `A week to go: ${title}`;
  const text = `Hello,\n\nYour trip ${title} is coming up${departureDate ? ` on ${dateLabel}` : ''}.\n\nBookings found:\n${bookingLines}\n\nOpen questions:\n${questionLines}\n\nNeed a hand? Reach Friday’s travel designer at ${contact}.\n\nOpen your trip: ${backUrl}\n\nFriday`;
  const html = `<p>Hello,</p><p>Your trip <strong>${escapeHtml(title)}</strong> is coming up. <strong>${escapeHtml(dateLabel)}</strong>.</p><h2>Bookings found</h2>${htmlBookings}<h2>Open questions</h2>${htmlQuestions}<p>Need a hand? <a href="${escapeHtml(contact)}">Reach Friday’s travel designer</a>.</p><p><a href="${escapeHtml(backUrl)}">Open your trip</a></p><p>Friday</p>`;
  return { tripId, title, departureDate, endDate: validDate(endDate) ? endDate : '', daysBeforeDeparture, recipient: clean(recipient, 254), eligible, bookings, questions, subject, text, html, tripUrl: backUrl };
}

export function briefingEmail({ dedupeKey, briefing, emailService }) {
  return emailService.send({
    dedupeKey,
    kind: 'pre_departure_briefing',
    to: briefing.recipient,
    subject: briefing.subject,
    text: briefing.text,
    html: briefing.html,
  });
}
