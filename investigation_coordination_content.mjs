// Version 5 is derived from the frozen published version 4 bank. This module
// owns authored fiction only; replay and snapshot selection live in the engine.
const clone = (value) => JSON.parse(JSON.stringify(value));
const FAMILY_IDS = ['doc-002-tearing-back-investigation', 'pub-003-missed-turn-investigation', 'stu-003-after-weekend-investigation'];
const UNRESOLVED = 'cause-unresolved';
const CHECKED_DATE = '2026-10-17';
// Version 5 has a new workflow identity. Compact, field-specific choice keys
// leave space for the full supported event log in the existing save envelope.
const HANDOFF_IDS = {
  'named-clinical-receiver': 'r-clinical', 'worklist-receiver': 'r-worklist',
  'opening-concern': 's-opening', 'reviewed-cta': 's-cta', 'reviewed-witness': 's-witness',
  'reviewed-imaging': 's-imaging', 'reviewed-glucose': 's-glucose', 'reviewed-pattern': 's-pattern',
  'opening-establishes-cause': 's-overclaim', 'opening-scope': 'u-opening', 'cta-scope': 'u-cta',
  'imaging-scope': 'u-imaging', 'pattern-scope': 'u-pattern', 'confirmation-before-handoff': 'u-delay',
  'named-next-review': 'o-clinical', 'task-implies-transfer': 'o-worklist',
};
const SOURCES = [
  { title: 'AHRQ TeamSTEPPS: Check-Back (or Repeat-Back)', url: 'https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/checkback.html', checkedDate: CHECKED_DATE,
    scope: 'The receiver repeats the message and the sender verifies or corrects understanding. These scripted exchanges are newly authored fiction, without treatment instructions.' },
  { title: 'AHRQ TeamSTEPPS: Handoff', url: 'https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/handoff.html', checkedDate: CHECKED_DATE,
    scope: 'Communicate uncertainty, recent changes, named responsibility and receiver acceptance. The educational exercise does not transfer real clinical authority.' },
];
const PROVENANCE = {
  status: 'unreviewed', ownerReportedPriorClinicianReview: true,
  priorReviewScope: 'unverified', priorReviewVersion: 'unverified',
  text: 'The owner reports clinician review of earlier material; the reviewed scope and version are unverified. These version 5 receiver exchanges, contextual questions and Arrival C contrasts are newly authored fiction and have not received separate clinician review.',
};
function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
const choice = (id, label, appropriate, feedback) => ({ id, label, appropriate, feedback, requires: [] });
// The position is part of the authored question. It never depends on a run,
// snapshot, random generator, clock or saved answer.
function decisions(id, good, alternatives, position = 0) {
  const correct = choice(`${id}-verify`, good[0], true, good[1]);
  const other = alternatives.map(([label, feedback], index) => choice(`${id}-alternative-${index + 1}`, label, false, feedback));
  return position === 0 ? [correct, ...other] : position === 1 ? [other[0], correct, other[1]] : [...other, correct];
}
function scenario(id, gates, message, prompt, good, alternatives, position) {
  return { id, ...gates, message, prompt, choices: decisions(id, good, alternatives, position) };
}
const handoffPrompt = 'Compare the receiver’s words with this sent handoff. What should you verify or correct?';
const reassessmentPrompt = 'Which account fits the reviewed record, reported change and work still outstanding?';
function openingFor(index) {
  return [
    { owner: 'ED senior clinician', concern: 'sudden chest discomfort', opening: 'sudden severe chest discomfort', cause: 'a coronary cause', updateId: 'pain-change', change: 'the patient reports worse chest pain' },
    { owner: 'receiving ED clinician', concern: 'speech and hand-use changes', opening: 'sudden speech and hand-use difficulty at dinner', cause: 'a confirmed stroke', updateId: 'speech-arm-change', change: 'speech seems clearer while right-arm difficulty continues' },
    { owner: 'supervising clinician', concern: 'vomiting, fatigue and abdominal discomfort', opening: 'vomiting, fatigue and abdominal discomfort', cause: 'a stomach illness', updateId: 'thirst-tiredness-change', change: 'thirst persists and tiredness has increased while the patient remains conversant' },
  ][index];
}
function handoffRepairs(family, prefix, position) {
  const clarification = 'Correct this part of the exchange, then review any other handoff issue. One correction does not repair a separate inaccurate selection.';
  return [
    scenario(`${prefix}-receiver-not-accepted`, { requiresSelections: { receiverId: 'worklist-receiver' } },
      `“The worklist entry for ${family.concern} is visible. I have not accepted the next clinical review.”`, handoffPrompt,
      [`Clarify who accepts the ${family.concern} concern and ask the named clinician to repeat their responsibility.`, clarification], [
        ['Verify that the entry is visible and record the next clinical review as accepted through the shared worklist.', 'Visibility does not establish that a person accepted responsibility.'],
        ['Ask for a more complete diagnostic summary, then use its inclusion in the worklist as the review assignment.', 'More detail does not resolve the missing clinical receiver.'],
      ], position),
    scenario(`${prefix}-next-owner-missing`, { requiresSelections: { nextOwnerId: 'task-implies-transfer' } },
      '“I received the summary. Whoever reads the last report will take responsibility for the next review.”', handoffPrompt,
      [`Ask the ${family.owner} to accept the next review and confirm the route for later reports or changes.`, clarification], [
        ['Confirm that the final report reader will be recorded as the owner when the worklist becomes complete.', 'A future reader is not a named person accepting the concern now.'],
        ['Verify the findings in the summary and leave ownership to the team handling the remaining requests.', 'Finding accuracy and ownership are separate parts of the exchange.'],
      ], (position + 1) % 3),
    scenario(`${prefix}-opening-overclaim`, { requiresSelections: { situationId: 'opening-establishes-cause' } },
      `“I heard that the opening ${family.opening} establishes ${family.cause}.”`, handoffPrompt,
      ['Correct the opening claim: it describes the presenting concern; stronger conclusions must use findings actually reviewed.', clarification], [
        ['Verify the diagnostic wording because it repeats the situation selected in the handoff accurately.', 'Repeating an inaccurate claim does not make it valid. The sender must also check its meaning against the known record.'],
        ['Keep that diagnosis in the exchange and label the remaining reports as details about its extent.', 'The opening account does not establish the diagnosis or make other findings secondary.'],
      ], (position + 2) % 3),
    scenario(`${prefix}-uncertainty-withheld`, { requiresSelections: { uncertaintyId: 'confirmation-before-handoff' } },
      '“I will accept the unresolved question after one cause has been confirmed.”', handoffPrompt,
      [`Clarify that the ${family.owner} needs to accept the concern with its current uncertainty and outstanding work.`, clarification], [
        ['Verify the condition for acceptance and keep responsibility with the results worklist until the cause is confirmed.', 'Diagnostic uncertainty does not supply an accountable next reviewer.'],
        ['Replace the unresolved question with the leading diagnosis so the receiver can accept a definite account.', 'A stronger label cannot substitute for communicating the actual evidence and uncertainty.'],
      ], position),
  ];
}

