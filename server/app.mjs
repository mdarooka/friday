import { createReelChat } from './reel-chat.mjs';
import { createServer } from 'node:http';
import { randomBytes, randomUUID, createHash, createHmac, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as store from './store.mjs';
import { openStore, saveItinerary, getItinerary, ITINERARY_ID } from './store.mjs';
import { metros, findMetro } from './airports.mjs';
import { research, researchLink, checkFareAlert } from './ai.mjs';
import { createGoogleIntegration } from './google.mjs';
import { createGooglePlacesIntegration } from './places.mjs';
import { createItineraryService } from './itinerary/service.mjs';
import { parseItineraryRequest } from './itinerary/validate.mjs';
import { getDestination, listDestinations, catalogOf } from './itinerary/catalog.mjs';
import { chatgptConfig, publicChatgpt } from './itinerary/chatgpt.mjs';
import { SCHEMA as ITINERARY_SCHEMA } from './itinerary/providers/openai.mjs';
import { loadKnowledgeFromEnv } from './knowledge/index.mjs';
import { resolveTripStorage, createTripStore, VaultError } from './storage/index.mjs';
import { validateVillaInput, validateVillaSubmission, publicVilla, adminVilla, privateSubmission, distanceMeters, localVillaPlan } from './villas.mjs';
import { createFridayWorkflow } from './friday-workflow.mjs';
import { createReelWorkflow } from './reel-workflow.mjs';
import { createHexclaveAuth } from './hexclave/auth.mjs';
import { createHexclaveEmailService } from './hexclave/email.mjs';
import { briefingEmail, prepareBriefing } from './briefing.mjs';
import { ensureRobotsMeta, hostPolicy, isPrivateSurface, rewritePublicHtml, rewriteRobotsSitemap, rewriteSitemapOrigins, hiddenRobotsTxt, ROBOTS_NOINDEX, visitorHost } from './canonical-host.mjs';
const scrypt = promisify(scryptCallback);
const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = x => createHash('sha256').update(x).digest('hex');
const fail = (status,message) => { throw Object.assign(new Error(message), { status }); };
const str = (v,name,max=1000,required=false) => {
  if (v === undefined && !required) return '';
  if (typeof v !== 'string' || v.length > max || (required && !v.trim())) fail(422,`Please enter a valid ${name}.`);
  return name === 'password' ? v : v.trim();
};
const email = v => { const e = str(v,'email',254,true).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) fail(422,'Please enter a valid email.'); return e; };
const indianPhone = value => { const digits = typeof value === 'string' ? value.replace(/[\s()-]/g, '') : ''; const match = /^(?:\+?91)?([6-9]\d{9})$/.exec(digits); if (!match) fail(422,'Enter a valid 10-digit Indian mobile number, with or without +91.'); return '+91' + match[1]; };
const kinds = new Set(['trips','places','lists','bookings','memories','alerts','imports']);
const supportedAirports = new Set(metros.flatMap(metro=>metro.airports));
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(+new Date(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0,10) === value;
function fareFields(data) {
  const origin=typeof data.origin==='string'?data.origin.trim().toUpperCase():'';
  const destination=typeof data.destination==='string'?data.destination.trim():'';
  const isKnownAirport=value=>/^[A-Z]{3}$/.test(value)&&supportedAirports.has(value);
  if (!isKnownAirport(origin) || !destination || destination.length>120 || /[\u0000-\u001f\u007f]/.test(destination) || (/^[A-Za-z]{3}$/.test(destination)&&!isKnownAirport(destination)) || !validDate(data.departDate || data.startDate)) fail(422,'Choose a supported departure airport, destination, and valid departure date.');
  const depart = data.departDate || data.startDate, back = data.returnDate || data.endDate || '';
  if (back && (!validDate(back) || back < depart)) fail(422,'Choose a valid return date after departure.');
  if (!/^[A-Z]{3}$/i.test(data.currency||'')) fail(422,'Enter a three-letter currency code.');
  if (data.targetPrice !== undefined && data.targetPrice !== null && (!Number.isFinite(data.targetPrice) || data.targetPrice < 0 || data.targetPrice > 1000000000)) fail(422,'Enter a valid target price.');
}
function validate(kind,data) {
  if (!data || Array.isArray(data) || typeof data !== 'object') fail(422,'Invalid record.');
  if (Buffer.byteLength(JSON.stringify(data)) > 1200000) fail(413,'This record is too large.');
  str(data.title,'title',200,true);
  for (const field of ['url','sourceUrl']) if (data[field]) {
    try { if (!['https:','http:'].includes(new URL(data[field]).protocol)) fail(422,'Use an http or https link.'); } catch { fail(422,'Use a valid link.'); }
  }
  if (kind === 'trips') {
    for (const key of ['startDate','endDate']) if (data[key] && !validDate(data[key])) fail(422,'Use valid travel dates.');
    if (data.startDate && data.endDate && data.endDate < data.startDate) fail(422,'Your return date must follow your departure.');
    if (data.days !== undefined && (!Array.isArray(data.days) || data.days.length > 180 || data.days.some(d=>!d||typeof d!=='object'||Array.isArray(d)||typeof d.title!=='string'||(d.date!==undefined&&d.date!==''&&!validDate(d.date))||(d.items!==undefined&&(!Array.isArray(d.items)||d.items.length>100||d.items.some(i=>!i||typeof i!=='object'||Array.isArray(i)||typeof i.title!=='string')))))) fail(422,'Invalid itinerary.');
    if (data.messages !== undefined && (!Array.isArray(data.messages) || data.messages.length > 500 || data.messages.some(m=>!m||typeof m!=='object'||!['user','assistant'].includes(m.role)||typeof m.text!=='string'))) fail(422,'Invalid conversation.');
    if (data.history !== undefined && (!Array.isArray(data.history) || data.history.length > 50 || data.history.some(entry=>!entry||typeof entry!=='object'||Array.isArray(entry)||!Array.isArray(entry.days)||entry.days.length>180))) fail(422,'Invalid itinerary history.');
    if (data.archived !== undefined && typeof data.archived !== 'boolean') fail(422,'Invalid archive status.');
  }
  if (kind === 'alerts' && (data.kind === 'fare-watch' || data.kind === 'fare-alert')) fareFields(data);
  return data;
}
// Saved records keep whatever photo link they were stored with. Signed Google photo links expire after 15 minutes, so every
// /api/place-photo/ link is re-signed as a record is read (and share links are rewritten to a share-scoped route).
const PHOTO_PATH = /^\/api\/place-photo\/([A-Za-z0-9_-]{6,150})\/([A-Za-z0-9_-]{8,180})(?:\?.*)?$/;
const photoMatch = v => typeof v === 'string' && v.length < 600 ? PHOTO_PATH.exec(v) : null;
function mapPhotoLinks(value, fn, depth = 0) {
  if (depth > 16 || !value || typeof value !== 'object') return value;
  for (const k of Object.keys(value)) {
    const v = value[k], m = photoMatch(v);
    if (m) { const next = fn(m[1], m[2]); if (next) value[k] = next; }
    else if (v && typeof v === 'object') mapPhotoLinks(v, fn, depth + 1);
  }
  return value;
}
function hasPhotoLink(value, id, ref, depth = 0) {
  if (depth > 16 || !value || typeof value !== 'object') return false;
  return Object.values(value).some(v => { const m = photoMatch(v); return m ? m[1] === id && m[2] === ref : hasPhotoLink(v, id, ref, depth + 1); });
}
export function createApp(options = {}) {
  const root = options.root || defaultRoot;
  const env = options.env || process.env;
  const production = env.NODE_ENV === 'production';
  const searchIndexingEnabled = String(env.SEARCH_INDEXING || '').trim().toLowerCase() === 'on';
  const configuredOrigin = options.origin || env.APP_ORIGIN || (env.PUBLIC_SITE_ORIGIN ? String(env.PUBLIC_SITE_ORIGIN).replace(/\/$/, '') : undefined);
  if (production && !configuredOrigin) throw new Error('APP_ORIGIN must be set to the exact public origin (for example https://friday.example) when NODE_ENV=production.');
  const origin = configuredOrigin || 'http://localhost:4871';
  // APP_ORIGIN is the one public origin. APP_ORIGIN_ALIASES lists internal origins that may
  // write, such as the direct Hexclave Deploy URL. Never trust Host, X-Forwarded-Host, or a
  // preview URL for writes. Redirects use the visitor host only to decide whether to send
  // the browser to APP_ORIGIN; the Location is never taken from the request.
  const trustedWriteOrigins = new Set([origin, ...String(env.APP_ORIGIN_ALIASES || '').split(',').map(value => value.trim()).filter(Boolean)]);
  for (const value of trustedWriteOrigins) {
    let parsed;
    try { parsed = new URL(value); } catch { throw new Error(`Invalid trusted application origin: ${value}`); }
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.origin !== value) throw new Error(`Trusted application origins must be bare origins: ${value}`);
  }
  const canonicalUrl = new URL(origin);
  const internalHosts = new Set([...trustedWriteOrigins].map(value => new URL(value).host.toLowerCase()).filter(host => host !== canonicalUrl.host.toLowerCase()));
  const secure = canonicalUrl.protocol === 'https:';
  const loopback = value => ['localhost','127.0.0.1','::1','[::1]'].includes(String(value||'').toLowerCase());
  const hexclaveAuth = options.hexclaveAuth || (env.AUTH_PROVIDER==='local'&&!production
    ? { configured:false, projectId:null, currentUser:async()=>null }
    : createHexclaveAuth({ env, serverApp: options.hexclaveServerApp }));
  const hexclaveSelected = hexclaveAuth.configured || env.AUTH_PROVIDER === 'hexclave';
  // Hexclave is the production account provider. The isolated local identity is only for loopback development
  // and test fixtures when no Hexclave project is configured.
  const localAuthBypass = !hexclaveSelected && !production && env.AUTH_REQUIRED === 'false' && loopback(new URL(origin).hostname) && loopback(env.HOST || '127.0.0.1');
  const trustProxy = options.trustProxy ?? env.TRUST_PROXY === '1';
  // Itinerary generation (local | openai, ITINERARY_PROVIDER) is separate from the AI_PROVIDER research below.
  const itineraryEnv = env;
  const log = options.log || (() => {});
  const knowledge = options.knowledge || loadKnowledgeFromEnv(itineraryEnv);
  log(knowledge.sources.length ? `knowledge: ${knowledge.sources.length} files, ${knowledge.chars} chars` : 'knowledge: none');
  const chatgpt = chatgptConfig(env, origin);
  const itineraries = createItineraryService({ env: itineraryEnv, fetch: options.itineraryFetch, log, knowledge });
  // Planner trips may live in Hexclave's Data Vault (TRIP_STORAGE=hexclave); a missing key fails here, before anything opens.
  const tripConfig = resolveTripStorage(env);
  // Keep the no-login development identity and its admin inbox isolated from the normal account database.
  /* PostgreSQL (DATABASE_URL, or DATABASE_HOST/PORT/USER/PASSWORD/NAME), or PGlite under .data/ when none is set and not in
     production. Production without Postgres settings throws here. `options.memory` (tests) uses in-memory PGlite. */
  const db = openStore({ env, memory: !!options.memory, dataDir: options.dataDir || (localAuthBypass ? path.join(root,'.data/friday-local-dev-pglite') : path.join(root,'.data/pglite')), tripsInVault: tripConfig.mode === 'hexclave', connect: options.dbConnect, retry: options.dbRetry, sleep: options.dbSleep });
  const emailService = options.emailService || createHexclaveEmailService({ db, store, env, fetch: options.emailFetch || options.fetch });
  let localDevUser = null;
  const config = options.ai || {provider:'openai',apiKey:env.OPENAI_API_KEY,model:env.OPENAI_RESEARCH_MODEL||env.OPENAI_MODEL||'gpt-5-mini',deepModel:env.OPENAI_DEEP_MODEL,fetch:options.fetch};
  /* Startup work that needs the database. Requests wait for it (see `startup` in the request handler). */
  const startup = (async () => {
    await store.markInterruptedEmailSendsUnknown(db);
    if (localAuthBypass) {
      const localEmail = 'local-development@friday.invalid';
      localDevUser = await store.findUserByEmail(db, localEmail);
      if (!localDevUser) {
        await store.createUser(db, { id: 'friday-local-development-owner', email: localEmail, name: 'Local development', password: `disabled:${randomBytes(32).toString('hex')}` });
        localDevUser = await store.findUserByEmail(db, localEmail);
      }
    }
    await store.failInterruptedJobs(db);
  })();
  startup.catch(error => { if (!/database is closed/.test(error.message)) console.error(`[friday] database startup failed: ${error.message}`); });
  let trips;
  try { trips = createTripStore({ db, config: tripConfig, fetch: options.vaultFetch, vault: options.vault }); }
  catch (error) { db.close().catch(() => {}); throw error; }   // a bad vault setting must not leave the database open
  log(`trip storage: ${trips.mode}`);
  const researchFn=options.research||research;
  const researchLinkFn=options.researchLink||researchLink;
  const friday=createFridayWorkflow({db,store,env,fetch:options.fetch,tripFind:async(id,uid)=>trips.find(id,uid),aiConfig:config,email:emailService});
  const reels=createReelWorkflow({db,store,researchLink:researchLinkFn,research:options.reelResearch||researchFn,aiConfig:config,log});
  const reelChat=createReelChat({db,reels,friday,email:emailService,env,config,interpret:options.reelInterpret});
  const parseAdminEmails = value => String(value||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
  const generalAdminEmails = parseAdminEmails(env.ADMIN_EMAILS);
  const villaAdminEmails = parseAdminEmails(env.VILLA_ADMIN_EMAILS);
  const quoteAdminEmails = parseAdminEmails(env.QUOTE_ADMIN_EMAILS);
  const aiReviewAdminEmails = parseAdminEmails(env.AI_REVIEW_ADMIN_EMAILS);
  const allConfiguredAdminEmails = new Set([
    ...generalAdminEmails,
    ...villaAdminEmails,
    ...quoteAdminEmails,
    ...aiReviewAdminEmails
  ]);
  const hasConfiguredRestrictions = allConfiguredAdminEmails.size > 0;
  const villaResearchFn=options.villaResearch||researchFn;
  const google=options.google||createGoogleIntegration({db,origin,findTripId:(userId,tripId)=>trips.findId(tripId,userId),clientId:env.GOOGLE_CLIENT_ID,clientSecret:env.GOOGLE_CLIENT_SECRET,encryptionKey:env.GOOGLE_TOKEN_KEY,fetch:options.fetch});
  const places=options.places||createGooglePlacesIntegration({apiKey:env.GOOGLE_PLACES_API_KEY,fetch:options.fetch});
  const googleOAuthConfigured=options.google?true:!!(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET&&/^[a-f0-9]{64}$/i.test(env.GOOGLE_TOKEN_KEY||''));
  const placesConfigured=options.places?true:!!env.GOOGLE_PLACES_API_KEY;
  const fareAlertFn=options.checkFareAlert||checkFareAlert;
  const limits = new Map();
  const inFlight = new Set();
  const backgroundTasks = new Set();
  const rate = (key,max) => {
    const now = Date.now(); let entry = limits.get(key);
    if (!entry || now > entry.until) { entry = {n:0,until:now+60000}; limits.set(key,entry); }
    if (++entry.n > max) fail(429,'Please wait a minute before trying again.');
    if (limits.size > 10000) for (const [k,v] of limits) if (v.until < now) limits.delete(k);
  };
  // Behind a reverse proxy set TRUST_PROXY=1 so limits key on the right-most X-Forwarded-For hop (the one the proxy
  // appended) instead of the proxy's own address. Never enable it when the app is reachable without that proxy.
  const clientIp = req => {
    if (trustProxy) { const hops = String(req.headers['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean); if (hops.length) return hops[hops.length - 1]; }
    return req.socket.remoteAddress || 'unknown';
  };
  const logError = (label, e) => console.error(`[friday] ${label}: ${String(e?.message || e).slice(0, 500)}`);
  const publicUser = u => ({id:u.id,email:u.hexclave_email||u.email,name:u.hexclave_name||u.name,emailVerified:u.hexclave_email_verified===undefined?true:Boolean(u.hexclave_email_verified),profile:JSON.parse(u.profile)});
  const externalIdentity = async principal => {
    if (!principal || principal.restricted || !principal.emailVerified) return null;
    let mapped = await store.findUserByHexclaveId(db, principal.id);
    if (mapped) {
      if (mapped.hexclave_email !== principal.email || mapped.hexclave_name !== principal.name || !mapped.hexclave_email_verified || mapped.hexclave_restricted) {
        await store.updateHexclaveIdentity(db,{hexclaveUserId:principal.id,email:principal.email,name:principal.name,emailVerified:principal.emailVerified,restricted:principal.restricted,updated:new Date().toISOString()});
        mapped = await store.findUserByHexclaveId(db, principal.id);
      }
      return { user:{...mapped,email:mapped.hexclave_email,name:mapped.hexclave_name}, legacyAccountAvailable:false };
    }
    const legacy = principal.email ? await store.findUnlinkedLegacyUserByEmail(db, principal.email) : null;
    if (legacy) return { user:null, legacyAccountAvailable:true };
    try {
      const syntheticEmail = `hexclave-${hash(principal.id).slice(0,40)}@identity.friday.invalid`;
      mapped = await store.createHexclaveIdentity(db,{
        hexclaveUserId:principal.id,userId:randomUUID(),syntheticEmail,email:principal.email,
        name:principal.name,password:`hexclave:${randomBytes(32).toString('hex')}`,
        emailVerified:principal.emailVerified,restricted:principal.restricted,updated:new Date().toISOString()
      });
    } catch (error) {
      // A concurrent request may have created the owner mapping first.
      mapped = await store.findUserByHexclaveId(db, principal.id);
      if (!mapped) throw error;
    }
    return {user:{...mapped,email:mapped.hexclave_email,name:mapped.hexclave_name},legacyAccountAvailable:false};
  };
  const refreshPhotos = data => typeof places.signPhoto === 'function' ? mapPhotoLinks(data, places.signPhoto) : data;
  const parseRecord = r => ({id:r.id,kind:r.kind,data:refreshPhotos(JSON.parse(r.data)),version:r.version,updated:r.updated});
  const getRecord = async (id,uid,kind) => {
    const r = kind==='trips' ? await trips.find(id,uid) : await store.findRecord(db,id,uid,kind);
    if (!r) fail(404,'This item was not found.'); return r;
  };
  const newRecord = async (uid,kind,data) => {
    validate(kind,data); const id=randomUUID(), updated=new Date().toISOString();
    if (kind==='trips') await trips.insert({id,userId:uid,data:JSON.stringify(data),updated});
    else await store.insertRecord(db,{id,userId:uid,kind,data:JSON.stringify(data),updated});
    return parseRecord(await getRecord(id,uid,kind));
  };
  const cookie = (token, age) => `friday_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure?'; Secure':''}`;
  const session = async (user,res) => {
    const token=randomBytes(32).toString('hex');
    await store.deleteExpiredSessions(db,Date.now());
    await store.createSession(db,hash(token),user.id,Date.now()+7*86400000);
    res.setHeader('Set-Cookie',cookie(token,604800));
  };
  const server=createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options','DENY');
    if (!searchIndexingEnabled) res.setHeader('X-Robots-Tag', ROBOTS_NOINDEX);
    const ip=clientIp(req);
    const send=(status,data,extra)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra});res.end(JSON.stringify(data));};
    try {
      const url = new URL(req.url,origin), method=req.method;
      const decision = hostPolicy({
        publicHost: visitorHost({ hostHeader: req.headers.host, forwardedHost: req.headers['x-forwarded-host'], trustProxy, internalHosts }),
        canonicalOrigin: canonicalUrl.origin,
        internalHosts,
        pathname: url.pathname,
        search: url.search,
        production,
      });
      if (decision.robots) res.setHeader('X-Robots-Tag', decision.robots);
      else if (isPrivateSurface(url.pathname, url.search)) res.setHeader('X-Robots-Tag', ROBOTS_NOINDEX);
      if (decision.action === 'redirect') {
        res.writeHead(308, { Location: decision.location, 'Cache-Control': 'public, max-age=86400', 'X-Robots-Tag': decision.robots });
        res.end();
        return;
      }
      if (url.pathname === '/index.html' && ['GET','HEAD'].includes(method)) {
        res.writeHead(308, { Location: `/${url.search}`, 'Cache-Control': 'public, max-age=86400' });
        res.end();
        return;
      }
      if (!url.pathname.startsWith('/api/')) {
        if (!['GET','HEAD'].includes(method)) fail(405,'Method not allowed.');
        // Decode first, then refuse anything that could climb out of the root: dot segments (including ones hidden as %2e or
        // %2f), doubled or backslash separators and NUL. The containment check below is the backstop.
        let decoded;try{decoded=decodeURIComponent(url.pathname);}catch{fail(404,'Not found.');}
        if (/[\0\\]/.test(decoded) || decoded.includes('//') || decoded.split('/').some(s=>s==='..'||s==='.')) fail(404,'Not found.');
        let relative = decoded.replace(/^\//,'') || 'index.html';
        if (relative === 'app') relative='app.html';
        // Only public generated pages and assets may be served, never backend/source/data.
        if (!(/^[a-z0-9-]+\.html$/.test(relative) || /^(robots\.txt|sitemap\.xml)$/.test(relative) || /^assets\/[a-zA-Z0-9_./-]+\.(css|js|svg|png|jpg|jpeg|webp|ico|woff2)$/.test(relative))) fail(404,'Not found.');
        const realRoot = await realpath(root);
        const full = await realpath(path.resolve(realRoot,relative)).catch(()=>fail(404,'Not found.'));
        if (!full.startsWith(realRoot+path.sep) || !(await stat(full)).isFile()) fail(404,'Not found.');
        const types={'.html':'text/html','.txt':'text/plain','.xml':'application/xml','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff2':'font/woff2'};
        let content=await readFile(full);
        if (relative.endsWith('.html')) {
          let html = rewritePublicHtml(content.toString('utf8'), origin);
          if (!searchIndexingEnabled || isPrivateSurface('/' + relative, url.search)) html = ensureRobotsMeta(html);
          content = Buffer.from(html);
        }
        else if (relative === 'sitemap.xml') content = Buffer.from(rewriteSitemapOrigins(content.toString('utf8'), origin));
        else if (relative === 'robots.txt') content = Buffer.from(searchIndexingEnabled ? rewriteRobotsSitemap(content.toString('utf8'), origin) : hiddenRobotsTxt(origin));
        if (relative==='app.html') {
          const sharedToken=url.searchParams.get('share')||'';
          if (/^[a-f0-9]{64}$/.test(sharedToken)) {
            const tokenHash=hash(sharedToken),share=await trips.findShare(tokenHash);
            if(share&&share.expires>Date.now()) {
              const data=JSON.parse(share.data),title=typeof data.title==='string'?data.title.slice(0,200):'A journey';
              const days=Array.isArray(data.days)?data.days:[],stops=days.reduce((n,day)=>n+(Array.isArray(day.items)?day.items.length:0),0);
              const destination=typeof data.destination==='string'?data.destination.slice(0,120):'';
              const start=typeof data.startDate==='string'?data.startDate:'';const end=typeof data.endDate==='string'?data.endDate:'';
              const dateText=start?(end&&end!==start?`${start}–${end}`:start):'';
              const parts=[destination,dateText,stops?`${stops} ${stops===1?'stop':'stops'}`:''].filter(Boolean);
              const description=(parts.length?parts.join(' · ')+'. ':'')+'Shared with you on Friday.';
              const firstPhoto=days.flatMap(day=>(Array.isArray(day.items)?day.items:[])).flatMap(item=>Array.isArray(item.photos)?item.photos:[]).find(photo=>{
                if(!photo||typeof photo.url!=='string')return false;const match=photoMatch(photo.url);if(match)return true;try{return ['http:','https:'].includes(new URL(photo.url).protocol);}catch{return false;}
              });
              const photoRoute=firstPhoto&&photoMatch(firstPhoto.url);
              const imageUrl=firstPhoto?(photoRoute?new URL(`/api/shared/${sharedToken}/photo/${photoRoute[1]}/${photoRoute[2]}`,origin).href:new URL(firstPhoto.url).href):new URL('/assets/images/friday-coastal-banner.jpg',origin).href;
              const pageUrl=new URL(`/app.html?share=${sharedToken}`,origin).href;
              const attr=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
              const meta=`<meta property="og:title" content="${attr(title)}"><meta property="og:description" content="${attr(description)}"><meta property="og:type" content="website"><meta property="og:url" content="${attr(pageUrl)}"><meta property="og:image" content="${attr(imageUrl)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${attr(title)}"><meta name="twitter:description" content="${attr(description)}"><meta name="twitter:image" content="${attr(imageUrl)}">`;
              if(method==='GET'&&!req.headers['user-agent']?.match(/WhatsApp|facebookexternalhit|Facebot|Twitterbot|Slackbot|Discordbot|TelegramBot|LinkedInBot|Googlebot/i)) await store.recordTripShareEvent(db,{id:randomUUID(),tokenHash,eventType:'trip_share_link_opened',created:new Date().toISOString()});
              else if(method==='GET') await store.recordTripShareEvent(db,{id:randomUUID(),tokenHash,eventType:'trip_share_preview_bot',created:new Date().toISOString()});
              content=Buffer.from(ensureRobotsMeta(content.toString('utf8').replace('</head>',`${meta}</head>`)));
            }
          }
        }
        res.writeHead(200,{'Content-Type':types[path.extname(full)]+'; charset=utf-8'}); res.end(method==='HEAD'?undefined:content);return;
      }
      rate('api:'+ip,240);
      /* Liveness does not touch the database, so the container stays healthy while a scaled-to-zero database service wakes up. */
      if (url.pathname==='/api/health' && ['GET','HEAD'].includes(method)) return send(200,{ok:true,itineraryProvider:itineraries.name,knowledge:{sources:knowledge.sources,chars:knowledge.chars}});
      await startup;
      if (!['GET','HEAD'].includes(method)) {
        // Production accepts only explicitly configured origins. Elsewhere (127.0.0.1, a LAN address, a dev proxy) an Origin that matches the
        // Host the browser used is also fine.
        const from=req.headers.origin;
        const sameHost=()=>{try{const u=new URL(from);return ['http:','https:'].includes(u.protocol)&&u.host===req.headers.host;}catch{return false;}};
        if (!trustedWriteOrigins.has(from) && (production || !from || !sameHost())) fail(403,'Please submit from the Friday website.');
        if (!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')) fail(415,'Send JSON data.');
      }
      let body={};
      if (!['GET','HEAD'].includes(method)) {
        let bytes=0, chunks=[];
        const limit=url.pathname==='/api/itineraries'||url.pathname==='/api/itineraries/prompt'?65536:1500000;
        // Keep reading (and discarding) an oversized upload so the 413 reaches the client, but only up to a hard cap.
        let tooLarge=false;
        for await(const chunk of req) {bytes+=chunk.length;if(bytes>limit){tooLarge=true;chunks=[];if(bytes>limit+16000000)break;}else chunks.push(chunk);}
        if(tooLarge){res.setHeader('Connection','close');fail(413,'The submission is too large.');}
        try { body=JSON.parse(Buffer.concat(chunks).toString()||'{}'); } catch {fail(400,'Invalid JSON.');}
        if (!body || Array.isArray(body) || typeof body!=='object') fail(400,'Invalid request.');
      }
      const p=url.pathname;
      const allow=(...m)=>{if(!m.includes(method))fail(405,'Method not allowed.');};
      const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('friday_session='))?.slice(15)||'';
      const sessionUser=hexclaveSelected?null:await store.findUserBySession(db,hash(token),Date.now());
      const hasHexclaveToken=Boolean(req.headers.authorization||req.headers['x-stack-access-token']||req.headers['x-hexclave-access-token']);
      const hexPrincipal=hexclaveAuth.configured&&hasHexclaveToken?await hexclaveAuth.currentUser(req):null;
      const hexResolution=hexclaveAuth.configured?await externalIdentity(hexPrincipal):null;
      const user=hexclaveSelected?(hexResolution?.user||null):(sessionUser || (localAuthBypass ? localDevUser : null));
      const auditConversationId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,120}$/.test(value)?value:'request_'+randomUUID();
      const auditContent=value=>{const text=JSON.stringify(value===undefined?null:value);if(Buffer.byteLength(text)>1000000)fail(413,'This conversation entry is too large to record.');return text;};
      const startAiAudit=async(conversationId,eventType,content,tripId=null,expectedOwnerId=null)=>{
        if(expectedOwnerId&&!user)fail(401,'Please sign in to save this AI request.');
        if(!user)return null;
        if(expectedOwnerId&&expectedOwnerId!==user.id)fail(409,'Your account changed before this AI request could be recorded.');
        const now=new Date().toISOString(),eventKey='ai_'+randomUUID(),thread=auditConversationId(conversationId);
        await store.upsertAiConversationEvent(db,{eventKey,ownerId:user.id,conversationId:thread,tripId:typeof tripId==='string'?tripId.slice(0,100):null,eventType,role:null,content:auditContent(content),status:'started',created:now,updated:now});
        return {eventKey,conversationId:thread};
      };
      const finishAiAudit=async(audit,status,content)=>{
        if(!audit)return;
        await store.updateAiConversationEvent(db,{eventKey:audit.eventKey,ownerId:user.id,conversationId:audit.conversationId,content:auditContent(content),status,updated:new Date().toISOString()});
      };
      if (p==='/api/health') {allow('GET','HEAD');return send(200,{ok:true,itineraryProvider:itineraries.name,knowledge:{sources:knowledge.sources,chars:knowledge.chars}});}
      if (p==='/api/capabilities' && method==='GET') {const researchReady=!!(config.apiKey&&config.model&&(!(config.provider==='claude'&&config.searchProvider==='perplexity')||config.searchApiKey));return send(200,{authRequired:!localAuthBypass,localAuthBypass,authProvider:hexclaveSelected?'hexclave':'local',authConfigured:hexclaveAuth.configured,hexclaveProjectId:hexclaveAuth.projectId,auditOwnerId:user&&user.id||null,research:researchReady,gmail:googleOAuthConfigured,calendar:googleOAuthConfigured,googleOAuth:googleOAuthConfigured,places:placesConfigured,liveFares:false,socialExtraction:researchReady,airportMetroCount:metros.length,chatgpt:publicChatgpt(chatgpt)});}
      if (p==='/api/newsletter/unsubscribe') {
        allow('GET','HEAD','POST');
        const token=method==='POST'?(typeof body.token==='string'?body.token:''):url.searchParams.get('token')||'';
        const secret=env.NEWSLETTER_UNSUBSCRIBE_SECRET||env.HEXCLAVE_SECRET_SERVER_KEY||'';
        const invalid=()=>fail(400,'This unsubscribe link is invalid or expired.');
        const [encodedEmail,encodedConsentAt,signature,...extra]=token.split('.');
        if(!secret||!encodedEmail||!encodedConsentAt||!signature||extra.length)invalid();
        let address;
        try{address=Buffer.from(encodedEmail,'base64url').toString('utf8');}catch{invalid();}
        if(!address||Buffer.from(address).toString('base64url')!==encodedEmail||address!==address.toLowerCase()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))invalid();
        let consentAt;
        try{consentAt=Buffer.from(encodedConsentAt,'base64url').toString('utf8');}catch{invalid();}
        if(!consentAt||Buffer.from(consentAt).toString('base64url')!==encodedConsentAt||Number.isNaN(Date.parse(consentAt)))invalid();
        const expected=createHmac('sha256',secret).update(`${address}\n${consentAt}`).digest('base64url');
        const actualBytes=Buffer.from(signature,'base64url'),expectedBytes=Buffer.from(expected,'base64url');
        if(actualBytes.length!==expectedBytes.length||!timingSafeEqual(actualBytes,expectedBytes))invalid();
        const subscriber=await store.getNewsletterSubscriber(db,address);
        if(!subscriber||subscriber.consent_at!==consentAt||subscriber.status!=='subscribed')invalid();
        if(method==='GET'||method==='HEAD'){
          const escapedToken=token.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          const page=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Unsubscribe from Friday</title><body><main><h1>Unsubscribe from Friday emails?</h1><p>Confirm below to stop newsletter emails for ${address.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}.</p><button id="confirm" type="button">Unsubscribe</button><p id="status" role="status"></p></main><script>document.querySelector('#confirm').addEventListener('click',async()=>{const b=document.querySelector('#confirm'),s=document.querySelector('#status');b.disabled=true;try{const r=await fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:'${escapedToken}'})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Please try again.');s.textContent='You are unsubscribed.';b.hidden=true;}catch(e){s.textContent=e.message;b.disabled=false;}})</script></body></html>`;
          res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(method==='HEAD'?undefined:page);return;
        }
        await store.unsubscribeNewsletterSubscriber(db,address,new Date().toISOString());
        return send(200,{ok:true});
      }
      if (p==='/api/airports' && method==='GET') {
        const q=(url.searchParams.get('q')||'').toLowerCase().trim();
        return send(200,{metros:metros.filter(m=>[m.city,...m.aliases].some(s=>s.toLowerCase().includes(q))).slice(0,10)});
      }
      if (p==='/api/villas') {
        allow('GET','HEAD');
        const q=(url.searchParams.get('q')||'').trim().toLowerCase();
        const city=(url.searchParams.get('city')||'').trim().toLowerCase();
        if(q.length>120||city.length>120)fail(422,'Search text is too long.');
        const villas=(await store.listPublishedVillas(db)).map(publicVilla).filter(v=>(!q||`${v.name} ${v.description} ${v.city}`.toLowerCase().includes(q))&&(!city||v.city.toLowerCase()===city)).slice(0,100);
        return send(200,{villas});
      }
      const publicVillaMatch=p.match(/^\/api\/villas\/([0-9a-f-]{36})$/i);
      if(publicVillaMatch){
        allow('GET','HEAD');
        const row=await store.getPublishedVilla(db,publicVillaMatch[1]);if(!row)fail(404,'This villa was not found.');
        return send(200,{villa:publicVilla(row)});
      }
      const villaNearbyMatch=p.match(/^\/api\/villas\/([0-9a-f-]{36})\/nearby$/i);
      if(villaNearbyMatch){
        allow('GET','HEAD');rate('villa-nearby:'+ip,30);
        const row=await store.getPublishedVilla(db,villaNearbyMatch[1]);if(!row)fail(404,'This villa was not found.');
        const data=JSON.parse(row.data),rawRadius=url.searchParams.get('radius'),radius=rawRadius===null?5000:Number(rawRadius);
        const category=url.searchParams.get('category')||'things-to-do';
        if(!Number.isFinite(radius)||radius<100||radius>50000||!['things-to-do','restaurants','cafes'].includes(category))fail(422,'Choose a valid radius and nearby category.');
        if(data.lat===null||data.lng===null)return send(200,{provider:'curated',attribution:'Villa host',nearby:[]});
        if(placesConfigured&&typeof places.searchNearby==='function'){
          const result=await places.searchNearby({lat:data.lat,lng:data.lng,radius,category});
          if(result.status!==200)fail(result.status,result.data?.error||'Nearby places are temporarily unavailable.');
          const nearby=(result.data.places||[]).flatMap(place=>{
            const loc=place.location,lat=loc?.latitude,lng=loc?.longitude;
            if(!Number.isFinite(lat)||!Number.isFinite(lng)||distanceMeters(data.lat,data.lng,lat,lng)>radius)return [];
            return [{id:place.googlePlaceId||place.id,name:place.title,description:'',address:place.address||'',category,mapsUrl:place.sourceUrl||place.url||'',lat,lng,rating:place.rating,attribution:'Google Maps'}];
          });
          return send(200,{provider:'google',attribution:'Google Maps',nearby});
        }
        const nearby=(data.nearby||[]).filter(place=>place.category===category&&distanceMeters(data.lat,data.lng,place.lat,place.lng)<=radius).map(place=>({...place,attribution:'Villa host'}));
        return send(200,{provider:'curated',attribution:'Villa host',nearby});
      }
      const villaPlaceMatch=p.match(/^\/api\/villas\/([0-9a-f-]{36})\/places\/([A-Za-z0-9_-]{5,160})$/i);
      if(villaPlaceMatch){
        allow('GET','HEAD');rate('villa-place:'+ip,60);
        const row=await store.getPublishedVilla(db,villaPlaceMatch[1]);if(!row)fail(404,'This villa was not found.');
        if(!placesConfigured||typeof places.getDetails!=='function')fail(503,'Google Places is not configured yet.');
        const villa=JSON.parse(row.data);if(villa.lat===null||villa.lng===null)fail(404,'This place is outside the villa search area.');
        const result=await places.getDetails(villaPlaceMatch[2]);if(result.status!==200)fail(result.status,result.data?.error||'Place details are temporarily unavailable.');
        const place=result.data.place,lat=place.location?.latitude,lng=place.location?.longitude;
        if(!Number.isFinite(lat)||!Number.isFinite(lng)||distanceMeters(villa.lat,villa.lng,lat,lng)>50000)fail(404,'This place is outside the villa search area.');
        return send(200,{place:{id:place.googlePlaceId||place.id,title:place.title,name:place.title,address:place.address||'',description:'',mapsUrl:place.sourceUrl||place.url||'',lat,lng,attribution:'Google Maps'}});
      }
      const villaSubmissionPath=p==='/api/villa-submissions';
      if(villaSubmissionPath){
        allow('POST');rate('villa-submit:'+ip,5);
        if(typeof body.websiteTrap==='string'&&body.websiteTrap.trim())return send(201,{ok:true});
        const submission=validateVillaSubmission(body),id=randomUUID(),created=new Date().toISOString();
        await store.insertVillaSubmission(db,{id,data:JSON.stringify(submission),created,updated:created});
        return send(201,{ok:true});
      }
      const villaPlanMatch=p.match(/^\/api\/villas\/([0-9a-f-]{36})\/plan$/i);
      if(villaPlanMatch){
        allow('POST');rate('villa-plan:'+ip,8);
        const row=await store.getPublishedVilla(db,villaPlanMatch[1]);if(!row)fail(404,'This villa was not found.');
        const days=body.days;
        if(!Number.isSafeInteger(days)||days<1||days>7)fail(422,'Choose a plan from 1 to 7 days.');
        const pace=body.pace||'balanced';if(!['relaxed','balanced','active'].includes(pace))fail(422,'Choose a supported travel pace.');
        if(body.interests!==undefined&&(!Array.isArray(body.interests)||body.interests.length>10))fail(422,'Choose up to 10 interests.');
        const interests=[...new Set((body.interests||[]).map(v=>str(v,'interest',80,true)))];
        const requestedCategories=[...new Set(interests.filter(v=>['things-to-do','restaurants','cafes'].includes(v)))];
        const categories=requestedCategories.length?requestedCategories:['things-to-do','restaurants','cafes'];
        const data=JSON.parse(row.data),villa={...data,id:row.id};
        let candidates=[],candidateProvider='curated',fallbackReason='';
        if(data.lat!==null&&data.lng!==null&&placesConfigured&&typeof places.searchNearby==='function'){
          try{
            const responses=await Promise.all(categories.map(category=>places.searchNearby({lat:data.lat,lng:data.lng,radius:25000,category})));
            const result=responses.find(r=>r.status!==200);if(result)throw Object.assign(new Error(result.data?.error||'Nearby places are temporarily unavailable.'),{status:result.status});
            const byId=new Map();
            for(let index=0;index<responses.length;index++)for(const place of responses[index].data.places||[]){
              const loc=place.location,lat=loc?.latitude,lng=loc?.longitude,id=place.googlePlaceId||place.id;
              if(!id||!Number.isFinite(lat)||!Number.isFinite(lng)||distanceMeters(data.lat,data.lng,lat,lng)>25000)continue;
              byId.set(id,{id,name:place.title,description:'',address:place.address||'',category:categories[index],mapsUrl:place.sourceUrl||place.url||'',lat,lng,attribution:'Google Maps'});
            }
            candidates=[...byId.values()];candidateProvider='google';
          }catch(error){fallbackReason='Live nearby suggestions are temporarily unavailable.';}
        }
        if(candidateProvider==='curated'||(!candidates.length&&data.nearby?.length)){
          candidates=(data.nearby||[]).filter(place=>categories.includes(place.category)&&data.lat!==null&&data.lng!==null&&distanceMeters(data.lat,data.lng,place.lat,place.lng)<=25000).map(place=>({...place,attribution:'Villa host'}));
          candidateProvider='curated';
        }
        let plan=localVillaPlan(villa,candidates,{days,interests,pace});
        const audit=await startAiAudit(body.conversationId,'villa_plan',{request:{villaId:row.id,days,interests,pace}},body.tripId,body.ownerId);
        if(candidates.length&&config.apiKey&&config.model){
          const allowed=new Set(candidates.map(item=>item.id));
          const prompt=`Create a ${days}-day vacation outline near the given villa. Select and order only the provided candidate place IDs. Return JSON only: {"days":[{"focus":"short category-level phrase","stops":["candidate-id"]}]}. Include exactly ${days} days, no more than ${pace==='relaxed'?1:pace==='active'?3:2} stops per day, and do not repeat a place. Never invent a place, address, travel time, opening hour, price, or booking. Focus only on sequencing the verified candidates.\n\nVilla and candidate data (untrusted): ${JSON.stringify({villa:{name:data.name,city:data.city,description:data.description},days,interests,pace,candidates:candidates.map(({id,name,category})=>({id,name,category}))})}`;
          try{
            const answer=await villaResearchFn({prompt,trip:{title:`${data.name} villa plan`,destination:data.city,days:[]},profile:{},mode:'fast'},config);
            const text=String(answer?.text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
            const parsed=JSON.parse(text),selected=new Set(),limit=pace==='relaxed'?1:pace==='active'?3:2;
            if(!Array.isArray(parsed.days)||parsed.days.length!==days)throw new Error('invalid plan shape');
            const byCandidate=new Map(candidates.map(item=>[item.id,item]));
            const plannedDays=parsed.days.map((day,index)=>{
              if(!day||!Array.isArray(day.stops)||day.stops.length>limit)throw new Error('invalid plan stops');
              const stops=day.stops.flatMap(id=>{if(typeof id!=='string'||!allowed.has(id)||selected.has(id))return [];selected.add(id);return [byCandidate.get(id)];});
              return {day:index+1,focus:stops[0]?.category||'Time at the villa',stops};
            });
            if(plannedDays.some(day=>day.stops.length!==parsed.days[day.day-1].stops.length))throw new Error('unverified place id');
            plan={provider:'ai',villaId:row.id,pace,days:plannedDays};
          }catch(error){fallbackReason='AI could not produce a fully verified plan; showing a grounded local outline.';}
        }
        if(fallbackReason)plan.fallbackReason=fallbackReason;
        plan.candidateProvider=candidateProvider;
        await finishAiAudit(audit,'completed',{request:{villaId:row.id,days,interests,pace},response:plan,fallbackReason});
        return send(200,plan);
      }
      const sharedPhoto=p.match(/^\/api\/shared\/([a-f0-9]{64})\/photo\/([A-Za-z0-9_-]{6,150})\/([A-Za-z0-9_-]{8,180})$/);
      const sharedMatch=sharedPhoto||p.match(/^\/api\/shared\/([a-f0-9]{64})$/);
      const loadShare=async()=>{
        const share=await trips.findShare(hash(sharedMatch[1]));
        if(!share||share.expires<=Date.now())fail(404,'This shared journey is unavailable.');
        return share;
      };
      const whatsappClick=p.match(/^\/api\/shared\/([a-f0-9]{64})\/whatsapp-click$/);
      if(whatsappClick&&method==='POST') {
        rate('share-whatsapp:'+ip,30);
        const share=await trips.findShare(hash(whatsappClick[1]));
        if(!share||share.expires<=Date.now())fail(404,'This shared journey is unavailable.');
        await store.recordTripShareEvent(db,{id:randomUUID(),tokenHash:hash(whatsappClick[1]),eventType:'trip_share_whatsapp_clicked',created:new Date().toISOString()});
        return send(200,{ok:true});
      }
      if(sharedPhoto&&method==='GET') {
        // Anonymous viewers load a shared trip's photos through the share token, and only photos that trip references.
        rate('sharedphoto:'+ip,120);
        const share=await loadShare();
        if(!hasPhotoLink(JSON.parse(share.data),sharedPhoto[2],sharedPhoto[3])||typeof places.fetchPhoto!=='function')fail(404,'This place photo is no longer available.');
        const result=await places.fetchPhoto(sharedPhoto[2],sharedPhoto[3]);
        if(result.redirect){res.writeHead(result.status,{Location:result.redirect,...(result.headers||{})});res.end();return;}
        return send(result.status,result.data);
      }
      if(sharedMatch&&!sharedPhoto&&method==='GET') {
        const share=await loadShare();
        const data=JSON.parse(share.data);
        const safeUrl=value=>{try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:'';}catch{return '';}};
        // Photos saved from Google Places are same-origin relative links; give viewers the share-scoped route instead.
        const photoLink=value=>{const m=photoMatch(value);return m?`/api/shared/${sharedMatch[1]}/photo/${m[1]}/${m[2]}`:safeUrl(value);};
        const safeText=(value,max=2000)=>typeof value==='string'?value.slice(0,max):'';
        const days=Array.isArray(data.days)?data.days.map(day=>({title:safeText(day.title,200),date:safeText(day.date,10),notes:safeText(day.notes),items:Array.isArray(day.items)?day.items.map(item=>({title:safeText(item.title,200),time:safeText(item.time,80),notes:safeText(item.notes),address:safeText(item.address,500),url:safeUrl(item.url||''),openingHours:safeText(item.openingHours,1000),rating:safeText(item.rating,80),reviews:safeText(item.reviews),photos:Array.isArray(item.photos)?item.photos.map(photo=>({url:photoLink(photo.url),attribution:safeText(photo.attribution,300),sourceUrl:safeUrl(photo.sourceUrl)})).filter(photo=>photo.url):[]})):[]})):[];
        return send(200,{trip:{title:safeText(data.title,200),destination:safeText(data.destination,200),startDate:safeText(data.startDate,10),endDate:safeText(data.endDate,10),days},expires:new Date(share.expires).toISOString()});
      }
      if (['/api/auth/signup','/api/auth/login'].includes(p) && method==='POST') {
        if (hexclaveSelected) fail(503,hexclaveAuth.configured?'Use the Friday sign-in page to continue.':'Hexclave sign-in is not configured on this server yet.');
        rate('auth:'+ip,10);
        const e=email(body.email), password=str(body.password,'password',128,true);
        if(p.endsWith('login'))rate('login:'+e,10);
        if(password.length<12) fail(422,'Use a password with at least 12 characters.');
        if(p.endsWith('signup')) {
          const name=str(body.name,'name',100,true), salt=randomBytes(16).toString('hex');
          const key=(await scrypt(password,salt,64)).toString('hex');
          try {await store.createUser(db,{id:randomUUID(),email:e,name,password:`${salt}:${key}`});} catch {fail(409,'That email is already registered. Please sign in.');}
        } else {
          const u=await store.findUserByEmail(db,e);
          const [salt,key]=(u?.password || 'dummy:'+ '00'.repeat(64)).split(':');
          const candidate=await scrypt(password,salt,64);
          if(!u || !timingSafeEqual(candidate,Buffer.from(key,'hex'))) fail(401,'Email or password is incorrect.');
        }
        const u=await store.findUserByEmail(db,e);await session(u,res);return send(200,{user:publicUser(u)});
      }
      if (p==='/api/auth/me' && method==='GET') {
        if (hexclaveSelected) {
          if (!hexclaveAuth.configured) fail(503,'Hexclave sign-in is not configured on this server yet.');
          if (!hexPrincipal) return send(200,{user:null,localAuthBypass:false});
          if (hexPrincipal.restricted || !hexPrincipal.emailVerified) {
            const emailVerificationPending=!hexPrincipal.emailVerified||hexPrincipal.restrictedReason==='email_not_verified';
            return send(200,{user:null,verificationRequired:emailVerificationPending,accountRestricted:!emailVerificationPending,email:hexPrincipal.email,restrictedReason:hexPrincipal.restrictedReason});
          }
          if (hexResolution?.legacyAccountAvailable) return send(200,{user:null,legacyAccountAvailable:true,email:hexPrincipal.email,name:hexPrincipal.name});
          return send(200,{user:user?publicUser(user):null,localAuthBypass:false});
        }
        return send(200,{user:sessionUser?publicUser(sessionUser):null,localAuthBypass});
      }
      if (p==='/api/auth/link-legacy' && method==='POST') {
        rate('auth-link:'+ip,8);
        if (!hexclaveAuth.configured || !hexPrincipal || !hexPrincipal.emailVerified || hexPrincipal.restricted) fail(401,'Verify your Friday email before linking an existing account.');
        if (user) return send(200,{user:publicUser(user)});
        const legacy=await store.findUnlinkedLegacyUserByEmail(db,hexPrincipal.email);
        if (!legacy) fail(404,'No unlinked Friday account was found for this email.');
        const password=str(body.password,'password',128,true);
        const [salt,key]=(legacy.password||'dummy:'+ '00'.repeat(64)).split(':');
        if (!/^[a-f0-9]{32}$/i.test(salt||'') || !/^[a-f0-9]{128}$/i.test(key||'')) fail(401,'The existing Friday password is incorrect.');
        const candidate=await scrypt(password,salt,64);
        if (!timingSafeEqual(candidate,Buffer.from(key,'hex'))) fail(401,'The existing Friday password is incorrect.');
        try { await store.linkHexclaveIdentity(db,{hexclaveUserId:hexPrincipal.id,userId:legacy.id,email:hexPrincipal.email,name:hexPrincipal.name,emailVerified:true,restricted:false,updated:new Date().toISOString()}); }
        catch { fail(409,'This Hexclave account is already linked to Friday.'); }
        const linked=await store.findUserByHexclaveId(db,hexPrincipal.id);
        return send(200,{user:publicUser(linked)});
      }
      if (p==='/api/auth/fresh-account' && method==='POST') {
        rate('auth-link:'+ip,8);
        if (!hexclaveAuth.configured || !hexPrincipal || !hexPrincipal.emailVerified || hexPrincipal.restricted) fail(401,'Verify your Friday email before continuing.');
        if (user) return send(200,{user:publicUser(user)});
        try {
          const syntheticEmail=`hexclave-${hash(hexPrincipal.id).slice(0,40)}@identity.friday.invalid`;
          const fresh=await store.createHexclaveIdentity(db,{hexclaveUserId:hexPrincipal.id,userId:randomUUID(),syntheticEmail,email:hexPrincipal.email,name:hexPrincipal.name,password:`hexclave:${randomBytes(32).toString('hex')}`,emailVerified:true,restricted:false,updated:new Date().toISOString()});
          return send(200,{user:publicUser(fresh)});
        } catch {
          const existing=await store.findUserByHexclaveId(db,hexPrincipal.id);
          if (existing) return send(200,{user:publicUser(existing)});
          fail(409,'Friday could not create this account. Please try again.');
        }
      }
      const uEmail = String(user?.email || '').toLowerCase();
      const isAdmin = localAuthBypass || (!!user && (!hasConfiguredRestrictions || allConfiguredAdminEmails.has(uEmail)));
      const isVillaAdmin = localAuthBypass || (!!user && (
        (!hasConfiguredRestrictions && villaAdminEmails.length === 0) ||
        villaAdminEmails.includes(uEmail) ||
        generalAdminEmails.includes(uEmail)
      ));
      const isQuoteAdmin = localAuthBypass || (!!user && (
        (!hasConfiguredRestrictions && quoteAdminEmails.length === 0) ||
        quoteAdminEmails.includes(uEmail) ||
        generalAdminEmails.includes(uEmail)
      ));
      const isAiReviewAdmin = localAuthBypass || (!!user && (
        (!hasConfiguredRestrictions && aiReviewAdminEmails.length === 0) ||
        aiReviewAdminEmails.includes(uEmail) ||
        generalAdminEmails.includes(uEmail)
      ));
      const effectiveQuoteAdmins = (quoteAdminEmails.length === 0 && generalAdminEmails.length === 0)
        ? new Set([uEmail])
        : new Set([...quoteAdminEmails, ...generalAdminEmails]);
      if(p==='/api/ai-conversations/events'){
        allow('POST');if(!user)fail(401,'Please sign in to save conversation history.');
        if(body.ownerId!==user.id)fail(409,'Your account changed before this conversation entry could be saved.');
        if(typeof body.conversationId!=='string'||!/^[A-Za-z0-9_-]{1,120}$/.test(body.conversationId))fail(422,'A valid conversation id is required.');
        const conversationId=body.conversationId,eventKey=str(body.eventId,'event id',160,true);
        if(!/^[A-Za-z0-9_-]+$/.test(eventKey))fail(422,'Invalid conversation event id.');
        const eventType=str(body.eventType||'message','event type',60,true),role=body.role==null?null:str(body.role,'role',20,true);
        if(role!==null&&!['user','assistant','system','tool'].includes(role))fail(422,'Invalid conversation role.');
        const status=str(body.status||'completed','status',30,true);
        if(!['started','completed','failed','stopped'].includes(status))fail(422,'Invalid event status.');
        const content=auditContent(body.content),now=new Date().toISOString();
        await store.upsertAiConversationEvent(db,{eventKey,ownerId:user.id,conversationId,tripId:typeof body.tripId==='string'?body.tripId.slice(0,100):null,eventType,role,content,status,created:now,updated:now});
        return send(200,{ok:true});
      }
      if(p==='/api/admin/ai-conversations'){
        allow('GET','HEAD');if(!user)fail(401,'Please sign in.');
        if(!isAiReviewAdmin)fail(403,'Your account does not have Friday admin access.');
        const conversationId=url.searchParams.get('conversationId')||null,ownerId=url.searchParams.get('ownerId')||null,before=url.searchParams.get('before')||null;
        if(conversationId&&!/^[A-Za-z0-9_-]{1,120}$/.test(conversationId))fail(422,'Invalid conversation id.');
        let cursor=null;if(before){try{cursor=JSON.parse(Buffer.from(before,'base64url').toString('utf8'));}catch{fail(422,'Invalid review cursor.');}if(!cursor||!Number.isFinite(Date.parse(cursor.created))||![cursor.ownerId,cursor.conversationId,cursor.eventKey].every(v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v)))fail(422,'Invalid review cursor.');}
        const events=await store.listAiConversationEvents(db,{ownerId,conversationId,before:cursor,limit:url.searchParams.get('limit')});
        const last=events[events.length-1];
        return send(200,{events,nextBefore:last?Buffer.from(JSON.stringify({created:last.created,ownerId:last.owner_id,conversationId:last.conversation_id,eventKey:last.event_key})).toString('base64url'):null});
      }
      if(p==='/api/friday/reel-chat'){
        allow('POST');if(!user)fail(401,'Please sign in.');rate('reel-chat:'+user.id,30);
        const audit=await startAiAudit(body.conversationId,'reel_chat',{request:body},undefined,body.ownerId);
        try{const result=await reelChat.chat(user,body);await finishAiAudit(audit,'completed',{request:body,response:result});return send(200,result);}
        catch(error){await finishAiAudit(audit,'failed',{request:body,error:error.message});throw error;}
      }
      if(p==='/api/friday/reels'&&method==='POST'){
        allow('POST');if(!user)fail(401,'Please sign in.');rate('reels:'+user.id,5);
        const audit=await startAiAudit(body.conversationId,'reel_itinerary',{request:body},undefined,user.id);
        try{if(!config.apiKey||!config.model)throw Object.assign(new Error('Travel research is not connected yet. Please try again when research is available.'),{status:503});const result=await reels.plan(user,body);await finishAiAudit(audit,'completed',{request:body,response:result});return send(200,result);}
        catch(error){await finishAiAudit(audit,'failed',{request:body,error:error.message||'Reel itinerary failed.'});throw error;}
      }
      const reelDraftMatch=p.match(/^\/api\/friday\/reels\/([0-9a-f-]{36})$/i);
      if(reelDraftMatch&&method==='PATCH'){
        allow('PATCH');if(!user)fail(401,'Please sign in.');return send(200,{draft:await reels.patch(user,reelDraftMatch[1],body)});
      }
      if(p==='/api/friday/plan'){
        allow('POST');if(!user)fail(401,'Please sign in.');rate('friday:'+user.id,40);
        const audit=await startAiAudit(body.conversationId,'friday_plan',{request:body},body.tripId,body.ownerId);
        try{const result=await friday.plan(user,body);await finishAiAudit(audit,'completed',{request:body,response:result});return send(200,result);}
        catch(error){await finishAiAudit(audit,'failed',{request:body,error:error.message||'Travel planning failed.'});throw error;}
      }
      if(p==='/api/friday/drafts'){
        allow('GET');if(!user)fail(401,'Please sign in.');return send(200,{drafts:await friday.listDrafts(user)});
      }
      if(p==='/api/friday/handoffs'){
        if(!user)fail(401,'Please sign in.');
        if(method==='GET')return send(200,{handoffs:await friday.listHandoffs(user)});
        if(method==='POST')return send(201,{handoff:await friday.handoff(user,body)});
        fail(405,'Method not allowed.');
      }
      if(p==='/api/friday/status'){
        allow('GET');if(!user)fail(401,'Please sign in.');return send(200,{quoteAdmin:isQuoteAdmin,emailConfigured:emailService.configured,commissionEmailConfigured:emailService.configured&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.FRIDAY_ENQUIRY_EMAIL||'')});
      }
      if(p==='/api/admin/status'){
        allow('GET','HEAD');if(!user)fail(401,'Please sign in.');
        return send(200,{user:{email:user.email||null,name:user.name||null},access:isAdmin,capabilities:{villas:isVillaAdmin,quotes:isQuoteAdmin,aiReview:isAiReviewAdmin,enquiries:isAdmin,newsletter:isAdmin,emailOutbox:isAdmin},setup:{emailConfigured:emailService.configured,commissionEmailConfigured:emailService.configured&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.FRIDAY_ENQUIRY_EMAIL||'')}});
      }
      if(p==='/api/admin/briefings'){
        allow('GET','HEAD');if(!user)fail(401,'Please sign in.');if(!isAdmin)fail(403,'Your account does not have Friday admin access.');
        const today=new Date().toISOString().slice(0,10), owners=await store.listTripOwners(db), results=[];
        for(const owner of owners){
          const bookingRows=await store.listRecords(db,owner.id,'bookings');
          const ownerTrips=await trips.list(owner.id);
          for(const row of ownerTrips){
            const tripData=JSON.parse(row.data);
            if(tripData.archived||tripData.claudeState?.archived)continue;
            const briefing=prepareBriefing({tripId:row.id,tripData,bookingRows,recipient:owner.email,origin,now:new Date(`${today}T12:00:00Z`)});
            if(briefing.departureDate&&briefing.daysBeforeDeparture>=0&&briefing.daysBeforeDeparture<=30)results.push({tripId:row.id,title:briefing.title,departureDate:briefing.departureDate,daysBeforeDeparture:briefing.daysBeforeDeparture,bookingCount:briefing.bookings.length,eligible:briefing.eligible,reason:briefing.eligible?'Confirmed date within 7 days':'A linked booking with a confirmed date is required, and sending is limited to 7 days before departure.'});
          }
        }
        results.sort((a,b)=>a.departureDate.localeCompare(b.departureDate)||a.title.localeCompare(b.title));
        return send(200,{briefings:results,emailConfigured:emailService.configured});
      }
      const briefingSend=p.match(/^\/api\/admin\/briefings\/([0-9a-f-]{36})\/send$/i);
      if(briefingSend){
        allow('POST');if(!user)fail(401,'Please sign in.');if(!isAdmin)fail(403,'Your account does not have Friday admin access.');
        const tripId=briefingSend[1],owners=await store.listTripOwners(db);let found=null;
        for(const owner of owners){const row=await trips.find(tripId,owner.id);if(row){found={owner,row,bookingRows:await store.listRecords(db,owner.id,'bookings')};break;}}
        if(!found)fail(404,'This trip was not found.');
        const requestId=typeof body.requestId==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(body.requestId)?body.requestId:'';
        if(!requestId)fail(422,'A send request id is required.');
        const briefing=prepareBriefing({tripId,tripData:JSON.parse(found.row.data),bookingRows:found.bookingRows,recipient:found.owner.email,origin});
        if(!briefing.eligible)fail(409,'Only trips with a linked confirmed booking departing within 7 days can receive a briefing.');
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(briefing.recipient))fail(409,'This traveller account has no deliverable email address.');
        const row=await briefingEmail({dedupeKey:`briefing:${tripId}:${requestId}`,briefing,emailService});
        if(row?.status!=='provider_accepted')fail(503,'Friday could not confirm the briefing email was accepted. Check the email outbox before trying again.');
        return send(200,{sent:true,emailStatus:row.status,tripId,daysBeforeDeparture:briefing.daysBeforeDeparture,tripUrl:briefing.tripUrl});
      }
      if(p==='/api/admin/enquiries'){
        allow('GET','HEAD');if(!user)fail(401,'Please sign in.');if(!isAdmin)fail(403,'Your account does not have Friday admin access.');
        const enquiries=(await store.listEnquiries(db,url.searchParams.get('limit'))).map(row=>({id:row.id,kind:row.kind,data:JSON.parse(row.data),created:row.created}));
        return send(200,{enquiries});
      }
      if(p==='/api/admin/newsletter-subscribers'){
        allow('GET','HEAD');if(!user)fail(401,'Please sign in.');if(!isAdmin)fail(403,'Your account does not have Friday admin access.');
        return send(200,{subscribers:(await store.listNewsletterSubscribers(db,url.searchParams.get('limit'))).map(row=>({email:row.email,consentAt:row.consent_at,source:row.source,status:row.status,created:row.created,updated:row.updated,unsubscribedAt:row.unsubscribed_at}))});
      }
      if(p==='/api/admin/email-outbox'){
        allow('GET','HEAD');if(!user)fail(401,'Please sign in.');if(!isAdmin)fail(403,'Your account does not have Friday admin access.');
        return send(200,{messages:(await store.listEmailOutboxMetadata(db,url.searchParams.get('limit'))).map(row=>({id:row.id,kind:row.kind,status:row.status,attemptedAt:row.attempted_at,created:row.created,updated:row.updated}))});
      }
      if(p==='/api/admin/quotes'){
        allow('GET');if(!user)fail(401,'Please sign in.');const quotes=await friday.adminList(user,effectiveQuoteAdmins);
        const callbacks=(await store.listCallbackRequests(db)).map(row=>({id:row.id,kind:'callback',customerEmail:null,name:row.name,phone:row.phone,bestTime:row.best_time,entryPoint:row.entry_point,tripId:row.trip_id,status:row.status,createdAt:row.created}));
        return send(200,{quotes:[...callbacks,...quotes]});
      }
      const quotePreview=p.match(/^\/api\/admin\/quotes\/([0-9a-f-]{36})\/preview$/i);
      if(quotePreview){allow('POST');if(!user)fail(401,'Please sign in.');return send(200,{preview:await friday.previewQuote(user,effectiveQuoteAdmins,quotePreview[1],body)});}
      const quoteSend=p.match(/^\/api\/admin\/quotes\/([0-9a-f-]{36})\/send$/i);
      if(quoteSend){allow('POST');if(!user)fail(401,'Please sign in.');return send(200,{quote:await friday.sendQuote(user,effectiveQuoteAdmins,quoteSend[1],body)});}
      if(p==='/api/admin/villas'||/^\/api\/admin\/villas\/[0-9a-f-]{36}$/i.test(p)){
        if(!user)fail(401,'Please sign in.');
        if(!isVillaAdmin)fail(403,'Your account is not on the villa administration allowlist.');
        if(p==='/api/admin/villas'){
          if(method==='GET'||method==='HEAD')return send(200,{villas:(await store.listVillasByOwner(db,user.id)).map(adminVilla)});
          if(method==='POST'){
            const data=validateVillaInput(body.villa||body),id=randomUUID(),created=new Date().toISOString();
            await store.insertVilla(db,{id,ownerId:user.id,status:data.status,data:JSON.stringify(data),created,updated:created});
            return send(201,{villa:adminVilla(await store.getVilla(db,id))});
          }
          fail(405,'Method not allowed.');
        }
        const id=p.slice('/api/admin/villas/'.length),row=await store.getVilla(db,id);
        if(!row||row.ownerId!==user.id)fail(404,'This villa was not found.');
        if(method==='GET'||method==='HEAD')return send(200,{villa:adminVilla(row)});
        if(method==='PATCH'){
          const next=validateVillaInput({...JSON.parse(row.data),...(body.villa||body)}),updated=new Date().toISOString();
          await store.updateVilla(db,{id,ownerId:user.id,status:next.status,data:JSON.stringify(next),updated});
          return send(200,{villa:adminVilla(await store.getVilla(db,id))});
        }
        if(method==='DELETE'){await store.deleteVilla(db,id,user.id);return send(200,{ok:true});}
        fail(405,'Method not allowed.');
      }
      if(p==='/api/admin/villa-submissions'||/^\/api\/admin\/villa-submissions\/[0-9a-f-]{36}$/i.test(p)){
        if(!user)fail(401,'Please sign in.');
        if(!isVillaAdmin)fail(403,'Your account is not on the villa administration allowlist.');
        if(p==='/api/admin/villa-submissions'){
          allow('GET','HEAD');
          return send(200,{submissions:(await store.listVillaSubmissions(db)).map(privateSubmission)});
        }
        allow('PATCH');
        const id=p.slice('/api/admin/villa-submissions/'.length),row=await store.getVillaSubmission(db,id);
        if(!row)fail(404,'This submission was not found.');
        const status=body.status;
        if(!['new','reviewed','rejected'].includes(status))fail(422,'Choose new, reviewed, or rejected.');
        await store.updateVillaSubmissionStatus(db,id,status,new Date().toISOString());
        return send(200,{submission:privateSubmission(await store.getVillaSubmission(db,id))});
      }
      // Local development may preview planning without an account. Enforced auth records every AI request against its owner.
      if (p==='/api/destinations') {allow('GET','HEAD');return send(200,{destinations:listDestinations()});}
      const destMatch=p.match(/^\/api\/destinations\/([^/]+)$/);
      if (destMatch) {
        allow('GET','HEAD');
        let id;try{id=decodeURIComponent(destMatch[1]);}catch{fail(400,'Bad id');}
        const dest=getDestination(id);if(!dest)fail(404,'Unknown destination');
        return send(200,catalogOf(dest));
      }
      if (p==='/api/itineraries/prompt') {
        allow('POST');
        if(hexclaveSelected&&!user)fail(401,'Please sign in before planning a trip.');
        rate('itinerary-prompt:'+(user?user.id:ip),20);
        const parsed=parseItineraryRequest(body);
        if(parsed.error)fail(parsed.status,parsed.error);
        const audit=await startAiAudit(body.conversationId,'itinerary_prompt',{request:parsed.value},body.tripId,body.ownerId);
        const result={...itineraries.prompt(parsed.dest,parsed.value),schema:ITINERARY_SCHEMA,model:chatgpt.model};
        await finishAiAudit(audit,'completed',{request:parsed.value,response:result});
        return send(200,result);
      }
      if (p==='/api/itineraries') {
        allow('POST');
        if(hexclaveSelected&&!user)fail(401,'Please sign in before planning a trip.');
        rate('itinerary:'+(user?user.id:ip),20);
        const parsed=parseItineraryRequest(body);
        if(parsed.error)fail(parsed.status,parsed.error);
        let out;
        const audit=await startAiAudit(body.conversationId,'itinerary_generation',{request:{...parsed.value,source:body.source||itineraries.name},messageId:body.messageId},body.tripId,body.ownerId);
        try {
        if(body.draft!==undefined||body.source!==undefined){
          // A draft made in the user's browser with their own ChatGPT plan; we validate it against the catalog.
          if(body.source!=='chatgpt'||!body.draft||typeof body.draft!=='object'||Array.isArray(body.draft))fail(400,'"draft" must be a JSON object with source "chatgpt".');
          if(JSON.stringify(body.draft).length>40000)fail(413,'The draft is too large.');
          out=await itineraries.fromDraft(parsed.dest,parsed.value,body.draft);
        } else out=await itineraries.generate(parsed.dest,parsed.value);
        const record={id:'it_'+randomBytes(8).toString('hex'),createdAt:new Date().toISOString(),request:parsed.value,provider:out.provider,plan:out.plan};
        if(out.fallbackReason)record.fallbackReason=out.fallbackReason;
        await saveItinerary(db,record,user?user.id:null);
        const made={id:record.id,provider:record.provider,plan:record.plan};
        if(record.fallbackReason)made.fallbackReason=record.fallbackReason;
        await finishAiAudit(audit,'completed',{request:{...parsed.value,source:body.source||itineraries.name},response:made});
        return send(201,made,{Location:'/api/itineraries/'+record.id});
        }catch(error){await finishAiAudit(audit,'failed',{request:parsed.value,error:error.message||'Itinerary generation failed.'});throw error;}
      }
      const itineraryMatch=p.match(/^\/api\/itineraries\/([^/]+)$/);
      if (itineraryMatch) {
        allow('GET','HEAD');
        let id;try{id=decodeURIComponent(itineraryMatch[1]);}catch{fail(400,'Bad id');}
        if(hexclaveSelected&&!user)fail(401,'Please sign in to view this itinerary.');
        const rec=ITINERARY_ID.test(id)?await getItinerary(db,id,hexclaveSelected?user.id:undefined):null;
        if(!rec)fail(404,'Itinerary not found');
        return send(200,rec);
      }
      if (p==='/api/auth/logout' && method==='POST') {await store.deleteSession(db,hash(token));res.setHeader('Set-Cookie',cookie('',0));return send(200,{ok:true});}
      if(p.startsWith('/api/integrations/google/')) {
        if(!user)fail(401,'Please sign in.');
        const result=await google({path:p,method,body,user,url});
        if(result){if(result.redirect){res.writeHead(result.status,{Location:result.redirect,'Cache-Control':'no-store'});res.end();return;}return send(result.status,result.data);}
      }
      if (p==='/api/callbacks' && method==='POST') {
        rate('form:'+ip,5);
        if(Buffer.byteLength(JSON.stringify(body))>20000) fail(413,'Your request is too long.');
        const name=str(body.name,'name',100,true),phone=indianPhone(body.phone);
        const bestTime=str(body.bestTime,'best time',20,true);
        if(!['morning','afternoon','evening'].includes(bestTime)) fail(422,'Choose a time of day for the call.');
        const entryPoint=str(body.entryPoint,'entry point',20,true);
        if(!['planner','contact'].includes(entryPoint)) fail(422,'This callback request could not be placed.');
        const tripId=body.tripId==null||body.tripId===''?null:str(body.tripId,'trip link',160);
        if(tripId&&!/^[A-Za-z0-9_-]+$/.test(tripId)) fail(422,'This trip link is not valid.');
        const id=randomUUID(),created=new Date().toISOString();
        const data={request:'Call me back',name,phone,bestTime,entryPoint,...(tripId?{tripId}: {})};
        await store.createCallbackRequest(db,{id,name,phone,bestTime,entryPoint,tripId,status:'new',created});
        const inbox=typeof env.FRIDAY_ENQUIRY_EMAIL==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.FRIDAY_ENQUIRY_EMAIL)?env.FRIDAY_ENQUIRY_EMAIL.trim().toLowerCase():'';
        const notification=inbox?await emailService.enquiryNotification({id,inbox,data}):null;
        return send(201,{id,saved:true,delivery:{notification:notification?.status||'blocked'}});
      }
      if (['/api/commissions','/api/subscriptions'].includes(p) && method==='POST') {
        rate('form:'+ip,5); email(body.email);
        if(p.endsWith('commissions')) str(body.name,'name',100,true);
        else if(body.consent!==true) fail(422,'Please confirm that you want to receive occasional emails from Friday.');
        if(Buffer.byteLength(JSON.stringify(body))>20000) fail(413,'Your enquiry is too long.');
        const id=randomUUID(),created=new Date().toISOString();
        if(p.endsWith('commissions')){
          const name=str(body.name,'name',100,true),data={...body,email:email(body.email),name};
          await store.saveEnquiry(db,{id,kind:'commissions',data:JSON.stringify(data),created});
          const inbox=typeof env.FRIDAY_ENQUIRY_EMAIL==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.FRIDAY_ENQUIRY_EMAIL)?env.FRIDAY_ENQUIRY_EMAIL.trim().toLowerCase():'';
          const [receipt,notification]=await Promise.all([
            emailService.enquiryReceipt({id,name,email:data.email}),
            inbox?emailService.enquiryNotification({id,inbox,data}):null,
          ]);
          return send(201,{id,saved:true,delivery:{receipt:receipt?.status||'blocked',notification:notification?.status||'blocked'}});
        }
        const address=email(body.email);
        await store.upsertNewsletterSubscriber(db,{email:address,consentAt:created,source:'website',created});
        const confirmation=await emailService.subscriptionConfirmation({id,email:address,consentAt:created});
        return send(201,{id,saved:true,delivery:confirmation?.status||'blocked'});
      }
      if(!user) fail(401,'Please sign in.');
      if(p==='/api/alerts/check'&&method==='POST') {
        rate('fare:'+user.id,5);
        let alert=body;
        if(body.alertId)alert=JSON.parse((await getRecord(str(body.alertId,'alert id',100,true),user.id,'alerts')).data);
        fareFields(alert);
        const request={origin:alert.origin.trim().toUpperCase(),destination:alert.destination.trim(),departDate:alert.departDate||alert.startDate,returnDate:alert.returnDate||alert.endDate||'',currency:alert.currency.trim().toUpperCase(),targetPrice:alert.targetPrice??null},audit=await startAiAudit(body.conversationId,'fare_alert',{request},alert.tripId||body.tripId,body.ownerId);
        try{const result=await fareAlertFn(request,config);await finishAiAudit(audit,'completed',{request,response:result});return send(200,{result});}
        catch(error){await finishAiAudit(audit,'failed',{request,error:error.message||'Fare research failed.'});throw error;}
      }
      if(p.startsWith('/api/place-details')||p.startsWith('/api/place-photo/')) {
        rate('places:'+user.id,60);
        const result=await places({path:p,method,url,user});
        if(result){if(result.redirect){res.writeHead(result.status,{Location:result.redirect,...(result.headers||{})});res.end();return;}return send(result.status,result.data);}
      }
      if(p==='/api/imports/extract'&&method==='POST') {
        rate('social:'+user.id,5);
        const request={url:str(body.url,'social link',2000,true),note:str(body.note,'note',1000)},audit=await startAiAudit(body.conversationId,'social_extraction',{request},body.tripId,body.ownerId);
        try{if(!config.apiKey||!config.model)throw Object.assign(new Error('Travel research is not connected yet. You can still save this link and add your own note.'),{status:503});const result=await researchLinkFn(request,config);await finishAiAudit(audit,'completed',{request,response:result});return send(200,{result});}
        catch(error){await finishAiAudit(audit,'failed',{request,error:error.message||'Link research failed.'});throw error;}
      }
      const shareMatch=p.match(/^\/api\/trips\/([a-f0-9-]+)\/share$/);
      if(shareMatch&&method==='POST') {
        await getRecord(shareMatch[1],user.id,'trips');
        const token=randomBytes(32).toString('hex'),expires=Date.now()+30*86400000;
        await store.deleteShares(db,shareMatch[1],user.id);
        const tokenHash=hash(token),created=new Date().toISOString();
        await store.createShare(db,{tokenHash,userId:user.id,tripId:shareMatch[1],expires,created});
        await store.recordTripShareEvent(db,{id:randomUUID(),tokenHash,eventType:'trip_share_link_created',created});
        return send(201,{share:{url:`/app.html?share=${token}`,expires:new Date(expires).toISOString()}});
      }
      if(shareMatch&&method==='DELETE') {
        await getRecord(shareMatch[1],user.id,'trips');
        await store.deleteShares(db,shareMatch[1],user.id);
        return send(200,{ok:true});
      }
      if (p==='/api/profile' && method==='PATCH') {
        const old=JSON.parse(user.profile); const profile={...old};
        for (const key of ['city','airlines','avoidAirlines','hotels','budget','business','other','notifications']) if (body[key]!==undefined) profile[key]=str(body[key],key,2000);
        if(body.city!==undefined || body.airports!==undefined) {
          const metro=findMetro(profile.city), suggested=metro?.airports||[];
          if(body.airports!==undefined) {
            if(!Array.isArray(body.airports)||body.airports.some(a=>!suggested.includes(a)))fail(422,'Choose departure airports from the suggested group.');
            profile.airports=[...new Set(body.airports)];
          } else if(body.city!==undefined && body.city.trim().toLowerCase()!==String(old.city||'').trim().toLowerCase()) profile.airports=suggested;
          profile.onboarded=true;
        }
        await store.updateUserProfile(db,user.id,JSON.stringify(profile));
        return send(200,{user:publicUser({...user,profile:JSON.stringify(profile)})});
      }
      const jobMatch=p.match(/^\/api\/research(?:\/([a-f0-9-]+))?$/);
      if(jobMatch && method==='GET') {
        const id=jobMatch[1];
        const job=id?await store.findJob(db,id,user.id):await store.findLatestJobForTrip(db,url.searchParams.get('tripId'),user.id);
        if(id&&!job)fail(404,'Research was not found.');
        return send(200,{job:job?{...job,result:job.result?refreshPhotos(JSON.parse(job.result)):null}:null});
      }
      if (p==='/api/research' && method==='POST') {
        rate('ai:'+user.id,6);
        const prompt=str(body.prompt,'question',10000,true);
        if(!['fast','deep'].includes(body.mode||'deep'))fail(422,'Choose Fast or Deep research.');
        let image;
        if(body.image){image=str(body.image,'image',1400000);if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) fail(422,'Use a PNG, JPEG or WebP image.');}
        const tripId=str(body.tripId,'trip',100,true);
        const audit=await startAiAudit(body.conversationId,'trip_research',{request:{prompt,mode:body.mode||'deep',image:!!image,tripId}},tripId,body.ownerId);
        if(!config.apiKey||!config.model){const error='Travel research is not connected yet. You can still build and save your itinerary.';await finishAiAudit(audit,'failed',{request:{prompt,mode:body.mode||'deep',image:!!image,tripId},error});fail(503,error);}
        const trip=JSON.parse((await getRecord(tripId,user.id,'trips')).data);
        const profile=JSON.parse(user.profile);
        const bookings=(await store.listRecordData(db,user.id,'bookings')).map(r=>JSON.parse(r.data));
        const memories=(await store.listRecordData(db,user.id,'memories')).map(r=>JSON.parse(r.data));
        const id=randomUUID();
        if(inFlight.has(user.id)){const error='Your research is already in progress.';await finishAiAudit(audit,'failed',{request:{prompt,mode:body.mode||'deep',image:!!image,tripId},error});fail(409,error);}
        if(inFlight.size>=8){const error='Friday is busy researching. Please try again shortly.';await finishAiAudit(audit,'failed',{request:{prompt,mode:body.mode||'deep',image:!!image,tripId},error});fail(503,error);}
        await store.createJob(db,{id,userId:user.id,tripId,stage:'Starting research',created:new Date().toISOString()});
        inFlight.add(user.id);
        // Persist progress and results so leaving the page does not lose the request.
        const task=(async()=>{
          let stageWrites=Promise.resolve();   // stage updates are written in order and settle before the job completes or fails
          try {
            const answer=await researchFn({prompt,trip:{...trip,bookings:bookings.filter(b=>b.tripId===tripId)},profile:{...profile,memories},mode:body.mode||'deep',image},config,stage=>{stageWrites=stageWrites.then(()=>store.setJobStage(db,id,stage)).catch(()=>{});});
            await stageWrites;
            if(answer.days)validate('trips',{title:trip.title,days:answer.days});
            const fresh=await getRecord(tripId,user.id,'trips'),data=JSON.parse(fresh.data);
            const priorMessages=data.messages||[],lastMessage=priorMessages[priorMessages.length-1];
            data.messages=[...priorMessages,...(lastMessage?.role==='user'&&lastMessage.text===prompt?[]:[{role:'user',text:prompt}]),{role:'assistant',text:answer.text,sources:answer.sources,places:answer.places||[]}];
            for(const place of answer.places||[]) {
              if(typeof place.title!=='string'||!place.title.trim())continue;
              const saved={title:place.title,city:place.city||trip.destination||'',url:place.url||'',sourceUrl:place.sourceUrl||'',notes:place.notes||place.description||'',researchJobId:id,tripId};
              for(const key of ['address','openingHours','rating','reviews','photos','phone','price','category'])if(place[key]!==undefined)saved[key]=place[key];
              await newRecord(user.id,'places',saved);
            }
            if(answer.days?.length)data.researchDraft={days:answer.days,questions:answer.questions||[],jobId:id};
            validate('trips',data);
            await trips.overwrite({id:tripId,userId:user.id,data:JSON.stringify(data),updated:new Date().toISOString()});
            await store.completeJob(db,id,JSON.stringify(answer));
            await finishAiAudit(audit,'completed',{request:{prompt,mode:body.mode||'deep',image:!!image,tripId},response:answer});
          }catch(e){logError('research job failed',e);await stageWrites;await store.failJob(db,id,e.status?e.message:'Research could not finish. Please try again.');await finishAiAudit(audit,'failed',{request:{prompt,mode:body.mode||'deep',image:!!image,tripId},error:e.message||'Research could not finish.'});}
          finally{inFlight.delete(user.id);}
        })();backgroundTasks.add(task);task.finally(()=>backgroundTasks.delete(task));
        return send(202,{job:{id,status:'running',stage:'Starting research'}});
      }
      const match=p.match(/^\/api\/(trips|places|lists|bookings|memories|alerts|imports)(?:\/([a-f0-9-]+))?$/);
      if(match) {
        const [,kind,id]=match;
        if(method==='GET')return send(200,id?{record:parseRecord(await getRecord(id,user.id,kind))}:{records:(kind==='trips'?await trips.list(user.id):await store.listRecords(db,user.id,kind)).map(parseRecord)});
        if(method==='POST'&&!id)return send(201,{record:await newRecord(user.id,kind,body.data)});
        if(method==='PUT'&&id) {
          validate(kind,body.data);await getRecord(id,user.id,kind);
          if(!Number.isInteger(body.version))fail(422,'A record version is required.');
          const update={id,userId:user.id,data:JSON.stringify(body.data),updated:new Date().toISOString(),version:body.version};
          const changed=kind==='trips'?await trips.updateIfVersion(update):await store.updateRecordIfVersion(db,{...update,kind});
          if(!changed)fail(409,'This item changed in another window. Reload before editing.');
          return send(200,{record:parseRecord(await getRecord(id,user.id,kind))});
        }
        if(method==='DELETE'&&id){
          await getRecord(id,user.id,kind);
          if(kind==='trips'){await trips.delete(id,user.id);await store.deleteShares(db,id,user.id);}   // shares have no foreign key to a vault trip, so remove them here
          else await store.deleteRecord(db,id,user.id,kind);
          return send(200,{ok:true});
        }
      }
      fail(404,'Not found.');
    }catch(e){if(e instanceof VaultError){console.error(`[friday] ${req.method} ${String(req.url).split('?')[0]} trip storage failed: ${e.code}: ${e.message}`);if(!res.headersSent)return send(503,{error:'Trip storage is temporarily unavailable. Please try again.'});return res.end();}if(!e.status||e.status>=500)console.error(`[friday] ${req.method} ${String(req.url).split('?')[0]} failed: ${String(e?.stack||e).slice(0,2000)}`);if(!res.headersSent)send(e.status||500,{error:e.status?e.message:'Something went wrong. Please try again.'});else res.end();}
  });
  server.db = db;   // the app's database handle (tests assert rows through it)
  server.on('close',()=>{ Promise.allSettled([...backgroundTasks]).then(()=>store.closeStore(db)).catch(error=>console.error(`[friday] closing the database failed: ${error.message}`)); });
  return server;
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const defaultHost = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
  const defaultPort = process.env.NODE_ENV === 'production' ? 3000 : 4871;
  const server=createApp({log:m=>console.error('[friday] '+m)});const port=Number(process.env.PORT||defaultPort);
  // A database that never becomes reachable (after the bounded retries) is fatal: exit so the platform restarts the service.
  server.db.ready.catch(error => { console.error(`[friday] ${error.message}`); process.exit(1); });
  server.listen(port,process.env.HOST||defaultHost,()=>console.log(`Friday http://${process.env.HOST||defaultHost}:${port}`));
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
}
