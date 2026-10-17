import assert from 'node:assert/strict';
import { createInvestigation, concludeInvestigation } from '../investigation.mjs';
import { recordCompleted, readJournal, answerTransfer } from '../investigation_journal.mjs';
import { getTransferQuestion } from '../investigation_transfer.mjs';

const episodeId = 'doc-002-tearing-back-investigation';
const key = 'mmInvestigationJournal:v1';
const state = concludeInvestigation(createInvestigation('guided', episodeId, 2), 'acute-aortic-syndrome');
const reflection = (confidence) => ({ confidence, keyActionId: null, uncertaintyId: null });
function memory() {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)),
    get length() { return data.size; }, key: (i) => [...data.keys()][i] ?? null };
}
const tests = [];
function test(name, run) { tests.push([name, run]); }
function fullJournal() {
  const store = memory();
  for (let i = 0; i < 20; i++) assert.equal(recordCompleted(state, reflection(i), store), true);
  return store;
}
test('a new route cannot silently evict an earlier route at capacity', () => {
  const store = fullJournal();
  const before = store.getItem(key);
  assert.equal(recordCompleted(state, reflection(21), store), false);
  assert.equal(store.getItem(key), before);
  assert.equal(readJournal(store).records.length, 20);
  assert.equal(recordCompleted(state, reflection(0), store), true, 'a duplicate needs no extra slot');
  assert.equal(store.getItem(key), before);
});
test('transfer feedback still saves at capacity without dropping any route', () => {
  const store = fullJournal();
  const before = readJournal(store).records;
  const answerId = getTransferQuestion(episodeId, 2).choices[0].id;
  assert.ok(answerTransfer(state, answerId, store, reflection(0)));
  const after = readJournal(store).records;
  assert.equal(after.length, 20);
  assert.deepEqual(after.map((r) => r.state), before.map((r) => r.state));
  assert.deepEqual(after.map((r) => r.reflection), before.map((r) => r.reflection));
  assert.equal(after.filter((r) => r.transfer !== null).length, 1);
});
test('a damaged row still occupies its preserved slot', () => {
  const store = fullJournal();
  const parsed = JSON.parse(store.getItem(key));
  parsed.records[0] = { damaged: 'keep this original record' };
  store.setItem(key, JSON.stringify(parsed));
  const before = store.getItem(key);
  assert.equal(readJournal(store).status, 'partial');
  assert.equal(recordCompleted(state, reflection(21), store), false);
  assert.equal(store.getItem(key), before);
  assert.equal(store.length, 1, 'capacity failure does not mutate recovery storage');
});
let failed = 0;
for (const [name, run] of tests) {
  try { run(); console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}`, error); }
}
console.log(`${tests.length - failed}/${tests.length} care journal scenarios passed.`);
if (failed) process.exitCode = 1;
