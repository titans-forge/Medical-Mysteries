import assert from 'node:assert/strict';
import bundle from '../game-data.mjs';
import { OfflineSession } from '../offline_engine.mjs';
import {
  DAY_MS, normalizeReviewQueue, reconcileReviewQueue, scheduleReviewQueue,
  matchingReviewEntries, summarizeReviewChange,
} from '../review_queue.mjs';

const tests = [];
const test = (name, run) => tests.push([name, run]);
const NOW = Date.UTC(2026, 9, 16, 12);

// Real bundled case completions establish the meaning of first_try and attempts.
// A wrong first response is retried to finish the case and must retain its review.
function completeStory({ wrongFirst = false, confidence = 80 } = {}) {
  const spec = bundle.cases[0];
  const session = new OfflineSession(spec, {
    id: 'review-retention-test', clock: () => 0,
    order: spec.stages.map((stage) => stage.view.options.map((option) => option.id)),
  });
  let result;
  for (let index = 0; index < spec.stages.length; index++) {
    const stage = spec.stages[index];
    const correct = stage.choices.find((choice) => choice.result.correct);
    const wrong = stage.choices.find((choice) => !choice.result.correct);
    assert.ok(correct);
    if (wrongFirst && index === 0) {
      assert.ok(wrong);
      session.answer(wrong.id, confidence);
    }
    result = session.answer(correct.id, null);
  }
  assert.equal(result.finished, true);
  return result;
}

const success = completeStory();
const failure = completeStory({ wrongFirst: true });
const first = success.stage_autopsy[0];
const entry = (due_at, interval_days = 3, fields = {}) => ({
  concept_id: first.concept_id, review_variant_id: first.review_variant_id, due_at, interval_days, ...fields,
});

test('a correct immediate story replay cannot clear a future spaced review', () => {
  const existing = [entry(NOW + DAY_MS)];
  assert.equal(success.stage_autopsy[0].first_try, true);
  assert.deepEqual(reconcileReviewQueue(existing, success, NOW), existing);
  assert.equal(summarizeReviewChange(existing, reconcileReviewQueue(existing, success, NOW)).cleared, 0);
});

test('a correct first response can retire its review when due, including the exact boundary', () => {
  for (const due_at of [NOW - DAY_MS, NOW]) {
    const existing = [entry(due_at)];
    const after = reconcileReviewQueue(existing, success, NOW);
    assert.deepEqual(after, []);
    assert.equal(summarizeReviewChange(existing, after).cleared, 1);
  }
});

test('a wrong replay cannot postpone an existing earlier future deadline', () => {
  const existing = [entry(NOW + DAY_MS / 2)];
  assert.equal(failure.stage_autopsy[0].first_try, false);
  assert.equal(failure.stage_autopsy[0].attempts, 2);
  assert.equal(failure.review_queue[0].reason, 'high_confidence_wrong');
  const after = reconcileReviewQueue(existing, failure, NOW);
  assert.equal(after.length, 1);
  assert.equal(after[0].due_at, existing[0].due_at);
  assert.equal(after[0].interval_days, 1);
});

test('a failed due retrieval starts a fresh spaced interval that immediate corrected replay cannot discharge', () => {
  for (const [confidence, interval] of [[80, 1], [20, 3]]) {
    const missedRetrieval = completeStory({ wrongFirst: true, confidence });
    for (const due_at of [NOW - DAY_MS, NOW]) {
      const existing = [entry(due_at)];
      const after = reconcileReviewQueue(existing, missedRetrieval, NOW);
      assert.deepEqual(after, [entry(NOW + interval * DAY_MS, interval)]);
      assert.deepEqual(matchingReviewEntries(after, NOW), []);
      for (const replayTime of [NOW, NOW + 60_000]) {
        const correctedReplay = reconcileReviewQueue(after, success, replayTime);
        assert.deepEqual(correctedReplay, after);
        assert.equal(summarizeReviewChange(after, correctedReplay).cleared, 0);
      }
      // A later successful retrieval can discharge the review once the fresh
      // interval has elapsed, rather than through immediate answer repetition.
      assert.deepEqual(reconcileReviewQueue(after, success, after[0].due_at), []);
    }
  }
});

