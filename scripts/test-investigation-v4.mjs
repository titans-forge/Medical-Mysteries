import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createInvestigation, getInvestigationEpisode, restoreInvestigation,
  investigate, setHypothesis, concludeInvestigation, investigationOutcome, investigationDebrief,
  getCareWorkflow, requestCareTask, advanceCareUpdate, reviewCareTask, chooseCarePriority,
  reassessCare, sendCareHandoff, acknowledgeCareHandoff, respondCareUpdate,
} from '../investigation.mjs';
import { V3_INVESTIGATION_CONTENT, V4_INVESTIGATION_CONTENT, getLegacyTransferQuestion } from '../investigation_content_versions.mjs';
import { getTransferQuestion } from '../investigation_transfer.mjs';
import { replayCareWorkflow } from '../care_workflow.mjs';
import { reasoningChoices, assessInvestigationReasoning } from '../investigation_reasoning.mjs';
import { saveInvestigation, loadInvestigation, readInvestigation, listInvestigationSaves, loadInvestigationVersion, clearInvestigation } from '../investigation_history.mjs';
import {
  readJournal, exportJournal, recordCompleted, answerTransfer, transferPracticeStatus,
  saveReflection, loadReflection, journalRecordIdentity,
} from '../investigation_journal.mjs';

// This suite verifies the immutable shipped 0.7 / content v4 edition.
const INVESTIGATION_EPISODES = V4_INVESTIGATION_CONTENT.map(({ episode }) => episode);
const tests = [];
const test = (name, run) => tests.push([name, run]);
const clone = (value) => JSON.parse(JSON.stringify(value));
const v3Content = JSON.parse(fs.readFileSync(new URL('./fixtures/investigation-v3-before-variants.json', import.meta.url), 'utf8'));
const v3Exports = JSON.parse(fs.readFileSync(new URL('./fixtures/investigation-upgrade-0.6.0.json', import.meta.url), 'utf8'));
const blank = { confidence: null, keyActionId: null, uncertaintyId: null };
const initial = (episode) => createInvestigation('guided', episode.id, episode.version);
const care = (state) => { const value = getCareWorkflow(state); assert.ok(value); return value; };
const good = (choices) => { const value = choices.find((choice) => choice.appropriate); assert.ok(value); return value.id; };
const bad = (choices) => { const value = choices.find((choice) => !choice.appropriate); assert.ok(value); return value.id; };
function handoff(state) {
  const sections = care(state).choices.handoff;
  return sendCareHandoff(state, Object.fromEntries(Object.entries(sections).map(([id, section]) => [`${id}Id`, good(section.choices)])));
}
function readback(state) { return acknowledgeCareHandoff(state, care(state).handoff.id, good(care(state).choices.readback)); }
function complete(episode, { reverse = false, respond = true } = {}) {
  let state = initial(episode);
  state = chooseCarePriority(state, good(care(state).choices.priority));
  while (state.actionIds.length < episode.actions.length) {
    for (const task of care(state).tasks.filter((value) => value.canRequest)) state = requestCareTask(state, task.actionId);
    while (care(state).canUpdate) state = advanceCareUpdate(state);
    let ready = care(state).tasks.filter((task) => task.status === 'available');
    if (reverse) ready.reverse();
    assert.ok(ready.length);
    for (const task of ready) state = reviewCareTask(state, task.actionId);
  }
  state = setHypothesis(state, episode.resolution.hypothesisId);
  if (respond) for (const update of care(state).patientUpdates) state = respondCareUpdate(state, update.id, good(update.choices));
  state = reassessCare(state, good(care(state).choices.reassessment));
  state = readback(handoff(state));
  return concludeInvestigation(state, episode.resolution.hypothesisId);
}
function memory(initialValues = {}) {
  const data = new Map(Object.entries(initialValues));
  return { data, get length() { return data.size; }, key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: (key) => data.delete(key) };
}
function stamp(store, assignments) {
  const parsed = JSON.parse(store.getItem('mmInvestigationJournal:v1'));
  for (const record of parsed.records) {
    const identity = journalRecordIdentity(record.state, record.reflection);
    if (assignments.has(identity)) record.completedUtc = assignments.get(identity);
  }
  store.setItem('mmInvestigationJournal:v1', JSON.stringify(parsed));
}
const first = () => INVESTIGATION_EPISODES[0];
const another = () => INVESTIGATION_EPISODES.find((episode) => episode.id !== first().id);
const shallowCompletion = (episode) => concludeInvestigation(initial(episode), episode.resolution.hypothesisId);

