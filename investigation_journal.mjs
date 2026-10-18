import { getInvestigationEpisode, restoreInvestigation } from './investigation.mjs';
import { getTransferQuestion } from './investigation_transfer.mjs';
import { matchesBundledContent } from './investigation_content_versions.mjs';
import { reasoningChoices } from './investigation_reasoning.mjs';

const JOURNAL_KEY = 'mmInvestigationJournal:v1';
const SCHEMA = 2;
const RECOVERY_PREFIX = 'mmInvestigationJournal:preserved:v1:';
const MAX_RECORDS = 20;
const V6_MAX_RECORDS = 30;
const MAX_BYTES = 512 * 1024;
// Only independently validated completed content-v5/v6 records receive room
// for the larger authored definitions. Reflection limits and legacy-only stores
// retain their existing bound. Valid v6 routes allow 30 entries without eviction.
const V5_JOURNAL_MAX_BYTES = 1024 * 1024;
const RECOVERY_MAX_BYTES = 4 * V5_JOURNAL_MAX_BYTES;
const RECORD_KEYS = ['episodeContent', 'completedUtc', 'state', 'reflection', 'transfer'];
const reflectionKey = (episodeId, version) => `mmInvestigationReflection:v2:${episodeId}:${version}`;
const oldReflectionKey = (episodeId) => `mmInvestigationReflection:v1:${episodeId}`;
const emptyReflection = () => ({ confidence: null, keyActionId: null, uncertaintyId: null });

function hasExactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

function storageOrDefault(storage) {
  return storage === undefined ? globalThis.localStorage : storage;
}

function withinSize(text, maxBytes = MAX_BYTES) {
  return typeof text === 'string' && text.length <= maxBytes
    && (typeof TextEncoder === 'undefined' || new TextEncoder().encode(text).length <= maxBytes);
}

// Call only after record validation; a claimed or damaged row grants no room.
function withinJournalSize(text, validRecords) {
  const maxBytes = validRecords.some((record) => (record.state.version === 5 || record.state.version === 6))
    ? V5_JOURNAL_MAX_BYTES : MAX_BYTES;
  return withinSize(text, maxBytes);
}

function canonicalState(raw) {
  const state = restoreInvestigation(raw);
  if (!state) return null;
  // Stable ordering makes identical routes dedupe even if stored keys were reordered.
  if (state.conclusion) {
    const { hypothesisId, correct, evidenceComplete } = state.conclusion;
    state.conclusion = { hypothesisId, correct, evidenceComplete };
  }
  return state;
}

function canonicalReflection(raw, state) {
  const old = hasExactKeys(raw, ['confidence', 'keyActionId']);
  if (!old && !hasExactKeys(raw, ['confidence', 'keyActionId', 'uncertaintyId'])) return null;
  const episode = getInvestigationEpisode(state.episodeId, state.version);
  if (!episode) return null;
  const supportIds = reasoningChoices(state).supports.map((fact) => fact.id);
  const uncertaintyId = old ? null : raw.uncertaintyId;
  if (!(raw.confidence === null || (Number.isInteger(raw.confidence) && raw.confidence >= 0 && raw.confidence <= 100))
    || !(raw.keyActionId === null || (typeof raw.keyActionId === 'string' && supportIds.includes(raw.keyActionId)))
    || !(uncertaintyId === null || (typeof uncertaintyId === 'string'
      && (episode.reasoning?.uncertaintyOptions ?? []).some((option) => option.id === uncertaintyId
        && (option.requires ?? []).every((id) => state.actionIds.includes(id)))))) return null;
  return { confidence: raw.confidence, keyActionId: raw.keyActionId, uncertaintyId };
}

function episodeFor(state) {
  return getInvestigationEpisode(state.episodeId, state.version);
}

function identityFor(state, reflection) {
  return episodeFor(state)?.reasoning
    ? JSON.stringify({ state, reflection })
    : JSON.stringify(state);
}

// Assessed reflections represent distinct reasoning attempts even when the action route matches.
export function journalRecordIdentity(state, reflection) {
  const canonical = canonicalState(state);
  if (!canonical) return null;
  if (!episodeFor(canonical)?.reasoning) return identityFor(canonical, null);
  const savedReflection = canonicalReflection(reflection, canonical);
  return savedReflection ? identityFor(canonical, savedReflection) : null;
}

