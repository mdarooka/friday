import { openDatabase } from './db.mjs';

/* PostgreSQL schema. Created idempotently at startup under an advisory lock (see db.mjs), so several instances can start together.
   Epoch-millisecond columns are BIGINT; JSON documents stay TEXT; flags stay 0/1 INTEGER so row shapes match the old ones.
   `tripsInVault`: planner trips live in Hexclave's Data Vault, so a share cannot reference a records row and the shares
   table is created without a foreign key to records. */
async function createSchema(tx, { tripsInVault = false } = {}) {
  await tx.script(`
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,profile TEXT NOT NULL DEFAULT '{}');
    CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS hexclave_identities(hexclave_user_id TEXT PRIMARY KEY,user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,email TEXT NOT NULL,name TEXT NOT NULL,email_verified INTEGER NOT NULL DEFAULT 0,restricted INTEGER NOT NULL DEFAULT 0,updated TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL,data TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,updated TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS records_owner ON records(user_id,kind);
    CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),trip_id TEXT NOT NULL,status TEXT NOT NULL,stage TEXT NOT NULL,result TEXT,error TEXT,created TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS jobs_owner ON jobs(user_id,trip_id);
    CREATE TABLE IF NOT EXISTS shares(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),trip_id TEXT NOT NULL${tripsInVault ? '' : ' REFERENCES records(id) ON DELETE CASCADE'},expires BIGINT NOT NULL,created TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS shares_trip_owner ON shares(user_id,trip_id);
    CREATE TABLE IF NOT EXISTS trip_share_events(id TEXT PRIMARY KEY,token_hash TEXT NOT NULL,event_type TEXT NOT NULL CHECK(event_type IN ('trip_share_link_created','trip_share_whatsapp_clicked','trip_share_link_opened','trip_share_preview_bot','trip_share_friend_response')),created TEXT NOT NULL);
    ALTER TABLE trip_share_events DROP CONSTRAINT IF EXISTS trip_share_events_event_type_check;
    ALTER TABLE trip_share_events ADD CONSTRAINT trip_share_events_event_type_check CHECK(event_type IN ('trip_share_link_created','trip_share_whatsapp_clicked','trip_share_link_opened','trip_share_preview_bot','trip_share_friend_response'));
    CREATE INDEX IF NOT EXISTS trip_share_events_type_created ON trip_share_events(event_type,created);
    CREATE TABLE IF NOT EXISTS trip_feedback(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,trip_id TEXT NOT NULL,stop_key TEXT NOT NULL,viewer_hash TEXT NOT NULL,viewer_name TEXT NOT NULL DEFAULT '',kind TEXT NOT NULL CHECK(kind IN ('reaction','comment')),value TEXT NOT NULL,created TEXT NOT NULL,hidden INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS trip_feedback_trip ON trip_feedback(owner_id,trip_id,created);
    CREATE UNIQUE INDEX IF NOT EXISTS trip_feedback_one_reaction ON trip_feedback(owner_id,trip_id,stop_key,viewer_hash) WHERE kind='reaction';
    CREATE TABLE IF NOT EXISTS trip_share_participants(token_hash TEXT NOT NULL REFERENCES shares(token_hash) ON DELETE CASCADE,participant_id TEXT NOT NULL,name TEXT NOT NULL,can_make_dates TEXT NOT NULL DEFAULT 'unsure' CHECK(can_make_dates IN ('yes','no','unsure')),created TEXT NOT NULL,updated TEXT NOT NULL,PRIMARY KEY(token_hash,participant_id));
    CREATE TABLE IF NOT EXISTS trip_share_responses(token_hash TEXT NOT NULL,participant_id TEXT NOT NULL,day_index INTEGER NOT NULL,stop_index INTEGER NOT NULL DEFAULT -1,reaction TEXT,note TEXT NOT NULL DEFAULT '',updated TEXT NOT NULL,PRIMARY KEY(token_hash,participant_id,day_index,stop_index),FOREIGN KEY(token_hash,participant_id) REFERENCES trip_share_participants(token_hash,participant_id) ON DELETE CASCADE);
    CREATE INDEX IF NOT EXISTS trip_share_responses_share_day ON trip_share_responses(token_hash,day_index,updated);
    CREATE TABLE IF NOT EXISTS enquiries(id TEXT PRIMARY KEY,kind TEXT NOT NULL,data TEXT NOT NULL,created TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS email_outbox(id TEXT PRIMARY KEY,dedupe_key TEXT NOT NULL UNIQUE,kind TEXT NOT NULL,recipient TEXT NOT NULL,subject TEXT NOT NULL,content TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('queued','sending','provider_accepted','delivery_unknown','blocked')),attempted_at TEXT,created TEXT NOT NULL,updated TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS email_outbox_status ON email_outbox(status,created);
    CREATE TABLE IF NOT EXISTS newsletter_subscribers(email TEXT PRIMARY KEY,consent_at TEXT NOT NULL,source TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('subscribed','unsubscribed')),created TEXT NOT NULL,updated TEXT NOT NULL,unsubscribed_at TEXT);
    CREATE TABLE IF NOT EXISTS itineraries(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE SET NULL,created TEXT NOT NULL,request TEXT NOT NULL,provider TEXT NOT NULL,plan TEXT NOT NULL,fallback_reason TEXT);
    CREATE INDEX IF NOT EXISTS itineraries_owner ON itineraries(user_id);
    CREATE TABLE IF NOT EXISTS ai_conversation_events(event_key TEXT NOT NULL,owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,conversation_id TEXT NOT NULL,trip_id TEXT,event_type TEXT NOT NULL,role TEXT,content TEXT NOT NULL,status TEXT NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL,PRIMARY KEY(owner_id,conversation_id,event_key));
    CREATE INDEX IF NOT EXISTS ai_conversations_owner ON ai_conversation_events(owner_id,conversation_id,created);
    CREATE INDEX IF NOT EXISTS ai_conversations_review ON ai_conversation_events(created DESC);
    CREATE TABLE IF NOT EXISTS villas(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),status TEXT NOT NULL CHECK(status IN ('draft','published')),data TEXT NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS villas_status ON villas(status,updated DESC);
    CREATE INDEX IF NOT EXISTS villas_owner ON villas(owner_id,updated DESC);
    CREATE TABLE IF NOT EXISTS villa_submissions(id TEXT PRIMARY KEY,status TEXT NOT NULL CHECK(status IN ('new','reviewed','rejected')),data TEXT NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS villa_submissions_status ON villa_submissions(status,created DESC);
    CREATE TABLE IF NOT EXISTS friday_drafts(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,version INTEGER NOT NULL,data TEXT NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS friday_drafts_owner ON friday_drafts(owner_id,updated DESC);
    CREATE TABLE IF NOT EXISTS friday_handoffs(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,draft_id TEXT NOT NULL,version INTEGER NOT NULL,snapshot TEXT NOT NULL,status TEXT NOT NULL,created TEXT NOT NULL,UNIQUE(owner_id,draft_id,version));
    CREATE INDEX IF NOT EXISTS friday_handoffs_owner ON friday_handoffs(owner_id,created DESC);
    CREATE TABLE IF NOT EXISTS callback_requests(id TEXT PRIMARY KEY,name TEXT NOT NULL,phone TEXT NOT NULL,best_time TEXT NOT NULL,entry_point TEXT NOT NULL,trip_id TEXT,status TEXT NOT NULL DEFAULT 'new',created TEXT NOT NULL,topic TEXT,villa_id TEXT,villa_name TEXT,villa_city TEXT,villa_guests INTEGER,"from" TEXT,owner_id TEXT,trip_context TEXT);
    ALTER TABLE callback_requests ADD COLUMN IF NOT EXISTS villa_id TEXT;
    ALTER TABLE callback_requests ADD COLUMN IF NOT EXISTS villa_name TEXT;
    ALTER TABLE callback_requests ADD COLUMN IF NOT EXISTS villa_city TEXT;
    ALTER TABLE callback_requests ADD COLUMN IF NOT EXISTS villa_guests INTEGER;
    ALTER TABLE callback_requests ADD COLUMN IF NOT EXISTS "from" TEXT;
    ALTER TABLE callback_requests ADD COLUMN IF NOT EXISTS owner_id TEXT;
    ALTER TABLE callback_requests ADD COLUMN IF NOT EXISTS trip_context TEXT;
    CREATE INDEX IF NOT EXISTS callback_requests_created ON callback_requests(created DESC);
    CREATE INDEX IF NOT EXISTS callback_requests_owner_trip ON callback_requests(owner_id,trip_id,created DESC);
    CREATE INDEX IF NOT EXISTS callback_requests_owner ON callback_requests(owner_id,created DESC);
    ALTER TABLE callback_requests ADD COLUMN IF NOT EXISTS topic TEXT;   -- optional booking question ("Ask designer about this"); added after the first release
    CREATE TABLE IF NOT EXISTS data_requests(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,requester_email TEXT NOT NULL,request_type TEXT NOT NULL CHECK(request_type IN ('deletion')),status TEXT NOT NULL CHECK(status IN ('requested','account_deletion_pending','completed')),created TEXT NOT NULL,due_at TEXT NOT NULL,completed_at TEXT);
    CREATE TABLE IF NOT EXISTS friday_quotes(id TEXT PRIMARY KEY,handoff_id TEXT NOT NULL UNIQUE REFERENCES friday_handoffs(id),owner_id TEXT NOT NULL REFERENCES users(id),customer_email TEXT NOT NULL,snapshot TEXT NOT NULL,status TEXT NOT NULL,quote TEXT,attempted_at TEXT,created TEXT NOT NULL,first_reply_at TEXT);
    ALTER TABLE friday_quotes ADD COLUMN IF NOT EXISTS first_reply_at TEXT;
    CREATE TABLE IF NOT EXISTS trip_forward_addresses(token TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,trip_id TEXT NOT NULL,created TEXT NOT NULL,UNIQUE(owner_id,trip_id));
    CREATE TABLE IF NOT EXISTS reel_chats(owner_id TEXT NOT NULL,conversation_id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(owner_id,conversation_id));
    CREATE TABLE IF NOT EXISTS google_connections(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,kind TEXT NOT NULL CHECK(kind IN ('gmail','calendar')),refresh_token TEXT NOT NULL,scopes TEXT NOT NULL,connected_at TEXT NOT NULL,PRIMARY KEY(user_id,kind));
    CREATE TABLE IF NOT EXISTS google_oauth_states(state_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,kind TEXT NOT NULL,verifier TEXT NOT NULL,expires BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS guide_feedback(slug TEXT NOT NULL,viewer_hash TEXT NOT NULL,vote TEXT NOT NULL CHECK(vote IN ('yes','no')),note TEXT NOT NULL DEFAULT '',created TEXT NOT NULL,updated TEXT NOT NULL,PRIMARY KEY(slug,viewer_hash));
    CREATE INDEX IF NOT EXISTS guide_feedback_updated ON guide_feedback(updated);
    CREATE TABLE IF NOT EXISTS guide_digest_runs(run_date TEXT NOT NULL,mode TEXT NOT NULL,requested_mode TEXT NOT NULL,started TEXT NOT NULL,finished TEXT,note TEXT NOT NULL DEFAULT '',votes INTEGER NOT NULL DEFAULT 0,outcome TEXT NOT NULL DEFAULT '',PRIMARY KEY(run_date,mode));
    CREATE TABLE IF NOT EXISTS quote_digest_runs(run_date TEXT NOT NULL,mode TEXT NOT NULL,requested_mode TEXT NOT NULL,started TEXT NOT NULL,finished TEXT,note TEXT NOT NULL DEFAULT '',callbacks INTEGER NOT NULL DEFAULT 0,quotes INTEGER NOT NULL DEFAULT 0,outcome TEXT NOT NULL DEFAULT '',PRIMARY KEY(run_date,mode));
    CREATE TABLE IF NOT EXISTS callback_checklists(callback_id TEXT PRIMARY KEY,owner_id TEXT,token_hash TEXT NOT NULL,answers TEXT NOT NULL DEFAULT '{}',updated TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS briefing_runs(run_date TEXT NOT NULL,mode TEXT NOT NULL,requested_mode TEXT NOT NULL,started TEXT NOT NULL,finished TEXT,note TEXT NOT NULL DEFAULT '',selected INTEGER NOT NULL DEFAULT 0,would_send INTEGER NOT NULL DEFAULT 0,sent INTEGER NOT NULL DEFAULT 0,skipped INTEGER NOT NULL DEFAULT 0,failed INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(run_date,mode));
    CREATE TABLE IF NOT EXISTS briefing_run_items(id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,run_date TEXT NOT NULL,mode TEXT NOT NULL,trip_id TEXT NOT NULL,user_id TEXT NOT NULL,departure_date TEXT NOT NULL,days_before INTEGER NOT NULL,outcome TEXT NOT NULL CHECK(outcome IN ('would_send','sent','skipped_already_sent','skipped_no_email','failed')),created TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS briefing_run_items_run ON briefing_run_items(run_date,mode);`);
}