test('all three exact v3 episodes, profiles and questions remain trusted frozen content', () => {
  assert.deepEqual(V3_INVESTIGATION_CONTENT, v3Content);
  for (const { episode, transfer } of v3Content) {
    assert.equal(JSON.stringify(getInvestigationEpisode(episode.id, 3)), JSON.stringify(episode));
    assert.equal(JSON.stringify(getLegacyTransferQuestion(episode.id, 3)), JSON.stringify(transfer));
    assert.equal(JSON.stringify(getTransferQuestion(episode.id, 3)), JSON.stringify(transfer));
    assert.ok(Object.isFrozen(getInvestigationEpisode(episode.id, 3).careWorkflow));
  }
});

test('genuine prior v3 active/completed exports retain exact state, feedback, outcomes, reflections and answers', () => {
  const store = memory(v3Exports.storage);
  const before = Object.fromEntries(store.data);
  for (const snapshot of v3Exports.snapshots) {
    assert.deepEqual(restoreInvestigation(snapshot.active), snapshot.active);
    assert.deepEqual(restoreInvestigation(snapshot.state), snapshot.state);
    assert.deepEqual(investigationOutcome(snapshot.state), snapshot.outcome);
    assert.deepEqual(investigationDebrief(snapshot.state), snapshot.debrief);
    assert.deepEqual(getCareWorkflow(snapshot.state), snapshot.care);
    assert.deepEqual(loadInvestigation(snapshot.episodeId, store), snapshot.state);
    assert.deepEqual(loadReflection(snapshot.state, store), snapshot.reflection);
    assert.equal(recordCompleted(snapshot.state, snapshot.reflection, store), true);
    const record = v3Exports.records.find((value) => value.state.episodeId === snapshot.episodeId);
    const changedAnswer = getTransferQuestion(snapshot.episodeId, 3).choices.find((value) => value.id !== record.transfer.answerId).id;
    assert.deepEqual(answerTransfer(snapshot.state, changedAnswer, store, snapshot.reflection), record);
  }
  assert.deepEqual(readJournal(store).records, v3Exports.records);
  const exported = exportJournal(store);
  exported.exportedUtc = v3Exports.journalExport.exportedUtc;
  assert.deepEqual(exported, v3Exports.journalExport);
  assert.deepEqual(Object.fromEntries(store.data), before, 'supported old reads and first-answer dedupe never migrate saved bytes');
});

test('six current records use three presentation families and exact independent IDs with matched hypothesis choices', () => {
  assert.equal(INVESTIGATION_EPISODES.length, 6);
  assert.equal(new Set(INVESTIGATION_EPISODES.map((episode) => episode.id)).size, 6);
  const families = new Map();
  for (const episode of INVESTIGATION_EPISODES) {
    assert.equal(episode.version, 4);
    assert.equal(getInvestigationEpisode(episode.id, 4), episode);
    assert.ok(Object.isFrozen(episode.careWorkflow.patientUpdates));
    assert.equal(episode.careWorkflow.episodeId, episode.id);
    const members = families.get(episode.familyId) ?? [];
    members.push(episode); families.set(episode.familyId, members);
    if (episode.id.endsWith('-record-b')) assert.equal(getInvestigationEpisode(episode.id, 3), null);
  }
  assert.equal(families.size, 3);
  for (const [familyId, records] of families) {
    assert.equal(records.length, 2);
    assert.ok(records.some((episode) => episode.id === familyId));
    assert.ok(records.some((episode) => episode.id === `${familyId}-record-b`));
    assert.deepEqual(records[0].hypotheses, records[1].hypotheses);
    assert.ok(records[0].hypotheses.some((hypothesis) => hypothesis.id === 'cause-unresolved'));
    assert.notEqual(records[0].resolution.hypothesisId, records[1].resolution.hypothesisId);
  }
});

