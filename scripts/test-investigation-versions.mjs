import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  INVESTIGATION_EPISODE, createInvestigation as createCurrentInvestigation, restoreInvestigation,
  investigate, concludeInvestigation, getInvestigationEpisode as getCurrentInvestigationEpisode,
} from '../investigation.mjs';
import { getTransferQuestion as getCurrentTransferQuestion } from '../investigation_transfer.mjs';
import { reasoningChoices } from '../investigation_reasoning.mjs';
import {
  LEGACY_INVESTIGATION_CONTENT, getLegacyInvestigationEpisode, getLegacyTransferQuestion,
} from '../investigation_content_versions.mjs';
import { loadInvestigation, readInvestigation, saveInvestigation } from '../investigation_history.mjs';
import {
  readJournal, exportJournal, recordCompleted, answerTransfer,
  loadReflection, saveReflection, clearJournal, journalRecordIdentity,
} from '../investigation_journal.mjs';

// These existing scenarios pin the previous v2 diagnostic/reasoning contract.
// Current default v3 workflow behavior is covered by test-care-workflow.mjs.
const createInvestigation = (mode = 'guided', id = INVESTIGATION_EPISODE.id, version = 2) => createCurrentInvestigation(mode, id, version);
const getInvestigationEpisode = (id, version = 2) => getCurrentInvestigationEpisode(id, version);
const getTransferQuestion = (id, version = 2) => getCurrentTransferQuestion(id, version);

const JOURNAL_KEY = 'mmInvestigationJournal:v1';
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/investigation-journal-v1.json', import.meta.url), 'utf8'));
const original = fixture.records[0];
const previousPass = JSON.parse(fs.readFileSync(new URL('./fixtures/investigation-upgrade-0.3.0.json', import.meta.url), 'utf8'));
const additionalIds = ['pub-003-missed-turn-investigation', 'stu-003-after-weekend-investigation'];
const clone = (value) => JSON.parse(JSON.stringify(value));
const reflection = { confidence: null, keyActionId: null, uncertaintyId: null };
const tests = [];
function test(name, run) { tests.push([name, run]); }
function memory(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: (key) => { values.delete(key); },
  };
}
function journal(records, schema = 1) { return JSON.stringify({ schema, records }); }
function completed(mode = 'guided', version = 2) {
  const initial = createInvestigation(mode, INVESTIGATION_EPISODE.id, version);
  return concludeInvestigation(initial, 'acute-aortic-syndrome');
}
function checkpoint(state, schema = 2) {
  return JSON.stringify({
    schema,
    content: JSON.stringify(getInvestigationEpisode(state.episodeId, state.version)),
    savedUtc: '2026-10-15T10:00:00.000Z',
    state,
  });
}

test('known immutable legacy definitions reproduce the audit export exactly', () => {
  const episode = getLegacyInvestigationEpisode(original.state.episodeId, 1);
  const question = getLegacyTransferQuestion(original.state.episodeId, 1);
  assert.equal(JSON.stringify(episode), original.episodeContent);
  assert.equal(JSON.stringify(question), original.transfer.questionContent);
  assert.ok(Object.isFrozen(LEGACY_INVESTIGATION_CONTENT));
  assert.ok(Object.isFrozen(episode.actions[0]));
  assert.ok(Object.isFrozen(question.choices[0]));
  assert.equal(getLegacyInvestigationEpisode(episode.id, 999), null);
  assert.equal(getLegacyTransferQuestion(episode.id, 999), null);
});

test('legacy journal routes, reflection and transfer survive revised current content', () => {
  const episode = getInvestigationEpisode(original.state.episodeId);
  assert.ok(episode.version > 1, 'a revised flagship must use a new content version');
  assert.notEqual(JSON.stringify(episode), original.episodeContent);
  const store = memory({ [JOURNAL_KEY]: journal(fixture.records) });
  const result = readJournal(store);
  assert.equal(result.status, 'ok');
  assert.equal(result.records.length, 2);
  assert.equal(result.records[0].state.version, 1);
  assert.equal(result.records[0].episodeContent, original.episodeContent);
  assert.equal(result.records[0].transfer.questionContent, original.transfer.questionContent);
  assert.deepEqual(result.records[0].reflection, { ...original.reflection, uncertaintyId: null });
  assert.equal(getInvestigationEpisode(original.state.episodeId, 1).opening, JSON.parse(original.episodeContent).opening);
});

