import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  getInvestigationEpisode, createInvestigation, restoreInvestigation,
  getCareWorkflow, chooseCarePriority, requestCareTask, advanceCareUpdate, reviewCareTask,
  respondCareUpdate, setHypothesis, reassessCare, sendCareHandoff, acknowledgeCareHandoff,
  concludeInvestigation, investigationOutcome, investigationDebrief,
} from '../investigation.mjs';
import { V4_INVESTIGATION_CONTENT, V5_INVESTIGATION_CONTENT, getLegacyTransferQuestion } from '../investigation_content_versions.mjs';
import { replayCareWorkflow } from '../care_workflow.mjs';
import { getTransferQuestion } from '../investigation_transfer.mjs';
import { saveInvestigation, loadInvestigation, listInvestigationSaves, readInvestigation } from '../investigation_history.mjs';
import { readJournal, recordCompleted, journalRecordIdentity, loadReflection, saveReflection, exportJournal } from '../investigation_journal.mjs';
const INVESTIGATION_EPISODES = V5_INVESTIGATION_CONTENT.map(({episode}) => episode);
const tests = [];
const test = (name, run) => tests.push([name, run]);
const clone = (value) => JSON.parse(JSON.stringify(value));
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/investigation-upgrade-0.7.0.json', import.meta.url), 'utf8'));
const content = JSON.parse(fs.readFileSync(new URL('./fixtures/investigation-v4-before-coordination.json', import.meta.url), 'utf8'));
const care = (state) => { const value = getCareWorkflow(state); assert.ok(value); return value; };
const good = (choices) => { const value = choices.find((choice) => choice.appropriate); assert.ok(value); return value.id; };
const bad = (choices) => { const value = choices.find((choice) => !choice.appropriate); assert.ok(value); return value.id; };
const initial = (episode = INVESTIGATION_EPISODES[0]) => createInvestigation('guided', episode.id, episode.version);
const selections = (state) => Object.fromEntries(Object.entries(care(state).choices.handoff).map(([key, value]) => [`${key}Id`, good(value.choices)]));
const handoff = (state) => sendCareHandoff(state, selections(state));
const readback = (state) => acknowledgeCareHandoff(state, care(state).handoff.id, good(care(state).choices.readback));
function memory(values = {}) {
  const data = new Map(Object.entries(values));
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: (key) => data.delete(key) };
}
function complete(episode, reverse = false) {
  let state = chooseCarePriority(initial(episode), good(care(initial(episode)).choices.priority));
  while (state.actionIds.length < episode.actions.length) {
    for (const task of care(state).tasks.filter((value) => value.canRequest)) state = requestCareTask(state, task.actionId);
    while (care(state).canUpdate) state = advanceCareUpdate(state);
    const ready = care(state).tasks.filter((value) => value.status === 'available');
    assert.ok(ready.length);
    if (reverse) ready.reverse();
    for (const task of ready) state = reviewCareTask(state, task.actionId);
  }
  state = setHypothesis(state, episode.resolution.hypothesisId);
  for (const update of care(state).patientUpdates) state = respondCareUpdate(state, update.id, good(update.choices));
  state = reassessCare(state, good(care(state).choices.reassessment));
  return concludeInvestigation(readback(handoff(state)), episode.resolution.hypothesisId);
}
function oneReviewed(episode = INVESTIGATION_EPISODES[0]) {
  let state = initial(episode);
  const task = care(state).tasks.find((value) => value.canRequest && episode.careWorkflow.tasks[value.actionId].rounds === 1);
  assert.ok(task);
  state = requestCareTask(state, task.actionId);
  state = advanceCareUpdate(state);
  state = reviewCareTask(state, task.actionId);
  assert.ok(state);
  return state;
}