test('all six records complete and cold replay in both report-reading orders with separate coordination and evidence', () => {
  for (const episode of INVESTIGATION_EPISODES) {
    for (const reverse of [false, true]) {
      const state = complete(episode, { reverse });
      assert.deepEqual(restoreInvestigation(clone(state)), state);
      assert.equal(investigationOutcome(state).status, 'supported');
      assert.equal(care(state).assessment.status, 'recorded');
      assert.equal(care(state).patientUpdates.length, 1);
      assert.equal(care(state).patientUpdates[0].response.appropriate, true);
      assert.deepEqual(new Set(state.actionIds), new Set(episode.actions.map((action) => action.id)));
      const store = memory();
      assert.equal(saveInvestigation(state, store), true);
      assert.deepEqual(loadInvestigation(episode.id, store), state);
      assert.equal(saveReflection(state, blank, store), true);
      assert.deepEqual(loadReflection(state, store), blank);
      assert.equal(recordCompleted(state, blank, store), true);
      assert.deepEqual(readJournal(store).records[0].state, state);
    }
  }
});

test('a memorized counterpart answer fails after the actual different findings are reviewed', () => {
  for (const episode of INVESTIGATION_EPISODES) {
    const counterpart = INVESTIGATION_EPISODES.find((value) => value.familyId === episode.familyId && value.id !== episode.id);
    const correct = complete(episode);
    const active = clone(correct); active.completed = false; active.conclusion = null;
    const state = concludeInvestigation(active, counterpart.resolution.hypothesisId);
    assert.equal(state.conclusion.correct, false);
    assert.equal(investigationOutcome(state).status, 'reconsider');
    const choices = reasoningChoices(state);
    for (const support of choices.supports) for (const uncertainty of choices.uncertainties) {
      const assessed = assessInvestigationReasoning(state, { confidence: 100, keyActionId: support.id, uncertaintyId: uncertainty.id });
      assert.notEqual(assessed.status, 'explained');
      assert.notEqual(assessed.status, 'bounded');
    }
  }
});

test('supported unresolved judgments require the supplied limiting reports and never imply confirmed pathology', () => {
  const limited = INVESTIGATION_EPISODES.filter((episode) => episode.resolution.conclusionKind === 'unresolved');
  assert.equal(limited.length, 2);
  for (const episode of limited) {
    const openingOnly = shallowCompletion(episode);
    assert.equal(investigationOutcome(openingOnly).status, 'provisional');
    assert.equal(investigationOutcome(openingOnly).clinicalConfirmation, false);
    const state = complete(episode);
    const outcome = investigationOutcome(state);
    assert.equal(outcome.kind, 'unresolved');
    assert.equal(outcome.status, 'supported');
    assert.equal(outcome.clinicalConfirmation, false);
    assert.match(outcome.label, /cause unresolved/);
    const debrief = investigationDebrief(state);
    assert.equal(debrief.kind, 'unresolved');
    assert.equal(debrief.clinicalConfirmation, false);
    const choices = reasoningChoices(state);
    const support = choices.supports.find((value) => value.strength === 'decisive' && value.supports.includes('cause-unresolved'));
    assert.ok(support);
    const positive = choices.uncertainties.map((uncertainty) => assessInvestigationReasoning(state, { confidence: 65, keyActionId: support.id, uncertaintyId: uncertainty.id }))
      .find((value) => value.status === 'explained');
    assert.ok(positive, 'the complete limitation can be correctly explained');
    assert.match(positive.feedback, /does not confirm a diagnosis/);
  }
});

