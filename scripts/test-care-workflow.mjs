import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  getInvestigationEpisode, createInvestigation as createCurrentInvestigation, restoreInvestigation,
  investigate, availableActions, setHypothesis, concludeInvestigation, investigationDebrief,
  getCareWorkflow, chooseCarePriority, requestCareTask, advanceCareUpdate, reviewCareTask,
  reassessCare, sendCareHandoff, acknowledgeCareHandoff,
} from '../investigation.mjs';
import { V2_INVESTIGATION_CONTENT, V3_INVESTIGATION_CONTENT, getLegacyTransferQuestion } from '../investigation_content_versions.mjs';
import { getTransferQuestion } from '../investigation_transfer.mjs';
import { readInvestigation, saveInvestigation, loadInvestigation } from '../investigation_history.mjs';
import { readJournal, recordCompleted, answerTransfer, saveReflection, loadReflection } from '../investigation_journal.mjs';
import { assessInvestigationReasoning } from '../investigation_reasoning.mjs';

// Preserve all v3 scenarios exactly; test-investigation-v4.mjs covers the new current edition.
const INVESTIGATION_EPISODES = V3_INVESTIGATION_CONTENT.map(({ episode }) => episode);
const createInvestigation = (mode = 'guided', id = 'doc-002-tearing-back-investigation', version = 3) => createCurrentInvestigation(mode, id, version);
const tests = [];
const test = (name, run) => tests.push([name, run]);
const clone = (value) => JSON.parse(JSON.stringify(value));
const DOC = 'doc-002-tearing-back-investigation';
const truth = (state) => getInvestigationEpisode(state.episodeId, state.version).resolution?.hypothesisId ?? 'acute-aortic-syndrome';
const initial = (id = DOC) => createInvestigation('guided', id);
const care = (state) => { const derived = getCareWorkflow(state); assert.ok(derived); return derived; };
const choose = (choices, appropriate = true) => { const choice = choices.find((value) => value.appropriate === appropriate); assert.ok(choice); return choice.id; };
const priority = (state, appropriate = true) => chooseCarePriority(state, choose(care(state).choices.priority, appropriate));
const reassess = (state, appropriate = true) => reassessCare(state, choose(care(state).choices.reassessment, appropriate));
function selections(state, appropriate = true) {
  return Object.fromEntries(Object.entries(care(state).choices.handoff).map(([key, section]) => [`${key}Id`, choose(section.choices, appropriate)]));
}
function handoff(state, appropriate = true) { return sendCareHandoff(state, selections(state, appropriate)); }
function readback(state, appropriate = true) {
  const derived = care(state);
  return acknowledgeCareHandoff(state, derived.handoff.id, choose(derived.choices.readback, appropriate));
}
function requestAndReview(state, actionIds) {
  for (const id of actionIds) { state = requestCareTask(state, id); assert.ok(state, `Request ${id}`); }
  while (care(state).canUpdate) state = advanceCareUpdate(state);
  for (const id of actionIds) { state = reviewCareTask(state, id); assert.ok(state, `Review ${id}`); }
  return state;
}
function coordinated(id = DOC, actions = ['ecg']) {
  let state = priority(initial(id));
  state = requestAndReview(state, actions);
  state = setHypothesis(state, truth(state));
  state = reassess(state);
  state = handoff(state);
  state = readback(state);
  assert.equal(care(state).assessment.status, 'recorded');
  return state;
}
function memory(initialValues = {}) {
  const data = new Map(Object.entries(initialValues));
  return { data, get length() { return data.size; }, key: (i) => [...data.keys()][i] ?? null,
    getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: (key) => data.delete(key) };
}
const reflection = { confidence: null, keyActionId: null, uncertaintyId: null };

