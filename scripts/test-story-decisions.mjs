import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import original from '../game-data.mjs';
import revised, { STORY_DECISIONS_BUNDLE, STORY_CONTENT_VERSION, STORY_EDITION_LABEL } from '../story_decisions.mjs';
import { OfflineSession } from '../offline_engine.mjs';

const tests = [];
const test = (name, run) => tests.push([name, run]);
const clone = (value) => JSON.parse(JSON.stringify(value));
const originalText = fs.readFileSync(new URL('../game-data.mjs', import.meta.url), 'utf8');
const decodedOriginal = JSON.parse(originalText.replace(/^export default\s+/, '').trim().replace(/;$/, ''));
const originalDigest = createHash('sha256').update(originalText).digest('hex');

function mediaEntries(value, path = '') {
  const entries = [];
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (['media', 'active_media', 'result_media', 'consequence_media'].includes(key)) entries.push([`${path}.${key}`, child]);
      else entries.push(...mediaEntries(child, `${path}.${key}`));
    }
  }
  return entries;
}

function sessionFor(spec, content) {
  return new OfflineSession(spec, { id: `story-test-${spec.case_id}`, clock: () => 0,
    order: spec.stages.map((stage) => stage.view.options.map((option) => option.id)),
    content: { build_id: content.build_id, content_version: content.content_version ?? 1,
      edition_label: content.edition_label ?? 'Original story edition' } });
}

function finish(spec, content, { missedStage = -1, missedOption } = {}) {
  const session = sessionFor(spec, content);
  let result;
  let mistake;
  for (let i = 0; i < spec.stages.length; i++) {
    const stage = spec.stages[i];
    if (i === missedStage) mistake = session.answer(missedOption, 80);
    result = session.answer(stage.choices.find((choice) => choice.result.correct).id, null);
  }
  assert.equal(result.finished, true);
  return { result, mistake, session };
}

test('the revised bank has a distinct deterministic content identity covering all six cases', () => {
  assert.equal(revised, STORY_DECISIONS_BUNDLE);
  assert.equal(revised.schema, 1);
  assert.equal(revised.content_version, STORY_CONTENT_VERSION);
  assert.equal(revised.content_version, 2);
  assert.equal(revised.edition_label, STORY_EDITION_LABEL);
  assert.equal(revised.edition_label, 'Revised decisions · Story version 2');
  assert.notEqual(revised.build_id, original.build_id);
  const { build_id, ...payload } = revised;
  assert.equal(build_id, createHash('sha256').update(JSON.stringify(payload)).digest('hex'));
  assert.equal(revised.cases.length, 6);
  assert.equal(revised.cases.reduce((count, spec) => count + spec.stages.length, 0), 22);
  assert.ok(Object.isFrozen(revised));
  assert.ok(Object.isFrozen(revised.cases[0].stages[0].choices[0].result));
});

test('importing and playing the revised edition cannot change the original trusted bank or its source file', () => {
  assert.deepEqual(original, decodedOriginal);
  assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../game-data.mjs', import.meta.url))).digest('hex'), originalDigest);
  assert.notEqual(revised.cases, original.cases);
  for (let index = 0; index < original.cases.length; index++) {
    assert.notEqual(revised.cases[index], original.cases[index]);
    assert.notEqual(revised.cases[index].stages, original.cases[index].stages);
  }
});

test('case, stage, option, concept, order and correctness identities remain stable', () => {
  assert.deepEqual(revised.cases.map((spec) => spec.case_id), original.cases.map((spec) => spec.case_id));
  for (let index = 0; index < original.cases.length; index++) {
    const before = original.cases[index];
    const after = revised.cases[index];
    assert.equal(after.title, before.title);
    assert.equal(after.tier, before.tier);
    assert.equal(after.stages.length, before.stages.length);
    for (let stageIndex = 0; stageIndex < before.stages.length; stageIndex++) {
      const oldStage = before.stages[stageIndex];
      const stage = after.stages[stageIndex];
      for (const key of ['stage_id', 'stage_number', 'stage_count', 'concept_id', 'decision_kind', 'requires_ranking', 'supports_ranking']) {
        assert.equal(stage.view[key], oldStage.view[key], `${after.case_id}: ${key}`);
      }
      assert.deepEqual(stage.choices.map((choice) => [choice.id, choice.result.correct]), oldStage.choices.map((choice) => [choice.id, choice.result.correct]));
      assert.deepEqual(stage.view.options.map((option) => option.id), oldStage.view.options.map((option) => option.id));
      assert.equal(stage.review_variant_id, oldStage.review_variant_id.replace(/-v1$/, '-v2'));
    }
  }
});

