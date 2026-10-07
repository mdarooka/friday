import test from 'node:test';
import assert from 'node:assert/strict';
import { startApp, signUp } from './helpers.mjs';

test('AI conversation events are owner-scoped, replayable, and review access is allowlisted', async t => {
  const { request } = await startApp(t, {
    env: { AUTH_REQUIRED: 'true', AI_REVIEW_ADMIN_EMAILS: 'reviewer@example.com' }
  });
  const owner = await signUp(request, 'Owner');
  const other = await signUp(request, 'Other');
  const reviewer = await signUp(request, 'Reviewer');
  const postEvent = (cookie, body, expectedOwnerId) => request('/api/ai-conversations/events', 'POST', {
    ...body, ownerId: expectedOwnerId || (cookie === owner.cookie ? owner.result.user.id : other.result.user.id)
  }, { cookie });
  const readReview = (cookie, query = '') => request('/api/admin/ai-conversations' + query, 'GET', undefined, { cookie });

  assert.equal((await readReview('')).status, 401);
  assert.equal((await readReview(owner.cookie)).status, 403);

  const first = {
    conversationId: 'trip-thread-one', eventId: 'same-event', tripId: 'trip-owner-one',
    eventType: 'trip_chat', role: 'user', content: { text: 'Plan Kyoto' }, status: 'started'
  };
  assert.equal((await postEvent(owner.cookie, first)).status, 200);
  assert.equal((await postEvent(owner.cookie, { ...first, role: 'assistant', content: { text: 'Kyoto plan' }, status: 'completed' })).status, 200);

  // The same event id in a second conversation must remain a distinct row for this owner.
  assert.equal((await postEvent(owner.cookie, { ...first, conversationId: 'trip-thread-two', tripId: 'trip-owner-two', content: { text: 'Plan Osaka' } })).status, 200);
  // The same client ids from another account must also remain separate.
  assert.equal((await postEvent(other.cookie, first)).status, 200);
  // A late reply captured for the first account must not be attributed to a newly signed-in account.
  assert.equal((await postEvent(other.cookie, {
    ...first, conversationId: 'late-thread', eventId: 'late-reply',
    role: 'assistant', content: { text: 'Owner response' }, status: 'completed'
  }, owner.result.user.id)).status, 409);

  const all = await readReview(reviewer.cookie);
  assert.equal(all.status, 200);
  assert.equal(all.result.events.length, 3);
  const sameThreadAcrossOwners = await readReview(reviewer.cookie, '?conversationId=trip-thread-one');
  assert.equal(sameThreadAcrossOwners.result.events.length, 2);
  const byOwner = await readReview(reviewer.cookie, '?ownerId=' + encodeURIComponent(owner.result.user.id));
  assert.equal(byOwner.result.events.length, 2);
  const byConversation = await readReview(reviewer.cookie, '?ownerId=' + encodeURIComponent(owner.result.user.id) + '&conversationId=trip-thread-one');
  assert.equal(byConversation.result.events.length, 1);
  const otherRows = await readReview(reviewer.cookie, '?ownerId=' + encodeURIComponent(other.result.user.id));
  assert.equal(otherRows.result.events.length, 1);
  const replayed = byConversation.result.events[0];
  assert.equal(replayed.status, 'completed');
  assert.equal(replayed.role, 'assistant');
  assert.deepEqual(JSON.parse(replayed.content), { text: 'Kyoto plan' });
});

