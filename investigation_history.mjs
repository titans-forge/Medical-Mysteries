import {
  INVESTIGATION_EPISODE,
  getInvestigationEpisode,
  restoreInvestigation,
} from './investigation.mjs';

const SCHEMA = 2;
const LEGACY_SCHEMA = 1;
const MAX_BYTES = 64 * 1024;
const LEGACY_KEY = 'mmInvestigation:v1';
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasExactKeys = (value, keys) => isRecord(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const keyFor = (episodeId) => `mmInvestigation:v2:${episodeId}`;

function storageOrDefault(storage) {
  return storage === undefined ? globalThis.localStorage : storage;
}

function byteLength(value) {
  return typeof TextEncoder === 'undefined' ? value.length : new TextEncoder().encode(value).length;
}

function episodeContent(episode) {
  return JSON.stringify(episode);
}

function validTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  return new Date(value).toISOString() === value;
}

function validCheckpoint(raw, episode, schema) {
  if (!hasExactKeys(raw, ['schema', 'content', 'savedUtc', 'state']) || raw.schema !== schema
    || typeof raw.content !== 'string' || raw.content !== episodeContent(episode) || !validTimestamp(raw.savedUtc)) return null;
  const state = restoreInvestigation(raw.state);
  return state && state.episodeId === episode.id ? state : null;
}

function read(storage, episode, key, schema) {
  const rawText = storage.getItem(key);
  if (rawText === null || typeof rawText !== 'string' || byteLength(rawText) > MAX_BYTES) return null;
  let raw;
  try { raw = JSON.parse(rawText); } catch { return null; }
  return validCheckpoint(raw, episode, schema);
}

export function loadInvestigation(episodeId, storage) {
  const episode = getInvestigationEpisode(episodeId);
  if (!episode) return null;
  try {
    const target = storageOrDefault(storage);
    const current = read(target, episode, keyFor(episode.id), SCHEMA);
    if (current) return current;
    if (episode.id === INVESTIGATION_EPISODE.id && target.getItem(keyFor(episode.id)) === null) {
      return read(target, episode, LEGACY_KEY, LEGACY_SCHEMA);
    }
    return null;
  } catch {
    return null;
  }
}

export function saveInvestigation(state, storage) {
  const canonical = restoreInvestigation(state);
  if (!canonical) return false;
  const episode = getInvestigationEpisode(canonical.episodeId);
  if (!episode) return false;
  const checkpoint = { schema: SCHEMA, content: episodeContent(episode), savedUtc: new Date().toISOString(), state: canonical };
  let serialized;
  try { serialized = JSON.stringify(checkpoint); } catch { return false; }
  if (byteLength(serialized) > MAX_BYTES) return false;
  try {
    storageOrDefault(storage).setItem(keyFor(episode.id), serialized);
    return true;
  } catch {
    return false;
  }
}

export function clearInvestigation(episodeId, storage) {
  const episode = getInvestigationEpisode(episodeId);
  if (!episode) return false;
  try {
    const target = storageOrDefault(storage);
    let ok = true;
    try { target.removeItem(keyFor(episode.id)); } catch { ok = false; }
    if (episode.id === INVESTIGATION_EPISODE.id) {
      try { target.removeItem(LEGACY_KEY); } catch { ok = false; }
    }
    return ok;
  } catch {
    return false;
  }
}