test('patient changes release once on a fictional round, never on dispatch or into earlier handoffs', () => {
  for (const episode of INVESTIGATION_EPISODES) {
    let state = initial(episode);
    const definition = episode.careWorkflow.patientUpdates[0];
    assert.deepEqual(care(state).patientUpdates, []);
    assert.equal(respondCareUpdate(state, definition.id, good(definition.choices)), null);
    state = requestCareTask(state, care(state).tasks.find((task) => task.canRequest).actionId);
    state = readback(handoff(state));
    const old = clone(care(state).handoff);
    assert.deepEqual(old.patientUpdates, []);
    assert.deepEqual(care(state).patientUpdates, []);
    state = advanceCareUpdate(state);
    assert.equal(care(state).patientUpdates.length, 1);
    assert.equal(care(state).patientUpdates[0].text, definition.text);
    assert.equal(care(state).handoff.outdated, true);
    assert.deepEqual(care(state).handoff.patientUpdates, []);
    assert.equal(care(state).handoff.readback.choiceId, old.readback.choiceId);
    state = handoff(state);
    assert.equal(care(state).handoff.patientUpdates[0].text, definition.text);
    assert.equal(care(state).handoff.patientUpdates[0].response, null);
  }
});

test('patient-response corrections retain attempts, stale only coordination, and do not retrofit a handoff', () => {
  let state = initial(first());
  state = advanceCareUpdate(state);
  state = readback(handoff(state));
  const update = care(state).patientUpdates[0];
  const revision = care(state).knowledgeRevision;
  const old = clone(care(state).handoff);
  state = respondCareUpdate(state, update.id, bad(update.choices));
  assert.equal(care(state).knowledgeRevision, revision);
  assert.equal(care(state).handoff.outdated, true);
  assert.deepEqual(care(state).handoff.patientUpdates, old.patientUpdates);
  assert.equal(care(state).pendingPatientUpdate.id, update.id);
  assert.equal(respondCareUpdate(state, update.id, bad(update.choices)), null);
  state = respondCareUpdate(state, update.id, good(update.choices));
  assert.equal(care(state).patientUpdates[0].responseAttempts.length, 2);
  assert.equal(care(state).pendingPatientUpdate, null);
  assert.ok(care(state).assessment.historyNotes.some((note) => /Earlier patient update response/.test(note)));
  state = handoff(state);
  assert.equal(care(state).handoff.patientUpdates[0].response.appropriate, true);
});

test('a complete report reassessment and readback cannot hide an omitted patient-change response', () => {
  for (const episode of INVESTIGATION_EPISODES) {
    const state = complete(episode, { respond: false });
    assert.equal(care(state).reassessmentCurrent, true);
    assert.equal(care(state).handoff.readbackCurrent, true);
    assert.equal(investigationOutcome(state).status, 'supported');
    assert.equal(care(state).assessment.status, 'incomplete');
    assert.ok(care(state).assessment.missing.some((text) => /Patient update response/.test(text)));
    assert.equal(investigationDebrief(state).patientUpdates[0].response, null);
  }
});

test('a late reviewed gate releases exactly once and future authored changes remain reachable without report work', () => {
  const episode = clone(first());
  const trigger = episode.actions.find((action) => !action.requires.length).id;
  episode.careWorkflow.patientUpdates[0].requiresReviewed = [trigger];
  let raw = { version: 1, events: [{ type: 'request', actionId: trigger }, { type: 'update' }] };
  let derived = replayCareWorkflow(raw, episode);
  assert.ok(derived);
  assert.deepEqual(derived.patientUpdates, []);
  assert.equal(derived.assessment.missing.some((text) => /Patient update response/.test(text)), false);
  raw.events.push({ type: 'review', actionId: trigger });
  derived = replayCareWorkflow(raw, episode);
  assert.equal(derived.patientUpdates.length, 1);
  assert.equal(derived.patientUpdates[0].releasedAtEvent, 2);
  const late = clone(first()); late.careWorkflow.patientUpdates[0].afterRound = 3;
  const steps = { version: 1, events: [{ type: 'update' }, { type: 'update' }, { type: 'update' }] };
  assert.equal(replayCareWorkflow({ version: 1, events: [] }, late).canUpdate, true);
  assert.equal(replayCareWorkflow(steps, late).patientUpdates.length, 1);
  steps.events.push({ type: 'update' });
  assert.equal(replayCareWorkflow(steps, late), null);
});

