import { getLegacyTransferQuestion } from './investigation_content_versions.mjs';
import { getInvestigationEpisode } from './investigation.mjs';
const questions = {
  'doc-002-tearing-back-investigation': {
    id: 'aortic-image-quality-contrast', version: 1,
    prompt: 'A different fictional patient has sudden severe chest pain. The CTA report says motion obscures the ascending aorta and calls that segment nondiagnostic. No definite flap is reported. Which conclusion best respects this evidence?',
    choices: [
      { id: 'excluded', label: 'The absence of a reported flap excludes an aortic process.', feedback: 'A nondiagnostic segment is not a reliable negative finding. The report explicitly limits what can be concluded.' },
      { id: 'unresolved', label: 'The aortic question remains unresolved; the team needs to clarify the inadequate study.', feedback: 'The limitation matters. Image acquisition and motion affect diagnostic confidence, so an inadequate segment cannot carry an exclusion claim.' },
      { id: 'confirmed', label: 'The symptom pattern alone confirms dissection despite the report.', feedback: 'The symptoms justify concern, not certainty. The fictional report has not established the diagnosis.' },
    ],
    answerId: 'unresolved',
    source: { title: '2022 ACC/AHA Aortic Disease Guideline: CT image quality', url: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000001106' },
  },
  'pub-003-missed-turn-investigation': {
    id: 'resolved-symptoms-contrast', version: 1,
    prompt: 'In another fictional story, sudden trouble speaking and one-sided weakness disappear after ten minutes. Emergency help has already been called. What changes about the concern?',
    choices: [
      { id: 'resolved-safe', label: 'Because the symptoms stopped, urgent assessment is no longer needed.', feedback: 'Improvement does not remove the concern. Brief neurological symptoms can still represent an important warning event.' },
      { id: 'confirmed-stroke', label: 'The duration proves that a completed stroke occurred.', feedback: 'Duration alone cannot establish the cause. The team still needs to assess what happened.' },
      { id: 'still-urgent', label: 'The cause remains uncertain, and urgent professional assessment still matters.', feedback: 'The uncertainty and urgency coexist. NICE calls for immediate referral for suspected TIA, with specialist assessment within 24 hours of onset.' },
    ],
    answerId: 'still-urgent',
    source: { title: 'NICE NG128: suspected TIA, recommendation 1.1.5', url: 'https://www.nice.org.uk/guidance/ng128/chapter/recommendations' },
  },
  'stu-003-after-weekend-investigation': {
    id: 'hyperosmolar-pattern-contrast', version: 1,
    prompt: 'A different fictional patient has dehydration, glucose 720 mg/dL, measured total osmolality 334 mOsm/kg, beta-hydroxybutyrate 0.8 mmol/L, venous pH 7.36 and bicarbonate 23 mmol/L. Which explanation fits this laboratory pattern better?',
    choices: [
      { id: 'dka', label: 'Ketoacidosis, because any very high glucose is sufficient.', feedback: 'High glucose alone does not establish ketoacidosis. The marked ketosis and acidosis from the earlier case are absent here.' },
      { id: 'hhs', label: 'A hyperosmolar hyperglycemic state rather than the earlier ketoacidotic pattern.', feedback: 'This authored pattern combines severe hyperglycemia and hyperosmolality without significant ketosis or acidosis. It contrasts with the three-part ketoacidosis pattern.' },
      { id: 'normal', label: 'No major metabolic problem, because the pH is not low.', feedback: 'A near-normal pH does not make severe hyperglycemia and hyperosmolality harmless. The full pattern matters.' },
    ],
    answerId: 'hhs',
    source: { title: 'Hyperglycemic Crises in Adults With Diabetes: 2024 consensus report', url: 'https://doi.org/10.2337/dci24-0032' },
  },
};

for (const question of Object.values(questions)) {
  question.synthetic = true;
  question.reviewStatus = 'pending_human_review';
  question.sourceCheckedDate = '2026-09-11';
  question.choices.forEach(Object.freeze);
  Object.freeze(question.choices);
  Object.freeze(question.source);
  Object.freeze(question);
}
Object.freeze(questions);

export function getTransferQuestion(episodeId, contentVersion) {
  if (contentVersion !== undefined) {
    // Historical questions remain attached to their immutable saved episode.
    const legacy = getLegacyTransferQuestion(episodeId, contentVersion);
    if (legacy) return legacy;
    const current = getInvestigationEpisode(episodeId);
    if (!current || current.version !== contentVersion) return null;
  }
  const episode = getInvestigationEpisode(episodeId, contentVersion);
  if (episode?.version >= 4) return episode.transferQuestion ?? null;
  return Object.hasOwn(questions, episodeId) ? questions[episodeId] : null;
}
