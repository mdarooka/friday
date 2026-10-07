import { randomUUID } from 'node:crypto';

const categories = new Set(['things-to-do', 'restaurants', 'cafes']);
const clean = (value, max, required = false, label = 'value') => {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw Object.assign(new Error(`Please enter a valid ${label}.`), { status: 422 });
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ').trim();
};
const coord = (value, min, max, label) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw Object.assign(new Error(`Please enter a valid ${label}.`), { status: 422 });
  return value;
};
const safeUrl = (value, label, { maps = false, optional = true } = {}) => {
  if (!value && optional) return '';
  if (typeof value !== 'string' || value.length > 2000) throw Object.assign(new Error(`Please enter a valid ${label}.`), { status: 422 });
  let url;
  try { url = new URL(value); } catch { throw Object.assign(new Error(`Please enter a valid ${label}.`), { status: 422 }); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || (maps && !['google.com', 'www.google.com', 'maps.google.com', 'maps.app.goo.gl', 'goo.gl'].includes(url.hostname.toLowerCase()))) throw Object.assign(new Error(`Please enter a valid ${label}.`), { status: 422 });
  return url.href;
};
const integer = (value, min, max, label, { optional = false } = {}) => {
  if (optional && (value === undefined || value === null || value === '')) return null;
  if (!Number.isSafeInteger(value) || value < min || value > max) throw Object.assign(new Error(`Please enter a valid ${label}.`), { status: 422 });
  return value;
};

export function validateVillaInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Object.assign(new Error('Invalid villa.'), { status: 422 });
  const latValue = input.lat ?? input.latitude, lngValue = input.lng ?? input.longitude;
  const lat = latValue === undefined || latValue === null || latValue === '' ? null : coord(latValue, -90, 90, 'latitude');
  const lng = lngValue === undefined || lngValue === null || lngValue === '' ? null : coord(lngValue, -180, 180, 'longitude');
  if ((lat === null) !== (lng === null)) throw Object.assign(new Error('Enter both latitude and longitude.'), { status: 422 });
  if (input.amenities !== undefined && (!Array.isArray(input.amenities) || input.amenities.length > 40)) throw Object.assign(new Error('Choose up to 40 amenities.'), { status: 422 });
  const amenities = [...new Set((input.amenities || []).map(v => clean(v, 80, true, 'amenity')))];
  if (input.nearby !== undefined && (!Array.isArray(input.nearby) || input.nearby.length > 40)) throw Object.assign(new Error('Add up to 40 nearby places.'), { status: 422 });
  const nearby = (input.nearby || []).map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw Object.assign(new Error('Invalid curated nearby place.'), { status: 422 });
    const itemLat = coord(item.lat, -90, 90, 'nearby latitude'), itemLng = coord(item.lng, -180, 180, 'nearby longitude');
    if (!categories.has(item.category)) throw Object.assign(new Error('Choose a supported nearby category.'), { status: 422 });
    const id = typeof item.id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(item.id) ? item.id : randomUUID();
    return { id, name: clean(item.name, 200, true, 'nearby place name'), description: clean(item.description, 1000), lat: itemLat, lng: itemLng, category: item.category, mapsUrl: safeUrl(item.mapsUrl || item.googleMapsUrl, 'maps link', { maps: true }) };
  });
  const googlePlaceId = clean(input.googlePlaceId, 160);
  if (googlePlaceId && !/^[A-Za-z0-9_-]{5,160}$/.test(googlePlaceId)) throw Object.assign(new Error('Please enter a valid Google Place ID.'), { status: 422 });
  const status = input.status === undefined ? 'draft' : input.status;
  if (!['draft', 'published'].includes(status)) throw Object.assign(new Error('Choose draft or published.'), { status: 422 });
  return {
    name: clean(input.name, 180, true, 'villa name'), description: clean(input.description, 6000), city: clean(input.city, 120, true, 'city'),
    address: clean(input.address, 500), lat, lng, googleMapsUrl: safeUrl(input.googleMapsUrl || input.mapsUrl, 'Google Maps link', { maps: true }), googlePlaceId,
    bedrooms: integer(input.bedrooms ?? input.rooms, 0, 100, 'bedroom count', { optional: true }),
    maxGuests: integer(input.maxGuests ?? input.guestCapacity, 1, 500, 'guest count', { optional: true }), amenities, nearby, status,
  };
}

