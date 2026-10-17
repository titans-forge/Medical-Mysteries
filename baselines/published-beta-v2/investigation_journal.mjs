import { getInvestigationEpisode, restoreInvestigation } from './investigation.mjs';
import { getTransferQuestion } from './investigation_transfer.mjs';

const JOURNAL_KEY = 'mmInvestigationJournal:v1';
const MAX_RECORDS = 20;
const MAX_BYTES = 512 * 1024;
const REFLECTION_KEYS = ['confidence', 'keyActionId'];
const RECORD_KEYS = ['episodeContent', 'completedUtc', 'state', 'reflection', 'transfer'];
const reflectionKey = (episodeId) => `mmInvestigationReflection:v1:${episodeId}`;
const emptyReflection = () => ({ confidence: null, keyActionId: null });

function hasExactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

function storageOrDefault(storage) {
  return storage === undefined ? globalThis.localStorage : storage;
}

function withinSize(text) {
  return typeof text === 'string' && text.length <= MAX_BYTES
    && new TextEncoder().encode(text).length <= MAX_BYTES;
}

function canonicalState(raw) {
  const state = restoreInvestigation(raw);
  if (!state) return null;
  // Restore copies conclusion keys in caller order; identities need stable order.
  if (state.conclusion) {
    const { hypothesisId, correct, evidenceComplete } = state.conclusion;
    state.conclusion = { hypothesisId, correct, evidenceComplete };
  }
  return state;
}

function canonicalReflection(raw, state) {
  if (!hasExactKeys(raw, REFLECTION_KEYS)
    || !(raw.confidence === null
      || (Number.isInteger(raw.confidence) && raw.confidence >= 0 && raw.confidence <= 100))
    || !(raw.keyActionId === null
      || (typeof raw.keyActionId === 'string' && state.actionIds.includes(raw.keyActionId)))) {
    return null;
  }
  return { confidence: raw.confidence, keyActionId: raw.keyActionId };
}

function episodeContent(state) {
  return JSON.stringify(getInvestigationEpisode(state.episodeId));
}

