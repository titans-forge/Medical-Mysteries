// Browser runtime for bundled authored stories. This module owns learner
// interaction, scoring and versioned replay; stored records never define cases.
const clone = (value) => JSON.parse(JSON.stringify(value));
const round = (value, places = 3) => Number(value.toFixed(places));
const points = { public: 1, student: 2, doctor: 3 };
const check = (condition, message) => { if (!condition) throw new Error(message); };

// Safari exposes getRandomValues on local HTTP previews where randomUUID is
// unavailable. Session IDs are local bookkeeping, and still use secure bytes.
function newSessionId() {
  const source = globalThis.crypto;
  if (typeof source?.randomUUID === 'function') return `mm-${source.randomUUID()}`;
  if (typeof source?.getRandomValues !== 'function') throw new Error('This browser cannot create a local session ID. Use an up-to-date browser.');
  const bytes = source.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `mm-${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export class OfflineSession {
  constructor(spec, { id = newSessionId(), clock = () => Date.now() / 1000, order, content = null } = {}) {
    this.spec = spec;
    this.content = content;
    this.clock = clock;
    this.id = id;
    this.index = 0;
    this.finished = false;
    this.transcript = [];
    this.examined = [];
    this.scars = [];
    this.differential = {};
    this.reorders = 0;
    this.hypothesis = null;
    this.lastResult = null;
    this.displayed = null;
    this.started = clock();
    this.order = order || spec.stages.map((stage) => {
      const ids = stage.view.options.map((o) => o.id);
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      return ids;
    });
  }
  identity() {
    return this.content ? { build_id: this.content.build_id, content_version: this.content.content_version,
      edition_label: this.content.edition_label, case_id: this.spec.case_id, tier: this.spec.tier, session_id: this.id } : {};
  }
  current() { return this.spec.stages[this.index]; }
  deadline() {
    const v = this.current().view;
    return v.code && v.timer_seconds ? this.started + v.timer_seconds : null;
  }
  view() {
    const stage = this.current();
    const view = clone(stage.view);
    delete view.hypothesis;
    delete view.pinned_hypothesis;
    view.options = this.order[this.index].map((id) => clone(stage.view.options.find((o) => o.id === id)));
    view.preview_status = this.content?.content_version > 1
      ? 'SYNTHETIC EDUCATIONAL PREVIEW · PENDING HUMAN REVIEW' : 'EDUCATIONAL BETA · AI-AUDITED';
    view.case_context.preview_status = view.preview_status;
    Object.assign(view, this.identity());
    if (this.content) Object.assign(view.case_context, { build_id: this.content.build_id,
      content_version: this.content.content_version, edition_label: this.content.edition_label });
    view.examined_hotspots = [...this.examined].sort();
    view.observations = stage.hotspots.filter((h) => this.examined.includes(h.id)).map(({ id, label, finding }) => ({ id, label, finding }));
    view.observations_complete = stage.required.every((id) => this.examined.includes(id));
    view.scars = clone(this.scars);
    view.differential = clone(this.differential);
    view.differential_reorders = this.reorders;
    if (this.hypothesis) view.hypothesis = view.pinned_hypothesis = this.hypothesis;
    if ('pressure_deadline' in view) view.pressure_deadline = this.deadline();
    return view;
  }
  snapshot() { return { session_id: this.id, finished: this.finished, sandbox: false, ...this.view() }; }
  examine(id) {
    check(!this.finished, 'case already finished');
    const h = this.current().hotspots.find((item) => item.id === id);
    check(h, 'unknown or hidden hotspot');
    if (!this.examined.includes(id)) this.examined.push(id);
    return { ...this.identity(), hotspot_id: id, label: h.label, finding: h.finding, examined: true,
      required_observations_complete: this.view().observations_complete, stage: this.view() };
  }
  attach(stageId, optionId, evidenceId, stance) {
    check(!this.finished, 'case already finished');
    check(stageId === this.current().view.stage_id, 'evidence can only be attached to the active stage');
    check(this.current().view.options.some((o) => o.id === optionId), 'unknown option for current stage');
    check(this.current().hotspots.some((h) => h.id === evidenceId) && this.examined.includes(evidenceId), 'evidence must be an examined observation');
    check(['supporting', 'opposing'].includes(stance), 'invalid evidence stance');
    this.differential[stageId] ||= {};
    this.differential[stageId][optionId] ||= {};
    this.differential[stageId][optionId][evidenceId] = stance;
    return { ...this.identity(), stage_id: stageId, option_id: optionId, evidence_id: evidenceId, stance, differential: clone(this.differential) };
  }
  answer(optionId, confidence = null, ranking = null) {
    check(!this.finished, 'case already finished');
    check(confidence === null || (Number.isInteger(confidence) && confidence >= 0 && confidence <= 100 && confidence % 10 === 0), 'invalid confidence');
    const stage = this.current();
    const choice = stage.choices.find((o) => o.id === optionId);
    check(choice, 'unknown option for current stage');
    if (ranking !== null) {
      const ids = stage.view.options.map((o) => o.id);
      check(stage.view.supports_ranking && Array.isArray(ranking) && ranking.length === ids.length &&
        new Set(ranking).size === ids.length && ranking.every((id) => ids.includes(id)) && ranking[0] === optionId, 'invalid hypothesis ranking');
      const previous = this.transcript.filter((t) => t.stage_id === stage.view.stage_id && t.ranking).at(-1);
      if (previous && JSON.stringify(previous.ranking) !== JSON.stringify(ranking)) this.reorders++;
    }
    const first = !this.transcript.some((t) => t.stage_id === stage.view.stage_id);
    const correct = choice.result.correct;
    const earned = correct && first ? points[this.spec.tier] : 0;
    const expired = this.deadline() !== null && this.clock() > this.deadline();
    this.transcript.push({ stage_id: stage.view.stage_id, option_id: optionId, option_label: choice.label,
      correct, first_try: first, earned, confidence, confidence_error: confidence === null ? null : Math.abs((correct ? 100 : 0) - confidence),
      ranking: ranking ? [...ranking] : null, assisted: false, management_error: !correct && stage.view.decision_kind === 'action',
      time_expired: expired, seconds_on_stage: round(Math.max(0, this.clock() - this.started), 1),
      timer_present: 'timer_seconds' in stage.view, consequence_media_exposed: Boolean(choice.result.consequence_media) });
    if (!correct && !this.scars.some((s) => s.stage_id === stage.view.stage_id && s.option_id === optionId)) {
      this.scars.push({ stage_id: stage.view.stage_id, option_id: optionId, option_label: choice.label,
        consequence: choice.result.consequence || '', ...this.error(choice) });
    }
    if (correct && stage.view.supports_ranking) this.hypothesis = choice.label;
    const response = { ...clone(choice.result), ...this.identity(), earned, time_expired: expired, confidence };
    this.displayed = this.view();
    if (!correct) response.stage = this.view();
    else if (this.index + 1 === this.spec.stages.length) {
      this.finished = true;
      Object.assign(response, this.completion());
    } else {
      response.stage = this.view();
      this.index++;
      this.started = this.clock();
      response.next = this.view();
    }
    this.lastResult = clone(response);
    return response;
  }
  error(choice) {
    return choice.result.error_mode ? { error_mode: choice.result.error_mode, error_mode_label: choice.result.error_mode_label } : {};
  }
  calibration() {
    const first = this.transcript.filter((t) => t.first_try && t.confidence !== null);
    const n = first.length;
    return { sample_count: n,
      brier_score: n ? round(first.reduce((a, t) => a + (t.confidence / 100 - Number(t.correct)) ** 2, 0) / n) : null,
      calibration_bias: n ? round(first.reduce((a, t) => a + t.confidence / 100 - Number(t.correct), 0) / n, 2) : null,
      mean_confidence_error: n ? round(first.reduce((a, t) => a + t.confidence_error, 0) / n, 1) : null,
      overconfident_first_misses: first.filter((t) => !t.correct && t.confidence >= 70).map((t) => {
        const i = this.spec.stages.findIndex((s) => s.view.stage_id === t.stage_id);
        return { stage_number: i + 1, decision_kind: this.spec.stages[i].view.decision_kind, confidence: t.confidence };
      }) };
  }
  score() {
    const accuracy = round(this.transcript.filter((t) => t.first_try && t.correct).length / this.spec.stages.length);
    const calibration = this.calibration();
    return { earned: this.transcript.reduce((a, t) => a + t.earned, 0), possible: this.spec.stages.length * points[this.spec.tier], accuracy,
      performance: accuracy === 1 ? 'excellent' : accuracy >= 0.5 ? 'developing' : 'needs practice', tier: this.spec.tier,
      expired_count: this.transcript.filter((t) => t.time_expired).length,
      brier_score: calibration.brier_score, calibration_bias: calibration.calibration_bias };
  }
  completion() {
    const result = clone(this.spec.completion);
    const stages = this.spec.stages.map((s, i) => {
      const attempts = this.transcript.filter((t) => t.stage_id === s.view.stage_id);
      const first = attempts[0];
      return { stage_number: i + 1, investigation: `Investigation ${i + 1}`, stage_id: s.view.stage_id, question: s.view.question,
        first_try: Boolean(first?.correct), attempts: attempts.length, assisted: false, confidence: first?.confidence ?? null,
        confidence_error: first?.confidence_error ?? null, management_error: Boolean(first?.management_error),
        diverged_on_first_attempt: Boolean(first && !first.correct), expert_choice: s.choices.find((c) => c.result.correct).label,
        decision_kind: s.view.decision_kind, concept_id: s.view.concept_id, review_variant_id: s.review_variant_id };
    });
    const divergence = stages.find((s) => s.diverged_on_first_attempt);
    const clinical = { first_divergence: divergence ? { stage_number: divergence.stage_number, stage_id: divergence.stage_id,
      decision_kind: divergence.decision_kind, learner_choice: this.transcript.find((t) => t.stage_id === divergence.stage_id).option_label,
      expert_choice: divergence.expert_choice } : null,
      expert_path: stages.map((s) => ({ stage_id: s.stage_id, decision_kind: s.decision_kind, choice: s.expert_choice })),
      counterfactual: result.clinical_autopsy.counterfactual, calibration: this.calibration(), brier_score: this.calibration().brier_score };
    const queue = [];
    for (const s of stages) {
      const wrong = this.transcript.filter((t) => t.stage_id === s.stage_id && !t.correct);
      if (wrong.length && !queue.some((r) => r.review_variant_id === s.review_variant_id)) queue.push({
        concept_id: s.concept_id, review_variant_id: s.review_variant_id,
        reason: wrong.some((t) => t.confidence !== null && t.confidence >= 70) ? 'high_confidence_wrong' : 'missed' });
    }
    const choiceFor = (t) => this.spec.stages.find((s) => s.view.stage_id === t.stage_id).choices.find((c) => c.id === t.option_id);
    const path = { learner_path: this.transcript.map((t) => ({ stage_id: t.stage_id, choice: t.option_label, correct: t.correct,
      consequence: choiceFor(t).result.consequence || '', ...(!t.correct ? this.error(choiceFor(t)) : {}) })),
      expert_path: stages.map((s) => s.expert_choice), scars: clone(this.scars),
      comparison: stages.map((s) => { const first = this.transcript.find((t) => t.stage_id === s.stage_id);
        return { stage_number: s.stage_number, expert_choice: s.expert_choice, first_try_choice: first?.option_label ?? null,
          matched: Boolean(first?.correct), ...(first && !first.correct ? this.error(choiceFor(first)) : {}) }; }) };
    Object.assign(result, { ...this.identity(), finished: true, score: this.score(), review_status: this.content?.content_version > 1
      ? 'Synthetic educational preview; pending human review' : 'AI-audited educational beta; community review invited',
      stage_autopsy: stages, clinical_autopsy: clinical, reasoning_autopsy: { stages, ...clinical }, review_queue: queue, path_debrief: path,
      visual_autopsy: { score: this.score(), timeline: stages.map((s) => {
        const first = this.transcript.find((t) => t.stage_id === s.stage_id);
        return { stage_number: s.stage_number, stage_id: s.stage_id, decision_kind: s.decision_kind,
          choice: first?.option_label ?? null, correct: Boolean(first?.correct), consequence_media: first ? clone(choiceFor(first).result.consequence_media || null) : null };
      }), first_divergence: clinical.first_divergence, counterfactual: clinical.counterfactual, next_review: queue, differential_reorders: this.reorders } });
    return result;
  }
  resume() { return { ...this.snapshot(), last_result: clone(this.lastResult), displayed_stage: clone(this.displayed || this.view()) }; }
}

const STORY_KEY_PREFIX = 'mmStorySession:v2:';
const FEEDBACK_KEY_PREFIX = 'mmStoryFeedback:v2:';
const LEGACY_KEY = 'mmBetaSessions:v1';
const MAX_SESSION_BYTES = 256 * 1024;
const MAX_LEGACY_BYTES = 4 * 1024 * 1024;
const MAX_ACTIONS = 500;
const MAX_CACHE = 12;
const RATINGS = ['helpful', 'unclear', 'too_easy', 'too_hard'];
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => isRecord(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const validId = (value) => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value);
const validTime = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER / 1000;
const withinBytes = (text, maximum) => typeof text === 'string' && text.length <= maximum
  && (typeof TextEncoder === 'undefined' || new TextEncoder().encode(text).length <= maximum);
const keyFor = (id) => `${STORY_KEY_PREFIX}${id}`;
const savedNote = 'Saved on this browser.';

function contentFor(bundle) {
  return Object.freeze({ build_id: bundle.build_id, content_version: bundle.content_version ?? 1,
    edition_label: bundle.edition_label ?? 'Original story edition' });
}

function recordKeys(record) {
  return Object.hasOwn(record ?? {}, 'rating')
    ? ['id', 'case_id', 'started', 'order', 'actions', 'rating']
    : ['id', 'case_id', 'started', 'order', 'actions'];
}

// Replay uses only bundled case definitions. Saved order, IDs and times are data,
// never authored case content or trusted result/score fields.
function replayRecord(record, edition, clock) {
  check(exactKeys(record, recordKeys(record)) && validId(record.id) && typeof record.case_id === 'string'
    && validTime(record.started) && Array.isArray(record.actions) && record.actions.length <= MAX_ACTIONS
    && (!Object.hasOwn(record, 'rating') || RATINGS.includes(record.rating)), 'Saved case record is damaged');
  const spec = edition.bundle.cases.find((item) => item.case_id === record.case_id);
  check(spec, 'Saved case content is unavailable');
  check(Array.isArray(record.order) && record.order.length === spec.stages.length, 'Saved option order is damaged');
  for (const [index, order] of record.order.entries()) {
    const ids = spec.stages[index].view.options.map((option) => option.id);
    check(Array.isArray(order) && order.length === ids.length && new Set(order).size === ids.length
      && order.every((id) => typeof id === 'string' && ids.includes(id)), 'Saved option order is damaged');
  }
  let replayTime = record.started;
  const session = new OfflineSession(spec, { id: record.id, clock: () => replayTime, order: clone(record.order), content: edition.content });
  for (const action of record.actions) {
    check(exactKeys(action, ['kind', 'args', 'time']) && ['answer', 'examine', 'attach'].includes(action.kind)
      && Array.isArray(action.args) && validTime(action.time) && action.time >= replayTime, 'Saved action is damaged');
    if (action.kind === 'answer') check(action.args.length === 3 && typeof action.args[0] === 'string'
      && (action.args[1] === null || Number.isInteger(action.args[1]))
      && (action.args[2] === null || (Array.isArray(action.args[2]) && action.args[2].every((id) => typeof id === 'string'))), 'Saved answer is damaged');
    if (action.kind === 'examine') check(action.args.length === 1 && typeof action.args[0] === 'string', 'Saved observation is damaged');
    if (action.kind === 'attach') check(action.args.length === 4 && action.args.every((value) => typeof value === 'string'), 'Saved evidence link is damaged');
    replayTime = action.time;
    session[action.kind](...action.args);
  }
  session.clock = clock;
  return session;
}

export function createOfflineAPI(bundle, { storage, clock = () => Date.now() / 1000, legacyBundles = [] } = {}) {
  const registry = new Map();
  for (const candidate of [bundle, ...legacyBundles]) {
    check(candidate?.schema === 1 && typeof candidate.build_id === 'string' && candidate.build_id.length > 0
      && candidate.build_id.length <= 200 && Array.isArray(candidate.cases), 'Unsupported game package version');
    const content = contentFor(candidate);
    check(Number.isSafeInteger(content.content_version) && content.content_version > 0
      && typeof content.edition_label === 'string' && content.edition_label.length > 0, 'Unsupported content edition');
    check(!registry.has(candidate.build_id), 'Duplicate bundled build identity');
    registry.set(candidate.build_id, { bundle: candidate, content });
  }
  const current = registry.get(bundle.build_id);
  const legacyBuilds = new Set((legacyBundles.length ? legacyBundles : [bundle]).map((item) => item.build_id));
  const sessions = new Map();
  const events = new Map();
  const persistence = new Map();

  function unreadable(key, note, session_id) { return { key, note, ...(session_id ? { session_id } : {}) }; }
  function readSlot(id) {
    let text;
    try { text = storage?.getItem(keyFor(id)) ?? null; }
    catch { return { status: 'unavailable', note: 'Browser storage is unavailable; this route could not be read.' }; }
    if (text === null) return { status: 'empty', text: null };
    try {
      check(withinBytes(text, MAX_SESSION_BYTES), 'Saved case exceeds the supported size');
      const envelope = JSON.parse(text);
      check(exactKeys(envelope, ['schema', 'build_id', 'content_version', 'edition_label', 'record']) && envelope.schema === 2,
        'Saved case format is unsupported');
      const edition = registry.get(envelope.build_id);
      check(edition && envelope.content_version === edition.content.content_version
        && envelope.edition_label === edition.content.edition_label, 'Saved case edition is unavailable');
      check(envelope.record?.id === id, 'Saved case identity is damaged');
      const session = replayRecord(envelope.record, edition, clock);
      return { status: 'ok', text, session, record: clone(envelope.record), edition };
    } catch (error) { return { status: 'invalid', text, note: `${error.message}. Its stored bytes were preserved.` }; }
  }

  function readLegacy() {
    let text;
    try { text = storage?.getItem(LEGACY_KEY) ?? null; }
    catch { return { records: new Map(), unreadable: [unreadable(LEGACY_KEY, 'Browser storage is unavailable.')], unavailable: true }; }
    if (text === null) return { records: new Map(), unreadable: [] };
    try {
      check(withinBytes(text, MAX_LEGACY_BYTES), 'Original saved cases exceed the supported size');
      const envelope = JSON.parse(text);
      check(exactKeys(envelope, ['build', 'sessions']) && Array.isArray(envelope.sessions), 'Original saved case format is unsupported');
      const edition = registry.get(envelope.build);
      check(edition && legacyBuilds.has(envelope.build), 'Original saved case build is unavailable');
      const counts = new Map();
      for (const record of envelope.sessions) if (validId(record?.id)) counts.set(record.id, (counts.get(record.id) ?? 0) + 1);
      const records = new Map();
      const damaged = [];
      for (const [index, record] of envelope.sessions.entries()) {
        try {
          check(counts.get(record?.id) === 1, 'Original saved case identity is missing or duplicated');
          const session = replayRecord(record, edition, clock);
          records.set(record.id, { session, record: clone(record), edition });
        } catch (error) { damaged.push(unreadable(LEGACY_KEY, `Entry ${index + 1}: ${error.message}.`, validId(record?.id) ? record.id : undefined)); }
      }
      return { records, unreadable: damaged };
    } catch (error) { return { records: new Map(), unreadable: [unreadable(LEGACY_KEY, `${error.message}. Original bytes were preserved.`)] }; }
  }

  function cache(id, value, rawText = null, fromLegacy = false) {
    sessions.set(id, value.session);
    events.set(id, clone(value.record));
    persistence.set(id, { expected: rawText, status: 'saved', note: savedNote,
      ...(fromLegacy ? { legacyExpected: JSON.stringify(value.record) } : {}) });
    trimCache(id);
    return value.session;
  }

  function trimCache(keep) {
    for (const id of sessions.keys()) {
      if (sessions.size <= MAX_CACHE) break;
      if (id !== keep && persistence.get(id)?.status === 'saved') {
        sessions.delete(id); events.delete(id); persistence.delete(id);
      }
    }
  }

  function load(id) {
    check(validId(id), 'Saved case identity is invalid');
    if (sessions.has(id)) { checkUnchanged(id); return sessions.get(id); }
    const slot = readSlot(id);
    if (slot.status === 'ok') return cache(id, slot, slot.text);
    check(slot.status === 'empty', slot.note || 'Saved case is unavailable');
    const legacy = readLegacy();
    const value = legacy.records.get(id);
    check(value, legacy.unreadable.find((item) => item.session_id === id)?.note || 'Saved case unavailable; its original storage was preserved');
    return cache(id, value, null, true);
  }

  function storageStatus(id, status, note) {
    const state = persistence.get(id) ?? { expected: null };
    Object.assign(state, { status, note });
    persistence.set(id, state);
    return { persistence_status: status, persistence_note: note };
  }

  function persistenceFields(id) {
    const value = persistence.get(id);
    return { persistence_status: value?.status ?? 'unavailable', persistence_note: value?.note ?? 'This route is not saved.' };
  }

  function checkUnchanged(id) {
    const value = persistence.get(id);
    const conflict = () => {
      storageStatus(id, 'conflict', 'Another tab changed this saved route. Reload before continuing; no stored route was overwritten.');
      throw new Error(persistence.get(id).note);
    };
    try {
      if (storage && storage.getItem(keyFor(id)) !== value.expected) conflict();
    } catch (error) {
      if (persistence.get(id)?.status === 'conflict') throw error;
      storageStatus(id, 'unavailable', 'Browser storage is unavailable. This tab can continue, but its new actions are not saved.');
      return false;
    }
    if (value.legacyExpected !== undefined) {
      const legacy = readLegacy();
      if (legacy.unavailable) {
        storageStatus(id, 'unavailable', 'Original browser storage is unavailable. New actions are kept only in this tab.');
        return false;
      }
      const original = legacy.records.get(id);
      if (!original || JSON.stringify(original.record) !== value.legacyExpected) conflict();
    }
    return true;
  }

  function persist(id) {
    const session = sessions.get(id);
    const state = persistence.get(id);
    if (!storage) return storageStatus(id, 'unavailable', 'Browser storage is unavailable. This route is kept only in this tab.');
    try {
      if (!checkUnchanged(id)) return persistenceFields(id);
      const text = JSON.stringify({ schema: 2, ...session.content, record: events.get(id) });
      check(withinBytes(text, MAX_SESSION_BYTES), 'This saved route exceeds the supported size');
      if (storage.getItem(keyFor(id)) !== state.expected) return storageStatus(id, 'conflict', 'Another tab changed this saved route. No stored route was overwritten.');
      storage.setItem(keyFor(id), text);
      state.expected = text;
      delete state.legacyExpected;
      return storageStatus(id, 'saved', savedNote);
    } catch (error) {
      if (persistence.get(id)?.status === 'conflict') return persistenceFields(id);
      return storageStatus(id, 'unsaved', 'This action is kept only in this tab because browser storage could not save it. Existing saved bytes were preserved.');
    }
  }

  function history() {
    const legacy = readLegacy();
    const runs = new Map();
    const damaged = [...legacy.unreadable];
    const blocked = new Set();
    const describe = (session, record, fields = { persistence_status: 'saved', persistence_note: savedNote }) => ({
      ...session.identity(), title: session.spec.title, finished: session.finished, started: record.started,
      ...(session.finished ? { score: session.score() } : {}), ...fields,
    });
    for (const [id, value] of legacy.records) runs.set(id, describe(value.session, value.record));
    let unavailable = Boolean(legacy.unavailable || !storage);
    try {
      check(storage && Number.isSafeInteger(storage.length) && storage.length >= 0 && typeof storage.key === 'function', 'Browser history enumeration is unavailable');
      const keys = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (typeof key === 'string' && key.startsWith(STORY_KEY_PREFIX)) keys.push(key);
      }
      for (const key of keys) {
        const id = key.slice(STORY_KEY_PREFIX.length);
        const slot = validId(id) ? readSlot(id) : { status: 'invalid', note: 'Saved case identity is invalid.' };
        // A newer unreadable slot must not fall through to an older route under the same ID.
        runs.delete(id);
        if (slot.status === 'ok') runs.set(id, describe(slot.session, slot.record));
        else { blocked.add(id); damaged.push(unreadable(key, slot.note || 'Saved case unavailable.', id)); }
      }
    } catch (error) { unavailable = true; }
    for (const [id, session] of sessions) {
      // In-memory valid attempts remain visible after quota failure, clearly marked unsaved.
      if (!blocked.has(id) && persistence.get(id)?.status !== 'saved' && persistence.get(id)?.status !== 'conflict')
        runs.set(id, describe(session, events.get(id), persistenceFields(id)));
    }
    return { ...current.content, runs: [...runs.values()].sort((a, b) => b.started - a.started || a.session_id.localeCompare(b.session_id)),
      unreadable_count: damaged.length, unreadable: damaged,
      persistence_status: unavailable ? 'unavailable' : 'saved',
      persistence_note: unavailable ? 'Some browser storage could not be read. The listed in-memory routes may be incomplete.' : 'History read without changing saved routes.' };
  }

  function saveFeedback(session, rating) {
    if (!storage) return { persistence_status: 'unavailable', persistence_note: 'Rating kept only in this tab; browser storage is unavailable.' };
    const key = `${FEEDBACK_KEY_PREFIX}${session.id}`;
    try {
      const existing = storage.getItem(key);
      if (existing !== null) {
        const raw = JSON.parse(existing);
        check(exactKeys(raw, ['schema', 'session_id', 'build_id', 'content_version', 'rating']) && raw.schema === 2
          && raw.session_id === session.id && raw.build_id === session.content.build_id
          && raw.content_version === session.content.content_version && RATINGS.includes(raw.rating), 'Saved rating is unavailable');
      }
      storage.setItem(key, JSON.stringify({ schema: 2, session_id: session.id,
        build_id: session.content.build_id, content_version: session.content.content_version, rating }));
      return { persistence_status: 'saved', persistence_note: 'Rating saved on this browser.' };
    } catch { return { persistence_status: 'unsaved', persistence_note: 'The local rating could not be saved. Existing saved bytes were preserved.' }; }
  }

  function withPersistence(data, fields) {
    const result = { ...data, ...fields };
    for (const key of ['stage', 'next', 'displayed_stage', 'last_result']) {
      if (isRecord(result[key])) result[key] = withPersistence(result[key], fields);
    }
    return result;
  }

  return async function request(path, options = {}) {
    try {
      const url = new URL(path, 'https://game.invalid');
      const body = options.body ? JSON.parse(options.body) : {};
      let data;
      if (url.pathname === '/api/tiers') data = { ...current.content,
        tiers: Object.fromEntries(['public', 'student', 'doctor'].map((tier) => [tier,
          bundle.cases.filter((item) => item.tier === tier).map((item) => ({ ...current.content, case_id: item.case_id,
            tier, title: item.title, attainable_xp: item.stages.length * points[tier], cover: item.stages[0].view.media }))])),
        editions: [...registry.values()].map((edition) => edition.content), release_mode: false, review_status: 'Synthetic educational preview; pending human review' };
      else if (url.pathname === '/api/history') data = history();
      else if (url.pathname === '/api/start' || url.pathname === '/api/restart') {
        const tier = body.tier || url.searchParams.get('tier') || 'public';
        const caseId = body.case_id || url.searchParams.get('case_id');
        const buildId = Object.hasOwn(body, 'build_id') ? body.build_id : url.searchParams.get('build_id') ?? bundle.build_id;
        const edition = registry.get(buildId);
        check(edition, 'Requested story edition is unavailable');
        const spec = edition.bundle.cases.find((item) => item.tier === tier && (!caseId || item.case_id === caseId));
        check(spec, 'Case not found');
        check(sessions.size < MAX_CACHE || [...persistence.values()].some((value) => value.status === 'saved'),
          'This tab has several unsaved routes. Keep it open and restore browser storage before starting another.');
        const session = new OfflineSession(spec, { clock, content: edition.content });
        check(validTime(session.started), 'Session time is invalid');
        const old = readLegacy();
        check(!sessions.has(session.id) && !old.records.has(session.id)
          && !old.unreadable.some((item) => item.session_id === session.id), 'Session identity already exists');
        const slot = readSlot(session.id);
        check(slot.status === 'empty' || slot.status === 'unavailable', 'Session identity already has saved content');
        sessions.set(session.id, session);
        events.set(session.id, { id: session.id, case_id: spec.case_id, started: session.started, order: clone(session.order), actions: [] });
        persistence.set(session.id, { expected: null, status: 'unavailable', note: 'This route is not saved yet.' });
        const fields = persist(session.id);
        trimCache(session.id);
        data = withPersistence(session.snapshot(), fields);
      } else if (url.pathname === '/api/resume') {
        const id = url.searchParams.get('session_id');
        data = withPersistence(load(id).resume(), persistenceFields(id));
      } else if (['/api/answer', '/api/examine', '/api/attach-evidence'].includes(url.pathname)) {
        const session = load(body.session_id);
        checkUnchanged(session.id);
        const kind = url.pathname === '/api/answer' ? 'answer' : url.pathname === '/api/examine' ? 'examine' : 'attach';
        const args = kind === 'answer' ? [body.option_id, body.confidence ?? null, body.ranking ?? null]
          : kind === 'examine' ? [body.hotspot_id] : [body.stage_id, body.option_id, body.evidence_id, body.stance];
        check(events.get(session.id).actions.length < MAX_ACTIONS, 'Practice session is full; start a new run');
        const time = clock();
        const previous = events.get(session.id).actions.at(-1)?.time ?? events.get(session.id).started;
        check(validTime(time) && time >= previous, 'Session clock moved backwards; retry after the clock is restored');
        // One logged time governs expiry, duration and the next stage's start.
        // Reading the wall clock again inside a mutation would make cold replay differ.
        const liveClock = session.clock;
        session.clock = () => time;
        try { data = session[kind](...args); }
        finally { session.clock = liveClock; }
        events.get(session.id).actions.push({ kind, args, time });
        data = withPersistence(data, persist(session.id));
      } else if (['/api/feedback', '/api/debrief-event'].includes(url.pathname)) {
        const session = load(body.session_id);
        check(session.finished && session.spec.case_id === body.case_id && session.spec.tier === body.tier, 'Complete this case first');
        let fields = persistenceFields(session.id);
        if (url.pathname === '/api/feedback') {
          check(RATINGS.includes(body.rating), 'Invalid feedback rating');
          fields = saveFeedback(session, body.rating);
        }
        data = { ...session.identity(), accepted: true, local_only: true, ...fields };
      } else throw new Error('This feature is not available in the browser beta');
      return { ok: true, status: 200, json: async () => clone(data) };
    } catch (error) { return { ok: false, status: 400, json: async () => ({ error: error.message }) }; }
  };
}
