import assert from 'node:assert/strict';
import { assessConfidenceRecord, assessResultConfidence } from '../confidence_assessment.mjs';
import { OfflineSession } from '../offline_engine.mjs';

let checked = 0;
function test(name, run) {
  run();
  checked++;
  console.log(`ok ${checked} - ${name}`);
}

// Minimal authored payload with the same shape as a packaged engine case.
// Using OfflineSession, rather than duplicated arithmetic, verifies that the
// presenter understands real first_try, retry and missing-confidence semantics.
function play(firstResponses) {
  const spec = {
    tier: 'public',
    stages: firstResponses.map((_, i) => ({
      view: { stage_id: `stage-${i + 1}`, question: 'Authored choice?', decision_kind: 'diagnosis',
        concept_id: `concept-${i + 1}`, options: [{ id: 'yes', label: 'Authored answer' }, { id: 'no', label: 'Alternative' }], case_context: {} },
      hotspots: [], required: [], review_variant_id: `review-${i + 1}`,
      choices: [{ id: 'yes', label: 'Authored answer', result: { correct: true } }, { id: 'no', label: 'Alternative', result: { correct: false } }],
    })),
    completion: { clinical_autopsy: { counterfactual: 'Fixture only.' } },
  };
  const session = new OfflineSession(spec, { id: 'test-confidence', clock: () => 0, order: spec.stages.map(() => ['yes', 'no']) });
  let result;
  for (const { correct, confidence } of firstResponses) {
    result = session.answer(correct ? 'yes' : 'no', confidence);
    // Retry confidence must not enter the engine's first-response aggregate.
    if (!correct) result = session.answer('yes', 100);
  }
  return { result, assessment: assessResultConfidence(result) };
}

test('maximal underconfidence is a Brier 1 record, never an overconfidence label or favorable grade', () => {
  const { result, assessment } = play([{ correct: true, confidence: 0 }]);
  assert.equal(result.clinical_autopsy.calibration.brier_score, 1);
  assert.equal(assessment.brierScore, 1);
  assert.equal(assessment.direction, 'below');
  assert.equal(assessment.stageDetails[0].direction, 'below');
  assert.match(assessment.summary, /1 recorded first response · Brier 1\.000/);
  assert.match(assessment.detail, /100 percentage points below/);
  assert.match(assessment.caveat, /Small sample: one recorded response/);
  assert.doesNotMatch(`${assessment.summary} ${assessment.detail}`, /overconfiden|\bCalibrated\b|Sharp calibration|Moderate calibration/);
});

test('maximal overconfidence is reported in its factual direction', () => {
  const { assessment } = play([{ correct: false, confidence: 100 }]);
  assert.equal(assessment.sampleCount, 1);
  assert.equal(assessment.brierScore, 1);
  assert.equal(assessment.direction, 'above');
  assert.equal(assessment.stageDetails[0].outcome, false);
  assert.match(assessment.detail, /100 percentage points above/);
  assert.match(assessment.stageDetails[0].summary, /did not match/);
});

test('perfect confidence at both endpoints stays descriptive', () => {
  for (const [correct, confidence] of [[true, 100], [false, 0]]) {
    const { assessment } = play([{ correct, confidence }]);
    assert.equal(assessment.brierScore, 0);
    assert.equal(assessment.bias, 0);
    assert.equal(assessment.direction, 'equal');
    assert.match(assessment.summary, /Brier 0\.000/);
    assert.match(assessment.detail, /differences in opposite directions can cancel/);
    assert.doesNotMatch(assessment.detail, /expert|competent|excellent|sharp|\bcalibrated\b/i);
  }
});

test('mixed directions can yield zero bias despite maximum Brier error', () => {
  const { assessment } = play([{ correct: true, confidence: 0 }, { correct: false, confidence: 100 }]);
  assert.equal(assessment.brierScore, 1);
  assert.equal(assessment.bias, 0);
  assert.equal(assessment.meanConfidenceError, 100);
  assert.equal(assessment.sampleCount, 2);
  assert.match(assessment.detail, /opposite directions can cancel/);
  assert.match(assessment.detail, /confidence above or below/);
  assert.match(assessment.caveat, /Limited sample/);
});

test('omitted confidence remains missing and does not become zero or include a retry', () => {
  const { result, assessment } = play([{ correct: false, confidence: null }, { correct: true, confidence: 100 }]);
  assert.equal(result.stage_autopsy[0].confidence, null);
  assert.equal(assessment.sampleCount, 1);
  assert.equal(assessment.recordedStageCount, 1);
  assert.equal(assessment.missingCount, 1);
  assert.equal(assessment.brierScore, 0);
  assert.match(assessment.detail, /1 of 2 supplied stages has no usable confidence value/);
  assert.equal(assessment.stageDetails[0].confidence, null);
  assert.equal(assessment.stageDetails[0].direction, 'unavailable');
});

test('no confidence recorded has no numerical assessment', () => {
  const { assessment } = play([{ correct: true, confidence: null }]);
  assert.equal(assessment.sampleCount, 0);
  assert.equal(assessment.brierScore, null);
  assert.equal(assessment.bias, null);
  assert.match(assessment.detail, /No first-response confidence values were recorded/);
  assert.doesNotMatch(assessment.detail, /Brier score: 0|NaN|undefined/);
});