test('the exact shipped v4 definitions, questions, nested profiles and property order remain frozen', () => {
  assert.deepEqual(V4_INVESTIGATION_CONTENT, content);
  for (const { episode, transfer } of content) {
    assert.equal(JSON.stringify(getInvestigationEpisode(episode.id, 4)), JSON.stringify(episode));
    assert.equal(JSON.stringify(getLegacyTransferQuestion(episode.id, 4)), JSON.stringify(transfer));
    assert.equal(JSON.stringify(getTransferQuestion(episode.id, 4)), JSON.stringify(transfer));
    assert.ok(Object.isFrozen(getInvestigationEpisode(episode.id, 4).careWorkflow));
  }
});

test('genuine v4 active/completed saves retain exact projections, debriefs, journal identities and stored bytes', () => {
  const store = memory(fixture.storage);
  const before = Object.fromEntries(store.data);
  for (const snapshot of fixture.snapshots) {
    assert.deepEqual(restoreInvestigation(snapshot.active), snapshot.active);
    assert.deepEqual(care(snapshot.active), snapshot.activeCare);
    assert.deepEqual(restoreInvestigation(snapshot.state), snapshot.state);
    assert.deepEqual(care(snapshot.state), snapshot.care);
    assert.deepEqual(investigationOutcome(snapshot.state), snapshot.outcome);
    assert.deepEqual(investigationDebrief(snapshot.state), snapshot.debrief);
    assert.equal(journalRecordIdentity(snapshot.state, snapshot.reflection), snapshot.identity);
    assert.deepEqual(loadInvestigation(snapshot.episodeId, store, 4), snapshot.state);
    assert.deepEqual(loadReflection(snapshot.state, store), snapshot.reflection);
    assert.equal(recordCompleted(snapshot.state, snapshot.reflection, store), true);
  }
  assert.deepEqual(readJournal(store).records, fixture.records);
  const exported = exportJournal(store); exported.exportedUtc = fixture.journalExport.exportedUtc;
  assert.deepEqual(exported, fixture.journalExport);
  assert.deepEqual(Object.fromEntries(store.data), before);
});

test('nine v5 records complete and cold replay in either report-reading order with workflow version 2', () => {
  assert.equal(INVESTIGATION_EPISODES.length, 9);
  for (const episode of INVESTIGATION_EPISODES) {
    assert.equal(episode.version, 5);
    assert.ok(Object.isFrozen(episode.coordination.readbackScenarios));
    assert.equal(initial(episode).workflow.version, 2);
    for (const reverse of [false, true]) {
      const state = complete(episode, reverse);
      assert.deepEqual(restoreInvestigation(clone(state)), state);
      assert.equal(care(state).assessment.status, 'recorded');
      assert.equal(investigationOutcome(state).status, 'supported');
      assert.equal(care(state).handoff.readbackQuestion.id, care(state).readbackQuestion.id);
      const store = memory();
      assert.equal(saveInvestigation(state, store), true);
      assert.deepEqual(loadInvestigation(episode.id, store, 5), state);
    }
  }
});

test('early receiver messages are selected at send time and never acquire later reports or patient updates', () => {
  for (const episode of INVESTIGATION_EPISODES) {
    let state = handoff(initial(episode));
    const sent = clone(care(state).handoff);
    assert.equal(sent.reviewedFindings.length, 0);
    assert.equal(sent.patientUpdates.length, 0);
    assert.ok(sent.readbackQuestion.message);
    assert.deepEqual(sent.readbackQuestion.requiresReviewed ?? [], []);
    assert.deepEqual(sent.readbackQuestion.requiresPatientUpdates ?? [], []);
    state = readback(state);
    assert.ok(state);
    state = advanceCareUpdate(state);
    assert.ok(state);
    assert.deepEqual(care(state).handoff.readbackQuestion, sent.readbackQuestion);
    assert.equal(care(state).handoff.outdated, true);
    assert.equal(acknowledgeCareHandoff(state, sent.id, good(sent.readbackQuestion.choices)), null);
    const updated = handoff(state);
    assert.notEqual(care(updated).handoff.id, sent.id);
    assert.ok(care(updated).readbackQuestion.requiresPatientUpdates.length > 0);
  }
});

