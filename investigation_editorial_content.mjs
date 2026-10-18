// Version 6 is an editorial revision of the trusted, immutable version 5 bank.
// Only wording and review provenance change. Choice order, identifiers, gates,
// evidence relations, findings, scores, task timing and workflow versions stay put.
const clone = (value) => JSON.parse(JSON.stringify(value));
const FAMILIES = {
  'doc-002-tearing-back-investigation': {
    key: 'aorta', owner: 'ED senior clinician', receiver: 'ED senior coordinating the assessment',
    concern: 'sudden chest discomfort', opening: 'sudden severe chest discomfort',
    overclaim: 'the sudden chest discomfort establishes a coronary cause',
  },
  'pub-003-missed-turn-investigation': {
    key: 'stroke', owner: 'receiving ED clinician', receiver: 'ED clinician or nurse accepting the witness account',
    concern: 'sudden speech and hand-use changes', opening: 'sudden trouble speaking and using a hand at dinner',
    overclaim: 'the sudden speech and hand-use changes establish stroke',
  },
  'stu-003-after-weekend-investigation': {
    key: 'metabolic', owner: 'supervising clinician', receiver: 'supervising clinician responsible for the assessment',
    concern: 'vomiting, fatigue and abdominal discomfort', opening: 'vomiting, fatigue and abdominal discomfort',
    overclaim: 'the vomiting, fatigue and abdominal discomfort establish a stomach illness',
  },
};
const PROVENANCE_TEXT = 'Version 6 is an editorial revision of version 5: clearer wording and answer balance, with the fictional findings and decision rules unchanged. It has not received separate clinician review. The owner reports clinician review of earlier material, but its scope and version remain unverified.';
const REVIEW_LIMIT = 'Earlier owner-reported clinician review has unverified scope and version. The version 5 additions and this version 6 editorial revision have not received separate clinician review.';
const READBACK_PROMPT = 'Compare this reply with your sent handoff. What should you verify or correct?';
const REASSESSMENT_PROMPT = 'Which account fits the reviewed findings, reported change and outstanding work?';

function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function labels(section, replacements) {
  for (const [id, label] of Object.entries(replacements)) {
    const option = section.choices.find((item) => item.id === id);
    if (!option) throw new Error(`Editorial choice is missing: ${id}`);
    option.label = label;
  }
}

// The three strings are authored for fixed semantic identities, never positions.
// Their existing positions are retained, including all A/B/C ordering contrasts.
function question(episode, prefix, suffix, decisions, message) {
  const id = `${prefix}-${suffix}`;
  const section = [...episode.coordination.readbackScenarios, ...episode.coordination.reassessmentScenarios]
    .find((item) => item.id === id);
  if (!section) throw new Error(`Editorial question is missing: ${id}`);
  labels(section, {
    [`${id}-verify`]: decisions[0],
    [`${id}-alternative-1`]: decisions[1],
    [`${id}-alternative-2`]: decisions[2],
  });
  if (message !== undefined) section.message = message;
}

