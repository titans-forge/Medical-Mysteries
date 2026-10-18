import previous from './story_content_v2.mjs';

// Wording-only edition; preceding bundles remain separate trusted replay content.
export const STORY_CONTENT_VERSION = 3;
export const STORY_EDITION_LABEL = 'Refined decisions · Story version 3';
const BUILD_ID = 'a5eb929d5a83da8b71d5f5016f43d18f30cb87240586f4f11bdf24a5a114bbae';
const revisions = {
  'pub-001-dropped-pen': {
    s1: { question: 'Which working explanation best fits the combined observations?', labels: { hypoglycemia: 'Low blood glucose as the established cause', clumsy: 'An isolated hand slip' } },
    s2: { question: 'Which time belongs in the witness handoff?', labels: { breakfast: 'The breakfast start time' } },
    s3: { question: 'Which response fits the ongoing emergency handoff?', labels: { aspirin: 'Give aspirin for a possible stroke before help arrives' } },
  },
  'pub-002-honey-jar': {
    s1: { question: 'Which working explanation best fits the baby’s symptom pattern?', labels: { fatigue: 'Ordinary tiredness explaining the weak cry and tone', feeding: 'Constipation explaining the feeding and tone changes' } },
    s2: { question: 'Which detail best describes the baby’s current feeding function?', labels: { morning: 'The earlier honey exposure' } },
    s3: { question: 'Which response fits the baby’s current condition?', labels: { b: 'Stop the honey and watch for improvement until morning' } },
  },
  'stu-001-mountain-acid': {
    s1: { question: 'Which first step fits the team’s recorded plan?', labels: { b: 'Immediate insulin bolus before fluid reassessment' } },
    s2: { question: 'Which measurement addresses the continuing electrolyte question?', labels: { arrival: 'Glucose' } },
    s3: { question: 'Which existing plan fits the updated measurements?', labels: { b: 'Use glucose 252 mg/dL to declare the ketone and acid-base abnormalities resolved' } },
    s4: { question: 'Which handoff summary fits the recorded plan?', labels: { shortcut: 'Describe the episode as resolved and hand over glucose follow-up because the value has improved' } },
  },
  'stu-002-saturday-pain': {
    s1: { question: 'Which first investigation fits this stable patient’s record?', labels: { b: 'CT abdomen and pelvis' } },
    s2: { question: 'How should the team classify the current scan record?', labels: { routine: 'Completed miscarriage', confirmed: 'Confirmed ectopic pregnancy' } },
    s3: { question: 'Which finding most increases concern for bleeding in this record?', labels: { spotting: 'Pregnancy location inferred from the single hCG value' } },
    s4: { question: 'Which response fits the changing symptoms and current record?', labels: { b: 'Continue serial hCG follow-up before changing the handoff' } },
  },
  'doc-001-scatter-sign': {
    s1: { question: 'Which leading explanation best fits the history and lesion pattern?', labels: { b: 'Incidental mineralization as the leading explanation', migraine: 'Transient seizure-related signal changes rather than structural lesions' } },
    s2: { question: 'Which review best addresses the remaining lesion-burden question?', labels: { delay: 'Focused T1 lesion count' } },
    s3: { question: 'Which existing imaging plan best addresses the remaining characterization?', labels: { b: 'Focused T1 review of signal intensity, focus size and the number of conspicuous lesions' } },
    s4: { question: 'Which handoff fits the current state of characterization?', labels: { watch: 'Select the final plan from the initial count of T1-bright lesions' } },
  },
  'doc-002-tearing-back': {
    s1: { question: 'Which working explanation best fits the pain and pressure findings?', labels: { b: 'Cuff variation; set aside the pressure difference', muscle: 'A coronary cause explaining the full presentation' } },
    s2: { question: 'Which investigation addresses the remaining anatomical question?', labels: { ecg: 'ECG comparison to settle the cause' } },
    s3: { question: 'Which existing plan fits this team’s unresolved concern?', labels: { b: 'Proceed with the coronary pathway and immediate PCI based on the ST change and working diagnosis' } },
    s4: { question: 'Which handoff retains the team’s current case-specific boundary?', labels: { pci: 'Hand over a confirmed coronary cause from the ST change before aortic clarification' } },
  },
};
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function buildEditorialEdition() {
  const cases = JSON.parse(JSON.stringify(previous.cases));
  for (const spec of cases) {
    const patches = revisions[spec.case_id];
    if (!patches || Object.keys(patches).length !== spec.stages.length) throw new Error('Incomplete editorial story revision');
    for (const stage of spec.stages) {
      const patch = patches[stage.view.stage_id];
      if (!patch) throw new Error('Missing editorial story stage');
      stage.view.question = patch.question;
      stage.review_variant_id = stage.review_variant_id.replace(/-v2$/, '-v3');
      for (const [id, label] of Object.entries(patch.labels)) {
        const choice = stage.choices.find((choice) => choice.id === id);
        if (!choice || choice.result.correct) throw new Error('This story pass changes only distractor labels and questions');
        choice.label = label;
      }
      for (const option of stage.view.options) option.label = stage.choices.find((choice) => choice.id === option.id).label;
      const correct = stage.choices.find((choice) => choice.result.correct);
      for (const rows of [spec.completion.stage_autopsy, spec.completion.reasoning_autopsy?.stages]) {
        const row = rows?.find((item) => item.stage_id === stage.view.stage_id);
        if (!row) throw new Error('Missing story debrief row');
        row.question = stage.view.question; row.expert_choice = correct.label; row.review_variant_id = stage.review_variant_id;
      }
    }
  }
  return freeze({ schema: 1, build_id: BUILD_ID, content_version: STORY_CONTENT_VERSION, edition_label: STORY_EDITION_LABEL, cases });
}
export const STORY_DECISIONS_BUNDLE = buildEditorialEdition();
export default STORY_DECISIONS_BUNDLE;