test('receiver correction attempts stay attached to the same exact message and retain earlier feedback', () => {
  for (const episode of INVESTIGATION_EPISODES) {
    let state = handoff(oneReviewed(episode));
    const sent = clone(care(state).handoff.readbackQuestion);
    state = acknowledgeCareHandoff(state, care(state).handoff.id, bad(care(state).choices.readback));
    assert.ok(state);
    state = readback(state);
    assert.deepEqual(care(state).handoff.readbackQuestion, sent);
    assert.equal(care(state).handoff.readbackAttempts.length, 2);
    assert.ok(care(state).assessment.historyNotes.some((note) => /Earlier readback/.test(note)));
    assert.equal(readback(state), null);
  }
});

test('reassessment questions depend on released changes and reviewed/pending findings and stale when context changes', () => {
  for (const episode of INVESTIGATION_EPISODES) {
    let state = initial(episode);
    assert.equal(care(state).canReassess, false);
    assert.equal(reassessCare(state, good(care(state).choices.reassessment)), null);
    const before = care(state).reassessmentQuestion.id;
    state = oneReviewed(episode);
    assert.equal(care(state).canReassess, true);
    assert.notEqual(care(state).reassessmentQuestion.id, before);
    state = reassessCare(state, good(care(state).choices.reassessment));
    const recorded = clone(care(state).latestReassessment);
    assert.ok(recorded.context.patientUpdates.length > 0);
    assert.deepEqual(recorded.context.reviewedActionIds, state.actionIds);
    const next = care(state).tasks.find((value) => value.canRequest);
    assert.ok(next);
    state = requestCareTask(state, next.actionId);
    assert.equal(care(state).reassessmentCurrent, false);
    state = reassessCare(state, good(care(state).choices.reassessment));
    assert.ok(care(state).latestReassessment.context.pendingTaskIds.includes(next.actionId));
    assert.deepEqual(care(state).reassessments[0], recorded);
    if (care(state).canUpdate) {
      state = advanceCareUpdate(state);
      assert.equal(care(state).reassessmentCurrent, false);
    }
  }
});

test('authored pending-report questions require their reviewed report, released change and actual outstanding request together', () => {
  for (const episode of INVESTIGATION_EPISODES) {
    const target = episode.coordination.reassessmentScenarios.find((question) => question.requiresPending?.length && question.requiresReviewed?.length && question.requiresPatientUpdates?.length);
    assert.ok(target);
    let state = initial(episode);
    for (const id of target.requiresReviewed) {
      state = requestCareTask(state, id); assert.ok(state);
      while (care(state).tasks.find((task) => task.actionId === id).status === 'pending') state = advanceCareUpdate(state);
      state = reviewCareTask(state, id); assert.ok(state);
    }
    assert.notEqual(care(state).reassessmentQuestion.id, target.id, 'no pending request has been made');
    for (const id of target.requiresPending) { state = requestCareTask(state, id); assert.ok(state); }
    assert.equal(care(state).reassessmentQuestion.id, target.id);
    state = reassessCare(state, good(care(state).choices.reassessment));
    state = handoff(state);
    assert.ok(care(state).readbackQuestion.requiresPending.length > 0);
    const sent = clone(care(state).handoff.readbackQuestion);
    while (care(state).tasks.some((task) => target.requiresPending.includes(task.actionId) && task.status === 'pending')) state = advanceCareUpdate(state);
    assert.equal(care(state).reassessmentCurrent, false);
    assert.notEqual(care(state).reassessmentQuestion.id, target.id, 'available reports are not still pending or already reviewed');
    assert.deepEqual(care(state).handoff.readbackQuestion, sent);
  }
});

