import assert from 'node:assert/strict';
import {
  INVESTIGATION_EPISODE, getInvestigationEpisode, createInvestigation, investigate,
  setHypothesis, concludeInvestigation, investigationOutcome, investigationDebrief,
} from '../investigation.mjs';
import { reasoningChoices, assessInvestigationReasoning } from '../investigation_reasoning.mjs';

const tests = [];
const test = (name, run) => tests.push([name, run]);
const opening = 'opening:chest-discomfort';
const provisionalLimit = 'symptoms-not-confirmation';
const reportLimit = 'report-scope';
const positive = new Set(['bounded', 'explained']);
const reflection = (keyActionId, uncertaintyId) => ({ confidence: null, keyActionId, uncertaintyId });

function route(actions = [], hypothesis = 'acute-aortic-syndrome', { version = 2, mode = 'guided', complete = true } = {}) {
  let state = createInvestigation(mode, INVESTIGATION_EPISODE.id, version);
  for (const action of actions) {
    state = investigate(state, action);
    assert.ok(state, `Authored action should be available: ${action}`);
  }
  state = complete ? concludeInvestigation(state, hypothesis) : setHypothesis(state, hypothesis);
  assert.ok(state);
  return state;
}

test('an opening fact and visible limitation support a provisional reflection with no extra actions', () => {
  const state = route();
  const assessment = assessInvestigationReasoning(state, reflection(opening, provisionalLimit));
  assert.equal(state.actionIds.length, 0);
  assert.equal(investigationOutcome(state).status, 'provisional');
  assert.equal(assessment.status, 'bounded');
  assert.match(assessment.feedback, /not a confirmed diagnosis/);
  assert.equal(reasoningChoices(state).supports.find((item) => item.id === opening)?.origin, 'Opening handoff');
});

test('CTA alone supports its authored conclusion when the report scope is acknowledged', () => {
  for (const mode of ['guided', 'challenge']) {
    const state = route(['aortic-cta'], 'acute-aortic-syndrome', { mode });
    assert.deepEqual(state.actionIds, ['aortic-cta']);
    assert.equal(investigationOutcome(state).status, 'supported');
    const assessment = assessInvestigationReasoning(state, reflection('aortic-cta', reportLimit));
    assert.equal(assessment.status, 'explained');
    assert.match(assessment.feedback, /one fictional case/);
  }
});

test('a supported answer with no justification never becomes a reasoning success', () => {
  const state = route(['aortic-cta']);
  for (const saved of [{}, reflection(null, null), reflection('aortic-cta', null), reflection(null, reportLimit)]) {
    assert.equal(assessInvestigationReasoning(state, saved).status, 'not-recorded');
  }
});

test('collecting an ECG does not make it evidence for an aortic conclusion', () => {
  const state = route(['ecg']);
  const assessment = assessInvestigationReasoning(state, reflection('ecg', 'limited-ecg'));
  assert.equal(assessment.status, 'needs-revision');
  assert.doesNotMatch(assessment.label, /connected|recorded/);
});

test('a limited ECG finding can support a provisional coronary concern while retaining uncertainty', () => {
  const state = route(['ecg'], 'acute-coronary-syndrome');
  assert.equal(investigationOutcome(state).status, 'provisional');
  const assessment = assessInvestigationReasoning(state, reflection('ecg', 'limited-ecg'));
  assert.equal(assessment.status, 'bounded');
  assert.notEqual(assessment.status, 'explained');
  assert.match(assessment.feedback, /not a confirmed diagnosis/);
});

test('uncollected support and unavailable uncertainty never earn a positive assessment', () => {
  const noEvidence = route();
  for (const saved of [
    reflection('aortic-cta', provisionalLimit),
    reflection(opening, reportLimit),
    reflection(opening, 'limited-ecg'),
    reflection('invented-clue', provisionalLimit),
    reflection(opening, 'invented-limitation'),
  ]) assert.equal(positive.has(assessInvestigationReasoning(noEvidence, saved).status), false);
  const choices = reasoningChoices(noEvidence);
  assert.equal(choices.supports.some((item) => item.id === 'aortic-cta'), false);
  assert.equal(choices.uncertainties.some((item) => item.id === reportLimit), false);
});

test('collecting decisive evidence requires citing that evidence rather than an opening concern', () => {
  const state = route(['symptom-timeline', 'aortic-cta']);
  for (const support of [opening, 'symptom-timeline']) {
    const assessment = assessInvestigationReasoning(state, reflection(support, reportLimit));
    assert.equal(assessment.status, 'needs-revision');
    assert.match(assessment.feedback, /decisive/);
  }
});

test('a decisive report cannot be justified by claiming every alternative was excluded', () => {
  const state = route(['aortic-cta']);
  const assessment = assessInvestigationReasoning(state, reflection('aortic-cta', 'all-excluded'));
  assert.equal(assessment.status, 'needs-revision');
  assert.match(assessment.feedback, /does not establish/);
});

test('a symptom-only limitation does not explain the scope of a decisive report', () => {
  const assessment = assessInvestigationReasoning(route(['aortic-cta']), reflection('aortic-cta', provisionalLimit));
  assert.equal(assessment.status, 'needs-revision');
  assert.match(assessment.feedback, /decisive report/);
});