function sharedWording(episode, family, prefix) {
  const care = episode.careWorkflow;
  for (const tasks of [care.tasks, episode.tasks]) {
    for (const task of Object.values(tasks ?? {})) {
      if (typeof task.label === 'string') task.label = task.label.replace(/\b(?:ed|ecg|cta|ct|mri)\b/gi, (acronym) => acronym.toUpperCase());
    }
  }
  care.priority.prompt = 'How will you pass on the opening concern?';
  labels(care.priority, {
    'share-opening-concern': `Share ${family.concern} with the ${family.owner}; confirm who accepts review.`,
    'finish-record-before-contact': `Collect the remaining reports before asking the ${family.owner} to accept the completed explanation.`,
  });
  labels(care.handoff.receiver, {
    'r-clinical': `The ${family.receiver}.`,
    'r-worklist': 'The results worklist, with its next reader choosing the clinical receiver.',
  });
  labels(care.handoff.uncertainty, {
    'u-opening': 'Opening symptoms raise a concern; stronger cause claims need reviewed evidence.',
    'u-delay': 'The cause must be confirmed before the receiver can accept an unresolved account.',
  });
  labels(care.handoff.nextOwner, {
    'o-clinical': `Confirm the ${family.owner} owns the next review and receives later reports or symptom changes.`,
    'o-worklist': 'Treat the sent request as accepted responsibility; let the receiving worklist assign the next review.',
  });
  for (const section of episode.coordination.readbackScenarios) section.prompt = READBACK_PROMPT;
  for (const section of episode.coordination.reassessmentScenarios) section.prompt = REASSESSMENT_PROMPT;

  question(episode, prefix, 'receiver-not-accepted', [
    'Name a clinician who accepts the concern and ask them to repeat their responsibility.',
    'Record the visible worklist entry as acceptance of the next clinical review.',
    'Complete the diagnostic summary, then use its worklist entry as the review assignment.',
  ], `“The worklist shows ${family.concern}. I have not accepted the next clinical review.”`);
  question(episode, prefix, 'next-owner-missing', [
    `Ask the ${family.owner} to accept the next review and confirm where later reports or changes go.`,
    'Assign the next review to the final report reader once the worklist is complete.',
    'Verify the findings now; leave review ownership with the team handling the remaining requests.',
  ], '“I received the summary. Whoever reads the last report will take responsibility for the next review.”');
  question(episode, prefix, 'opening-overclaim', [
    'Keep the presenting concern separate from the cause; base stronger claims on reviewed findings.',
    'Accept the diagnostic wording because it accurately repeats the situation in the sent handoff.',
    'Retain that diagnosis and use the remaining reports to describe its extent.',
  ], `“I understood that ${family.overclaim}.”`);
  question(episode, prefix, 'uncertainty-withheld', [
    `Ask the ${family.owner} to accept the concern with its uncertainty and outstanding work.`,
    'Keep responsibility with the results worklist until a confirmed cause meets the receiver’s condition.',
    'State the leading diagnosis as definite so the receiver can accept the concern.',
  ], '“I will accept the concern once a cause has been confirmed.”');
  question(episode, prefix, 'opening-only', [
    'Verify the opening concern, uncertainty and review owner; include only information in the sent handoff.',
    'Add the expected diagnosis to make the opening account specific before its report is reviewed.',
    'Complete all outstanding work before verifying the account, so the handoff gives one definite explanation.',
  ], `“I heard ${family.opening}. That account alone does not establish the cause. I accept the next review; any listed reports keep their recorded status.”`);
  question(episode, prefix, 'reassess-current-record', [
    `Separate reviewed, pending and available reports; confirm the ${family.owner} accepts the next review.`,
    'Use the expected final reports to form the explanation; revise it if a later result disagrees.',
    'Use only the opening account until all reports are ready, then assign the next reviewer.',
  ], 'Use the reviewed findings and report statuses shown here. This checkpoint adds no patient finding.');

  episode.reasoning.prompt = 'Which reviewed evidence supports your explanation, and what limit remains?';
}

