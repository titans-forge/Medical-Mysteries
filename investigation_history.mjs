import { getGameStorage } from './game_storage.mjs';
import {
  INVESTIGATION_EPISODE,
  getInvestigationEpisode,
  restoreInvestigation,
} from './investigation.mjs';
import { matchesBundledContent } from './investigation_content_versions.mjs';

const SCHEMA = 3;
const MAX_BYTES = 64 * 1024;
const LEGACY_KEY = 'mmInvestigation:v1';
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasExactKeys = (value, keys) => isRecord(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
// Keep the existing slot so supported saves resume without a destructive migration.
const keyFor = (episodeId) => `mmInvestigation:v2:${episodeId}`;

function storageOrDefault(storage) {
  return storage === undefined ? getGameStorage() : storage;
}

function withinSize(text) {
  return typeof text === 'string' && text.length <= MAX_BYTES
    && (typeof TextEncoder === 'undefined' || new TextEncoder().encode(text).length <= MAX_BYTES);
}

function validTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const timestamp = new Date(value);
  return Number.isFinite(timestamp.getTime()) && timestamp.toISOString() === value;
}

function checkpoint(raw, episodeId, legacySlot) {
  const oldSchema = legacySlot ? 1 : 2;
  const old = hasExactKeys(raw, ['schema', 'content', 'savedUtc', 'state']) && raw.schema === oldSchema;
  const current = !legacySlot && hasExactKeys(raw, ['schema', 'contentVersion', 'content', 'savedUtc', 'state'])
    && raw.schema === SCHEMA && raw.contentVersion === raw.state?.version;
  if (!old && !current) return { status: 'invalid', reason: 'unsupported-save-format', state: null };
  const episode = getInvestigationEpisode(episodeId, raw.state?.version);
  if (!episode) return { status: 'incompatible', reason: 'unknown-content-version', state: null };
  if (!validTimestamp(raw.savedUtc) || raw.state?.episodeId !== episodeId
    || !matchesBundledContent(raw.content, episode)) {
    return { status: 'invalid', reason: 'damaged-save', state: null };
  }
  const state = restoreInvestigation(raw.state);
  return state ? { status: 'ok', state } : { status: 'invalid', reason: 'invalid-route', state: null };
}

// Read each exact slot independently so a damaged new edition never masks or replaces an older original.
function readSlot(episodeId, target, key, expectedVersion) {
  let rawText;
  try { rawText = target.getItem(key); }
  catch { return { status: 'unavailable', state: null, rawText: null, key }; }
  if (rawText === null) return { status: 'empty', state: null, rawText: null, key };
  if (!withinSize(rawText)) return { status: 'invalid', reason: 'oversize-save', state: null, rawText, key };
  try {
    const result = checkpoint(JSON.parse(rawText), episodeId, key === LEGACY_KEY);
    if (result.state && ((expectedVersion !== undefined && result.state.version !== expectedVersion)
      || (expectedVersion === undefined && result.state.version >= 4))) {
      return { status: 'incompatible', reason: 'content-version-in-wrong-slot', state: null, rawText, key };
    }
    return { ...result, rawText, key };
  } catch { return { status: 'invalid', reason: 'malformed-save', state: null, rawText, key }; }
}

const versionKey = (episodeId, version) => `mmInvestigation:v4:${episodeId}:${version}`;
const olderKeys = (episodeId) => [keyFor(episodeId), ...(episodeId === INVESTIGATION_EPISODE.id ? [LEGACY_KEY] : [])];

// Detailed read supports recovery/export without treating stored episode definitions as trusted code.
export function readInvestigation(episodeId, storage, version) {
  const episode = getInvestigationEpisode(episodeId, version);
  if (!episode) return { status: 'incompatible', state: null, rawText: null, key: null };
  let target;
  try { target = storageOrDefault(storage); }
  catch { return { status: 'unavailable', state: null, rawText: null, key: null }; }
  const readVersion = (requested) => {
    const exact = readSlot(episodeId, target, versionKey(episodeId, requested), requested);
    if (exact.status !== 'empty' || requested >= 4) return exact;
    let failure = null;
    for (const key of olderKeys(episodeId)) {
      const result = readSlot(episodeId, target, key);
      if (result.state?.version === requested) return result;
      if (!['empty', 'ok'].includes(result.status)) failure ??= result;
    }
    return failure ?? exact;
  };
  if (version !== undefined) return readVersion(version);
  for (let requested = episode.version; requested >= 1; requested--) {
    if (!getInvestigationEpisode(episodeId, requested)) continue;
    const result = readVersion(requested);
    if (result.status !== 'empty') return result;
  }
  return { status: 'empty', state: null, rawText: null, key: versionKey(episodeId, episode.version) };
}

export function loadInvestigation(episodeId, storage, version) {
  return readInvestigation(episodeId, storage, version).state;
}

export const loadInvestigationVersion = (episodeId, version, storage) => loadInvestigation(episodeId, storage, version);

export function listInvestigationSaves(episodeId, storage) {
  const episode = getInvestigationEpisode(episodeId);
  if (!episode) return [];
  const states = [];
  for (let version = episode.version; version >= 1; version--) {
    if (!getInvestigationEpisode(episodeId, version)) continue;
    const result = readInvestigation(episodeId, storage, version);
    if (result.state) states.push(result.state);
  }
  return states;
}

export function saveInvestigation(state, storage) {
  try {
    const canonical = restoreInvestigation(state);
    if (!canonical) return false;
    const episode = getInvestigationEpisode(canonical.episodeId, canonical.version);
    if (!episode) return false;
    const target = storageOrDefault(storage);
    let key = versionKey(episode.id, canonical.version);
    let existing = target.getItem(key);
    let original = null;
    if (canonical.version < 4 && existing === null) {
      const oldKey = keyFor(episode.id);
      const oldText = target.getItem(oldKey);
      if (oldText !== null) {
        if (!withinSize(oldText)) return false;
        const previous = checkpoint(JSON.parse(oldText), episode.id, false);
        if (previous.status !== 'ok' || previous.state.version >= 4) return false;
        if (previous.state.version !== canonical.version) original = { key: oldKey, text: oldText };
        else { key = oldKey; existing = oldText; }
      } else key = oldKey;
    }
    // Do not replace an unreadable original merely because the current UI has a new route.
    if (existing !== null) {
      if (!withinSize(existing)) return false;
      const saved = checkpoint(JSON.parse(existing), episode.id, false);
      if (saved.status !== 'ok' || saved.state.version !== canonical.version) return false;
    }
    const serialized = JSON.stringify({
      schema: SCHEMA,
      contentVersion: canonical.version,
      content: JSON.stringify(episode),
      savedUtc: new Date().toISOString(),
      state: canonical,
    });
    if (!withinSize(serialized) || target.getItem(key) !== existing
      || (original && target.getItem(original.key) !== original.text)) return false;
    target.setItem(key, serialized);
    return true;
  } catch { return false; }
}

export function clearInvestigation(episodeId, storage) {
  const episode = getInvestigationEpisode(episodeId);
  if (!episode) return false;
  try {
    const target = storageOrDefault(storage);
    let ok = true;
    const keys = [...olderKeys(episodeId)];
    for (let version = 1; version <= episode.version; version++) {
      if (getInvestigationEpisode(episodeId, version)) keys.push(versionKey(episodeId, version));
    }
    for (const key of keys) try { target.removeItem(key); } catch { ok = false; }
    return ok;
  } catch { return false; }
}
