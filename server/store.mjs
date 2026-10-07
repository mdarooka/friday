import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
/* `tripsInVault`: planner trips live in Hexclave's Data Vault, so a share cannot reference a SQLite records row. The shares
   table then has no foreign key to records (an existing table that has one is rebuilt once, keeping its rows). */
export function openStore(file, { tripsInVault = false } = {}) {
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,profile TEXT NOT NULL DEFAULT '{}');
    CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS hexclave_identities(hexclave_user_id TEXT PRIMARY KEY,user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,email TEXT NOT NULL,name TEXT NOT NULL,email_verified INTEGER NOT NULL DEFAULT 0,restricted INTEGER NOT NULL DEFAULT 0,updated TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL,data TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,updated TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS records_owner ON records(user_id,kind);
    CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),trip_id TEXT NOT NULL,status TEXT NOT NULL,stage TEXT NOT NULL,result TEXT,error TEXT,created TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS jobs_owner ON jobs(user_id,trip_id);
    CREATE TABLE IF NOT EXISTS shares(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),trip_id TEXT NOT NULL${tripsInVault ? '' : ' REFERENCES records(id) ON DELETE CASCADE'},expires INTEGER NOT NULL,created TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS shares_trip_owner ON shares(user_id,trip_id);
    CREATE TABLE IF NOT EXISTS trip_share_events(id TEXT PRIMARY KEY,token_hash TEXT NOT NULL,event_type TEXT NOT NULL CHECK(event_type IN ('trip_share_link_created','trip_share_whatsapp_clicked','trip_share_link_opened','trip_share_preview_bot')),created TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS trip_share_events_type_created ON trip_share_events(event_type,created);
    CREATE TABLE IF NOT EXISTS enquiries(id TEXT PRIMARY KEY,kind TEXT NOT NULL,data TEXT NOT NULL,created TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS email_outbox(id TEXT PRIMARY KEY,dedupe_key TEXT NOT NULL UNIQUE,kind TEXT NOT NULL,recipient TEXT NOT NULL,subject TEXT NOT NULL,content TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('queued','sending','provider_accepted','delivery_unknown','blocked')),attempted_at TEXT,created TEXT NOT NULL,updated TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS email_outbox_status ON email_outbox(status,created);
    CREATE TABLE IF NOT EXISTS newsletter_subscribers(email TEXT PRIMARY KEY,consent_at TEXT NOT NULL,source TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('subscribed','unsubscribed')),created TEXT NOT NULL,updated TEXT NOT NULL,unsubscribed_at TEXT);
    CREATE TABLE IF NOT EXISTS itineraries(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE SET NULL,created TEXT NOT NULL,request TEXT NOT NULL,provider TEXT NOT NULL,plan TEXT NOT NULL,fallback_reason TEXT);
    CREATE TABLE IF NOT EXISTS ai_conversation_events(event_key TEXT NOT NULL,owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,conversation_id TEXT NOT NULL,trip_id TEXT,event_type TEXT NOT NULL,role TEXT,content TEXT NOT NULL,status TEXT NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL,PRIMARY KEY(owner_id,conversation_id,event_key));
    CREATE INDEX IF NOT EXISTS ai_conversations_owner ON ai_conversation_events(owner_id,conversation_id,created);
    CREATE INDEX IF NOT EXISTS ai_conversations_review ON ai_conversation_events(created DESC);
    CREATE TABLE IF NOT EXISTS villas(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),status TEXT NOT NULL CHECK(status IN ('draft','published')),data TEXT NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS villas_status ON villas(status,updated DESC);
    CREATE INDEX IF NOT EXISTS villas_owner ON villas(owner_id,updated DESC);
    CREATE TABLE IF NOT EXISTS villa_submissions(id TEXT PRIMARY KEY,status TEXT NOT NULL CHECK(status IN ('new','reviewed','rejected')),data TEXT NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS villa_submissions_status ON villa_submissions(status,created DESC);
    CREATE INDEX IF NOT EXISTS itineraries_owner ON itineraries(user_id);`);
  db.exec(`CREATE TABLE IF NOT EXISTS friday_drafts(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,version INTEGER NOT NULL,data TEXT NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS friday_drafts_owner ON friday_drafts(owner_id,updated DESC);
    CREATE TABLE IF NOT EXISTS friday_handoffs(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,draft_id TEXT NOT NULL,version INTEGER NOT NULL,snapshot TEXT NOT NULL,status TEXT NOT NULL,created TEXT NOT NULL,UNIQUE(owner_id,draft_id,version));
    CREATE INDEX IF NOT EXISTS friday_handoffs_owner ON friday_handoffs(owner_id,created DESC);
    CREATE TABLE IF NOT EXISTS callback_requests(id TEXT PRIMARY KEY,name TEXT NOT NULL,phone TEXT NOT NULL,best_time TEXT NOT NULL,entry_point TEXT NOT NULL,trip_id TEXT,status TEXT NOT NULL DEFAULT 'new',created TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS callback_requests_created ON callback_requests(created DESC);
    CREATE TABLE IF NOT EXISTS friday_quotes(id TEXT PRIMARY KEY,handoff_id TEXT NOT NULL UNIQUE REFERENCES friday_handoffs(id),owner_id TEXT NOT NULL REFERENCES users(id),customer_email TEXT NOT NULL,snapshot TEXT NOT NULL,status TEXT NOT NULL,quote TEXT,attempted_at TEXT,created TEXT NOT NULL,first_reply_at TEXT);`);
  if (!db.prepare("SELECT 1 FROM pragma_table_info('friday_quotes') WHERE name='first_reply_at'").get()) db.exec('ALTER TABLE friday_quotes ADD COLUMN first_reply_at TEXT');
  if (tripsInVault && db.prepare("SELECT 1 FROM pragma_foreign_key_list('shares') WHERE \"table\"='records'").get()) {
    db.exec(`BEGIN; CREATE TABLE shares_nofk(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),trip_id TEXT NOT NULL,expires INTEGER NOT NULL,created TEXT NOT NULL);
      INSERT INTO shares_nofk SELECT token_hash,user_id,trip_id,expires,created FROM shares; DROP TABLE shares; ALTER TABLE shares_nofk RENAME TO shares;
      CREATE INDEX IF NOT EXISTS shares_trip_owner ON shares(user_id,trip_id); COMMIT;`);
  }
  return db;
}

/* Generated itineraries (POST /api/itineraries). Enforced-auth requests always retain their owner id;
   reads in enforced mode match both the itinerary id and signed-in owner. */
export const ITINERARY_ID = /^it_[a-f0-9]{16}$/;
export function saveItinerary(db, rec, userId = null) {
  if (!ITINERARY_ID.test(rec.id)) throw new Error('invalid itinerary id');
  db.prepare('INSERT INTO itineraries(id,user_id,created,request,provider,plan,fallback_reason) VALUES(?,?,?,?,?,?,?)')
    .run(rec.id, userId, rec.createdAt, JSON.stringify(rec.request), rec.provider, JSON.stringify(rec.plan), rec.fallbackReason || null);
  return rec;
}
export function getItinerary(db, id, userId) {
  if (typeof id !== 'string' || !ITINERARY_ID.test(id)) return null;
  const r = userId === undefined
    ? db.prepare('SELECT * FROM itineraries WHERE id=?').get(id)
    : db.prepare('SELECT * FROM itineraries WHERE id=? AND user_id=?').get(id,userId);
  if (!r) return null;
  const rec = { id: r.id, createdAt: r.created, request: JSON.parse(r.request), provider: r.provider, plan: JSON.parse(r.plan) };
  if (r.fallback_reason) rec.fallbackReason = r.fallback_reason;
  return rec;
}

/* ======================================================================================================================
   Everything below is the whole of the app's SQL. Routes and integrations call these named functions with the db handle
   from openStore and never write SQL themselves, so moving to a hosted database means reimplementing this module.
   ====================================================================================================================== */

export const closeStore = db => db.close();

/* ---- owner-scoped trip chat audit trail ---- */
export const upsertAiConversationEvent = (db, row) => db.prepare(`INSERT INTO ai_conversation_events(event_key,owner_id,conversation_id,trip_id,event_type,role,content,status,created,updated)
  VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner_id,conversation_id,event_key) DO UPDATE SET trip_id=excluded.trip_id,event_type=excluded.event_type,role=excluded.role,content=excluded.content,status=excluded.status,updated=excluded.updated`)
  .run(row.eventKey,row.ownerId,row.conversationId,row.tripId||null,row.eventType,row.role||null,row.content,row.status,row.created,row.updated);
export const updateAiConversationEvent = (db, row) => db.prepare('UPDATE ai_conversation_events SET content=?,status=?,updated=? WHERE owner_id=? AND conversation_id=? AND event_key=?')
  .run(row.content,row.status,row.updated,row.ownerId,row.conversationId,row.eventKey).changes;
export const listAiConversationEvents = (db, { ownerId, conversationId, limit=500, before }={}) => {
  const requested=limit==null||limit===''?500:Number(limit),safeLimit=Number.isFinite(requested)?Math.max(1,Math.min(2000,Math.trunc(requested))):500;
  const clauses=[],params=[];
  if(ownerId){clauses.push('owner_id=?');params.push(ownerId);}
  if(conversationId){clauses.push('conversation_id=?');params.push(conversationId);}
  if(before){clauses.push('(created<? OR (created=? AND owner_id<?) OR (created=? AND owner_id=? AND conversation_id<?) OR (created=? AND owner_id=? AND conversation_id=? AND event_key<?))');params.push(before.created,before.created,before.ownerId,before.created,before.ownerId,before.conversationId,before.created,before.ownerId,before.conversationId,before.eventKey);}
  return db.prepare(`SELECT event_key,owner_id,conversation_id,trip_id,event_type,role,content,status,created,updated FROM ai_conversation_events${clauses.length?' WHERE '+clauses.join(' AND '):''} ORDER BY created DESC,owner_id DESC,conversation_id DESC,event_key DESC LIMIT ?`).all(...params,safeLimit);
};

/* ---- Friday assisted planning workflow ---- */
export const getFridayDraft = (db,id,owner) => db.prepare('SELECT * FROM friday_drafts WHERE id=? AND owner_id=?').get(id,owner);
export const listFridayDrafts = (db,owner) => db.prepare('SELECT * FROM friday_drafts WHERE owner_id=? ORDER BY updated DESC').all(owner);
export const insertFridayDraft = (db,row) => db.prepare('INSERT INTO friday_drafts(id,owner_id,version,data,created,updated) VALUES(?,?,?,?,?,?)').run(row.id,row.ownerId,row.version,row.data,row.created,row.updated);
export const updateFridayDraft = (db,row) => db.prepare('UPDATE friday_drafts SET version=?,data=?,updated=? WHERE id=? AND owner_id=? AND version=?').run(row.version,row.data,row.updated,row.id,row.ownerId,row.expectedVersion).changes;
export const insertFridayHandoff = (db,row) => db.prepare('INSERT INTO friday_handoffs(id,owner_id,draft_id,version,snapshot,status,created) VALUES(?,?,?,?,?,?,?)').run(row.id,row.ownerId,row.draftId,row.version,row.snapshot,row.status,row.created);
export function createFridayHandoffWithQuote(db,handoff,quote){db.exec('BEGIN IMMEDIATE');try{insertFridayHandoff(db,handoff);insertFridayQuote(db,quote);db.exec('COMMIT');return true;}catch(e){db.exec('ROLLBACK');throw e;}}
export const listFridayHandoffs = (db,owner) => db.prepare('SELECT id,draft_id,version,snapshot,status,created FROM friday_handoffs WHERE owner_id=? ORDER BY created DESC').all(owner);
export const listFridayQuotes = db => db.prepare("SELECT id,handoff_id,customer_email,snapshot,status,quote,attempted_at,created,first_reply_at FROM friday_quotes ORDER BY CASE WHEN status='pending' AND first_reply_at IS NULL THEN 0 ELSE 1 END,created ASC").all();
export const createCallbackRequest = (db, row) => db.prepare('INSERT INTO callback_requests(id,name,phone,best_time,entry_point,trip_id,status,created) VALUES(?,?,?,?,?,?,?,?)').run(row.id,row.name,row.phone,row.bestTime,row.entryPoint,row.tripId||null,row.status||'new',row.created);
export const listCallbackRequests = db => db.prepare('SELECT id,name,phone,best_time,entry_point,trip_id,status,created FROM callback_requests ORDER BY created DESC').all();
export const getFridayQuote = (db,id) => db.prepare('SELECT * FROM friday_quotes WHERE id=?').get(id);
export const insertFridayQuote = (db,row) => db.prepare('INSERT INTO friday_quotes(id,handoff_id,owner_id,customer_email,snapshot,status,created) VALUES(?,?,?,?,?,?,?)').run(row.id,row.handoffId,row.ownerId,row.customerEmail,row.snapshot,row.status,row.created);
export const claimFridayQuote = (db,id,quote,attempted) => db.prepare("UPDATE friday_quotes SET status='sending',quote=?,attempted_at=? WHERE id=? AND status='pending'").run(quote,attempted,id).changes;
export const markFridayQuoteReplied = (db,id,repliedAt) => db.prepare("UPDATE friday_quotes SET first_reply_at=? WHERE id=? AND status='pending' AND first_reply_at IS NULL").run(repliedAt,id).changes;
export function setFridayQuoteStatus(db,id,status){db.exec('BEGIN IMMEDIATE');try{db.prepare("UPDATE friday_quotes SET status=? WHERE id=? AND status='sending'").run(status,id);db.prepare('UPDATE friday_handoffs SET status=? WHERE id=(SELECT handoff_id FROM friday_quotes WHERE id=?)').run(status,id);db.exec('COMMIT');return true;}catch(e){db.exec('ROLLBACK');throw e;}}

/* ---- villas and private owner-submission inbox ---- */
const villaFromRow = r => r && ({ id:r.id, ownerId:r.owner_id, status:r.status, data:r.data, created:r.created, updated:r.updated });
const submissionFromRow = r => r && ({ id:r.id, status:r.status, data:r.data, created:r.created, updated:r.updated });
export const insertVilla = (db, { id, ownerId, status, data, created, updated }) => db.prepare('INSERT INTO villas(id,owner_id,status,data,created,updated) VALUES(?,?,?,?,?,?)').run(id,ownerId,status,data,created,updated);
export const getVilla = (db, id) => villaFromRow(db.prepare('SELECT * FROM villas WHERE id=?').get(id));
export const getPublishedVilla = (db, id) => villaFromRow(db.prepare("SELECT * FROM villas WHERE id=? AND status='published'").get(id));
export const listPublishedVillas = db => db.prepare("SELECT * FROM villas WHERE status='published' ORDER BY updated DESC").all().map(villaFromRow);
export const listVillasByOwner = (db, ownerId) => db.prepare('SELECT * FROM villas WHERE owner_id=? ORDER BY updated DESC').all(ownerId).map(villaFromRow);
export const updateVilla = (db, { id, ownerId, status, data, updated }) => db.prepare('UPDATE villas SET status=?,data=?,updated=? WHERE id=? AND owner_id=?').run(status,data,updated,id,ownerId).changes;
export const deleteVilla = (db, id, ownerId) => db.prepare('DELETE FROM villas WHERE id=? AND owner_id=?').run(id,ownerId).changes;
export const insertVillaSubmission = (db, { id, status='new', data, created, updated }) => db.prepare('INSERT INTO villa_submissions(id,status,data,created,updated) VALUES(?,?,?,?,?)').run(id,status,data,created,updated);
export const listVillaSubmissions = db => db.prepare('SELECT * FROM villa_submissions ORDER BY created DESC').all().map(submissionFromRow);
export const getVillaSubmission = (db, id) => submissionFromRow(db.prepare('SELECT * FROM villa_submissions WHERE id=?').get(id));
export const updateVillaSubmissionStatus = (db, id, status, updated) => db.prepare('UPDATE villa_submissions SET status=?,updated=? WHERE id=?').run(status,updated,id).changes;

/* ---- users and sessions ---- */
export const createUser = (db, { id, email, name, password }) => db.prepare('INSERT INTO users(id,email,name,password) VALUES(?,?,?,?)').run(id, email, name, password);   // throws when the email exists
export const findUserByEmail = (db, email) => db.prepare('SELECT * FROM users WHERE email=?').get(email);
export const updateUserProfile = (db, userId, profileJson) => db.prepare('UPDATE users SET profile=? WHERE id=?').run(profileJson, userId);
const hexclaveUserQuery = `SELECT users.*,hexclave_identities.email AS hexclave_email,hexclave_identities.name AS hexclave_name,hexclave_identities.email_verified AS hexclave_email_verified,hexclave_identities.restricted AS hexclave_restricted FROM users JOIN hexclave_identities ON hexclave_identities.user_id=users.id`;
export const findUserByHexclaveId = (db, hexclaveUserId) => db.prepare(`${hexclaveUserQuery} WHERE hexclave_identities.hexclave_user_id=?`).get(hexclaveUserId);
export const findUnlinkedLegacyUserByEmail = (db, email) => db.prepare(`SELECT users.* FROM users WHERE lower(users.email)=lower(?) AND NOT EXISTS (SELECT 1 FROM hexclave_identities WHERE hexclave_identities.user_id=users.id)`).get(email);
export function createHexclaveIdentity(db, { hexclaveUserId, userId, syntheticEmail, email, name, password, emailVerified, restricted, updated }) {
  db.exec('BEGIN IMMEDIATE');
  try {
    createUser(db, { id:userId, email:syntheticEmail, name:name || email || 'Friday traveller', password });
    db.prepare('INSERT INTO hexclave_identities(hexclave_user_id,user_id,email,name,email_verified,restricted,updated) VALUES(?,?,?,?,?,?,?)')
      .run(hexclaveUserId,userId,email,name || email || 'Friday traveller',emailVerified?1:0,restricted?1:0,updated);
    db.exec('COMMIT'); return findUserByHexclaveId(db, hexclaveUserId);
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
export const updateHexclaveIdentity = (db, { hexclaveUserId, email, name, emailVerified, restricted, updated }) => db.prepare('UPDATE hexclave_identities SET email=?,name=?,email_verified=?,restricted=?,updated=? WHERE hexclave_user_id=?')
  .run(email,name || email || 'Friday traveller',emailVerified?1:0,restricted?1:0,updated,hexclaveUserId).changes;
export const linkHexclaveIdentity = (db, { hexclaveUserId, userId, email, name, emailVerified, restricted, updated }) => db.prepare('INSERT INTO hexclave_identities(hexclave_user_id,user_id,email,name,email_verified,restricted,updated) VALUES(?,?,?,?,?,?,?)')
  .run(hexclaveUserId,userId,email,name || email || 'Friday traveller',emailVerified?1:0,restricted?1:0,updated);
export const deleteExpiredSessions = (db, now) => db.prepare('DELETE FROM sessions WHERE expires<?').run(now);
export const createSession = (db, tokenHash, userId, expires) => db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(tokenHash, userId, expires);
export const findUserBySession = (db, tokenHash, now) => db.prepare('SELECT users.* FROM users JOIN sessions ON users.id=sessions.user_id WHERE sessions.hash=? AND sessions.expires>?').get(tokenHash, now);
export const deleteSession = (db, tokenHash) => db.prepare('DELETE FROM sessions WHERE hash=?').run(tokenHash);

/* ---- records (trips, places, lists, bookings, memories, alerts, imports) ---- */
export const findRecord = (db, id, userId, kind) => db.prepare('SELECT * FROM records WHERE id=? AND user_id=? AND kind=?').get(id, userId, kind);
export const insertRecord = (db, { id, userId, kind, data, updated }) => db.prepare('INSERT INTO records(id,user_id,kind,data,updated) VALUES(?,?,?,?,?)').run(id, userId, kind, data, updated);
export const listRecords = (db, userId, kind) => db.prepare('SELECT * FROM records WHERE user_id=? AND kind=? ORDER BY updated DESC').all(userId, kind);
export const listRecordData = (db, userId, kind) => db.prepare('SELECT data FROM records WHERE user_id=? AND kind=?').all(userId, kind);   // raw JSON strings, owner's only
export const listTripOwners = db => db.prepare(`SELECT users.id,COALESCE(hexclave_identities.email,users.email) AS email,COALESCE(hexclave_identities.name,users.name) AS name FROM users LEFT JOIN hexclave_identities ON hexclave_identities.user_id=users.id ORDER BY users.id`).all();
export const listAllTrips = db => db.prepare("SELECT * FROM records WHERE kind='trips' ORDER BY user_id,updated").all();   // every owner's trips: for the one-time copy to Hexclave only
export const findTripId = (db, id, userId) => db.prepare("SELECT id FROM records WHERE id=? AND user_id=? AND kind='trips'").get(id, userId);
/* Optimistic update: returns the number of rows changed (0 when the version moved on). */
export const updateRecordIfVersion = (db, { id, userId, kind, data, updated, version }) => db.prepare('UPDATE records SET data=?,version=version+1,updated=? WHERE id=? AND user_id=? AND kind=? AND version=?').run(data, updated, id, userId, kind, version).changes;
export const overwriteRecord = (db, { id, userId, data, updated }) => db.prepare('UPDATE records SET data=?,version=version+1,updated=? WHERE id=? AND user_id=?').run(data, updated, id, userId);
export const deleteRecord = (db, id, userId, kind) => db.prepare('DELETE FROM records WHERE id=? AND user_id=? AND kind=?').run(id, userId, kind);

/* ---- research jobs ---- */
export const failInterruptedJobs = db => db.prepare("UPDATE jobs SET status='failed',error='Research was interrupted by a server restart. Please try again.' WHERE status='running'").run();
export const createJob = (db, { id, userId, tripId, stage, created }) => db.prepare('INSERT INTO jobs(id,user_id,trip_id,status,stage,created) VALUES(?,?,?,?,?,?)').run(id, userId, tripId, 'running', stage, created);
export const findJob = (db, id, userId) => db.prepare('SELECT * FROM jobs WHERE id=? AND user_id=?').get(id, userId);
export const findLatestJobForTrip = (db, tripId, userId) => db.prepare('SELECT * FROM jobs WHERE trip_id=? AND user_id=? ORDER BY created DESC LIMIT 1').get(tripId, userId);
export const setJobStage = (db, id, stage) => db.prepare('UPDATE jobs SET stage=? WHERE id=?').run(stage, id);
export const completeJob = (db, id, resultJson) => db.prepare("UPDATE jobs SET status='completed',stage='Research complete',result=? WHERE id=?").run(resultJson, id);
export const failJob = (db, id, error) => db.prepare("UPDATE jobs SET status='failed',error=? WHERE id=?").run(error, id);

/* ---- shared (read-only) trip links ---- */
export const findShare = (db, tokenHash) => db.prepare('SELECT shares.trip_id,shares.expires,records.data FROM shares JOIN records ON records.id=shares.trip_id AND records.user_id=shares.user_id AND records.kind=\'trips\' WHERE shares.token_hash=?').get(tokenHash);
export const findShareLink = (db, tokenHash) => db.prepare('SELECT token_hash,user_id,trip_id,expires FROM shares WHERE token_hash=?').get(tokenHash);   // no join: used when trips are not in SQLite
export const deleteShares = (db, tripId, userId) => db.prepare('DELETE FROM shares WHERE trip_id=? AND user_id=?').run(tripId, userId);
export const createShare = (db, { tokenHash, userId, tripId, expires, created }) => db.prepare('INSERT INTO shares(token_hash,user_id,trip_id,expires,created) VALUES(?,?,?,?,?)').run(tokenHash, userId, tripId, expires, created);
export const recordTripShareEvent = (db, { id, tokenHash, eventType, created }) => db.prepare('INSERT INTO trip_share_events(id,token_hash,event_type,created) VALUES(?,?,?,?)').run(id,tokenHash,eventType,created);

/* ---- commission and newsletter enquiries ---- */
export const saveEnquiry = (db, { id, kind, data, created }) => db.prepare('INSERT INTO enquiries VALUES(?,?,?,?)').run(id, kind, data, created);
export const listEnquiries = (db, limit=500) => db.prepare('SELECT id,kind,data,created FROM enquiries ORDER BY created DESC,id DESC LIMIT ?').all(Math.max(1,Math.min(2000,Math.trunc(Number(limit)||500))));
export const listNewsletterSubscribers = (db, limit=1000) => db.prepare('SELECT email,consent_at,source,status,created,updated,unsubscribed_at FROM newsletter_subscribers ORDER BY created DESC,email LIMIT ?').all(Math.max(1,Math.min(5000,Math.trunc(Number(limit)||1000))));
// Admin-facing delivery state excludes message bodies and provider credentials.
export const listEmailOutboxMetadata = (db, limit=500) => db.prepare('SELECT id,kind,status,attempted_at,created,updated FROM email_outbox ORDER BY created DESC,id DESC LIMIT ?').all(Math.max(1,Math.min(2000,Math.trunc(Number(limit)||500))));
export const createEmailOutbox = (db, row) => db.prepare('INSERT OR IGNORE INTO email_outbox(id,dedupe_key,kind,recipient,subject,content,status,created,updated) VALUES(?,?,?,?,?,?,?,?,?)')
  .run(row.id,row.dedupeKey,row.kind,row.recipient,row.subject,row.content,row.status,row.created,row.updated);
export const getEmailOutboxByKey = (db, dedupeKey) => db.prepare('SELECT * FROM email_outbox WHERE dedupe_key=?').get(dedupeKey);
export const setEmailOutboxRecipient = (db, dedupeKey, recipient, updated) => db.prepare("UPDATE email_outbox SET recipient=?,updated=? WHERE dedupe_key=? AND status IN ('queued','blocked') AND recipient=''").run(recipient,updated,dedupeKey).changes;
export const claimEmailOutbox = (db, dedupeKey, attemptedAt, includeBlocked=false) => db.prepare(`UPDATE email_outbox SET status='sending',attempted_at=?,updated=? WHERE dedupe_key=? AND status IN (${includeBlocked?"'queued','blocked'":"'queued'"})`).run(attemptedAt,attemptedAt,dedupeKey).changes;
export const listPendingEmailOutbox = (db, limit=100) => db.prepare("SELECT * FROM email_outbox WHERE status IN ('queued','blocked') ORDER BY created,id LIMIT ?").all(Math.max(1,Math.min(1000,Math.trunc(Number(limit)||100))));
export const setEmailOutboxStatus = (db, dedupeKey, status, updated) => db.prepare("UPDATE email_outbox SET status=?,updated=? WHERE dedupe_key=? AND status='sending'").run(status,updated,dedupeKey).changes;
export const markInterruptedEmailSendsUnknown = (db, updated=new Date().toISOString()) => db.prepare("UPDATE email_outbox SET status='delivery_unknown',updated=? WHERE status='sending'").run(updated);
export const upsertNewsletterSubscriber = (db, { email, consentAt, source='website', created=consentAt }) => db.prepare(`INSERT INTO newsletter_subscribers(email,consent_at,source,status,created,updated)
  VALUES(?,?,?,'subscribed',?,?) ON CONFLICT(email) DO UPDATE SET consent_at=excluded.consent_at,source=excluded.source,status='subscribed',updated=excluded.updated,unsubscribed_at=NULL`)
  .run(email,consentAt,source,created,consentAt);
export const getNewsletterSubscriber = (db, email) => db.prepare('SELECT email,consent_at,source,status,created,updated,unsubscribed_at FROM newsletter_subscribers WHERE email=?').get(email);

/* ---- Google connections (Gmail and Calendar read-only) ---- */
export function ensureGoogleSchema(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS google_connections(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,kind TEXT NOT NULL CHECK(kind IN ('gmail','calendar')),refresh_token TEXT NOT NULL,scopes TEXT NOT NULL,connected_at TEXT NOT NULL,PRIMARY KEY(user_id,kind));
    CREATE TABLE IF NOT EXISTS google_oauth_states(state_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,kind TEXT NOT NULL,verifier TEXT NOT NULL,expires INTEGER NOT NULL);`);
}
export const findGoogleRefreshToken = (db, userId, kind) => db.prepare('SELECT refresh_token FROM google_connections WHERE user_id=? AND kind=?').get(userId, kind);
export const setGoogleRefreshToken = (db, userId, kind, sealed) => db.prepare('UPDATE google_connections SET refresh_token=? WHERE user_id=? AND kind=?').run(sealed, userId, kind);
export const listGoogleConnections = (db, userId) => db.prepare('SELECT kind,scopes,connected_at FROM google_connections WHERE user_id=?').all(userId);
export const upsertGoogleConnection = (db, { userId, kind, refreshToken, scopes, connectedAt }) => db.prepare('INSERT INTO google_connections(user_id,kind,refresh_token,scopes,connected_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,kind) DO UPDATE SET refresh_token=excluded.refresh_token,scopes=excluded.scopes,connected_at=excluded.connected_at').run(userId, kind, refreshToken, scopes, connectedAt);
export const deleteGoogleConnection = (db, userId, kind) => db.prepare('DELETE FROM google_connections WHERE user_id=? AND kind=?').run(userId, kind);
export const findGoogleOAuthState = (db, stateHash, userId, now) => db.prepare('SELECT * FROM google_oauth_states WHERE state_hash=? AND user_id=? AND expires>?').get(stateHash, userId, now);
export const createGoogleOAuthState = (db, { stateHash, userId, kind, verifier, expires }) => db.prepare('INSERT INTO google_oauth_states(state_hash,user_id,kind,verifier,expires) VALUES(?,?,?,?,?)').run(stateHash, userId, kind, verifier, expires);
export const deleteGoogleOAuthState = (db, stateHash) => db.prepare('DELETE FROM google_oauth_states WHERE state_hash=?').run(stateHash);
export const deleteExpiredGoogleOAuthStates = (db, now) => db.prepare('DELETE FROM google_oauth_states WHERE expires<?').run(now);
export const deleteGoogleOAuthStatesFor = (db, userId, kind) => db.prepare('DELETE FROM google_oauth_states WHERE user_id=? AND kind=?').run(userId, kind);