// Derive delayed practice from exact validated attempts, without reading or changing storage.
export function transferPracticeStatus(state, reflection, records) {
  const canonical = canonicalState(state);
  const question = canonical && getTransferQuestion(canonical.episodeId, canonical.version);
  const identity = canonical?.completed ? journalRecordIdentity(canonical, reflection) : null;
  const deferred = !!(canonical?.version >= 4 && question?.delivery === 'after-another-arrival');
  const result = (status, reason, source = null, unlockedBy = null) => ({
    status, canAnswer: status === 'ready', deferred, reason, question, source, unlockedBy,
  });
  if (!identity || !question || !Array.isArray(records)) return result('unavailable', 'invalid-route-or-reflection');
  const valid = records.map((record) => inspectRecord(record).record).filter(Boolean);
  const source = valid.find((record) => identityFor(record.state, record.reflection) === identity);
  if (!source) return result('locked', 'save-this-exact-attempt-first');
  if (source.transfer) return result('answered', 'first-answer-recorded', source);
  if (!deferred) return result('ready', 'available', source);
  const unlockedBy = valid.find((record) => record.state.episodeId !== canonical.episodeId
    && record.completedUtc > source.completedUtc);
  return unlockedBy ? result('ready', 'another-arrival-completed', source, unlockedBy)
    : result('locked', 'complete-another-arrival', source);
}

function validTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const timestamp = new Date(value);
  return Number.isFinite(timestamp.getTime()) && timestamp.toISOString() === value;
}

function canonicalTransfer(raw, state, legacy) {
  const keys = legacy ? ['questionContent', 'answerId'] : ['questionVersion', 'questionContent', 'answerId'];
  if (!hasExactKeys(raw, keys)) return null;
  const question = getTransferQuestion(state.episodeId, state.version);
  if (!question || (!legacy && raw.questionVersion !== question.version)
    || !matchesBundledContent(raw.questionContent, question)
    || typeof raw.answerId !== 'string' || !question.choices.some((choice) => choice.id === raw.answerId)) return null;
  return { questionVersion: question.version, questionContent: JSON.stringify(question), answerId: raw.answerId };
}

function inspectRecord(raw) {
  const legacy = hasExactKeys(raw, RECORD_KEYS);
  if (!legacy && !(hasExactKeys(raw, ['schema', 'contentVersion', ...RECORD_KEYS])
    && raw.schema === SCHEMA && raw.contentVersion === raw.state?.version)) {
    return { status: 'damaged', reason: 'unsupported-record-format', record: null };
  }
  const episode = raw.state && getInvestigationEpisode(raw.state.episodeId, raw.state.version);
  if (!episode) return { status: 'incompatible', reason: 'unknown-content-version', record: null };
  const state = canonicalState(raw.state);
  if (!state?.completed || !validTimestamp(raw.completedUtc) || !matchesBundledContent(raw.episodeContent, episode)) {
    return { status: 'damaged', reason: 'invalid-route-or-content', record: null };
  }
  const reflection = canonicalReflection(raw.reflection, state);
  if (!reflection) return { status: 'damaged', reason: 'invalid-reflection', record: null };
  const transfer = raw.transfer === null ? null : canonicalTransfer(raw.transfer, state, legacy);
  if (raw.transfer !== null && !transfer) return { status: 'damaged', reason: 'invalid-transfer-content', record: null };
  return {
    status: 'ok',
    record: {
      schema: SCHEMA,
      contentVersion: state.version,
      episodeContent: JSON.stringify(episode),
      completedUtc: raw.completedUtc,
      state,
      reflection,
      transfer,
    },
  };
}

function readReflectionEnvelope(raw, state) {
  const old = hasExactKeys(raw, ['schema', 'episodeContent', 'state', 'reflection']) && raw.schema === 1;
  const current = hasExactKeys(raw, ['schema', 'contentVersion', 'episodeContent', 'state', 'reflection'])
    && raw.schema === SCHEMA && raw.contentVersion === state.version;
  if ((!old && !current) || !matchesBundledContent(raw.episodeContent, episodeFor(state))) return null;
  const savedState = canonicalState(raw.state);
  if (!savedState || savedState.episodeId !== state.episodeId || savedState.version !== state.version) return null;
  return { state: savedState, reflection: canonicalReflection(raw.reflection, savedState) };
}