function aorticWording(episode, variant, prefix) {
  const care = episode.careWorkflow;
  const easing = variant === 'c';
  const change = easing ? 'less chest pain' : 'worse chest pain';
  labels(care.handoff.situation, {
    's-overclaim': 'Chest discomfort establishes a coronary cause; the other reports add secondary detail.',
  });
  labels(care.handoff.uncertainty, {
    'u-cta': variant === 'b'
      ? 'A nondiagnostic ascending segment neither confirms nor excludes an aortic cause.'
      : 'CTA supports the aortic finding; later care decisions still require assessment.',
  });
  if (easing) care.patientUpdates[0].prompt = 'How will you pass on the easing-pain update?';
  if (easing) labels(care.patientUpdates[0], {
    'communicate-easing-change': 'Report the patient’s easing pain alongside reviewed findings; confirm the ED senior accepts review.',
    'easing-replaces-findings': 'Use the easing pain as the current account; retain the earlier imaging only as background.',
  });
  else labels(care.patientUpdates[0], {
    'communicate-change': 'Report the patient’s worse pain alongside reviewed findings; confirm the ED senior accepts reassessment.',
    'defer-change-to-summary': 'Save the worse-pain report for the final handoff; flag it after the outstanding reports arrive.',
  });

  const reportChoices = {
    a: [
      'Correct eased pain to worse pain; retain the CTA flap finding and accepted review owner.',
      'Verify the exchange because the CTA detail is accurate and carries the main explanation.',
      'Replace the flap finding with an unresolved imaging account because the symptoms have changed.',
    ],
    b: [
      'Verify the limited CTA, worse pain and accepted review; keep the aortic question unresolved.',
      'Call the CTA a confirmed aortic diagnosis, using the worse pain as further confirmation.',
      'Exclude an aortic cause because the ascending segment has no definite reported flap.',
    ],
    c: [
      'Keep the positive CTA alongside the easing pain; carry both to the ED senior.',
      'Verify the exchange because the CTA detail is accurate and carries the main explanation.',
      'Replace the flap finding with an unresolved imaging account because the symptoms have changed.',
    ],
  };
  const reportMessages = {
    a: '“The reviewed CTA describes the flap. The update says the pain has eased. I accept the next review.”',
    b: '“The reviewed CTA calls the motion-limited ascending segment nondiagnostic, with no definite flap reported. The patient reports worse pain. I accept the next review; the cause remains unresolved.”',
    c: '“The reviewed CTA describes the flap. The patient now reports less pain, so I will pass on the CTA finding as no longer supported.”',
  };
  question(episode, prefix, 'report-and-change', reportChoices[variant], reportMessages[variant]);
  question(episode, prefix, 'ecg-change-cta-pending', [
    'Keep the ECG nonspecific and report the pain change; the pending CTA supplies no finding.',
    'Verify the coronary explanation; keep the pending CTA as a check for a concurrent aortic finding.',
    'Add the expected CTA finding and ask the senior to compare it with the pain change.',
  ], `“The ECG confirms a coronary cause. The patient reports ${change}; the CTA request is still pending.”`);
  question(episode, prefix, 'change-before-cta', [
    'Verify the pain report and review owner; keep the CTA status separate from an unreviewed result.',
    'Add the likely CTA finding so the pain change has a specific diagnosis in the handoff.',
    'Leave the pain change out until the CTA report explains whether the two are related.',
  ], `“The patient reports ${change}. I accept review of that change; this handoff contains no reviewed CTA finding.”`);
  question(episode, prefix, 'reassess-report-change', [
    variant === 'b'
      ? 'Report worse pain and the limited CTA to the senior; the report neither confirms nor excludes an aortic cause.'
      : 'Report the CTA finding and pain change to the ED senior; later care decisions remain open.',
    variant === 'b'
      ? 'Use the worse pain to treat the nondiagnostic CTA segment as positive in the next handoff.'
      : 'Use the pain report to decide whether the reviewed flap still belongs in the handoff.',
    'Keep the previous report summary; omit the pain change until a repeat examination is supplied.',
  ], variant === 'b'
    ? 'Reviewed CTA: the motion-limited ascending segment is nondiagnostic, with no definite flap reported. The patient reports worse chest pain.'
    : `Reviewed CTA: an ascending-aortic intimal flap extending into the arch. The patient reports ${change}.`);
  question(episode, prefix, 'reassess-ecg-pending', [
    'Give the senior the pain report and nonspecific ECG; the pending CTA has no reviewed finding.',
    'Make the ECG the confirmed explanation for the change; retain the pending CTA as a secondary check.',
    'Prepare the final aortic conclusion from the requested CTA while the senior reviews the pain change.',
  ], `Reviewed ECG: nonspecific. The patient reports ${change}. The requested CTA remains pending.`);
  question(episode, prefix, 'reassess-change', [
    'Report the patient’s account with reviewed findings; confirm the ED senior owns the next review.',
    'Keep the earlier account until an outstanding report explains how the pain has changed.',
    'Treat the pain change as an examination finding that settles the leading explanation.',
  ], `The patient reports ${change}. Keep reviewed findings separate from outstanding work.`);

  labels({ choices: episode.reasoning.uncertaintyOptions }, {
    'symptoms-not-confirmation': 'The opening chest discomfort raises concern without establishing a cause.',
    'limited-ecg': variant === 'b'
      ? 'The nonspecific ECG alone settles neither the coronary nor the aortic question.'
      : 'The nonspecific ECG finding does not settle the cause of this presentation.',
    'report-scope': variant === 'b'
      ? 'The nondiagnostic ascending segment leaves an aortic cause neither confirmed nor excluded.'
      : 'CTA supports an aortic finding; later care decisions still require assessment.',
    'all-excluded': variant === 'b'
      ? 'No reported flap rules out an aortic explanation in this record.'
      : 'The reviewed record rules out the competing explanations for this presentation.',
  });
  const transfer = {
    a: {
      negative: 'No reported flap establishes a negative aortic scan despite the motion limitation.',
      unresolved: 'Keep the aortic question unresolved; name who will clarify the inadequate study.',
      confirmed: 'The symptom account establishes an aortic cause despite the inadequate scan.',
    },
    b: {
      'still-nondiagnostic': 'Keep the aortic question unresolved because the earlier arrival had motion-limited imaging.',
      'finding-supported': 'The report supports the aortic finding; the responsible team assesses later care decisions.',
      'all-settled': 'Attribute the whole presentation to this finding and omit competing concerns from the handoff.',
    },
    c: {
      'improvement-erases': 'Treat the positive CTA as a resolved historical concern because the pain has eased.',
      'preserve-both': 'Give the responsible clinician both the positive CTA and the reported easing of pain.',
      'symptoms-prove': 'Use the pain change to establish the finding’s present extent without further assessment.',
    },
  };
  labels(episode.transferQuestion, transfer[variant]);
}

