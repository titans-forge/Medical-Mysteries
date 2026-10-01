function freeze(value) {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
}

const DISCLAIMER = 'Educational game only. All measurements, reports and events are authored fiction pending human review, not clinical advice or source facts.';
const LIMITATIONS = [
  'Synthetic preview pending human medical review. This is a reasoning exercise, not a validated diagnostic assessment.',
  'Reports are fictional text, not scans. Scene art is reused illustration, not a patient record or diagnostic evidence.',
  'Timing is authored, non-real-time and non-prognostic. Reading order does not prescribe a clinical workup. Emergency assessment continues independently of your choices.',
  'No treatment, dose, eligibility decision or patient outcome is modeled. A game conclusion is not evidence of clinical competence.',
];

export const ADDITIONAL_INVESTIGATIONS = freeze([
  {
    id: 'pub-003-missed-turn-investigation', version: 1,
    title: 'The Missed Turn', subtitle: 'A sudden interruption. An incomplete picture.',
    opening: 'At dinner, a 68-year-old suddenly cannot finish a sentence and has trouble holding a fork. Emergency help is already on the way. Follow the fictional team record as it arrives.',
    disclaimer: DISCLAIMER,
    reviewStatus: 'pending_human_review',
    presentation: {
      audience: 'public', playMinutes: '4-7',
      image: './assets/episodes/pub-001-stroke-escalation-720.webp',
      imageAlt: 'Generated illustration of a dinner interrupted by an emergency response. Not diagnostic evidence.',
    },
    sources: [
      { title: 'NICE NG128: stroke recognition and initial assessment, recommendations 1.1.1-1.1.3', url: 'https://www.nice.org.uk/guidance/ng128/chapter/recommendations', checkedUtc: '2026-09-07T22:08:50Z', scope: 'Recognition, glucose check and urgent professional assessment; no treatment content is used.' },
      { title: 'NINDS: Assess and Treat, CT and MRI sections', url: 'https://www.ninds.nih.gov/health-information/stroke/assess-and-treat', checkedUtc: '2026-09-07T22:08:50Z', scope: 'Early CT limitations and diffusion-weighted MRI; scenario reports are fictional.' },
    ],
    hypotheses: [
      { id: 'ischemic-stroke', label: 'Ischemic stroke (interrupted blood flow)' },
      { id: 'hypoglycemia', label: 'Low blood glucose' },
      { id: 'migraine-aura', label: 'Migraine with neurological symptoms' },
    ],
    actions: [
      { id: 'witness-account', label: 'Ask what changed at dinner', category: 'history', minutes: 3, requires: [], sourceIds: [0],
        finding: 'Fictional witness account: speech was normal a moment earlier. Word-finding difficulty and right-hand weakness began together and persist.',
        interpretation: 'Sudden speech and one-sided movement changes call for urgent assessment, not a wait-and-see conclusion.' },
      { id: 'team-examination', label: 'Read the team examination', category: 'examination', minutes: 4, requires: [], sourceIds: [0],
        finding: 'Fictional examination: the clinician records difficulty naming familiar objects and right-arm drift. The patient remains awake.',
        interpretation: 'The observed pattern strengthens concern but does not establish its cause alone.' },
      { id: 'glucose-result', label: 'Read the blood glucose result', category: 'laboratory', minutes: 2, requires: [], sourceIds: [0],
        finding: 'Fictional measurement during the symptoms: blood glucose is 106 mg/dL (5.9 mmol/L).',
        interpretation: 'This result does not support low glucose as the current explanation; it does not itself prove stroke.' },
      { id: 'initial-ct', label: 'Read the first scan report', category: 'imaging', minutes: 6, requires: [], sourceIds: [1],
        finding: 'Fictional non-contrast head CT report: no hemorrhage is seen; no definite early infarct is visible.',
        interpretation: 'An early CT without a visible infarct does not rule out ischemic stroke.' },
      { id: 'team-mri-summary', label: 'Read the later imaging review', category: 'imaging', minutes: 8, requires: [], sourceIds: [1],
        finding: 'Fictional team review: diffusion MRI shows a small acute left frontal infarct corresponding to the speech and right-arm changes.',
        interpretation: 'The matching imaging finding supports ischemic stroke in this authored story; it is not a rule that every suspected stroke needs MRI before action.' },
      { id: 'witness-handoff', label: 'Pass on the witness account', category: 'coordination', minutes: 2, requires: ['witness-account'], sourceIds: [0],
        finding: 'The fictional handoff preserves the witnessed onset and persisting changes. It makes no claim about examinations or scans you did not read.',
        interpretation: 'A useful handoff separates what was witnessed from what remains unknown.' },
    ],
    resolution: {
      hypothesisId: 'ischemic-stroke', evidenceActionIds: ['team-mri-summary'],
      supportedSummary: 'Your conclusion fits the later fictional imaging review. A less revealing first scan did not settle the mystery.',
      mismatchSummary: 'The chosen explanation does not account for the matching acute infarct described in the fictional imaging review.',
      provisionalSummary: 'Your route ended before the later imaging review. The conclusion remains provisional; a working hypothesis is not confirmation.',
      decisiveClue: 'The later fictional MRI report describes an acute left frontal infarct matching the symptoms.',
      missingClue: 'The later imaging review was not collected. No decisive imaging clue was reached on this route.',
      nextLearning: 'Distinguish a test that finds no bleeding from evidence that excludes interrupted blood flow. Keep uncertainty visible.',
      limitations: LIMITATIONS,
    },
  },
  {
    id: 'stu-003-after-weekend-investigation', version: 1,
    title: 'After the Weekend', subtitle: 'A familiar complaint. Three pieces that must fit.',
    opening: 'A 26-year-old arrives after a weekend away with vomiting, fatigue and abdominal discomfort. The team is already assessing the patient. The first handoff suggests a stomach illness, but the record is incomplete.',
    disclaimer: DISCLAIMER,
    reviewStatus: 'pending_human_review',
    presentation: {
      audience: 'student', playMinutes: '5-8',
      image: './assets/episodes/stu-001-dka-escalation-720.webp',
      imageAlt: 'Generated illustration of a young adult under observation with a hospital team. Not diagnostic evidence.',
    },
    sources: [
      { title: 'ADA/EASD and partner societies: Hyperglycemic Crises in Adults With Diabetes, 2024 consensus report', url: 'https://doi.org/10.2337/dci24-0032', checkedUtc: '2026-09-07T22:08:50Z', scope: 'Diagnostic triad and competing hyperglycemic states, not treatment. Fictional values are not source patient data.' },
    ],
    hypotheses: [
      { id: 'diabetic-ketoacidosis', label: 'Diabetic ketoacidosis' },
      { id: 'hyperosmolar-state', label: 'Hyperglycemic hyperosmolar state' },
      { id: 'gastroenteritis', label: 'Gastroenteritis with dehydration' },
    ],
    actions: [
      { id: 'recent-history', label: 'Clarify the recent history', category: 'history', minutes: 3, requires: [], sourceIds: [0],
        finding: 'Fictional history: thirst and frequent urination started before the vomiting. There is no established diabetes diagnosis in the record.',
        interpretation: 'The chronology weakens a stomach-only explanation but cannot settle the metabolic diagnosis.' },
      { id: 'bedside-observations', label: 'Read the bedside observations', category: 'examination', minutes: 3, requires: [], sourceIds: [0],
        finding: 'Fictional observations: the patient is tired but conversant, with deep breathing, dry mouth and diffuse abdominal discomfort.',
        interpretation: 'These observations require explanation; they are not specific enough to label the illness.' },
      { id: 'plasma-glucose', label: 'Review the plasma glucose', category: 'laboratory', minutes: 2, requires: [], sourceIds: [0],
        finding: 'Fictional laboratory result: plasma glucose is 286 mg/dL.',
        interpretation: 'Elevated glucose alone is not sufficient to establish ketoacidosis.' },
      { id: 'blood-ketones', label: 'Review the blood ketones', category: 'laboratory', minutes: 3, requires: [], sourceIds: [0],
        finding: 'Fictional laboratory result: beta-hydroxybutyrate is 4.8 mmol/L.',
        interpretation: 'The ketone result adds a second piece. Acid-base evidence is still distinct.' },
      { id: 'acid-base', label: 'Review the acid-base results', category: 'laboratory', minutes: 4, requires: [], sourceIds: [0],
        finding: 'Fictional laboratory results: venous pH is 7.22 and bicarbonate is 13 mmol/L.',
        interpretation: 'Acidosis together with elevated glucose and ketones supports the ketoacidosis explanation in this case.' },
      { id: 'serum-osmolality', label: 'Review serum osmolality', category: 'laboratory', minutes: 4, requires: [], sourceIds: [0],
        finding: 'Fictional laboratory result: measured total serum osmolality is 297 mOsm/kg.',
        interpretation: 'This fictional result does not support a markedly hyperosmolar explanation. It does not replace the three-part ketoacidosis assessment.' },
    ],
    resolution: {
      hypothesisId: 'diabetic-ketoacidosis', evidenceActionIds: ['plasma-glucose', 'blood-ketones', 'acid-base'],
      supportedSummary: 'Your conclusion connects all three collected findings: elevated glucose, ketones and acidosis. The opening complaint alone was not enough.',
      mismatchSummary: 'The collected glucose, ketone and acid-base findings fit ketoacidosis more closely than the selected explanation in this fictional case.',
      provisionalSummary: 'Your conclusion remains provisional because the glucose, ketone and acid-base results were not all collected. A partial pattern is not the complete evidence set.',
      decisiveClue: 'The fictional combination is glucose 286 mg/dL, beta-hydroxybutyrate 4.8 mmol/L, pH 7.22 and bicarbonate 13 mmol/L.',
      missingClue: 'At least one component of the three-part laboratory pattern is missing from your route.',
      nextLearning: 'Ask whether the required pieces fit together, rather than letting one abnormal number carry the whole conclusion.',
      limitations: LIMITATIONS,
    },
  },
]);
