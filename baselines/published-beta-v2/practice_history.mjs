import {
  TRANSFER_PRACTICE_SCHEMA_VERSION,
  TRANSFER_PRACTICE_PACKS,
  supportsPractice,
  createPracticeState,
  answerPractice,
  nextPractice,
  practiceTally,
} from './transfer_practice.mjs';

export const PRACTICE_HISTORY_KEY = 'mmPracticeHistory';

const HISTORY_SCHEMA_VERSION = 1;
const MAX_HISTORY_BYTES = 64 * 1024;

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const storageOrDefault = (storage) => storage === undefined ? globalThis.localStorage : storage;

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function packSignature(pack) {
  return canonicalJson(pack);
}

function exactKeys(value, keys) {
  return isRecord(value) && Object.keys(value).length === keys.length && keys.every((key) => hasOwn(value, key));
}

function validPermutation(values, expected) {
  return Array.isArray(values)
    && values.length === expected.length
    && values.every((value, index) => typeof value === 'string' && expected.includes(value) && !values.slice(0, index).includes(value));
}

function validateProgression(record, pack) {
  if (!Number.isInteger(record.questionIndex) || record.questionIndex < 0 || record.questionIndex >= pack.questions.length) return false;
  if (typeof record.completed !== 'boolean') return false;
  if (!Array.isArray(record.answers) || record.answers.length !== pack.questions.length) return false;
  if (!Array.isArray(record.order) || record.order.length !== pack.questions.length) return false;

  for (let index = 0; index < pack.questions.length; index += 1) {
    const question = pack.questions[index];
    if (!validPermutation(record.order[index], question.choices.map((choice) => choice.id))) return false;
    const answer = record.answers[index];
    if (answer !== null && (!question.choices.some((choice) => choice.id === answer) || typeof answer !== 'string')) return false;
    if (index < record.questionIndex && answer === null) return false;
    if (index > record.questionIndex && answer !== null) return false;
  }
  const complete = record.questionIndex === pack.questions.length - 1 && record.answers.every((answer) => answer !== null);
  return record.completed ? complete : true;
}

function stateRecord(state) {
  if (!isRecord(state) || state.schemaVersion !== TRANSFER_PRACTICE_SCHEMA_VERSION || !supportsPractice(state.caseId)) return null;
  const pack = TRANSFER_PRACTICE_PACKS[state.caseId];
  if (!Array.isArray(state.questions) || state.questions.length !== pack.questions.length) return null;

  const answers = [];
  const order = [];
  for (let index = 0; index < pack.questions.length; index += 1) {
    const question = state.questions[index];
    const expected = pack.questions[index];
    if (!isRecord(question) || question.id !== expected.id || !validPermutation(question.choices?.map((choice) => choice?.id), expected.choices.map((choice) => choice.id))) return null;
    if (question.answer !== null && (typeof question.answer !== 'string' || !expected.choices.some((choice) => choice.id === question.answer))) return null;
    answers.push(question.answer ?? null);
    order.push(question.choices.map((choice) => choice.id));
  }

  const record = {
    packSignature: packSignature(pack),
    order,
    answers,
    questionIndex: state.questionIndex,
    completed: state.completed,
  };
  return validateProgression(record, pack) ? record : null;
}

function readHistory(storage) {
  const raw = storage.getItem(PRACTICE_HISTORY_KEY);
  if (raw === null) return { cases: {} };
  if (typeof raw !== 'string' || raw.length > MAX_HISTORY_BYTES) return null;
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!exactKeys(parsed, ['schemaVersion', 'cases']) || parsed.schemaVersion !== HISTORY_SCHEMA_VERSION || !isRecord(parsed.cases)) return null;
  return parsed;
}

function validStoredRecord(caseId, value) {
  if (!supportsPractice(caseId) || !exactKeys(value, ['packSignature', 'order', 'answers', 'questionIndex', 'completed'])) return null;
  const pack = TRANSFER_PRACTICE_PACKS[caseId];
  if (value.packSignature !== packSignature(pack) || !validateProgression(value, pack)) return null;
  return value;
}

function restoreRecord(caseId, record) {
  const pack = TRANSFER_PRACTICE_PACKS[caseId];
  if (!validStoredRecord(caseId, record)) return null;
  let state = createPracticeState(caseId, () => 0);
  const questions = state.questions.map((question, index) => Object.freeze({
    ...question,
    choices: Object.freeze(record.order[index].map((choiceId) => question.choices.find((choice) => choice.id === choiceId))),
  }));
  state = Object.freeze({ ...state, questions: Object.freeze(questions) });

  for (let index = 0; index < record.questionIndex; index += 1) {
    state = answerPractice(state, record.answers[index]);
    state = nextPractice(state);
  }
  if (record.answers[record.questionIndex] !== null) {
    state = answerPractice(state, record.answers[record.questionIndex]);
    if (record.completed) state = nextPractice(state);
  }
  return state.completed === record.completed && state.questionIndex === record.questionIndex
    && state.questions.every((question, index) => question.answer === record.answers[index])
    ? state
    : null;
}

export function savePractice(state, storage) {
  try {
    const target = stateRecord(state);
    if (!target) return false;
    const store = storageOrDefault(storage);
    const history = readHistory(store);
    if (history === null) return false;
    const cases = {};
    for (const caseId of Object.keys(history.cases)) {
      if (!supportsPractice(caseId)) continue;
      const record = validStoredRecord(caseId, history.cases[caseId]);
      if (record) cases[caseId] = record;
    }
    cases[state.caseId] = target;
    const serialized = JSON.stringify({ schemaVersion: HISTORY_SCHEMA_VERSION, cases });
    if (serialized.length > MAX_HISTORY_BYTES) return false;
    store.setItem(PRACTICE_HISTORY_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

export function loadPractice(caseId, storage) {
  if (!supportsPractice(caseId)) return null;
  try {
    const store = storageOrDefault(storage);
    const history = readHistory(store);
    if (history === null) return null;
    return restoreRecord(caseId, history.cases[caseId]);
  } catch {
    return null;
  }
}

export function practiceSummary(caseId, storage) {
  const state = loadPractice(caseId, storage);
  if (!state) return null;
  return {
    answered: state.questions.filter((question) => question.answer !== null).length,
    total: state.questions.length,
    correct: practiceTally(state),
    completed: state.completed,
  };
}

export function clearPracticeHistory(storage) {
  try {
    storageOrDefault(storage).removeItem(PRACTICE_HISTORY_KEY);
    return true;
  } catch {
    return false;
  }
}
