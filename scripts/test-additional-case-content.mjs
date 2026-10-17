import assert from 'node:assert/strict';
import { ADDITIONAL_INVESTIGATIONS as CURRENT_ADDITIONAL_INVESTIGATIONS } from '../investigation_cases.mjs';
import {
  createInvestigation, investigate, concludeInvestigation, getInvestigationEpisode,
  investigationOutcome, investigationDebrief,
} from '../investigation.mjs';
import { reasoningChoices, assessInvestigationReasoning } from '../investigation_reasoning.mjs';
import { saveReflection, loadReflection } from '../investigation_journal.mjs';

// Preserve the diagnostic/reasoning v2 contract; care-workflow tests cover current v3.
const ADDITIONAL_INVESTIGATIONS = CURRENT_ADDITIONAL_INVESTIGATIONS.map((episode) => getInvestigationEpisode(episode.id, 2));
const tests = [];
const test = (name, run) => tests.push([name, run]);
const STROKE = 'pub-003-missed-turn-investigation';
const METABOLIC = 'stu-003-after-weekend-investigation';
const TRIAD = ['plasma-glucose', 'blood-ketones', 'acid-base'];
const GROUP = 'pattern:metabolic-triad';
const positive = new Set(['bounded', 'explained']);
const reflection = (keyActionId, uncertaintyId) => ({ confidence: null, keyActionId, uncertaintyId });
const assessment = (state, keyActionId, uncertaintyId) => assessInvestigationReasoning(state, reflection(keyActionId, uncertaintyId));
const openingFor = (episodeId) => getInvestigationEpisode(episodeId, 2).reasoning.openingFacts[0].id;

function route(episodeId, actions, hypothesis, { mode = 'guided', version = 2, complete = true } = {}) {
  let state = createInvestigation(mode, episodeId, version);
  assert.ok(state);
  for (const action of actions) {
    state = investigate(state, action);
    assert.ok(state, `Action must be available without an invented sequence: ${action}`);
  }
  return complete ? concludeInvestigation(state, hypothesis) : state;
}

function memory() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: (key) => { values.delete(key); },
  };
}

test('new versions retain all prior clinical findings and stable action/hypothesis identities', () => {
  for (const current of ADDITIONAL_INVESTIGATIONS) {
    const legacy = getInvestigationEpisode(current.id, 1);
    assert.equal(current.version, 2);
    assert.ok(legacy);
    assert.equal(legacy.version, 1);
    assert.equal(legacy.reasoning, undefined);
    assert.equal(current.opening, legacy.opening);
    assert.deepEqual(current.actions, legacy.actions);
    assert.deepEqual(current.hypotheses.map((item) => item.id), legacy.hypotheses.map((item) => item.id));
    for (const hypothesis of current.hypotheses) {
      if (hypothesis.id === 'hyperosmolar-state') assert.equal(hypothesis.label, 'Hyperglycemic hyperosmolar state (HHS) alone');
      else assert.deepEqual(hypothesis, legacy.hypotheses.find((item) => item.id === hypothesis.id));
    }
    assert.equal(current.resolution.hypothesisId, legacy.resolution.hypothesisId);
    assert.deepEqual(current.resolution.evidenceActionIds, legacy.resolution.evidenceActionIds);
    assert.ok(Object.isFrozen(current.reasoning));
    assert.ok(Object.isFrozen(current.reasoning.supportRules));
    assert.ok(Object.isFrozen(legacy.actions));
  }
});