function aorticScenarios(record, variant) {
  const family = openingFor(0);
  if (variant === 'c') { family.updateId = 'pain-easing-change'; family.change = 'the patient reports less chest pain'; }
  const prefix = `aorta-${variant}`;
  const reviewed = ['aortic-cta'];
  const limited = variant === 'b';
  const report = limited ? 'the ascending segment is motion-limited and nondiagnostic, with no definite flap reported' : 'the CTA describes an ascending-aortic intimal flap extending into the arch';
  const scope = limited ? 'The report neither confirms nor excludes an aortic cause.' : 'The reviewed report supports the aortic finding; it does not settle every later decision.';
  const primaryAccurate = variant === 'b';
  const message = primaryAccurate
    ? `“The reviewed CTA says ${report}. You also attached worse reported pain. I accept the next review; the cause remains unresolved in this supplied record.”`
    : variant === 'c'
      ? `“The reviewed CTA describes the flap, but the patient now reports less pain, so I will pass on the CTA finding as no longer supported.”`
      : `“The reviewed CTA describes the flap. The attached update says the pain has eased, and I accept the next review.”`;
  const correct = primaryAccurate
    ? ['Verify the report limitation, worse-pain update and accepted review; keep the unresolved aortic question explicit.', 'The repetition fits both the reviewed limitation and the reported change. Verification does not resolve the cause.']
    : variant === 'c'
      ? ['Correct the inference: less reported pain does not erase the reviewed positive CTA; carry both to the ED senior.', 'A symptom report does not rewrite a reviewed imaging finding. The next clinical assessment remains with the responsible team.']
      : ['Correct the pain detail: the patient reported worse pain; retain the reviewed flap finding and accepted review owner.', 'Verify each part of the exchange. Repeating the CTA correctly does not repair the reversed symptom update.'];
  const readbackScenarios = [
    ...handoffRepairs(family, prefix, variant === 'a' ? 1 : 2),
    scenario(`${prefix}-report-and-change`, { requiresReviewed: reviewed, requiresPatientUpdates: [family.updateId] }, message, handoffPrompt, correct, [
      [primaryAccurate ? 'Correct the report to a confirmed aortic diagnosis, treating the worse pain as additional confirmation.' : 'Verify the exchange because the CTA detail is repeated accurately and carries the main explanation.', primaryAccurate ? 'Worse pain does not convert a nondiagnostic segment into confirmation.' : 'Check the change and its interpretation as well as the report wording.'],
      [primaryAccurate ? 'Correct the cause to excluded because no definite flap was reported in the ascending segment.' : 'Replace the flap finding with an unresolved imaging statement because the symptom account has changed.', primaryAccurate ? 'No definite flap in a nondiagnostic segment is not a reliable exclusion.' : 'The reported symptom change does not alter the supplied CTA finding.'],
    ], variant === 'a' ? 1 : variant === 'b' ? 0 : 2),
    scenario(`${prefix}-report-only`, { requiresReviewed: reviewed },
      `“I heard that ${report}. ${scope} I accept the next clinical review.”`, handoffPrompt,
      ['Verify the stated report and accepted review; keep any separately attached symptom update in the shared account.', 'This repetition preserves what the reviewed report establishes and what remains for the clinical owner.'], [
        ['Correct the report to a negative scan unless a new symptom change has independently established the cause.', 'Symptoms do not turn the reviewed report into a reliable negative scan.'],
        ['Ask the receiver to replace the report wording with the opening diagnosis before accepting the next review.', 'The opening concern does not justify replacing the reviewed finding or limitation.'],
      ], limited ? 2 : 0),
    scenario(`${prefix}-ecg-change-cta-pending`, { requiresReviewed: ['ecg'], requiresPatientUpdates: [family.updateId], requiresPending: ['aortic-cta'] },
      `“The ECG confirms a coronary cause. I have ${family.change}; the CTA request is still pending.”`, handoffPrompt,
      ['Correct the ECG claim: it is nonspecific; pass on the reported change and identify CTA as pending, without a finding.', 'Only the ECG and reported change are known here. The pending CTA supplies no positive or negative result.'], [
        ['Verify the coronary explanation and keep the CTA pending as a check for a concurrent aortic finding.', 'The supplied nonspecific ECG does not establish a coronary explanation.'],
        ['Correct the account by reporting the expected CTA finding and asking the senior to compare it with the pain.', 'A requested report is not reviewed evidence. Its future finding cannot enter this exchange.'],
      ], 1),
    scenario(`${prefix}-change-before-cta`, { requiresPatientUpdates: [family.updateId], excludesReviewed: reviewed },
      `“I heard ${family.change}. I accept review of that change; this handoff has no reviewed CTA finding.”`, handoffPrompt,
      ['Verify the reported change and review owner; keep the CTA status separate from a result that has not been reviewed.', 'The receiver repeats the available change without inventing a CTA finding or attributing a cause.'], [
        ['Correct the account to the likely CTA finding so the changed pain has a specific diagnosis in the handoff.', 'A symptom update cannot supply an unreviewed imaging result.'],
        ['Leave the change out of this exchange until the CTA report can explain whether it is clinically related.', 'A reported change belongs with the concern even while its explanation remains unsettled.'],
      ], variant === 'a' ? 2 : 1),
    openingReadback(family, prefix, variant === 'b' ? 1 : 0),
  ];
  const reassessmentScenarios = [
    scenario(`${prefix}-reassess-report-change`, { requiresReviewed: reviewed, requiresPatientUpdates: [family.updateId] },
      `Reviewed: ${report}. Reported change: ${family.change}.`, reassessmentPrompt,
      [`Bring both the CTA wording and the reported pain change to the ED senior. ${scope}`, 'The reassessment joins the new symptom account to the actual report without changing either one’s evidential status.'], [
        [limited ? 'Use the worse pain to classify the nondiagnostic segment as a positive result for the next handoff.' : 'Use the current pain report to decide whether the already reviewed flap should remain in the handoff.', 'The symptom report does not repair an imaging limitation or erase a positive reviewed finding.'],
        ['Keep the earlier report summary and omit the symptom change because no repeat examination is supplied.', 'A patient-reported change should be identified as such, not silently discarded because it is not a new examination.'],
      ], variant === 'a' ? 2 : 0),
    scenario(`${prefix}-reassess-ecg-pending`, { requiresReviewed: ['ecg'], requiresPatientUpdates: [family.updateId], requiresPending: ['aortic-cta'] },
      `Reviewed: nonspecific ECG. Reported change: ${family.change}. The requested CTA remains pending.`, reassessmentPrompt,
      ['Update the senior with the pain report and nonspecific ECG; the pending CTA has no reviewed finding yet.', 'The change adds a communication need, while the reviewed ECG and outstanding CTA retain their actual limits.'], [
        ['Make the ECG the confirmed explanation for the change and retain the pending CTA as a secondary check.', 'The ECG is nonspecific and does not settle the cause.'],
        ['Prepare the final aortic conclusion from the requested CTA while the senior reviews the symptom change.', 'A pending request has no finding to synthesize.'],
      ], 1),
    scenario(`${prefix}-reassess-change`, { requiresPatientUpdates: [family.updateId] },
      `Reported change: ${family.change}. Separate reviewed findings from outstanding work in the current snapshot.`, reassessmentPrompt,
      ['Report the change as a patient account, add only reviewed findings, and confirm the ED senior owns the next review.', 'A change can require an updated shared account without supplying a diagnosis, new measurement or outcome.'], [
        ['Keep the earlier account until one of the outstanding reports explains the symptom change.', 'An explanation is not required to communicate a reported change and assign review.'],
        ['Treat the pain change as a new examination finding and use it to settle the leading explanation.', 'The update supplies a patient report, not a new examination or diagnostic result.'],
      ], 2),
    scenario(`${prefix}-reassess-report`, { requiresReviewed: reviewed }, `Reviewed: ${report}.`, reassessmentPrompt,
      [`State the reviewed CTA finding and its limit for the ED senior. ${scope}`, 'Stay within the finding actually reviewed and retain clinical ownership of the remaining assessment.'], [
        ['Carry only the original chest-discomfort account until all requested reports reach the same explanation.', 'The reviewed report is relevant even when other work remains unfinished.'],
        ['Extend the CTA conclusion to settle the cause of every reported feature in the opening account.', 'The report does not settle every symptom, concurrent condition or later clinical decision.'],
      ], limited ? 1 : 0),
    fallbackReassessment(family, prefix, 1),
  ];
  return { readbackScenarios, reassessmentScenarios };
}