test('strict replay rejects invented, premature, duplicate and older-edition patient-response events', () => {
  let state = advanceCareUpdate(initial(first()));
  const update = care(state).patientUpdates[0];
  state = respondCareUpdate(state, update.id, good(update.choices));
  for (const event of [
    { type: 'patient-response', updateId: 'storage-update', choiceId: good(update.choices) },
    { type: 'patient-response', updateId: update.id, choiceId: 'storage-choice' },
    { type: 'patient-response', updateId: update.id, choiceId: good(update.choices) },
    { type: 'patient-response', updateId: update.id, choiceId: bad(update.choices), reportsReviewed: true },
  ]) {
    const changed = clone(state); changed.workflow.events.push(event);
    assert.equal(restoreInvestigation(changed), null);
  }
  const premature = initial(first()); premature.workflow.events.push({ type: 'patient-response', updateId: update.id, choiceId: good(update.choices) });
  assert.equal(restoreInvestigation(premature), null);
  const old = createInvestigation('guided', first().familyId, 3);
  old.workflow.events.push({ type: 'patient-response', updateId: update.id, choiceId: good(update.choices) });
  assert.equal(restoreInvestigation(old), null);
});

test('record identity and storage binding never substitute another arrival from the same family', () => {
  const a = first();
  const b = INVESTIGATION_EPISODES.find((episode) => episode.familyId === a.familyId && episode.id !== a.id);
  const stateA = complete(a); const stateB = complete(b);
  const store = memory();
  assert.equal(saveInvestigation(stateA, store), true);
  assert.equal(saveInvestigation(stateB, store), true);
  assert.deepEqual(loadInvestigation(a.id, store), stateA);
  assert.deepEqual(loadInvestigation(b.id, store), stateB);
  const keyB = `mmInvestigation:v4:${b.id}:4`;
  const changed = JSON.parse(store.getItem(keyB));
  changed.state.episodeId = a.id;
  const raw = JSON.stringify(changed); store.setItem(keyB, raw);
  assert.equal(loadInvestigation(b.id, store), null);
  assert.equal(saveInvestigation(stateB, store), false);
  assert.equal(store.getItem(keyB), raw);
  assert.notEqual(journalRecordIdentity(stateA, blank), journalRecordIdentity(stateB, blank));
});

test('all six transfer questions bind to their exact v4 records and defer the first answer', () => {
  for (const episode of INVESTIGATION_EPISODES) {
    const question = getTransferQuestion(episode.id, 4);
    assert.equal(question, episode.transferQuestion);
    assert.equal(question.delivery, 'after-another-arrival');
    assert.ok(question.choices.some((choice) => choice.id === question.answerId));
    assert.equal(getTransferQuestion(episode.id, 999), null);
    const state = shallowCompletion(episode); const store = memory();
    assert.equal(transferPracticeStatus(state, blank, []).status, 'locked');
    assert.equal(recordCompleted(state, blank, store), true);
    const before = store.getItem('mmInvestigationJournal:v1');
    assert.equal(transferPracticeStatus(state, blank, readJournal(store).records).status, 'locked');
    assert.equal(answerTransfer(state, question.answerId, store, blank), null);
    assert.equal(store.getItem('mmInvestigationJournal:v1'), before);
  }
});

