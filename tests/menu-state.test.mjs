import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkpoint, runPrograms } from '../scripts/menu-state.mjs';

test('a failed middle program preserves successes and still visits later programs', async () => {
  const visited = [];
  const results = await runPrograms(['a', 'b', 'c'], async id => {
    visited.push(id);
    if (id === 'b') throw new Error('review rejected');
    return true;
  });
  assert.deepEqual(visited, ['a', 'b', 'c']);
  assert.deepEqual(results.map(r => r.status), ['updated', 'failed', 'updated']);
  assert.equal(results[1].error, 'review rejected');
});

test('checkpoints resume successful calls but invalidate on input changes and force', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'menu-state-'));
  t.after(() => rm(directory, { recursive: true }));
  let calls = 0;
  const invoke = async () => ({ count: ++calls });
  await checkpoint({ image: 'a', prompt: 'v1' }, invoke, { directory });
  assert.deepEqual(await checkpoint({ image: 'a', prompt: 'v1' }, invoke, { directory }), { count: 1 });
  await checkpoint({ image: 'a', prompt: 'v2' }, invoke, { directory });
  await checkpoint({ image: 'a', prompt: 'v2' }, invoke, { directory, force: true });
  assert.equal(calls, 3);
});

test('rejected reviews are retained as diagnostics but retried', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'menu-state-'));
  t.after(() => rm(directory, { recursive: true }));
  let calls = 0;
  const options = { directory, accept: value => value.approved };
  const invoke = async () => { calls++; return { approved: false }; };
  await checkpoint({}, invoke, options);
  await checkpoint({}, invoke, options);
  assert.equal(calls, 2);
});