function strokeWording(episode, variant, prefix) {
  const care = episode.careWorkflow;
  labels(care.handoff.situation, {
    's-witness': 'The reviewed witness account links speech and right-hand changes, with continuing difficulty.',
    's-overclaim': 'The initial speech change establishes stroke; the arm change describes its severity.',
  });
  labels(care.handoff.uncertainty, {
    'u-imaging': variant === 'a'
      ? 'MRI supports ischemic stroke here; its cause and later care decisions remain open.'
      : 'These reports leave the cause unresolved without excluding stroke; the ED team assesses the continuing focal concern.',
  });
  labels(care.patientUpdates[0], {
    'communicate-change': 'Report clearer speech and continuing arm difficulty; ask the ED team who accepts the update.',
    'defer-change-to-summary': 'Emphasize the clearer speech in this update; keep the arm difficulty in the earlier written account.',
  });
  const imagingMessages = {
    a: '“Speech seems clearer, but right-arm difficulty continues. The later MRI reports a matching small acute left frontal infarct. I accept the update for the ED team’s review.”',
    b: '“The imaging is limited. I accept the update: the speech and right-arm difficulty have both resolved.”',
    c: '“Speech seems clearer, but right-arm difficulty continues. The first CT reports no hemorrhage or definite early infarct; the reviewed status notice supplies no later imaging report. I accept the update for the ED team’s review.”',
  };
  question(episode, prefix, 'imaging-and-change', [
    variant === 'b'
      ? 'Correct the update to clearer speech with continuing arm difficulty; retain the imaging limits.'
      : 'Verify the mixed witness update and imaging account; keep clinical assessment with the ED team.',
    'Describe complete recovery because the clearer speech is the most recent reported observation.',
    variant === 'a'
      ? 'Call the imaging question unconfirmed because the speech now seems clearer.'
      : 'Call the stroke evaluation negative because no later positive image was supplied.',
  ], imagingMessages[variant]);
  question(episode, prefix, 'first-ct-change-pending', [
    'Keep early ischemia open despite this CT; retain the mixed update and pending imaging status.',
    'Accept a non-stroke explanation because clearer speech agrees with the CT’s lack of visible infarct.',
    'Replace the pending status with the later imaging finding to give the team a complete cause statement.',
  ], '“The first CT shows no definite infarct, so this is a non-stroke problem. Speech seems clearer, arm difficulty continues, and later imaging is pending.”');
  question(episode, prefix, 'mixed-change', [
    'Verify both witness observations and their source; the ED team still owns clinical reassessment.',
    'Describe the focal symptoms as resolved because clearer speech is the newer reported feature.',
    'Record this as a new clinical examination because a receiving team member repeated it.',
  ], '“Speech seems clearer, but right-arm difficulty continues. I accept that as a family report, not a new clinical examination.”');
  const imagingContext = {
    a: 'Reviewed MRI: a matching small acute left frontal infarct.',
    b: 'Reviewed imaging: the first CT reports no hemorrhage or definite early infarct; the later attempted study is nondiagnostic.',
    c: 'Reviewed record: the first CT reports no hemorrhage or definite early infarct; the status notice supplies no later imaging report.',
  };
  question(episode, prefix, 'reassess-imaging-change', [
    variant === 'a'
      ? 'Report the arm concern and matching MRI to the ED team; stroke is supported, but its mechanism remains open.'
      : 'Report the arm concern and imaging limits: cause unresolved, stroke not excluded; assessment need not await MRI.',
    'Describe the focal symptoms as resolved; use the imaging only as background for the earlier episode.',
    variant === 'a'
      ? 'Use clearer speech as counterevidence and remove the matching infarct from the handoff.'
      : 'Use clearer speech and the lack of a diagnostic later finding to establish a non-stroke cause.',
  ], `${imagingContext[variant]} The family reports clearer speech with continuing right-arm difficulty.`);
  question(episode, prefix, 'reassess-ct-change-pending', [
    'Report the mixed change and CT limit; later imaging is pending, and the ED team owns assessment.',
    'Use clearer speech and the first CT together to give the team a settled non-stroke explanation.',
    'Wait for the later imaging report to decide whether the continuing arm concern belongs in the account.',
  ], 'Reviewed CT: no hemorrhage or definite early infarct. Speech seems clearer, arm difficulty continues, and later imaging is pending.');
  question(episode, prefix, 'reassess-mixed-change', [
    'Give the ED team both witness observations, adding only findings already reviewed.',
    'Use clearer speech as the current situation; leave the arm difficulty in the earlier account.',
    'Use the continuing arm difficulty to confirm the cause without the reviewed record.',
  ], 'The family reports clearer speech with continuing right-arm difficulty. Other findings keep the statuses shown here.');

  const uncertainty = {
    'symptoms-not-confirmation': 'The opening speech and hand changes raise concern without establishing a cause.',
    'glucose-discriminator': 'Glucose weakens the current low-glucose explanation; it does not establish stroke.',
    'ct-limit': 'The first CT does not exclude an early ischemic stroke.',
    'all-excluded': variant === 'a'
      ? 'The reviewed record rules out the competing causes of these focal changes.'
      : 'The first CT and lack of a diagnostic later image rule out stroke.',
  };
  if (variant === 'a') uncertainty['mri-scope'] = 'MRI supports stroke here; its cause and later care decisions remain unsettled.';
  else uncertainty['imaging-scope'] = variant === 'b'
    ? 'Imaging leaves the cause unresolved; continuing focal changes still need the clinician’s assessment.'
    : 'The first CT and unavailable later report leave the cause unresolved without excluding stroke.';
  labels({ choices: episode.reasoning.uncertaintyOptions }, uncertainty);
  const transfer = {
    a: {
      exclude: 'Use the improvement or lack of visible infarct to establish a non-stroke explanation.',
      confirmed: 'Use the reported symptoms alone to establish ischemic stroke in the next handoff.',
      'concern-and-limits': 'Give the ED team the continuing focal concern and evidence limits; the cause needs assessment.',
    },
    b: {
      'still-no-evidence': 'Keep stroke unsupported because the first CT showed no definite early infarct.',
      'matching-support': 'The matching report supports stroke; its cause and later care decisions still need assessment.',
      'all-focal-proven': 'Use the matching injury to establish its mechanism without a separate cause assessment.',
    },
    c: {
      'negative-later': 'A second negative imaging result that reduces concern about the continuing arm difficulty.',
      'nondiagnostic-later': 'Evidence that a later study was attempted but failed to provide diagnostic images.',
      'missing-information': 'An information gap to carry with the continuing focal concern to the ED team.',
    },
  };
  labels(episode.transferQuestion, transfer[variant]);
}