test('a later different arrival unlocks only the exact earlier reflection and keeps the first answer', () => {
  const state = shallowCompletion(first()); const later = shallowCompletion(another()); const store = memory();
  const alternate = { ...blank, confidence: 60 };
  assert.equal(recordCompleted(state, blank, store), true);
  assert.equal(recordCompleted(state, alternate, store), true);
  assert.equal(recordCompleted(later, blank, store), true);
  stamp(store, new Map([
    [journalRecordIdentity(state, blank), '2026-10-16T10:00:00.000Z'],
    [journalRecordIdentity(later, blank), '2026-10-16T10:01:00.000Z'],
    [journalRecordIdentity(state, alternate), '2026-10-16T10:02:00.000Z'],
  ]));
  let records = readJournal(store).records;
  assert.equal(transferPracticeStatus(state, blank, records).status, 'ready');
  assert.equal(transferPracticeStatus(state, alternate, records).status, 'locked');
  const question = getTransferQuestion(state.episodeId, 4);
  assert.equal(answerTransfer(state, question.answerId, store, alternate), null);
  const firstAnswer = question.choices.find((choice) => choice.id !== question.answerId).id;
  const answered = answerTransfer(state, firstAnswer, store, blank);
  assert.equal(answered.transfer.answerId, firstAnswer);
  assert.equal(answerTransfer(state, question.answerId, store, blank).transfer.answerId, firstAnswer);
  records = readJournal(store).records;
  assert.equal(transferPracticeStatus(state, blank, records).status, 'answered');
  assert.equal(transferPracticeStatus(later, blank, records).status, 'ready', 'the newer alternate reflection is still a different completed arrival for the later record');
});

test('same-arrival reflections, equal/earlier timestamps and malformed later records cannot unlock practice', () => {
  const source = shallowCompletion(first()); const later = shallowCompletion(another()); const store = memory();
  assert.equal(recordCompleted(source, blank, store), true);
  assert.equal(recordCompleted(source, { ...blank, confidence: 80 }, store), true);
  assert.equal(recordCompleted(later, blank, store), true);
  stamp(store, new Map([
    [journalRecordIdentity(source, blank), '2026-10-16T10:00:00.000Z'],
    [journalRecordIdentity(source, { ...blank, confidence: 80 }), '2026-10-16T10:01:00.000Z'],
    [journalRecordIdentity(later, blank), '2026-10-16T10:00:00.000Z'],
  ]));
  const records = readJournal(store).records;
  assert.equal(transferPracticeStatus(source, blank, records).status, 'locked');
  const forged = clone(records.find((record) => record.state.episodeId === later.episodeId));
  forged.completedUtc = '2026-10-16T10:05:00.000Z'; forged.episodeContent = '{}';
  assert.equal(transferPracticeStatus(source, blank, [...records, forged]).status, 'locked');
  assert.equal(transferPracticeStatus(source, { ...blank, confidence: 99 }, records).status, 'locked');
});

test('old v3 immediate contrast practice remains available without a different completed arrival', () => {
  const snapshot = v3Exports.snapshots[0];
  const store = memory();
  assert.equal(recordCompleted(snapshot.state, snapshot.reflection, store), true);
  const status = transferPracticeStatus(snapshot.state, snapshot.reflection, readJournal(store).records);
  assert.equal(status.status, 'ready'); assert.equal(status.deferred, false);
  const question = getTransferQuestion(snapshot.episodeId, 3);
  assert.ok(answerTransfer(snapshot.state, question.answerId, store, snapshot.reflection));
});

test('a new v4 checkpoint preserves the paused v3 original and supports explicit edition resume', () => {
  const paused = v3Exports.snapshots[0].active;
  const store = memory();
  assert.equal(saveInvestigation(paused, store), true);
  const oldKey = `mmInvestigation:v2:${paused.episodeId}`;
  const oldRaw = store.getItem(oldKey);
  let current = createInvestigation('guided', paused.episodeId, 4);
  current = requestCareTask(current, care(current).tasks.find((task) => task.canRequest).actionId);
  assert.equal(saveInvestigation(current, store), true);
  assert.equal(store.getItem(oldKey), oldRaw);
  assert.deepEqual(loadInvestigation(paused.episodeId, store), current);
  assert.deepEqual(loadInvestigation(paused.episodeId, store, 3), paused);
  assert.deepEqual(loadInvestigationVersion(paused.episodeId, 3, store), paused);
  assert.deepEqual(listInvestigationSaves(paused.episodeId, store).map((state) => state.version), [4, 3]);
  assert.equal(readInvestigation(paused.episodeId, store, 3).rawText, oldRaw);
});

