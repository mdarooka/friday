import siteData from '../build/data.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = value => typeof value === 'string' && ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const clean = (value, max = 180) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const dateAndTime = value => {
  if (validDate(value)) return { date: value, time: '' };
  const match = typeof value === 'string' && /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/.exec(value);
  return match && validDate(match[1]) ? { date: match[1], time: match[2] } : { date: '', time: '' };
};

export function briefingDaysBefore(date, today = new Date().toISOString().slice(0, 10)) {
  if (!validDate(date) || !validDate(today)) return null;
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
}

function questionList(data) {
  const source = data.openQuestions || data.questions || data.clarifications || data.claudeState?.openQuestions || data.claudeState?.questions || [];
  if (!Array.isArray(source)) return [];
  return source.map(item => clean(typeof item === 'string' ? item : item?.question || item?.text || item?.label || item?.title, 300)).filter(Boolean).slice(0, 12);
}

export function prepareBriefing({ tripId, tripData, bookingRows = [], recipient, origin, now = new Date(), source = '' }) {
  const state = tripData?.claudeState && typeof tripData.claudeState === 'object' ? tripData.claudeState : {};
  const linked = bookingRows.map(row => {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data || {};
    return { id: row.id, data };
  }).filter(({ data }) => data.tripId === tripId || data.claudeState?.tripId === tripId);
  const confirmed = linked.filter(({ data }) => data.dateStatus === 'confirmed' && dateAndTime(data.start || data.date).date);
  const tripDate = tripData.startDate || state.startDate || state.prefs?.dates?.start || '';
  const endDate = tripData.endDate || state.endDate || state.prefs?.dates?.end || '';
  const shiftDay = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
  const span = ({ data }) => { const start = dateAndTime(data.start || data.date).date; return { start, end: dateAndTime(data.end).date || start }; };
  let matching, departureDate;
  if (validDate(tripDate)) {
    const windowStart = shiftDay(tripDate, -2), windowEnd = validDate(endDate) && endDate >= tripDate ? endDate : shiftDay(tripDate, 60);
    matching = confirmed.filter(booking => { const { start, end } = span(booking); return start <= windowEnd && end >= windowStart; });
    departureDate = tripDate;
  } else {
    matching = confirmed;
    departureDate = matching.map(booking => span(booking).start).filter(Boolean).sort()[0] || '';
  }
  const daysBeforeDeparture = briefingDaysBefore(departureDate, now.toISOString().slice(0, 10));
  const eligible = !!departureDate && matching.length > 0 && daysBeforeDeparture !== null && daysBeforeDeparture >= 0 && daysBeforeDeparture <= 7;
  const bookings = linked.map(({ id, data }) => {
    const start = dateAndTime(data.start || data.date), end = dateAndTime(data.end);
    return {
      id,
      title: clean(data.title || data.name || data.type || 'Travel booking'),
      type: clean(data.type || '', 40),
      date: start.date,
      time: start.time,
      end: end.date,
      confirmed: data.dateStatus === 'confirmed',
      reference: clean(data.ref || data.reference || '', 100),
      location: clean(data.location || '', 180),
    };
  });
  const days = Array.isArray(tripData.days) ? tripData.days.slice(0, 180).map(day => ({
    title: clean(day?.title || day?.town || day?.area || '', 120),
    date: validDate(day?.date) ? day.date : '',
    notes: clean(day?.notes || '', 400),
    items: Array.isArray(day?.items) ? day.items.slice(0, 100).map(item => ({
      title: clean(typeof item === 'string' ? item : item?.title || item?.name || item?.place || '', 160),
      time: clean(item?.time || '', 40),
      notes: clean(item?.notes || item?.note || item?.description || '', 240),
      address: clean(item?.address || '', 180),
    })).filter(item => item.title) : [],
  })).filter(day => day.title || day.date || day.items.length) : [];
  const staySource = tripData.stay && typeof tripData.stay === 'object' ? tripData.stay : null;
  const stay = staySource && clean(staySource.name || staySource.title || '', 160) ? {
    name: clean(staySource.name || staySource.title, 160),
    address: clean(staySource.address || '', 180),
    start: validDate(staySource.start) ? staySource.start : '',
    end: validDate(staySource.end) ? staySource.end : '',
  } : null;
  const questions = questionList(tripData);
  const title = clean(tripData.title || state.title || tripData.destination || 'Your Friday trip');
  const destination = clean(tripData.destination || state.destination || '', 120);
  const dateLabel = departureDate ? `${departureDate}${validDate(endDate) ? ` to ${endDate}` : ''}` : 'Dates to confirm';
  const backUrl = `${String(origin || '').replace(/\/$/, '')}/trip-briefing.html?ref=briefing&trip=${encodeURIComponent(tripId)}${/^[a-z]{1,20}$/.test(source) ? `&src=${source}` : ''}`;
  const contact = `${String(origin || '').replace(/\/$/, '')}/contact.html`;
  const contactEmail = siteData.brand.email;
  const replyPromise = 'A travel designer replies within 30 hours of an enquiry.';
  const dayLines = days.length ? days.map((day, i) => `Day ${i + 1}${day.date ? ` · ${day.date}` : ''}${day.title ? ` · ${day.title}` : ''}${day.items.length ? `\n${day.items.map(item => `  • ${item.time ? `${item.time} · ` : ''}${item.title}${item.address ? ` · ${item.address}` : ''}${item.notes ? ` — ${item.notes}` : ''}`).join('\n')}` : ''}${day.notes ? `\n  ${day.notes}` : ''}`).join('\n') : 'No day-by-day plan has been saved yet.';
  const stayLines = stay ? `${stay.name}${stay.start ? ` · ${stay.start}${stay.end ? `–${stay.end}` : ''}` : ''}${stay.address ? ` · ${stay.address}` : ''}\nThis is a planned stay, not a confirmed reservation.` : 'No stay has been added to this trip yet.';
  const bookingLines = bookings.length ? bookings.map(item => `• ${item.title}${item.date ? ` · ${item.date}${item.time ? ` ${item.time}` : ''}${item.end ? `–${item.end}` : ''}` : ''}${item.confirmed ? ' · date marked confirmed' : ' · confirmation needed'}${item.reference ? ` · ref ${item.reference}` : ''}${item.location ? ` · ${item.location}` : ''}`).join('\n') : 'No bookings have been linked to this trip yet.';
  const questionLines = questions.length ? questions.map(item => `• ${item}`).join('\n') : 'No open questions are saved for this trip.';
  const htmlDays = days.length ? days.map((day, i) => `<article><h3>Day ${i + 1}${day.date ? ` · ${escapeHtml(day.date)}` : ''}${day.title ? ` · ${escapeHtml(day.title)}` : ''}</h3>${day.notes ? `<p>${escapeHtml(day.notes)}</p>` : ''}${day.items.length ? `<ul>${day.items.map(item => `<li>${item.time ? `<strong>${escapeHtml(item.time)} · </strong>` : ''}${escapeHtml(item.title)}${item.address ? ` · ${escapeHtml(item.address)}` : ''}${item.notes ? ` — ${escapeHtml(item.notes)}` : ''}</li>`).join('')}</ul>` : '<p>No stops saved for this day.</p>'}</article>`).join('') : '<p>No day-by-day plan has been saved yet.</p>';
  const htmlStay = stay ? `<p><strong>${escapeHtml(stay.name)}</strong>${stay.start ? ` · ${escapeHtml(stay.start)}${stay.end ? `–${escapeHtml(stay.end)}` : ''}` : ''}${stay.address ? `<br>${escapeHtml(stay.address)}` : ''}<br>This is a planned stay, not a confirmed reservation.</p>` : '<p>No stay has been added to this trip yet.</p>';
  const htmlBookings = bookings.length ? `<ul>${bookings.map(item => `<li>${escapeHtml(item.title)}${item.date ? ` · ${escapeHtml(item.date)}${item.end ? `–${escapeHtml(item.end)}` : ''}` : ''}${item.confirmed ? ' · date marked confirmed' : ' · confirmation needed'}${item.reference ? ` · ref ${escapeHtml(item.reference)}` : ''}${item.location ? ` · ${escapeHtml(item.location)}` : ''}</li>`).join('')}</ul>` : '<p>No bookings have been linked to this trip yet.</p>';
  const htmlQuestions = questions.length ? `<ul>${questions.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p>No open questions are saved for this trip.</p>';
  const lead = daysBeforeDeparture === 0 ? 'Your trip starts today' : daysBeforeDeparture === 1 ? 'Your trip starts tomorrow' : daysBeforeDeparture >= 2 && daysBeforeDeparture <= 6 ? `${daysBeforeDeparture} days to go` : 'A week to go';
  const subject = `${lead}: ${title}`;
  const text = `Hello,\n\nYour trip ${title} is coming up${departureDate ? ` on ${dateLabel}` : ''}.\n\nDay-by-day plan:\n${dayLines}\n\nWhere you stay:\n${stayLines}\n\nBookings and confirmations:\n${bookingLines}\n\nOpen questions:\n${questionLines}\n\nNeed a hand? Email ${contactEmail} or use ${contact}. ${replyPromise}\n\nOpen your trip briefing: ${backUrl}\n\nFriday`;
  const html = `<p>Hello,</p><p>Your trip <strong>${escapeHtml(title)}</strong> is coming up. <strong>${escapeHtml(dateLabel)}</strong>.</p><h2>Your day-by-day plan</h2>${htmlDays}<h2>Where you stay</h2>${htmlStay}<h2>Bookings and confirmations</h2>${htmlBookings}<h2>Open questions</h2>${htmlQuestions}<p>Need a hand? Email <a href="mailto:${escapeHtml(contactEmail)}">${escapeHtml(contactEmail)}</a> or <a href="${escapeHtml(contact)}">contact Friday</a>. ${escapeHtml(replyPromise)}</p><p><a href="${escapeHtml(backUrl)}">Open your trip briefing</a></p><p>Friday</p>`;
  return { tripId, title, destination, departureDate, endDate: validDate(endDate) ? endDate : '', dateLabel, daysBeforeDeparture, recipient: clean(recipient, 254), eligible, matchingBookingIds: matching.map(booking => booking.id), days, stay, bookings, questions, contactEmail, replyPromise, subject, text, html, tripUrl: backUrl };
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