function metabolicWording(episode, variant, prefix) {
  const care = episode.careWorkflow;
  labels(care.handoff.situation, {
    's-overclaim': 'The vomiting establishes a stomach illness; the glucose report is a separate issue.',
  });
  labels(care.handoff.uncertainty, {
    'u-pattern': variant === 'c'
      ? 'Acid-base remains unknown, so the full pattern is unestablished; the supervisor owns assessment.'
      : `The combined reports fit ${variant === 'b' ? 'HHS' : 'ketoacidosis'}; the supervisor assesses its precipitant and care decisions.`,
  });
  labels(care.patientUpdates[0], {
    'communicate-change': 'Report persistent thirst, increased tiredness and continued conversation; confirm the supervisor accepts review.',
    'defer-change-to-summary': 'Use continued conversation as reassurance; save the symptom update for the completed laboratory account.',
  });
  const patternChoices = {
    a: [
      'Verify the combined pattern, full symptom update and accepted review; keep the precipitant open.',
      'Use continued conversation to omit increased tiredness; verify the laboratory account on its own.',
      'Replace the combined pattern with a glucose-only diagnosis to make the account concise.',
    ],
    b: [
      'Correct the tiredness update: it increased despite conversation; retain the HHS pattern and review owner.',
      'Use continued conversation to omit increased tiredness; verify the laboratory account on its own.',
      'Replace the combined pattern with a glucose-only diagnosis to make the account concise.',
    ],
    c: [
      'Keep acid-base unknown rather than normal, and retain the thirst and tiredness update.',
      'Use continued conversation to omit increased tiredness; verify the laboratory account on its own.',
      'Confirm ketoacidosis from glucose and ketones; treat the absent acid-base component as secondary detail.',
    ],
  };
  const patternMessages = {
    a: '“The combined reports support ketoacidosis. Thirst persists and tiredness has increased; the patient is conversant. I accept the next review.”',
    b: '“The combined reports fit HHS. The patient is conversant, so I understood that tiredness has improved.”',
    c: '“No acid-base values are available, so I will record them as normal. Thirst persists and tiredness has increased.”',
  };
  question(episode, prefix, 'pattern-and-change', patternChoices[variant], patternMessages[variant]);
  question(episode, prefix, 'glucose-change-acid-pending', [
    'Verify glucose, pending acid-base status and the symptom account; add no acid-base finding.',
    'Replace the pending acid-base status with a value inferred from glucose and symptoms.',
    'Verify the exchange as evidence that the complete ketoacidotic pattern is established.',
  ], '“Raised glucose is reviewed; acid-base is pending. Thirst persists and tiredness has increased, while the patient remains conversant.”');
  question(episode, prefix, 'symptom-change', [
    'Verify all three observations and accepted review; conversation does not establish a laboratory pattern.',
    'Change increased tiredness to improvement because the patient can still hold a conversation.',
    'Add a confirmed metabolic diagnosis to the symptom account before accepting the exchange.',
  ], '“Thirst persists and tiredness has increased. The patient is still conversant; I accept the update for supervisor review.”');
  const patternContext = {
    a: 'Reviewed glucose, ketones and acid-base reports support the ketoacidotic pattern.',
    b: 'Reviewed glucose, osmolality, ketones and acid-base reports fit the HHS pattern.',
    c: 'Glucose and ketones are reviewed, but the acid-base notice supplies no pH or bicarbonate result.',
  };
  question(episode, prefix, 'reassess-pattern-change', [
    variant === 'c'
      ? 'Give the supervisor the components and increased tiredness; the pattern remains unestablished, with acid-base unknown rather than normal.'
      : 'Report the combined pattern and increased tiredness; the supervisor still assesses the precipitant and later care decisions.',
    'Keep the laboratory account; leave out increased tiredness because the patient is still able to converse.',
    variant === 'c'
      ? 'Treat unavailable acid-base values as absent acidosis, and favor a non-acidotic metabolic pattern in the handoff.'
      : 'Use the symptom change to replace the combined laboratory pattern with a conclusion based on glucose alone.',
  ], `${patternContext[variant]} Thirst persists and tiredness has increased; the patient remains conversant.`);
  question(episode, prefix, 'reassess-glucose-change-pending', [
    'Give the supervisor glucose and the symptom change; acid-base is pending, so do not claim the full pattern.',
    'Infer acid-base from glucose and increased tiredness, then hand over the complete metabolic pattern to the supervisor.',
    'Wait for the acid-base report before sharing the symptom change, to establish whether continued conversation is reassuring.',
  ], 'Glucose is reviewed; acid-base remains pending. Thirst persists and tiredness has increased, while the patient remains conversant.');
  question(episode, prefix, 'reassess-symptom-change', [
    'Give the supervisor the full symptom update, reviewed components and work still outstanding.',
    'Use continued conversation to retain the earlier symptom account until all reports can be combined.',
    'Use increased tiredness to confirm the metabolic diagnosis; treat unreviewed components as supporting detail.',
  ], 'Thirst persists and tiredness has increased; the patient remains conversant. Other results keep the statuses shown here.');

  const common = {
    'symptoms-not-confirmation': 'Vomiting and discomfort raise concern without establishing a metabolic cause.',
  };
  const uncertainty = {
    a: {
      'history-limits': 'Thirst and frequent urination before vomiting weaken a stomach-only account; the metabolic cause remains open.',
      'glucose-with-missing-components': 'Glucose is raised; a ketone or acid-base report remains missing from this route.',
      'ketones-with-missing-components': 'Ketones are raised; a glucose or acid-base report remains missing from this route.',
      'acidosis-with-missing-components': 'A glucose or ketone report is missing; acidosis alone does not establish the full pattern.',
      'triad-scope': 'The combined pattern supports ketoacidosis; its precipitant and later care decisions remain unsettled.',
      'osmolality-discriminator': 'Osmolality weakens a markedly hyperosmolar explanation; it does not establish ketoacidosis alone.',
      'all-excluded': 'The reviewed record rules out the other causes of the vomiting.',
    },
    b: {
      'history-limits': 'The symptom sequence suggests a metabolic concern without distinguishing the laboratory pattern.',
      'partial-pattern': 'Glucose alone cannot distinguish HHS from DKA; another component is still missing.',
      'hyperosmolar-scope': 'The combined reports support HHS; its precipitant and later care decisions remain unsettled.',
      'acid-base-limit': 'A non-acidotic pH does not make the glucose and osmolality findings unimportant.',
      'all-excluded': 'The non-acidotic pH rules out an important metabolic problem in this record.',
    },
    c: {
      'glucose-is-component': 'Raised glucose alone does not establish the complete metabolic pattern.',
      'missing-acid-base-scope': 'Glucose and ketones are reviewed, but unavailable acid-base values leave the cause unestablished.',
      'unknown-is-normal': 'No acid-base value was supplied, so this record shows no acidosis.',
    },
  };
  labels({ choices: episode.reasoning.uncertaintyOptions }, { ...common, ...uncertainty[variant] });
  const transfer = {
    a: {
      dka: 'Glucose establishes ketoacidosis; the other report components describe its severity.',
      hhs: 'HHS fits the combined glucose, osmolality, ketone and acid-base results.',
      reassured: 'The non-acidotic pH makes the glucose and osmolality secondary concerns.',
    },
    b: {
      'hhs-by-memory': 'HHS fits, with ketones and acidosis treated as effects of dehydration.',
      'dka-pattern': 'Ketoacidosis fits the raised glucose, significant ketones and acidosis together.',
      'glucose-alone': 'Ketoacidosis remains unsupported until osmolality completes its diagnostic pattern.',
    },
    c: {
      'full-pattern': 'Glucose and ketones establish the full ketoacidotic pattern despite the missing component.',
      'component-unknown': 'Acid-base remains unknown, so this record does not establish the complete pattern.',
      'normal-component': 'No reported acidosis supports a non-acidotic alternative despite the missing acid-base values.',
    },
  };
  labels(episode.transferQuestion, transfer[variant]);
}