function strokeScenarios(record, variant) {
  const family = openingFor(1);
  const prefix = `stroke-${variant}`;
  const reviewed = variant === 'a' ? ['team-mri-summary'] : ['initial-ct', 'team-mri-summary'];
  const report = variant === 'a' ? 'the later MRI reports a matching small acute left frontal infarct'
    : variant === 'b' ? 'the first CT reports no hemorrhage or definite early infarct, and the later attempted study is nondiagnostic'
      : 'the first CT reports no hemorrhage or definite early infarct, and the reviewed status notice supplies no later imaging report';
  const scope = variant === 'a' ? 'The matching reviewed finding supports ischemic stroke here; its mechanism remains a separate question.'
    : 'These supplied reports do not establish the cause or exclude stroke. This is not a rule that assessment waits for MRI.';
  const accurate = variant !== 'b';
  return {
    readbackScenarios: [
      ...handoffRepairs(family, prefix, variant === 'a' ? 2 : 0),
      scenario(`${prefix}-imaging-and-change`, { requiresReviewed: reviewed, requiresPatientUpdates: [family.updateId] },
        accurate ? `“I heard clearer speech with continuing right-arm difficulty. ${report}. I accept this update for the ED team’s review.”`
          : `“The imaging is limited and I accept the update: the speech and right-arm difficulty have both resolved.”`, handoffPrompt,
        accurate ? ['Verify the mixed witness update and the actual imaging account; keep clinical assessment with the ED team.', 'The repetition preserves both the continuing arm difficulty and the reviewed finding or report limit.']
          : ['Correct the change: speech seems clearer, but right-arm difficulty continues; retain the supplied imaging limits.', 'The receiver has turned partial improvement into resolution. The sender must correct that specific mismatch.'], [
          ['Correct the update to complete recovery because the speech improvement is the most recent observation.', 'Clearer speech does not mean the continuing right-arm difficulty has resolved.'],
          [variant === 'a' ? 'Correct the account to an unconfirmed imaging question because the speech seems clearer now.' : 'Correct the imaging account to a negative stroke evaluation because no later positive image was supplied.', variant === 'a' ? 'A witness-reported improvement does not erase the matching reviewed finding.' : 'A missing or nondiagnostic later result does not exclude stroke or establish another cause.'],
        ], variant === 'a' ? 0 : 2),
      scenario(`${prefix}-imaging-only`, { requiresReviewed: reviewed }, `“I heard that ${report}. ${scope} The ED team accepts the next review.”`, handoffPrompt,
        ['Verify the report wording and accepted review; distinguish it from any separately attached witness change.', 'The exchange preserves the supplied imaging scope without inventing an examination or a resolved symptom.'], [
          ['Replace the report wording with the witness’s preferred explanation so the receiving team has one account.', 'A witness account cannot overwrite a reviewed report or establish its mechanism.'],
          [variant === 'a' ? 'Downgrade the reviewed infarct to an absent finding because the opening CT showed no definite infarct.' : 'Verify that the lack of a diagnostic later image rules out stroke in this record.', variant === 'a' ? 'The first CT does not cancel a later matching diagnostic finding.' : 'An unavailable or nondiagnostic image supplies no exclusion. The clinical assessment remains open.'],
        ], variant === 'a' ? 1 : 0),
      scenario(`${prefix}-first-ct-change-pending`, { requiresReviewed: ['initial-ct'], requiresPatientUpdates: [family.updateId], requiresPending: ['team-mri-summary'] },
        '“The first CT shows no definite infarct, so I heard a non-stroke problem. The speech seems clearer; the arm difficulty continues and later imaging is pending.”', handoffPrompt,
        ['Correct the non-stroke claim: this CT does not exclude early ischemia; retain the mixed update and pending status.', 'The known CT, continuing focal concern and unreviewed later report have different roles in this exchange.'], [
          ['Verify the non-stroke wording because the improved speech agrees with the first CT’s lack of a visible infarct.', 'The improvement and this CT do not establish a non-stroke explanation.'],
          ['Replace the pending status with the later imaging finding so the team can receive a complete cause statement.', 'A pending later report cannot supply a finding in the current snapshot.'],
        ], 1),
      scenario(`${prefix}-mixed-change`, { requiresPatientUpdates: [family.updateId] },
        '“Speech seems clearer, but right-arm difficulty continues. I accept that as a family report, not a new clinical examination.”', handoffPrompt,
        ['Verify both parts of the witness update and its source; keep the ED team responsible for clinical reassessment.', 'The receiver has repeated the actual mixed observation without turning it into a diagnosis or an outcome.'], [
          ['Correct the update to resolved focal symptoms because clearer speech is the newer reported feature.', 'The arm difficulty remains in the same update and must not disappear from the account.'],
          ['Confirm the account as a new clinician examination because a receiving team member has repeated it.', 'Repeating a family report does not change its source into a clinical examination.'],
        ], variant === 'c' ? 2 : 0),
      openingReadback(family, prefix, 1),
    ],
    reassessmentScenarios: [
      scenario(`${prefix}-reassess-imaging-change`, { requiresReviewed: reviewed, requiresPatientUpdates: [family.updateId] },
        `Reviewed: ${report}. Family reports clearer speech with continuing right-arm difficulty.`, reassessmentPrompt,
        [`Give the ED team both the continuing arm difficulty and the reviewed imaging account. ${scope}`, 'A partial witness-reported improvement belongs alongside the actual reviewed record; it does not replace it.'], [
          ['Revise the account to resolved focal symptoms and use the imaging only as background for the earlier episode.', 'The family still reports right-arm difficulty. The exercise has not supplied resolution or a patient outcome.'],
          [variant === 'a' ? 'Treat the clearer speech as counterevidence that removes the matching infarct from the handoff.' : 'Use the absent diagnostic later finding and clearer speech to establish a non-stroke cause.', variant === 'a' ? 'The change does not erase the matching reviewed imaging finding.' : 'Neither a limited supplied image record nor partial improvement establishes another cause.'],
        ], variant === 'b' ? 0 : 2),
      scenario(`${prefix}-reassess-ct-change-pending`, { requiresReviewed: ['initial-ct'], requiresPatientUpdates: [family.updateId], requiresPending: ['team-mri-summary'] },
        'Reviewed: first CT without hemorrhage or definite early infarct. Speech seems clearer, arm difficulty continues, and later imaging remains pending.', reassessmentPrompt,
        ['Report the mixed change and first CT’s limit; leave the later report pending and the assessment with the ED team.', 'This uses what is known without treating the first CT as exclusion or forecasting the later report.'], [
          ['Use the clearer speech and first CT together to describe a settled non-stroke explanation to the team.', 'Those observations do not establish that conclusion.'],
          ['Hold the continuing arm concern until the later report is available to determine whether it belongs in the account.', 'The continuing reported difficulty belongs in the update before its explanation is settled.'],
        ], 1),
      scenario(`${prefix}-reassess-mixed-change`, { requiresPatientUpdates: [family.updateId] },
        'The family reports clearer speech with continuing right-arm difficulty. Other findings have only the status shown in this snapshot.', reassessmentPrompt,
        ['Carry both observations and their witness source to the ED team, adding only findings already reviewed.', 'A clearer symptom and a continuing symptom must both remain visible; neither supplies an unreviewed test result.'], [
          ['Carry the improved speech as the current situation and leave the continuing arm difficulty in the earlier account.', 'That separates two parts of the same update and creates a misleading recovery account.'],
          ['Use the continuing arm difficulty to label the cause as confirmed without relying on the reviewed record.', 'Continuing concern belongs in the handoff without converting it into an unsupported diagnostic label.'],
        ], 0),
      scenario(`${prefix}-reassess-imaging`, { requiresReviewed: reviewed }, `Reviewed: ${report}.`, reassessmentPrompt,
        [`Describe the actual imaging finding or limit to the ED team. ${scope}`, 'A reviewed finding and an unavailable finding must not be assigned the same meaning.'], [
          ['Let the first CT determine the final explanation and keep any later report as a scheduling detail.', 'The first CT does not replace later reviewed findings or the actual limitation of a supplied record.'],
          ['Use the current imaging account to settle the symptom mechanism and every later assessment question.', 'The supplied reports do not settle every mechanism, concurrent condition or further clinical decision.'],
        ], variant === 'c' ? 2 : 1),
      fallbackReassessment(family, prefix, 0),
    ],
  };
}

