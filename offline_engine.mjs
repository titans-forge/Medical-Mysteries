// Browser-only beta runtime. Authored teaching payloads come from the Python
// engine at build time; this module owns only learner interaction and scoring.
const clone = (value) => JSON.parse(JSON.stringify(value));
const round = (value, places = 3) => Number(value.toFixed(places));
const points = { public: 1, student: 2, doctor: 3 };
const check = (condition, message) => { if (!condition) throw new Error(message); };

export class OfflineSession {
  constructor(spec, { id = `mm-${crypto.randomUUID()}`, clock = () => Date.now() / 1000, order } = {}) {
    this.spec = spec;
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
    view.preview_status = 'EDUCATIONAL BETA · AI-AUDITED';
    view.case_context.preview_status = view.preview_status;
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
    return { hotspot_id: id, label: h.label, finding: h.finding, examined: true,
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
    return { stage_id: stageId, option_id: optionId, evidence_id: evidenceId, stance, differential: clone(this.differential) };
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
    const response = { ...clone(choice.result), earned, time_expired: expired, confidence };
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
    Object.assign(result, { finished: true, score: this.score(), review_status: 'AI-audited educational beta; community review invited',
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

export function createOfflineAPI(bundle, { storage, clock = () => Date.now() / 1000 } = {}) {
  check(bundle.schema === 1, 'Unsupported game package version');
  const sessions = new Map();
  const key = 'mmBetaSessions:v1';
  const events = new Map();
  function load(id) {
    if (sessions.has(id)) return sessions.get(id);
    let stored;
    try { stored = JSON.parse(storage?.getItem(key) || 'null'); } catch { /* unavailable or damaged storage */ }
    const record = stored?.build === bundle.build_id && stored.sessions?.find((s) => s.id === id);
    check(record && Array.isArray(record.actions) && record.actions.length <= 500, 'Saved case unavailable or changed; choose a new case');
    const spec = bundle.cases.find((c) => c.case_id === record.case_id);
    check(spec, 'Saved case unavailable; choose a new case');
    let replayTime = record.started;
    const session = new OfflineSession(spec, { id, clock: () => replayTime, order: record.order });
    try {
      for (const action of record.actions) {
        replayTime = action.time;
        if (action.kind === 'answer') session.answer(...action.args);
        else if (action.kind === 'examine') session.examine(...action.args);
        else if (action.kind === 'attach') session.attach(...action.args);
        else throw new Error('Unknown saved action');
      }
    } catch { throw new Error('Saved case damaged; choose a new case'); }
    session.clock = clock;
    sessions.set(id, session);
    events.set(id, record);
    return session;
  }
  function persist() {
    let old;
    try { old = JSON.parse(storage?.getItem(key) || 'null'); } catch { /* optional */ }
    const records = new Map((old?.build === bundle.build_id && Array.isArray(old.sessions) ? old.sessions : []).map((r) => [r.id, r]));
    for (const [id, value] of events) { records.delete(id); records.set(id, value); }
    try { storage?.setItem(key, JSON.stringify({ build: bundle.build_id, sessions: [...records.values()].slice(-12) })); }
    catch { /* Gameplay remains usable when iframe storage is unavailable. */ }
  }
  return async function request(path, options = {}) {
    try {
      const url = new URL(path, 'https://game.invalid');
      const body = options.body ? JSON.parse(options.body) : {};
      let data;
      if (url.pathname === '/api/tiers') data = { tiers: Object.fromEntries(['public', 'student', 'doctor'].map((tier) => [tier,
        bundle.cases.filter((c) => c.tier === tier).map((c) => ({ case_id: c.case_id, title: c.title, attainable_xp: c.stages.length * points[tier], cover: c.stages[0].view.media }))])),
        release_mode: false, review_status: 'AI-audited educational beta' };
      else if (url.pathname === '/api/start' || url.pathname === '/api/restart') {
        const tier = body.tier || url.searchParams.get('tier') || 'public';
        const caseId = body.case_id || url.searchParams.get('case_id');
        const spec = bundle.cases.find((c) => c.tier === tier && (!caseId || c.case_id === caseId));
        check(spec, 'Case not found');
        const session = new OfflineSession(spec, { clock });
        sessions.set(session.id, session);
        events.set(session.id, { id: session.id, case_id: spec.case_id, started: session.started, order: session.order, actions: [] });
        while (sessions.size > 12) { const oldest = sessions.keys().next().value; sessions.delete(oldest); events.delete(oldest); }
        data = session.snapshot();
        persist();
      } else if (url.pathname === '/api/resume') data = load(url.searchParams.get('session_id')).resume();
      else if (['/api/answer', '/api/examine', '/api/attach-evidence'].includes(url.pathname)) {
        const session = load(body.session_id);
        const kind = url.pathname === '/api/answer' ? 'answer' : url.pathname === '/api/examine' ? 'examine' : 'attach';
        const args = kind === 'answer' ? [body.option_id, body.confidence ?? null, body.ranking ?? null] : kind === 'examine' ? [body.hotspot_id] : [body.stage_id, body.option_id, body.evidence_id, body.stance];
        check(events.get(session.id).actions.length < 500, 'Practice session is full; restart this case');
        const time = clock();
        data = session[kind](...args);
        events.get(session.id).actions.push({ kind, args, time });
        persist();
      } else if (['/api/feedback', '/api/debrief-event'].includes(url.pathname)) {
        const session = load(body.session_id);
        check(session.finished && session.spec.case_id === body.case_id && session.spec.tier === body.tier, 'Complete this case first');
        // No collection endpoint exists in the static beta. Never imply that
        // a developer received a local rating; community reports live on itch.
        if (url.pathname === '/api/feedback') {
          check(['helpful', 'unclear', 'too_easy', 'too_hard'].includes(body.rating), 'invalid feedback rating');
          events.get(session.id).rating = body.rating;
          persist();
        }
        data = { accepted: true, local_only: true };
      } else throw new Error('This feature is not available in the browser beta');
      return { ok: true, status: 200, json: async () => clone(data) };
    } catch (error) { return { ok: false, status: 400, json: async () => ({ error: error.message }) }; }
  };
}