test('all exact v2 episodes and transfer questions were frozen before the care upgrade', () => {
  const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/investigation-v2-before-care.json', import.meta.url), 'utf8'));
  assert.deepEqual(V2_INVESTIGATION_CONTENT, fixture);
  for (const { episode, transfer } of fixture) {
    assert.equal(JSON.stringify(getInvestigationEpisode(episode.id, 2)), JSON.stringify(episode));
    assert.equal(JSON.stringify(getLegacyTransferQuestion(episode.id, 2)), JSON.stringify(transfer));
    assert.equal(JSON.stringify(getTransferQuestion(episode.id, 3)), JSON.stringify(transfer));
    assert.ok(Object.isFrozen(getInvestigationEpisode(episode.id, 2).actions));
  }
});

test('frozen v3 episodes retain nested workflow state and trusted bound profiles', () => {
  for (const episode of INVESTIGATION_EPISODES) {
    assert.equal(episode.version, 3);
    assert.equal(episode.careWorkflow.episodeId, episode.id);
    assert.ok(Object.isFrozen(episode.careWorkflow));
    assert.deepEqual(initial(episode.id).workflow, { version: 1, events: [] });
    for (const version of [1, 2]) {
      const old = createInvestigation('guided', episode.id, version);
      assert.equal(getCareWorkflow(old), null);
      assert.equal(Object.hasOwn(old, 'workflow'), false);
      assert.ok(investigate(old, getInvestigationEpisode(episode.id, version).actions[0].id));
    }
  }
});

test('independent tasks progress in parallel rounds and expose findings only after explicit review', () => {
  let state = initial();
  assert.equal(investigate(state, 'ecg'), null);
  state = requestCareTask(state, 'ecg');
  state = requestCareTask(state, 'aortic-cta');
  assert.deepEqual(state.actionIds, []);
  assert.equal(state.elapsedMinutes, 0);
  assert.equal(care(state).round, 0);
  assert.equal(availableActions(state).length, 0);
  assert.equal(care(state).tasks.find((task) => task.actionId === 'aortic-cta').finding, undefined);
  assert.equal(reviewCareTask(state, 'ecg'), null);
  state = advanceCareUpdate(state);
  assert.equal(care(state).tasks.find((task) => task.actionId === 'ecg').status, 'available');
  assert.equal(care(state).tasks.find((task) => task.actionId === 'aortic-cta').status, 'pending');
  state = investigate(state, 'ecg');
  assert.deepEqual(state.actionIds, ['ecg']);
  state = advanceCareUpdate(state);
  state = reviewCareTask(state, 'aortic-cta');
  assert.deepEqual(state.actionIds, ['ecg', 'aortic-cta']);
  assert.equal(care(state).round, 2);
  assert.match(care(state).tasks.find((task) => task.actionId === 'aortic-cta').finding, /intimal flap/);
  assert.equal(advanceCareUpdate(state), null);
});

test('requests before priority remain valid and a missing first-update priority stays visible in history', () => {
  let state = requestAndReview(initial(), ['ecg']);
  state = priority(state);
  state = setHypothesis(state, truth(state));
  state = readback(handoff(reassess(state)));
  assert.equal(care(state).assessment.status, 'recorded');
  assert.equal(care(state).priority.beforeDispatch, false);
  assert.equal(care(state).priority.beforeFirstUpdate, false);
  assert.ok(care(state).assessment.historyNotes.some((note) => /No priority.*first fictional team update/.test(note)));
});

test('priority can be corrected without erasing first attempts or requiring a fixed request order', () => {
  let state = priority(initial(), false);
  const wrong = care(state).priority.choiceId;
  assert.equal(chooseCarePriority(state, wrong), null);
  state = requestCareTask(state, 'ecg');
  state = priority(state);
  assert.equal(care(state).priorityAttempts.length, 2);
  assert.equal(care(state).priority.appropriate, true);
  assert.ok(care(state).assessment.historyNotes.some((note) => /Earlier priority/.test(note)));
});

test('reassessment can keep a hypothesis and correct a poor choice at the same evidence revision', () => {
  let state = requestAndReview(priority(initial()), ['ecg']);
  state = setHypothesis(state, truth(state));
  state = reassess(state, false);
  const wrong = care(state).latestReassessment.choiceId;
  assert.equal(reassessCare(state, wrong), null);
  const revision = care(state).knowledgeRevision;
  state = reassess(state);
  assert.equal(care(state).knowledgeRevision, revision);
  assert.equal(care(state).reassessments.length, 2);
  assert.equal(care(state).latestReassessment.hypothesisId, truth(state));
  assert.equal(care(state).reassessmentCurrent, true);
});