test('clinical quantities, timing, observations, media and existing correct clinical instructions are unchanged', () => {
  for (let index = 0; index < original.cases.length; index++) {
    const before = original.cases[index];
    const after = revised.cases[index];
    assert.deepEqual(mediaEntries(after), mediaEntries(before));
    for (const key of ['key_teaching', 'twist', 'epilogue']) assert.equal(after.completion[key], before.completion[key]);
    for (let stageIndex = 0; stageIndex < before.stages.length; stageIndex++) {
      const oldStage = before.stages[stageIndex];
      const stage = after.stages[stageIndex];
      assert.deepEqual(stage.hotspots, oldStage.hotspots);
      assert.deepEqual(stage.required, oldStage.required);
      for (const key of ['vitals', 'timeline', 'clues', 'hotspots', 'timer_seconds', 'code', 'pressure_deadline']) assert.deepEqual(stage.view[key], oldStage.view[key]);
      for (const oldChoice of oldStage.choices.filter((choice) => choice.result.correct)) {
        const choice = stage.choices.find((item) => item.id === oldChoice.id);
        assert.equal(choice.label, oldChoice.label);
        assert.equal(choice.result.teaching, oldChoice.result.teaching);
      }
    }
  }
});

test('every stage receives a new decision prompt and every distractor receives matching revised feedback', () => {
  for (let index = 0; index < original.cases.length; index++) {
    const before = original.cases[index];
    const after = revised.cases[index];
    for (let stageIndex = 0; stageIndex < before.stages.length; stageIndex++) {
      const oldStage = before.stages[stageIndex];
      const stage = after.stages[stageIndex];
      assert.notEqual(stage.view.question, oldStage.view.question);
      assert.notEqual(stage.view.narrative, oldStage.view.narrative);
      for (const oldChoice of oldStage.choices.filter((choice) => !choice.result.correct)) {
        const choice = stage.choices.find((item) => item.id === oldChoice.id);
        assert.notEqual(choice.result.teaching, oldChoice.result.teaching);
        assert.notEqual(choice.result.consequence, oldChoice.result.consequence);
        assert.ok(choice.result.teaching.length > 40);
        assert.ok(choice.result.consequence.length > 40);
      }
    }
  }
});

test('displayed labels and seeded completion autopsies match the revised authored decisions', () => {
  for (const spec of revised.cases) {
    for (const stage of spec.stages) {
      const correct = stage.choices.find((choice) => choice.result.correct);
      for (const option of stage.view.options) assert.equal(option.label, stage.choices.find((choice) => choice.id === option.id).label);
      for (const rows of [spec.completion.stage_autopsy, spec.completion.reasoning_autopsy.stages]) {
        const row = rows.find((item) => item.stage_id === stage.view.stage_id);
        assert.equal(row.question, stage.view.question);
        assert.equal(row.expert_choice, correct.label);
        assert.equal(row.review_variant_id, stage.review_variant_id);
        assert.equal(row.concept_id, stage.view.concept_id);
      }
      for (const autopsy of [spec.completion.clinical_autopsy, spec.completion.reasoning_autopsy]) {
        assert.equal(autopsy.expert_path.find((row) => row.stage_id === stage.view.stage_id).choice, correct.label);
      }
      const path = spec.completion.path_debrief.learner_path.find((row) => row.stage_id === stage.view.stage_id);
      assert.equal(path.choice, correct.label);
      assert.equal(path.consequence, correct.result.consequence);
    }
    assert.equal(spec.completion.clinical_autopsy.counterfactual, spec.completion.reasoning_autopsy.counterfactual);
    assert.equal(spec.completion.clinical_autopsy.counterfactual, spec.completion.visual_autopsy.counterfactual);
  }
});

test('sources include a checked primary reference and bounded scope for every revised story', () => {
  const domains = new Set(['www.cdc.gov', 'www.nice.org.uk', 'diabetesjournals.org', 'www.cancer.gov', 'pmc.ncbi.nlm.nih.gov', 'www.jacc.org']);
  for (const spec of revised.cases) {
    assert.ok(spec.completion.sources.length > 0);
    for (const source of spec.completion.sources) {
      assert.ok(domains.has(new URL(source.url).hostname));
      assert.ok(Number.isFinite(Date.parse(source.checkedUtc)));
      assert.ok(source.scope.length > 30);
    }
  }
});

test('new distractors replace the old trivia and unsupported certainty traps with specific reasoning errors', () => {
  const stage = (id, stageId) => revised.cases.find((spec) => spec.case_id === id).stages.find((item) => item.view.stage_id === stageId);
  assert.match(stage('pub-001-dropped-pen', 's2').choices.find((choice) => choice.id === 'breakfast').label, /reconstruct.*onset/i);
  assert.match(stage('pub-002-honey-jar', 's2').choices.find((choice) => choice.id === 'morning').label, /exposure.*symptoms/i);
  assert.match(stage('stu-001-mountain-acid', 's2').choices.find((choice) => choice.id === 'arrival').label, /glucose.*electrolyte/i);
  assert.match(stage('stu-002-saturday-pain', 's2').choices.find((choice) => choice.id === 'routine').label, /completed miscarriage/i);
  assert.match(stage('doc-001-scatter-sign', 's2').choices.find((choice) => choice.id === 'delay').label, /complete lesion map/i);
  assert.match(stage('doc-002-tearing-back', 's2').choices.find((choice) => choice.id === 'ecg').label, /settle.*entire presentation/i);
});

