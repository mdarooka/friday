import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { startApp, signUp } from './helpers.mjs';
import * as store from '../server/store.mjs';

const callback = (request, cookie, name) => request('/api/callbacks', 'POST', { name, phone: '9876543210', bestTime: 'morning', entryPoint: 'planner' }, { cookie });

async function ensureFriendResponseTables(db) {
  await db.script(`
    CREATE TABLE IF NOT EXISTS trip_share_participants(token_hash TEXT NOT NULL REFERENCES shares(token_hash) ON DELETE CASCADE,participant_id TEXT NOT NULL,name TEXT NOT NULL,can_make_dates TEXT NOT NULL DEFAULT 'unsure' CHECK(can_make_dates IN ('yes','no','unsure')),created TEXT NOT NULL,updated TEXT NOT NULL,PRIMARY KEY(token_hash,participant_id));
    CREATE TABLE IF NOT EXISTS trip_share_responses(token_hash TEXT NOT NULL,participant_id TEXT NOT NULL,day_index INTEGER NOT NULL,stop_index INTEGER NOT NULL DEFAULT -1,reaction TEXT,note TEXT NOT NULL DEFAULT '',updated TEXT NOT NULL,PRIMARY KEY(token_hash,participant_id,day_index,stop_index),FOREIGN KEY(token_hash,participant_id) REFERENCES trip_share_participants(token_hash,participant_id) ON DELETE CASCADE);
  `);
}

async function addFriendResponse(db, userId, tripId, participantId, name, note) {
  const share = await db.one('SELECT token_hash FROM shares WHERE user_id=$1 AND trip_id=$2 ORDER BY created DESC LIMIT 1',[userId,tripId]);
  assert.ok(share, 'test trip has a share link');
  const now = new Date().toISOString();
  await db.query('INSERT INTO trip_share_participants(token_hash,participant_id,name,can_make_dates,created,updated) VALUES($1,$2,$3,$4,$5,$6)',[share.token_hash,participantId,name,'yes',now,now]);
  await db.query('INSERT INTO trip_share_responses(token_hash,participant_id,day_index,stop_index,reaction,note,updated) VALUES($1,$2,$3,$4,$5,$6,$7)',[share.token_hash,participantId,0,-1,'in',note,now]);
}