test('a damaged or future current checkpoint blocks default fallback but leaves explicit old resume readable', () => {
  const paused = v3Exports.snapshots[0].active;
  for (const raw of ['{damaged new save', JSON.stringify({ schema: 999, state: { version: 999 } })]) {
    const store = memory();
    assert.equal(saveInvestigation(paused, store), true);
    const oldRaw = store.getItem(`mmInvestigation:v2:${paused.episodeId}`);
    const key = `mmInvestigation:v4:${paused.episodeId}:4`;
    store.setItem(key, raw);
    assert.equal(loadInvestigation(paused.episodeId, store), null);
    assert.equal(readInvestigation(paused.episodeId, store).rawText, raw);
    assert.deepEqual(loadInvestigation(paused.episodeId, store, 3), paused);
    assert.deepEqual(listInvestigationSaves(paused.episodeId, store).map((state) => state.version), [3]);
    assert.equal(saveInvestigation(createInvestigation('guided', paused.episodeId, 4), store), false);
    assert.equal(store.getItem(key), raw);
    assert.equal(store.getItem(`mmInvestigation:v2:${paused.episodeId}`), oldRaw);
  }
});

test('an identical replay keeps its first saved date and cannot fabricate a later practice unlock', () => {
  const source = shallowCompletion(first()); const prior = shallowCompletion(another()); const store = memory();
  assert.equal(recordCompleted(prior, blank, store), true);
  assert.equal(recordCompleted(source, blank, store), true);
  stamp(store, new Map([
    [journalRecordIdentity(prior, blank), '2026-10-16T10:00:00.000Z'],
    [journalRecordIdentity(source, blank), '2026-10-16T10:01:00.000Z'],
  ]));
  const before = store.getItem('mmInvestigationJournal:v1');
  assert.equal(transferPracticeStatus(source, blank, readJournal(store).records).status, 'locked');
  assert.equal(recordCompleted(prior, blank, store), true);
  assert.equal(store.getItem('mmInvestigationJournal:v1'), before);
  assert.equal(transferPracticeStatus(source, blank, readJournal(store).records).status, 'locked');
  const changed = { ...blank, confidence: 50 };
  assert.equal(recordCompleted(prior, changed, store), true);
  stamp(store, new Map([[journalRecordIdentity(prior, changed), '2026-10-16T10:02:00.000Z']]));
  const records = readJournal(store).records;
  assert.equal(records.find((record) => journalRecordIdentity(record.state, record.reflection) === journalRecordIdentity(prior, blank)).completedUtc, '2026-10-16T10:00:00.000Z');
  assert.equal(transferPracticeStatus(source, blank, records).status, 'ready');
});

test('continuing a global v1 route cannot overwrite a paused shared-slot v3 route', () => {
  const paused = v3Exports.snapshots[0].active;
  const store = memory();
  assert.equal(saveInvestigation(paused, store), true);
  const sharedKey = `mmInvestigation:v2:${paused.episodeId}`;
  const sharedRaw = store.getItem(sharedKey);
  const old = createInvestigation('guided', paused.episodeId, 1);
  const globalRaw = JSON.stringify({ schema: 1, content: JSON.stringify(getInvestigationEpisode(old.episodeId, 1)),
    savedUtc: '2026-10-16T10:00:00.000Z', state: old });
  store.setItem('mmInvestigation:v1', globalRaw);
  assert.deepEqual(listInvestigationSaves(paused.episodeId, store).map((state) => state.version), [3, 1]);
  const resumed = loadInvestigation(paused.episodeId, store, 1);
  // v1 retains its original immediate investigation action contract.
  const continued = investigate(resumed, 'ecg');
  assert.ok(restoreInvestigation(continued));
  assert.equal(saveInvestigation(continued, store), true);
  assert.equal(store.getItem(sharedKey), sharedRaw);
  assert.equal(store.getItem('mmInvestigation:v1'), globalRaw);
  assert.deepEqual(loadInvestigation(paused.episodeId, store, 1), continued);
  assert.deepEqual(loadInvestigation(paused.episodeId, store, 3), paused);
  assert.deepEqual(listInvestigationSaves(paused.episodeId, store).map((state) => state.version), [3, 1]);
  assert.equal(saveInvestigation(continued, store), true);
  assert.equal(store.getItem(sharedKey), sharedRaw);
  const v3Continued = setHypothesis(paused, 'acute-aortic-syndrome');
  assert.equal(saveInvestigation(v3Continued, store), true);
  const v3Raw = store.getItem(sharedKey);
  const v1Again = investigate(continued, 'symptom-timeline');
  assert.equal(saveInvestigation(v1Again, store), true);
  assert.equal(store.getItem(sharedKey), v3Raw);
  assert.equal(store.getItem('mmInvestigation:v1'), globalRaw);
  assert.deepEqual(loadInvestigation(paused.episodeId, store, 1), v1Again);
  assert.deepEqual(loadInvestigation(paused.episodeId, store, 3), v3Continued);
});