test('evidence and limitation metadata refer only to authored actions and hypotheses', () => {
  for (const current of ADDITIONAL_INVESTIGATIONS) {
    const actionIds = new Set(current.actions.map((action) => action.id));
    const hypothesisIds = new Set(current.hypotheses.map((hypothesis) => hypothesis.id));
    const reasoning = current.reasoning;
    assert.deepEqual(new Set(Object.keys(reasoning.supportRules)), actionIds);
    assert.ok(reasoning.prompt.length > 20);
    assert.ok(reasoning.caseLearningText.length > 20);
    for (const fact of [...reasoning.openingFacts, ...Object.values(reasoning.supportRules), ...(reasoning.supportGroups || [])]) {
      assert.ok(Array.isArray(fact.supports));
      assert.ok(fact.supports.every((id) => hypothesisIds.has(id)));
      assert.ok((fact.conflictsWith || []).every((id) => hypothesisIds.has(id)));
      assert.ok((fact.requires || []).every((id) => actionIds.has(id)));
    }
    assert.equal(new Set(reasoning.uncertaintyOptions.map((option) => option.id)).size, reasoning.uncertaintyOptions.length);
    for (const option of reasoning.uncertaintyOptions) {
      assert.ok(option.requires.every((id) => actionIds.has(id)));
      assert.ok((option.missingAny || []).every((id) => actionIds.has(id)));
      assert.ok((option.forHypotheses || []).every((id) => hypothesisIds.has(id)));
      assert.ok(['provisional', 'supported', 'any', 'unsupported'].includes(option.scope));
    }
    for (const source of current.sources) {
      assert.ok(Number.isFinite(Date.parse(source.checkedUtc)));
      assert.match(source.url, /^https:\/\/(?:www\.nice\.org\.uk|www\.ninds\.nih\.gov|doi\.org|pmc\.ncbi\.nlm\.nih\.gov)\//);
      assert.ok(source.scope.length > 20);
    }
  }
});

test('opening-only routes retain provisional concern rather than requiring a fixed evidence hunt', () => {
  for (const current of ADDITIONAL_INVESTIGATIONS) {
    for (const hypothesis of current.hypotheses) {
      const state = route(current.id, [], hypothesis.id);
      assert.equal(investigationOutcome(state).status, 'provisional');
      assert.equal(assessment(state, openingFor(current.id), 'symptoms-not-confirmation').status, 'bounded');
    }
  }
});

test('the recorded MRI alone can support the stroke conclusion without a claimed prior CT', () => {
  const state = route(STROKE, ['team-mri-summary'], 'ischemic-stroke');
  assert.equal(investigationOutcome(state).status, 'supported');
  assert.equal(assessment(state, 'team-mri-summary', 'mri-scope').status, 'explained');
  const debrief = investigationDebrief(state);
  assert.deepEqual(state.actionIds, ['team-mri-summary']);
  assert.doesNotMatch(debrief.summary, /\bCT\b|first scan|less revealing/i);
  assert.equal(debrief.route.length, 1);
});

test('normal glucose and unrevealing early CT never become positive stroke evidence on their own', () => {
  for (const [action, limit] of [['glucose-result', 'glucose-discriminator'], ['initial-ct', 'ct-limit']]) {
    const state = route(STROKE, [action], 'ischemic-stroke');
    assert.equal(positive.has(assessment(state, action, limit).status), false);
    // These findings can still inform a limited reflection anchored in the
    // opening concern; they are not themselves positive proof of ischemia.
    assert.equal(assessment(state, openingFor(STROKE), limit).status, 'bounded');
  }
});

test('a true glucose or CT limitation remains usable when decisive MRI evidence is also recorded', () => {
  for (const [action, limit] of [['glucose-result', 'glucose-discriminator'], ['initial-ct', 'ct-limit']]) {
    const state = route(STROKE, [action, 'team-mri-summary'], 'ischemic-stroke');
    assert.equal(assessment(state, 'team-mri-summary', limit).status, 'explained');
  }
});

test('an initial low-glucose concern requires revision after the conflicting glucose result is read', () => {
  const initial = route(STROKE, [], 'hypoglycemia');
  assert.equal(assessment(initial, openingFor(STROKE), 'symptoms-not-confirmation').status, 'bounded');
  const measured = route(STROKE, ['glucose-result'], 'hypoglycemia');
  const reviewed = assessment(measured, openingFor(STROKE), 'symptoms-not-confirmation');
  assert.equal(reviewed.status, 'needs-revision');
  assert.match(reviewed.feedback, /glucose/i);
  assert.match(reviewed.feedback, /without proving ischemic stroke/);
});

test('unread CT and MRI limitations stay unavailable rather than leaking findings into the route', () => {
  const state = route(STROKE, [], 'ischemic-stroke');
  const choices = reasoningChoices(state);
  assert.equal(choices.uncertainties.some((option) => option.id === 'ct-limit'), false);
  assert.equal(choices.uncertainties.some((option) => option.id === 'mri-scope'), false);
  for (const limit of ['ct-limit', 'mri-scope']) {
    assert.equal(positive.has(assessment(state, openingFor(STROKE), limit).status), false);
  }
});

const triadOrders = [
  [TRIAD[0], TRIAD[1], TRIAD[2]], [TRIAD[0], TRIAD[2], TRIAD[1]],
  [TRIAD[1], TRIAD[0], TRIAD[2]], [TRIAD[1], TRIAD[2], TRIAD[0]],
  [TRIAD[2], TRIAD[0], TRIAD[1]], [TRIAD[2], TRIAD[1], TRIAD[0]],
];

test('the explicitly cited three-part DKA argument works in all six evidence-reading orders', () => {
  for (const actions of triadOrders) {
    const state = route(METABOLIC, actions, 'diabetic-ketoacidosis');
    assert.equal(investigationOutcome(state).status, 'supported');
    const group = reasoningChoices(state).supports.find((item) => item.id === GROUP);
    assert.ok(group);
    assert.equal(group.strength, 'decisive');
    assert.deepEqual(group.requires, TRIAD);
    assert.match(group.label, /Glucose, blood ketones and acid-base/);
    assert.equal(assessment(state, GROUP, 'triad-scope').status, 'explained');
  }
});

test('collecting all three DKA reports does not grant reasoning success for citing one component', () => {
  const state = route(METABOLIC, TRIAD, 'diabetic-ketoacidosis');
  for (const cited of [...TRIAD, openingFor(METABOLIC)]) {
    const reviewed = assessment(state, cited, 'triad-scope');
    assert.equal(reviewed.status, 'needs-revision');
    assert.match(reviewed.feedback, /glucose, ketone and acid-base/);
    assert.doesNotMatch(reviewed.feedback, /You connected|You linked/);
  }
  assert.equal(assessment(state, null, null).status, 'not-recorded');
  assert.doesNotMatch(investigationDebrief(state).summary, /Your conclusion connects/);
});

test('one or two metabolic reports cannot expose or earn a combined three-part argument', () => {
  for (const actions of [...TRIAD.map((id) => [id]), ...triadOrders.map((order) => order.slice(0, 2))]) {
    const state = route(METABOLIC, actions, 'diabetic-ketoacidosis');
    assert.equal(investigationOutcome(state).status, 'provisional');
    assert.equal(reasoningChoices(state).supports.some((item) => item.id === GROUP), false);
    assert.equal(positive.has(assessment(state, GROUP, 'triad-scope').status), false);
  }
});

test('missing-component claims remain visible but become invalid once every required report was read', () => {
  const missingOptions = [
    ['plasma-glucose', 'glucose-with-missing-components'],
    ['blood-ketones', 'ketones-with-missing-components'],
    ['acid-base', 'acidosis-with-missing-components'],
  ];
  for (const [component, limit] of missingOptions) {
    const partial = route(METABOLIC, [component], 'diabetic-ketoacidosis');
    assert.equal(assessment(partial, component, limit).status, 'bounded');
    const complete = route(METABOLIC, TRIAD, 'diabetic-ketoacidosis');
    assert.equal(reasoningChoices(complete).uncertainties.some((option) => option.id === limit), true);
    assert.equal(assessment(complete, GROUP, limit).status, 'needs-revision');
    const store = memory();
    assert.equal(saveReflection(complete, reflection(GROUP, limit), store), true, 'A visible wrong limitation is recordable for feedback, not hidden or treated as storage corruption');
  }
});

test('a history limitation claiming an unresolved metabolic pattern cannot explain a fully recorded triad', () => {
  const state = route(METABOLIC, ['recent-history', ...TRIAD], 'diabetic-ketoacidosis');
  assert.equal(reasoningChoices(state).uncertainties.some((option) => option.id === 'history-limits'), true);
  assert.equal(assessment(state, GROUP, 'history-limits').status, 'needs-revision');
  assert.equal(assessment(state, GROUP, 'triad-scope').status, 'explained');
});

test('a limitation tied to the DKA hypothesis cannot justify a different provisional hypothesis', () => {
  const state = route(METABOLIC, ['plasma-glucose'], 'gastroenteritis');
  assert.equal(assessment(state, openingFor(METABOLIC), 'glucose-with-missing-components').status, 'needs-revision');
});

test('measured osmolality conflicts with the HHS hypothesis while suggestive chronology does not veto a provisional rival', () => {
  const hhs = route(METABOLIC, ['serum-osmolality'], 'hyperosmolar-state');
  assert.equal(assessment(hhs, openingFor(METABOLIC), 'symptoms-not-confirmation').status, 'needs-revision');
  const stomachConcern = route(METABOLIC, ['recent-history'], 'gastroenteritis');
  assert.equal(assessment(stomachConcern, openingFor(METABOLIC), 'history-limits').status, 'bounded');
  assert.equal(getInvestigationEpisode(METABOLIC).reasoning.supportRules['recent-history'].conflictsWith, undefined);
});

test('osmolality by itself cannot be cited as positive proof of ketoacidosis', () => {
  const state = route(METABOLIC, ['serum-osmolality'], 'diabetic-ketoacidosis');
  assert.equal(positive.has(assessment(state, 'serum-osmolality', 'osmolality-discriminator').status), false);
});

test('each conflicting metabolic measurement requires revisiting HHS alone without declaring a complete DKA pattern', () => {
  for (const action of [...TRIAD, 'serum-osmolality']) {
    const state = route(METABOLIC, [action], 'hyperosmolar-state');
    assert.equal(investigationOutcome(state).status, 'provisional');
    const reviewed = assessment(state, openingFor(METABOLIC), 'symptoms-not-confirmation');
    assert.equal(reviewed.status, 'needs-revision');
    assert.match(reviewed.feedback, /HHS alone in this fictional case/);
    assert.match(reviewed.feedback, /does not establish DKA without the remaining findings/);
    assert.match(reviewed.feedback, /real presentations can overlap/);
  }
});

test('the osmolality comparison remains true after the full DKA argument is recorded', () => {
  const state = route(METABOLIC, [...TRIAD, 'serum-osmolality'], 'diabetic-ketoacidosis');
  assert.equal(assessment(state, GROUP, 'osmolality-discriminator').status, 'explained');
});

test('claiming every competing cause is excluded never earns a positive assessment', () => {
  for (const [id, actions, hypothesis, cited] of [
    [STROKE, ['team-mri-summary'], 'ischemic-stroke', 'team-mri-summary'],
    [METABOLIC, TRIAD, 'diabetic-ketoacidosis', GROUP],
  ]) assert.equal(assessment(route(id, actions, hypothesis), cited, 'all-excluded').status, 'needs-revision');
});

test('a selected available composite argument persists without expanding the three-field reflection schema', () => {
  const state = route(METABOLIC, TRIAD, 'diabetic-ketoacidosis');
  const saved = reflection(GROUP, 'triad-scope');
  const store = memory();
  assert.equal(saveReflection(state, saved, store), true);
  assert.deepEqual(loadReflection(state, store), saved);
  assert.deepEqual(Object.keys(loadReflection(state, store)).sort(), ['confidence', 'keyActionId', 'uncertaintyId']);
});

test('version 1 routes retain ungraded reflection behavior under the new metadata', () => {
  for (const [id, actions, hypothesis] of [
    [STROKE, ['team-mri-summary'], 'ischemic-stroke'],
    [METABOLIC, TRIAD, 'diabetic-ketoacidosis'],
  ]) {
    const legacy = route(id, actions, hypothesis, { version: 1 });
    assert.equal(assessment(legacy, null, null).status, 'legacy');
    const current = getInvestigationEpisode(id, 2);
    assert.equal(current.version, 2);
    assert.equal(getInvestigationEpisode(id, 1).reasoning, undefined);
  }
});

let failures = 0;
for (const [name, run] of tests) {
  try { run(); console.log(`PASS ${name}`); }
  catch (error) { failures++; console.error(`FAIL ${name}\n${error.stack}`); }
}
console.log(`${tests.length - failures}/${tests.length} additional investigation content scenarios passed.`);
if (failures) process.exitCode = 1;