function metabolicScenarios(record, variant) {
  const family = openingFor(2);
  const prefix = `metabolic-${variant}`;
  const reviewed = ['plasma-glucose', 'blood-ketones', 'acid-base', ...(variant === 'b' ? ['serum-osmolality'] : [])];
  const report = variant === 'a' ? 'the combined reviewed glucose, ketone and acid-base reports support the ketoacidotic pattern'
    : variant === 'b' ? 'the combined reviewed glucose, osmolality, ketone and acid-base reports fit the HHS pattern'
      : 'raised glucose and ketones are reviewed, but the acid-base status notice supplies no pH or bicarbonate result';
  const scope = variant === 'c' ? 'The supplied record does not establish the complete metabolic pattern; unavailable acid-base values are not normal values.'
    : 'The combined pattern does not establish its precipitant or transfer care decisions from the supervisor.';
  const accurate = variant === 'a';
  return {
    readbackScenarios: [
      ...handoffRepairs(family, prefix, variant === 'b' ? 1 : 2),
      scenario(`${prefix}-pattern-and-change`, { requiresReviewed: reviewed, requiresPatientUpdates: [family.updateId] },
        accurate ? '“The combined reports support the ketoacidotic pattern. Thirst persists and tiredness increased; the patient is conversant. I accept the next review.”'
          : variant === 'b' ? '“The combined reports fit HHS. The patient is conversant, so I heard that the reported tiredness has improved.”'
            : '“The acid-base values are unavailable, so I will record them as normal. Thirst persists and tiredness increased.”', handoffPrompt,
        accurate ? ['Verify the combined pattern, complete symptom report and accepted review; keep the precipitant question open.', 'The receiver has accurately repeated the pattern and change without turning conversation into reassurance.']
          : variant === 'b' ? ['Correct the symptom detail: tiredness increased despite conversation; retain the reviewed HHS pattern and review owner.', 'Being conversant does not reverse the reported increase in tiredness. Verify the source account as well as the pattern.']
            : ['Correct unavailable to unknown: there are no acid-base values to call normal; retain the reported symptom change.', 'Reading an unavailable-result notice does not supply a measurement or exclude acidosis.'], [
          ['Use continued conversation to omit the tiredness change and verify the laboratory summary alone.', 'The update explicitly contains increased tiredness. Conversation does not remove it from the handoff.'],
          [variant === 'c' ? 'Confirm the full ketoacidotic pattern from glucose and ketones, treating the absent acid-base result as a detail.' : 'Replace the combined pattern with a glucose-only diagnosis to keep the receiver’s account concise.', variant === 'c' ? 'The acid-base component is missing from the supplied record. Do not infer it from the other two.' : 'The relevant combined components cannot be reduced to a glucose-only argument.'],
        ], variant === 'a' ? 2 : 1),
      scenario(`${prefix}-pattern-only`, { requiresReviewed: reviewed }, `“I heard that ${report}. ${scope} I accept the next review.”`, handoffPrompt,
        ['Verify the supplied components or missing component and the supervisor’s accepted review; keep any symptom update distinct.', 'The report account stays within the evidence available in this handoff.'], [
          ['Replace the component account with a glucose-only conclusion and leave the other reports in the worklist.', 'A component-based argument or an explicit missing component cannot be replaced by glucose alone.'],
          ['Close the remaining cause question because accepting the review makes the current laboratory account complete.', 'Accepted responsibility does not fill an unavailable component or establish a precipitant.'],
        ], variant === 'b' ? 0 : 2),
      scenario(`${prefix}-glucose-change-acid-pending`, { requiresReviewed: ['plasma-glucose'], requiresPatientUpdates: [family.updateId], requiresPending: ['acid-base'] },
        '“Raised glucose is reviewed and acid-base is pending. I heard thirst continues and tiredness increased while the patient remains conversant.”', handoffPrompt,
        ['Verify the actual glucose report, pending acid-base status and symptom account; do not add an acid-base finding.', 'The repetition keeps a reviewed component, an outstanding report and a patient-reported change distinct.'], [
          ['Correct the pending acid-base report to the value expected from the glucose and symptom account.', 'No value or full pattern can be inferred from a pending acid-base report.'],
          ['Confirm the exchange as evidence that a full ketoacidotic pattern is already established.', 'Glucose and symptoms alone do not supply every required component.'],
        ], 1),
      scenario(`${prefix}-symptom-change`, { requiresPatientUpdates: [family.updateId] },
        '“I heard persistent thirst and increased tiredness. The patient is still conversant; I accept that update for supervisor review.”', handoffPrompt,
        ['Verify all three observations and the accepted review; avoid turning conversation into a laboratory conclusion.', 'The receiver has repeated the complete symptom account while leaving its explanation to the reviewed evidence and supervisor.'], [
          ['Correct increased tiredness to improvement because the patient can still hold a conversation.', 'The source account explicitly says tiredness increased.'],
          ['Add a confirmed metabolic diagnosis to the repeated symptom account before accepting this exchange.', 'The reported change does not itself supply the missing laboratory pattern.'],
        ], variant === 'b' ? 2 : 0),
      openingReadback(family, prefix, 2),
    ],
    reassessmentScenarios: [
      scenario(`${prefix}-reassess-pattern-change`, { requiresReviewed: reviewed, requiresPatientUpdates: [family.updateId] },
        `Reviewed: ${report}. Reported change: ${family.change}.`, reassessmentPrompt,
        [`Give the supervisor the component account and increased tiredness together. ${scope}`, 'This joins the current symptom report to the actual reviewed pattern or missing component without inventing values.'], [
          ['Keep the laboratory account and omit the tiredness change because the patient is still conversant.', 'A continuing ability to converse does not erase the patient’s reported change.'],
          [variant === 'c' ? 'Treat the unavailable acid-base values as absent acidosis and favor a non-acidotic pattern.' : 'Use the symptom change to replace the combined pattern with a glucose-only conclusion.', variant === 'c' ? 'Unavailable values supply no evidence that acidosis is absent.' : 'A symptom report does not replace the components supporting the recorded pattern.'],
        ], variant === 'b' ? 1 : 2),
      scenario(`${prefix}-reassess-glucose-change-pending`, { requiresReviewed: ['plasma-glucose'], requiresPatientUpdates: [family.updateId], requiresPending: ['acid-base'] },
        'Glucose is reviewed; acid-base remains pending. Thirst persists and tiredness increased, while the patient remains conversant.', reassessmentPrompt,
        ['Bring the glucose component and symptom change to the supervisor; keep acid-base pending without a value or full-pattern claim.', 'The next review can use a partial record while preserving the component that is still outstanding.'], [
          ['Infer the acid-base component from the glucose and increased tiredness, then hand over a complete metabolic pattern.', 'The supplied observations do not create an unreviewed laboratory result.'],
          ['Defer the symptom change until the pending acid-base report shows whether the conversation is reassuring.', 'The change should be communicated as reported. An outstanding component does not replace review ownership.'],
        ], 0),
      scenario(`${prefix}-reassess-symptom-change`, { requiresPatientUpdates: [family.updateId] },
        `Reported change: ${family.change}. Other results have the statuses shown in the current snapshot.`, reassessmentPrompt,
        ['Describe the full symptom change to the supervisor, adding reviewed components and identifying work still outstanding.', 'The update is neither a new laboratory result nor evidence of a patient outcome.'], [
          ['Use continued conversation to keep the earlier symptom account until all reports can be synthesized together.', 'Continued conversation does not remove the reported increase in tiredness.'],
          ['Let increased tiredness establish the metabolic diagnosis and treat unreviewed components as supporting detail.', 'The symptom change does not establish the required laboratory pattern.'],
        ], 1),
      scenario(`${prefix}-reassess-pattern`, { requiresReviewed: reviewed }, `Reviewed: ${report}.`, reassessmentPrompt,
        [`Explain the actual component account to the supervisor. ${scope}`, 'The record supports only the supplied combined pattern or the explicitly documented limit.'], [
          [variant === 'c' ? 'Assign normal acid-base values because the status notice contains no reported acidosis.' : 'Explain the pattern using glucose alone, with ketones and acid-base reserved for later severity discussion.', variant === 'c' ? 'No reported value is not a normal measured value.' : 'Ketones and acid-base address distinct components of the pattern.'],
          ['Treat the current laboratory account as resolving its precipitant and every remaining clinical question.', 'The component account does not settle every cause or care decision.'],
        ], variant === 'a' ? 0 : 2),
      fallbackReassessment(family, prefix, 2),
    ],
  };
}