export function buildInvestigationEditorialContent(v5Episodes) {
  if (!Array.isArray(v5Episodes) || v5Episodes.length !== 9) throw new Error('Editorial content requires the nine trusted version 5 episodes.');
  const seen = new Set();
  const episodes = v5Episodes.map((source) => {
    const familyId = source.familyId || source.id;
    const family = FAMILIES[familyId];
    const variant = source.id === familyId ? 'a' : source.id === `${familyId}-record-b` ? 'b' : source.id === `${familyId}-record-c` ? 'c' : null;
    if (source.version !== 5 || !family || !variant || seen.has(source.id)) throw new Error('Editorial content received an unexpected version 5 episode.');
    seen.add(source.id);
    const episode = clone(source);
    episode.version = 6;
    const prefix = `${family.key}-${variant}`;
    sharedWording(episode, family, prefix);
    ({ aorta: aorticWording, stroke: strokeWording, metabolic: metabolicWording })[family.key](episode, variant, prefix);
    episode.reviewProvenance.text = PROVENANCE_TEXT;
    episode.careWorkflow.reviewProvenance.text = PROVENANCE_TEXT;
    episode.resolution.limitations = episode.resolution.limitations.map((text) => text.includes('version 5 questions') ? REVIEW_LIMIT : text);
    return episode;
  });
  return freeze(episodes);
}
