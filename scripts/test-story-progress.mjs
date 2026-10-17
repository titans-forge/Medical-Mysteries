import assert from 'node:assert/strict';
import original from '../game-data.mjs';
import current from '../story_decisions.mjs';
import { OfflineSession } from '../offline_engine.mjs';
import { loadStoryProfile, readStoryCompletions, recordStoryCompletion, exportStoryProgress,
  saveStoryPreferences, STORY_PREFERENCES_KEY, STORY_COMPLETION_PREFIX, storyReviewRoute, STORY_REVIEW_ROUTES } from '../story_progress.mjs';
import { reconcileReviewQueue, selectDueReview, nextReviewEntry } from '../review_queue.mjs';
import { readStoryReviews, writeStoryReviews } from '../story_reviews.mjs';

const tests = [];
const test = (name, run) => tests.push([name, run]);
function memory(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { values, get length() { return values.size; }, key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) };
}
function completed(bundle, sessionId, miss = false) {
  const spec = bundle.cases[0];
  const session = new OfflineSession(spec, { id: sessionId, clock: () => 100,
    content: { build_id: bundle.build_id, content_version: bundle.content_version || 1, edition_label: bundle.edition_label || 'Original story edition' } });
  let result;
  for (let i = 0; i < spec.stages.length; i += 1) {
    if (miss && i === 0) session.answer(spec.stages[i].choices.find((choice) => !choice.result.correct).id);
    result = session.answer(spec.stages[i].choices.find((choice) => choice.result.correct).id);
  }
  return { session: { ...session.snapshot(), case_id: spec.case_id, tier: spec.tier,
    build_id: bundle.build_id, content_version: bundle.content_version || 1 }, result };
}
const oldProfile = JSON.stringify({ xp: 3, pressure: true, plays: { [original.cases[0].case_id]: {
  case_id: original.cases[0].case_id, best_accuracy: 1, best_earned: 3, accuracy: 1, completed_at: 1000,
} } });

