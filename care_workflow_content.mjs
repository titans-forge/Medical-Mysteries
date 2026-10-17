// Authored communication exercises, not clinical protocols. Keep this module
// independent of the investigation engine so saved content can be versioned.
const checkedUtc = '2026-10-16T06:06:44Z';
const choice = (id, label, appropriate, feedback, requires = []) => ({ id, label, appropriate, feedback, requires });
const task = (owner, label, rounds) => ({ owner, label, rounds });
const timingNote = 'Update rounds are fictional report-release events, not clinical minutes or recommended waiting periods. Tasks may progress together; report availability does not prescribe an investigation order.';

export const CARE_WORKFLOW_SOURCES = [
  { title: 'WHO Emergency Care Toolkit: Interagency Integrated Triage Tool', url: 'https://www.who.int/teams/integrated-health-services/clinical-services-and-systems/emergency-and-critical-care/emergency-care-toolkit', checkedUtc,
    scope: 'Prioritizing clinical concern separately from establishing a diagnosis. These role-specific exercises do not implement or validate a triage scale.' },
  { title: 'NICE CG50: recognising and responding to deterioration', url: 'https://www.nice.org.uk/guidance/CG50/chapter/recommendations', checkedUtc,
    scope: 'Clinical concern, response ownership and reassessment. No physiological thresholds, observation intervals or treatment instructions are introduced.' },
  { title: 'AHRQ TeamSTEPPS: Handoff', url: 'https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/handoff.html', checkedUtc,
    scope: 'Communicating known information, uncertainty, responsibility and contingencies, with acknowledgment by the receiver. The scripted handoffs are fictional examples.' },
  { title: 'AHRQ TeamSTEPPS: Check-Back (or Repeat-Back)', url: 'https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/checkback.html', checkedUtc,
    scope: 'Receiver repetition followed by sender verification, including family communication. An acknowledgment does not establish a diagnosis or complete pending tasks.' },
];

export const CARE_WORKFLOW_PROVENANCE = {
  status: 'unreviewed',
  ownerReportedPriorClinicianReview: true,
  priorReviewScope: 'unverified',
  priorReviewVersion: 'unverified',
  text: 'The owner reports clinician review of earlier Medical Mysteries material. The reviewed scope, artifact and version have not been verified for this addition. These newly authored workflow profiles have not received separate clinician review.',
};