function validTimestamp(value) {
  if (typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const timestamp = new Date(value);
  return Number.isFinite(timestamp.getTime()) && timestamp.toISOString() === value;
}

function canonicalTransfer(raw, state) {
  if (!hasExactKeys(raw, ['questionContent', 'answerId'])) return null;
  const question = getTransferQuestion(state.episodeId);
  if (!question || raw.questionContent !== JSON.stringify(question)
    || typeof raw.answerId !== 'string'
    || !question.choices.some((choice) => choice.id === raw.answerId)) return null;
  return { questionContent: JSON.stringify(question), answerId: raw.answerId };
}

function canonicalRecord(raw) {
  if (!hasExactKeys(raw, RECORD_KEYS) || !validTimestamp(raw.completedUtc)) return null;
  const state = canonicalState(raw.state);
  if (!state?.completed || raw.episodeContent !== episodeContent(state)) return null;
  const reflection = canonicalReflection(raw.reflection, state);
  if (!reflection) return null;
  const transfer = raw.transfer === null ? null : canonicalTransfer(raw.transfer, state);
  if (raw.transfer !== null && !transfer) return null;
  return {
    episodeContent: episodeContent(state),
    completedUtc: raw.completedUtc,
    state,
    reflection,
    transfer,
  };
}

export function loadReflection(state, storage) {
  try {
    const canonical = canonicalState(state);
    if (!canonical) return emptyReflection();
    const text = storageOrDefault(storage).getItem(reflectionKey(canonical.episodeId));
    if (!withinSize(text)) return emptyReflection();
    const raw = JSON.parse(text);
    if (!hasExactKeys(raw, ['schema', 'episodeContent', 'state', 'reflection'])
      || raw.schema !== 1 || raw.episodeContent !== episodeContent(canonical)) {
      return emptyReflection();
    }
    const savedState = canonicalState(raw.state);
    if (!savedState || JSON.stringify(savedState) !== JSON.stringify(canonical)) {
      return emptyReflection();
    }
    return canonicalReflection(raw.reflection, canonical) ?? emptyReflection();
  } catch {
    return emptyReflection();
  }
}

export function saveReflection(state, reflection, storage) {
  try {
    const canonical = canonicalState(state);
    if (!canonical) return false;
    const savedReflection = canonicalReflection(reflection, canonical);
    if (!savedReflection) return false;
    const text = JSON.stringify({
      schema: 1,
      episodeContent: episodeContent(canonical),
      state: canonical,
      reflection: savedReflection,
    });
    if (!withinSize(text)) return false;
    storageOrDefault(storage).setItem(reflectionKey(canonical.episodeId), text);
    return true;
  } catch {
    return false;
  }
}

export function readJournal(storage) {
  let text;
  try {
    text = storageOrDefault(storage).getItem(JOURNAL_KEY);
  } catch {
    return { status: 'unavailable', records: [] };
  }
  if (text === null) return { status: 'empty', records: [] };
  try {
    if (!withinSize(text)) return { status: 'invalid', records: [] };
    const raw = JSON.parse(text);
    if (!hasExactKeys(raw, ['schema', 'records']) || raw.schema !== 1
      || !Array.isArray(raw.records) || raw.records.length > MAX_RECORDS) {
      return { status: 'invalid', records: [] };
    }
    const records = [];
    const identities = new Set();
    for (const value of raw.records) {
      const record = canonicalRecord(value);
      if (!record) return { status: 'invalid', records: [] };
      const identity = JSON.stringify(record.state);
      if (identities.has(identity)) return { status: 'invalid', records: [] };
      identities.add(identity);
      records.push(record);
    }
    return { status: records.length ? 'ok' : 'empty', records };
  } catch {
    return { status: 'invalid', records: [] };
  }
}

function writeJournal(records, storage) {
  const text = JSON.stringify({ schema: 1, records });
  if (!withinSize(text)) return false;
  storage.setItem(JOURNAL_KEY, text);
  return true;
}

// Browser-local learning records, not trusted validation or an attempt counter.
export function recordCompleted(state, reflection, storage) {
  try {
    const canonical = canonicalState(state);
    if (!canonical?.completed) return false;
    const savedReflection = canonicalReflection(reflection, canonical);
    if (!savedReflection) return false;
    const target = storageOrDefault(storage);
    const journal = readJournal(target);
    if (journal.status === 'invalid' || journal.status === 'unavailable') return false;
    const identity = JSON.stringify(canonical);
    if (journal.records.some((record) => JSON.stringify(record.state) === identity)) return true;
    const record = {
      episodeContent: episodeContent(canonical),
      completedUtc: new Date().toISOString(),
      state: canonical,
      reflection: savedReflection,
      transfer: null,
    };
    return writeJournal([record, ...journal.records].slice(0, MAX_RECORDS), target);
  } catch {
    return false;
  }
}

export function answerTransfer(state, answerId, storage) {
  try {
    const canonical = canonicalState(state);
    if (!canonical?.completed || typeof answerId !== 'string') return null;
    const question = getTransferQuestion(canonical.episodeId);
    if (!question || !question.choices.some((choice) => choice.id === answerId)) return null;
    const target = storageOrDefault(storage);
    const journal = readJournal(target);
    if (journal.status !== 'ok') return null;
    const identity = JSON.stringify(canonical);
    const index = journal.records.findIndex((record) => JSON.stringify(record.state) === identity);
    if (index < 0) return null;
    const record = journal.records[index];
    if (record.transfer !== null) return record;
    const answered = {
      ...record,
      transfer: { questionContent: JSON.stringify(question), answerId },
    };
    journal.records[index] = answered;
    return writeJournal(journal.records, target) ? answered : null;
  } catch {
    return null;
  }
}

export function clearJournal(storage) {
  try {
    storageOrDefault(storage).removeItem(JOURNAL_KEY);
    return true;
  } catch {
    return false;
  }
}