/* Opens the app database (PostgreSQL, or PGlite locally and in tests) and creates the schema. Options are those of openDatabase
   in db.mjs plus `tripsInVault`. Returns at once; every query waits for the connection and the schema. */
export function openStore({ tripsInVault = false, ...options } = {}) {
  return openDatabase({ ...options, memoryTemplate: tripsInVault ? 'schema-vault' : 'schema', init: tx => createSchema(tx, { tripsInVault }) });
}

/* Generated itineraries (POST /api/itineraries). Enforced-auth requests always retain their owner id;
   reads in enforced mode match both the itinerary id and signed-in owner. */
export const ITINERARY_ID = /^it_[a-f0-9]{16}$/;
export async function saveItinerary(db, rec, userId = null) {
  if (!ITINERARY_ID.test(rec.id)) throw new Error('invalid itinerary id');
  await db.query('INSERT INTO itineraries(id,user_id,created,request,provider,plan,fallback_reason) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [rec.id, userId, rec.createdAt, JSON.stringify(rec.request), rec.provider, JSON.stringify(rec.plan), rec.fallbackReason || null]);
  return rec;
}
export async function getItinerary(db, id, userId) {
  if (typeof id !== 'string' || !ITINERARY_ID.test(id)) return null;
  const r = userId === undefined
    ? await db.one('SELECT * FROM itineraries WHERE id=$1', [id])
    : await db.one('SELECT * FROM itineraries WHERE id=$1 AND user_id=$2', [id, userId]);
  if (!r) return null;
  const rec = { id: r.id, createdAt: r.created, request: JSON.parse(r.request), provider: r.provider, plan: JSON.parse(r.plan) };
  if (r.fallback_reason) rec.fallbackReason = r.fallback_reason;
  return rec;
}

/* ======================================================================================================================
   Everything below is the whole of the app's SQL. Routes and integrations call these named (async) functions with the db handle
   from openStore and never write SQL themselves. Functions that returned a row count keep returning it as a number, or as
   { changes } where they used to return a statement result.
   ====================================================================================================================== */

export const closeStore = db => db.close();
const changes = result => result.rowCount;

/* ---- owner-scoped trip chat audit trail ---- */
export const upsertAiConversationEvent = async (db, row) => { await db.query(`INSERT INTO ai_conversation_events(event_key,owner_id,conversation_id,trip_id,event_type,role,content,status,created,updated)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(owner_id,conversation_id,event_key) DO UPDATE SET trip_id=excluded.trip_id,event_type=excluded.event_type,role=excluded.role,content=excluded.content,status=excluded.status,updated=excluded.updated`,
  [row.eventKey,row.ownerId,row.conversationId,row.tripId||null,row.eventType,row.role||null,row.content,row.status,row.created,row.updated]); };
export const updateAiConversationEvent = async (db, row) => changes(await db.query('UPDATE ai_conversation_events SET content=$1,status=$2,updated=$3 WHERE owner_id=$4 AND conversation_id=$5 AND event_key=$6',
  [row.content,row.status,row.updated,row.ownerId,row.conversationId,row.eventKey]));
export const listOwnerAiConversationEvents = (db, ownerId) => db.all('SELECT event_key,owner_id,conversation_id,trip_id,event_type,role,content,status,created,updated FROM ai_conversation_events WHERE owner_id=$1 ORDER BY created,event_key',[ownerId]);
export const listAiConversationEvents = (db, { ownerId, conversationId, limit=500, before }={}) => {
  const requested=limit==null||limit===''?500:Number(limit),safeLimit=Number.isFinite(requested)?Math.max(1,Math.min(2000,Math.trunc(requested))):500;
  const clauses=[],params=[],p=value=>{params.push(value);return `$${params.length}`;};
  if(ownerId)clauses.push(`owner_id=${p(ownerId)}`);
  if(conversationId)clauses.push(`conversation_id=${p(conversationId)}`);
  if(before)clauses.push(`(created<${p(before.created)} OR (created=${p(before.created)} AND owner_id<${p(before.ownerId)}) OR (created=${p(before.created)} AND owner_id=${p(before.ownerId)} AND conversation_id<${p(before.conversationId)}) OR (created=${p(before.created)} AND owner_id=${p(before.ownerId)} AND conversation_id=${p(before.conversationId)} AND event_key<${p(before.eventKey)}))`);
  return db.all(`SELECT event_key,owner_id,conversation_id,trip_id,event_type,role,content,status,created,updated FROM ai_conversation_events${clauses.length?' WHERE '+clauses.join(' AND '):''} ORDER BY created DESC,owner_id DESC,conversation_id DESC,event_key DESC LIMIT ${p(safeLimit)}`,params);
};

/* ---- Friday assisted planning workflow ---- */
export const getFridayDraft = (db,id,owner) => db.one('SELECT * FROM friday_drafts WHERE id=$1 AND owner_id=$2',[id,owner]);
export const listFridayDrafts = (db,owner) => db.all('SELECT * FROM friday_drafts WHERE owner_id=$1 ORDER BY updated DESC',[owner]);
export const insertFridayDraft = async (db,row) => { await db.query('INSERT INTO friday_drafts(id,owner_id,version,data,created,updated) VALUES($1,$2,$3,$4,$5,$6)',[row.id,row.ownerId,row.version,row.data,row.created,row.updated]); };
export const updateFridayDraft = async (db,row) => changes(await db.query('UPDATE friday_drafts SET version=$1,data=$2,updated=$3 WHERE id=$4 AND owner_id=$5 AND version=$6',[row.version,row.data,row.updated,row.id,row.ownerId,row.expectedVersion]));
export const insertFridayHandoff = async (db,row) => { await db.query('INSERT INTO friday_handoffs(id,owner_id,draft_id,version,snapshot,status,created) VALUES($1,$2,$3,$4,$5,$6,$7)',[row.id,row.ownerId,row.draftId,row.version,row.snapshot,row.status,row.created]); };
export const createFridayHandoffWithQuote = (db,handoff,quote) => db.transaction(async tx => { await insertFridayHandoff(tx,handoff); await insertFridayQuote(tx,quote); return true; });
export const listFridayHandoffs = (db,owner) => db.all('SELECT id,draft_id,version,snapshot,status,created FROM friday_handoffs WHERE owner_id=$1 ORDER BY created DESC',[owner]);
export const listFridayQuotes = db => db.all("SELECT id,handoff_id,customer_email,snapshot,status,quote,attempted_at,created,first_reply_at FROM friday_quotes ORDER BY CASE WHEN status='pending' AND first_reply_at IS NULL THEN 0 ELSE 1 END,created ASC");
export const markFridayQuoteReplied = async (db,id,repliedAt) => changes(await db.query("UPDATE friday_quotes SET first_reply_at=$1 WHERE id=$2 AND status='pending' AND first_reply_at IS NULL",[repliedAt,id]));
export const createCallbackRequest = async (db, row) => { await db.query('INSERT INTO callback_requests(id,name,phone,best_time,entry_point,trip_id,status,created,topic,villa_id,villa_name,villa_city,villa_guests,"from",owner_id,trip_context) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)',[row.id,row.name,row.phone,row.bestTime,row.entryPoint,row.tripId||null,row.status||'new',row.created,row.topic||null,row.villaId||null,row.villaName||null,row.villaCity||null,row.villaGuests??null,row.from||null,row.ownerId||null,row.tripContext?JSON.stringify(row.tripContext):null]); };
export const listCallbackRequestsForTrip = (db, ownerId, tripId) => db.all('SELECT id,status,created FROM callback_requests WHERE owner_id=$1 AND trip_id=$2 ORDER BY created DESC',[ownerId,tripId]);
export const setCallbackStatus = async (db, id, status) => changes(await db.query('UPDATE callback_requests SET status=$1 WHERE id=$2',[status,id]));
export const listCallbackRequests = db => db.all('SELECT id,name,phone,best_time,entry_point,trip_id,status,created,topic,villa_id,villa_name,villa_city,villa_guests,"from",trip_context FROM callback_requests ORDER BY created DESC');
export const listOwnerFridayQuotes = (db,owner) => db.all('SELECT id,handoff_id,customer_email,snapshot,status,quote,attempted_at,created FROM friday_quotes WHERE owner_id=$1 ORDER BY created DESC',[owner]);
export const listOwnerReelChats = (db,owner) => db.all('SELECT conversation_id,data FROM reel_chats WHERE owner_id=$1 ORDER BY conversation_id',[owner]);
/** Owner ids of travellers who attached this trip to a callback request or a quote request: the only trips an admin may open. */
export const listTripSharers = async (db, tripId) => {
  const owners = new Set();
  for (const row of await db.all('SELECT DISTINCT owner_id FROM callback_requests WHERE trip_id=$1 AND owner_id IS NOT NULL', [tripId])) owners.add(row.owner_id);
  for (const row of await db.all('SELECT owner_id,snapshot FROM friday_quotes')) {
    let snap = {}; try { snap = JSON.parse(row.snapshot) || {}; } catch { /* ignore */ }
    if (snap.tripId === tripId) owners.add(row.owner_id);
  }
  return [...owners];
};
export const listOwnedCallbackRequests = (db, ownerId) => db.all('SELECT id,name,phone,best_time,entry_point,trip_id,status,created FROM callback_requests WHERE owner_id=$1 ORDER BY created DESC',[ownerId]);
export const createDataRequest = async (db, row) => { await db.query("INSERT INTO data_requests(id,owner_id,requester_email,request_type,status,created,due_at) VALUES($1,$2,$3,'deletion','requested',$4,$5)",[row.id,row.ownerId,row.email,row.created,row.dueAt]); };
export const listDataRequests = db => db.all('SELECT id,owner_id,requester_email,request_type,status,created,due_at,completed_at FROM data_requests ORDER BY created DESC');
export const listOwnerDataRequests = (db, ownerId) => db.all('SELECT id,request_type,status,created,due_at,completed_at FROM data_requests WHERE owner_id=$1 ORDER BY created DESC',[ownerId]);
export const getDataRequest = (db, id) => db.one('SELECT id,owner_id,requester_email,request_type,status,created,due_at,completed_at FROM data_requests WHERE id=$1',[id]);
export const updateDataRequestStatus = async (db,id,status,completedAt=null) => changes(await db.query('UPDATE data_requests SET status=$1,completed_at=$2 WHERE id=$3',[status,completedAt,id]));
export const anonymizeDataRequest = async (db,id,completedAt) => changes(await db.query("UPDATE data_requests SET status='completed',completed_at=$1,owner_id='deleted:'||id,requester_email='deleted' WHERE id=$2",[completedAt,id]));
export const listAllOwnerRecords = (db, ownerId) => db.all('SELECT id,kind,data,version,updated FROM records WHERE user_id=$1 ORDER BY kind,updated DESC',[ownerId]);
export const listOwnerShares = (db, ownerId) => db.all('SELECT trip_id,expires,created FROM shares WHERE user_id=$1 ORDER BY created DESC',[ownerId]);
export const listOwnerShareActivity = (db, ownerId) => db.all('SELECT s.trip_id,e.event_type,e.created FROM shares s JOIN trip_share_events e ON e.token_hash=s.token_hash WHERE s.user_id=$1 ORDER BY e.created DESC',[ownerId]);
export const listOwnerTripFeedback = (db, ownerId) => db.all('SELECT trip_id,stop_key,viewer_name,kind,value,created,hidden FROM trip_feedback WHERE owner_id=$1 ORDER BY trip_id,created',[ownerId]);
export const listOwnerFriendResponses = async (db, ownerId) => {
  const tables = await db.one("SELECT to_regclass('trip_share_participants') AS participants, to_regclass('trip_share_responses') AS responses");
  if (!tables?.participants || !tables?.responses) return [];
  const rows = await db.all(`SELECT s.trip_id,s.created AS share_created,p.participant_id,p.name,p.can_make_dates,
      r.day_index,r.stop_index,r.reaction,r.note,r.updated
    FROM shares s JOIN trip_share_participants p ON p.token_hash=s.token_hash
    LEFT JOIN trip_share_responses r ON r.token_hash=p.token_hash AND r.participant_id=p.participant_id
    WHERE s.user_id=$1 ORDER BY s.trip_id,s.created,p.participant_id,r.day_index,r.stop_index`,[ownerId]);
  const groups = new Map();
  for (const row of rows) {
    const key = [row.trip_id,row.share_created,row.participant_id].join('\\0');
    let friend = groups.get(key);
    if (!friend) {
      friend = {tripId:row.trip_id,shareCreatedAt:row.share_created,friend:{name:row.name,canMakeDates:row.can_make_dates},responses:[]};
      groups.set(key,friend);
    }
    if (row.day_index !== null) friend.responses.push({dayIndex:Number(row.day_index),stopIndex:Number(row.stop_index),reaction:row.reaction,note:row.note,updated:row.updated});
  }
  return [...groups.values()];
};
export const listOwnerEnquiries = (db, email) => db.all("SELECT id,kind,data,created FROM enquiries WHERE lower(data::jsonb->>'email')=lower($1) ORDER BY created DESC",[email]);
export const listOwnerItineraries = (db, ownerId) => db.all('SELECT id,created,request,provider,plan,fallback_reason FROM itineraries WHERE user_id=$1 ORDER BY created DESC',[ownerId]);
export const listOwnerJobs = (db, ownerId) => db.all('SELECT id,trip_id,status,stage,result,created FROM jobs WHERE user_id=$1 ORDER BY created DESC',[ownerId]);
export const getHexclaveUserId = (db, ownerId) => db.one('SELECT hexclave_user_id FROM hexclave_identities WHERE user_id=$1',[ownerId]);
export const deleteFridayAccountData = async (db, ownerId, email) => db.transaction(async tx => {
  await tx.query('DELETE FROM trip_feedback WHERE owner_id=$1',[ownerId]);
  const friendTables = await tx.one("SELECT to_regclass('trip_share_participants') AS participants, to_regclass('trip_share_responses') AS responses");
  if (friendTables?.responses) await tx.query('DELETE FROM trip_share_responses WHERE token_hash IN (SELECT token_hash FROM shares WHERE user_id=$1)',[ownerId]);
  if (friendTables?.participants) await tx.query('DELETE FROM trip_share_participants WHERE token_hash IN (SELECT token_hash FROM shares WHERE user_id=$1)',[ownerId]);
  await tx.query('DELETE FROM trip_share_events WHERE token_hash IN (SELECT token_hash FROM shares WHERE user_id=$1)',[ownerId]);
  await tx.query('DELETE FROM shares WHERE user_id=$1',[ownerId]);
  await tx.query('DELETE FROM friday_quotes WHERE owner_id=$1',[ownerId]);
  await tx.query('DELETE FROM friday_handoffs WHERE owner_id=$1',[ownerId]);
  await tx.query('DELETE FROM friday_drafts WHERE owner_id=$1',[ownerId]);
  await tx.query('DELETE FROM ai_conversation_events WHERE owner_id=$1',[ownerId]);
  await tx.query('DELETE FROM reel_chats WHERE owner_id=$1',[ownerId]);
  await tx.query('DELETE FROM jobs WHERE user_id=$1',[ownerId]);
  await tx.query('DELETE FROM itineraries WHERE user_id=$1',[ownerId]);
  await tx.query('DELETE FROM callback_requests WHERE owner_id=$1',[ownerId]);
  await tx.query('DELETE FROM callback_checklists WHERE owner_id=$1',[ownerId]);
  await tx.query('DELETE FROM briefing_run_items WHERE user_id=$1',[ownerId]);
  await tx.query('DELETE FROM google_connections WHERE user_id=$1',[ownerId]);
  await tx.query('DELETE FROM google_oauth_states WHERE user_id=$1',[ownerId]);
  await tx.query('DELETE FROM records WHERE user_id=$1',[ownerId]);
  await tx.query('DELETE FROM email_outbox WHERE lower(recipient)=lower($1)',[email]);
  await tx.query('DELETE FROM newsletter_subscribers WHERE lower(email)=lower($1)',[email]);
  await tx.query("DELETE FROM enquiries WHERE lower(data::jsonb->>'email')=lower($1)",[email]);
  return true;
});
export const deleteLocalAccount = async (db, ownerId) => db.transaction(async tx => {
  await tx.query('DELETE FROM sessions WHERE user_id=$1',[ownerId]);
  await tx.query('DELETE FROM hexclave_identities WHERE user_id=$1',[ownerId]);
  await tx.query('DELETE FROM users WHERE id=$1',[ownerId]);
});
export const getFridayQuote = (db,id) => db.one('SELECT * FROM friday_quotes WHERE id=$1',[id]);
export const insertFridayQuote = async (db,row) => { await db.query('INSERT INTO friday_quotes(id,handoff_id,owner_id,customer_email,snapshot,status,created) VALUES($1,$2,$3,$4,$5,$6,$7)',[row.id,row.handoffId,row.ownerId,row.customerEmail,row.snapshot,row.status,row.created]); };
export const claimFridayQuote = async (db,id,quote,attempted) => changes(await db.query("UPDATE friday_quotes SET status='sending',quote=$1,attempted_at=$2 WHERE id=$3 AND status='pending'",[quote,attempted,id]));
export const setFridayQuoteStatus = (db,id,status) => db.transaction(async tx => {
  await tx.query("UPDATE friday_quotes SET status=$1 WHERE id=$2 AND status='sending'",[status,id]);
  await tx.query('UPDATE friday_handoffs SET status=$1 WHERE id=(SELECT handoff_id FROM friday_quotes WHERE id=$2)',[status,id]);
  return true;
});

/* ---- villas and private owner-submission inbox ---- */
const villaFromRow = r => r && ({ id:r.id, ownerId:r.owner_id, status:r.status, data:r.data, created:r.created, updated:r.updated });
const submissionFromRow = r => r && ({ id:r.id, status:r.status, data:r.data, created:r.created, updated:r.updated });
export const insertVilla = async (db, { id, ownerId, status, data, created, updated }) => { await db.query('INSERT INTO villas(id,owner_id,status,data,created,updated) VALUES($1,$2,$3,$4,$5,$6)',[id,ownerId,status,data,created,updated]); };
export const getVilla = async (db, id) => villaFromRow(await db.one('SELECT * FROM villas WHERE id=$1',[id]));
export const getPublishedVilla = async (db, id) => villaFromRow(await db.one("SELECT * FROM villas WHERE id=$1 AND status='published'",[id]));
export const listPublishedVillas = async db => (await db.all("SELECT * FROM villas WHERE status='published' ORDER BY updated DESC")).map(villaFromRow);
export const listVillasByOwner = async (db, ownerId) => (await db.all('SELECT * FROM villas WHERE owner_id=$1 ORDER BY updated DESC',[ownerId])).map(villaFromRow);
export const updateVilla = async (db, { id, ownerId, status, data, updated }) => changes(await db.query('UPDATE villas SET status=$1,data=$2,updated=$3 WHERE id=$4 AND owner_id=$5',[status,data,updated,id,ownerId]));
export const deleteVilla = async (db, id, ownerId) => changes(await db.query('DELETE FROM villas WHERE id=$1 AND owner_id=$2',[id,ownerId]));
export const insertVillaSubmission = async (db, { id, status='new', data, created, updated }) => { await db.query('INSERT INTO villa_submissions(id,status,data,created,updated) VALUES($1,$2,$3,$4,$5)',[id,status,data,created,updated]); };
export const listVillaSubmissions = async db => (await db.all('SELECT * FROM villa_submissions ORDER BY created DESC')).map(submissionFromRow);
export const getVillaSubmission = async (db, id) => submissionFromRow(await db.one('SELECT * FROM villa_submissions WHERE id=$1',[id]));
export const updateVillaSubmissionStatus = async (db, id, status, updated) => changes(await db.query('UPDATE villa_submissions SET status=$1,updated=$2 WHERE id=$3',[status,updated,id]));

/* ---- users and sessions ---- */
export const createUser = async (db, { id, email, name, password }) => { await db.query('INSERT INTO users(id,email,name,password) VALUES($1,$2,$3,$4)',[id, email, name, password]); };   // throws when the email exists
export const findUserByEmail = (db, email) => db.one('SELECT * FROM users WHERE email=$1',[email]);
export const updateUserProfile = async (db, userId, profileJson) => { await db.query('UPDATE users SET profile=$1 WHERE id=$2',[profileJson, userId]); };
const hexclaveUserQuery = `SELECT users.*,hexclave_identities.email AS hexclave_email,hexclave_identities.name AS hexclave_name,hexclave_identities.email_verified AS hexclave_email_verified,hexclave_identities.restricted AS hexclave_restricted FROM users JOIN hexclave_identities ON hexclave_identities.user_id=users.id`;
export const findUserByHexclaveId = (db, hexclaveUserId) => db.one(`${hexclaveUserQuery} WHERE hexclave_identities.hexclave_user_id=$1`,[hexclaveUserId]);
export const findUnlinkedLegacyUserByEmail = (db, email) => db.one(`SELECT users.* FROM users WHERE lower(users.email)=lower($1) AND NOT EXISTS (SELECT 1 FROM hexclave_identities WHERE hexclave_identities.user_id=users.id)`,[email]);
export async function createHexclaveIdentity(db, { hexclaveUserId, userId, syntheticEmail, email, name, password, emailVerified, restricted, updated }) {
  await db.transaction(async tx => {
    await createUser(tx, { id:userId, email:syntheticEmail, name:name || email || 'Friday traveller', password });
    await tx.query('INSERT INTO hexclave_identities(hexclave_user_id,user_id,email,name,email_verified,restricted,updated) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [hexclaveUserId,userId,email,name || email || 'Friday traveller',emailVerified?1:0,restricted?1:0,updated]);
  });
  return findUserByHexclaveId(db, hexclaveUserId);
}
export const updateHexclaveIdentity = async (db, { hexclaveUserId, email, name, emailVerified, restricted, updated }) => changes(await db.query('UPDATE hexclave_identities SET email=$1,name=$2,email_verified=$3,restricted=$4,updated=$5 WHERE hexclave_user_id=$6',
  [email,name || email || 'Friday traveller',emailVerified?1:0,restricted?1:0,updated,hexclaveUserId]));
export const linkHexclaveIdentity = async (db, { hexclaveUserId, userId, email, name, emailVerified, restricted, updated }) => { await db.query('INSERT INTO hexclave_identities(hexclave_user_id,user_id,email,name,email_verified,restricted,updated) VALUES($1,$2,$3,$4,$5,$6,$7)',
  [hexclaveUserId,userId,email,name || email || 'Friday traveller',emailVerified?1:0,restricted?1:0,updated]); };
export const deleteExpiredSessions = async (db, now) => { await db.query('DELETE FROM sessions WHERE expires<$1',[now]); };
export const createSession = async (db, tokenHash, userId, expires) => { await db.query('INSERT INTO sessions(hash,user_id,expires) VALUES($1,$2,$3)',[tokenHash, userId, expires]); };
export const findUserBySession = (db, tokenHash, now) => db.one('SELECT users.* FROM users JOIN sessions ON users.id=sessions.user_id WHERE sessions.hash=$1 AND sessions.expires>$2',[tokenHash, now]);
export const deleteSession = async (db, tokenHash) => { await db.query('DELETE FROM sessions WHERE hash=$1',[tokenHash]); };

/* ---- forwarded-booking addresses: one unguessable token per owner and trip (see forward-booking.mjs) ---- */
export const forwardTokenFor = (db, ownerId, tripId) => db.one('SELECT token FROM trip_forward_addresses WHERE owner_id=$1 AND trip_id=$2',[ownerId, tripId]);
export const createForwardToken = async (db, { token, ownerId, tripId, created }) => { await db.query('INSERT INTO trip_forward_addresses(token,owner_id,trip_id,created) VALUES($1,$2,$3,$4) ON CONFLICT(owner_id,trip_id) DO NOTHING',[token, ownerId, tripId, created]); };
export const findForwardAddress = (db, token) => db.one('SELECT token,owner_id,trip_id FROM trip_forward_addresses WHERE token=$1',[token]);

/* ---- records (trips, places, lists, bookings, memories, alerts, imports) ---- */
export const findRecord = (db, id, userId, kind) => db.one('SELECT * FROM records WHERE id=$1 AND user_id=$2 AND kind=$3',[id, userId, kind]);
export const insertRecord = async (db, { id, userId, kind, data, updated }) => { await db.query('INSERT INTO records(id,user_id,kind,data,updated) VALUES($1,$2,$3,$4,$5)',[id, userId, kind, data, updated]); };
export const listRecords = (db, userId, kind) => db.all('SELECT * FROM records WHERE user_id=$1 AND kind=$2 ORDER BY updated DESC',[userId, kind]);
export const listRecordData = (db, userId, kind) => db.all('SELECT data FROM records WHERE user_id=$1 AND kind=$2',[userId, kind]);   // raw JSON strings, owner's only
export const listTripOwners = db => db.all(`SELECT users.id,COALESCE(hexclave_identities.email,users.email) AS email,COALESCE(hexclave_identities.name,users.name) AS name FROM users LEFT JOIN hexclave_identities ON hexclave_identities.user_id=users.id ORDER BY users.id`);
export const listAllTrips = db => db.all("SELECT * FROM records WHERE kind='trips' ORDER BY user_id,updated");   // every owner's trips: for the one-time copy to Hexclave only
export const findTripId = (db, id, userId) => db.one("SELECT id FROM records WHERE id=$1 AND user_id=$2 AND kind='trips'",[id, userId]);
/* Optimistic update: returns the number of rows changed (0 when the version moved on). */
export const updateRecordIfVersion = async (db, { id, userId, kind, data, updated, version }) => changes(await db.query('UPDATE records SET data=$1,version=version+1,updated=$2 WHERE id=$3 AND user_id=$4 AND kind=$5 AND version=$6',[data, updated, id, userId, kind, version]));
export const overwriteRecord = async (db, { id, userId, data, updated }) => ({ changes: changes(await db.query('UPDATE records SET data=$1,version=version+1,updated=$2 WHERE id=$3 AND user_id=$4',[data, updated, id, userId])) });
export const deleteRecord = async (db, id, userId, kind) => ({ changes: changes(await db.query('DELETE FROM records WHERE id=$1 AND user_id=$2 AND kind=$3',[id, userId, kind])) });

/* ---- research jobs ---- */
export const failInterruptedJobs = async db => { await db.query("UPDATE jobs SET status='failed',error='Research was interrupted by a server restart. Please try again.' WHERE status='running'"); };
export const createJob = async (db, { id, userId, tripId, stage, created }) => { await db.query('INSERT INTO jobs(id,user_id,trip_id,status,stage,created) VALUES($1,$2,$3,$4,$5,$6)',[id, userId, tripId, 'running', stage, created]); };
export const findJob = (db, id, userId) => db.one('SELECT * FROM jobs WHERE id=$1 AND user_id=$2',[id, userId]);
export const findLatestJobForTrip = (db, tripId, userId) => db.one('SELECT * FROM jobs WHERE trip_id=$1 AND user_id=$2 ORDER BY created DESC LIMIT 1',[tripId, userId]);
export const setJobStage = async (db, id, stage) => { await db.query('UPDATE jobs SET stage=$1 WHERE id=$2',[stage, id]); };
export const completeJob = async (db, id, resultJson) => { await db.query("UPDATE jobs SET status='completed',stage='Research complete',result=$1 WHERE id=$2",[resultJson, id]); };
export const failJob = async (db, id, error) => { await db.query("UPDATE jobs SET status='failed',error=$1 WHERE id=$2",[error, id]); };

/* ---- shared (read-only) trip links ---- */
export const findShare = (db, tokenHash) => db.one('SELECT shares.trip_id,shares.expires,records.data FROM shares JOIN records ON records.id=shares.trip_id AND records.user_id=shares.user_id AND records.kind=\'trips\' WHERE shares.token_hash=$1',[tokenHash]);
export const findShareLink = (db, tokenHash) => db.one('SELECT token_hash,user_id,trip_id,expires FROM shares WHERE token_hash=$1',[tokenHash]);   // no join: used when trips are not in the database
export const findLatestShareForTrip = (db, tripId, userId) => db.one('SELECT token_hash,user_id,trip_id,expires FROM shares WHERE trip_id=$1 AND user_id=$2 ORDER BY created DESC LIMIT 1',[tripId,userId]);
export const deleteShares = async (db, tripId, userId) => { await db.query('DELETE FROM shares WHERE trip_id=$1 AND user_id=$2',[tripId, userId]); };
export const createShare = async (db, { tokenHash, userId, tripId, expires, created }) => { await db.query('INSERT INTO shares(token_hash,user_id,trip_id,expires,created) VALUES($1,$2,$3,$4,$5)',[tokenHash, userId, tripId, expires, created]); };
export const recordTripShareEvent = async (db, { id, tokenHash, eventType, created }) => { await db.query('INSERT INTO trip_share_events(id,token_hash,event_type,created) VALUES($1,$2,$3,$4)',[id,tokenHash,eventType,created]); };
export const saveTripShareParticipant = async (db,{tokenHash,participantId,name,canMakeDates,created,updated}) => { await db.query(`INSERT INTO trip_share_participants(token_hash,participant_id,name,can_make_dates,created,updated) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(token_hash,participant_id) DO UPDATE SET name=excluded.name,can_make_dates=excluded.can_make_dates,updated=excluded.updated`,[tokenHash,participantId,name,canMakeDates,created,updated]); };
export const saveTripShareResponse = async (db,{tokenHash,participantId,dayIndex,stopIndex,reaction,note,hasReaction,hasNote,updated}) => { await db.query(`INSERT INTO trip_share_responses(token_hash,participant_id,day_index,stop_index,reaction,note,updated) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(token_hash,participant_id,day_index,stop_index) DO UPDATE SET reaction=CASE WHEN $8 THEN excluded.reaction ELSE trip_share_responses.reaction END,note=CASE WHEN $9 THEN excluded.note ELSE trip_share_responses.note END,updated=excluded.updated`,[tokenHash,participantId,dayIndex,stopIndex,reaction,note,updated,hasReaction,hasNote]); };
export const listTripShareResponses = (db,tokenHash) => db.all(`SELECT p.participant_id,p.name,p.can_make_dates,r.day_index,r.stop_index,r.reaction,r.note,r.updated FROM trip_share_responses r JOIN trip_share_participants p ON p.token_hash=r.token_hash AND p.participant_id=r.participant_id WHERE r.token_hash=$1 ORDER BY r.day_index,r.stop_index,p.name,r.updated DESC`,[tokenHash]);
export const countTripShareResponders = async (db,tokenHash) => { const row=await db.one('SELECT count(DISTINCT participant_id) AS n FROM trip_share_responses WHERE token_hash=$1',[tokenHash]);return Number(row?.n||0); };
export const clearTripShareResponses = async (db,tokenHash) => { await db.query('DELETE FROM trip_share_participants WHERE token_hash=$1',[tokenHash]); };

/* ---- commission and newsletter enquiries ---- */
export const saveEnquiry = async (db, { id, kind, data, created }) => { await db.query('INSERT INTO enquiries(id,kind,data,created) VALUES($1,$2,$3,$4)',[id, kind, data, created]); };
export const listEnquiries = (db, limit=500) => db.all('SELECT id,kind,data,created FROM enquiries ORDER BY created DESC,id DESC LIMIT $1',[Math.max(1,Math.min(2000,Math.trunc(Number(limit)||500)))]);
export const listNewsletterSubscribers = (db, limit=1000) => db.all('SELECT email,consent_at,source,status,created,updated,unsubscribed_at FROM newsletter_subscribers ORDER BY created DESC,email LIMIT $1',[Math.max(1,Math.min(5000,Math.trunc(Number(limit)||1000)))]);
// Admin-facing delivery state excludes message bodies and provider credentials.
export const listEmailOutboxMetadata = (db, limit=500) => db.all('SELECT id,kind,status,attempted_at,created,updated FROM email_outbox ORDER BY created DESC,id DESC LIMIT $1',[Math.max(1,Math.min(2000,Math.trunc(Number(limit)||500)))]);
export const createEmailOutbox = async (db, row) => ({ changes: changes(await db.query('INSERT INTO email_outbox(id,dedupe_key,kind,recipient,subject,content,status,created,updated) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING',
  [row.id,row.dedupeKey,row.kind,row.recipient,row.subject,row.content,row.status,row.created,row.updated])) });
export const getEmailOutboxByKey = (db, dedupeKey) => db.one('SELECT * FROM email_outbox WHERE dedupe_key=$1',[dedupeKey]);
export const setEmailOutboxRecipient = async (db, dedupeKey, recipient, updated) => changes(await db.query("UPDATE email_outbox SET recipient=$1,updated=$2 WHERE dedupe_key=$3 AND status IN ('queued','blocked') AND recipient=''",[recipient,updated,dedupeKey]));
export const claimEmailOutbox = async (db, dedupeKey, attemptedAt, includeBlocked=false) => changes(await db.query(`UPDATE email_outbox SET status='sending',attempted_at=$1,updated=$2 WHERE dedupe_key=$3 AND status IN (${includeBlocked?"'queued','blocked'":"'queued'"})`,[attemptedAt,attemptedAt,dedupeKey]));
export const listPendingEmailOutbox = (db, limit=100) => db.all("SELECT * FROM email_outbox WHERE status IN ('queued','blocked') ORDER BY created,id LIMIT $1",[Math.max(1,Math.min(1000,Math.trunc(Number(limit)||100)))]);
export const setEmailOutboxStatus = async (db, dedupeKey, status, updated) => changes(await db.query("UPDATE email_outbox SET status=$1,updated=$2 WHERE dedupe_key=$3 AND status='sending'",[status,updated,dedupeKey]));
export const markInterruptedEmailSendsUnknown = async (db, updated=new Date().toISOString()) => { await db.query("UPDATE email_outbox SET status='delivery_unknown',updated=$1 WHERE status='sending'",[updated]); };
export const upsertNewsletterSubscriber = async (db, { email, consentAt, source='website', created=consentAt }) => { await db.query(`INSERT INTO newsletter_subscribers(email,consent_at,source,status,created,updated)
  VALUES($1,$2,$3,'subscribed',$4,$5) ON CONFLICT(email) DO UPDATE SET consent_at=excluded.consent_at,source=excluded.source,status='subscribed',updated=excluded.updated,unsubscribed_at=NULL`,
  [email,consentAt,source,created,consentAt]); };
export const getNewsletterSubscriber = (db, email) => db.one('SELECT email,consent_at,source,status,created,updated,unsubscribed_at FROM newsletter_subscribers WHERE email=$1',[email]);
export const unsubscribeNewsletterSubscriber = async (db, email, unsubscribedAt = new Date().toISOString()) => changes(await db.query("UPDATE newsletter_subscribers SET status='unsubscribed',updated=$1,unsubscribed_at=$2 WHERE email=$3 AND status='subscribed'",[unsubscribedAt, unsubscribedAt, email]));

/* ---- Google connections (Gmail and Calendar read-only). Their tables are part of the schema created by openStore. ---- */
export const findGoogleRefreshToken = (db, userId, kind) => db.one('SELECT refresh_token FROM google_connections WHERE user_id=$1 AND kind=$2',[userId, kind]);
export const setGoogleRefreshToken = async (db, userId, kind, sealed) => { await db.query('UPDATE google_connections SET refresh_token=$1 WHERE user_id=$2 AND kind=$3',[sealed, userId, kind]); };
export const listGoogleConnections = (db, userId) => db.all('SELECT kind,scopes,connected_at FROM google_connections WHERE user_id=$1',[userId]);
export const listGoogleRefreshTokens = (db,userId) => db.all('SELECT kind,refresh_token FROM google_connections WHERE user_id=$1 ORDER BY kind',[userId]);
export const upsertGoogleConnection = async (db, { userId, kind, refreshToken, scopes, connectedAt }) => { await db.query('INSERT INTO google_connections(user_id,kind,refresh_token,scopes,connected_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,kind) DO UPDATE SET refresh_token=excluded.refresh_token,scopes=excluded.scopes,connected_at=excluded.connected_at',[userId, kind, refreshToken, scopes, connectedAt]); };
export const deleteGoogleConnection = async (db, userId, kind) => { await db.query('DELETE FROM google_connections WHERE user_id=$1 AND kind=$2',[userId, kind]); };
export const findGoogleOAuthState = (db, stateHash, userId, now) => db.one('SELECT * FROM google_oauth_states WHERE state_hash=$1 AND user_id=$2 AND expires>$3',[stateHash, userId, now]);
export const createGoogleOAuthState = async (db, { stateHash, userId, kind, verifier, expires }) => { await db.query('INSERT INTO google_oauth_states(state_hash,user_id,kind,verifier,expires) VALUES($1,$2,$3,$4,$5)',[stateHash, userId, kind, verifier, expires]); };
export const deleteGoogleOAuthState = async (db, stateHash) => { await db.query('DELETE FROM google_oauth_states WHERE state_hash=$1',[stateHash]); };
export const deleteExpiredGoogleOAuthStates = async (db, now) => { await db.query('DELETE FROM google_oauth_states WHERE expires<$1',[now]); };
export const deleteGoogleOAuthStatesFor = async (db, userId, kind) => { await db.query('DELETE FROM google_oauth_states WHERE user_id=$1 AND kind=$2',[userId, kind]); };

/* Automatic T-7 briefings: run log only. No recipient addresses or email bodies are stored here.
   The (run_date, mode) primary key plus ON CONFLICT DO NOTHING in startBriefingRun is what makes a run once-per-day. */
export async function startBriefingRun(db, { runDate, mode, requestedMode, started, note = '', replace = false }) {
  if (replace) {
    await db.query("DELETE FROM briefing_run_items WHERE run_date=$1 AND mode='dry-run'", [runDate]);
    await db.query("DELETE FROM briefing_runs WHERE run_date=$1 AND mode='dry-run'", [runDate]);
  }
  return changes(await db.query('INSERT INTO briefing_runs(run_date,mode,requested_mode,started,note) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [runDate, mode, requestedMode, started, note])) === 1;
}
export const insertBriefingRunItem = async (db, r) => { await db.query('INSERT INTO briefing_run_items(run_date,mode,trip_id,user_id,departure_date,days_before,outcome,created) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [r.runDate, r.mode, r.tripId, r.userId, r.departureDate, r.daysBefore, r.outcome, r.created]); };
export const finishBriefingRun = async (db, { runDate, mode, finished, counts }) => { await db.query('UPDATE briefing_runs SET finished=$1,selected=$2,would_send=$3,sent=$4,skipped=$5,failed=$6 WHERE run_date=$7 AND mode=$8', [finished, counts.selected, counts.would_send, counts.sent, counts.skipped_already_sent + counts.skipped_no_email, counts.failed, runDate, mode]); };
export const countCompletedBriefingDryRunDays = async db => Number((await db.one("SELECT COUNT(DISTINCT run_date) AS n FROM briefing_runs WHERE mode='dry-run' AND finished IS NOT NULL")).n);
export const listBriefingRuns = (db, limit = 14) => db.all('SELECT * FROM briefing_runs ORDER BY run_date DESC,started DESC LIMIT $1', [Math.min(Math.max(Number(limit) || 14, 1), 60)]);
export const listBriefingRunItems = (db, limit = 100) => db.all('SELECT * FROM briefing_run_items ORDER BY id DESC LIMIT $1', [Math.min(Math.max(Number(limit) || 100, 1), 300)]);
export const hasAcceptedAdminBriefing = async (db, tripId) => !!(await db.one("SELECT 1 AS x FROM email_outbox WHERE kind='pre_departure_briefing' AND status='provider_accepted' AND dedupe_key LIKE $1 ESCAPE '\\' LIMIT 1", [`briefing:${String(tripId).replace(/[\\%_]/g, '\\$&')}:%`]));