test('data export is owner-scoped, includes account records and excludes integration secrets and live share tokens', async t => {
  const { request, db } = await startApp(t);
  const owner = await signUp(request, 'ExportOwner');
  const other = await signUp(request, 'ExportOther');
  const trip = await request('/api/trips', 'POST', { data: { title: 'Owner trip', destination: 'Kochi', days: [] } }, { cookie: owner.cookie });
  const otherTrip = await request('/api/trips', 'POST', { data: { title: 'Other trip', destination: 'Delhi', days: [] } }, { cookie: other.cookie });
  await request('/api/memories', 'POST', { data: { title: 'Quiet mornings', text: 'Private preference' } }, { cookie: owner.cookie });
  await request('/api/imports', 'POST', { data: { title: 'Imported booking', source: 'gmail', bookingReference: 'OWN-1' } }, { cookie: owner.cookie });
  await request('/api/imports', 'POST', { data: { title: 'Other imported booking' } }, { cookie: other.cookie });
  await callback(request, owner.cookie, 'Export Owner callback');
  await callback(request, other.cookie, 'Other callback');
  const conversation = await request('/api/ai-conversations/events', 'POST', { ownerId: owner.result.user.id, conversationId: 'thread_owner', eventId: 'event_owner', role: 'user', content: { text: 'My private planning note' } }, { cookie: owner.cookie });
  assert.equal(conversation.status, 200);
  await request('/api/ai-conversations/events', 'POST', { ownerId: other.result.user.id, conversationId: 'thread_other', eventId: 'event_other', role: 'user', content: { text: 'Do not export me' } }, { cookie: other.cookie });
  const share = await request('/api/trips/' + trip.result.record.id + '/share', 'POST', {}, { cookie: owner.cookie });
  assert.equal(share.status, 201);
  const otherShare = await request('/api/trips/' + otherTrip.result.record.id + '/share', 'POST', {}, { cookie: other.cookie });
  assert.equal(otherShare.status, 201);
  await ensureFriendResponseTables(db);
  await addFriendResponse(db, owner.result.user.id, trip.result.record.id, '10000000-0000-4000-8000-000000000001', 'Asha', 'I can join for lunch.');
  await addFriendResponse(db, other.result.user.id, otherTrip.result.record.id, '20000000-0000-4000-8000-000000000001', 'Private friend', 'Do not export their note.');
  await db.query('INSERT INTO google_connections(user_id,kind,refresh_token,scopes,connected_at) VALUES($1,$2,$3,$4,$5)', [owner.result.user.id, 'gmail', 'SECRET-GOOGLE-REFRESH-TOKEN', 'gmail.readonly', new Date().toISOString()]);
  await db.query('INSERT INTO google_connections(user_id,kind,refresh_token,scopes,connected_at) VALUES($1,$2,$3,$4,$5)', [other.result.user.id, 'gmail', 'OTHER-SECRET', 'gmail.readonly', new Date().toISOString()]);
  const now = new Date().toISOString();
  await db.query('INSERT INTO enquiries(id,kind,data,created) VALUES($1,$2,$3,$4)', [randomUUID(), 'contact', JSON.stringify({ name: 'Export Owner', email: 'exportowner@example.com', message: 'Owner contact request' }), now]);
  await db.query('INSERT INTO enquiries(id,kind,data,created) VALUES($1,$2,$3,$4)', [randomUUID(), 'contact', JSON.stringify({ name: 'Export Other', email: 'exportother@example.com', message: 'Do not export' }), now]);
  await db.query('INSERT INTO itineraries(id,user_id,created,request,provider,plan) VALUES($1,$2,$3,$4,$5,$6),($7,$8,$9,$10,$11,$12)', ['it_owner', owner.result.user.id, now, JSON.stringify({ destination: 'Kochi' }), 'test', JSON.stringify({ days: [] }), 'it_other', other.result.user.id, now, JSON.stringify({ destination: 'Delhi' }), 'test', JSON.stringify({ days: [] })]);
  await db.query('INSERT INTO jobs(id,user_id,trip_id,status,stage,result,created) VALUES($1,$2,$3,$4,$5,$6,$7),($8,$9,$10,$11,$12,$13,$14)', ['job_owner', owner.result.user.id, trip.result.record.id, 'completed', 'Research complete', JSON.stringify({ note: 'Owner research' }), now, 'job_other', other.result.user.id, otherTrip.result.record.id, 'completed', 'Research complete', JSON.stringify({ note: 'Do not export' }), now]);
  const handoffId = randomUUID(), quoteId = randomUUID();
  await store.insertFridayDraft(db, { id: randomUUID(), ownerId: owner.result.user.id, version: 1, data: JSON.stringify({ destination: 'Kochi' }), created: now, updated: now });
  await store.createFridayHandoffWithQuote(db, { id: handoffId, ownerId: owner.result.user.id, draftId: randomUUID(), version: 1, snapshot: JSON.stringify({ destination: 'Kochi' }), status: 'queued', created: now }, { id: quoteId, handoffId, ownerId: owner.result.user.id, customerEmail: 'ExportOwner@example.com', snapshot: JSON.stringify({ destination: 'Kochi' }), status: 'pending', created: now });

  const exported = await request('/api/account/export', 'GET', undefined, { cookie: owner.cookie });
  assert.equal(exported.status, 200);
  assert.match(exported.headers.get('content-disposition'), /attachment; filename="friday-data-/);
  const body = exported.result;
  assert.equal(body.format, 'friday-account-export');
  assert.equal(body.account.email, 'exportowner@example.com');
  assert.equal(body.trips.length, 1);
  assert.equal(body.trips[0].id, trip.result.record.id);
  assert.ok(body.records.some(row => row.kind === 'memories' && row.data.text === 'Private preference'));
  assert.ok(body.records.some(row => row.kind === 'imports' && row.data.bookingReference === 'OWN-1'));
  assert.equal(body.requests.callbacks.length, 1);
  assert.equal(body.requests.callbacks[0].name, 'Export Owner callback');
  assert.equal(body.requests.quotes.length, 1);
  assert.equal(body.requests.enquiries.length, 1);
  assert.equal(body.requests.enquiries[0].data.message, 'Owner contact request');
  assert.equal(body.planning.generatedItineraries.length, 1);
  assert.equal(body.planning.generatedItineraries[0].id, 'it_owner');
  assert.equal(body.planning.researchJobs.length, 1);
  assert.equal(body.planning.researchJobs[0].result.note, 'Owner research');
  assert.equal(body.shareActivity.length, 1);
  assert.equal(body.aiConversationEvents.length, 1);
  assert.equal(body.aiConversationEvents[0].content.includes('My private planning note'), true);
  assert.equal(body.shareLinks.length, 1);
  assert.equal(JSON.stringify(body).includes('token_hash'), false);
  assert.equal(JSON.stringify(body).includes('SECRET-GOOGLE-REFRESH-TOKEN'), false);
  assert.equal(JSON.stringify(body).includes('OTHER-SECRET'), false);
  assert.equal(JSON.stringify(body).includes(other.result.user.id), false);
  assert.equal(JSON.stringify(body).includes(otherTrip.result.record.id), false);
  assert.equal(JSON.stringify(body).includes('Do not export'), false);
  assert.equal(body.friendResponses.length, 1);
  assert.equal(body.friendResponses[0].tripId, trip.result.record.id);
  assert.equal(body.friendResponses[0].friend.name, 'Asha');
  assert.equal(body.friendResponses[0].friend.canMakeDates, 'yes');
  assert.equal(body.friendResponses[0].responses[0].note, 'I can join for lunch.');
  assert.equal(JSON.stringify(body).includes('Private friend'), false);
  assert.equal(JSON.stringify(body).includes('Do not export their note.'), false);
  assert.equal((await request('/api/account/export', 'GET', undefined, { cookie: other.cookie })).result.trips[0].id, otherTrip.result.record.id);
  assert.equal((await request('/api/account/export')).status, 401);
  assert.equal((await request('/api/account/export', 'GET', undefined, { cookie: owner.cookie })).status, 200);
  assert.equal((await request('/api/account/export', 'GET', undefined, { cookie: owner.cookie })).status, 429);
});

test('deletion request has a 30-day due date, is owner-private, and staff completion removes Friday data and account', async t => {
  const { request, db } = await startApp(t);
  const owner = await signUp(request, 'DeleteOwner');
  const other = await signUp(request, 'KeepOwner');
  const trip = await request('/api/trips', 'POST', { data: { title: 'Delete my journey', destination: 'Goa', days: [] } }, { cookie: owner.cookie });
  const otherTrip = await request('/api/trips', 'POST', { data: { title: 'Keep journey', destination: 'Jaipur', days: [] } }, { cookie: other.cookie });
  await request('/api/imports', 'POST', { data: { title: 'Delete imported booking' } }, { cookie: owner.cookie });
  await callback(request, owner.cookie, 'Delete Owner callback');
  const ai = await request('/api/ai-conversations/events', 'POST', { ownerId: owner.result.user.id, conversationId: 'delete_thread', eventId: 'delete_event', role: 'user', content: 'remove this chat' }, { cookie: owner.cookie });
  assert.equal(ai.status, 200);
  const shared = await request('/api/trips/' + trip.result.record.id + '/share', 'POST', {}, { cookie: owner.cookie });
  const otherShared = await request('/api/trips/' + otherTrip.result.record.id + '/share', 'POST', {}, { cookie: other.cookie });
  const shareToken = new URL(shared.result.share.url, 'http://localhost').searchParams.get('share');
  await ensureFriendResponseTables(db);
  await addFriendResponse(db, owner.result.user.id, trip.result.record.id, '30000000-0000-4000-8000-000000000001', 'Delete Friend', 'Delete this response.');
  await addFriendResponse(db, other.result.user.id, otherTrip.result.record.id, '40000000-0000-4000-8000-000000000001', 'Keep Friend', 'Keep this response.');
  await db.query('INSERT INTO google_connections(user_id,kind,refresh_token,scopes,connected_at) VALUES($1,$2,$3,$4,$5)', [owner.result.user.id, 'gmail', 'DELETE-ME-TOKEN', 'gmail.readonly', new Date().toISOString()]);
  await db.query('INSERT INTO google_connections(user_id,kind,refresh_token,scopes,connected_at) VALUES($1,$2,$3,$4,$5)', [other.result.user.id, 'gmail', 'KEEP-TOKEN', 'gmail.readonly', new Date().toISOString()]);
  const now = new Date().toISOString();
  await db.query('INSERT INTO enquiries(id,kind,data,created) VALUES($1,$2,$3,$4)', [randomUUID(), 'contact', JSON.stringify({ email: owner.result.user.email, message: 'Delete this contact record' }), now]);
  await db.query('INSERT INTO itineraries(id,user_id,created,request,provider,plan) VALUES($1,$2,$3,$4,$5,$6)', ['it_delete', owner.result.user.id, now, JSON.stringify({ destination: 'Goa' }), 'test', JSON.stringify({ days: [] })]);
  await db.query('INSERT INTO jobs(id,user_id,trip_id,status,stage,result,created) VALUES($1,$2,$3,$4,$5,$6,$7)', ['job_delete', owner.result.user.id, trip.result.record.id, 'completed', 'Research complete', JSON.stringify({ note: 'Delete this result' }), now]);

  const created = await request('/api/account/data-requests', 'POST', {}, { cookie: owner.cookie });
  assert.equal(created.status, 201);
  const days = (Date.parse(created.result.request.dueAt) - Date.parse(created.result.request.created)) / 86400000;
  assert.ok(days > 29.99 && days < 30.01, 'request due date is exactly 30 days after submission');
  assert.equal((await request('/api/account/data-requests', 'POST', {}, { cookie: owner.cookie })).status, 409);
  assert.equal((await request('/api/account/data-requests', 'GET', undefined, { cookie: other.cookie })).result.requests.length, 0);
  const staffList = await request('/api/admin/data-requests', 'GET', undefined, { cookie: owner.cookie });
  assert.equal(staffList.status, 200);
  assert.equal(staffList.result.requests[0].due_at, created.result.request.dueAt);

  const completed = await request('/api/admin/data-requests/' + created.result.request.id + '/complete', 'POST', {}, { cookie: owner.cookie });
  assert.equal(completed.status, 200);
  assert.equal(completed.result.request.status, 'completed');
  assert.equal((await request('/api/trips', 'GET', undefined, { cookie: owner.cookie })).status, 401);
  assert.equal((await request('/api/trips', 'GET', undefined, { cookie: other.cookie })).result.records[0].id, otherTrip.result.record.id);
  assert.equal((await request('/api/imports', 'GET', undefined, { cookie: owner.cookie })).status, 401);
  assert.equal(await db.one('SELECT id FROM users WHERE id=$1', [owner.result.user.id]), undefined);
  assert.equal(await db.one('SELECT token_hash FROM shares WHERE user_id=$1', [owner.result.user.id]), undefined);
  assert.equal((await db.one(`SELECT COUNT(*) AS count FROM trip_share_events e WHERE e.token_hash NOT IN (SELECT token_hash FROM shares)`)).count, 0);
  assert.equal((await db.one(`SELECT COUNT(*) AS count FROM trip_share_events e JOIN shares s ON s.token_hash=e.token_hash WHERE s.user_id=$1`, [other.result.user.id])).count, 1);
  assert.equal((await db.one(`SELECT COUNT(*) AS count FROM trip_share_responses r JOIN trip_share_participants p ON p.token_hash=r.token_hash AND p.participant_id=r.participant_id WHERE p.name='Delete Friend'`)).count, 0);
  assert.equal((await db.one(`SELECT COUNT(*) AS count FROM trip_share_responses r JOIN trip_share_participants p ON p.token_hash=r.token_hash AND p.participant_id=r.participant_id WHERE p.name='Keep Friend'`)).count, 1);
  assert.equal(await db.one('SELECT refresh_token FROM google_connections WHERE user_id=$1', [owner.result.user.id]), undefined);
  assert.equal(await db.one('SELECT id FROM callback_requests WHERE owner_id=$1', [owner.result.user.id]), undefined);
  assert.equal(await db.one('SELECT event_key FROM ai_conversation_events WHERE owner_id=$1', [owner.result.user.id]), undefined);
  assert.equal(await db.one('SELECT id FROM enquiries WHERE lower(data::jsonb->>\'email\')=lower($1)', [owner.result.user.email]), undefined);
  assert.equal(await db.one('SELECT id FROM itineraries WHERE user_id=$1', [owner.result.user.id]), undefined);
  assert.equal(await db.one('SELECT id FROM jobs WHERE user_id=$1', [owner.result.user.id]), undefined);
  assert.equal((await db.one('SELECT refresh_token FROM google_connections WHERE user_id=$1', [other.result.user.id])).refresh_token, 'KEEP-TOKEN');
  assert.equal((await request('/api/shared/' + shareToken)).status, 404);
  const retainedRequest = await db.one('SELECT owner_id,requester_email,status FROM data_requests WHERE id=$1', [created.result.request.id]);
  assert.equal(retainedRequest.status, 'completed');
  assert.equal(retainedRequest.requester_email, 'deleted');
  assert.equal((await request('/api/admin/data-requests', 'GET', undefined, { cookie: other.cookie })).result.requests[0].requester_email, 'deleted');
});