test('receiver responses address the particular inaccurate receiver, owner, situation or uncertainty sent', () => {
  for (const episode of INVESTIGATION_EPISODES) {
    for (const field of ['receiver', 'nextOwner', 'situation', 'uncertainty']) {
      let state = initial(episode);
      const selected = selections(state);
      selected[`${field}Id`] = bad(care(state).choices.handoff[field].choices);
      state = sendCareHandoff(state, selected); assert.ok(state);
      const question = care(state).readbackQuestion;
      assert.equal(question.requiresSelections[`${field}Id`], selected[`${field}Id`]);
      assert.equal(care(state).handoff.choices[field].appropriate, false);
      state = readback(state); assert.ok(state);
      assert.ok(care(state).assessment.issues.length > 0, 'one corrected receiver response does not repair the inaccurate sent field');
    }
  }
});

test('v5 replay rejects missing or forged question identities, foreign choices and cross-version event logs', () => {
  const episode = INVESTIGATION_EPISODES[0];
  const completeState = complete(episode);
  for (const type of ['reassess', 'readback']) {
    for (const mutation of [event => { delete event.questionId; }, event => { event.questionId = 'future-or-foreign-context'; }, event => { event.choiceId = 'unknown-choice'; }, event => { event.context = {}; }]) {
      const forged = clone(completeState); const event = forged.workflow.events.find(value => value.type === type);
      mutation(event); assert.equal(restoreInvestigation(forged), null);
    }
  }
  let early = handoff(initial(episode));
  const lateQuestion = care(completeState).handoff.readbackQuestion;
  const raw = clone(early.workflow);
  raw.events.push({type:'readback',handoffId:care(early).handoff.id,questionId:lateQuestion.id,choiceId:good(lateQuestion.choices)});
  assert.equal(replayCareWorkflow(raw, episode), null);
  const old = fixture.snapshots[0].state;
  const promoted = clone(old); promoted.version = 5;
  assert.equal(restoreInvestigation(promoted), null);
  const downgraded = clone(completeState); downgraded.version = 4;
  assert.equal(restoreInvestigation(downgraded), null);
  const extra = clone(completeState); extra.workflow.events.push({type:'readback',handoffId:'wrong',questionId:lateQuestion.id,choiceId:good(lateQuestion.choices)});
  assert.equal(restoreInvestigation(extra), null);
});

test('same-record v4 and v5 saves coexist and damaged v5 content cannot rewrite or mask the old version list', () => {
  const store = memory(fixture.storage);
  for (const episode of INVESTIGATION_EPISODES) {
    if (!getInvestigationEpisode(episode.id, 4)) continue;
    const oldKey = `mmInvestigation:v4:${episode.id}:4`;
    const oldBytes = store.getItem(oldKey);
    const current = complete(episode);
    assert.equal(saveInvestigation(current, store), true);
    assert.deepEqual(listInvestigationSaves(episode.id, store).map(value => value.version), [5,4]);
    assert.equal(store.getItem(oldKey), oldBytes);
    const newKey = `mmInvestigation:v4:${episode.id}:5`;
    store.setItem(newKey, '{damaged current route');
    assert.equal(readInvestigation(episode.id, store, 5).status, 'invalid');
    assert.deepEqual(listInvestigationSaves(episode.id, store).map(value => value.version), [4]);
    assert.equal(store.getItem(oldKey), oldBytes);
    assert.equal(saveInvestigation(current, store), false);
  }
});

test('a legitimate 128-event completed v5 checkpoint fits the existing storage envelope', () => {
  for (const episode of INVESTIGATION_EPISODES) {
    let state = clone(complete(episode));
    state.completed = false; state.conclusion = null;
    state = restoreInvestigation(state);
    const choices = care(state).choices.priority;
    while (state.workflow.events.length < 128) {
      const current = care(state).priority?.choiceId;
      const next = choices.find((choice) => choice.id !== current);
      assert.ok(next);
      state = chooseCarePriority(state, next.id);
      assert.ok(state);
    }
    assert.equal(chooseCarePriority(state, choices.find((choice) => choice.id !== care(state).priority.choiceId).id), null);
    state = concludeInvestigation(state, episode.resolution.hypothesisId);
    const store = memory();
    assert.equal(saveInvestigation(state, store), true, `${episode.id}: bounded workflow checkpoint remains savable`);
    assert.deepEqual(loadInvestigation(episode.id, store, 5), state);
  }
});