test('an earlier perfect summary never completes or awards points in the revised edition', () => {
  const store = memory({ mmProfile: oldProfile });
  const profile = loadStoryProfile(store);
  assert.deepEqual(profile.plays, {}); assert.equal(profile.xp, 0);
  assert.equal(profile.legacy_plays[original.cases[0].case_id].best_accuracy, 1);
  assert.equal(profile.pressure, true); assert.equal(store.getItem('mmProfile'), oldProfile);
});
test('new completion receipts append per session and derive best score within one edition', () => {
  const store = memory({ mmProfile: oldProfile });
  const first = completed(current, 'revised-missed', true);
  const next = completed(current, 'revised-perfect');
  assert.equal(recordStoryCompletion(first.session, first.result, store, 2000).saved, true);
  assert.equal(loadStoryProfile(store).xp, first.result.score.earned);
  assert.equal(recordStoryCompletion(next.session, next.result, store, 3000).saved, true);
  const profile = loadStoryProfile(store);
  assert.equal(profile.xp, next.result.score.earned);
  assert.equal(profile.plays[current.cases[0].case_id].best_accuracy, 1);
  assert.equal(readStoryCompletions(store).records.length, 2);
  assert.equal(store.getItem('mmProfile'), oldProfile);
});
test('continued original-edition completions keep their old build and earlier best summary', () => {
  const store = memory({ mmProfile: oldProfile });
  const play = completed(original, 'legacy-continued', true);
  assert.equal(recordStoryCompletion(play.session, play.result, store, 2000).saved, true);
  const profile = loadStoryProfile(store);
  assert.deepEqual(profile.plays, {}); assert.equal(profile.legacy_plays[original.cases[0].case_id].best_accuracy, 1);
  assert.equal(loadStoryProfile(store, original.build_id).plays[original.cases[0].case_id].accuracy, play.result.score.accuracy);
  assert.equal(store.getItem('mmProfile'), oldProfile);
});
test('re-recording the same completion cannot change its timestamp or award additional points', () => {
  const store = memory(); const play = completed(current, 'stable-receipt');
  assert.equal(recordStoryCompletion(play.session, play.result, store, 2000).saved, true);
  const before = [...store.values.entries()];
  assert.deepEqual(recordStoryCompletion(play.session, play.result, store, 9999), { saved: true, alreadyRecorded: true });
  assert.deepEqual([...store.values.entries()], before);
});
test('a changed or unreadable receipt is preserved and cannot be overwritten by the same session', () => {
  const play = completed(current, 'protected-receipt'); const store = memory();
  recordStoryCompletion(play.session, play.result, store, 2000);
  const key = [...store.values.keys()].find((key) => key.startsWith(STORY_COMPLETION_PREFIX));
  const before = store.getItem(key);
  const changed = structuredClone(play.result); changed.score.accuracy = 0;
  assert.equal(recordStoryCompletion(play.session, changed, store, 3000).saved, false);
  assert.equal(store.getItem(key), before);
  store.setItem(key, '{future-or-damaged');
  assert.equal(recordStoryCompletion(play.session, play.result, store, 4000).saved, false);
  assert.equal(store.getItem(key), '{future-or-damaged');
  assert.equal(exportStoryProgress(store).unreadable[0].raw, '{future-or-damaged');
});
test('malformed legacy profile remains exportable while revised plays and preferences work separately', () => {
  const store = memory({ mmProfile: '{original damaged bytes' });
  const play = completed(current, 'independent-new-play');
  assert.equal(recordStoryCompletion(play.session, play.result, store, 2000).saved, true);
  assert.equal(saveStoryPreferences({ pressure: true }, store), true);
  assert.equal(loadStoryProfile(store).legacy_status, 'invalid');
  assert.equal(exportStoryProgress(store).legacy_profile.raw, '{original damaged bytes');
  assert.equal(store.getItem('mmProfile'), '{original damaged bytes');
});
test('unknown preferences stay untouched and cannot absorb settings or last-start writes', () => {
  const raw = JSON.stringify({ schema: 900, future: 'retain' });
  const store = memory({ mmProfile: oldProfile, [STORY_PREFERENCES_KEY]: raw });
  assert.equal(saveStoryPreferences({ pressure: false }, store), false);
  assert.equal(store.getItem(STORY_PREFERENCES_KEY), raw); assert.equal(store.getItem('mmProfile'), oldProfile);
});
test('unavailable or full storage reports unsaved progress without replacing any prior bytes', () => {
  const play = completed(current, 'quota-failure'); const store = memory({ mmProfile: oldProfile });
  store.setItem = () => { throw new Error('quota'); };
  assert.equal(recordStoryCompletion(play.session, play.result, store, 2000).saved, false);
  assert.equal(saveStoryPreferences({ pressure: false }, store), false);
  assert.equal(store.getItem('mmProfile'), oldProfile);
  assert.equal(readStoryCompletions(null).status, 'unavailable');
  assert.equal(loadStoryProfile(null).history_status, 'unavailable');
});
test('unknown builds and incomplete or incompatible completion records cannot count as plays', () => {
  const play = completed(current, 'invalid-completion'); const store = memory();
  for (const session of [{ ...play.session, build_id: 'untrusted' }, { ...play.session, case_id: 'unknown' }, { ...play.session, content_version: 99 }]) {
    assert.equal(recordStoryCompletion(session, play.result, store, 2000).saved, false);
  }
  for (const result of [{ ...play.result, finished: false }, { ...play.result, score: { ...play.result.score, earned: 9999 } }]) assert.equal(recordStoryCompletion(play.session, result, store, 2000).saved, false);
  assert.equal(store.length, 0);
});
test('original-edition results cannot be attached to a revised-edition completion receipt', () => {
  const old = completed(original, 'same-run'); const revised = completed(current, 'same-run');
  const store = memory();
  assert.equal(recordStoryCompletion(revised.session, old.result, store, 2000).saved, false);
  assert.equal(store.length, 0);
});
test('damaged nested completion data is quarantined without breaking unrelated progress', () => {
  const valid = completed(current, 'valid-run'); const bad = completed(current, 'bad-run');
  for (const damage of [
    (record) => { record.completion.path_debrief.comparison = {}; },
    (record) => { record.completion.path_debrief.comparison[0] = null; },
    (record) => { record.completion.stage_autopsy[0] = null; },
    (record) => { record.completion.clinical_autopsy.calibration.overconfident_first_misses = {}; },
    (record) => { record.completion.score.accuracy = 0.5; },
    (record) => { record.completion.stage_autopsy[0].review_variant_id = 'untrusted-version'; },
  ]) {
    const store = memory(); recordStoryCompletion(valid.session, valid.result, store, 2000); recordStoryCompletion(bad.session, bad.result, store, 3000);
    const key = [...store.values.keys()].find((key) => key.endsWith(':bad-run'));
    const changed = JSON.parse(store.getItem(key)); damage(changed); const raw = JSON.stringify(changed); store.setItem(key, raw);
    assert.equal(readStoryCompletions(store).status, 'partial');
    assert.equal(loadStoryProfile(store).plays[current.cases[0].case_id].session_id, 'valid-run');
    assert.equal(exportStoryProgress(store).unreadable[0].raw, raw); assert.equal(store.getItem(key), raw);
  }
});
test('an impossible all-wrong path cannot masquerade as a completed story', () => {
  const play = completed(current, 'impossible-path'); const fake = structuredClone(play.result);
  const spec = current.cases[0];
  fake.path_debrief.learner_path = spec.stages.map((stage) => {
    const wrong = stage.choices.find((choice) => !choice.result.correct);
    return { stage_id: stage.view.stage_id, choice: wrong.label, correct: false };
  });
  for (const [index, row] of fake.stage_autopsy.entries()) {
    const wrong = spec.stages[index].choices.find((choice) => !choice.result.correct);
    row.first_try = false; row.attempts = 1;
    Object.assign(fake.path_debrief.comparison[index], { first_try_choice: wrong.label, matched: false,
      error_mode: wrong.result.error_mode, error_mode_label: wrong.result.error_mode_label });
  }
  fake.score.earned = 0; fake.score.accuracy = 0;
  const store = memory(); assert.equal(recordStoryCompletion(play.session, fake, store, 2000).saved, false);
  assert.equal(store.length, 0);
});
test('review routing uses exact concept and version identities and never maps an invented variant', () => {
  for (const bundle of [original, current]) for (const spec of bundle.cases) for (const stage of spec.stages) {
    const row = { concept_id: stage.view.concept_id, review_variant_id: stage.review_variant_id, due_at: 1, interval_days: 1 };
    assert.equal(storyReviewRoute(row).build_id, bundle.build_id);
    assert.equal(storyReviewRoute(row).case_id, spec.case_id);
    assert.deepEqual(selectDueReview([row], [spec.case_id], STORY_REVIEW_ROUTES, 2), row);
    assert.equal(nextReviewEntry([row], spec.case_id, STORY_REVIEW_ROUTES)?.review_variant_id, row.review_variant_id);
  }
  assert.equal(storyReviewRoute({ concept_id: 'invented', review_variant_id: original.cases[0].stages[0].review_variant_id }), null);
});
test('success on a revised task cannot retire an original-edition review', () => {
  const old = original.cases[0].stages[0]; const revised = current.cases[0].stages[0];
  const entry = { concept_id: old.view.concept_id, review_variant_id: old.review_variant_id, due_at: 1, interval_days: 1 };
  const result = { finished: true, stage_autopsy: [{ concept_id: revised.view.concept_id, review_variant_id: revised.review_variant_id, first_try: true, attempts: 1 }], review_queue: [] };
  assert.deepEqual(reconcileReviewQueue([entry], result, 2000), [entry]);
});
test('malformed, partial and future review queues cannot be overwritten by new completions', () => {
  const valid = { concept_id: 'existing', review_variant_id: 'existing-v1', due_at: 100, interval_days: 1 };
  for (const raw of ['{bad', JSON.stringify({ schema: 900, entries: [valid] }), JSON.stringify([valid, { broken: true }]), JSON.stringify([{ ...valid, futureField: 'keep' }])]) {
    const store = memory({ mmReviewQueue: raw }); const saved = readStoryReviews(store);
    assert.equal(saved.status, 'invalid'); assert.equal(writeStoryReviews(saved, [], store), false); assert.equal(store.getItem('mmReviewQueue'), raw);
  }
});
test('review updates detect a competing write and preserve its bytes', () => {
  const store = memory(); const saved = readStoryReviews(store);
  const other = JSON.stringify([{ concept_id: 'other-tab', review_variant_id: 'other-v1', due_at: 100, interval_days: 1 }]);
  store.setItem('mmReviewQueue', other);
  assert.equal(writeStoryReviews(saved, [], store), false); assert.equal(store.getItem('mmReviewQueue'), other);
  assert.equal(writeStoryReviews(readStoryReviews(store), JSON.parse(other), store), true);
});

let failures = 0;
for (const [name, run] of tests) { try { run(); console.log(`PASS ${name}`); } catch (error) { failures++; console.error(`FAIL ${name}\n${error.stack}`); } }
console.log(`${tests.length - failures}/${tests.length} story progress scenarios passed.`);
if (failures) process.exitCode = 1;
