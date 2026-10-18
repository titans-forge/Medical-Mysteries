import original from './game-data.mjs';
import current from './story_decisions.mjs';
import previous from './story_content_v2.mjs';

export const CURRENT_STORY_BUILD = current.build_id;
export const LEGACY_STORY_BUILD = original.build_id;
export const STORY_COMPLETION_PREFIX = 'mmStoryCompletion:v1:';
export const STORY_PREFERENCES_KEY = 'mmStoryPreferences:v1';
const bundles = new Map([[original.build_id, original], [previous.build_id, previous], [current.build_id, current]]);
const clone = (value) => JSON.parse(JSON.stringify(value));
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const target = (storage) => { try { return storage === undefined ? globalThis.localStorage : storage; } catch { return undefined; } };
const id = (value) => typeof value === 'string' && value.length > 0 && value.length < 256;
const finite = (value) => Number.isFinite(value) && value >= 0;
const keyFor = (build, session) => `${STORY_COMPLETION_PREFIX}${encodeURIComponent(build)}:${encodeURIComponent(session)}`;
const caseFor = (build, caseId) => bundles.get(build)?.cases.find((item) => item.case_id === caseId);

export const STORY_REVIEW_ROUTES = Object.freeze(Object.fromEntries(
  [...bundles.values()].flatMap((bundle) => bundle.cases.flatMap((item) => item.stages.map((stage) => [
    JSON.stringify([stage.view.concept_id, stage.review_variant_id]),
    Object.freeze({ case_id: item.case_id, tier: item.tier, build_id: bundle.build_id,
      content_version: bundle.content_version || 1 }),
  ]))),
));

export function storyReviewRoute(entry) {
  return STORY_REVIEW_ROUTES[JSON.stringify([entry?.concept_id, entry?.review_variant_id])] || null;
}

function legacyProfile(storage) {
  let raw;
  try {
    raw = storage.getItem('mmProfile');
  } catch { return { status: 'unavailable', plays: {}, pressure: false, raw: null }; }
  try {
    if (raw === null) return { status: 'empty', plays: {}, pressure: false, raw: null };
    const parsed = JSON.parse(raw);
    if (!object(parsed) || !object(parsed.plays)) return { status: 'invalid', plays: {}, pressure: false, raw };
    const plays = {};
    for (const [caseId, play] of Object.entries(parsed.plays)) {
      if (caseFor(LEGACY_STORY_BUILD, caseId) && object(play) && finite(play.completed_at)
        && finite(play.best_accuracy ?? play.accuracy) && (play.best_accuracy ?? play.accuracy) <= 1) plays[caseId] = clone(play);
    }
    return { status: 'ok', plays, pressure: parsed.pressure === true, raw };
  } catch { return { status: 'invalid', plays: {}, pressure: false, raw }; }
}

function inspectPreferences(storage, inheritedPressure) {
  const empty = { schema: 1, pressure: inheritedPressure, last_started_case_id: null, last_started_build_id: null, last_started_at: null };
  try {
    const raw = storage.getItem(STORY_PREFERENCES_KEY);
    if (raw === null) return { status: 'empty', value: empty, raw };
    const value = JSON.parse(raw);
    const keys = Object.keys(empty);
    if (!object(value) || Object.keys(value).length !== keys.length || !keys.every((key) => Object.hasOwn(value, key))
      || value.schema !== 1 || typeof value.pressure !== 'boolean'
      || !(value.last_started_at === null || finite(value.last_started_at))
      || !(value.last_started_build_id === null || bundles.has(value.last_started_build_id))
      || !(value.last_started_case_id === null || caseFor(value.last_started_build_id, value.last_started_case_id))) {
      return { status: 'invalid', value: empty, raw };
    }
    return { status: 'ok', value, raw };
  } catch { return { status: 'unavailable', value: empty, raw: null }; }
}

export function saveStoryPreferences(changes, storage) {
  try {
    const store = target(storage);
    const previous = inspectPreferences(store, legacyProfile(store).pressure);
    if (!['ok', 'empty'].includes(previous.status) || !object(changes)
      || Object.keys(changes).some((key) => !['pressure', 'last_started_case_id', 'last_started_build_id', 'last_started_at'].includes(key))) return false;
    const next = { ...previous.value, ...changes };
    // Reuse the same strict reader before committing. Never rewrite legacy profile data.
    if (inspectPreferences({ getItem: () => JSON.stringify(next) }, false).status !== 'ok') return false;
    if (store.getItem(STORY_PREFERENCES_KEY) !== previous.raw) return false;
    store.setItem(STORY_PREFERENCES_KEY, JSON.stringify(next));
    return true;
  } catch { return false; }
}