test('a new mistake schedules its authored interval and a high-confidence miss can bring a later review forward', () => {
  const after = reconcileReviewQueue([], failure, NOW);
  assert.deepEqual(after, [entry(NOW + DAY_MS, 1)]);
  const prior = [entry(NOW + 3 * DAY_MS)];
  assert.deepEqual(reconcileReviewQueue(prior, failure, NOW), after);
  const lowerConfidence = completeStory({ wrongFirst: true, confidence: 20 });
  assert.equal(lowerConfidence.review_queue[0].reason, 'missed');
  assert.deepEqual(reconcileReviewQueue([], lowerConfidence, NOW), [entry(NOW + 3 * DAY_MS)]);
});

test('restored and sandbox completions leave the existing valid queue unchanged', () => {
  const existing = [entry(NOW - DAY_MS), entry(NOW + DAY_MS, 3, { concept_id: 'other-concept' })];
  for (const result of [success, failure]) {
    assert.deepEqual(reconcileReviewQueue(existing, result, NOW, { restored: true }), existing);
    assert.deepEqual(reconcileReviewQueue(existing, { ...result, sandbox: true }, NOW), existing);
  }
});

test('unfinished or missing completion records cannot retire or reschedule reviews', () => {
  const existing = [entry(NOW - DAY_MS)];
  for (const result of [null, {}, { ...success, finished: false }, { ...failure, finished: false }]) {
    assert.deepEqual(reconcileReviewQueue(existing, result, NOW), existing);
  }
});

test('success retires only its exact concept and variant identity', () => {
  const existing = [entry(NOW), entry(NOW, 3, { concept_id: 'other-concept' }), entry(NOW, 3, { review_variant_id: 'other-variant' })];
  assert.deepEqual(reconcileReviewQueue(existing, success, NOW), existing.slice(1));
});

test('a first-try failure in any row sharing the same identity keeps its due review', () => {
  const existing = [entry(NOW)];
  const mixed = { finished: true, stage_autopsy: [first, { ...first, first_try: false, attempts: 2 }], review_queue: [] };
  assert.deepEqual(reconcileReviewQueue(existing, mixed, NOW), existing);
  for (const attempts of [0, -1, NaN, '1', undefined]) {
    assert.deepEqual(reconcileReviewQueue(existing, { finished: true, stage_autopsy: [{ ...first, attempts }], review_queue: [] }, NOW), existing);
  }
});

test('invalid timestamps cannot discharge a future review or create a fabricated deadline', () => {
  const existing = [entry(NOW + DAY_MS)];
  for (const now of [NaN, Infinity, -Infinity, undefined, -1, 'not-a-time']) {
    assert.deepEqual(reconcileReviewQueue(existing, success, now), existing, `Invalid clock: ${String(now)}`);
    assert.deepEqual(reconcileReviewQueue(existing, failure, now), existing, `Invalid clock must not reschedule: ${String(now)}`);
  }
});

test('queue reconciliation does not mutate frozen stored entries or completion evidence', () => {
  const existing = Object.freeze([Object.freeze(entry(NOW + DAY_MS / 2))]);
  const saved = JSON.stringify(existing);
  const result = structuredClone(failure);
  for (const row of result.stage_autopsy) Object.freeze(row);
  for (const candidate of result.review_queue) Object.freeze(candidate);
  Object.freeze(result.stage_autopsy);
  Object.freeze(result.review_queue);
  Object.freeze(result);
  reconcileReviewQueue(existing, result, NOW);
  assert.equal(JSON.stringify(existing), saved);
  assert.deepEqual(result, failure);
});

test('unknown mistake reasons and unrelated candidates do not change the current review', () => {
  const existing = [entry(NOW + DAY_MS / 2)];
  assert.deepEqual(scheduleReviewQueue(existing, [{ ...first, reason: 'invented' }], NOW), existing);
  assert.deepEqual(normalizeReviewQueue(existing), existing);
});

let failures = 0;
for (const [name, run] of tests) {
  try { run(); console.log(`PASS ${name}`); }
  catch (error) { failures++; console.error(`FAIL ${name}\n${error.stack}`); }
}
console.log(`${tests.length - failures}/${tests.length} review retention scenarios passed.`);
if (failures) process.exitCode = 1;