test('a handoff cannot replace its underlying evidence as the cited justification', () => {
  const state = route(['aortic-cta', 'specialist-handoff']);
  const assessment = assessInvestigationReasoning(state, reflection('specialist-handoff', reportLimit));
  assert.equal(assessment.status, 'needs-revision');
  assert.match(assessment.feedback, /does not independently establish/);
});

test('a conclusion inconsistent with collected CTA evidence cannot earn a positive reasoning label', () => {
  const state = route(['aortic-cta'], 'pulmonary-embolism');
  assert.equal(investigationOutcome(state).status, 'reconsider');
  assert.equal(assessInvestigationReasoning(state, reflection('aortic-cta', reportLimit)).status, 'needs-revision');
});

test('legacy version 1 reflections stay ungraded under the revised content', () => {
  const state = route(['aortic-cta'], 'acute-aortic-syndrome', { version: 1 });
  assert.equal(getInvestigationEpisode(state.episodeId, 1).reasoning, undefined);
  for (const saved of [{}, reflection('aortic-cta', reportLimit), reflection(opening, provisionalLimit)]) {
    const assessment = assessInvestigationReasoning(state, saved);
    assert.equal(assessment.status, 'legacy');
    assert.match(assessment.feedback, /without a reasoning assessment/);
  }
});

test('an uncommitted draft cannot receive a completed positive reasoning assessment', () => {
  const state = route([], 'acute-aortic-syndrome', { complete: false });
  assert.equal(state.completed, false);
  assert.equal(positive.has(assessInvestigationReasoning(state, reflection(opening, provisionalLimit)).status), false);
});

test('a tampered current route is invalid rather than a trusted or legacy reflection', () => {
  const state = route(['aortic-cta']);
  const changed = { ...state, elapsedMinutes: state.elapsedMinutes + 1 };
  const assessment = assessInvestigationReasoning(changed, reflection('aortic-cta', reportLimit));
  assert.equal(assessment.status, 'invalid');
  assert.deepEqual(reasoningChoices(changed), { supports: [], uncertainties: [] });
});

test('stored reflection labels cannot override the canonical evidence assessment', () => {
  const state = route(['ecg']);
  const assessment = assessInvestigationReasoning(state, {
    ...reflection('ecg', 'limited-ecg'), status: 'explained', label: 'Expert', feedback: 'Everything excluded',
  });
  assert.equal(assessment.status, 'needs-revision');
  assert.notEqual(assessment.label, 'Expert');
});

const episodeCases = [
  { id: 'doc-002-tearing-back-investigation', correct: 'acute-aortic-syndrome', wrong: 'pulmonary-embolism', evidence: ['aortic-cta'] },
  { id: 'pub-003-missed-turn-investigation', correct: 'ischemic-stroke', wrong: 'hypoglycemia', evidence: ['team-mri-summary'] },
  { id: 'stu-003-after-weekend-investigation', correct: 'diabetic-ketoacidosis', wrong: 'gastroenteritis', evidence: ['plasma-glucose', 'blood-ketones', 'acid-base'] },
];

for (const episode of episodeCases) {
  test(`${episode.id}: complete correct, complete conflicting, and incomplete routes remain distinct`, () => {
    for (const hypothesis of [episode.correct, episode.wrong]) {
      let state = createInvestigation('challenge', episode.id, 2);
      for (const action of episode.evidence) state = investigate(state, action);
      state = concludeInvestigation(state, hypothesis);
      const outcome = investigationOutcome(state);
      const debrief = investigationDebrief(state);
      assert.equal(outcome.status, hypothesis === episode.correct ? 'supported' : 'reconsider');
      assert.equal(state.conclusion.evidenceComplete, true);
      assert.equal(debrief.route.length, episode.evidence.length);
      assert.deepEqual(debrief.outcome, outcome);

      const unfinished = concludeInvestigation(createInvestigation('challenge', episode.id, 2), hypothesis);
      const provisional = investigationDebrief(unfinished);
      assert.equal(investigationOutcome(unfinished).status, 'provisional');
      assert.equal(unfinished.conclusion.evidenceComplete, false);
      assert.equal(provisional.route.length, 0);
      assert.match(provisional.summary, /provisional/);
      assert.doesNotMatch(provisional.decisiveClue, /intimal flap|small acute left frontal infarct|pH 7\.22/);
    }
    // For the three-part laboratory story, two positive reports still leave a
    // missing component; a guess matching the authored answer is provisional.
    if (episode.evidence.length > 1) {
      let partial = createInvestigation('guided', episode.id, 2);
      for (const action of episode.evidence.slice(0, -1)) partial = investigate(partial, action);
      partial = concludeInvestigation(partial, episode.correct);
      assert.equal(investigationOutcome(partial).status, 'provisional');
    }
  });
}

let failures = 0;
for (const [name, run] of tests) {
  try { run(); console.log(`PASS ${name}`); }
  catch (error) { failures++; console.error(`FAIL ${name}\n${error.stack}`); }
}
console.log(`${tests.length - failures}/${tests.length} investigation reasoning scenarios passed.`);
if (failures) process.exitCode = 1;
