import originalBundle from './game-data.mjs';

// Revised authored decisions are a separate trusted edition. The original
// payload remains the source for historic action replay and original wording.
export const STORY_CONTENT_VERSION = 2;
export const STORY_EDITION_LABEL = 'Revised decisions · Story version 2';
const CHECKED_UTC = '2026-10-16T05:08:40Z';
// SHA-256 of JSON.stringify({schema, content_version, edition_label, cases}).
// The content test checks this identity whenever authored text changes.
const REVISED_BUILD_ID = 'b5c36e0d31e21b2a0a2aefba49687c3de716b3e0455b7b1cf228c746c1721a38';
const source = (title, url, scope) => ({ title, url, checkedUtc: CHECKED_UTC, scope });

const revisions = {
  'pub-001-dropped-pen': {
    counterfactual: 'Substituting an inferred cause or a meal timestamp for the witnessed changes would lose the distinction between observation, timing and explanation.',
    sources: [
      source('CDC: Signs and Symptoms of Stroke', 'https://www.cdc.gov/stroke/signs-symptoms/index.html', 'Sudden focal warning signs, recording observed symptom timing and seeking emergency help. No treatment window, medication or eligibility rule is added.'),
      source('NICE NG128: recognition and initial assessment', 'https://www.nice.org.uk/guidance/NG128/chapter/recommendations', 'Competing explanations, including hypoglycaemia, require assessment; symptom recognition is not definitive diagnosis. Existing clinical instructions are retained.'),
    ],
    stages: {
      s1: {
        question: 'Which working explanation best accounts for the sudden face and hand changes together?',
        narrative: 'At breakfast, Ray develops sudden face and arm changes. A family member is already calling emergency services. Compare the combined observations rather than explaining each away separately; the game must not delay a real emergency call.',
        choices: {
          hypoglycemia: { label: 'Low blood sugar explains the changes without a glucose reading or further assessment', teaching: 'Low glucose is a possible mimic, but it has not been measured here. The sudden focal changes keep possible stroke in the working explanation while the emergency assessment proceeds.', consequence: 'The record now shows an unmeasured explanation being treated as established. The witnessed focal changes still need to be accounted for.' },
          clumsy: { label: 'The dropped pen is a hand slip unrelated to the uneven smile', teaching: 'A hand slip can happen in isolation. Its sudden appearance together with a facial change is the reason the combined pattern matters.', consequence: 'Splitting the two observations into unrelated mishaps leaves their simultaneous onset unexplained.' },
        },
      },
      s2: {
        question: 'Which detail should be reported from the witness account rather than inferred from the breakfast timetable?',
        narrative: 'Emergency help has already been called. The dispatcher needs the witnessed timing and any uncertainty about it. The meal schedule is background context, not a direct measurement of when the underlying problem began.',
        choices: {
          breakfast: { label: 'Use the breakfast schedule to reconstruct an exact symptom-onset time', teaching: 'The relevant timing is what someone actually witnessed. A meal timestamp should not be substituted for symptom onset; an uncertain account should remain uncertain.', consequence: 'The handoff risks turning a background timestamp into a more precise onset claim than the witness can support.' },
        },
      },
      s3: {
        question: 'Which response preserves the emergency handoff while the cause of the ongoing symptoms remains unconfirmed?',
        narrative: 'His speech remains slurred. The witnessed weakness began 20 minutes ago. Emergency help is already being arranged; the family needs to pass on what happened without assuming that the cause or treatment is settled.',
        choices: {
          aspirin: { label: 'Give aspirin at home', teaching: 'In this ongoing suspected stroke, the family should not infer a medication decision from the symptoms alone. The existing emergency pathway leaves the cause and appropriate treatment to clinicians.', consequence: 'A medication assumption would get ahead of the available evidence. The dispatcher still needs the witnessed changes and onset time.' },
        },
      },
    },
  },
  'pub-002-honey-jar': {
    counterfactual: 'Treating the honey jar as either proof of the diagnosis or the sole measure of severity would miss the changing feeding, cry, tone and breathing pattern.',
    sources: [
      source('CDC: Symptoms of Botulism', 'https://www.cdc.gov/botulism/signs-symptoms/index.html', 'Infant constipation, poor feeding, weak cry, muscle weakness and possible breathing involvement. The fictional pattern raises concern without laboratory confirmation.'),
      source('CDC: Botulism Prevention', 'https://www.cdc.gov/botulism/prevention/index.html', 'Honey is unsafe before age one and is a relevant exposure; exposure alone does not establish this infant’s diagnosis or degree of weakness.'),
    ],
    stages: {
      s1: {
        question: 'Which working explanation accounts for the feeding, cry, bowel and tone changes as a pattern?',
        narrative: 'A 4-month-old has weak feeding, a weak cry, constipation, and increasing floppiness after honey was added to a dummy. A caregiver is arranging urgent medical help. Use the symptoms and exposure together without treating the jar as a diagnostic test.',
        choices: {
          fatigue: { label: 'Ordinary tiredness explains the weak cry, feeding difficulty and new floppiness', teaching: 'Tiredness does not adequately account for this progressive combination. The symptom pattern warrants urgent assessment even before a precise cause is confirmed.', consequence: 'A familiar explanation is being asked to cover several worsening findings that it does not adequately explain.' },
          feeding: { label: 'Constipation alone accounts for the feeding difficulty and loss of tone', teaching: 'Constipation is one finding in the record. It does not independently explain the weak cry and increasing loss of tone.', consequence: 'Reducing the record to a bowel or feeding change leaves the broader weakness pattern unexplained.' },
        },
      },
      s2: {
        question: 'Which finding adds evidence of worsening function, rather than merely identifying a possible exposure?',
        narrative: 'The baby is breathing faster and sucking is now very weak. Distinguish the honey exposure from the functional changes that make the situation increasingly concerning.',
        choices: {
          morning: { label: 'The honey exposure by itself, without considering how the symptoms are changing', teaching: 'The exposure matters to the differential. Very weak sucking and the changing breathing pattern add information about the infant’s current condition that the jar alone cannot provide.', consequence: 'Attention stays on the exposure while the change in the baby’s ability to feed is under-reported.' },
        },
      },
      s3: {
        question: 'Which next step fits progressive weakness and breathing difficulty even though the exact diagnosis is not yet confirmed?',
        narrative: 'Breathing is becoming difficult, sucking is very weak, and the caregiver is speaking with the emergency dispatcher. Diagnostic uncertainty must not be mistaken for reassurance about the worsening symptoms.',
        choices: {
          b: { label: 'Wait until morning to see whether stopping the honey reverses the symptoms', teaching: 'Removing a suspected exposure is not evidence that progressive weakness or breathing difficulty has resolved. The urgency comes from the current symptoms, not certainty about the diagnosis.', consequence: 'Home observation would leave the worsening functional symptoms unassessed overnight. The fictional caregiver needs to relay those changes to the emergency team.' },
        },
      },
    },
  },
  'stu-001-mountain-acid': {
    counterfactual: 'Using the glucose trend as a substitute for circulation, potassium, ketone and acid-base reassessment would confuse one improving measurement with resolution of the whole recorded problem.',
    sources: [
      source('ADA/EASD and partner societies: Hyperglycemic Crises in Adults With Diabetes, 2024 consensus report', 'https://diabetesjournals.org/care/article/47/8/1257/156808/Hyperglycemic-Crises-in-Adults-With-Diabetes-A', 'The DKA pattern and distinct roles of glucose, ketone, acid-base and potassium reassessment. Existing treatment labels, thresholds and teaching are retained verbatim; no new regimen is authored.'),
    ],
    stages: {
      s1: {
        question: 'Which first recorded step addresses circulation alongside the metabolic findings, rather than treating the glucose number as the whole problem?',
        narrative: 'A 19-year-old has vomiting, deep breathing, glucose 468 mg/dL, blood beta-hydroxybutyrate 5.0 mmol/L, arterial pH 7.08, and K+ 5.4 mEq/L. The choices refer to the team’s existing fictional plan; identify why its first step must account for more than hyperglycemia.',
        choices: {
          b: { label: 'Immediate insulin bolus', teaching: 'This choice focuses on lowering glucose before the recorded circulation and potassium assessment. Those questions remain part of the existing team plan; the initial serum potassium is not the whole assessment.', consequence: 'The team pauses the proposed shortcut and reviews the already established circulation and potassium checks rather than choosing from the glucose value alone.' },
        },
      },
      s2: {
        question: 'Which measurement must remain under review despite a reassuring initial value as the recorded plan proceeds?',
        narrative: 'The initial fluid step is complete. The potassium recheck is 4.6 after an initial value of 5.4. Interpret the trend without assuming that one value fixes the state for the remainder of the case.',
        choices: {
          arrival: { label: 'The falling glucose alone is enough to represent the electrolyte reassessment', teaching: 'Glucose and potassium answer different questions. An improving glucose trend does not replace potassium measurement as the existing plan proceeds.', consequence: 'One improving measurement is being used as a proxy for another. The potassium trend would disappear from the handoff.' },
        },
      },
      s3: {
        question: 'Which existing plan preserves the distinction between glucose improvement and unresolved ketone or acid-base findings?',
        narrative: 'After initial fluids, glucose is 252 mg/dL and K+ is 4.6. Those updates do not themselves document that the ketone and acid-base abnormalities have resolved. Interpret the established plan without inventing a new regimen.',
        choices: {
          b: { label: 'Treat the glucose improvement as evidence that the ketone and acid-base abnormalities have resolved', teaching: 'A lower glucose value is not a substitute for the ketone and acid-base evidence needed to describe resolution. The recorded measurements do not yet establish that conclusion.', consequence: 'The case would be described as resolved on the basis of a single trend while its other metabolic questions remain open.' },
        },
      },
      s4: {
        question: 'Which handoff retains the existing sequence and the need for reassessment instead of closing the case on one improved number?',
        narrative: 'Prepare a bounded handoff from the recorded plan. Separate what has improved from what still needs measurement, and preserve the existing monitoring sequence.',
        choices: {
          shortcut: { label: 'The improved glucose is sufficient evidence to describe the metabolic episode as resolved', teaching: 'The handoff needs separate information about potassium, ketones and acid-base status. An improving glucose value alone cannot support a claim that the whole episode has resolved.', consequence: 'The handoff would overstate what has been established and omit the remaining measurements.' },
        },
      },
    },
  },
  'stu-002-saturday-pain': {
    counterfactual: 'Treating an IUD, an empty uterus or a single hCG value as a definitive answer would close the pregnancy-location question while the changing symptoms and possible bleeding still require assessment.',
    sources: [
      source('NICE NG126: pregnancy location, ultrasound findings and hCG assessment', 'https://www.nice.org.uk/guidance/NG126/chapter/diagnosis-of-viable-intrauterine-pregnancy-and-of-tubal-ectopic-pregnancy', 'Pregnancy of unknown location, the limits of a single hCG measurement, free fluid interpreted with clinical findings, and reassessment when symptoms worsen. No treatment, dose or eligibility rule is changed.'),
    ],
    stages: {
      s1: {
        question: 'Which first investigation checks a possibility that the recorded IUD history does not exclude?',
        narrative: 'A currently stable 28-year-old has right lower abdominal pain, spotting, and an IUD. Before narrowing the fictional assessment to another cause, distinguish low probability from an excluded pregnancy.',
        choices: {
          b: { label: 'CT abdomen/pelvis before establishing pregnancy status because an IUD makes pregnancy unlikely', teaching: 'An IUD does not establish the patient’s current pregnancy status. The initial assessment should not treat low probability as an exclusion; this is not a general ban on clinically necessary CT.', consequence: 'The team identifies an unresolved branch in the reasoning and checks pregnancy status before treating a non-pregnancy explanation as the only pathway.' },
        },
      },
      s2: {
        question: 'Which classification preserves what the positive test and non-localizing ultrasound establish without overcalling the outcome?',
        narrative: 'The pregnancy test is positive. Transvaginal ultrasound identifies neither an intrauterine nor an extrauterine pregnancy. Pain and bleeding are still being assessed; a missing location is not a documented pregnancy outcome.',
        choices: {
          routine: { label: 'A completed miscarriage is established by the empty uterus', teaching: 'An empty uterus on this scan does not establish a completed miscarriage. Without a demonstrated location or outcome, the classification remains pregnancy of unknown location.', consequence: 'The report would turn absence of a visible pregnancy into a more specific outcome than the available evidence supports.' },
          confirmed: { label: 'An ectopic pregnancy is confirmed because the uterus is empty', teaching: 'Ectopic pregnancy remains an important possibility, but neither location was demonstrated. Pregnancy of unknown location is not the same as a confirmed ectopic pregnancy.', consequence: 'A live concern would be relabeled as a confirmed location before the scan has shown it.' },
        },
      },
      s3: {
        question: 'Which finding adds concern for bleeding when interpreted with the worsening pain, rather than attempting to locate pregnancy from a single number?',
        narrative: 'The patient now has increasing pain. hCG is 1,800 IU/L. Transvaginal ultrasound identifies neither an intrauterine nor an extrauterine pregnancy and reports a moderate-to-large amount of complex free fluid, concerning for bleeding. Compare the combined clinical evidence with what one hCG value can establish.',
        choices: {
          spotting: { label: 'The single hCG value of 1,800 IU/L by itself establishes the pregnancy’s location', teaching: 'A single hCG value does not locate a pregnancy. The worsening symptoms and concerning fluid finding add information that cannot be replaced by a numerical threshold.', consequence: 'The numerical result would be given more diagnostic authority than it has, while the symptoms and fluid appearance are underweighted.' },
        },
      },
      s4: {
        question: 'Which response preserves the unresolved location and addresses the changing symptoms instead of waiting for biochemical certainty?',
        narrative: 'The patient now has increasing pain. hCG is 1,800 IU/L. Transvaginal ultrasound identifies neither an intrauterine nor an extrauterine pregnancy and reports a moderate-to-large amount of complex free fluid, concerning for bleeding. The handoff must carry the clinical change as well as the unresolved location.',
        choices: {
          b: { label: 'Wait for serial hCG to clarify the location before escalating the worsening pain', teaching: 'Serial hCG may inform follow-up, but it does not replace reassessment of worsening symptoms. Pregnancy location is unresolved while the current pain and possible bleeding justify the existing urgent review.', consequence: 'The team identifies that waiting for a biochemical answer would defer review of a clinical change already present in the record.' },
        },
      },
    },
  },
  'doc-001-scatter-sign': {
    counterfactual: 'Equating intrinsic T1 brightness with enhancement or a complete lesion count would let visual salience substitute for characterization across the available sequences.',
    sources: [
      source('NCI PDQ: Central Nervous System Tumors, diagnostic evaluation', 'https://www.cancer.gov/types/brain/hp/adult-brain-treatment-pdq', 'Clinical context and contrast MRI in assessment of suspected brain metastases; appearance alone does not establish a complete diagnosis or treatment plan.'),
      source('Prospective Comparison of T1-SPACE and MPRAGE for Intrinsic T1 Hyperintensity in Intracranial Melanoma Metastases', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10494940/', 'Primary study distinguishing intrinsic T1 signal from enhancement and relating signal to melanin or blood products. No MRI acquisition parameters or treatment rules are added.'),
      source('Sensitivity of different MRI sequences in the early detection of melanoma brain metastases', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5875773/', 'Primary comparison supporting deliberate sequence review rather than treating conspicuous intrinsic T1 foci as the complete lesion burden.'),
    ],
    stages: {
      s1: {
        question: 'Which leading explanation fits the clinical context and distribution without treating T1 brightness as complete characterization?',
        narrative: 'A patient previously staged with stage III melanoma has a focal seizure and multiple rounded T1-weighted hyperintense foci at the gray-white junction. Interpret the signal with the history and distribution; one vivid sequence does not establish every lesion’s composition or extent.',
        choices: {
          a: { consequence: 'Metastases become the leading concern in the fictional record, while the team keeps lesion composition and extent open for characterization.' },
          b: { label: 'Incidental mineralization is more likely than metastases despite the history and distribution', teaching: 'Minerals can affect T1 signal, so brightness alone is not specific. The melanoma history, focal seizure and distribution make metastases the leading concern requiring characterization.', consequence: 'An alternative signal source is elevated above the combined clinical context before the lesions have been characterized.' },
          migraine: { label: 'The recent seizure alone explains the rounded foci without a structural cause', teaching: 'A seizure is part of the presentation, not a sufficient explanation for these multiple rounded foci. The findings still require a structural differential and characterization.', consequence: 'The presenting event would be used as its own explanation while the rounded lesions remain unaccounted for.' },
        },
      },
      s2: {
        question: 'Which investigation addresses whether the conspicuous T1 foci are only part of the lesion burden?',
        narrative: 'The available description emphasizes T1-bright foci. It does not yet establish how intrinsic signal, enhancement and other sequence findings relate across the lesions. The next decision needs characterization rather than a count of the brightest spots.',
        choices: {
          delay: { label: 'Use the count of conspicuous T1-bright foci as the complete lesion map', teaching: 'A conspicuous subset on one sequence is not a complete characterization. Review across the MRI sequences is needed to relate signal, enhancement and extent.', consequence: 'The brightest foci would define the map before less conspicuous findings and sequence differences had been assessed.' },
        },
      },
      s3: {
        question: 'Which existing imaging plan can compare signal, susceptibility, diffusion and enhancement instead of making the brightest T1 foci stand for the whole study?',
        narrative: 'The lesions still need mapping for planning. Distinguish intrinsic signal from enhancement and compare the findings across sequences before treating the initial image as a complete account.',
        choices: {
          b: { label: 'Base the lesion map on the brightest T1 foci without comparing the other sequences', teaching: 'Intrinsic T1 signal and enhancement are different observations. The existing full MRI plan allows complementary findings to be compared rather than inferred from one sequence.', consequence: 'The limited description remains insufficient for a final map. The fictional radiology review continues while the complementary sequence findings are assembled.' },
        },
      },
      s4: {
        question: 'Which handoff preserves the need for full characterization instead of turning a vivid imaging clue into a finished plan?',
        narrative: 'Prepare the case summary for multidisciplinary discussion. Keep the leading concern distinct from what one sequence can establish, and carry the need for complete characterization into that discussion.',
        choices: {
          watch: { label: 'Choose the final plan from the initial T1-bright lesion count alone', teaching: 'The initial signal pattern does not settle the full lesion burden or the final plan. Characterization and multidisciplinary interpretation remain separate steps in the existing case pathway.', consequence: 'The handoff would present a limited lesion count as if it answered the broader planning questions.' },
        },
      },
    },
  },
  'doc-002-tearing-back': {
    counterfactual: 'Letting a small ST change erase the abrupt back-radiating pain and inter-arm pressure difference would leave the competing aortic concern unassessed rather than resolve it.',
    sources: [
      source('2022 ACC/AHA Guideline for the Diagnosis and Management of Aortic Disease', 'https://www.jacc.org/doi/10.1016/j.jacc.2022.08.004', 'Acute pain features, asymmetric limb pressure and diagnostic aortic imaging. Existing case-specific treatment labels and teaching are preserved; no new protocol, dose or eligibility rule is authored.'),
    ],
    stages: {
      s1: {
        question: 'Which working hypothesis best accounts for the pain pattern and arm-pressure difference together?',
        narrative: 'A hypertensive 61-year-old has maximal-at-onset tearing chest pain radiating to the back and a 36 mmHg inter-arm BP difference. The findings raise a concern to investigate; neither a pressure difference nor a pain description alone proves the cause.',
        choices: {
          b: { label: 'Set aside the pressure difference as a cuff artifact before confirming whether it persists', teaching: 'Measurement error is a possibility to check, not a reason to discard the finding in this pain context. The combination keeps an aortic cause in the working differential.', consequence: 'The pressure observation would be removed from the reasoning before its reproducibility was assessed.' },
          muscle: { label: 'A coronary explanation makes the arm-pressure difference irrelevant', teaching: 'A coronary possibility does not account for or cancel the high-risk aortic features in this record. The working explanation should address the combined findings.', consequence: 'One explanation would be allowed to erase a competing concern rather than account for the unresolved pressure difference.' },
        },
      },
      s2: {
        question: 'Which test addresses the unresolved aortic question that a small ST change cannot answer?',
        narrative: 'The cath lab is activating for a small ST change before the diagnosis is settled. The patient remains hypertensive without shock in this authored case. Distinguish an ECG observation from an investigation of the aortic anatomy.',
        choices: {
          ecg: { label: 'Use the small ST change as sufficient evidence to settle the cause of the entire presentation', teaching: 'The ECG finding does not resolve the competing concern raised by the abrupt pain and pressure difference. The existing case plan needs diagnostic aortic imaging rather than a single-clue conclusion.', consequence: 'The coronary clue would be asked to settle a separate anatomical question that it has not investigated.' },
        },
      },
      s3: {
        question: 'Which existing case-specific plan accounts for the unresolved aortic concern before committing to the coronary pathway?',
        narrative: 'The cath lab is activating for a small ST change before the diagnosis is settled. The patient remains hypertensive without shock; senior clinicians assess contraindications and perfusion. The choices refer to the already established fictional plan, not a general chest-pain protocol.',
        choices: {
          b: { label: 'Proceed directly to PCI', teaching: 'Committing to that pathway would treat the coronary clue as if it resolved the competing aortic concern. In this existing case, the high-risk aortic findings still require clarification before that commitment.', consequence: 'The team pauses the proposed coronary commitment and restates the unresolved pain and pressure findings for senior review.' },
        },
      },
      s4: {
        question: 'Which summary retains the existing case-specific boundary while the competing diagnosis is clarified?',
        narrative: 'The handoff must distinguish a suspected aortic process, an ECG change and the pending diagnostic clarification. Preserve the boundary already established in this case without claiming that one clue has confirmed the cause.',
        choices: {
          pci: { label: 'Hand over a confirmed coronary event on the basis of the ST change before aortic clarification', teaching: 'That summary would overstate what the ECG establishes and omit the competing aortic concern. The case-specific boundary remains tied to urgent diagnostic clarification, not certainty from a single clue.', consequence: 'The receiving clinician would inherit more diagnostic certainty than the available record supports.' },
        },
      },
    },
  },
};

// These describe the revised choice, rather than inferring a stable learner
// trait. Explicit coverage prevents a new decision inheriting an old error tag.
const errorPatterns = {
  'pub-001-dropped-pen': {
    s1: {
      hypoglycemia: ['unmeasured_cause', 'Unmeasured glucose assumed to establish the cause'],
      clumsy: ['fragmented_pattern', 'Simultaneous findings treated as unrelated'],
    },
    s2: { breakfast: ['timing_false_precision', 'Background timetable substituted for witnessed onset'] },
    s3: { aspirin: ['premature_treatment_inference', 'Symptoms treated as sufficient basis for a medication decision'] },
  },
  'pub-002-honey-jar': {
    s1: {
      fatigue: ['benign_anchoring', 'Progressive weakness attributed to ordinary tiredness'],
      feeding: ['single_symptom_explanation', 'Constipation treated as an explanation for the whole pattern'],
    },
    s2: { morning: ['exposure_severity_conflation', 'Exposure treated as a measure of current severity'] },
    s3: { b: ['uncertainty_delay', 'Assessment deferred while awaiting improvement after exposure removal'] },
  },
  'stu-001-mountain-acid': {
    s1: { b: ['single_metric_priority', 'Glucose reduction prioritized over the recorded reassessment sequence'] },
    s2: { arrival: ['measurement_substitution', 'Glucose trend substituted for potassium reassessment'] },
    s3: { b: ['premature_resolution', 'Glucose improvement treated as resolution of ketosis and acidosis'] },
    s4: { shortcut: ['overcertain_handoff', 'Metabolic resolution claimed without the remaining measurements'] },
  },
  'stu-002-saturday-pain': {
    s1: { b: ['probability_as_exclusion', 'IUD history treated as excluding pregnancy'] },
    s2: {
      routine: ['absence_as_confirmation', 'Empty uterus treated as proof of completed miscarriage'],
      confirmed: ['absence_as_confirmation', 'Unknown location treated as confirmed ectopic pregnancy'],
    },
    s3: { spotting: ['biomarker_location_overreach', 'Single hCG value treated as a pregnancy-location test'] },
    s4: { b: ['biomarker_over_clinical_change', 'Biochemical follow-up prioritized over worsening symptoms'] },
  },
  'doc-001-scatter-sign': {
    s1: {
      b: ['context_underweighting', 'Alternative signal source prioritized over the clinical pattern'],
      migraine: ['presentation_as_cause', 'Presenting seizure treated as the explanation for structural foci'],
    },
    s2: { delay: ['salience_as_completeness', 'Conspicuous T1 foci treated as the complete lesion burden'] },
    s3: { b: ['incomplete_characterization', 'Complementary sequence findings omitted from the lesion map'] },
    s4: { watch: ['limited_map_as_final_plan', 'Final planning inferred from a limited T1 lesion count'] },
  },
  'doc-002-tearing-back': {
    s1: {
      b: ['unverified_artifact_exclusion', 'Pressure difference discarded before checking reproducibility'],
      muscle: ['coronary_anchoring', 'Coronary explanation used to dismiss the pressure difference'],
    },
    s2: { ecg: ['single_clue_overreach', 'ECG change treated as settling the whole presentation'] },
    s3: { b: ['premature_pathway_commitment', 'Coronary pathway chosen before the aortic concern was clarified'] },
    s4: { pci: ['overcertain_handoff', 'Coronary cause handed over as confirmed before clarification'] },
  },
};

function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function synchronizeCompletion(spec, revision) {
  const byStage = new Map(spec.stages.map((stage) => [stage.view.stage_id, stage]));
  for (const rows of [spec.completion.stage_autopsy, spec.completion.reasoning_autopsy?.stages]) {
    for (const row of rows || []) {
      const stage = byStage.get(row.stage_id);
      const correct = stage?.choices.find((choice) => choice.result.correct);
      if (!stage || !correct) throw new Error('Unknown authored completion stage');
      row.question = stage.view.question;
      row.expert_choice = correct.label;
      row.review_variant_id = stage.review_variant_id;
    }
  }
  for (const autopsy of [spec.completion.clinical_autopsy, spec.completion.reasoning_autopsy, spec.completion.visual_autopsy]) {
    if (autopsy) autopsy.counterfactual = revision.counterfactual;
  }
  for (const row of spec.completion.path_debrief?.learner_path || []) {
    const stage = byStage.get(row.stage_id);
    const correct = stage?.choices.find((choice) => choice.result.correct);
    if (correct && row.correct === true) {
      row.choice = correct.label;
      row.consequence = correct.result.consequence || '';
    }
  }
}

function buildCurrentEdition() {
  const cases = JSON.parse(JSON.stringify(originalBundle.cases));
  for (const spec of cases) {
    const revision = revisions[spec.case_id];
    if (!revision || spec.stages.length !== Object.keys(revision.stages).length) throw new Error('Incomplete revised story edition');
    for (const stage of spec.stages) {
      const patch = revision.stages[stage.view.stage_id];
      if (!patch) throw new Error('Missing revised decision');
      stage.view.question = patch.question;
      stage.view.narrative = patch.narrative;
      stage.review_variant_id = stage.review_variant_id.replace(/-v1$/, '-v2');
      for (const [id, change] of Object.entries(patch.choices)) {
        const choice = stage.choices.find((item) => item.id === id);
        if (!choice) throw new Error('Unknown revised option');
        if (choice.result.correct && (change.label || change.teaching)) throw new Error('Correct labels and clinical teaching are immutable in this edition');
        if (change.label) choice.label = change.label;
        if (change.teaching) choice.result.teaching = change.teaching;
        if (change.consequence) choice.result.consequence = change.consequence;
      }
      for (const choice of stage.choices.filter((item) => !item.result.correct)) {
        const pattern = errorPatterns[spec.case_id]?.[stage.view.stage_id]?.[choice.id];
        if (!Array.isArray(pattern) || pattern.length !== 2 || pattern.some((value) => typeof value !== 'string' || !value)) {
          throw new Error('Missing revised misconception metadata');
        }
        [choice.result.error_mode, choice.result.error_mode_label] = pattern;
      }
      for (const option of stage.view.options) {
        const choice = stage.choices.find((item) => item.id === option.id);
        if (!choice) throw new Error('Unknown displayed option');
        option.label = choice.label;
      }
    }
    spec.completion.sources = revision.sources;
    synchronizeCompletion(spec, revision);
  }
  return freeze({ schema: 1, build_id: REVISED_BUILD_ID, content_version: STORY_CONTENT_VERSION,
    edition_label: STORY_EDITION_LABEL, cases });
}

export const STORY_DECISIONS_BUNDLE = buildCurrentEdition();
export default STORY_DECISIONS_BUNDLE;
