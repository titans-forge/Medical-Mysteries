export const REVIEW_QUEUE_KEY = 'mmReviewQueue';
export const MAX_REVIEW_QUEUE = 256;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_INTERVAL_DAYS = 3650;
const MAX_ID_LENGTH = 128;

export function isValidId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH;
}

export function isValidReviewEntry(value) {
  return Boolean(value && isValidId(value.concept_id) && isValidId(value.review_variant_id)
    && Number.isFinite(value.due_at) && value.due_at >= 0
    && Number.isFinite(value.interval_days) && value.interval_days > 0
    && value.interval_days <= MAX_INTERVAL_DAYS);
}

export function normalizeReviewQueue(entries) {
  const byIdentity = new Map();
  if (!Array.isArray(entries)) return [];
  for (const entry of entries) {
    if (!isValidReviewEntry(entry)) continue;
    const normalized = {
      concept_id: entry.concept_id,
      review_variant_id: entry.review_variant_id,
      due_at: entry.due_at,
      interval_days: entry.interval_days,
    };
    const identity = identityOf(normalized);
    byIdentity.delete(identity);
    byIdentity.set(identity, normalized);
  }
  return [...byIdentity.values()].slice(-MAX_REVIEW_QUEUE);
}

function identityOf(value) {
  return isValidId(value?.concept_id) && isValidId(value?.review_variant_id)
    ? JSON.stringify([value.concept_id, value.review_variant_id]) : null;
}

function completedSuccessIdentities(rows) {
  const grouped = new Map();
  if (!Array.isArray(rows)) return new Set();
  for (const row of rows) {
    const identity = identityOf(row);
    if (!identity) continue;
    const current = grouped.get(identity) || { count: 0, valid: true };
    current.count += 1;
    current.valid = current.valid && Number.isInteger(row.attempts) && row.attempts > 0 && row.first_try === true;
    grouped.set(identity, current);
  }
  return new Set([...grouped].filter(([, value]) => value.count > 0 && value.valid).map(([key]) => key));
}

export function intervalForReason(reason) {
  return reason === 'high_confidence_wrong' ? 1 : reason === 'missed' ? 3 : null;
}

export function scheduleReviewQueue(existing, candidates, now) {
  const timestamp = Number.isFinite(now) && now >= 0 ? now : 0;
  const queue = normalizeReviewQueue(existing);
  const byIdentity = new Map(queue.map((entry) => [identityOf(entry), entry]));
  if (!Array.isArray(candidates)) return queue;
  for (const candidate of candidates) {
    const identity = identityOf(candidate);
    const candidateInterval = intervalForReason(candidate?.reason);
    if (!identity || !candidateInterval) continue;
    const previous = byIdentity.get(identity);
    const intervalDays = previous ? Math.min(previous.interval_days, candidateInterval) : candidateInterval;
    byIdentity.set(identity, {
      concept_id: candidate.concept_id,
      review_variant_id: candidate.review_variant_id,
      due_at: previous && previous.due_at > timestamp ? Math.min(previous.due_at, timestamp + intervalDays * DAY_MS) : timestamp + intervalDays * DAY_MS,
      interval_days: intervalDays,
    });
  }
  return [...byIdentity.values()].slice(-MAX_REVIEW_QUEUE);
}

export function reconcileReviewQueue(existing, result, now, { restored = false } = {}) {
  if (restored || !result || result.sandbox === true) return normalizeReviewQueue(existing);
  if (result.finished !== true) return normalizeReviewQueue(existing);
  if (!Number.isFinite(now) || now < 0) return normalizeReviewQueue(existing);
  const retired = completedSuccessIdentities(result.stage_autopsy);
  // An immediate replay cannot discharge a future spaced review.
  const retained = normalizeReviewQueue(existing).filter((entry) => !retired.has(identityOf(entry)) || entry.due_at > now);
  return scheduleReviewQueue(retained, result.review_queue, now);
}

export function reviewVariantPrefix(reviewVariantId) {
  return isValidId(reviewVariantId) ? reviewVariantId.split('-')[0] : '';
}

function mappedCase(entry, routes) {
  const exact = routes?.[JSON.stringify([entry?.concept_id, entry?.review_variant_id])];
  return exact?.case_id || routes?.[reviewVariantPrefix(entry?.review_variant_id)] || null;
}

export function matchingReviewEntries(queue, now = Date.now()) {
  const timestamp = Number.isFinite(now) ? now : 0;
  return normalizeReviewQueue(queue).filter((entry) => entry.due_at <= timestamp).sort((a, b) => a.due_at - b.due_at);
}

export function selectDueReview(queue, availableCaseIds, variantCaseMap, now = Date.now()) {
  const available = new Set(Array.isArray(availableCaseIds) ? availableCaseIds : []);
  return matchingReviewEntries(queue, now).find((entry) => available.has(mappedCase(entry, variantCaseMap))) || null;
}

export function nextReviewEntry(queue, caseId, variantCaseMap, now = Date.now()) {
  return normalizeReviewQueue(queue)
    .filter((entry) => mappedCase(entry, variantCaseMap) === caseId)
    .sort((a, b) => a.due_at - b.due_at)[0] || null;
}

export function summarizeReviewChange(before, after) {
  const beforeQueue = normalizeReviewQueue(before);
  const beforeByIdentity = new Map(beforeQueue.map((entry) => [identityOf(entry), entry]));
  const afterQueue = normalizeReviewQueue(after);
  const afterByIdentity = new Map(afterQueue.map((entry) => [identityOf(entry), entry]));
  const cleared = [...beforeByIdentity.keys()].filter((key) => !afterByIdentity.has(key)).length;
  let scheduled = 0;
  let rescheduled = 0;
  let retained = 0;
  for (const [key, entry] of afterByIdentity) {
    const previous = beforeByIdentity.get(key);
    if (!previous) {
      scheduled += 1;
    } else if (previous.due_at !== entry.due_at || previous.interval_days !== entry.interval_days) {
      rescheduled += 1;
    } else {
      retained += 1;
    }
  }
  const changes = [
    [cleared, 'cleared'],
    [scheduled, 'scheduled'],
    [rescheduled, 'rescheduled'],
    [retained, 'retained'],
  ].filter(([count]) => count > 0).map(([count, label]) => `${count} ${label}`);
  return {
    cleared,
    scheduled,
    rescheduled,
    text: changes.length ? `Review queue: ${changes.join(', ')}` : 'No concepts scheduled',
  };
}