test('AI conversation review pagination keeps equal-time events with reused IDs across owners and conversations', async t => {
  const { request, db } = await startApp(t, {
    env: { AUTH_REQUIRED: 'true', AI_REVIEW_ADMIN_EMAILS: 'pagereviewer@example.com' }
  });
  const owner = await signUp(request, 'PageOwner');
  const other = await signUp(request, 'PageOther');
  const reviewer = await signUp(request, 'PageReviewer');
  const postEvent = (cookie, ownerId, conversationId) => request('/api/ai-conversations/events', 'POST', {
    ownerId, conversationId, eventId: 'reused-id', eventType: 'trip_chat', role: 'user', content: { text: conversationId }, status: 'completed'
  }, { cookie });
  for (const [cookie, ownerId, conversationId] of [
    [owner.cookie, owner.result.user.id, 'thread-a'], [owner.cookie, owner.result.user.id, 'thread-b'],
    [other.cookie, other.result.user.id, 'thread-a'], [other.cookie, other.result.user.id, 'thread-b']
  ]) assert.equal((await postEvent(cookie, ownerId, conversationId)).status, 200);

  // Force a tie so paging must use stable owner/conversation tie breakers beyond event ID.
  await db.query('UPDATE ai_conversation_events SET created=$1', ['2026-10-06T12:00:00.000Z']);

  assert.equal((await request('/api/admin/ai-conversations?conversationId=bad%2Fid', 'GET', undefined, { cookie: reviewer.cookie })).status, 422);
  const first = await request('/api/admin/ai-conversations?limit=2', 'GET', undefined, { cookie: reviewer.cookie });
  assert.equal(first.result.events.length, 2);
  const second = await request('/api/admin/ai-conversations?limit=2&before=' + encodeURIComponent(first.result.nextBefore), 'GET', undefined, { cookie: reviewer.cookie });
  assert.equal(second.result.events.length, 2);
  const last = await request('/api/admin/ai-conversations?limit=2&before=' + encodeURIComponent(second.result.nextBefore), 'GET', undefined, { cookie: reviewer.cookie });
  assert.equal(last.result.events.length, 0);
  assert.equal(last.result.nextBefore, null);
  const identities = [...first.result.events, ...second.result.events].map(e => `${e.owner_id}/${e.conversation_id}/${e.event_key}`);
  assert.equal(new Set(identities).size, 4);
});

test('trip research records the original question before the provider starts and closes the same audit event', async t => {
  let providerStarted;
  const called = new Promise(resolve => { providerStarted = resolve; });
  let releaseProvider;
  const gate = new Promise(resolve => { releaseProvider = resolve; });
  let providerCalls = 0;
  const { request } = await startApp(t, {
    env: { AUTH_REQUIRED: 'true', AI_REVIEW_ADMIN_EMAILS: 'reviewer@example.com' },
    ai: { apiKey: 'test-key', model: 'test-model' },
    research: async () => {
      providerCalls++;
      providerStarted();
      await gate;
      return { text: 'A researched plan', sources: [], places: [], days: [], questions: [] };
    }
  });
  const owner = await signUp(request, 'Traveler');
  const other = await signUp(request, 'OtherTraveler');
  const reviewer = await signUp(request, 'Reviewer');
  const trip = (await request('/api/trips', 'POST', { data: { title: 'Kyoto', destination: 'Japan', days: [] } }, { cookie: owner.cookie })).result.record;
  const otherTrip = (await request('/api/trips', 'POST', { data: { title: 'Osaka', destination: 'Japan', days: [] } }, { cookie: other.cookie })).result.record;

  const switchedAccount = await request('/api/research', 'POST', {
    conversationId: 'mismatch-thread', prompt: 'Private question from the first account', tripId: otherTrip.id,
    ownerId: owner.result.user.id, mode: 'deep'
  }, { cookie: other.cookie });
  assert.equal(switchedAccount.status, 409);
  assert.equal(providerCalls, 0);
  const mismatchRows = await request('/api/admin/ai-conversations?conversationId=mismatch-thread', 'GET', undefined, { cookie: reviewer.cookie });
  assert.equal(mismatchRows.result.events.length, 0);

  const started = await request('/api/research', 'POST', {
    conversationId: 'kyoto-thread', prompt: 'Find quiet gardens in Kyoto', tripId: trip.id, ownerId: owner.result.user.id, mode: 'deep'
  }, { cookie: owner.cookie });
  assert.equal(started.status, 202);
  await called;

  const during = await request('/api/admin/ai-conversations?ownerId=' + encodeURIComponent(owner.result.user.id) + '&conversationId=kyoto-thread', 'GET', undefined, { cookie: reviewer.cookie });
  assert.equal(during.status, 200);
  assert.equal(during.result.events.length, 1);
  assert.equal(during.result.events[0].status, 'started');
  assert.match(JSON.parse(during.result.events[0].content).request.prompt, /quiet gardens in Kyoto/);

  releaseProvider();
  let job;
  for (let i = 0; i < 50; i++) {
    job = (await request('/api/research/' + started.result.job.id, 'GET', undefined, { cookie: owner.cookie })).result.job;
    if (job.status !== 'running') break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.equal(job.status, 'completed');
  const after = await request('/api/admin/ai-conversations?ownerId=' + encodeURIComponent(owner.result.user.id) + '&conversationId=kyoto-thread', 'GET', undefined, { cookie: reviewer.cookie });
  assert.equal(after.result.events.length, 1);
  assert.equal(after.result.events[0].status, 'completed');
  assert.match(JSON.parse(after.result.events[0].content).response.text, /researched plan/);
});
