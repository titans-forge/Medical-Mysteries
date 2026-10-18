import assert from 'node:assert/strict';
import { currentExhibitFacts, exhibitDefinition } from '../educational_exhibits.mjs';
import { investigationVisual } from '../investigation_visuals.mjs';
import { INVESTIGATION_EPISODES, getInvestigationEpisode } from '../investigation.mjs';
const tests = [];
const test = (name, run) => tests.push([name, run]);

test('only the displayed-stage fields can enter the exhibit facts', () => {
  const stage = {
    vitals: [{ label: 'Pulse', value: 88, unit: '/min' }],
    clues: [{ label: 'Current report', finding: 'The supplied report is limited.' }],
    observations: [{ label: 'Examined object', detail: 'Visible detail' }],
    visual_spec: { diagnosis: 'HIDDEN SPEC FINDING' },
    hotspots: [{ detail: 'UNEXAMINED' }], next: { clues: [{ finding: 'FUTURE' }] },
    case: { answer: 'UNRELEASED CASE CONTENT' },
  };
  const facts = currentExhibitFacts(stage);
  assert.deepEqual(facts, [
    { heading: 'Vital', text: 'Pulse · 88 · /min' },
    { heading: 'Clue', text: 'Current report · The supplied report is limited.' },
    { heading: 'Observation', text: 'Examined object · Visible detail' },
  ]);
  assert.doesNotMatch(JSON.stringify(facts), /HIDDEN|UNEXAMINED|FUTURE|UNRELEASED/);
});
test('an absent value is not converted into a normal value, and zero retains its units', () => {
  assert.deepEqual(currentExhibitFacts({ vitals: [{ label: 'Result unavailable', value: null }, { label: 'Recorded zero', value: 0, unit: 'fictional units' }] }), [
    { heading: 'Vital', text: 'Result unavailable' }, { heading: 'Vital', text: 'Recorded zero · 0 · fictional units' },
  ]);
  assert.deepEqual(currentExhibitFacts({}), []);
});
test('fact projection does not read gated properties or mutate the supplied snapshot', () => {
  const stage = Object.freeze({ vitals: Object.freeze([Object.freeze({ label: 'Recorded', value: 3 })]),
    get next() { throw new Error('future state accessed'); }, get visual_spec() { throw new Error('spec data accessed'); } });
  assert.deepEqual(currentExhibitFacts(stage), [{ heading: 'Vital', text: 'Recorded · 3' }]);
});
test('the six reference types explain their non-patient scope and have source attribution', () => {
  for (const kind of ['aortic_cta', 'neuro_laterality', 'descending_weakness', 'metabolic_trends', 'pelvic_ultrasound', 'brain_mri_grid']) {
    const definition = exhibitDefinition(kind);
    assert.ok(definition.title && definition.description && definition.note);
    assert.match(definition.source[1], /^https:\/\//);
  }
  assert.equal(exhibitDefinition('storage-authored-guide'), null);
});
test('all three arrivals in a family share neutral art rather than answer-specific pictures', () => {
  const families = new Map();
  for (const episode of INVESTIGATION_EPISODES) {
    const before = JSON.stringify(episode);
    const visual = investigationVisual(episode, {});
    assert.match(visual.image, /^\.\/assets\/scene-refresh-2026-10\//);
    assert.match(visual.imageAlt, /AI-generated fictional scene/);
    const family = episode.familyId || episode.id;
    if (families.has(family)) assert.deepEqual(visual, families.get(family));
    else families.set(family, visual);
    assert.equal(JSON.stringify(episode), before);
  }
  assert.equal(families.size, 3);
});
test('earlier episode presentations and caller-owned metadata remain unchanged', () => {
  for (const version of [1, 2, 3, 4]) {
    for (const id of ['doc-002-tearing-back-investigation', 'pub-003-missed-turn-investigation', 'stu-003-after-weekend-investigation']) {
      const episode = getInvestigationEpisode(id, version);
      const presentation = Object.freeze({ image: 'preserved-original.webp', imageAlt: 'Original art', playMinutes: '5-8' });
      assert.deepEqual(investigationVisual(episode, presentation), presentation);
    }
  }
});

for (const [name, run] of tests) { run(); console.log(`✓ ${name}`); }
console.log(`Verified ${tests.length} educational exhibit boundary and presentation scenarios.`);