test('legacy checkpoint slots select their saved content version', () => {
  const state = original.state;
  const currentKey = `mmInvestigation:v2:${state.episodeId}`;
  assert.deepEqual(loadInvestigation(state.episodeId, memory({ [currentKey]: checkpoint(state) })), state);
  assert.deepEqual(loadInvestigation(state.episodeId, memory({ 'mmInvestigation:v1': checkpoint(state, 1) })), state);
  const legacyReflection = JSON.stringify({ schema: 1, episodeContent: original.episodeContent, state, reflection: original.reflection });
  assert.deepEqual(loadReflection(state, memory({ [`mmInvestigationReflection:v1:${state.episodeId}`]: legacyReflection })), { ...original.reflection, uncertaintyId: null });
});

test('current history, reflection, journal and first transfer answer round trip', () => {
  let state = createInvestigation('challenge');
  state = investigate(state, getInvestigationEpisode(state.episodeId).actions[0].id);
  const store = memory();
  assert.equal(saveInvestigation(state, store), true);
  assert.deepEqual(loadInvestigation(state.episodeId, store), state);
  const envelope = JSON.parse(store.getItem(`mmInvestigation:v2:${state.episodeId}`));
  assert.equal(envelope.schema, 3);
  assert.equal(envelope.contentVersion, state.version);
  const savedReflection = { confidence: 65, keyActionId: state.actionIds[0], uncertaintyId: null };
  assert.equal(saveReflection(state, savedReflection, store), true);
  assert.deepEqual(loadReflection(state, store), savedReflection);
  state = concludeInvestigation(state, 'acute-aortic-syndrome');
  assert.equal(recordCompleted(state, savedReflection, store), true);
  const question = getTransferQuestion(state.episodeId, state.version);
  const answered = answerTransfer(state, question.choices[0].id, store);
  assert.equal(answered.transfer.questionVersion, question.version);
  assert.equal(answerTransfer(state, question.choices[1].id, store).transfer.answerId, question.choices[0].id);
  assert.deepEqual(readJournal(store).records[0], answered);
});

test('actual previous-pass Night Shift v2 and additional v1 persisted routes remain unchanged', () => {
  const store = memory(previousPass.storage);
  assert.equal(readJournal(store).status, 'ok');
  assert.deepEqual(readJournal(store).records, previousPass.records);
  for (const record of previousPass.records) {
    const state = record.state;
    assert.deepEqual(restoreInvestigation(state), state);
    assert.equal(JSON.stringify(getInvestigationEpisode(state.episodeId, state.version)), record.episodeContent);
    assert.equal(JSON.stringify(getTransferQuestion(state.episodeId, state.version)), record.transfer.questionContent);
    assert.deepEqual(loadInvestigation(state.episodeId, store), state);
    assert.deepEqual(loadReflection(state, store), record.reflection);
    assert.equal(recordCompleted(state, record.reflection, store), true);
    const different = getTransferQuestion(state.episodeId, state.version).choices.find((choice) => choice.id !== record.transfer.answerId);
    assert.equal(answerTransfer(state, different.id, store, record.reflection).transfer.answerId, record.transfer.answerId);
  }
  assert.deepEqual(Object.fromEntries(store.values), previousPass.storage, 'reading and first-answer dedupe do not migrate old bytes');
  const flagship = previousPass.records.find((record) => record.state.episodeId === INVESTIGATION_EPISODE.id);
  assert.equal(flagship.state.version, 2);
  assert.equal(JSON.stringify(getInvestigationEpisode(INVESTIGATION_EPISODE.id, 2)), flagship.episodeContent, 'Night Shift v2 content is unchanged');
  for (const episodeId of additionalIds) {
    assert.equal(getInvestigationEpisode(episodeId).version, 2);
    const legacy = previousPass.records.find((record) => record.state.episodeId === episodeId);
    assert.equal(legacy.state.version, 1);
    assert.equal(JSON.stringify(getLegacyInvestigationEpisode(episodeId, 1)), legacy.episodeContent);
  }
});