function openingReadback(family, prefix, position) {
  return scenario(`${prefix}-opening-only`, {},
    `“I heard the presenting ${family.opening}. The opening account alone does not establish its cause. I accept the next review; separately listed reports retain their recorded status.”`, handoffPrompt,
    ['Verify the presenting concern, its limited certainty and accepted review; add no result that the sent snapshot does not contain.', 'This is a valid early exchange. A complete diagnostic worklist is not required to communicate the known concern and ownership.'], [
      ['Correct the receiver to the final diagnosis expected for this arrival, even if its supporting report is not reviewed.', 'A future report or a remembered arrival cannot enter the current sent snapshot.'],
      ['Withhold verification until all work is complete so the opening concern can be replaced by one definite explanation.', 'The known concern and next reviewer can be verified while the cause remains uncertain.'],
    ], position);
}
function fallbackReassessment(family, prefix, position) {
  return scenario(`${prefix}-reassess-current-record`, {},
    'Use the reviewed findings and task statuses in the current snapshot. This checkpoint supplies no additional patient finding.', reassessmentPrompt,
    [`Separate what you reviewed from what is pending or available to read, and confirm the ${family.owner} owns the next review.`, 'Reading, availability and pending work are different statuses. Use only the current snapshot; no later fact is supplied by this question.'], [
      ['Build the explanation from the expected final reports and revise it only if one later result disagrees.', 'A requested or expected finding is not reviewed evidence.'],
      ['Carry the opening account alone until every requested report is ready, then assign the next clinical reviewer.', 'Reviewed findings can update the account before the worklist is complete, and the concern already needs an owner.'],
    ], position);
}