export const CARE_WORKFLOW_PROFILES = {
  'doc-002-tearing-back-investigation': {
    episodeId: 'doc-002-tearing-back-investigation',
    version: 1,
    role: {
      label: 'Doctor coordinating the ED team',
      boundary: 'Coordinate the current concern, named task owners and the next clinical review. The exercise uses supplied fictional records; it does not authorize treatment or replace team assessment and local clinical responsibilities.',
    },
    timingNote,
    priority: {
      prompt: 'A 61-year-old has arrived with sudden severe chest discomfort and an incomplete handoff. What should you coordinate before the cause is confirmed?',
      choices: [
        choice('coordinate-early-review', 'Bring the sudden chest-discomfort concern to the ED senior now and assign owners while the cause is clarified.', true, 'The opening concern can be communicated before a particular diagnosis is proved. Clinical review and responsibility should not wait for a complete record.'),
        choice('finish-worklist-first', 'Complete the diagnostic worklist first, then decide which clinician should receive the concern.', false, 'A fuller record may refine the differential, but it does not supply an owner for the concern in the meantime. Ask the ED senior to accept review while the information develops.'),
      ],
    },
    tasks: {
      'symptom-timeline': task('ED history-taking clinician', 'Request review of the symptom timeline', 1),
      'focused-examination': task('ED examining clinician', 'Request review of the focused examination', 1),
      ecg: task('ECG reporting clinician', 'Request the authored ECG report', 1),
      'chest-radiograph': task('Radiology reporting clinician', 'Request the authored chest radiograph report', 2),
      'aortic-cta': task('ED senior clinician', 'Follow up the authored aortic CTA report with radiology', 2),
      'specialist-handoff': task('ED senior clinician', 'Confirm that the receiving specialist acknowledged the recorded handoff', 1),
    },
    reassessment: {
      minimumReviewed: 1,
      update: 'Fictional team update: the opening concern was sudden severe chest discomfort. The team asks which findings have actually been reviewed and who owns the next clinical review. A report becoming available does not answer that ownership question.',
      prompt: 'After reviewing a finding and receiving this team update, what should you clarify?',
      choices: [
        choice('restate-and-name-owner', 'Restate the chest-discomfort concern, distinguish reviewed from pending information, and confirm the ED senior responsible for the next review.', true, 'This reassesses the communication state without inventing a new patient change. A finding and a named review owner answer different questions.'),
        choice('let-worklist-own-review', 'Let completion of the remaining worklist determine when somebody next reviews the patient.', false, 'A worklist tracks tasks; it does not name the clinician responsible for reassessment. The opening concern still needs explicit ownership.'),
      ],
      variants: [
        {
          id: 'ecg-interpretation',
          requires: ['ecg'],
          prompt: 'The ECG report you reviewed describes a small, nonspecific ST change in aVL. How should that report affect your reassessment message?',
          choices: [
            choice('reassess-ecg-limited', 'Report the ST change as a limited finding: this ECG alone does not settle the coronary explanation or the aortic question. State what other reviewed findings add separately.', true, 'The ECG is information to include, but it does not account for the whole presentation by itself. A later report may strengthen a conclusion; that does not make this ECG independently decisive.'),
            choice('reassess-ecg-confirms-coronary', 'Use the ST change to hand over a confirmed coronary cause and set aside the aortic question.', false, 'The supplied ECG is nonspecific. Treating it as confirmation would overstate this report and erase a competing concern without addressing its evidence.'),
          ],
        },
      ],
    },
    handoff: {
      receiver: {
        prompt: 'Who should explicitly receive responsibility for the current concern?',
        choices: [
          choice('ed-senior', 'The ED senior clinician coordinating the acute chest-discomfort assessment.', true, 'This names a current clinical receiver without waiting to prove a particular cause.'),
          choice('routine-referral-queue', 'A routine chest-pain referral queue, without a named receiving clinician.', false, 'A queued referral does not establish who has accepted the current concern or who will review it next.'),
        ],
      },
      situation: {
        prompt: 'Which statement can you support from the opening handoff or a finding you actually reviewed?',
        choices: [
          choice('opening-chest-concern', 'A 61-year-old arrived with sudden severe chest discomfort; the initial handoff was incomplete.', true, 'These are opening facts. They are enough to communicate a concern without claiming an unreviewed examination or scan.'),
          choice('reviewed-pain-timeline', 'The reviewed history describes pain maximal at onset and radiating to the back.', true, 'This adds only the history you reviewed; it is a concerning pattern, not proof of one cause.', ['symptom-timeline']),
          choice('reviewed-pressure-gap', 'The reviewed examination records different pressures in the two arms.', true, 'This examination finding belongs in the handoff once reviewed. Its significance remains part of the clinical assessment.', ['focused-examination']),
          choice('reviewed-cta-finding', 'The reviewed CTA report describes an ascending-aortic intimal flap extending into the arch.', true, 'This is a report-specific statement. It is available only after that report has been reviewed.', ['aortic-cta']),
          choice('symptom-confirms-cause', 'The opening chest discomfort establishes a coronary cause.', false, 'The opening symptom raises concern but does not establish that cause. Keep the observation separate from the working explanation.'),
        ],
      },
      uncertainty: {
        prompt: 'Which qualification keeps the handoff within the evidence you have?',
        choices: [
          choice('opening-not-diagnosis', 'Chest discomfort in the opening handoff does not establish a cause; any stronger claim must cite a reviewed finding.', true, 'This remains true whether you hand over early or later add a report. It does not pretend that all findings are still unknown.'),
          choice('ecg-limited', 'The reviewed small, nonspecific ECG change does not settle the cause of the presentation.', true, 'This limits the ECG observation to what the supplied report supports.', ['ecg']),
          choice('cta-scope', 'The reviewed CTA supports the aortic finding in this story; it does not settle every later care decision.', true, 'A decisive report can strengthen the conclusion while leaving clinical responsibility and subsequent decisions explicit.', ['aortic-cta']),
          choice('uncertainty-prevents-handoff', 'The handoff must wait until a single cause has been confirmed.', false, 'Uncertainty is information to communicate. It is not a reason to leave the concern without an identified receiver.'),
        ],
      },
      nextOwner: {
        prompt: 'How should the next review and any further concern be owned?',
        choices: [
          choice('named-ed-review', 'Ask the ED senior to own the next review of the chest-discomfort concern and confirm how new findings or symptom changes will reach them.', true, 'This assigns a next review and an update route without predicting a change or selecting treatment.'),
          choice('reviewed-cta-transfer', 'Ask the ED senior which specialist receives the reviewed CTA concern and who remains responsible until the transfer is acknowledged.', true, 'The report supports a focused transfer, but responsibility should not disappear between sender and receiver.', ['aortic-cta']),
          choice('request-means-transfer', 'Assume responsibility has transferred as soon as the diagnostic requests are sent.', false, 'Sending a request does not show that another clinician has accepted the concern or its follow-up.'),
        ],
      },
    },
    readback: {
      prompt: 'Which receiver reply gives you something specific to verify before closing the communication loop?',
      choices: [
        choice('specific-ed-readback', '“I heard the sudden chest-discomfort concern. I accept the next clinical review; tell me which findings you reviewed and which need follow-up.”', true, 'Verify that the repeated concern, reviewed information and named owner match your message, and correct any mismatch. The reply does not confirm the diagnosis or finish pending tasks.'),
        choice('generic-ed-acknowledgment', '“Noted in the worklist; someone will pick up the next result.”', false, 'This acknowledges a message without repeating the concern or identifying who accepted the next review. Clarify those points with the receiver.'),
      ],
    },
    sources: CARE_WORKFLOW_SOURCES,
    reviewProvenance: CARE_WORKFLOW_PROVENANCE,
  },
  'pub-003-missed-turn-investigation': {
    episodeId: 'pub-003-missed-turn-investigation',
    version: 1,
    role: {
      label: 'Family witness communicating with the ED team',
      boundary: 'Report observed changes and ask who receives updates. Clinical assessment, test requests and care decisions belong to the ED team; reading supplied hospital records in this game does not confer those responsibilities.',
    },
    timingNote,
    priority: {
      prompt: 'Emergency help is already on the way after sudden difficulty speaking and holding a fork. What is your priority as the witness?',
      choices: [
        choice('report-witness-account', 'Give the receiving ED team the sudden speech and hand-use changes now, including what you do and do not know.', true, 'The witnessed change is useful before its cause is confirmed. Your role is to communicate the observation, not assign a diagnosis or triage category.'),
        choice('wait-for-explanation', 'Hold back the witness account until the clinical team has a test result explaining the cause.', false, 'Waiting for an explanation withholds the observation that the team needs to assess. Share the witnessed changes while clinicians investigate.'),
      ],
    },
    tasks: {
      'witness-account': task('Receiving ED nurse', 'Receive the family witness account and confirm its recorded content', 1),
      'team-examination': task('ED examining clinician', 'Ask to review the supplied examination record', 1),
      'glucose-result': task('ED examining clinician', 'Ask to review the supplied glucose result', 1),
      'initial-ct': task('ED senior clinician', 'Follow up the supplied first scan report with radiology', 2),
      'team-mri-summary': task('ED senior clinician', 'Follow up the supplied later imaging summary with the reporting clinician', 2),
      'witness-handoff': task('Receiving ED nurse', 'Confirm receipt of the family witness handoff', 1),
    },
    reassessment: {
      minimumReviewed: 1,
      update: 'Fictional team update: the opening account described sudden difficulty finishing a sentence and holding a fork at dinner. The ED team asks for the witness account and for reviewed reports to be kept separate from assumptions about the cause.',
      prompt: 'After reading a finding and receiving this update, what should you check with the ED receiver?',
      choices: [
        choice('confirm-witness-and-update-route', 'Confirm that the speech and hand-use changes were heard, say which supplied finding you read, and ask whom to tell if you notice another change.', true, 'This checks the message and the next communication route. It does not require you to interpret a new symptom or take over clinical reassessment.'),
        choice('record-means-understood', 'Assume that because a report is in the record, the witness account and any later family updates have already reached the right clinician.', false, 'A recorded result does not confirm receipt of the witness history or identify who receives further concerns. Ask the ED team to clarify.'),
      ],
      variants: [
        {
          id: 'early-ct-limit',
          requires: ['initial-ct'],
          prompt: 'The first CT report you reviewed describes no hemorrhage and no definite early infarct visible. Which statement should you check with the ED receiver?',
          choices: [
            choice('reassess-ct-does-not-exclude', 'Describe what this CT report says, while retaining its limit: no visible early infarct on this scan does not exclude early ischemia. Keep any later reviewed findings separate.', true, 'This is a limit of the particular CT report, not a claim that all imaging is inconclusive. As a witness, you can check that the team heard the report accurately while clinicians own its interpretation and care decisions.'),
            choice('reassess-ct-rules-out', 'Tell the receiver that the CT has ruled out stroke because it shows neither hemorrhage nor a visible early infarct.', false, 'That conclusion goes beyond the supplied report. An early ischemic change may not be visible on the first CT, so the report must not be relabeled as excluding stroke.'),
          ],
        },
      ],
    },
    handoff: {
      receiver: {
        prompt: 'Who should receive your witness account during this emergency assessment?',
        choices: [
          choice('receiving-ed-team', 'The ED nurse or clinician receiving the speech and hand-use concern.', true, 'This places the account with the team handling the current assessment.'),
          choice('later-routine-message', 'A routine primary-care message to be read after the emergency visit.', false, 'That may be a later communication channel, but it does not confirm that the current ED receiver heard the witnessed change.'),
        ],
      },
      situation: {
        prompt: 'Which statement reports an opening observation or an actual reviewed record?',
        choices: [
          choice('opening-dinner-change', 'At dinner, the 68-year-old suddenly could not finish a sentence and had trouble holding a fork; emergency help was already on the way.', true, 'This carries the opening account without inventing an examination, glucose reading or scan.'),
          choice('reviewed-witness-timing', 'The reviewed witness account says speech was normal a moment earlier; word-finding difficulty and right-hand weakness began together and persisted.', true, 'This adds the recorded witness history after you have reviewed it, without inventing an exact clock time.', ['witness-account']),
          choice('reviewed-glucose', 'The team glucose result I reviewed records 106 mg/dL during the symptoms.', true, 'This attributes a known result to the team record rather than presenting a witness as performing the test.', ['glucose-result']),
          choice('reviewed-ct', 'The CT report I reviewed describes no hemorrhage and no definite early infarct visible on that scan.', true, 'This reports the wording of a reviewed scan rather than claiming that all causes have been excluded.', ['initial-ct']),
          choice('reviewed-mri', 'The later imaging review I read describes a matching acute left frontal infarct.', true, 'This is available only after that supplied review has been read. An early witness handoff does not require it.', ['team-mri-summary']),
          choice('hand-slip-only', 'The fork difficulty was an ordinary hand slip, so the speech change need not be part of the handoff.', false, 'That explains away an observation rather than reporting it. The receiver needs the speech and hand-use changes together.'),
        ],
      },
      uncertainty: {
        prompt: 'Which qualification preserves the difference between witnessing an event and establishing its cause?',
        choices: [
          choice('witness-scope', 'The witness account describes sudden changes; by itself it does not establish the cause or predict recovery.', true, 'This limits the witness claim without suggesting that a later reviewed report must be ignored.'),
          choice('glucose-scope', 'The reviewed glucose result does not support low glucose at that time, but it is not by itself a positive stroke test.', true, 'This distinguishes a result that weakens one explanation from proof of another.', ['glucose-result']),
          choice('ct-scope', 'No early infarct visible on the reviewed CT does not exclude an early ischemic stroke.', true, 'This preserves a limit of the supplied CT report; it does not ask the witness to determine clinical management.', ['initial-ct']),
          choice('help-means-history-unneeded', 'Because help is already on the way, the ED team no longer needs the initial symptom description.', false, 'An emergency response does not replace the witness information. Make sure the receiving team has heard it.'),
        ],
      },
      nextOwner: {
        prompt: 'What should you confirm about the next review and further family concerns?',
        choices: [
          choice('ed-owns-reassessment', 'Ask the ED nurse or clinician who owns reassessment and whom the family should tell if speech or hand use changes again.', true, 'The ED team owns clinical reassessment. You can ask for a clear route to report another observation without predicting that one will occur.'),
          choice('next-result-owns-review', 'Leave reassessment to whoever happens to see the next result, without identifying a receiver for family updates.', false, 'An unnamed future reader is not a confirmed contact. Ask the current team who will receive the next concern.'),
        ],
      },
    },
    readback: {
      prompt: 'Which ED reply lets you verify that your account and the route for further concerns were understood?',
      choices: [
        choice('specific-witness-readback', '“We heard the sudden speech and hand-use changes. The ED team owns reassessment; tell the receiving nurse or clinician about any further observed change.”', true, 'Check that the repeated account is accurate and that you know the named route for further concerns. Correct any mismatch; the reply is not a promise about diagnosis or recovery.'),
        choice('generic-witness-acknowledgment', '“The record is open; the next person looking at it can deal with any further concerns.”', false, 'This does not repeat what happened or confirm who receives the next concern. Ask the current ED receiver to make that explicit.'),
      ],
    },
    sources: CARE_WORKFLOW_SOURCES,
    reviewProvenance: CARE_WORKFLOW_PROVENANCE,
  },
  'stu-003-after-weekend-investigation': {
    episodeId: 'stu-003-after-weekend-investigation',
    version: 1,
    role: {
      label: 'Student reporting to a supervising clinician',
      boundary: 'Propose a synthesis, review supplied findings and bring concerns to the supervising clinician. The supervisor authorizes clinical decisions and remains responsible for reassessment; the student does not finalize a diagnosis or treatment plan independently.',
    },
    timingNote,
    priority: {
      prompt: 'The handoff reports vomiting, fatigue and abdominal discomfort, but the record is incomplete. What should you do before a complete laboratory explanation is available?',
      choices: [
        choice('bring-concern-to-supervisor', 'Bring the presenting concern to the supervising clinician now and propose focused review while the cause remains under assessment.', true, 'A student can raise the concern and identify missing information without claiming a confirmed cause or taking over the supervisor’s responsibilities.'),
        choice('complete-pattern-before-contact', 'Complete the laboratory pattern before contacting the supervisor, so no incomplete concern is handed over.', false, 'The supervisor needs to know the presenting concern and what is pending. Completing a pattern is not a substitute for early shared awareness and ownership.'),
      ],
    },
    tasks: {
      'recent-history': task('Supervising clinician', 'Follow up the recorded recent history with the history-taking team member', 1),
      'bedside-observations': task('Supervising clinician', 'Follow up the recorded bedside observations with the bedside team', 1),
      'plasma-glucose': task('Supervising clinician', 'Follow up the authored plasma glucose report from the laboratory', 1),
      'blood-ketones': task('Supervising clinician', 'Follow up the authored blood ketone report from the laboratory', 2),
      'acid-base': task('Supervising clinician', 'Follow up the authored acid-base report from the laboratory', 2),
      'serum-osmolality': task('Supervising clinician', 'Follow up the authored osmolality report from the laboratory', 2),
    },
    reassessment: {
      minimumReviewed: 1,
      update: 'Fictional team update: the opening handoff described vomiting, fatigue and abdominal discomfort. The supervising clinician asks which information you have actually reviewed and who will follow up the rest. No new laboratory value or patient change is supplied in this update.',
      prompt: 'What should your next message to the supervisor clarify after a reviewed finding and this update?',
      choices: [
        choice('synthesize-and-confirm-review', 'Separate the presenting symptoms, reviewed results and remaining questions, then confirm the supervisor who will review the next update.', true, 'This is a student synthesis and an ownership check. It does not turn one reviewed result into a complete diagnosis or an independent care decision.'),
        choice('first-result-closes-loop', 'Treat the first available result as completion of the assessment and leave further review to the laboratory worklist.', false, 'A result arriving is not the same as clinical reassessment. The supervisor still needs to know the information reviewed and what needs follow-up.'),
      ],
      variants: [
        {
          id: 'glucose-component-limit',
          requires: ['plasma-glucose'],
          prompt: 'You reviewed a plasma glucose of 286 mg/dL. What can you carry into the supervised reassessment from this report?',
          choices: [
            choice('reassess-glucose-component', 'Raised glucose is one component. Bring the ketone and acid-base findings into the synthesis separately; this glucose value alone is not the complete ketoacidosis argument.', true, 'Keep the laboratory components distinct and then connect the reports you actually reviewed. This remains true if you have already read the complete pattern: the diagnosis is supported by their combination, not by glucose alone.'),
            choice('reassess-glucose-completes-pattern', 'Report that the glucose value by itself establishes the complete ketoacidosis pattern, so ketone and acid-base information would not change the synthesis.', false, 'The glucose result does not establish the full pattern by itself. Ketone and metabolic-acidosis evidence answer separate questions, even when all reports are already available.'),
          ],
        },
      ],
    },
    handoff: {
      receiver: {
        prompt: 'Who should accept your synthesis and the next clinical review?',
        choices: [
          choice('supervising-clinician', 'The supervising clinician responsible for this assessment.', true, 'This names a receiver with clinical responsibility while preserving the student’s role.'),
          choice('results-inbox-only', 'The laboratory results inbox, without directly notifying the supervisor.', false, 'A results inbox is not a clinician accepting the concern or responsibility for the next review.'),
        ],
      },
      situation: {
        prompt: 'Which statement uses only opening facts or findings you actually reviewed?',
        choices: [
          choice('opening-vomiting-concern', 'A 26-year-old arrived with vomiting, fatigue and abdominal discomfort; the initial stomach-illness account was incomplete.', true, 'This is enough for an early supervisor handoff. It does not claim a laboratory pattern you have not reviewed.'),
          choice('reviewed-history', 'The reviewed history places thirst and frequent urination before vomiting, with no established diabetes diagnosis in the record.', true, 'This adds the recorded chronology rather than assuming that the opening complaint settled the cause.', ['recent-history']),
          choice('reviewed-glucose', 'The glucose report I reviewed records 286 mg/dL; that number alone is not the entire metabolic pattern.', true, 'This gives a reviewed result and limits the inference from it.', ['plasma-glucose']),
          choice('reviewed-triad', 'I reviewed glucose 286 mg/dL, blood ketones 4.8 mmol/L, and acid-base values of pH 7.22 and bicarbonate 13 mmol/L together.', true, 'This statement becomes available only when all three reports were reviewed. It is not required for an early handoff.', ['plasma-glucose', 'blood-ketones', 'acid-base']),
          choice('opening-confirms-stomach-illness', 'The vomiting establishes a stomach illness as the cause of the whole presentation.', false, 'The opening complaint does not establish that explanation. Communicate the symptoms and what is known separately from the working hypothesis.'),
        ],
      },
      uncertainty: {
        prompt: 'Which qualification fits a supervised synthesis without overstating the known evidence?',
        choices: [
          choice('opening-scope', 'Vomiting and discomfort alone do not confirm a gastrointestinal or metabolic cause; any stronger claim must cite reviewed evidence.', true, 'This remains a true limit of the opening account even after later findings become available.'),
          choice('glucose-component-scope', 'The reviewed glucose value is one component; ketone and acid-base information must be considered separately.', true, 'This does not falsely say that the other reports are still missing if you have also reviewed them.', ['plasma-glucose']),
          choice('reviewed-pattern-scope', 'The combined reviewed pattern supports ketoacidosis in this case; its precipitant and care decisions still require the supervisor’s assessment.', true, 'A complete recorded pattern can strengthen the synthesis without transferring independent clinical authority to the student.', ['plasma-glucose', 'blood-ketones', 'acid-base']),
          choice('opening-removes-uncertainty', 'The initial stomach-illness description is enough to leave competing explanations out of the handoff.', false, 'That would turn the opening suggestion into a confirmed account. The supervisor needs the distinction between symptoms, findings and inference.'),
        ],
      },
      nextOwner: {
        prompt: 'How should follow-up of the concern and later information be assigned?',
        choices: [
          choice('supervisor-owns-review', 'Confirm that the supervising clinician owns reassessment of the presenting concern; bring new reports or symptom changes back through the agreed route.', true, 'The student tracks and communicates information while the supervisor accepts clinical review. A future change is a contingency, not an event the game has simulated.'),
          choice('worklist-before-supervisor', 'Treat the laboratory worklist as the owner of the next review and wait for every report before updating the supervisor.', false, 'Task completion does not assign clinical responsibility. The supervisor should know what has been reviewed and what still needs attention.'),
        ],
      },
    },
    readback: {
      prompt: 'Which supervisor reply lets you verify the concern and responsibility before ending this handoff?',
      choices: [
        choice('specific-supervisor-readback', '“I heard the vomiting, fatigue and abdominal discomfort concern. I own the next review; distinguish the findings you reviewed from those still pending and bring updates back to me.”', true, 'Verify the repeated concern and next review owner, and correct any mismatch. This confirms communication, not a finalized diagnosis or treatment plan.'),
        choice('generic-supervisor-acknowledgment', '“The laboratory worklist is visible; whoever sees the final result can complete the assessment.”', false, 'The concern and next clinical owner have not been repeated or accepted. Clarify them with the supervising clinician.'),
      ],
    },
    sources: CARE_WORKFLOW_SOURCES,
    reviewProvenance: CARE_WORKFLOW_PROVENANCE,
  },
};

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
freeze(CARE_WORKFLOW_PROFILES);

export function getCareWorkflowProfile(episodeId) {
  return typeof episodeId === 'string' && Object.hasOwn(CARE_WORKFLOW_PROFILES, episodeId)
    ? CARE_WORKFLOW_PROFILES[episodeId] : null;
}