test('bad and nonnumeric values never leak NaN or score grades', () => {
  for (const invalid of [NaN, Infinity, -Infinity, '0', undefined, null, {}, -1, 101]) {
    const assessment = assessConfidenceRecord({ calibration: { brier_score: invalid, calibration_bias: invalid, mean_confidence_error: invalid }, stages: [{ confidence: invalid, first_try: true }] });
    assert.equal(assessment.brierScore, null);
    assert.equal(assessment.sampleCount, 0);
    assert.doesNotMatch(assessment.detail, /NaN|Infinity|undefined|\[object Object\]/);
  }
  for (const value of [undefined, null, [], 3, 'bad']) {
    assert.doesNotThrow(() => assessConfidenceRecord(value));
    assert.doesNotThrow(() => assessResultConfidence(value));
  }
});

test('valid engine count is preserved and disagreement with stage evidence is visible', () => {
  const assessment = assessConfidenceRecord({ calibration: { sample_count: 8, brier_score: 0.41, calibration_bias: -0.2, mean_confidence_error: 45 }, stages: [{ confidence: 0, first_try: true }] });
  assert.equal(assessment.sampleCount, 8);
  assert.equal(assessment.countSource, 'calibration');
  assert.equal(assessment.inconsistentCount, true);
  assert.equal(assessment.brierScore, 0.41);
  assert.match(assessment.detail, /engine reports 8 recorded first responses, while 1 supplied stage has/);
  assert.match(assessment.detail, /20 percentage points below/);
});

test('invalid aggregate metrics stay unavailable even when the response count is valid', () => {
  for (const invalid of [NaN, Infinity, -Infinity, '0', null, undefined, -2, 101]) {
    const assessment = assessConfidenceRecord({ calibration: { sample_count: 1, brier_score: invalid, calibration_bias: invalid, mean_confidence_error: invalid } });
    assert.equal(assessment.sampleCount, 1);
    assert.equal(assessment.brierScore, null);
    assert.equal(assessment.bias, null);
    assert.equal(assessment.meanConfidenceError, null);
    assert.match(assessment.summary, /Brier unavailable/);
    assert.doesNotMatch(assessment.detail, /NaN|Infinity|undefined/);
  }
  assert.equal(assessConfidenceRecord({ calibration: { sample_count: 1, brier_score: 1.01 } }).brierScore, null);
  assert.equal(assessConfidenceRecord({ calibration: { sample_count: 1, calibration_bias: -1.01 } }).bias, null);
  for (const invalid of [NaN, Infinity, -1, 0.5, '2', Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(assessConfidenceRecord({ calibration: { sample_count: invalid } }).sampleCount, null);
  }
});

test('when aggregate count is absent, stage evidence is an explicit count fallback', () => {
  const assessment = assessConfidenceRecord({ calibration: { brier_score: 1 }, stages: [{ confidence: 0, first_try: true }, { confidence: null, first_try: false }] });
  assert.equal(assessment.sampleCount, 1);
  assert.equal(assessment.countSource, 'stages');
  assert.match(assessment.detail, /count comes from the supplied stage record/);
  assert.equal(assessment.bias, null);
  assert.equal(assessment.direction, 'unavailable');
});

test('unknown sample size stays unknown; empty stage lists do not invent a zero count', () => {
  for (const stages of [undefined, []]) {
    const assessment = assessConfidenceRecord({ calibration: { brier_score: 0.5 }, stages });
    assert.equal(assessment.sampleCount, null);
    assert.equal(assessment.countSource, 'unavailable');
    assert.match(assessment.summary, /count unavailable/);
    assert.match(assessment.caveat, /sample size is unavailable/);
  }
});

test('a supplied zero count suppresses contradictory aggregate metrics', () => {
  const assessment = assessConfidenceRecord({ calibration: { sample_count: 0, brier_score: 1, calibration_bias: -1, mean_confidence_error: 100 } });
  assert.equal(assessment.sampleCount, 0);
  assert.equal(assessment.brierScore, null);
  assert.equal(assessment.bias, null);
  assert.equal(assessment.meanConfidenceError, null);
});

test('larger sample sizes do not acquire a favorable or unfavorable calibration rank', () => {
  for (const sampleCount of [2, 5, 10, 100, 1000]) {
    for (const score of [0, 0.08, 0.18, 0.5, 1]) {
      const assessment = assessConfidenceRecord({ calibration: { sample_count: sampleCount, brier_score: score } });
      assert.equal(assessment.sampleCount, sampleCount);
      assert.equal(assessment.title, 'Confidence record');
      assert.match(assessment.summary, new RegExp(`${sampleCount} recorded first responses`));
      assert.match(assessment.detail, /Lower scores mean confidence was closer/);
      assert.doesNotMatch(assessment.summary + assessment.detail, /Diagnostic Calibration|\bCalibrated\b|Sharp calibration|Moderate calibration|Calibration alert|validated threshold/);
    }
  }
});

test('presenting a frozen response does not mutate the engine evidence', () => {
  const calibration = Object.freeze({ sample_count: 1, brier_score: 1, calibration_bias: -1, mean_confidence_error: 100 });
  const stages = Object.freeze([Object.freeze({ stage_number: 1, first_try: true, confidence: 0, confidence_error: 100 })]);
  const input = Object.freeze({ calibration, stages });
  const before = JSON.stringify(input);
  const first = assessConfidenceRecord(input);
  assert.deepEqual(first, assessConfidenceRecord(input));
  assert.equal(JSON.stringify(input), before);
});

console.log(`Passed ${checked} confidence presentation tests.`);