function validReceipt(value, key) {
  try {
    if (!object(value) || value.schema !== 1 || !id(value.session_id) || !bundles.has(value.build_id)
      || keyFor(value.build_id, value.session_id) !== key || !finite(value.completed_at)) return false;
    const spec = caseFor(value.build_id, value.case_id);
    const result = value.completion;
    const edition = bundles.get(value.build_id);
    if (!spec || value.tier !== spec.tier || value.content_version !== (edition.content_version || 1)
      || !object(result) || result.finished !== true || !object(result.score)) return false;
    for (const field of ['session_id', 'build_id', 'content_version', 'case_id', 'tier']) if (result[field] !== value[field]) return false;
    if (result.edition_label !== (edition.edition_label || 'Original story edition')) return false;
    const score = result.score;
    const rows = result.stage_autopsy;
    const comparison = result.path_debrief?.comparison;
    const path = result.path_debrief?.learner_path;
    const calibration = result.clinical_autopsy?.calibration;
    if (!Array.isArray(rows) || rows.length !== spec.stages.length
      || !Array.isArray(comparison) || comparison.length !== rows.length
      || !Array.isArray(path) || path.length > 500 || !object(calibration)
      || !Array.isArray(calibration.overconfident_first_misses)) return false;
    let activeStage = 0;
    for (const attempt of path) {
      if (!object(attempt)) return false;
      const stage = spec.stages[activeStage];
      if (!stage || attempt.stage_id !== stage.view.stage_id) return false;
      const choice = stage?.choices.find((item) => item.label === attempt.choice);
      if (!choice || attempt.correct !== choice.result.correct) return false;
      if (choice.result.correct) activeStage += 1;
    }
    if (activeStage !== spec.stages.length) return false;
    for (const [index, row] of rows.entries()) {
      const stage = spec.stages[index]; const view = stage.view;
      const matched = comparison[index];
      const attempts = path.filter((attempt) => attempt.stage_id === view.stage_id);
      const firstChoice = stage.choices.find((choice) => choice.label === matched?.first_try_choice);
      const supported = stage.choices.find((choice) => choice.result.correct).label;
      if (!object(row) || !object(matched) || !firstChoice || !attempts.length
        || row.stage_id !== view.stage_id || row.stage_number !== index + 1
        || row.concept_id !== view.concept_id || row.review_variant_id !== stage.review_variant_id
        || row.question !== view.question || row.expert_choice !== supported || row.decision_kind !== view.decision_kind
        || row.attempts !== attempts.length || row.first_try !== firstChoice.result.correct
        || matched.stage_number !== index + 1 || matched.expert_choice !== supported
        || matched.first_try_choice !== attempts[0].choice || matched.matched !== firstChoice.result.correct
        || !(row.confidence === null || (Number.isInteger(row.confidence) && row.confidence >= 0 && row.confidence <= 100 && row.confidence % 10 === 0))) return false;
      if (matched.error_mode !== firstChoice.result.error_mode || matched.error_mode_label !== firstChoice.result.error_mode_label) return false;
    }
    const points = { public: 1, student: 2, doctor: 3 }[spec.tier];
    const correct = rows.filter((row) => row.first_try).length;
    const recorded = rows.filter((row) => row.confidence !== null);
    const brier = recorded.length ? Number((recorded.reduce((sum, row) => sum + (row.confidence / 100 - Number(row.first_try)) ** 2, 0) / recorded.length).toFixed(3)) : null;
    const highMisses = recorded.filter((row) => !row.first_try && row.confidence >= 70);
    return score.tier === spec.tier && score.possible === rows.length * points && score.earned === correct * points
      && score.accuracy === Number((correct / rows.length).toFixed(3)) && score.brier_score === brier
      && calibration.brier_score === brier && calibration.sample_count === recorded.length
      && calibration.overconfident_first_misses.length === highMisses.length
      && calibration.overconfident_first_misses.every((miss, index) => object(miss)
        && miss.stage_number === highMisses[index].stage_number && miss.confidence === highMisses[index].confidence
        && miss.decision_kind === highMisses[index].decision_kind);
  } catch { return false; }
}

export function readStoryCompletions(storage) {
  const records = [];
  const unreadable = [];
  try {
    const store = target(storage);
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (!key?.startsWith(STORY_COMPLETION_PREFIX)) continue;
      const raw = store.getItem(key);
      try {
        if (typeof raw !== 'string' || raw.length > 512 * 1024) throw new Error('size');
        const value = JSON.parse(raw);
        if (!validReceipt(value, key)) throw new Error('format');
        records.push(value);
      } catch { unreadable.push({ key, raw }); }
    }
    return { status: unreadable.length ? 'partial' : 'ok', records, unreadable };
  } catch { return { status: 'unavailable', records, unreadable }; }
}

