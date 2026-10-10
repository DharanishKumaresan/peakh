import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { z } from 'zod';
import { makeSeed, today } from '../app/records.ts';

// Exercise the actual route handlers, with only authenticated storage mocked.
const source = readFileSync(new URL('../app/api/records/route.ts', import.meta.url), 'utf8');
function setup() {
  let version = 'version-1', state = makeSeed(), writes = 0;
  state.sample = false;
  state.activities.forEach(a => { a.entries = []; });
  const storage = {
    userId: async () => 'test-user', sameOrigin: () => true,
    json: (body, status = 200, headers = {}) => Response.json(body, { status, headers }),
    ensureBoard: async () => ({ state: JSON.stringify(state), updated_at: version }),
    rpc: async (action, payload) => {
      assert.equal(action, 'board_save');
      if (payload.expected !== version) return { saved: false, version };
      state = payload.state; version = `version-${++writes + 1}`;
      return { saved: true, version };
    },
  };
  const exports = {};
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, console,
    require: name => {
      if (name === 'zod') return { z };
      if (name === '../../records') return { today };
      if (name === '../storage') return storage;
      throw Error(`Unexpected dependency: ${name}`);
    },
  });
  return exports;
}
const request = (body, headers = {}) => new Request('https://peakh.test/api/records', {
  method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});

test('deleting categories including the final category persists without reseeding', async () => {
  const api = setup();
  const { version, ...state } = await (await api.GET(new Request('https://peakh.test/api/records'))).json();
  const remaining = state.activities.slice(1);
  const saved = await api.PUT(request({ ...state, activities: remaining, expectedVersion: version }));
  assert.equal(saved.status, 200);
  const current = await saved.json();
  const after = await (await api.GET(new Request('https://peakh.test/api/records'))).json();
  assert.deepEqual(after.activities, remaining);
  assert.equal((await api.PUT(request({ ...state, activities: [], expectedVersion: current.version }))).status, 200);
  assert.deepEqual((await (await api.GET(new Request('https://peakh.test/api/records'))).json()).activities, []);
});

test('load and consecutive saves work without ETag or If-Match headers', async () => {
  const api = setup();
  const load = await api.GET(new Request('https://peakh.test/api/records'));
  assert.equal(load.headers.get('etag'), '"version-1"');
  load.headers.delete('etag'); // Simulate the deployed header-loss failure.
  const { version, ...state } = await load.json();
  assert.equal(version, 'version-1');
  state.activities[0].entries.push({ id: 'new-log', date: today(), value: 1200 });
  const save = await api.PUT(request({ ...state, expectedVersion: version }));
  assert.equal(save.status, 200);
  save.headers.delete('etag');
  const saved = await save.json();
  assert.equal(saved.version, 'version-2');
  const second = await api.PUT(request({ ...state, expectedVersion: saved.version }));
  assert.equal(second.status, 200);
  assert.equal((await second.json()).version, 'version-3');
  assert.equal((await api.PUT(request({ ...state, expectedVersion: version }))).status, 409);
  assert.equal((await api.PUT(request(state))).status, 428);
});

test('previous clients can still send quoted or unquoted If-Match', async () => {
  const api = setup();
  const { version, ...state } = await (await api.GET(new Request('https://peakh.test/api/records'))).json();
  const saved = await api.PUT(request(state, { 'If-Match': version }));
  assert.equal(saved.status, 200);
  const next = await api.PUT(request(state, { 'If-Match': saved.headers.get('etag') }));
  assert.equal(next.status, 200);
});

test('deleting the last entry persists and stale versions cannot restore it', async () => {
  const api = setup();
  const { version, ...state } = await (await api.GET(new Request('https://peakh.test/api/records'))).json();
  state.activities[0].entries.push({ id: 'delete-me', date: today(), value: 1200 });
  const saved = await (await api.PUT(request({ ...state, expectedVersion: version }))).json();
  const withoutEntry = structuredClone(state);
  withoutEntry.activities[0].entries = [];
  assert.equal((await api.PUT(request({ ...withoutEntry, expectedVersion: saved.version }))).status, 200);
  assert.equal((await api.PUT(request({ ...state, expectedVersion: saved.version }))).status, 409);
  const reloaded = await (await api.GET(new Request('https://peakh.test/api/records'))).json();
  assert.equal(reloaded.activities[0].entries.length, 0);
  assert.equal(reloaded.activities[0].goal, state.activities[0].goal);
});