test('all revised distractors carry misconception labels matching the new reasoning task', () => {
  let count = 0;
  for (const spec of revised.cases) {
    const oldSpec = original.cases.find((item) => item.case_id === spec.case_id);
    for (const stage of spec.stages) {
      const oldStage = oldSpec.stages.find((item) => item.view.stage_id === stage.view.stage_id);
      for (const choice of stage.choices.filter((item) => !item.result.correct)) {
        const oldChoice = oldStage.choices.find((item) => item.id === choice.id);
        count++;
        assert.match(choice.result.error_mode, /^[a-z]+(?:_[a-z]+)*$/);
        assert.ok(choice.result.error_mode_label.length > 20);
        assert.notEqual(choice.result.error_mode_label, oldChoice.result.error_mode_label);
        assert.doesNotMatch(choice.result.error_mode_label, /Wrong first test|Waited too long|Right idea, wrong order/);
      }
    }
  }
  assert.equal(count, 27);
  for (const [caseId, stageId, optionId, expectedMode, expectedMeaning] of [
    ['pub-001-dropped-pen', 's2', 'breakfast', 'timing_false_precision', /witnessed onset/],
    ['pub-002-honey-jar', 's2', 'morning', 'exposure_severity_conflation', /current severity/],
    ['stu-001-mountain-acid', 's3', 'b', 'premature_resolution', /ketosis and acidosis/],
    ['stu-002-saturday-pain', 's3', 'spotting', 'biomarker_location_overreach', /pregnancy-location/],
    ['doc-001-scatter-sign', 's3', 'b', 'incomplete_characterization', /sequence findings/],
    ['doc-002-tearing-back', 's4', 'pci', 'overcertain_handoff', /confirmed before clarification/],
  ]) {
    const choice = revised.cases.find((item) => item.case_id === caseId).stages.find((item) => item.view.stage_id === stageId).choices.find((item) => item.id === optionId);
    assert.equal(choice.result.error_mode, expectedMode);
    assert.match(choice.result.error_mode_label, expectedMeaning);
  }
});

for (const spec of revised.cases) {
  test(`${spec.case_id}: successful play preserves scores and revised prompts throughout the completion`, () => {
    const oldSpec = original.cases.find((item) => item.case_id === spec.case_id);
    const oldResult = finish(oldSpec, original).result;
    const { result } = finish(spec, revised);
    assert.deepEqual(result.score, oldResult.score);
    assert.equal(result.stage_autopsy.length, spec.stages.length);
    for (const row of result.stage_autopsy) {
      const stage = spec.stages.find((item) => item.view.stage_id === row.stage_id);
      assert.equal(row.question, stage.view.question);
      assert.equal(row.review_variant_id, stage.review_variant_id);
    }
  });

  test(`${spec.case_id}: every distractor produces the revised feedback and first-answer evidence`, () => {
    for (let stageIndex = 0; stageIndex < spec.stages.length; stageIndex++) {
      const stage = spec.stages[stageIndex];
      for (const choice of stage.choices.filter((item) => !item.result.correct)) {
        const { result, mistake } = finish(spec, revised, { missedStage: stageIndex, missedOption: choice.id });
        assert.equal(mistake.correct, false);
        assert.equal(mistake.teaching, choice.result.teaching);
        assert.equal(mistake.consequence, choice.result.consequence);
        assert.equal(mistake.error_mode, choice.result.error_mode);
        assert.equal(mistake.error_mode_label, choice.result.error_mode_label);
        const first = result.path_debrief.comparison[stageIndex];
        assert.equal(first.first_try_choice, choice.label);
        assert.equal(first.matched, false);
        assert.equal(first.error_mode, choice.result.error_mode);
        assert.equal(first.error_mode_label, choice.result.error_mode_label);
        const path = result.path_debrief.learner_path.find((row) => row.stage_id === stage.view.stage_id && !row.correct);
        assert.equal(path.choice, choice.label);
        assert.equal(path.consequence, choice.result.consequence);
        assert.equal(path.error_mode, choice.result.error_mode);
        assert.equal(path.error_mode_label, choice.result.error_mode_label);
        const scar = result.path_debrief.scars.find((row) => row.stage_id === stage.view.stage_id && row.option_id === choice.id);
        assert.equal(scar.error_mode, choice.result.error_mode);
        assert.equal(scar.error_mode_label, choice.result.error_mode_label);
        assert.equal(result.clinical_autopsy.first_divergence.stage_id, stage.view.stage_id);
        assert.ok(result.review_queue.some((row) => row.concept_id === stage.view.concept_id && row.review_variant_id === stage.review_variant_id));
      }
    }
  });
}

test('original completion text remains unchanged after all revised routes were exercised', () => {
  assert.deepEqual(original, decodedOriginal);
  assert.deepEqual(clone(revised).cases.map((spec) => spec.case_id), original.cases.map((spec) => spec.case_id));
});

let failures = 0;
for (const [name, run] of tests) {
  try { run(); console.log(`PASS ${name}`); }
  catch (error) { failures++; console.error(`FAIL ${name}\n${error.stack}`); }
}
console.log(`${tests.length - failures}/${tests.length} revised story decision scenarios passed.`);
if (failures) process.exitCode = 1;
