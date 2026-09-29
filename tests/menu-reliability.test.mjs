import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelRequester, assessReview, retryDelay } from '../scripts/menu-reliability.mjs';

test('respects server delay and stops revisiting exhausted models', async () => {
  let clock = 0;
  const calls = [];
  const request = createModelRequester({ now: () => clock, sleep: async ms => { clock += ms; },
    fetchImpl: async url => {
      const model = url.includes('/primary:') ? 'primary' : 'fallback';
      calls.push({ model, at: clock });
      return { ok: model === 'fallback', status: model === 'fallback' ? 200 : 429,
        headers: new Headers({ 'retry-after': '43' }), json: async () => ({}) };
    }
  });
  await request({ models: ['primary', 'fallback'], body: {}, apiKey: 'test' });
  await request({ models: ['primary', 'fallback'], body: {}, apiKey: 'test' });
  assert.deepEqual(calls.map(c => c.model), ['primary', 'primary', 'fallback', 'fallback']);
  assert.ok(calls[1].at - calls[0].at >= 43000);
  assert.ok(calls[3].at - calls[2].at >= 13000);
});

test('authentication errors do not fall back', async () => {
  let count = 0;
  const request = createModelRequester({ sleep: async () => {}, fetchImpl: async () => {
    count++; return { ok: false, status: 403, json: async () => ({}) };
  } });
  await assert.rejects(request({ models: ['a', 'b'], body: {}, apiKey: 'test' }), /403/);
  assert.equal(count, 1);
});

test('reads structured Google retry delays', () => {
  assert.equal(retryDelay({ headers: new Headers() }, { error: { details: [{ retryDelay: '44.5s' }] } }), 44500);
});

test('only dismisses equivalent text with evidence anchored in the candidate', () => {
  const candidate = { dailyNote: '', days: [{ date: '2026-10-28', choices: [{ name: 'Orange chickem' }] }] };
  const item = { date: '2026-10-28', kind: 'meal-text', candidateValue: 'Orange chickem', sourceValue: 'ORANGE CHICKEM' };
  const review = item => assessReview({ approved: false, discrepancies: [item] }, candidate);
  assert.equal(review(item).approved, true);
  assert.equal(review({ ...item, sourceValue: 'Orange chicken' }).approved, false);
  assert.equal(review({ ...item, candidateValue: 'Pizza', sourceValue: 'PIZZA' }).approved, false);
  assert.equal(review({ ...item, kind: 'vegetarian' }).approved, false);
  assert.equal(assessReview({ approved: false, discrepancies: [] }, candidate).approved, false);
});
