import { getGameStorage } from './game_storage.mjs';
import { REVIEW_QUEUE_KEY, isValidReviewEntry, normalizeReviewQueue } from './review_queue.mjs';

function validEntries(value) {
  return Array.isArray(value) && value.every((entry) => isValidReviewEntry(entry)
    && Object.keys(entry).length === 4 && ['concept_id', 'review_variant_id', 'due_at', 'interval_days'].every((key) => Object.hasOwn(entry, key)))
    && normalizeReviewQueue(value).length === value.length;
}
export function readStoryReviews(storage) {
  let raw;
  try {
    const store = storage === undefined ? getGameStorage() : storage;
    raw = store.getItem(REVIEW_QUEUE_KEY);
  } catch { return { status: 'unavailable', entries: [], raw: null }; }
  if (raw === null) return { status: 'empty', entries: [], raw };
  try {
    const entries = JSON.parse(raw);
    return validEntries(entries) ? { status: 'ok', entries: normalizeReviewQueue(entries), raw }
      : { status: 'invalid', entries: [], raw };
  } catch { return { status: 'invalid', entries: [], raw }; }
}
export function writeStoryReviews(previous, entries, storage) {
  if (!previous || !['ok', 'empty'].includes(previous.status) || !validEntries(entries)) return false;
  try {
    const store = storage === undefined ? getGameStorage() : storage;
    if (store.getItem(REVIEW_QUEUE_KEY) !== previous.raw) return false;
    store.setItem(REVIEW_QUEUE_KEY, JSON.stringify(entries)); return true;
  } catch { return false; }
}