test('a damaged legacy continuation blocks its own fallback and clear covers known sidecars only', () => {
  const paused = v3Exports.snapshots[0].active; const store = memory();
  assert.equal(saveInvestigation(paused, store), true);
  const old = createInvestigation('guided', paused.episodeId, 1);
  const globalRaw = JSON.stringify({ schema: 1, content: JSON.stringify(getInvestigationEpisode(old.episodeId, 1)),
    savedUtc: '2026-10-16T10:00:00.000Z', state: old });
  store.setItem('mmInvestigation:v1', globalRaw);
  const key = `mmInvestigation:v4:${paused.episodeId}:1`;
  store.setItem(key, '{damaged continuation');
  assert.equal(loadInvestigation(paused.episodeId, store, 1), null);
  assert.equal(readInvestigation(paused.episodeId, store, 1).rawText, '{damaged continuation');
  assert.equal(saveInvestigation(investigate(old, 'ecg'), store), false);
  assert.equal(store.getItem(key), '{damaged continuation');
  assert.equal(store.getItem('mmInvestigation:v1'), globalRaw);
  assert.deepEqual(loadInvestigation(paused.episodeId, store, 3), paused);
  assert.deepEqual(listInvestigationSaves(paused.episodeId, store).map((state) => state.version), [3]);
  assert.equal(saveInvestigation(createInvestigation('guided', paused.episodeId, 4), store), true);
  store.setItem('mmProfile', 'keep'); store.setItem('mmInvestigation:v4:unrelated:4', 'keep');
  assert.equal(clearInvestigation(paused.episodeId, store), true);
  assert.equal(store.getItem(key), null);
  assert.equal(store.getItem('mmInvestigation:v1'), null);
  assert.equal(store.getItem(`mmInvestigation:v2:${paused.episodeId}`), null);
  assert.equal(store.getItem(`mmInvestigation:v4:${paused.episodeId}:4`), null);
  assert.equal(store.getItem('mmProfile'), 'keep');
  assert.equal(store.getItem('mmInvestigation:v4:unrelated:4'), 'keep');
});

test('a valid wrong-edition checkpoint inside an exact sidecar is preserved rather than overwritten', () => {
  const id = first().familyId;
  const v2 = createInvestigation('guided', id, 2); const source = memory();
  assert.equal(saveInvestigation(v2, source), true);
  const raw = source.getItem(`mmInvestigation:v2:${id}`);
  const store = memory({ [`mmInvestigation:v4:${id}:1`]: raw });
  assert.equal(readInvestigation(id, store, 1).status, 'incompatible');
  assert.equal(saveInvestigation(createInvestigation('guided', id, 1), store), false);
  assert.equal(store.getItem(`mmInvestigation:v4:${id}:1`), raw);
});

for (const [name, run] of tests) {
  try { run(); console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}
console.log(`Verified ${tests.length} current-arrival, patient-update and preserved-v3 scenarios.`);