function changeAction(episode, id, patch) {
  const action = episode.actions.find((value) => value.id === id);
  if (!action) throw new TypeError(`Missing trusted action: ${id}`);
  Object.assign(action, patch);
}
function changeChoice(section, id, patch) {
  const found = section.choices.find((value) => value.id === id);
  if (!found) throw new TypeError(`Missing trusted choice: ${id}`);
  Object.assign(found, patch);
}
function arrivalC(base, index) {
  const episode = clone(base);
  episode.id = `${FAMILY_IDS[index]}-record-c`;
  episode.recordLabel = 'Arrival C';
  episode.careWorkflow.episodeId = episode.id;
  if (index === 0) {
    const update = episode.careWorkflow.patientUpdates[0];
    update.id = 'pain-easing-change';
    update.text = 'Authored fictional change after arrival: the patient tells the bedside nurse the chest pain feels less severe than at the opening handoff. No new vital signs or examination findings are supplied.';
    update.prompt = 'How should the easing-pain report reach the team alongside findings already reviewed?';
    update.choices = [
      choice('communicate-easing-change', 'Report the easing pain as a patient account, preserve reviewed findings, and confirm the ED senior accepts review.', true, 'A symptom change belongs beside the actual reviewed report. It does not erase a supplied finding or establish a patient outcome.'),
      choice('easing-replaces-findings', 'Replace the earlier aortic concern with the easing-pain account and leave reviewed imaging as historical background.', false, 'The symptom account does not overwrite a reviewed positive finding. Communicate both with their actual sources.'),
    ];
    episode.transferQuestion = {
      ...episode.transferQuestion, id: 'aortic-easing-positive-report-contrast-v5',
      prompt: 'A different fictional arrival reports less chest pain after a reviewed diagnostic CTA explicitly described an ascending-aortic dissection. What should the next handoff preserve?',
      choices: [
        { id: 'improvement-erases', label: 'The eased pain makes the reviewed positive report a resolved historical concern.', feedback: 'A reported symptom improvement does not erase the diagnostic finding or establish resolution.' },
        { id: 'preserve-both', label: 'Carry both the positive reviewed CTA and the easing-pain report to the responsible clinician.', feedback: 'Keep each source and its meaning visible. A new symptom report does not rewrite an existing diagnostic report.' },
        { id: 'symptoms-prove', label: 'The pain change establishes the present extent of the aortic finding without another assessment.', feedback: 'A symptom report does not supply a new imaging measurement or settle the next clinical assessment.' },
      ], answerId: 'preserve-both',
    };
  } else if (index === 1) {
    changeAction(episode, 'team-mri-summary', {
      label: 'Later imaging status notice',
      finding: 'Fictional status notice: no later imaging report is available in this supplied record. This notice supplies no imaging finding and does not say a later study was diagnostic, negative or attempted.',
      interpretation: 'The notice documents unavailable information, not a normal image or an unsuccessful study. The continuing focal concern needs the ED team’s assessment; MRI is not a universal prerequisite for urgent assessment.',
    });
    episode.careWorkflow.tasks['team-mri-summary'].label = 'Follow up: later imaging status notice';
    changeChoice(episode.careWorkflow.handoff.situation, 'reviewed-imaging', { label: 'The first CT shows no hemorrhage or definite early infarct; a reviewed status notice says no later imaging report is available.' });
    changeChoice(episode.careWorkflow.handoff.uncertainty, 'imaging-scope', { label: 'These supplied reports do not establish the cause or exclude stroke; the ED team owns assessment of the continuing focal concern.' });
    episode.reasoning.caseLearningText = 'The first CT does not exclude early ischemia. The later status notice supplies no image at all: unavailable information differs from an attempted nondiagnostic study. This supplied record does not establish the cause; clinicians can diagnose stroke from clinical presentation and CT, without a universal MRI requirement.';
    episode.reasoning.insufficientCitationFeedback = 'Connect the first CT limit with the reviewed notice that no later imaging report is supplied. The notice is not a negative image or evidence that stroke is excluded.';
    episode.reasoning.uncertaintyOptions.find((value) => value.id === 'imaging-scope').label = 'The first CT and unavailable later report leave this supplied cause unestablished; they do not exclude stroke.';
    episode.reasoning.supportGroups[0].label = 'First CT limit and unavailable later imaging notice together';
    episode.resolution.supportedSummary = 'The first CT shows no hemorrhage or definite early infarct, and no later imaging report is supplied. This record does not establish the cause; stroke is not excluded.';
    episode.resolution.mismatchSummary = 'The supplied CT and unavailable-report notice do not establish the selected cause or justify excluding stroke. Clinical assessment remains with the ED team.';
    episode.resolution.provisionalSummary = 'The first CT and later unavailable-report status notice were not both reviewed. The record-specific information gap is not yet demonstrated on this route.';
    episode.resolution.decisiveClue = 'The first CT does not exclude early ischemia; the reviewed status notice supplies no later image.';
    episode.resolution.missingClue = 'The first CT or the later unavailable-report status notice was not reviewed on this route.';
    episode.resolution.nextLearning = 'Distinguish an unavailable report from a negative or nondiagnostic image. Communicate the continuing focal concern and the supplied limits without making MRI a universal requirement.';
    episode.transferQuestion = {
      ...episode.transferQuestion, id: 'stroke-unavailable-versus-negative-contrast-v5',
      prompt: 'A different fictional record has continuing one-sided arm difficulty, a first CT without hemorrhage or definite early infarct, and a notice that no later imaging report is supplied. What does the notice add?',
      choices: [
        { id: 'negative-later', label: 'A second negative imaging result that reduces the remaining concern.', feedback: 'An unavailable report supplies no second imaging result and does not exclude stroke.' },
        { id: 'nondiagnostic-later', label: 'Proof that the later study was attempted but technically nondiagnostic.', feedback: 'A status notice about an unavailable report does not establish whether a study was attempted or what it showed.' },
        { id: 'missing-information', label: 'A documented information gap to carry with the ongoing focal concern to the ED team.', feedback: 'The supplied record documents missing information. Clinical assessment remains with the team; this does not make MRI a universal prerequisite.' },
      ], answerId: 'missing-information',
    };
  } else {
    changeAction(episode, 'acid-base', {
      label: 'Acid-base status notice',
      finding: 'Fictional status notice: no pH or bicarbonate result is available in this supplied record. Reading this notice supplies no acid-base measurement.',
      interpretation: 'The acid-base component is unknown. Raised glucose and ketones do not supply the absent value; unavailable is not the same as normal or absent acidosis.',
    });
    episode.careWorkflow.tasks['acid-base'].label = 'Follow up: acid-base status notice';
    const required = ['plasma-glucose', 'blood-ketones', 'acid-base'];
    episode.reasoning.supportRules['plasma-glucose'] = { strength: 'component', supports: ['diabetic-ketoacidosis', UNRESOLVED] };
    episode.reasoning.supportRules['blood-ketones'] = { strength: 'component', supports: ['diabetic-ketoacidosis', UNRESOLVED] };
    episode.reasoning.supportRules['acid-base'] = { strength: 'component', supports: [UNRESOLVED] };
    episode.reasoning.supportGroups = [{ id: 'pattern:missing-acid-base', label: 'Reviewed glucose, ketones and unavailable acid-base notice together', requires: required, strength: 'decisive', supports: [UNRESOLVED] }];
    episode.reasoning.caseLearningText = 'Raised glucose and significant ketones are reviewed, but no acid-base measurement is supplied. This record does not establish the complete ketoacidotic pattern. Unknown acid-base status cannot be called normal, and the concern still needs the supervisor’s assessment.';
    episode.reasoning.insufficientCitationFeedback = 'Connect the reviewed glucose and ketones with the notice that acid-base values are unavailable. The unresolved conclusion needs the record-specific missing component, not the opening symptoms alone.';
    episode.reasoning.uncertaintyOptions = [
      { id: 'symptoms-not-confirmation', label: 'Vomiting and discomfort alone do not establish a metabolic cause.', requires: [], scope: 'provisional' },
      { id: 'glucose-is-component', label: 'Raised glucose alone does not establish the full metabolic pattern.', requires: ['plasma-glucose'], scope: 'any' },
      { id: 'missing-acid-base-scope', label: 'Reviewed glucose and ketones plus unavailable acid-base values leave this supplied cause unestablished.', requires: required, scope: 'supported', forHypotheses: [UNRESOLVED] },
      { id: 'unknown-is-normal', label: 'No supplied acid-base value means acidosis is absent.', requires: ['acid-base'], scope: 'unsupported' },
    ];
    episode.resolution = {
      ...episode.resolution, hypothesisId: UNRESOLVED, conclusionKind: 'unresolved', evidenceActionIds: required,
      supportedSummary: 'Glucose and ketones are reviewed, but the acid-base notice supplies no pH or bicarbonate. The supplied record does not establish the complete metabolic pattern or cause.',
      mismatchSummary: 'The unavailable acid-base component does not establish the selected complete metabolic pattern. Unknown does not mean normal.',
      provisionalSummary: 'The glucose, ketones and unavailable acid-base notice were not all reviewed. The record-specific missing component is not yet demonstrated on this route.',
      decisiveClue: 'Raised glucose and ketones are supplied, but no acid-base measurement is available in this record.',
      missingClue: 'At least one of glucose, ketones or the acid-base status notice was not reviewed.',
      nextLearning: 'Distinguish a reviewed status notice from a measured result. Do not fill the missing acid-base component with an assumed value; the supervisor owns further assessment.',
    };
    changeChoice(episode.careWorkflow.handoff.situation, 'reviewed-pattern', { label: 'Glucose and ketones are reviewed; the acid-base status notice says no pH or bicarbonate result is supplied.', requires: required });
    changeChoice(episode.careWorkflow.handoff.uncertainty, 'pattern-scope', { label: 'The supplied acid-base component is unknown, so this record does not establish the full metabolic pattern; the supervisor owns assessment.', requires: required });
    episode.transferQuestion = {
      ...episode.transferQuestion, id: 'metabolic-unavailable-component-contrast-v5',
      prompt: 'A different fictional record supplies raised glucose and significant ketones, but its reviewed status notice says no pH or bicarbonate result is available. Which account preserves that distinction?',
      choices: [
        { id: 'full-pattern', label: 'The glucose and ketones establish the entire ketoacidotic pattern without the absent component.', feedback: 'The supplied record has not established its acid-base component. Do not infer a measurement from the other reports.' },
        { id: 'component-unknown', label: 'The acid-base component remains unknown; the supplied record does not establish the full pattern.', feedback: 'A reviewed status notice documents missing information, not measured normal values or absent acidosis.' },
        { id: 'normal-component', label: 'The missing acid-base result supports a non-acidotic alternative because no acidosis is reported.', feedback: 'Unavailable information is not evidence that acidosis is absent or that another pattern is established.' },
      ], answerId: 'component-unknown',
    };
  }
  return episode;
}