test('unchanged bundled contrast questions resolve for all current v2 and frozen v1 episodes', () => {
  for (const episodeId of [INVESTIGATION_EPISODE.id, ...additionalIds]) {
    const current = getTransferQuestion(episodeId, 2);
    assert.ok(current);
    assert.equal(JSON.stringify(current), JSON.stringify(getLegacyTransferQuestion(episodeId, 1)));
    assert.equal(getTransferQuestion(episodeId), current);
    for (const future of [0, 5, 999, '2', null]) assert.equal(getTransferQuestion(episodeId, future), null);
  }
  assert.equal(getTransferQuestion('storage-authored', 2), null);
});

test('new additional v2 checkpoints, reflection-specific journal and contrast answers round trip', () => {
  for (const episodeId of additionalIds) {
    const episode = getInvestigationEpisode(episodeId);
    assert.equal(episode.version, 2);
    assert.ok(episode.reasoning);
    let state = createInvestigation('challenge', episodeId);
    for (const action of episode.actions) state = investigate(state, action.id);
    assert.ok(state);
    state = concludeInvestigation(state, episode.resolution.hypothesisId);
    const choices = reasoningChoices(state);
    const support = choices.supports.find((item) => item.id === episode.reasoning.supportGroups?.[0]?.id)
      ?? choices.supports.find((item) => item.id === episode.resolution.evidenceActionIds[0]);
    const explained = { confidence: 75, keyActionId: support.id, uncertaintyId: choices.uncertainties[0].id };
    const store = memory();
    assert.equal(saveInvestigation(state, store), true);
    assert.deepEqual(loadInvestigation(episodeId, store), state);
    assert.equal(saveReflection(state, explained, store), true);
    assert.deepEqual(loadReflection(state, store), explained);
    assert.equal(recordCompleted(state, reflection, store), true);
    assert.equal(recordCompleted(state, explained, store), true);
    assert.equal(recordCompleted(state, explained, store), true);
    const question = getTransferQuestion(episodeId, 2);
    const answered = answerTransfer(state, question.answerId, store, explained);
    assert.equal(answered.contentVersion, 2);
    assert.equal(answered.transfer.questionVersion, 1);
    assert.equal(answered.transfer.questionContent, JSON.stringify(question));
    assert.equal(answerTransfer(state, question.choices.find((choice) => choice.id !== question.answerId).id, store, explained).transfer.answerId, question.answerId);
    const result = readJournal(store);
    assert.equal(result.status, 'ok');
    assert.equal(result.records.length, 2);
    assert.equal(result.records.find((record) => record.reflection.keyActionId === null).transfer, null);
    assert.deepEqual(result.records.find((record) => record.reflection.keyActionId === support.id), answered);
  }
});

