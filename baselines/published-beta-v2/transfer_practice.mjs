export const TRANSFER_PRACTICE_SCHEMA_VERSION = 1;
export const TRANSFER_PRACTICE_CASE_ID = 'pub-001-dropped-pen';
export const TRANSFER_PRACTICE_SOURCE = Object.freeze({ title: 'CDC Signs and Symptoms of Stroke', url: 'https://www.cdc.gov/stroke/signs-symptoms/index.html', published: '2026-05-19', checked: '2026-09-06', sections: Object.freeze(['What are the signs of stroke in men and women?', 'When to seek emergency help']) });
export const TRANSFER_PRACTICE_MOUNTAIN_ACID_CASE_ID = 'stu-001-mountain-acid';
export const TRANSFER_PRACTICE_MOUNTAIN_ACID_SOURCE = Object.freeze({ title: 'Hyperglycaemic crises in adults with diabetes: a consensus report', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11343900/', published: '2024-06-22', checked: '2026-09-06', sections: Object.freeze(['Section 3 Diagnostic criteria for DKA', 'Figure 2', 'Ketone assessment']) });

const freezeQuestion = (q) => Object.freeze({ ...q, choices: Object.freeze(q.choices.map((choice) => Object.freeze(choice))) });
const stroke = [
  { id: 'practice-stroke-pattern-001', concept: 'stroke-pattern', narrative: 'This fictional scenario takes place at a book club: Maya suddenly struggles to speak and one arm feels weak.', question: 'Which possibility needs urgent attention?', correct: 'possible-stroke', choices: [{ id: 'possible-stroke', label: 'Possible stroke', rationale: 'Sudden speech difficulty and one-sided weakness are stroke warning signs; this does not establish a diagnosis.' }, { id: 'ordinary-tiredness', label: 'Ordinary tiredness', rationale: 'The sudden focal changes do not fit ordinary tiredness.' }, { id: 'distraction', label: 'Distraction', rationale: 'The sudden speech and one-sided changes need a more serious possibility considered.' }], feedback: 'Sudden speech difficulty and one-sided weakness are stroke warning signs; this does not establish a diagnosis.' },
  { id: 'practice-stroke-handoff-001', concept: 'stroke-handoff', narrative: 'This fictional scenario takes place during a video call: Lee develops sudden speech difficulty at 14:20. Emergency help has already been called.', question: 'Which time belongs in the handoff?', correct: 'symptom-onset-1420', choices: [{ id: 'symptom-onset-1420', label: '14:20, when symptoms began', rationale: 'The time symptoms first appeared is the relevant handoff detail.' }, { id: 'call-ended', label: 'Time the call ended', rationale: 'Call duration does not identify when symptoms began.' }, { id: 'help-arrives', label: 'Time help arrives', rationale: 'Arrival time is later than symptom onset.' }], feedback: 'Record when symptoms first appeared.' },
  { id: 'practice-stroke-escalation-001', concept: 'stroke-escalation', narrative: 'This fictional scenario takes place at a community meeting: Jordan suddenly has an uneven smile and slurred speech.', question: 'What is the safest next action in this US-based scenario?', correct: 'call-911-ambulance', choices: [{ id: 'call-911-ambulance', label: 'Call 911 for an ambulance', rationale: 'Prompt emergency help is the safest response to these warning signs.' }, { id: 'drive-hospital', label: 'Drive Jordan to hospital', rationale: 'Driving is not the safest response when emergency help is needed.' }, { id: 'wait-passes', label: 'Wait to see whether it passes', rationale: 'Waiting could delay attention to sudden warning signs.' }], feedback: 'Call emergency services promptly for stroke warning signs rather than driving or waiting.' },
];
const mountainAcid = [
  { id: 'practice-dka-pattern-001', concept: 'dka-pattern', narrative: 'Fictional adult with diabetes: glucose 310 mg/dL, blood beta-hydroxybutyrate 4.2 mmol/L, venous pH 7.24.', question: 'Which pattern fits best?', correct: 'dka', choices: [{ id: 'dka', label: 'DKA', rationale: 'All three DKA components are present.' }, { id: 'hyperglycemia-no-ketoacidosis', label: 'Hyperglycemia without ketoacidosis', rationale: 'This overlooks the ketones and acidosis.' }, { id: 'hhs-no-ketoacidosis', label: 'HHS without ketoacidosis', rationale: 'These findings contradict HHS without ketoacidosis.' }], feedback: 'Ketosis and acidosis matter alongside glucose.' },
  { id: 'practice-dka-low-glucose-001', concept: 'dka-low-glucose', narrative: 'Fictional adult with diabetes: glucose 175 mg/dL, blood beta-hydroxybutyrate 4.0 mmol/L, venous pH 7.22.', question: 'Which conclusion is best supported?', correct: 'dka-supported', choices: [{ id: 'dka-supported', label: 'DKA remains supported', rationale: 'Diabetes, ketosis and acidosis occur together.' }, { id: 'low-glucose-excludes-dka', label: 'Glucose below 200 excludes DKA', rationale: 'Lower glucose does not exclude DKA.' }, { id: 'ketones-alone-dka', label: 'Ketones alone establish DKA', rationale: 'Acidosis and diabetes context are also required.' }], feedback: 'Known diabetes can satisfy the diabetes component despite lower glucose.' },
  { id: 'practice-dka-evidence-001', concept: 'dka-evidence', narrative: 'Fictional adult with diabetes and vomiting: glucose 280 mg/dL; acid-base and ketone results are unavailable.', question: 'Which evidence best addresses the missing DKA components?', correct: 'beta-hydroxybutyrate-and-ph', choices: [{ id: 'beta-hydroxybutyrate-and-ph', label: 'Blood beta-hydroxybutyrate and venous pH', rationale: 'These address both missing components.' }, { id: 'repeat-glucose', label: 'Repeat glucose alone', rationale: 'Glucose alone cannot establish the other components.' }, { id: 'urine-glucose', label: 'Urine glucose alone', rationale: 'Glucosuria does not establish ketosis or acidosis.' }], feedback: 'Assess ketosis and acidosis directly.' },
];
const sources = { stroke: TRANSFER_PRACTICE_SOURCE, mountain: TRANSFER_PRACTICE_MOUNTAIN_ACID_SOURCE };
const pack = (caseId, title, source, questions) => Object.freeze({ caseId, title, source, questions: Object.freeze(questions.map((q) => freezeQuestion({ ...q, source }))) });
export const TRANSFER_PRACTICE_PACKS = Object.freeze({
  [TRANSFER_PRACTICE_CASE_ID]: pack(TRANSFER_PRACTICE_CASE_ID, 'Stroke reasoning', sources.stroke, stroke),
  [TRANSFER_PRACTICE_MOUNTAIN_ACID_CASE_ID]: pack(TRANSFER_PRACTICE_MOUNTAIN_ACID_CASE_ID, 'Student reasoning', sources.mountain, mountainAcid),
});
export const TRANSFER_PRACTICE_QUESTIONS = TRANSFER_PRACTICE_PACKS[TRANSFER_PRACTICE_CASE_ID].questions;
export function supportsPractice(caseId) { return Object.prototype.hasOwnProperty.call(TRANSFER_PRACTICE_PACKS, caseId); }

const fail = (message) => { throw new TypeError(message); };
function getPack(caseId) { return supportsPractice(caseId) ? TRANSFER_PRACTICE_PACKS[caseId] : fail('unsupported transfer practice case'); }
function validateInput(state) {
  if (!state || state.schemaVersion !== TRANSFER_PRACTICE_SCHEMA_VERSION) fail('unsupported transfer practice schema');
  const practicePack = getPack(state.caseId);
  if (!Array.isArray(state.questions) || state.questions.length !== practicePack.questions.length) fail('invalid transfer practice questions');
  if (!Number.isInteger(state.questionIndex) || state.questionIndex < 0 || state.questionIndex >= practicePack.questions.length) fail('invalid transfer practice question index');
  if (typeof state.completed !== 'boolean') fail('invalid transfer practice completion');
  state.questions.forEach((question, index) => {
    const expected = practicePack.questions[index];
    if (!question || question.id !== expected.id || !Array.isArray(question.choices)) fail('invalid transfer practice question');
    if (question.choices.length !== expected.choices.length || question.choices.some((choice) => !expected.choices.some((item) => item.id === choice?.id))) fail('invalid transfer practice choices');
    if (question.answer !== null && !question.choices.some((choice) => choice.id === question.answer)) fail('invalid transfer practice answer');
  });
  const complete = state.questionIndex === practicePack.questions.length - 1 && state.questions.every((question) => question.answer !== null);
  if (state.completed && !complete) fail('invalid transfer practice completion state');
  return practicePack;
}
function shuffledChoices(choices, random) {
  const output = choices.slice();
  for (let index = output.length - 1; index > 0; index -= 1) { const value = Number(random()); const j = Number.isFinite(value) && value >= 0 && value < 1 ? Math.floor(value * (index + 1)) : 0; [output[index], output[j]] = [output[j], output[index]]; }
  return output;
}
export function createPracticeState(caseId = TRANSFER_PRACTICE_CASE_ID, random = Math.random) {
  const practicePack = getPack(caseId);
  const questions = practicePack.questions.map((question) => Object.freeze({ ...question, choices: Object.freeze(shuffledChoices(question.choices, random)), answer: null }));
  return Object.freeze({ schemaVersion: TRANSFER_PRACTICE_SCHEMA_VERSION, caseId, questionIndex: 0, questions: Object.freeze(questions), completed: false });
}
export function answerPractice(state, choiceId) {
  validateInput(state);
  if (state.completed) fail('practice is complete or invalid');
  const current = state.questions[state.questionIndex];
  if (!current.choices.some((choice) => choice.id === choiceId)) fail('invalid answer choice');
  if (current.answer !== null) return state;
  const questions = state.questions.slice(); questions[state.questionIndex] = Object.freeze({ ...current, answer: choiceId });
  return Object.freeze({ ...state, questions: Object.freeze(questions) });
}
export function nextPractice(state) {
  validateInput(state); const current = state.questions[state.questionIndex];
  if (current.answer === null) fail('answer required before next question');
  if (state.questionIndex >= state.questions.length - 1) return Object.freeze({ ...state, completed: true });
  return Object.freeze({ ...state, questionIndex: state.questionIndex + 1 });
}
export function practiceTally(state) { validateInput(state); return state.questions.reduce((sum, question) => sum + (question.answer === question.correct ? 1 : 0), 0); }
