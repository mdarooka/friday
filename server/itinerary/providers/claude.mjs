/*
 * The Claude itinerary provider. The model is given only the catalog's place ids, names, kinds and areas, and
 * asked to choose and order places and write short notes. Output comes back through a tool call whose
 * input_schema is SCHEMA (or FREEFORM_SCHEMA for a place outside the catalog), and everything it returns is
 * validated: unknown catalog ids are dropped, and a response that cannot make a whole plan is an error
 * (the caller then falls back to the local provider for catalog destinations).
 */
import { generator, TRIP_TYPES } from '../catalog.mjs';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const TOOL_NAME = 'submit_itinerary';

export const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['days'],
  properties: {
    days: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['area', 'stops'],
        properties: {
          area: { type: 'string', description: 'The area id this day is based in' },
          stops: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['place', 'note'],
              properties: {
                place: { type: 'string', description: 'A place id from the catalog' },
                note: { type: 'string', description: 'One or two short sentences of practical advice' }
              }
            }
          }
        }
      }
    }
  }
};

/* Framing for the house knowledge. Kept separate from the JSON schema contract. */
export const KNOWLEDGE_PREAMBLE = [
  'The notes below are the travel company\'s house planning guidance.',
  'You are producing a day-by-day plan for a website visitor, using the given catalog only.',
  'You do not price, quote, book, hold inventory or contact suppliers, so ignore any guidance about quotes, margins, suppliers, portals, email, calls or documents, and never state prices.',
  'Do apply the planning principles: group each day geographically; keep arrival and departure days light; leave room for meals and rest; name the actual places rather than writing "city tour"; give weather alternatives in the notes where relevant; and mark anything that needs a ticket or a booking as to be confirmed.',
  'Apply dietary and cultural guidance only when the traveler has stated it; never infer a diet or a religion.',
  'Sample lessons are historical evidence, not templates and not current facts.'
].join(' ');

/* ---- a destination outside the catalog ----
   Friday plans anywhere. When the destination is not one of the catalog's, the model names real places itself; we keep
   its plan only if it is whole, and build a small catalog from it so the planner can show the places. */
const KINDS = ['sight', 'food', 'nature', 'market', 'beach', 'nightlife', 'museum', 'church', 'neighborhood', 'wellness'];
export const FREEFORM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['days'],
  properties: {
    days: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['town', 'stops'],
        properties: {
          town: { type: 'string', description: 'The town or area this day is based in' },
          stops: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'kind', 'note'],
              properties: {
                name: { type: 'string', description: 'The real, well-known name of a place, restaurant area, trail or sight' },
                kind: { type: 'string', enum: KINDS },
                note: { type: 'string', description: 'One or two short sentences of practical advice' }
              }
            }
          }
        }
      }
    }
  }
};

const slug = (text) => String(text).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'place';

export function buildFreeformPrompt(dest, request, knowledge) {
  const stops = (TRIP_TYPES.pace[request.pace] || TRIP_TYPES.pace[TRIP_TYPES.pace.default]).stops;
  const base = [
    'You design day-by-day travel itineraries for any destination in the world.',
    'Name only real, well-known places that you are confident exist, using the name a traveller would see on a map. If you are unsure whether a place exists or is open, leave it out rather than guessing.',
    'Each day is based in one town or area; keep a day\'s stops close together and order them as the day would naturally go.',
    'Do not repeat a place. Never state prices, opening hours or availability, and mark anything that needs a ticket or a booking as to be confirmed.',
    'Write each note as one or two short, practical sentences. Submit the plan by calling the ' + TOOL_NAME + ' tool.'
  ].join(' ');
  const system = knowledge && knowledge.text ? [base, KNOWLEDGE_PREAMBLE.replace(', using the given catalog only', ''), knowledge.text].join('\n\n') : base;
  const user = JSON.stringify({ destination: dest.name, tripTypes: request.types, days: request.days, stopsPerDay: stops, pace: request.pace });
  return { system, user, stops };
}

/** Model output -> { drafts, catalog }: a plan of days over places named by the model, and the catalog that describes them. */
export function validateFreeform(dest, parsed, request, maxStops) {
  if (!parsed || !Array.isArray(parsed.days)) throw new Error('response has no days');
  const places = {}, areas = [], seen = new Set(), drafts = [];
  for (const day of parsed.days) {
    if (!day || !Array.isArray(day.stops)) continue;
    const town = typeof day.town === 'string' && day.town.trim() ? day.town.trim().slice(0, 80) : dest.name;
    let area = areas.find((a) => a.town.toLowerCase() === town.toLowerCase());
    const items = [];
    for (const s of day.stops) {
      const name = s && typeof s.name === 'string' ? s.name.replace(/\s+/g, ' ').trim().slice(0, 100) : '';
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      const id = 'ff-' + slug(name) + (places['ff-' + slug(name)] ? '-' + (items.length + seen.size) : '');
      const note = typeof s.note === 'string' ? s.note.trim().slice(0, 280) : '';
      if (!area) { area = { id: 'area-' + (areas.length + 1), name: town, town }; areas.push(area); }
      const kind = KINDS.includes(s.kind) ? s.kind : 'sight';
      places[id] = { id, name, kind, label: 'Place', area: area.id, at: null, address: '', blurb: note, photos: [] };
      items.push({ place: id, note });
      if (items.length >= maxStops + 2) break;
    }
    if (items.length) drafts.push({ area: area.id, items });
  }
  if (drafts.length < request.days) throw new Error('response had ' + drafts.length + ' usable days of ' + request.days);
  const catalog = { id: 'ff-' + slug(dest.name), name: dest.name, tripTitle: dest.name + ' trip', threadTitle: 'Plan ' + dest.name + ' trip', currency: '', region: '', match: [], freeform: true, areas, places, map: {} };
  return { drafts: drafts.slice(0, request.days), catalog };
}

