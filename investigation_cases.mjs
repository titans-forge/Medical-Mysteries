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
    id: 'pub-003-missed-turn-investigation', version: 3,
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
      { title: 'NICE NG128: stroke recognition and initial assessment, recommendations 1.1.1-1.1.3', url: 'https://www.nice.org.uk/guidance/ng128/chapter/recommendations', checkedUtc: '2026-10-16T04:29:45Z', scope: 'Sudden focal symptoms and checking hypoglycaemia as a competing explanation. The fictional normal glucose weakens that rival without establishing stroke; no treatment content is used.' },
      { title: 'NINDS: Assess and Treat, CT and MRI sections', url: 'https://www.ninds.nih.gov/health-information/stroke/assess-and-treat', checkedUtc: '2026-10-16T04:29:45Z', scope: 'CT detects bleeding; diffusion MRI can show ischemia before a non-contrast CT. Supports limits of the authored reports, not a required scan sequence or patient-specific advice.' },
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
    reasoning: {
      supportLabel: 'Evidence supporting your explanation',
      limitationLabel: 'Compare explanations or identify a limit',
      prompt: 'Explain how a finding you read supports your concern, how the alternatives compare, and what the record still cannot establish.',
      caseLearningText: 'Weakening one explanation does not prove another. Connect each collected finding to the concern it supports or weakens, and keep a working hypothesis provisional when decisive evidence is absent.',
      insufficientCitationFeedback: 'Your route includes the matching fictional imaging finding. Cite that finding to support the conclusion rather than an earlier concern or a result that only weakens a rival.',
      openingFacts: [
        { id: 'opening:speech-hand-change', label: 'Sudden speech and hand-use changes in the opening handoff', strength: 'concern', supports: ['ischemic-stroke', 'hypoglycemia', 'migraine-aura'] },
      ],
      supportRules: {
        'witness-account': { strength: 'suggestive', supports: ['ischemic-stroke'] },
        'team-examination': { strength: 'suggestive', supports: ['ischemic-stroke'] },
        'glucose-result': { strength: 'limited', supports: [], conflictsWith: ['hypoglycemia'], conflictFeedback: 'The glucose result you read during the symptoms does not support low glucose as the current explanation. It weakens that rival without proving ischemic stroke.' },
        'initial-ct': { strength: 'limited', supports: [] },
        'team-mri-summary': { strength: 'decisive', supports: ['ischemic-stroke'] },
        'witness-handoff': { strength: 'coordination', supports: [] },
      },
      uncertaintyOptions: [
        { id: 'symptoms-not-confirmation', label: 'The opening symptoms raise concern but do not establish a cause.', requires: [], scope: 'provisional' },
        { id: 'glucose-discriminator', label: 'The glucose result weakens the low-glucose explanation; it is not a positive stroke test.', requires: ['glucose-result'], forHypotheses: ['ischemic-stroke', 'migraine-aura'], scope: 'any' },
        { id: 'ct-limit', label: 'The first CT report does not exclude an early ischemic stroke.', requires: ['initial-ct'], scope: 'any' },
        { id: 'mri-scope', label: 'The matching MRI finding supports ischemic stroke here; it does not determine every cause or later care decision.', requires: ['team-mri-summary'], forHypotheses: ['ischemic-stroke'], scope: 'supported' },
        { id: 'all-excluded', label: 'Every competing cause has now been ruled out.', requires: [], scope: 'unsupported' },
      ],
    },
    resolution: {
      hypothesisId: 'ischemic-stroke', evidenceActionIds: ['team-mri-summary'],
      supportedSummary: 'Your conclusion fits the matching acute infarct described in the fictional imaging review. This is support from that recorded finding, beyond the opening symptoms alone.',
      mismatchSummary: 'The chosen explanation does not account for the matching acute infarct described in the fictional imaging review.',
      provisionalSummary: 'Your route ended before the later imaging review. The conclusion remains provisional; a working hypothesis is not confirmation.',
      decisiveClue: 'The later fictional MRI report describes an acute left frontal infarct matching the symptoms.',
      missingClue: 'The later imaging review was not collected. No decisive imaging clue was reached on this route.',
      nextLearning: 'Distinguish a test that finds no bleeding from evidence that excludes interrupted blood flow. Keep uncertainty visible.',
      limitations: LIMITATIONS,
    },
  },
  {
    id: 'stu-003-after-weekend-investigation', version: 3,
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
      { title: 'ADA/EASD and partner societies: Hyperglycemic Crises in Adults With Diabetes, 2024 consensus report', url: 'https://doi.org/10.2337/dci24-0032', checkedUtc: '2026-10-16T04:29:45Z', scope: 'Diagnosis requires the combined glucose/diabetes, ketone and metabolic-acidosis criteria. HHS involves hyperosmolality without significant ketosis or acidosis; no treatment recommendations are used. Fictional values are not source patient data.' },
      { title: '2024 consensus report: open full text, diagnostic criteria section', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11272983/', checkedUtc: '2026-10-16T04:29:45Z', scope: 'Primary consensus text for the three-part DKA argument and the competing HHS pattern. Used only to check authored evidence relations, not care decisions.' },
    ],
    hypotheses: [
      { id: 'diabetic-ketoacidosis', label: 'Diabetic ketoacidosis' },
      { id: 'hyperosmolar-state', label: 'Hyperglycemic hyperosmolar state (HHS) alone' },
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
    reasoning: {
      supportLabel: 'Evidence supporting your explanation',
      limitationLabel: 'Compare explanations or identify a limit',
      prompt: 'Choose a relevant fact or the combined glucose, ketone and acid-base argument. Explain what it supports, how the alternatives compare, and what remains uncertain.',
      caseLearningText: 'Keep glucose, ketones and acid-base evidence distinct until you can connect them. Compare the metabolic explanation with its rivals; one abnormal result is not the whole argument. These alternatives are simplified; real presentations can overlap.',
      insufficientCitationFeedback: 'The three-part argument needs the glucose, ketone and acid-base findings together. Select their combined argument to justify this conclusion; citing one component does not demonstrate that connection.',
      openingFacts: [
        { id: 'opening:vomiting-fatigue-discomfort', label: 'Vomiting, fatigue and abdominal discomfort in the opening handoff', strength: 'concern', supports: ['diabetic-ketoacidosis', 'hyperosmolar-state', 'gastroenteritis'] },
      ],
      supportRules: {
        'recent-history': { strength: 'suggestive', supports: ['diabetic-ketoacidosis', 'hyperosmolar-state'] },
        'bedside-observations': { strength: 'concern', supports: ['diabetic-ketoacidosis', 'hyperosmolar-state', 'gastroenteritis'] },
        'plasma-glucose': { strength: 'component', supports: ['diabetic-ketoacidosis'], conflictsWith: ['hyperosmolar-state'], conflictFeedback: 'The glucose value you read does not fit HHS alone in this fictional case. It does not establish DKA without the remaining findings; real presentations can overlap.' },
        'blood-ketones': { strength: 'component', supports: ['diabetic-ketoacidosis'], conflictsWith: ['hyperosmolar-state'], conflictFeedback: 'The ketone elevation you read does not fit HHS alone in this fictional case. It does not establish DKA without the remaining findings; real presentations can overlap.' },
        'acid-base': { strength: 'component', supports: ['diabetic-ketoacidosis'], conflictsWith: ['hyperosmolar-state'], conflictFeedback: 'The acidosis you read does not fit HHS alone in this fictional case. It does not establish DKA without the remaining findings; real presentations can overlap.' },
        'serum-osmolality': { strength: 'limited', supports: [], conflictsWith: ['hyperosmolar-state'], conflictFeedback: 'The osmolality result you read does not support HHS alone in this fictional case. It does not establish DKA without the remaining findings; real presentations can overlap.' },
      },
      supportGroups: [
        { id: 'pattern:metabolic-triad', label: 'Glucose, blood ketones and acid-base results together', requires: ['plasma-glucose', 'blood-ketones', 'acid-base'], strength: 'decisive', supports: ['diabetic-ketoacidosis'] },
      ],
      uncertaintyOptions: [
        { id: 'symptoms-not-confirmation', label: 'Vomiting and discomfort alone do not establish a metabolic diagnosis.', requires: [], scope: 'provisional' },
        { id: 'history-limits', label: 'Thirst and frequent urination before vomiting weaken a stomach-only explanation; the metabolic cause is still unresolved.', requires: ['recent-history'], missingAny: ['plasma-glucose', 'blood-ketones', 'acid-base'], scope: 'provisional' },
        { id: 'glucose-with-missing-components', label: 'Glucose is raised, but a ketone or acid-base report is still missing from my route.', requires: ['plasma-glucose'], missingAny: ['blood-ketones', 'acid-base'], forHypotheses: ['diabetic-ketoacidosis'], scope: 'provisional' },
        { id: 'ketones-with-missing-components', label: 'Ketones are raised, but a glucose or acid-base report is still missing from my route.', requires: ['blood-ketones'], missingAny: ['plasma-glucose', 'acid-base'], forHypotheses: ['diabetic-ketoacidosis'], scope: 'provisional' },
        { id: 'acidosis-with-missing-components', label: 'A glucose or ketone report is still missing, so this acidosis has not been linked to the full pattern.', requires: ['acid-base'], missingAny: ['plasma-glucose', 'blood-ketones'], forHypotheses: ['diabetic-ketoacidosis'], scope: 'provisional' },
        { id: 'triad-scope', label: 'The laboratory pattern supports ketoacidosis here; it does not determine why it developed or settle every care decision.', requires: ['plasma-glucose', 'blood-ketones', 'acid-base'], forHypotheses: ['diabetic-ketoacidosis'], scope: 'supported' },
        { id: 'osmolality-discriminator', label: 'This osmolality result weakens a markedly hyperosmolar explanation; it cannot establish ketoacidosis on its own.', requires: ['serum-osmolality'], forHypotheses: ['diabetic-ketoacidosis', 'gastroenteritis'], scope: 'any' },
        { id: 'all-excluded', label: 'Every other cause of vomiting has now been ruled out.', requires: [], scope: 'unsupported' },
      ],
    },
    resolution: {
      hypothesisId: 'diabetic-ketoacidosis', evidenceActionIds: ['plasma-glucose', 'blood-ketones', 'acid-base'],
      supportedSummary: 'The collected three-part pattern supports ketoacidosis in this fictional case: elevated glucose, ketones and acidosis. The opening complaint alone was not enough.',
      mismatchSummary: 'The collected glucose, ketone and acid-base findings fit ketoacidosis more closely than the selected explanation in this fictional case.',
      provisionalSummary: 'Your conclusion remains provisional because the glucose, ketone and acid-base results were not all collected. A partial pattern is not the complete evidence set.',
      decisiveClue: 'The fictional combination is glucose 286 mg/dL, beta-hydroxybutyrate 4.8 mmol/L, pH 7.22 and bicarbonate 13 mmol/L.',
      missingClue: 'At least one component of the three-part laboratory pattern is missing from your route.',
      nextLearning: 'Ask whether the required pieces fit together, rather than letting one abnormal number carry the whole conclusion.',
      limitations: LIMITATIONS,
    },
  },
]);