test('128 legitimate long structured-handoff events round trip without crossing the checkpoint bound', () => {
  for (const episode of INVESTIGATION_EPISODES) {
    let state = initial(episode);
    const sections = care(state).choices.handoff;
    const sorted = Object.fromEntries(Object.entries(sections).map(([field, section]) => [field,
      section.choices.filter((choice) => !choice.requires.length).sort((a, b) => b.id.length - a.id.length)]));
    const first = Object.fromEntries(Object.entries(sorted).map(([field, choices]) => [`${field}Id`, choices[0].id]));
    const alternatives = Object.entries(sorted).filter(([, choices]) => choices.length > 1)
      .sort((a, b) => (a[1][0].id.length - a[1][1].id.length) - (b[1][0].id.length - b[1][1].id.length));
    const [field, choices] = alternatives[0];
    const second = { ...first, [`${field}Id`]: choices[1].id };
    for (let index = 0; index < 128; index++) { state = sendCareHandoff(state, index % 2 ? first : second); assert.ok(state); }
    assert.equal(care(state).canAppend, false);
    assert.equal(sendCareHandoff(state, first), null);
    const store = memory();
    assert.equal(saveInvestigation(state, store), true, `${episode.id}: maximal handoff log remains savable`);
    assert.deepEqual(loadInvestigation(episode.id, store, 5), state);
  }
});

test('v5 and older checkpoints retain the exact 64 KiB boundary and reject oversize or wrong-edition saves', () => {
  const episode = INVESTIGATION_EPISODES[0];
  const state = complete(episode);
  const store = memory();
  assert.equal(saveInvestigation(state, store), true);
  const key = `mmInvestigation:v4:${episode.id}:5`;
  const original = store.getItem(key);
  const bytes = (text) => new TextEncoder().encode(text).length;
  const padTo = (text, size) => text + ' '.repeat(size - bytes(text));
  const exact = padTo(original, 64 * 1024);
  store.setItem(key, exact);
  assert.equal(readInvestigation(episode.id, store, 5).status, 'ok');
  assert.equal(bytes(store.getItem(key)), 64 * 1024);
  store.setItem(key, exact + ' ');
  assert.equal(readInvestigation(episode.id, store, 5).reason, 'oversize-save');
  assert.equal(saveInvestigation(state, store), false);
  assert.equal(store.getItem(key), exact + ' ');
  const old = fixture.snapshots.find((snapshot) => snapshot.episodeId === episode.id).state;
  const legacyStore = memory();
  assert.equal(saveInvestigation(old, legacyStore), true);
  const oldKey = `mmInvestigation:v4:${episode.id}:4`;
  const oldExact = padTo(legacyStore.getItem(oldKey), 64 * 1024);
  legacyStore.setItem(oldKey, oldExact);
  assert.equal(readInvestigation(episode.id, legacyStore, 4).status, 'ok');
  legacyStore.setItem(oldKey, oldExact + ' ');
  assert.equal(readInvestigation(episode.id, legacyStore, 4).reason, 'oversize-save');
  assert.equal(saveInvestigation(old, legacyStore), false);
  assert.equal(legacyStore.getItem(oldKey), oldExact + ' ');
  legacyStore.setItem(key, oldExact);
  assert.equal(readInvestigation(episode.id, legacyStore, 5).status, 'incompatible');
});

test('all nine completed current records fit together in one shared journal without evicting routes', () => {
  const store = memory();
  const completed = INVESTIGATION_EPISODES.map((episode) => complete(episode));
  for (const state of completed) assert.equal(recordCompleted(state, {confidence:null,keyActionId:null,uncertaintyId:null}, store), true, state.episodeId);
  const records = readJournal(store).records;
  assert.equal(records.length, 9);
  assert.deepEqual(new Set(records.map((record) => record.state.episodeId)), new Set(INVESTIGATION_EPISODES.map((episode) => episode.id)));
  assert.ok(new TextEncoder().encode(store.getItem('mmInvestigationJournal:v1')).length <= 512 * 1024);
});