export function buildPrompt(dest, request, knowledge) {
  if (dest.freeform) return buildFreeformPrompt(dest, request, knowledge);
  const stops = (TRIP_TYPES.pace[request.pace] || TRIP_TYPES.pace[TRIP_TYPES.pace.default]).stops;
  const catalog = {
    areas: (dest.areas || []).map((a) => ({ id: a.id, name: a.name })),
    places: Object.keys(dest.places).filter((id) => dest.places[id].kind !== 'stay').map((id) => {
      const p = dest.places[id];
      return { id, name: p.name, kind: p.kind, area: p.area };
    })
  };
  const base = [
    'You design day-by-day travel itineraries.',
    'Choose places ONLY from the catalog you are given and refer to them by their exact "id". Never invent a place.',
    'Each day is based in one area: use places from that area, moving to a nearby area only if it has run out.',
    'Do not repeat a place until every place has been used. Order each day\'s stops as the day would naturally go: sights, markets and nature in the morning, food at midday and in the evening, nightlife last.',
    'Write each note as one or two short, practical sentences. Submit the plan by calling the ' + TOOL_NAME + ' tool.'
  ].join(' ');
  const system = knowledge && knowledge.text ? [base, KNOWLEDGE_PREAMBLE, knowledge.text].join('\n\n') : base;
  const user = JSON.stringify({
    destination: dest.name,
    tripTypes: request.types,
    days: request.days,
    stopsPerDay: stops,
    pace: request.pace,
    catalog
  });
  return { system, user, stops };
}

/** Model output -> draft days, keeping only catalog places. Throws when no whole plan can be made. */
export function validateDrafts(dest, parsed, request, maxStops) {
  if (!parsed || !Array.isArray(parsed.days)) throw new Error('response has no days');
  const seen = new Set();
  const drafts = [];
  for (const day of parsed.days) {
    if (!day || !Array.isArray(day.stops)) continue;
    const items = [];
    for (const s of day.stops) {
      const id = s && typeof s.place === 'string' ? s.place : '';
      const p = Object.prototype.hasOwnProperty.call(dest.places, id) ? dest.places[id] : null;
      if (!p || p.kind === 'stay' || seen.has(id)) continue;   // unknown, a hotel, or already used
      seen.add(id);
      let note = typeof s.note === 'string' ? s.note.trim().slice(0, 280) : '';
      if (!note) note = p.blurb || '';
      items.push({ place: id, note });
      if (items.length >= maxStops + 2) break;
    }
    if (!items.length) continue;
    const areaOk = typeof day.area === 'string' && (dest.areas || []).some((a) => a.id === day.area);
    drafts.push({ area: areaOk ? day.area : dest.places[items[0].place].area, items });
  }
  if (drafts.length < request.days) throw new Error('response had ' + drafts.length + ' usable days of ' + request.days);
  return drafts.slice(0, request.days);
}

export function createClaudeProvider({ apiKey, model, timeoutMs = 30000, fetch: fetchImpl = globalThis.fetch, knowledge = null }) {
  return {
    name: 'claude',
    async generate(dest, request) {
      if (!apiKey) throw new Error('Claude credentials are not configured');
      if (typeof fetchImpl !== 'function') throw new Error('fetch is not available');
      const { system, user, stops } = buildPrompt(dest, request, knowledge);
      const schema = dest.freeform ? FREEFORM_SCHEMA : SCHEMA;
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), timeoutMs);
      let res;
      try {
        res = await fetchImpl(ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model,
            max_tokens: 8000,
            system,
            messages: [{ role: 'user', content: user }],
            tools: [{ name: TOOL_NAME, description: 'Submit the finished day-by-day itinerary.', input_schema: schema, strict: true }],
            // Claude Sonnet 5.5 rejects forced tool_choice, so the system prompt asks for the tool and a JSON text reply is also accepted.
            tool_choice: { type: 'auto' }
          }),
          signal: ctl.signal
        });
        if (!res.ok) {
          let detail = '';
          try { detail = String(await res.text()).slice(0, 200); } catch (e) { /* ignore */ }
          throw new Error('Claude returned HTTP ' + res.status + (detail ? ': ' + detail : ''));
        }
        const json = await res.json();
        if (json && json.stop_reason === 'refusal') throw new Error('the model declined the request');
        if (json && json.stop_reason === 'max_tokens') throw new Error('response was cut off');
        const blocks = (json && Array.isArray(json.content)) ? json.content : [];
        const tool = blocks.find((b) => b && b.type === 'tool_use' && b.name === TOOL_NAME);
        let parsed = tool && tool.input;
        if (!parsed) {
          const text = blocks.filter((b) => b && b.type === 'text').map((b) => b.text || '').join('\n');
          if (!text.trim()) throw new Error('response has no content');
          const raw = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
          try { parsed = JSON.parse(raw); } catch (e) { throw new Error('response is not valid JSON'); }
        }
        if (dest.freeform) {
          const { drafts, catalog } = validateFreeform(dest, parsed, request, stops);
          return { ...generator.assemble(catalog, drafts, { dates: request.dates, stay: false }), catalog };
        }
        const drafts = validateDrafts(dest, parsed, request, stops);
        return generator.assemble(dest, drafts, { dates: request.dates, base: request.base });
      } catch (err) {
        if (err && err.name === 'AbortError') throw new Error('Claude request timed out after ' + timeoutMs + ' ms');
        throw err;
      } finally {
        clearTimeout(timer);
      }
    }
  };
}
