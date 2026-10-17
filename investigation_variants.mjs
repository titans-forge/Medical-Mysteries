// Current authored records are built from, never written over, the frozen v3 bank.
// This module deliberately has no engine imports: exact record IDs are persistence keys.
const CHECKED_DATE = '2026-10-16';
const IDS = ['doc-002-tearing-back-investigation', 'pub-003-missed-turn-investigation', 'stu-003-after-weekend-investigation'];
const UNRESOLVED = 'cause-unresolved';
const clone = (value) => JSON.parse(JSON.stringify(value));
const choice = (id, label, appropriate, feedback, requires = []) => ({ id, label, appropriate, feedback, requires });
const option = (id, label, requires, scope, extra = {}) => ({ id, label, requires, scope, ...extra });
const provenance = {
  status: 'unreviewed', ownerReportedPriorClinicianReview: true,
  priorReviewScope: 'unverified', priorReviewVersion: 'unverified',
  text: 'The owner reports clinician review of earlier material; its scope and version are unverified. These version 4 records, contrast findings, patient updates and questions are newly authored fiction and have not received separate clinician review.',
};
const limitations = [
  'Authored fictional records pending human medical review; source references support educational framing, not these patient measurements or events.',
  'Update rounds are narrative release events, not clinical minutes, recommended waits or an investigation sequence. Emergency assessment continues independently.',
  'No treatment, dose, eligibility, prognosis or patient outcome is modeled. A recorded explanation does not establish clinical competence.',
  'Earlier owner-reported clinician review has unverified scope and version; it does not cover these new records or workflow events.',
];
const source = (title, url, scope) => ({ title, url, scope, checkedDate: CHECKED_DATE });
const AORTIC_SOURCE = source('2022 ACC/AHA Aortic Disease Guideline: CT image quality', 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000001106', 'Motion affects root and ascending-aortic image quality and diagnostic confidence. A segment explicitly reported as nondiagnostic cannot support exclusion or confirmation. No care protocol is authored.');
const STROKE_SOURCE = source('NINDS: Assess and Treat, diagnostic imaging', 'https://www.ninds.nih.gov/health-information/stroke/assess-and-treat', 'Early ischemia may not be visible on noncontrast CT. An absent or nondiagnostic later study supplies no confirming finding; MRI is not presented as a universal prerequisite for urgent care.');
const STROKE_CURRENT_SOURCE = source('2026 AHA/ASA Guideline for Early Management of Acute Ischemic Stroke, section 3.2', 'https://www.ahajournals.org/doi/10.1161/STR.0000000000000513', 'Clinicians can diagnose ischemic stroke from clinical presentation with a negative noncontrast CT in many patients. MRI is not universally required. This exercise only judges the incomplete supplied record and introduces no treatment or eligibility content.');
const METABOLIC_SOURCE = source('ADA/EASD and partner societies: Hyperglycemic Crises in Adults With Diabetes, 2024 consensus', 'https://doi.org/10.2337/dci24-0032', 'Compare the combined DKA criteria with severe hyperglycemia, hyperosmolality and absence of significant ketosis/acidosis in HHS. The fictional alternatives are simplified; real presentations can overlap. No treatment content is used.');

function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function action(episode, id, patch) {
  const found = episode.actions.find((item) => item.id === id);
  if (!found) throw new TypeError(`Missing v3 action: ${id}`);
  Object.assign(found, patch);
}

const SHORT_LABELS = [
  { 'symptom-timeline': 'Symptom timeline', 'focused-examination': 'Focused examination', ecg: 'ECG report', 'chest-radiograph': 'Chest radiograph', 'aortic-cta': 'Aortic CTA report', 'specialist-handoff': 'Specialist handoff' },
  { 'witness-account': 'Witness account', 'team-examination': 'Team examination', 'glucose-result': 'Glucose report', 'initial-ct': 'First CT report', 'team-mri-summary': 'Later imaging update', 'witness-handoff': 'Witness handoff' },
  { 'recent-history': 'Recent history', 'bedside-observations': 'Bedside observations', 'plasma-glucose': 'Plasma glucose', 'blood-ketones': 'Blood ketones', 'acid-base': 'Acid-base report', 'serum-osmolality': 'Serum osmolality' },
];

function standardAorticResolution() {
  return {
    hypothesisId: 'acute-aortic-syndrome', conclusionKind: 'diagnostic', evidenceActionIds: ['aortic-cta'],
    supportedSummary: 'The reviewed CTA describes the aortic finding that supports acute aortic syndrome in this fictional record.',
    mismatchSummary: 'The selected explanation does not account for the aortic finding described in the reviewed CTA.',
    provisionalSummary: 'The CTA was not reviewed. This remains a working explanation, not a confirmed cause.',
    decisiveClue: 'The fictional CTA describes an ascending-aortic intimal flap extending into the arch.',
    missingClue: 'The CTA report was not reviewed on this route.',
    nextLearning: 'Keep concerning symptoms separate from a report that establishes a finding.', limitations: clone(limitations),
  };
}

function prepare(base, familyIndex, recordB) {
  const episode = clone(base);
  episode.id = recordB ? `${base.id}-record-b` : base.id;
  episode.version = 4;
  episode.familyId = base.id;
  episode.familyTitle = base.title;
  episode.recordLabel = recordB ? 'Arrival B' : 'Arrival A';
  episode.title = base.title;
  episode.subtitle = 'Follow the concern. Review the record. Hand it over.';
  episode.workboardPrompt = 'Choose work to follow up; reports may arrive together.';
  episode.reviewStatus = 'pending_human_review';
  episode.authoredFiction = true;
  episode.reviewProvenance = clone(provenance);
  episode.disclaimer = 'Educational fiction pending human review. Reports, changes and update rounds are authored; they are not clinical advice or patient outcomes.';
  episode.sources = [...episode.sources, clone([AORTIC_SOURCE, STROKE_SOURCE, METABOLIC_SOURCE][familyIndex])];
  if (familyIndex === 1) episode.sources.push(clone(STROKE_CURRENT_SOURCE));
  episode.hypotheses.push({ id: UNRESOLVED, label: 'Cause not established by this record' });
  for (const item of episode.actions) item.label = SHORT_LABELS[familyIndex][item.id];
  episode.reasoning.supportLabel = 'Evidence for your explanation';
  episode.reasoning.limitationLabel = 'A comparison or limit';
  episode.reasoning.prompt = 'Connect your explanation to reviewed evidence, then state a limit.';
  for (const fact of episode.reasoning.openingFacts) fact.supports.push(UNRESOLVED);
  if (!episode.resolution) episode.resolution = standardAorticResolution();
  episode.resolution.conclusionKind = 'diagnostic';
  episode.resolution.limitations = clone(limitations);
  return episode;
}

function limitedAorta(episode) {
  action(episode, 'aortic-cta', {
    finding: 'Authored fictional CTA report: motion obscures the ascending aorta. That segment is nondiagnostic; no definite flap is reported.',
    interpretation: 'A nondiagnostic segment cannot confirm or exclude an aortic process. The limitation needs clinician-owned clarification.',
  });
  action(episode, 'specialist-handoff', {
    finding: 'The fictional handoff states the presenting concern and the motion-limited ascending-aortic report. It does not call the scan negative or confirm a cause.',
    interpretation: 'Pass on the report limitation and confirm who owns clarification; a sent message is not an accepted handoff.',
  });
  episode.reasoning.supportRules['aortic-cta'] = { strength: 'decisive', supports: [UNRESOLVED] };
  episode.reasoning.insufficientCitationFeedback = 'Cite the reviewed nondiagnostic CTA to justify why this supplied record leaves the cause unresolved. An opening concern alone does not demonstrate that limitation.';
  episode.reasoning.caseLearningText = 'A technically limited report is evidence about what the record cannot establish. It is neither a negative scan nor proof of the suspected disease.';
  episode.reasoning.uncertaintyOptions = [
    option('symptoms-not-confirmation', 'Chest discomfort alone does not establish a cause.', [], 'provisional'),
    option('limited-ecg', 'The nonspecific ECG alone does not settle the coronary or aortic question.', ['ecg'], 'any'),
    option('report-scope', 'The ascending segment is nondiagnostic: aortic disease is neither confirmed nor excluded.', ['aortic-cta'], 'supported', { forHypotheses: [UNRESOLVED] }),
    option('all-excluded', 'No reported flap means every aortic explanation is excluded.', [], 'unsupported'),
  ];
  episode.resolution = {
    hypothesisId: UNRESOLVED, conclusionKind: 'unresolved', evidenceActionIds: ['aortic-cta'],
    supportedSummary: 'The reviewed CTA explicitly leaves the ascending segment nondiagnostic. The supplied record does not establish the cause; it neither confirms nor excludes aortic disease.',
    mismatchSummary: 'The nondiagnostic ascending segment does not confirm the selected diagnosis or justify excluding an aortic cause.',
    provisionalSummary: 'Without reviewing the CTA limitation, an unresolved explanation is still provisional on this route.',
    decisiveClue: 'The CTA calls the motion-obscured ascending segment nondiagnostic, with no definite flap reported.',
    missingClue: 'The CTA limitation was not reviewed on this route.',
    nextLearning: 'Carry the inadequate-study limitation into the handoff and name the clinician who owns clarification.', limitations: clone(limitations),
  };
}

function limitedStroke(episode) {
  action(episode, 'team-mri-summary', {
    finding: 'Fictional later imaging update: an attempted study is nondiagnostic. No diagnostic later imaging result is available in this supplied record.',
    interpretation: 'This supplies no confirming image and does not rule out stroke. The persistent focal concern still needs clinician-owned assessment; this is not a rule that care waits for MRI.',
  });
  episode.reasoning.supportRules['team-mri-summary'] = { strength: 'component', supports: [UNRESOLVED] };
  episode.reasoning.supportRules['initial-ct'] = { strength: 'component', supports: [UNRESOLVED] };
  episode.reasoning.supportGroups = [{ id: 'pattern:imaging-limits', label: 'First CT and later imaging limitation together', requires: ['initial-ct', 'team-mri-summary'], strength: 'decisive', supports: [UNRESOLVED] }];
  episode.reasoning.insufficientCitationFeedback = 'Connect the first CT and later nondiagnostic update. Together they explain why these supplied images have not established the cause; neither is proof that stroke is excluded.';
  episode.reasoning.caseLearningText = 'No hemorrhage on this CT is different from excluding early ischemia. The supplied later study adds no diagnostic finding. Clinicians can diagnose stroke from clinical presentation and CT; this exercise judges only the incomplete supplied record, without making MRI a prerequisite.';
  episode.reasoning.uncertaintyOptions = [
    option('symptoms-not-confirmation', 'The opening speech and hand changes raise concern but do not establish a cause.', [], 'provisional'),
    option('glucose-discriminator', 'The glucose result weakens current low glucose; it is not a positive stroke test.', ['glucose-result'], 'any', { forHypotheses: ['ischemic-stroke', 'migraine-aura', UNRESOLVED] }),
    option('ct-limit', 'The first CT alone does not exclude early ischemia.', ['initial-ct'], 'any'),
    option('imaging-scope', 'These reports leave the cause unestablished; persistent focal changes still belong in the clinician handoff.', ['initial-ct', 'team-mri-summary'], 'supported', { forHypotheses: [UNRESOLVED] }),
    option('all-excluded', 'The first CT and absent diagnostic later image exclude stroke.', [], 'unsupported'),
  ];
  episode.resolution = {
    hypothesisId: UNRESOLVED, conclusionKind: 'unresolved', evidenceActionIds: ['initial-ct', 'team-mri-summary'],
    supportedSummary: 'The first CT shows no hemorrhage or definite early infarct, and later imaging is nondiagnostic. The cause is not established by this supplied record; stroke is not excluded.',
    mismatchSummary: 'The supplied imaging does not establish the selected cause. Persistent focal changes keep stroke a live concern rather than a confirmed or excluded diagnosis here.',
    provisionalSummary: 'The first CT and later imaging limitation were not both reviewed. An unresolved explanation remains provisional on this route.',
    decisiveClue: 'The early CT does not exclude ischemia; the later attempted study supplies no diagnostic result.',
    missingClue: 'At least one of the two imaging reports was not reviewed.',
    nextLearning: 'Report the ongoing focal concern and the actual imaging limits. Further assessment belongs to the responsible clinician, without a universal MRI requirement.', limitations: clone(limitations),
  };
}

function hyperosmolarWeekend(episode) {
  action(episode, 'bedside-observations', {
    finding: 'Fictional observations: the patient is tired but conversant, with dry mouth and abdominal discomfort.',
    interpretation: 'These observations need explanation. Conversing does not settle the metabolic pattern or its importance.',
  });
  const findings = {
    'plasma-glucose': ['Fictional laboratory result: plasma glucose is 720 mg/dL.', 'Markedly raised glucose is one component; it does not establish ketoacidosis or HHS by itself.'],
    'blood-ketones': ['Fictional laboratory result: beta-hydroxybutyrate is 0.8 mmol/L.', 'This report does not show significant ketonemia. Compare it with glucose, osmolality and acid-base findings.'],
    'acid-base': ['Fictional laboratory results: venous pH is 7.36 and bicarbonate is 23 mmol/L.', 'This report does not show the metabolic acidosis required for the authored DKA pattern. It does not make the other abnormalities unimportant.'],
    'serum-osmolality': ['Fictional laboratory result: measured total serum osmolality is 334 mOsm/kg.', 'Hyperosmolality joins the other report components; this value alone does not establish the entire explanation.'],
  };
  for (const [id, [finding, interpretation]] of Object.entries(findings)) action(episode, id, { finding, interpretation });
  const all = ['plasma-glucose', 'blood-ketones', 'acid-base', 'serum-osmolality'];
  episode.reasoning.caseLearningText = 'Compare all four reports: severe hyperglycemia and hyperosmolality without significant ketosis or acidosis support the HHS pattern here. One value cannot carry the conclusion. These alternatives are simplified; real presentations can overlap.';
  episode.reasoning.insufficientCitationFeedback = 'Select the combined glucose, osmolality, ketone and acid-base argument. Reading all four but citing a single component does not explain how this pattern differs from ketoacidosis.';
  episode.reasoning.supportRules = {
    'recent-history': { strength: 'suggestive', supports: ['diabetic-ketoacidosis', 'hyperosmolar-state'] },
    'bedside-observations': { strength: 'concern', supports: ['diabetic-ketoacidosis', 'hyperosmolar-state', 'gastroenteritis', UNRESOLVED] },
    'plasma-glucose': { strength: 'component', supports: ['diabetic-ketoacidosis', 'hyperosmolar-state'] },
    'blood-ketones': { strength: 'component', supports: ['hyperosmolar-state'], conflictsWith: ['diabetic-ketoacidosis'], conflictFeedback: 'The reviewed ketone value does not show the significant ketosis required for DKA in this authored record. It does not establish HHS without the other report components; real presentations can overlap.' },
    'acid-base': { strength: 'component', supports: ['hyperosmolar-state'], conflictsWith: ['diabetic-ketoacidosis'], conflictFeedback: 'The reviewed pH and bicarbonate do not show the acidosis required for this authored DKA pattern. They do not establish HHS or make the other abnormalities safe.' },
    'serum-osmolality': { strength: 'component', supports: ['hyperosmolar-state'] },
  };
  episode.reasoning.supportGroups = [{ id: 'pattern:hyperosmolar-components', label: 'Glucose, osmolality, ketones and acid-base together', requires: all, strength: 'decisive', supports: ['hyperosmolar-state'] }];
  episode.reasoning.uncertaintyOptions = [
    option('symptoms-not-confirmation', 'Vomiting and discomfort alone do not establish a metabolic cause.', [], 'provisional'),
    option('history-limits', 'The symptom chronology suggests a metabolic concern but does not distinguish its laboratory pattern.', ['recent-history'], 'provisional', { missingAny: all }),
    option('partial-pattern', 'Glucose alone does not distinguish HHS from DKA; another component is still missing from my route.', ['plasma-glucose'], 'provisional', { missingAny: ['blood-ketones', 'acid-base', 'serum-osmolality'] }),
    option('hyperosmolar-scope', 'The combined reports support HHS here, but do not establish its precipitant or every care decision.', all, 'supported', { forHypotheses: ['hyperosmolar-state'] }),
    option('acid-base-limit', 'A non-acidotic pH alone cannot make the glucose and osmolality findings unimportant.', ['acid-base'], 'any'),
    option('all-excluded', 'The non-acidotic pH excludes an important metabolic problem.', [], 'unsupported'),
  ];
  episode.resolution = {
    hypothesisId: 'hyperosmolar-state', conclusionKind: 'diagnostic', evidenceActionIds: all,
    supportedSummary: 'The combined fictional reports fit the HHS pattern: severe hyperglycemia and hyperosmolality without significant ketosis or acidosis.',
    mismatchSummary: 'The combined reports favor the hyperosmolar pattern over the selected explanation in this fictional record. Raised glucose alone was not enough to choose.',
    provisionalSummary: 'At least one of glucose, osmolality, ketones or acid-base was not reviewed. This remains a partial metabolic argument.',
    decisiveClue: 'Glucose 720 mg/dL, total osmolality 334 mOsm/kg, beta-hydroxybutyrate 0.8 mmol/L, pH 7.36 and bicarbonate 23 mmol/L form the authored pattern.',
    missingClue: 'At least one of the four required report components is missing from this route.',
    nextLearning: 'Compare the full pattern. Very high glucose does not by itself mean ketoacidosis, and a non-acidotic pH does not mean no major metabolic concern.', limitations: clone(limitations),
  };
}

function workflowFor(episode, index, recordB) {
  const profile = clone(episode.careWorkflow);
  profile.episodeId = episode.id;
  profile.workboardPrompt = episode.workboardPrompt;
  profile.reviewProvenance = clone(provenance);
  profile.timingNote = 'Fictional update rounds release reports and narrative events. They are not minutes, recommended waits or a prescribed clinical sequence.';
  const family = [
    { owner: 'ED senior clinician', concern: 'sudden chest discomfort', receiver: 'The ED senior coordinating this assessment.', opening: 'A 61-year-old arrived with sudden severe chest discomfort and an incomplete handoff.', boundary: 'Coordinate concern, task owners and review; treatment and patient outcomes are outside this exercise.' },
    { owner: 'Receiving ED clinician', concern: 'sudden speech and hand-use changes', receiver: 'The receiving ED clinician or nurse accepting the witness account.', opening: 'At dinner, a 68-year-old suddenly had trouble speaking and holding a fork; emergency help was called.', boundary: 'Report what you witnessed and ask who accepts updates. The ED team owns tests, clinical assessment and care decisions.' },
    { owner: 'Supervising clinician', concern: 'vomiting, fatigue and abdominal discomfort', receiver: 'The supervising clinician responsible for this assessment.', opening: 'A 26-year-old arrived with vomiting, fatigue and abdominal discomfort; the stomach-illness account was incomplete.', boundary: 'Offer a synthesis and questions to the supervisor. Independent test orders, treatment and care decisions are outside the student role.' },
  ][index];
  profile.role.boundary = family.boundary;
  for (const [id, task] of Object.entries(profile.tasks)) task.label = `Follow up: ${SHORT_LABELS[index][id].toLowerCase()}`;
  profile.priority = {
    prompt: 'Who needs the opening concern before its cause is settled?',
    choices: [
      choice('share-opening-concern', `Share ${family.concern} with the ${family.owner.toLowerCase()} and confirm who accepts review.`, true, 'Communicate the concern and uncertainty early; a diagnostic label is not required to name a review owner.'),
      choice('finish-record-before-contact', `Collect the remaining reports first, then ask the ${family.owner.toLowerCase()} to accept the complete explanation.`, false, 'A fuller record may refine the explanation. It does not replace early shared awareness and responsibility for the presenting concern.'),
    ],
  };
  profile.reassessment = {
    minimumReviewed: 1,
    update: 'Fictional team checkpoint: identify what you reviewed, what remains pending and who accepts the next review. This checkpoint supplies no additional examination or laboratory finding.',
    prompt: 'What does the next review need from you?',
    choices: [
      choice('review-known-and-pending', `Separate reviewed from pending information and confirm that the ${family.owner.toLowerCase()} owns the next review.`, true, 'Report availability and clinical ownership are different. Bring the actual evidence and remaining question to the named receiver.'),
      choice('review-after-worklist', `Wait for the worklist to finish, then ask the ${family.owner.toLowerCase()} to review one final summary.`, false, 'The concern needs an owner while work continues. A final summary cannot replace an accepted next review now.'),
    ],
    variants: [],
  };
  if (index === 0) profile.reassessment.variants.push({
    id: 'ecg-interpretation', requires: ['ecg'], prompt: 'What does the small, nonspecific ECG change add?',
    choices: [
      choice('reassess-ecg-limited', 'Include it as a limited finding; the ECG alone settles neither a coronary cause nor the aortic question.', true, 'Keep this report within its scope, even if other reviewed evidence supports a stronger conclusion.'),
      choice('reassess-ecg-coronary', 'Prioritize a confirmed coronary explanation; use the remaining reports mainly to define its extent.', false, 'The supplied ECG is nonspecific and does not establish a coronary cause or remove the aortic concern.'),
    ],
  });
  if (index === 1) profile.reassessment.variants.push({
    id: 'early-ct-limit', requires: ['initial-ct'], prompt: 'What does the first CT report settle?',
    choices: [
      choice('reassess-ct-limited', 'It reports no hemorrhage or definite early infarct; this CT alone does not exclude early ischemia.', true, 'A limited negative finding is not exclusion of every cause. Communicate continuing observed concerns to the ED team.'),
      choice('reassess-ct-excludes', 'It reports no visible infarct, so the speech and arm changes can be handed over as a non-stroke problem.', false, 'Early ischemia may not be visible on this CT. The report does not establish a non-stroke explanation.'),
    ],
  });
  if (index === 2) profile.reassessment.variants.push({
    id: 'glucose-component-limit', requires: ['plasma-glucose'], prompt: `What can glucose ${recordB ? '720' : '286'} mg/dL establish alone?`,
    choices: [
      choice('reassess-glucose-component', 'Report raised glucose as one component; compare ketones, acid-base and any reviewed osmolality separately.', true, 'The full metabolic argument depends on the relevant combination. A single component does not establish the pattern.'),
      choice('reassess-glucose-completes', 'Use the glucose value to establish ketoacidosis; treat the remaining reports as severity details.', false, 'Raised glucose alone is insufficient for ketoacidosis. Ketones and acid-base findings address distinct parts of the explanation.'),
    ],
  });
  const situations = [choice('opening-concern', family.opening, true, 'This is an opening fact, available for an early handoff. Add the actual reviewed and pending information to the shared record.')];
  const qualifications = [choice('opening-scope', 'The opening symptoms alone do not establish a cause; stronger claims must cite reviewed findings.', true, 'This limits the opening account without pretending later reports are still unknown.')];
  if (index === 0) {
    situations.push(choice('reviewed-cta', recordB ? 'The reviewed CTA calls the motion-obscured ascending segment nondiagnostic; no definite flap is reported.' : 'The reviewed CTA describes an ascending-aortic intimal flap extending into the arch.', true, 'Carry the actual report wording, rather than replacing it with a broader diagnosis or exclusion claim.', ['aortic-cta']));
    qualifications.push(choice('cta-scope', recordB ? 'The nondiagnostic ascending segment neither confirms nor excludes aortic disease.' : 'The CTA supports the aortic finding here; it does not settle every subsequent care decision.', true, 'The handoff should preserve the specific report finding and its scope.', ['aortic-cta']));
  } else if (index === 1) {
    situations.push(choice('reviewed-witness', 'The reviewed witness account places the speech and right-hand changes together, with continuing difficulty.', true, 'Distinguish witnessed onset and changes from a diagnosis.', ['witness-account']));
    situations.push(choice('reviewed-imaging', recordB ? 'The first CT shows no hemorrhage or definite early infarct; the later attempted study is nondiagnostic.' : 'The later MRI report describes a matching small acute left frontal infarct.', true, 'State the findings actually reviewed. Do not replace an unavailable diagnostic result with a normal scan.', recordB ? ['initial-ct', 'team-mri-summary'] : ['team-mri-summary']));
    qualifications.push(choice('imaging-scope', recordB ? 'The supplied images do not establish the cause or exclude stroke; continuing focal changes need the ED team’s assessment.' : 'The matching imaging supports ischemic stroke here; it does not settle every cause or care decision.', true, 'The witness reports evidence and concerns; the clinical team owns the assessment and further decisions.', recordB ? ['initial-ct', 'team-mri-summary'] : ['team-mri-summary']));
  } else {
    situations.push(choice('reviewed-glucose', `The reviewed plasma glucose is ${recordB ? '720' : '286'} mg/dL; this number alone is not the full pattern.`, true, 'Include the value without inventing the unreviewed components.', ['plasma-glucose']));
    situations.push(choice('reviewed-pattern', recordB ? 'The reviewed reports show glucose 720 mg/dL, total osmolality 334 mOsm/kg, ketones 0.8 mmol/L, pH 7.36 and bicarbonate 23 mmol/L.' : 'The reviewed reports show glucose 286 mg/dL, ketones 4.8 mmol/L, pH 7.22 and bicarbonate 13 mmol/L.', true, 'A report-specific combined statement is available only after all its components were reviewed.', recordB ? ['plasma-glucose', 'serum-osmolality', 'blood-ketones', 'acid-base'] : ['plasma-glucose', 'blood-ketones', 'acid-base']));
    qualifications.push(choice('pattern-scope', recordB ? 'The combined reports fit the HHS pattern here; the precipitant and care decisions remain for the supervisor.' : 'The combined reports fit ketoacidosis here; the precipitant and care decisions remain for the supervisor.', true, 'A supported synthesis does not transfer clinical responsibility to the student. Real metabolic presentations can overlap.', recordB ? ['plasma-glucose', 'serum-osmolality', 'blood-ketones', 'acid-base'] : ['plasma-glucose', 'blood-ketones', 'acid-base']));
  }
  situations.push(choice('opening-establishes-cause', ['The initial chest discomfort establishes a coronary cause; hand over the other reports as secondary details.', 'The initial speech change establishes stroke; hand over the arm change as a severity detail.', 'The initial vomiting establishes a stomach illness; hand over the glucose report as a separate issue.'][index], false, 'The opening observation does not establish that cause. Keep what happened separate from the explanation.'));
  qualifications.push(choice('confirmation-before-handoff', 'Hold the handoff until a single cause is confirmed, so the receiver gets no unresolved question.', false, 'An unresolved question belongs in an early handoff. It should have a named clinical receiver, not be silently withheld.'));
  profile.handoff = {
    receiver: { prompt: 'Who accepts this concern?', choices: [
      choice('named-clinical-receiver', family.receiver, true, 'Name the clinical receiver and verify acceptance of the concern.'),
      choice('worklist-receiver', 'The shared results worklist, with the next reader deciding who receives the concern.', false, 'A worklist records tasks; it does not show who accepted responsibility.'),
    ] },
    situation: { prompt: 'Which known fact will you carry forward?', choices: situations },
    uncertainty: { prompt: 'Which limit belongs with that statement?', choices: qualifications },
    nextOwner: { prompt: 'Who follows up the remaining concern?', choices: [
      choice('named-next-review', `Confirm the ${family.owner.toLowerCase()} owns the next review and how new reports or symptom changes reach them.`, true, 'Identify an accountable receiver and an update route. This assigns communication responsibility, not treatment.'),
      choice('task-implies-transfer', 'Use the completed request as the transfer of responsibility; the receiving worklist can assign the next review.', false, 'A sent request is not evidence that another person accepted the concern or the next review.'),
    ] },
  };
  profile.readback = { prompt: 'Which reply can you verify to close the loop?', choices: [
    choice('specific-readback', `“I heard the ${family.concern} concern. I accept the next review; repeat what is reviewed and what needs follow-up.”`, true, 'Check the repeated concern, known findings and owner against your message; correct a mismatch before closing the loop.'),
    choice('worklist-acknowledgment', '“I can see the request in the worklist. The next person reading the results can arrange further review.”', false, 'The concern and accountable next reviewer have not been repeated or accepted. Ask the receiver to clarify them.'),
  ] };
  const update = [
    { id: 'pain-change', text: 'Authored fictional change after arrival: the patient tells the bedside nurse that the chest pain feels worse than at the opening handoff. No new vital signs or examination findings are supplied.', prompt: 'How should this reported change reach the team?', good: 'Tell the ED senior the patient reports worse pain, distinguish it from reviewed reports, and confirm who accepts reassessment.', bad: 'Record the worse-pain report for the final handoff and wait for the outstanding report batch before flagging the change.' },
    { id: 'speech-arm-change', text: 'Authored fictional change after arrival: a family member reports speech sounds clearer, while difficulty using the right arm continues. This is a witness update, not a new clinician examination.', prompt: 'How should you pass on this mixed change?', good: 'Tell the receiving ED team that speech seems clearer but the arm difficulty continues, and ask who accepts the update.', bad: 'Pass on the clearer speech as the main update and leave the continuing arm difficulty in the earlier written account.' },
    { id: 'thirst-tiredness-change', text: 'Authored fictional change after arrival: the patient tells the student that thirst persists and tiredness has increased; the patient is still conversant. No new laboratory or examination result is supplied.', prompt: 'What should you bring to the supervisor?', good: 'Report persistent thirst and increased tiredness, state that the patient is conversant, and confirm the supervisor accepts review.', bad: 'Keep the symptom update for the completed laboratory synthesis, using conversation as reassurance while the reports are pending.' },
  ][index];
  profile.patientUpdates = [{
    id: update.id, afterRound: 1, requiresReviewed: [], text: update.text, prompt: update.prompt,
    choices: [
      choice('communicate-change', update.good, true, 'Communicate the actual reported change and confirm a clinical owner. It neither establishes the cause nor predicts the outcome.'),
      choice('defer-change-to-summary', update.bad, false, 'The new concern needs to reach the responsible clinician with its full detail. A pending report or one improved feature does not replace that communication.'),
    ],
  }];
  // Stable authored order varies by exact record and checkpoint, never at replay.
  // IDs, meaning and feedback remain attached to their choices.
  const questions = [profile.priority, profile.reassessment, ...profile.reassessment.variants,
    ...Object.values(profile.handoff), profile.readback, ...profile.patientUpdates];
  questions.forEach((question, checkpoint) => {
    if ((index + Number(recordB) + checkpoint) % 2 === 1) question.choices.reverse();
  });
  return profile;
}

function transferQuestion(index, recordB) {
  const common = { version: 1, synthetic: true, reviewStatus: 'pending_human_review', sourceCheckedDate: CHECKED_DATE, delivery: 'after-another-arrival' };
  if (recordB && index === 0) return { ...common,
    id: 'aortic-diagnostic-report-contrast-v4',
    prompt: 'A different fictional arrival has a diagnostic-quality CTA. The radiologist explicitly reports acute dissection of the ascending aorta. Which conclusion fits this different report?',
    choices: [
      { id: 'still-nondiagnostic', label: 'The aortic question must stay unresolved because a previous arrival had motion-limited imaging.', feedback: 'The earlier record does not determine this report’s quality. Use the supplied diagnostic finding for this arrival.' },
      { id: 'finding-supported', label: 'The diagnostic report supports the aortic finding here; later care decisions still need the responsible team.', feedback: 'This report supplies a positive diagnostic finding. It has a different evidential status from a nondiagnostic segment.' },
      { id: 'all-settled', label: 'Attribute the entire presentation to that finding and leave the competing concerns out of the handoff.', feedback: 'A diagnostic finding supports a conclusion without resolving every concurrent condition or removing other relevant observations from the handoff.' },
    ], answerId: 'finding-supported', source: clone(AORTIC_SOURCE),
  };
  if (recordB && index === 1) return { ...common,
    id: 'stroke-positive-report-contrast-v4',
    prompt: 'A different fictional arrival has continuing focal changes. A later diagnostic imaging report explicitly identifies acute ischemic injury matching those changes. What can this report add?',
    choices: [
      { id: 'still-no-evidence', label: 'The cause remains unsupported solely because the first CT showed no definite early infarct.', feedback: 'A later positive finding changes this supplied record. The first CT does not cancel it.' },
      { id: 'matching-support', label: 'The matching report supports ischemic stroke here, while its cause and later care decisions still need assessment.', feedback: 'A matching diagnostic finding adds support beyond the early limited report. It does not mean all suspected strokes universally require this imaging.' },
      { id: 'all-focal-proven', label: 'Use the matching injury to establish its mechanism as well, without a separate cause assessment.', feedback: 'A matching injury supports ischemic stroke in this record; its mechanism and later care decisions are separate questions.' },
    ], answerId: 'matching-support', source: clone(STROKE_SOURCE),
  };
  if (recordB && index === 2) return { ...common,
    id: 'ketoacidotic-pattern-contrast-v4',
    prompt: 'A different fictional arrival has glucose 410 mg/dL, beta-hydroxybutyrate 5.2 mmol/L, venous pH 7.25 and bicarbonate 16 mmol/L. Which explanation uses this different combination?',
    choices: [
      { id: 'hhs-by-memory', label: 'HHS alone, treating the ketones and acidosis as nonspecific effects of dehydration.', feedback: 'The significant ketones and acidosis are required parts of the ketoacidotic pattern, not findings to discard. Real presentations can overlap.' },
      { id: 'dka-pattern', label: 'Ketoacidosis is supported by raised glucose, significant ketones and acidosis together.', feedback: 'The three components form the authored ketoacidotic pattern. Do not reuse the earlier HHS conclusion just because both involve high glucose.' },
      { id: 'glucose-alone', label: 'Keep ketoacidosis unsupported until an osmolality report completes its diagnostic pattern.', feedback: 'Osmolality can help compare explanations, but it is not a substitute for or an additional requirement of the supplied three-part DKA argument.' },
    ], answerId: 'dka-pattern', source: clone(METABOLIC_SOURCE),
  };
  if (index === 0) return { ...common,
    id: recordB ? 'aortic-limited-symptom-change-v4' : 'aortic-image-quality-contrast-v4',
    prompt: recordB ? 'In another fictional record, pain eases after a CTA that calls the ascending segment motion-limited and nondiagnostic. What can the receiver infer?' : 'A different fictional CTA calls the motion-obscured ascending segment nondiagnostic, with no definite flap reported. Which conclusion fits?',
    choices: [
      { id: 'negative', label: recordB ? 'Easing pain converts the limited scan into evidence against an aortic cause.' : 'No reported flap makes this a reliable negative aortic scan.', feedback: 'A symptom change does not repair the stated image limitation. Nondiagnostic is not a reliable exclusion.' },
      { id: 'unresolved', label: 'The aortic question remains unresolved; name the clinician responsible for clarifying the inadequate study.', feedback: 'Preserve the report limitation and clinical ownership without confirming or excluding aortic disease.' },
      { id: 'confirmed', label: 'The symptom account confirms an aortic cause despite the inadequate study.', feedback: 'Concerning symptoms do not turn this inadequate report into confirmation.' },
    ], answerId: 'unresolved', source: clone(AORTIC_SOURCE),
  };
  if (index === 1) return { ...common,
    id: recordB ? 'stroke-limited-record-handoff-v4' : 'stroke-improving-symptoms-v4',
    prompt: recordB ? 'A different fictional record has continuing one-sided arm difficulty, a first CT with no hemorrhage or definite early infarct, and no diagnostic later image. What belongs in the witness handoff?' : 'In a different fictional record, sudden speech difficulty improves while one-sided hand difficulty continues. Emergency help is already called. What changes about the concern?',
    choices: [
      { id: 'exclude', label: 'The improvement or lack of a visible infarct establishes a non-stroke explanation.', feedback: 'Neither partial symptom improvement nor this early CT excludes ischemia or establishes another cause.' },
      { id: 'confirmed', label: 'The symptoms alone establish a confirmed ischemic stroke for the handoff.', feedback: 'The focal concern is important but does not by itself establish the cause in this supplied record.' },
      { id: 'concern-and-limits', label: 'Report the continuing focal change and the evidence limits to the ED team; the cause still needs clinical assessment.', feedback: 'Communicate both the actual observation and uncertainty. A diagnostic later image is not a universal prerequisite for urgent assessment.' },
    ], answerId: 'concern-and-limits', source: clone(STROKE_SOURCE),
  };
  return { ...common,
    id: recordB ? 'hyperosmolar-component-trap-v4' : 'hyperosmolar-pattern-contrast-v4',
    prompt: recordB ? 'Another fictional record has glucose 720 mg/dL and total osmolality 334 mOsm/kg, with ketones 0.8 mmol/L, pH 7.36 and bicarbonate 23 mmol/L. A colleague cites only the pH as reassurance. Which response uses the whole record?' : 'A different fictional record has glucose 720 mg/dL, total osmolality 334 mOsm/kg, ketones 0.8 mmol/L, pH 7.36 and bicarbonate 23 mmol/L. Which explanation fits the combination?',
    choices: [
      { id: 'dka', label: 'The high glucose establishes ketoacidosis; the other components describe its severity.', feedback: 'Glucose alone does not establish ketoacidosis. These supplied ketone and acid-base results do not show that pattern.' },
      { id: 'hhs', label: 'Severe hyperglycemia and hyperosmolality without significant ketosis or acidosis fit the HHS pattern.', feedback: 'The combined components distinguish this authored pattern. They do not settle the precipitant or care decisions, and real presentations can overlap.' },
      { id: 'reassured', label: 'The non-acidotic pH makes the glucose and osmolality findings a secondary concern.', feedback: 'A non-acidotic pH is not reassurance about the full metabolic picture. The glucose and osmolality remain material findings.' },
    ], answerId: 'hhs', source: clone(METABOLIC_SOURCE),
  };
}

export function buildCurrentInvestigations(frozenV3Episodes) {
  if (!Array.isArray(frozenV3Episodes)) throw new TypeError('Expected the frozen version 3 episode array.');
  const byId = new Map(frozenV3Episodes.map((episode) => [episode?.id, episode]));
  const records = [];
  for (const [index, id] of IDS.entries()) {
    const base = byId.get(id);
    if (!base || base.version !== 3 || !base.careWorkflow || !base.reasoning) throw new TypeError(`Missing trusted version 3 episode: ${id}`);
    for (const recordB of [false, true]) {
      const episode = prepare(base, index, recordB);
      if (recordB) [limitedAorta, limitedStroke, hyperosmolarWeekend][index](episode);
      episode.careWorkflow = workflowFor(episode, index, recordB);
      episode.transferQuestion = transferQuestion(index, recordB);
      records.push(episode);
    }
  }
  return freeze(records);
}