test('seven preserved old attempts and nine new completions coexist above 512 KiB with every old row unchanged', () => {
  const v3 = JSON.parse(fs.readFileSync(new URL('./fixtures/investigation-upgrade-0.6.0.json', import.meta.url), 'utf8'));
  const old = [...fixture.records, v3.records[0]];
  assert.equal(old.length, 7);
  const key = 'mmInvestigationJournal:v1';
  const store = memory({ [key]: JSON.stringify({schema:2, records:old}) });
  const newStates = INVESTIGATION_EPISODES.map((episode) => complete(episode));
  for (const state of newStates) assert.equal(recordCompleted(state, {confidence:null,keyActionId:null,uncertaintyId:null}, store), true, state.episodeId);
  const result = readJournal(store);
  assert.equal(result.status, 'ok');
  assert.equal(result.records.length, 16);
  assert.ok(new TextEncoder().encode(store.getItem(key)).length > 512 * 1024);
  for (const original of old) {
    const identity = journalRecordIdentity(original.state, original.reflection);
    assert.deepEqual(result.records.find((record) => journalRecordIdentity(record.state, record.reflection) === identity), original);
  }
});

test('only a fully valid completed v5 row permits journal bytes above the unchanged legacy 512 KiB boundary', () => {
  const key = 'mmInvestigationJournal:v1';
  const bytes = (text) => new TextEncoder().encode(text).length;
  const pad = (text, size) => text + ' '.repeat(size - bytes(text));
  const legacyText = JSON.stringify({schema:2, records:[fixture.records[0]]});
  const legacyExact = pad(legacyText, 512 * 1024);
  const legacy = memory({[key]:legacyExact});
  assert.equal(readJournal(legacy).status, 'ok');
  legacy.setItem(key, legacyExact + ' ');
  assert.equal(readJournal(legacy).reason, 'oversize-store');
  assert.equal(recordCompleted(complete(INVESTIGATION_EPISODES[0]), {confidence:null,keyActionId:null,uncertaintyId:null}, legacy), false);
  assert.equal(legacy.getItem(key), legacyExact + ' ');
  for (const raw of ['{'.repeat(512 * 1024 + 1), JSON.stringify({unsupported:'x'.repeat(512 * 1024)})]) {
    const unknown = memory({[key]:raw});
    assert.equal(readJournal(unknown).reason, 'oversize-store');
    assert.equal(unknown.getItem(key), raw);
  }
  const validStore = memory();
  const state = complete(INVESTIGATION_EPISODES[0]);
  assert.equal(recordCompleted(state, {confidence:null,keyActionId:null,uncertaintyId:null}, validStore), true);
  const record = readJournal(validStore).records[0];
  const mutations = [
    (row) => { row.contentVersion = 999; row.state.version = 999; },
    (row) => { row.state.episodeId = 'storage-authored-v5'; },
    (row) => { row.episodeContent += ' '; },
    (row) => { row.state.completed = false; },
    (row) => { row.reflection.confidence = 101; },
    (row) => { row.transfer = {questionVersion:1,questionContent:'invented',answerId:'invented'}; },
    (row) => { row.state.workflow.events[0].invented = true; },
  ];
  for (const mutate of mutations) {
    const forged = clone(record); mutate(forged);
    const raw = pad(JSON.stringify({schema:2, records:[fixture.records[0],forged]}), 512 * 1024 + 1);
    const store = memory({[key]:raw});
    assert.equal(readJournal(store).reason, 'oversize-store');
    assert.equal(recordCompleted(state, {confidence:null,keyActionId:null,uncertaintyId:null}, store), false);
    assert.equal(store.getItem(key), raw);
    assert.equal(store.data.size, 1);
  }
});

