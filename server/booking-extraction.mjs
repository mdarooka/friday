const MONTHS = Object.fromEntries([
  ...'january february march april may june july august september october november december'.split(' ').map((m,i)=>[m,i+1]),
  ...'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ').map((m,i)=>[m,i+1]),
]);

const clean = (value,max=3000) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/\s+/g, ' ').trim().slice(0,max);
const dayIso = (year, month, day) => {
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return '';
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

function parseDateAt(text, index) {
  const s = text.slice(index);
  let m = s.match(/^\s*(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return { date: dayIso(+m[1], +m[2], +m[3]), ambiguous: false, length: m[0].length };
  m = s.match(/^\s*(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/);
  if (m) {
    const a=+m[1], b=+m[2], year=+m[3];
    if (a <= 12 && b <= 12) return {date:'', ambiguous:true, length:m[0].length};
    return {date:dayIso(year, a > 12 ? b : a, a > 12 ? a : b), ambiguous:false, length:m[0].length};
  }
  m = s.match(/^\s*(\d{1,2})\s+([A-Za-z]{3,9})\.?[,]?\s+(\d{4})\b/i);
  if (m && MONTHS[m[2].toLowerCase().slice(0,3)]) return {date:dayIso(+m[3], MONTHS[m[2].toLowerCase().slice(0,3)], +m[1]), ambiguous:false, length:m[0].length};
  m = s.match(/^\s*([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(\d{4})\b/i);
  if (m && MONTHS[m[1].toLowerCase().slice(0,3)]) return {date:dayIso(+m[3], MONTHS[m[1].toLowerCase().slice(0,3)], +m[2]), ambiguous:false, length:m[0].length};
  // A labelled date without a year is intentionally unresolved; never borrow the message date.
  m = s.match(/^\s*(?:\d{1,2}\s+[A-Za-z]{3,9}|[A-Za-z]{3,9}\s+\d{1,2})(?:st|nd|rd|th)?\b/i);
  if (m) return {date:'', ambiguous:true, length:m[0].length};
  return null;
}

const dateLabels = /\b(?:travel\s+date|date\s+of\s+travel|departure(?:\s+date)?|depart(?:ure)?|outbound|check[- ]?in|arrival(?:\s+date)?|start\s+date|from)\b\s*[:#-]?/ig;
const endLabels = /\b(?:return(?:\s+date)?|check[- ]?out|departure\s+back|end\s+date|to)\b\s*[:#-]?/ig;
function labelledDate(text, labels) {
  labels.lastIndex=0; let match; const found=[];
  while ((match=labels.exec(text))) {
    const parsed=parseDateAt(text,labels.lastIndex);
    if (parsed) found.push(parsed);
  }
  const distinct=[...new Set(found.filter(x=>x.date).map(x=>x.date))];
  if (distinct.length>1 || found.some(x=>x.ambiguous)) return {date:'',ambiguous:true};
  return found.find(x=>x.date)||null;
}
function jsonLd(html) {
  const output=[];
  for (const match of String(html||'').matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { const value=JSON.parse(match[1]); output.push(...(Array.isArray(value)?value:[value])); } catch {}
  }
  return output;
}
function flattenJsonLd(nodes) {
  const out=[];
  const visit=value=>{ if(!value||typeof value!=='object')return; if(Array.isArray(value)){value.forEach(visit);return;} out.push(value); if(value['@graph'])visit(value['@graph']); };
  nodes.forEach(visit); return out;
}

export function extractBooking({subject='', from='', body='', snippet='', schema=[], externalId='', sourceUrl='', confirmationDate='', tripId='', today=new Date().toISOString().slice(0,10), includePast=false}={}) {
  const text=clean(`${subject}\n${from}\n${body}\n${snippet}`);
  const cancelledSubject=/\b(?:cancelled|canceled|refund(?:ed)?|voided)\b/i.test(subject);
  const cancelledStatement=/\b(?:booking|reservation|flight|hotel|trip|stay|ticket|itinerary)\s+(?:has been|was|is now|is)\s+(?:cancelled|canceled|refunded|voided)\b|\b(?:cancelled|canceled|refunded|voided)\s+(?:booking|reservation|flight|hotel|trip|stay|ticket|itinerary)\b/i.test(text);
  if (cancelledSubject || cancelledStatement) return {skip:'cancelled'};
  const promotionalSubject=/\b(?:sale|discount|promo(?:tion)?|deal of the day|limited time offer|newsletter|travel inspiration)\b/i.test(subject);
  const positive=/\b(?:booking|reservation|flight|hotel|airline|itinerary|e-ticket|ticket number|confirmation number|confirmation code|booking reference|reservation number)\b/i.test(text);
  const confirmed=/\b(?:booking|reservation)\s+(?:is\s+)?confirmed\b|\bconfirmation\s+(?:number|code|for|of)\b|\be[- ]?ticket\b|\bticketed\b|\bbooking reference\b|\breservation number\b/i.test(text);
  if (promotionalSubject && !confirmed) return {skip:'promotional'};
  const structured=flattenJsonLd(schema).find(x=>{
    const type=Array.isArray(x['@type'])?x['@type'].join(' '):String(x['@type']||'');
    return /Reservation/i.test(type) && (x.startDate||x.checkinTime||x.checkinDate||x.reservationFor?.departureTime);
  });
  if (!(confirmed || (positive && structured))) return {skip:'not-confirmed'};

  let start='', end='', needsClarification=false;
  if (structured) {
    const raw=structured.startDate||structured.checkinTime||structured.checkinDate||structured.reservationFor?.departureTime;
    if (/^\d{4}-\d\d-\d\d/.test(String(raw))) start=validIso(String(raw).slice(0,10));
    const rawEnd=structured.endDate||structured.checkoutTime||structured.checkoutDate||structured.reservationFor?.arrivalTime;
    if (/^\d{4}-\d\d-\d\d/.test(String(rawEnd))) end=validIso(String(rawEnd).slice(0,10));
  }
  const startMatch=labelledDate(text,dateLabels);
  const endMatch=labelledDate(text,endLabels);
  const conflictingStart=!!(start && startMatch?.date && start!==startMatch.date);
  if (conflictingStart) { start=''; end=''; needsClarification=true; }
  if (!start && startMatch?.date && !conflictingStart) start=startMatch.date;
  if (!end && endMatch?.date) end=endMatch.date;
  if (startMatch?.ambiguous || (!start && !structured)) needsClarification=true;
  if (endMatch?.ambiguous) needsClarification=true;
  if (!start) needsClarification=true;
  if (start && end && end < start) { end=''; needsClarification=true; }
  const openEndedLodging=!end && /\b(?:hotel|lodging|accommodation|stay|check[- ]?in)\b/i.test(text);
  if (start && openEndedLodging) needsClarification=true;
  if (start && !includePast) {
    const last=end||start;
    if (last < today && !endMatch?.ambiguous && !openEndedLodging) return {skip:'past'};
  }
  const title=clean(subject,300)||clean(structured?.name,300)||'Travel booking';
  const evidence=clean(`${subject} ${body} ${snippet}`,1200);
  return {booking:{type:'other',name:title,title,source:'google-gmail',externalId,tripId:tripId||'',start,end,date:start||'',dateStatus:needsClarification?'needs-clarification':'confirmed',confirmationDate,sender:clean(from,500),notes:clean(snippet||body,1200),sourceUrl,sourceEvidence:evidence}};
}

function validIso(value) {
  const m=value.match(/^(\d{4})-(\d\d)-(\d\d)$/);
  return m?dayIso(+m[1],+m[2],+m[3]):'';
}