test('combined support persists only after its full required finding set and rejects invented group IDs', () => {
  const episodeId = 'stu-003-after-weekend-investigation';
  const episode = getInvestigationEpisode(episodeId);
  const group = episode.reasoning?.supportGroups?.[0];
  assert.ok(group, 'the current student case bundles a combined evidence group');
  assert.equal(group.requires.length, 3);
  assert.deepEqual(new Set(group.requires), new Set(episode.resolution.evidenceActionIds));
  let state = createInvestigation('guided', episodeId);
  const combined = { confidence: 70, keyActionId: group.id, uncertaintyId: null };
  const store = memory();
  for (const id of group.requires) {
    assert.equal(reasoningChoices(state).supports.some((support) => support.id === group.id), false);
    assert.equal(saveReflection(state, combined, store), false);
    const premature = concludeInvestigation(state, episode.resolution.hypothesisId);
    assert.equal(recordCompleted(premature, combined, store), false);
    state = investigate(state, id);
  }
  assert.equal(reasoningChoices(state).supports.find((support) => support.id === group.id).origin, 'Combined findings');
  assert.equal(saveReflection(state, combined, store), true);
  assert.deepEqual(loadReflection(state, store), combined);
  assert.equal(saveReflection(state, { ...combined, keyActionId: 'group:invented' }, store), false);
  state = concludeInvestigation(state, episode.resolution.hypothesisId);
  assert.equal(recordCompleted(state, combined, store), true);
  const record = readJournal(store).records[0];
  assert.equal(record.reflection.keyActionId, group.id);
  const changed = clone(record);
  changed.reflection.keyActionId = 'group:invented';
  const tampered = readJournal(memory({ [JOURNAL_KEY]: journal([changed], 2) }));
  assert.equal(tampered.status, 'partial');
  assert.equal(tampered.records.length, 0);
});

test('tampered episode, transfer, and route definitions never become trusted content', () => {
  for (const mutate of [
    (record) => { const content = JSON.parse(record.episodeContent); content.opening = 'Storage-authored story'; record.episodeContent = JSON.stringify(content); },
    (record) => { const content = JSON.parse(record.transfer.questionContent); content.answerId = 'excluded'; record.transfer.questionContent = JSON.stringify(content); },
    (record) => { record.state.elapsedMinutes += 1; },
    (record) => { record.reflection.keyActionId = 'invented-action'; },
    (record) => { record.completedUtc = '2026-99-99T99:99:99.999Z'; },
  ]) {
    const changed = clone(original);
    mutate(changed);
    const result = readJournal(memory({ [JOURNAL_KEY]: journal([changed]) }));
    assert.equal(result.status, 'partial');
    assert.equal(result.records.length, 0);
    assert.equal(result.unreadableEntries[0].status, 'damaged');
  }
});

test('one damaged or future entry leaves unrelated valid routes readable and exportable', () => {
  const future = clone(original);
  future.state.version = 999;
  const rawText = journal([fixture.records[1], { damaged: true }, future]);
  const store = memory({ [JOURNAL_KEY]: rawText });
  const result = readJournal(store);
  assert.equal(result.status, 'partial');
  assert.equal(result.records.length, 1);
  assert.deepEqual(result.unreadableEntries.map((entry) => entry.status), ['damaged', 'incompatible']);
  const exported = exportJournal(store);
  assert.equal(exported.rawStorage.text, rawText);
  assert.equal(exported.unreadableEntries[1].value.state.version, 999);
  assert.equal(store.getItem(JOURNAL_KEY), rawText, 'reading never mutates storage');
});

test('adding to a partial journal preserves bad entries and exact original bytes', () => {
  const broken = { damaged: 'retain exactly' };
  const rawText = journal([fixture.records[1], broken]);
  const store = memory({ [JOURNAL_KEY]: rawText });
  const before = readJournal(store);
  assert.equal(recordCompleted(completed(), reflection, store), true);
  const after = readJournal(store);
  assert.equal(after.status, 'partial');
  assert.equal(after.records.length, 2);
  assert.deepEqual(after.unreadableEntries[0].value, broken);
  const preserved = JSON.parse(store.getItem(before.preservationKey));
  assert.equal(preserved.originalJournalText, rawText);
  assert.equal(JSON.parse(exportJournal(store).preservedStorage.text).originalJournalText, rawText);
  assert.deepEqual(preserved.unreadableEntries, [broken]);
  assert.equal(recordCompleted(completed('challenge'), reflection, store), true);
  assert.equal(store.getItem(before.preservationKey), JSON.stringify(preserved), 'recovery slot is immutable');
});

