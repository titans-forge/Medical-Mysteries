import assert from 'node:assert/strict';
import { investigationFamilies, nextInvestigationArrival, rememberInvestigationArrival } from '../investigation_arrivals.mjs';
const episodes = [
  { id: 'first', version: 4, familyId: 'family', title: 'Case', recordLabel: 'Arrival A' },
  { id: 'second', version: 4, familyId: 'family', title: 'Case', recordLabel: 'Arrival B' },
  { id: 'other', version: 3, title: 'Other' },
];
const [family, other] = investigationFamilies(episodes);
function memory() { const data = new Map(); return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) }; }
const tests = [];
function test(name, run) { tests.push([name, run]); }
test('presentation groups records without replacing their exact identities', () => {
  assert.equal(family.records.length, 2);
  assert.deepEqual(family.records.map((r) => [r.id, r.version]), [['first', 4], ['second', 4]]);
  assert.equal(other.id, 'other');
});
test('new arrivals alternate trusted fixed records and do not touch saves', () => {
  const store = memory(); store.data.set('mmInvestigation:v2:first', 'original save');
  assert.equal(nextInvestigationArrival(family, store).id, 'first');
  assert.equal(rememberInvestigationArrival(family, 'first', store), true);
  assert.equal(nextInvestigationArrival(family, store).id, 'second');
  assert.equal(rememberInvestigationArrival(family, 'second', store), true);
  assert.equal(nextInvestigationArrival(family, store).id, 'first');
  assert.equal(store.data.get('mmInvestigation:v2:first'), 'original save');
  assert.equal(nextInvestigationArrival(other, store).id, 'other');
});
test('invalid or future selection preferences remain byte-identical', () => {
  for (const raw of ['{broken', '{"schema":2,"lastEpisodeId":"second"}', '{"schema":1,"lastEpisodeId":"not-bundled"}']) {
    const store = memory(); store.data.set('mmInvestigationArrival:v1:family', raw);
    assert.equal(nextInvestigationArrival(family, store).id, 'first');
    assert.equal(rememberInvestigationArrival(family, 'first', store), false);
    assert.equal(store.data.get('mmInvestigationArrival:v1:family'), raw);
  }
});
test('blocked or competing preference writes cannot change a case identity', () => {
  const blocked = { getItem() { throw Error('blocked'); } };
  assert.equal(nextInvestigationArrival(family, blocked).id, 'first');
  assert.equal(rememberInvestigationArrival(family, 'first', blocked), false);
  assert.equal(rememberInvestigationArrival(family, 'other', memory()), false);
  let reads = 0;
  const changed = { getItem: () => reads++ ? 'newer value' : null, setItem() { throw Error('must not overwrite'); } };
  assert.equal(rememberInvestigationArrival(family, 'first', changed), false);
});
let failed = 0;
for (const [name, run] of tests) {
  try { run(); console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}`, error); }
}
console.log(`${tests.length - failed}/${tests.length} arrival selection scenarios passed.`);
if (failed) process.exitCode = 1;