function project(records) {
  const plays = {};
  for (const record of [...records].sort((a, b) => a.completed_at - b.completed_at)) {
    const result = record.completion;
    const before = plays[record.case_id];
    plays[record.case_id] = {
      case_id: record.case_id, tier: record.tier, build_id: record.build_id, session_id: record.session_id,
      accuracy: result.score.accuracy,
      best_accuracy: Math.max(before?.best_accuracy || 0, result.score.accuracy),
      best_earned: Math.max(before?.best_earned || 0, result.score.earned),
      brier_score: result.score.brier_score ?? null,
      overconfident_misses: result.clinical_autopsy?.calibration?.overconfident_first_misses?.length || 0,
      error_modes: (result.path_debrief?.comparison || []).filter((row) => row.error_mode)
        .map((row) => ({ mode: row.error_mode, label: row.error_mode_label })),
      completed_at: record.completed_at,
    };
  }
  const values = Object.values(plays);
  const brier = values.map((play) => play.brier_score).filter((value) => Number.isFinite(value));
  return {
    plays, xp: values.reduce((sum, play) => sum + play.best_earned, 0),
    calibration: {
      cases_completed: values.length,
      mean_accuracy: values.length ? Math.round(values.reduce((sum, play) => sum + play.accuracy, 0) / values.length * 100) : null,
      brier_score: brier.length ? Number((brier.reduce((sum, value) => sum + value, 0) / brier.length).toFixed(3)) : null,
      overconfident_count: values.reduce((sum, play) => sum + play.overconfident_misses, 0), error_matrix: {},
    },
  };
}

export function loadStoryProfile(storage, buildId = CURRENT_STORY_BUILD) {
  const store = target(storage);
  const legacy = legacyProfile(store);
  const history = readStoryCompletions(store);
  const preferences = inspectPreferences(store, legacy.pressure);
  const currentProjection = project(history.records.filter((record) => record.build_id === buildId));
  const continuedLegacy = project(history.records.filter((record) => record.build_id === LEGACY_STORY_BUILD));
  const legacyPlays = { ...legacy.plays };
  for (const [caseId, play] of Object.entries(continuedLegacy.plays)) legacyPlays[caseId] = {
    ...play,
    best_accuracy: Math.max(legacyPlays[caseId]?.best_accuracy ?? legacyPlays[caseId]?.accuracy ?? 0, play.best_accuracy),
    best_earned: Math.max(legacyPlays[caseId]?.best_earned || 0, play.best_earned),
  };
  return {
    ...currentProjection, ...preferences.value,
    legacy_plays: legacyPlays,
    history_status: history.status, unreadable_count: history.unreadable.length,
    preferences_status: preferences.status, legacy_status: legacy.status,
    rank: currentProjection.calibration.brier_score === null ? 'Not recorded' : 'Confidence recorded',
  };
}

export function recordStoryCompletion(session, completion, storage, now = Date.now()) {
  try {
    const store = target(storage);
    const record = {
      schema: 1, session_id: session?.session_id, build_id: session?.build_id,
      content_version: session?.content_version, case_id: session?.case_id, tier: session?.tier,
      completed_at: now, completion: clone(completion),
    };
    const key = keyFor(record.build_id, record.session_id);
    if (!validReceipt(record, key)) return { saved: false, reason: 'invalid-completion' };
    const old = store.getItem(key);
    if (old !== null) {
      let previous;
      try { previous = JSON.parse(old); } catch { return { saved: false, reason: 'existing-record-unreadable' }; }
      if (!validReceipt(previous, key)) return { saved: false, reason: 'existing-record-unreadable' };
      record.completed_at = previous.completed_at;
      return JSON.stringify(previous) === JSON.stringify(record)
        ? { saved: true, alreadyRecorded: true } : { saved: false, reason: 'existing-record-differs' };
    }
    const text = JSON.stringify(record);
    if (text.length > 512 * 1024 || store.getItem(key) !== null) return { saved: false, reason: 'record-changed-or-full' };
    store.setItem(key, text);
    return { saved: true, alreadyRecorded: false };
  } catch { return { saved: false, reason: 'storage-unavailable-or-full' }; }
}

export function exportStoryProgress(storage) {
  const store = target(storage);
  const history = readStoryCompletions(store);
  const legacy = legacyProfile(store);
  return { schema: 1, records: history.records, unreadable: history.unreadable,
    legacy_profile: { status: legacy.status, raw: legacy.raw }, clinical_use: false };
}
