import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  getInvestigationEpisode, createInvestigation, getCareWorkflow, chooseCarePriority,
  requestCareTask, advanceCareUpdate, reviewCareTask, respondCareUpdate, setHypothesis,
  reassessCare, sendCareHandoff, acknowledgeCareHandoff, concludeInvestigation,
} from '../investigation.mjs';
import { readJournal, recordCompleted } from '../investigation_journal.mjs';

const JOURNAL_KEY = 'mmInvestigationJournal:v1';
const blankReflection = { confidence: null, keyActionId: null, uncertaintyId: null };
const clone = (value) => JSON.parse(JSON.stringify(value));
const tests = [];
const test = (name, run) => tests.push([name, run]);

function memory(initial = {}) {
  const values = new Map(Object.entries(initial));
  let writes = 0;
  return {
    values,
    get writes() { return writes; },
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) { writes += 1; values.set(key, String(value)); },
    removeItem(key) { writes += 1; values.delete(key); },
  };
}

function complete(episode) {
  const care = getCareWorkflow;
  const appropriate = (choices) => choices.find((choice) => choice.appropriate).id;
  let state = createInvestigation('guided', episode.id, episode.version);
  state = chooseCarePriority(state, appropriate(care(state).choices.priority));
  while (state.actionIds.length < episode.actions.length) {
    for (const task of care(state).tasks.filter((item) => item.canRequest)) {
      state = requestCareTask(state, task.actionId);
    }
    while (care(state).canUpdate) state = advanceCareUpdate(state);
    const ready = care(state).tasks.filter((item) => item.status === 'available');
    assert.ok(ready.length, 'The authored route must make progress.');
    for (const task of ready) state = reviewCareTask(state, task.actionId);
  }
  state = setHypothesis(state, episode.resolution.hypothesisId);
  for (const update of care(state).patientUpdates) {
    state = respondCareUpdate(state, update.id, appropriate(update.choices));
  }
  state = reassessCare(state, appropriate(care(state).choices.reassessment));
  const handoff = Object.fromEntries(Object.entries(care(state).choices.handoff)
    .map(([field, section]) => [`${field}Id`, appropriate(section.choices)]));
  state = sendCareHandoff(state, handoff);
  state = acknowledgeCareHandoff(state, care(state).handoff.id, appropriate(care(state).choices.readback));
  state = concludeInvestigation(state, episode.resolution.hypothesisId);
  assert.equal(state.completed, true);
  return state;
}

function recordFor(state) {
  const storage = memory();
  assert.equal(recordCompleted(state, blankReflection, storage), true);
  const journal = readJournal(storage);
  assert.equal(journal.status, 'ok');
  assert.equal(journal.records.length, 1);
  return journal.records[0];
}

const legacyFixture = JSON.parse(fs.readFileSync(
  new URL('./fixtures/investigation-upgrade-0.6.0.json', import.meta.url), 'utf8',
));
const legacyState = legacyFixture.records[0].state;
const legacyRecord = recordFor(legacyState);
const episodeId = 'doc-002-tearing-back-investigation';
const v5Record = recordFor(complete(getInvestigationEpisode(episodeId, 5)));
const v6State = complete(getInvestigationEpisode(episodeId, 6));
const v6Record = recordFor(v6State);

// Reflection values make valid, distinct attempts without changing saved routes.
function legacyRecords(count) {
  return Array.from({ length: count }, (_, confidence) => ({
    ...clone(legacyRecord), reflection: { ...blankReflection, confidence },
  }));
}

function storageWith(records) {
  return memory({ [JOURNAL_KEY]: JSON.stringify({ schema: 2, records }) });
}

function rejectsWithoutWrites(storage, state, reflection) {
  const before = [...storage.values];
  const writes = storage.writes;
  assert.equal(recordCompleted(state, reflection, storage), false);
  assert.equal(storage.writes, writes, 'A rejected append must not write active or recovery storage.');
  assert.deepEqual([...storage.values], before);
}

for (const version of ['legacy', 'v5']) {
  test(`${version} stores accept 20 rows and reject 21 without any writes`, () => {
    const storage = storageWith(version === 'v5'
      ? [clone(v5Record), ...legacyRecords(18)] : legacyRecords(19));
    assert.equal(readJournal(storage).records.length, 19);
    assert.equal(recordCompleted(legacyState, {
      ...blankReflection, confidence: version === 'v5' ? 18 : 19,
    }, storage), true);
    const journal = readJournal(storage);
    assert.equal(journal.status, 'ok');
    assert.equal(journal.records.length, 20);
    rejectsWithoutWrites(storage, legacyState, { ...blankReflection, confidence: 100 });
  });
}

const corruptions = {
  'content version mismatch': (record) => { record.contentVersion = 5; },
  'unknown episode': (record) => { record.state.episodeId = 'unknown'; },
  'claimed future version': (record) => { record.state.version = 7; record.contentVersion = 7; },
  'incomplete state': (record) => { record.state.completed = false; },
  'damaged episode content': (record) => { record.episodeContent = '{}'; },
  'invalid timestamp': (record) => { record.completedUtc = 'not-a-date'; },
  'invalid reflection': (record) => { record.reflection.confidence = 101; },
  'forged transfer': (record) => { record.transfer = { answerId: 'made-up' }; },
};

for (const [name, corrupt] of Object.entries(corruptions)) {
  test(`${name} cannot grant a 21st row or create recovery writes`, () => {
    const invalidRecord = clone(v6Record);
    corrupt(invalidRecord);
    const storage = storageWith([invalidRecord, ...legacyRecords(19)]);
    const journal = readJournal(storage);
    assert.equal(journal.status, 'partial');
    assert.equal(journal.records.length, 19);
    assert.equal(journal.unreadableEntries.length, 1);
    assert.deepEqual(journal.unreadableEntries[0].value, invalidRecord);
    rejectsWithoutWrites(storage, legacyState, { ...blankReflection, confidence: 100 });
  });
}

test('a validated completed v6 route grants a 21st row and preserves all earlier records', () => {
  const records = legacyRecords(20);
  const storage = storageWith(records);
  assert.equal(recordCompleted(v6State, blankReflection, storage), true);
  const journal = readJournal(storage);
  assert.equal(journal.status, 'ok');
  assert.equal(journal.records.length, 21);
  assert.equal(journal.records[0].state.version, 6);
  assert.deepEqual(journal.records.slice(1), records);
});

test('pre-existing 31-row data stays readable and cannot grow', () => {
  const storage = storageWith([clone(v6Record), ...legacyRecords(30)]);
  const journal = readJournal(storage);
  assert.equal(journal.status, 'ok');
  assert.equal(journal.records.length, 31);
  assert.equal(journal.unreadableEntries.length, 0);
  rejectsWithoutWrites(storage, legacyState, { ...blankReflection, confidence: 100 });
});

for (const [name, run] of tests) {
  run();
  console.log(`PASS ${name}`);
}
console.log(`Verified ${tests.length} editorial journal count-policy scenarios.`);