test('early handoff snapshots pending owners and remains a partial workflow rather than locking work', () => {
  let state = requestCareTask(initial(), 'aortic-cta');
  state = handoff(state);
  state = readback(state);
  const sent = clone(care(state).handoff);
  assert.deepEqual(sent.reviewedActionIds, []);
  assert.deepEqual(sent.pendingTaskIds, ['aortic-cta']);
  assert.equal(sent.pendingTasks[0].owner, 'ED senior clinician');
  assert.equal(care(state).assessment.status, 'incomplete');
  state = advanceCareUpdate(state);
  assert.ok(state);
  assert.equal(care(state).handoff.outdated, true);
  assert.equal(care(state).handoff.readbackCurrent, false);
  assert.deepEqual(care(state).handoff.pendingTasks, sent.pendingTasks);
});

test('a newly assigned pending task makes a prior handoff outdated without staling evidence reassessment', () => {
  let state = coordinated();
  const previous = clone(care(state).handoff);
  state = requestCareTask(state, 'aortic-cta');
  assert.equal(care(state).reassessmentCurrent, true);
  assert.equal(care(state).handoff.outdated, true);
  assert.equal(care(state).handoff.readbackCurrent, false);
  assert.deepEqual(care(state).handoff.pendingTaskIds, previous.pendingTaskIds);
  state = readback(handoff(state));
  assert.equal(care(state).assessment.status, 'recorded');
  assert.deepEqual(care(state).handoff.pendingTaskIds, ['aortic-cta']);
});

test('new reviewed findings stale synthesis and the replacement handoff contains their exact report', () => {
  let state = requestCareTask(coordinated(), 'aortic-cta');
  state = advanceCareUpdate(state);
  state = advanceCareUpdate(state);
  state = reviewCareTask(state, 'aortic-cta');
  assert.equal(care(state).reassessmentCurrent, false);
  const oldId = care(state).handoff.id;
  assert.equal(acknowledgeCareHandoff(state, oldId, choose(care(state).choices.readback)), null);
  state = reassess(state);
  state = readback(handoff(state));
  assert.equal(care(state).handoffs.length, 2);
  assert.equal(care(state).handoffs[0].outdated, true);
  assert.match(care(state).handoff.reviewedFindings.find((finding) => finding.actionId === 'aortic-cta').finding, /intimal flap/);
});

test('wrong receiver readback can be corrected for the same exact handoff with attempts retained', () => {
  let state = handoff(reassess(setHypothesis(requestAndReview(priority(initial()), ['ecg']), 'acute-aortic-syndrome')));
  state = readback(state, false);
  assert.equal(care(state).assessment.status, 'needs-review');
  const id = care(state).handoff.id;
  state = readback(state);
  assert.equal(care(state).handoff.id, id);
  assert.equal(care(state).handoff.readbackAttempts.length, 2);
  assert.equal(care(state).assessment.status, 'recorded');
  assert.ok(care(state).assessment.historyNotes.some((note) => /Earlier readback/.test(note)));
  assert.equal(readback(state), null);
});

test('amending a handoff requires receiver acknowledgment of the new revision', () => {
  let state = coordinated();
  const oldId = care(state).handoff.id;
  const changed = selections(state);
  changed.receiverId = choose(care(state).choices.handoff.receiver.choices, false);
  state = sendCareHandoff(state, changed);
  assert.equal(care(state).handoff.readback, null);
  assert.equal(acknowledgeCareHandoff(state, oldId, choose(care(state).choices.readback)), null);
  state = readback(state);
  assert.equal(care(state).assessment.status, 'needs-review');
  state = readback(handoff(state));
  assert.equal(care(state).assessment.status, 'recorded');
  assert.equal(care(state).handoffs.length, 3);
});