export function validateVillaSubmission(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Object.assign(new Error('Invalid submission.'), { status: 422 });
  const latInput = input.lat ?? input.latitude, lngInput = input.lng ?? input.longitude;
  const lat = latInput === undefined || latInput === null || latInput === '' ? null : coord(latInput, -90, 90, 'latitude');
  const lng = lngInput === undefined || lngInput === null || lngInput === '' ? null : coord(lngInput, -180, 180, 'longitude');
  if ((lat === null) !== (lng === null)) throw Object.assign(new Error('Enter both latitude and longitude.'), { status: 422 });
  if (input.consent !== true) throw Object.assign(new Error('Please agree to be contacted about your property.'), { status: 422 });
  const submittedEmail = clean(input.email, 254, true, 'email').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submittedEmail)) throw Object.assign(new Error('Please enter a valid email.'), { status: 422 });
  const phone = clean(input.phone, 40);
  if (phone && (phone.length < 7 || !/^[+()0-9 .-]+$/.test(phone))) throw Object.assign(new Error('Please enter a valid phone number.'), { status: 422 });
  const optionalWeb = input.websiteUrl ?? input.website;
  return {
    contactName: clean(input.contactName ?? input.name, 120, true, 'contact name'), email: submittedEmail, phone,
    villaName: clean(input.villaName ?? input.propertyName, 180, true, 'villa name'), city: clean(input.city, 120, true, 'city'),
    address: clean(input.address, 500), mapsUrl: safeUrl(input.mapsUrl || input.googleMapsUrl, 'Google Maps link', { maps: true }), lat, lng,
    bedrooms: integer(input.bedrooms ?? input.rooms, 0, 100, 'bedroom count', { optional: true }),
    maxGuests: integer(input.maxGuests ?? input.guestCapacity, 1, 500, 'guest count', { optional: true }),
    description: clean(input.description ?? input.story, 6000), website: safeUrl(optionalWeb, 'website'), photosUrl: safeUrl(input.photosUrl, 'photos link'), consent: true,
  };
}

export function publicVilla(row) {
  const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  const publicData = Object.fromEntries(['name','description','city','address','lat','lng','googleMapsUrl','googlePlaceId','bedrooms','maxGuests','amenities','nearby'].map(key => [key, data[key] ?? (['amenities','nearby'].includes(key) ? [] : null)]));
  return { id: row.id, ...publicData, createdAt: row.created, updatedAt: row.updated };
}
export function adminVilla(row) {
  return { ...publicVilla(row), ownerId: row.ownerId, status: row.status };
}
export function privateSubmission(row) {
  const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  return { id: row.id, ...data, status: row.status, createdAt: row.created, updatedAt: row.updated };
}

export function distanceMeters(aLat, aLng, bLat, bLng) {
  const rad = n => n * Math.PI / 180, dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function localVillaPlan(villa, candidates, { days, interests, pace }) {
  const ordered = [...candidates].sort((a, b) => {
    const ai = interests.indexOf(a.category), bi = interests.indexOf(b.category);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
  const limit = pace === 'relaxed' ? 1 : pace === 'active' ? 3 : 2;
  let cursor = 0;
  return { provider: 'local', villaId: villa.id, pace, days: Array.from({ length: days }, (_, index) => {
    const stops = ordered.slice(cursor, cursor + limit); cursor += stops.length;
    return { day: index + 1, focus: stops[0]?.category || 'Time at the villa', stops };
  }) };
}