test('malformed whole stores and unknown checkpoints remain unchanged on save', () => {
  for (const rawText of ['{not json', JSON.stringify({ schema: 999, records: [] })]) {
    const store = memory({ [JOURNAL_KEY]: rawText });
    assert.equal(readJournal(store).status, 'invalid');
    assert.equal(recordCompleted(completed(), reflection, store), false);
    assert.equal(store.getItem(JOURNAL_KEY), rawText);
    assert.equal(exportJournal(store).rawStorage.text, rawText);
  }
  const state = completed();
  const key = `mmInvestigation:v2:${state.episodeId}`;
  for (const rawText of ['{damaged', checkpoint({ ...state, version: 999 })]) {
    const store = memory({ [key]: rawText });
    assert.equal(loadInvestigation(state.episodeId, store), null);
    assert.equal(saveInvestigation(state, store), false);
    assert.equal(store.getItem(key), rawText);
    assert.equal(readInvestigation(state.episodeId, store).rawText, rawText);
  }
});

test('storage unavailable and quota failures return failure without losing originals', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(readJournal(blocked).status, 'unavailable');
  assert.equal(exportJournal(blocked), null);
  assert.equal(recordCompleted(completed(), reflection, blocked), false);
  assert.equal(saveInvestigation(completed(), blocked), false);
  assert.equal(saveReflection(completed(), reflection, blocked), false);
  const rawText = journal([fixture.records[1], { broken: true }]);
  const store = memory({ [JOURNAL_KEY]: rawText });
  store.setItem = () => { throw new Error('quota'); };
  assert.equal(recordCompleted(completed(), reflection, store), false);
  assert.equal(store.getItem(JOURNAL_KEY), rawText);
  const state = completed();
  const key = `mmInvestigation:v2:${state.episodeId}`;
  const save = checkpoint(state);
  const full = memory({ [key]: save });
  full.setItem = () => { throw new Error('quota'); };
  assert.equal(saveInvestigation(state, full), false);
  assert.equal(full.getItem(key), save);
});

test('failed active write after successful preservation leaves both original and recovery intact', () => {
  const rawText = journal([fixture.records[1], { broken: true }]);
  const store = memory({ [JOURNAL_KEY]: rawText });
  const expectedKey = readJournal(store).preservationKey;
  const write = store.setItem;
  store.setItem = (key, text) => {
    if (key === JOURNAL_KEY) throw new Error('quota after recovery');
    write(key, text);
  };
  assert.equal(recordCompleted(completed(), reflection, store), false);
  assert.equal(store.getItem(JOURNAL_KEY), rawText);
  assert.equal(JSON.parse(store.getItem(expectedKey)).originalJournalText, rawText);
});

test('an altered recovery slot is not overwritten to make a partial write succeed', () => {
  const rawText = journal([fixture.records[1], { broken: true }]);
  const store = memory({ [JOURNAL_KEY]: rawText });
  const key = readJournal(store).preservationKey;
  store.setItem(key, '{unreadable recovery');
  assert.equal(recordCompleted(completed(), reflection, store), false);
  assert.equal(store.getItem(key), '{unreadable recovery');
  assert.equal(store.getItem(JOURNAL_KEY), rawText);
});

test('a recovery envelope with an unrelated original cannot authorize overwriting active bytes', () => {
  const broken = { broken: true };
  const rawText = journal([fixture.records[1], broken]);
  for (const unrelated of ['{}', journal([fixture.records[1]]), journal([{ otherDamage: true }])]) {
    const store = memory({ [JOURNAL_KEY]: rawText });
    const key = readJournal(store).preservationKey;
    const archive = JSON.stringify({ schema: 1, unreadableEntries: [broken], originalJournalText: unrelated });
    store.setItem(key, archive);
    assert.equal(recordCompleted(completed(), reflection, store), false);
    assert.equal(store.getItem(JOURNAL_KEY), rawText);
    assert.equal(store.getItem(key), archive);
  }
});