test('unreviewed report citations and unknown or out-of-role choices cannot enter the event log', () => {
  for (const episode of INVESTIGATION_EPISODES) {
    const state = initial(episode.id);
    const selected = selections(state);
    const gated = episode.careWorkflow.handoff.situation.choices.find((choice) => choice.requires.length);
    assert.ok(gated);
    assert.equal(sendCareHandoff(state, { ...selected, situationId: gated.id }), null);
    assert.equal(sendCareHandoff(state, { ...selected, receiverId: 'invented-clinician' }), null);
    assert.equal(chooseCarePriority(state, 'invented-choice'), null);
    assert.equal(reassessCare(state, choose(care(state).choices.reassessment)), null);
    assert.equal(requestCareTask(state, 'invented-action'), null);
    assert.equal(sendCareHandoff(state, { ...selected, acceptsTreatmentAuthority: true }), null);
  }
});

test('duplicate and impossible report transitions are rejected while action prerequisites remain meaningful', () => {
  let state = initial();
  assert.equal(requestCareTask(state, 'specialist-handoff'), null);
  assert.equal(advanceCareUpdate(state), null);
  state = requestCareTask(state, 'aortic-cta');
  assert.equal(requestCareTask(state, 'aortic-cta'), null);
  assert.equal(reviewCareTask(state, 'aortic-cta'), null);
  state = advanceCareUpdate(state);
  state = advanceCareUpdate(state);
  state = reviewCareTask(state, 'aortic-cta');
  assert.equal(reviewCareTask(state, 'aortic-cta'), null);
  assert.ok(requestCareTask(state, 'specialist-handoff'));
});

test('all cases support meaningful coordination with a single finding and unfinished tasks', () => {
  for (const episode of INVESTIGATION_EPISODES) {
    let state = coordinated(episode.id, [episode.actions[0].id]);
    assert.equal(state.actionIds.length, 1);
    state = concludeInvestigation(state, truth(state));
    assert.equal(investigationDebrief(state).careWorkflow.status, 'recorded');
    assert.equal(investigationDebrief(state).outcome.status, 'provisional');
    assert.ok(care(state).tasks.some((task) => task.status === 'unrequested'));
  }
});

test('early conclusion stays available and never earns coordination or diagnostic completion by itself', () => {
  const state = concludeInvestigation(initial(), 'acute-aortic-syndrome');
  assert.ok(state);
  const debrief = investigationDebrief(state);
  assert.equal(debrief.outcome.status, 'provisional');
  assert.equal(debrief.careWorkflow.status, 'incomplete');
  assert.equal(debrief.careWorkflow.complete, false);
  assert.equal(chooseCarePriority(state, choose(care(state).choices.priority)), null);
  assert.equal(requestCareTask(state, 'ecg'), null);
});

test('a different final hypothesis makes an earlier reassessment and handoff outdated', () => {
  const state = coordinated();
  const changed = concludeInvestigation(state, 'pulmonary-embolism');
  assert.equal(care(changed).reassessmentCurrent, false);
  assert.equal(care(changed).handoff.current, false);
  assert.equal(investigationDebrief(changed).careWorkflow.status, 'incomplete');
  assert.deepEqual(care(changed).hypothesisHistory, changed.hypothesisHistory);
});

test('workflow replay rejects arbitrary fields, future versions, impossible events and outer-state disagreement', () => {
  const state = coordinated();
  for (const mutate of [
    (s) => { s.workflow.version = 999; },
    (s) => { s.workflow.extra = true; },
    (s) => { s.workflow.events[0].feedback = 'Storage says correct'; },
    (s) => { s.workflow.events.push({ type: 'review', actionId: 'aortic-cta' }); },
    (s) => { s.workflow.events.push({ type: 'inject-report', actionId: 'aortic-cta' }); },
    (s) => { s.workflow.events.push({ type: 'update' }); },
    (s) => { s.hypothesisHistory[0].afterActionCount = 0; },
    (s) => { s.actionIds = []; s.elapsedMinutes = 0; },
    (s) => { s.workflow.events = s.workflow.events.filter((event) => event.type !== 'hypothesis'); },
    (s) => { s.workflow.events = s.workflow.events.filter((event) => event.type !== 'review'); },
  ]) {
    const changed = clone(state); mutate(changed);
    assert.equal(restoreInvestigation(changed), null);
    assert.equal(getCareWorkflow(changed), null);
  }
  assert.deepEqual(restoreInvestigation(clone(state)), state);
});