export function buildInvestigationCoordinationContent(frozenV4Episodes) {
  if (!Array.isArray(frozenV4Episodes) || frozenV4Episodes.length !== 6) throw new TypeError('Expected the six frozen version 4 records.');
  const input = new Map(frozenV4Episodes.map((episode) => [episode?.id, episode]));
  const records = [];
  for (const [index, familyId] of FAMILY_IDS.entries()) {
    const a = input.get(familyId);
    const b = input.get(`${familyId}-record-b`);
    if (![a, b].every((episode) => episode?.version === 4 && episode.careWorkflow && episode.reasoning)) throw new TypeError(`Missing trusted version 4 family: ${familyId}`);
    for (const [variant, source] of [['a', a], ['b', b], ['c', index === 1 ? b : a]]) {
      const episode = variant === 'c' ? arrivalC(source, index) : clone(source);
      episode.version = 5;
      episode.reviewProvenance = clone(PROVENANCE);
      episode.careWorkflow.reviewProvenance = clone(PROVENANCE);
      episode.sources.push(...clone(SOURCES));
      episode.careWorkflow.sources = episode.careWorkflow.sources.map((source) => {
        const current = SOURCES.find((candidate) => candidate.url === source.url);
        return current ? clone(current) : source;
      });
      // Version 5 selects these questions exclusively from the contextual bank.
      // Keep the shared timing/minimum metadata without duplicating v4 prompts.
      episode.careWorkflow.reassessment = {
        minimumReviewed: episode.careWorkflow.reassessment.minimumReviewed,
        update: episode.careWorkflow.reassessment.update,
      };
      episode.careWorkflow.readback = { prompt: 'Verify the receiver’s reply against the sent handoff.', choices: [] };
      episode.resolution.limitations = episode.resolution.limitations.map((text) => text.includes('Earlier owner-reported')
        ? 'Earlier owner-reported clinician review has unverified scope and version; it does not cover these version 5 questions, exchanges or Arrival C records.' : text);
      episode.coordination = [aorticScenarios, strokeScenarios, metabolicScenarios][index](episode, variant);
      // The first report-release round also releases this record's patient
      // change, so report-without-change branches cannot occur in v5 replay.
      episode.coordination.readbackScenarios = episode.coordination.readbackScenarios.filter((question) => !/-(report|imaging|pattern)-only$/.test(question.id));
      episode.coordination.reassessmentScenarios = episode.coordination.reassessmentScenarios.filter((question) => !/-reassess-(report|imaging|pattern)$/.test(question.id));
      for (const section of Object.values(episode.careWorkflow.handoff)) {
        for (const option of section.choices) option.id = HANDOFF_IDS[option.id] ?? option.id;
      }
      for (const question of episode.coordination.readbackScenarios) {
        if (question.requiresSelections) question.requiresSelections = Object.fromEntries(Object.entries(question.requiresSelections).map(([field, id]) => [field, HANDOFF_IDS[id] ?? id]));
      }
      records.push(episode);
    }
  }
  return freeze(records);
}