test('a journal changed during recovery preparation is not overwritten', () => {
  const rawText = journal([fixture.records[1], { broken: true }]);
  const otherWriterText = journal([fixture.records[1]]);
  const store = memory({ [JOURNAL_KEY]: rawText });
  const write = store.setItem;
  store.setItem = (key, text) => {
    write(key, text);
    if (key.startsWith('mmInvestigationJournal:preserved:v1:')) write(JOURNAL_KEY, otherWriterText);
  };
  assert.equal(recordCompleted(completed(), reflection, store), false);
  assert.equal(store.getItem(JOURNAL_KEY), otherWriterText);
});

test('clear removes the active journal and its recovery copies while preserving other progress', () => {
  const state = completed();
  const checkpointKey = `mmInvestigation:v2:${state.episodeId}`;
  const store = memory({ [JOURNAL_KEY]: journal([fixture.records[1], { broken: true }]), [checkpointKey]: 'checkpoint', mmProfile: 'profile', mmPractice: 'practice' });
  assert.equal(recordCompleted(state, reflection, store), true);
  assert.ok([...store.values.keys()].some((key) => key.startsWith('mmInvestigationJournal:preserved:v1:')));
  assert.equal(clearJournal(store), true);
  assert.equal(store.getItem(JOURNAL_KEY), null);
  assert.equal([...store.values.keys()].filter((key) => key.startsWith('mmInvestigationJournal:preserved:v1:')).length, 0);
  assert.equal(store.getItem(checkpointKey), 'checkpoint');
  assert.equal(store.getItem('mmProfile'), 'profile');
  assert.equal(store.getItem('mmPractice'), 'practice');
});

test('clear reports partial deletion failure and storage enumeration failure', () => {
  const recoveryKey = 'mmInvestigationJournal:preserved:v1:blocked';
  const otherRecoveryKey = 'mmInvestigationJournal:preserved:v1:removable';
  const store = memory({ [JOURNAL_KEY]: 'active', [recoveryKey]: 'original', [otherRecoveryKey]: 'another', mmProfile: 'profile' });
  const remove = store.removeItem;
  store.removeItem = (key) => {
    if (key === recoveryKey) throw new Error('cannot remove recovery');
    remove(key);
  };
  assert.equal(clearJournal(store), false);
  assert.equal(store.getItem(JOURNAL_KEY), null);
  assert.equal(store.getItem(otherRecoveryKey), null);
  assert.equal(store.getItem(recoveryKey), 'original');
  assert.equal(store.getItem('mmProfile'), 'profile');
  const enumerationBlocked = memory({ [JOURNAL_KEY]: 'active', [recoveryKey]: 'original' });
  enumerationBlocked.key = () => { throw new Error('blocked'); };
  assert.equal(clearJournal(enumerationBlocked), false);
  assert.equal(enumerationBlocked.getItem(JOURNAL_KEY), null);
  assert.equal(enumerationBlocked.getItem(recoveryKey), 'original');
  assert.equal(clearJournal({ removeItem() { throw new Error('blocked'); } }), false);
});

test('dedupe includes content version and preserves matching reflection and answer', () => {
  const oldState = completed('guided', 1);
  const currentState = completed();
  assert.ok(oldState && currentState);
  const store = memory();
  assert.equal(recordCompleted(oldState, reflection, store), true);
  assert.equal(recordCompleted(currentState, { ...reflection, confidence: 60 }, store), true);
  assert.equal(recordCompleted(currentState, { ...reflection, confidence: 60 }, store), true);
  const result = readJournal(store);
  assert.equal(result.records.length, 2);
  assert.deepEqual(result.records.map((record) => record.contentVersion), [currentState.version, 1]);
  assert.equal(result.records[0].reflection.confidence, 60);
});