test('canonical workflow replay is bounded and cannot attach workflow to an older edition', () => {
  const state = initial();
  state.workflow.events = Array.from({ length: 129 }, (_, index) => ({ type: 'priority', choiceId: care(initial()).choices.priority[index % 2].id }));
  assert.equal(restoreInvestigation(state), null);
  for (const version of [1, 2]) {
    const old = createInvestigation('guided', DOC, version);
    assert.equal(restoreInvestigation({ ...old, workflow: { version: 1, events: [] } }), null);
  }
});

test('v3 workflow checkpoint and reflection round trip without publishing pending findings', () => {
  let state = requestCareTask(priority(initial()), 'aortic-cta');
  state = handoff(state);
  const store = memory();
  assert.equal(saveInvestigation(state, store), true);
  assert.deepEqual(loadInvestigation(DOC, store), state);
  assert.equal(saveReflection(state, reflection, store), true);
  assert.deepEqual(loadReflection(state, store), reflection);
  assert.deepEqual(care(loadInvestigation(DOC, store)).handoff.reviewedFindings, []);
  const stored = JSON.parse(store.getItem(`mmInvestigation:v2:${DOC}`));
  const altered = JSON.parse(stored.content);
  altered.careWorkflow.tasks['aortic-cta'].owner = 'Storage-authored owner';
  stored.content = JSON.stringify(altered);
  const raw = JSON.stringify(stored);
  store.setItem(`mmInvestigation:v2:${DOC}`, raw);
  assert.equal(readInvestigation(DOC, store).status, 'invalid');
  assert.equal(saveInvestigation(state, store), false);
  assert.equal(store.getItem(`mmInvestigation:v2:${DOC}`), raw);
});

test('v2 and v3 journal routes coexist and contrasts bind to their exact edition and event log', () => {
  const store = memory();
  const old = concludeInvestigation(createInvestigation('guided', DOC, 2), 'acute-aortic-syndrome');
  let current = concludeInvestigation(coordinated(), 'acute-aortic-syndrome');
  assert.equal(recordCompleted(old, reflection, store), true);
  assert.equal(recordCompleted(current, reflection, store), true);
  const question = getTransferQuestion(DOC, 3);
  const answered = answerTransfer(current, question.answerId, store, reflection);
  assert.equal(answered.contentVersion, 3);
  assert.deepEqual(answered.state.workflow, current.workflow);
  assert.deepEqual(readJournal(store).records.map((record) => record.contentVersion), [3, 2]);
  assert.deepEqual(readJournal(store).records.find((record) => record.contentVersion === 2).state, old);
  current = clone(current);
  current.workflow.events[0].choiceId = 'stored-unknown-priority';
  assert.equal(recordCompleted(current, reflection, store), false);
  assert.equal(readJournal(store).records.length, 2);
});

test('workflow quality remains separate from diagnostic and cited-evidence reasoning quality', () => {
  let state = requestAndReview(priority(initial(), false), ['aortic-cta']);
  state = setHypothesis(state, truth(state));
  state = readback(handoff(reassess(state)));
  state = concludeInvestigation(state, truth(state));
  assert.equal(investigationDebrief(state).outcome.status, 'supported');
  assert.equal(investigationDebrief(state).careWorkflow.status, 'needs-review');
  assert.equal(assessInvestigationReasoning(state, { confidence: null, keyActionId: 'aortic-cta', uncertaintyId: 'report-scope' }).status, 'explained');
});