export function loadReflection(state, storage) {
  try {
    const canonical = canonicalState(state);
    if (!canonical) return emptyReflection();
    const target = storageOrDefault(storage);
    let text = target.getItem(reflectionKey(canonical.episodeId, canonical.version));
    if (text === null) text = target.getItem(oldReflectionKey(canonical.episodeId));
    if (!withinSize(text)) return emptyReflection();
    const saved = readReflectionEnvelope(JSON.parse(text), canonical);
    if (!saved || JSON.stringify(saved.state) !== JSON.stringify(canonical)) return emptyReflection();
    return saved.reflection ?? emptyReflection();
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
    const target = storageOrDefault(storage);
    const key = reflectionKey(canonical.episodeId, canonical.version);
    const existing = target.getItem(key);
    if (existing !== null) {
      if (!withinSize(existing)) return false;
      const previous = readReflectionEnvelope(JSON.parse(existing), canonical);
      if (!previous?.reflection) return false;
    }
    const text = JSON.stringify({
      schema: SCHEMA,
      contentVersion: canonical.version,
      episodeContent: JSON.stringify(episodeFor(canonical)),
      state: canonical,
      reflection: savedReflection,
    });
    if (!withinSize(text)) return false;
    target.setItem(key, text);
    return true;
  } catch {
    return false;
  }
}

function preservationKey(values) {
  // This checksum names an immutable recovery slot; it does not authenticate content.
  const signature = JSON.stringify(values);
  let a = 2166136261;
  let b = 3339675911;
  for (let index = 0; index < signature.length; index += 1) {
    const code = signature.charCodeAt(index);
    a = Math.imul(a ^ code, 16777619) >>> 0;
    b = Math.imul(b ^ code, 2246822519) >>> 0;
  }
  return `${RECOVERY_PREFIX}${signature.length}:${a.toString(16)}:${b.toString(16)}`;
}

export function readJournal(storage) {
  let rawText;
  try {
    rawText = storageOrDefault(storage).getItem(JOURNAL_KEY);
  } catch {
    return { status: 'unavailable', records: [], unreadableEntries: [], rawText: null };
  }
  return inspectJournalText(rawText);
}

function inspectJournalText(rawText) {
  if (rawText === null) return { status: 'empty', records: [], unreadableEntries: [], rawText: null };
  const legacyOversize = !withinSize(rawText);
  const invalid = (reason) => ({ status: 'invalid', reason: legacyOversize ? 'oversize-store' : reason, records: [], unreadableEntries: [], rawText });
  if (!withinSize(rawText, V5_JOURNAL_MAX_BYTES)) return invalid('oversize-store');
  let raw;
  try { raw = JSON.parse(rawText); } catch { return invalid('malformed-store'); }
  if (!hasExactKeys(raw, ['schema', 'records']) || ![1, SCHEMA].includes(raw.schema)
    || !Array.isArray(raw.records)) return invalid('unsupported-store-format');
  const records = [];
  const unreadableEntries = [];
  const identities = new Set();
  for (const [index, value] of raw.records.entries()) {
    const inspected = inspectRecord(value);
    const identity = inspected.record && identityFor(inspected.record.state, inspected.record.reflection);
    if (!inspected.record || identities.has(identity)) {
      unreadableEntries.push({
        index,
        status: inspected.record ? 'duplicate' : inspected.status,
        reason: inspected.record ? 'duplicate-route' : inspected.reason,
        value,
      });
      continue;
    }
    identities.add(identity);
    records.push(inspected.record);
  }
  if (!withinJournalSize(rawText, records)) return invalid('oversize-store');
  return {
    status: unreadableEntries.length ? 'partial' : records.length ? 'ok' : 'empty',
    records,
    unreadableEntries,
    rawText,
    preservationKey: unreadableEntries.length ? preservationKey(unreadableEntries.map((entry) => entry.value)) : null,
  };
}

function preserveUnreadable(journal, storage) {
  if (!journal.unreadableEntries.length) return true;
  const values = journal.unreadableEntries.map((entry) => entry.value);
  const existing = storage.getItem(journal.preservationKey);
  if (existing !== null) {
    // A collision or altered recovery slot must never replace the original bytes.
    if (!withinSize(existing, RECOVERY_MAX_BYTES)) return false;
    const preserved = JSON.parse(existing);
    if (!hasExactKeys(preserved, ['schema', 'unreadableEntries', 'originalJournalText'])
      || preserved.schema !== 1 || typeof preserved.originalJournalText !== 'string'
      || JSON.stringify(preserved.unreadableEntries) !== JSON.stringify(values)) return false;
    const original = inspectJournalText(preserved.originalJournalText);
    return original.status === 'partial'
      && JSON.stringify(original.unreadableEntries.map((entry) => entry.value)) === JSON.stringify(values);
  }
  const text = JSON.stringify({
    schema: 1,
    unreadableEntries: values,
    originalJournalText: journal.rawText,
  });
  if (!withinSize(text, RECOVERY_MAX_BYTES)) return false;
  storage.setItem(journal.preservationKey, text);
  return true;
}