test('assessed blank and explained attempts are separate and transfer answers bind to their reflection', () => {
  const state = completed();
  const episode = getInvestigationEpisode(state.episodeId, state.version);
  const explained = {
    confidence: 70,
    keyActionId: episode.reasoning.openingFacts[0].id,
    uncertaintyId: episode.reasoning.uncertaintyOptions.find((option) => !(option.requires ?? []).length).id,
  };
  const store = memory();
  assert.equal(recordCompleted(state, reflection, store), true);
  assert.equal(recordCompleted(state, explained, store), true);
  assert.equal(recordCompleted(state, explained, store), true);
  assert.equal(readJournal(store).records.length, 2);
  assert.notEqual(journalRecordIdentity(state, reflection), journalRecordIdentity(state, explained));
  const question = getTransferQuestion(state.episodeId, state.version);
  assert.equal(answerTransfer(state, question.choices[0].id, store), null, 'ambiguous old API does not choose an assessed attempt');
  assert.equal(answerTransfer(state, question.choices[0].id, store, reflection).transfer.answerId, question.choices[0].id);
  assert.equal(answerTransfer(state, question.choices[1].id, store, explained).transfer.answerId, question.choices[1].id);
  assert.equal(answerTransfer(state, question.choices[2].id, store, explained).transfer.answerId, question.choices[1].id);
  const records = readJournal(store).records;
  assert.equal(records.find((record) => journalRecordIdentity(record.state, record.reflection) === journalRecordIdentity(state, reflection)).transfer.answerId, question.choices[0].id);
  assert.equal(records.find((record) => journalRecordIdentity(record.state, record.reflection) === journalRecordIdentity(state, explained)).transfer.answerId, question.choices[1].id);
  assert.equal(recordCompleted(state, { ...explained, confidence: 80 }, store), true);
  assert.equal(readJournal(store).records.length, 3, 'a different assessed confidence remains a distinct attempt');
  const legacy = completed('guided', 1);
  assert.equal(journalRecordIdentity(legacy, reflection), journalRecordIdentity(legacy, { ...reflection, confidence: 90 }));
});

test('opening support and available uncertainty are validated against bundled content', () => {
  const state = createInvestigation();
  const episode = getInvestigationEpisode(state.episodeId, state.version);
  const openingFact = episode.reasoning?.openingFacts?.[0];
  assert.ok(openingFact, 'current flagship includes opening facts');
  const store = memory();
  assert.equal(saveReflection(state, { ...reflection, keyActionId: openingFact.id }, store), true);
  assert.equal(saveReflection(state, { ...reflection, keyActionId: 'opening:invented' }, store), false);
  assert.equal(saveReflection(state, { ...reflection, uncertaintyId: 'invented' }, store), false);
  const options = episode.reasoning.uncertaintyOptions;
  const available = options.find((option) => !(option.requires ?? []).length);
  const unavailable = options.find((option) => (option.requires ?? []).length);
  if (available) assert.equal(saveReflection(state, { ...reflection, uncertaintyId: available.id }, store), true);
  assert.ok(unavailable, 'test an uncertainty requiring an unrevealed clue');
  assert.equal(saveReflection(state, { ...reflection, uncertaintyId: unavailable.id }, store), false);
  let revealed = state;
  for (const id of unavailable.requires) revealed = investigate(revealed, id);
  assert.equal(saveReflection(revealed, { ...reflection, uncertaintyId: unavailable.id }, store), true);
  assert.equal(saveReflection({ ...state, version: 1 }, { ...reflection, uncertaintyId: unavailable.id }, memory()), false);
});

test('all bundled legacy episodes remain restorable without storage-defined episodes', () => {
  for (const { episode } of LEGACY_INVESTIGATION_CONTENT) {
    const state = {
      version: episode.version, episodeId: episode.id, mode: 'guided', actionIds: [], elapsedMinutes: 0,
      hypothesisId: null, hypothesisHistory: [], conclusion: null, completed: false,
    };
    assert.deepEqual(restoreInvestigation(state), state);
    assert.equal(saveInvestigation(state, memory()), true);
  }
  assert.equal(restoreInvestigation({ ...createInvestigation(), episodeId: 'storage-authored' }), null);
});

for (const [name, run] of tests) {
  try { run(); console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}
console.log(`Verified ${tests.length} content-version and storage recovery scenarios.`);