test('v5 journals accept exactly 1 MiB and reject larger stores without writes or wider reflection limits', () => {
  const key = 'mmInvestigationJournal:v1';
  const bytes = (text) => new TextEncoder().encode(text).length;
  const pad = (text, size) => text + ' '.repeat(size - bytes(text));
  const state = complete(INVESTIGATION_EPISODES[0]);
  const blank = {confidence:null,keyActionId:null,uncertaintyId:null};
  const store = memory(); assert.equal(recordCompleted(state, blank, store), true);
  const exact = pad(store.getItem(key), 1024 * 1024);
  store.setItem(key, exact); assert.equal(readJournal(store).status, 'ok');
  store.setItem(key, exact + ' '); assert.equal(readJournal(store).reason, 'oversize-store');
  assert.equal(recordCompleted(state, blank, store), false);
  assert.equal(store.getItem(key), exact + ' ');
  const reflectionStore = memory();
  const recordedReflection = {confidence:17,keyActionId:null,uncertaintyId:null};
  assert.equal(saveReflection(state, recordedReflection, reflectionStore), true);
  const reflectionKey = `mmInvestigationReflection:v2:${state.episodeId}:5`;
  const reflectionExact = pad(reflectionStore.getItem(reflectionKey), 512 * 1024);
  reflectionStore.setItem(reflectionKey, reflectionExact);
  assert.deepEqual(loadReflection(state, reflectionStore), recordedReflection);
  reflectionStore.setItem(reflectionKey, reflectionExact + ' ');
  assert.deepEqual(loadReflection(state, reflectionStore), blank);
  assert.equal(saveReflection(state, {confidence:18,keyActionId:null,uncertaintyId:null}, reflectionStore), false);
  assert.equal(reflectionStore.getItem(reflectionKey), reflectionExact + ' ');
});

test('large eligible partial v5 journals preserve exact damaged bytes before append and retain immutable recovery', () => {
  const key = 'mmInvestigationJournal:v1';
  const state = complete(INVESTIGATION_EPISODES[0]);
  const blank = {confidence:null,keyActionId:null,uncertaintyId:null};
  const source = memory(); assert.equal(recordCompleted(state, blank, source), true);
  const valid = readJournal(source).records[0];
  const damaged = {unknownFutureContent:'preserve-' + 'x'.repeat(540 * 1024)};
  const raw = JSON.stringify({schema:2,records:[valid,damaged]});
  const store = memory({[key]:raw});
  const prior = readJournal(store);
  assert.equal(prior.status, 'partial');
  assert.ok(new TextEncoder().encode(raw).length > 512 * 1024);
  assert.equal(recordCompleted(state, {confidence:17,keyActionId:null,uncertaintyId:null}, store), true);
  const recovery = store.getItem(prior.preservationKey);
  const preserved = JSON.parse(recovery);
  assert.equal(preserved.originalJournalText, raw);
  assert.deepEqual(preserved.unreadableEntries, [damaged]);
  assert.equal(readJournal(store).records.length, 2);
  assert.equal(recordCompleted(state, {confidence:18,keyActionId:null,uncertaintyId:null}, store), true);
  assert.equal(store.getItem(prior.preservationKey), recovery);
  assert.deepEqual(readJournal(store).unreadableEntries.map((entry) => entry.value), [damaged]);
  const blocked = memory({[key]:raw,[prior.preservationKey]:' '.repeat(4 * 1024 * 1024 + 1)});
  assert.equal(recordCompleted(state, {confidence:19,keyActionId:null,uncertaintyId:null}, blocked), false);
  assert.equal(blocked.getItem(key), raw);
  assert.equal(blocked.getItem(prior.preservationKey).length, 4 * 1024 * 1024 + 1);
});

for (const [name, run] of tests) { run(); console.log(`PASS ${name}`); }
console.log(`Verified ${tests.length} v5 coordination and exact prior-edition preservation scenarios.`);