function writeJournal(records, journal, storage) {
  const unreadable = journal.unreadableEntries.map((entry) => entry.value);
  // Never silently evict a previous route to make room for a newer attempt.
  // At the bounded journal limit, leave the original intact and let the view
  // report that this new debrief could not be added; export remains available.
  const existingCount = journal.records.length + unreadable.length;
  if (records.length + unreadable.length > Math.max(records.some((record) => record.state.version === 6) ? V6_MAX_RECORDS : MAX_RECORDS, existingCount)) return false;
  const text = JSON.stringify({ schema: SCHEMA, records: [...records, ...unreadable] });
  if (!withinJournalSize(text, records) || !preserveUnreadable(journal, storage)) return false;
  if (storage.getItem(JOURNAL_KEY) !== journal.rawText) return false;
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
    const identity = identityFor(canonical, savedReflection);
    if (journal.records.some((record) => identityFor(record.state, record.reflection) === identity)) return true;
    const record = {
      schema: SCHEMA,
      contentVersion: canonical.version,
      episodeContent: JSON.stringify(episodeFor(canonical)),
      completedUtc: new Date().toISOString(),
      state: canonical,
      reflection: savedReflection,
      transfer: null,
    };
    return writeJournal([record, ...journal.records], journal, target);
  } catch {
    return false;
  }
}

export function answerTransfer(state, answerId, storage, reflection) {
  try {
    const canonical = canonicalState(state);
    if (!canonical?.completed || typeof answerId !== 'string') return null;
    const question = getTransferQuestion(canonical.episodeId, canonical.version);
    if (!question || !question.choices.some((choice) => choice.id === answerId)) return null;
    const target = storageOrDefault(storage);
    const journal = readJournal(target);
    if (!['ok', 'partial'].includes(journal.status)) return null;
    const stateIdentity = JSON.stringify(canonical);
    const matches = journal.records.map((record, index) => ({ record, index }))
      .filter(({ record }) => JSON.stringify(record.state) === stateIdentity);
    let index;
    if (episodeFor(canonical)?.reasoning && reflection !== undefined) {
      const savedReflection = canonicalReflection(reflection, canonical);
      if (!savedReflection) return null;
      const identity = identityFor(canonical, savedReflection);
      index = matches.find(({ record }) => identityFor(record.state, record.reflection) === identity)?.index;
    } else {
      // Legacy callers are unambiguous only while exactly one assessed reflection matches.
      if (matches.length !== 1) return null;
      index = matches[0].index;
    }
    if (index === undefined) return null;
    const record = journal.records[index];
    if (record.transfer !== null) return record;
    if (canonical.version >= 4 && question.delivery === 'after-another-arrival'
      && !transferPracticeStatus(canonical, record.reflection, journal.records).canAnswer) return null;
    const answered = {
      ...record,
      transfer: { questionVersion: question.version, questionContent: JSON.stringify(question), answerId },
    };
    journal.records[index] = answered;
    return writeJournal(journal.records, journal, target) ? answered : null;
  } catch {
    return null;
  }
}

export function exportJournal(storage) {
  const journal = readJournal(storage);
  if (journal.status === 'unavailable') return null;
  let preservedStorage = null;
  if (journal.preservationKey) {
    try {
      const text = storageOrDefault(storage).getItem(journal.preservationKey);
      if (text !== null) preservedStorage = { key: journal.preservationKey, text };
    } catch { /* The readable active journal can still be exported. */ }
  }
  return {
    schema: 'medical_mysteries_learning_journal_v2',
    exportedUtc: new Date().toISOString(),
    synthetic: true,
    clinicalUse: false,
    status: journal.status,
    records: journal.records,
    unreadableEntries: journal.unreadableEntries,
    rawStorage: { key: JOURNAL_KEY, text: journal.rawText },
    preservedStorage,
  };
}

export function clearJournal(storage) {
  try {
    const target = storageOrDefault(storage);
    const keys = new Set([JOURNAL_KEY]);
    let ok = true;
    try {
      // Enumerate before removing: deletion changes Storage's numeric key positions.
      if (!Number.isSafeInteger(target.length) || target.length < 0 || typeof target.key !== 'function') {
        ok = false;
      } else {
        for (let index = 0; index < target.length; index += 1) {
          const key = target.key(index);
          if (typeof key === 'string' && key.startsWith(RECOVERY_PREFIX)) keys.add(key);
        }
      }
    } catch { ok = false; }
    for (const key of keys) {
      try { target.removeItem(key); } catch { ok = false; }
    }
    return ok;
  } catch {
    return false;
  }
}