test('reassessment variants apply only after their actual trigger report is reviewed', () => {
  for (const episode of INVESTIGATION_EPISODES) {
    const variant = episode.careWorkflow.reassessment.variants[0];
    const trigger = variant.requires[0];
    const first = episode.actions.find((action) => action.id !== trigger && action.requires.length === 0).id;
    let state = requestAndReview(priority(initial(episode.id)), [first]);
    const baseChoice = choose(care(state).choices.reassessment);
    assert.equal(care(state).reassessmentQuestion.id, undefined);
    state = reassessCare(state, baseChoice);
    assert.equal(care(state).latestReassessment.questionId, 'base');
    state = requestCareTask(state, trigger);
    assert.equal(care(state).reassessmentQuestion.id, undefined, 'requesting is not reviewing');
    while (care(state).canUpdate) state = advanceCareUpdate(state);
    assert.equal(care(state).reassessmentQuestion.id, undefined, 'availability is not review');
    state = reviewCareTask(state, trigger);
    assert.equal(care(state).reassessmentQuestion.id, variant.id);
    assert.deepEqual(care(state).choices.reassessment, variant.choices);
    assert.equal(care(state).reassessmentCurrent, false);
    assert.equal(reassessCare(state, baseChoice), null, 'a former question cannot answer the newly active one');
    state = reassess(state);
    assert.equal(care(state).latestReassessment.questionId, variant.id);
    assert.equal(care(state).reassessments[0].questionId, 'base');
    assert.deepEqual(restoreInvestigation(clone(state)), state, 'historical base choice remains valid at its event');
  }
});

test('variant wrong turns can be corrected and never add diagnostic proof by themselves', () => {
  for (const episode of INVESTIGATION_EPISODES) {
    const variant = episode.careWorkflow.reassessment.variants[0];
    let state = requestAndReview(priority(initial(episode.id)), variant.requires);
    state = setHypothesis(state, truth(state));
    state = reassess(state, false);
    assert.equal(care(state).latestReassessment.appropriate, false);
    const before = clone(state.actionIds);
    state = reassess(state);
    assert.deepEqual(state.actionIds, before);
    assert.equal(care(state).latestReassessment.appropriate, true);
    assert.equal(care(state).reassessments.length, 2);
    state = readback(handoff(state));
    state = concludeInvestigation(state, truth(state));
    assert.equal(investigationDebrief(state).careWorkflow.status, 'recorded');
    assert.equal(investigationDebrief(state).outcome.status, 'provisional');
    assert.ok(care(state).assessment.historyNotes.some((note) => /Earlier reassessment/.test(note)));
  }
});

test('all current reports can be reviewed in either available order without an imposed serial worklist', () => {
  for (const episode of INVESTIGATION_EPISODES) {
    for (const reverse of [false, true]) {
      let state = initial(episode.id);
      while (state.actionIds.length < episode.actions.length) {
        const requests = care(state).tasks.filter((task) => task.canRequest);
        for (const task of requests) state = requestCareTask(state, task.actionId);
        while (care(state).canUpdate) state = advanceCareUpdate(state);
        let ready = care(state).tasks.filter((task) => task.status === 'available');
        if (reverse) ready = ready.reverse();
        assert.ok(ready.length);
        for (const task of ready) state = reviewCareTask(state, task.actionId);
      }
      assert.deepEqual(new Set(state.actionIds), new Set(episode.actions.map((action) => action.id)));
      state = setHypothesis(state, truth(state));
      state = readback(handoff(reassess(priority(state))));
      state = concludeInvestigation(state, truth(state));
      assert.equal(investigationDebrief(state).outcome.status, 'supported');
      assert.equal(care(state).assessment.status, 'recorded');
      assert.deepEqual(restoreInvestigation(clone(state)), state);
    }
  }
});

test('an update round stales earlier synthesis even while its pending report is still unavailable', () => {
  let state = requestCareTask(coordinated(), 'aortic-cta');
  state = readback(handoff(state));
  state = advanceCareUpdate(state);
  assert.equal(care(state).tasks.find((task) => task.actionId === 'aortic-cta').status, 'pending');
  assert.equal(care(state).reassessmentCurrent, false);
  assert.equal(care(state).handoff.current, false);
  assert.deepEqual(state.actionIds, ['ecg']);
});

for (const [name, run] of tests) {
  try { run(); console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}
console.log(`Verified ${tests.length} care workflow and edition replay scenarios.`);
