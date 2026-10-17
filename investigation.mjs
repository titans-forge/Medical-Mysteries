import { getLegacyInvestigationEpisode, V3_INVESTIGATION_CONTENT } from './investigation_content_versions.mjs';
import { buildCurrentInvestigations } from './investigation_variants.mjs';
import { createCareWorkflow, replayCareWorkflow, appendCareEvent } from './care_workflow.mjs';
const AORTIC_HYPOTHESIS = 'acute-aortic-syndrome';
const VALID_MODES = new Set(['guided', 'challenge']);

export const INVESTIGATION_EPISODES = buildCurrentInvestigations(V3_INVESTIGATION_CONTENT.map(({ episode }) => episode));
export const INVESTIGATION_EPISODE = INVESTIGATION_EPISODES.find((episode) => episode.id === 'doc-002-tearing-back-investigation');
const EPISODES = new Map(INVESTIGATION_EPISODES.map((episode) => [episode.id, episode]));
const STATE_KEYS = ['version', 'episodeId', 'mode', 'actionIds', 'elapsedMinutes', 'hypothesisId', 'hypothesisHistory', 'conclusion', 'completed'];
const HISTORY_KEYS = ['hypothesisId', 'afterActionCount'];
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasExactKeys = (value, keys) => isRecord(value)
  && Object.keys(value).length === keys.length
  && keys.every((key) => Object.hasOwn(value, key));
const isSafeInteger = (value, minimum = 0) => Number.isSafeInteger(value) && value >= minimum;

export function getInvestigationEpisode(id, version) {
  if (typeof id !== 'string') return null;
  const current = EPISODES.get(id);
  if (version === undefined || current?.version === version) return current ?? null;
  return getLegacyInvestigationEpisode(id, version);
}

export function getInvestigationPresentation(id, version) {
  const episode = getInvestigationEpisode(id, version);
  if (!episode) return null;
  return episode.presentation
    ? { ...episode.presentation }
    : {
      audience: 'doctor',
      playMinutes: '5-8',
      image: './assets/episodes/doc-002-aorta-escalation-720.webp',
      imageAlt: 'Fictional nightshift assessment scene',
    };
}

function details(episode) {
  return {
    actionById: new Map(episode.actions.map((action) => [action.id, action])),
    hypothesisById: new Map(episode.hypotheses.map((hypothesis) => [hypothesis.id, hypothesis])),
  };
}

function makeInitialState(mode, episode) {
  return {
    version: episode.version,
    episodeId: episode.id,
    mode,
    actionIds: [],
    elapsedMinutes: 0,
    hypothesisId: null,
    hypothesisHistory: [],
    conclusion: null,
    completed: false,
    ...(episode.careWorkflow ? { workflow: createCareWorkflow() } : {}),
  };
}

function copyState(state) {
  return {
    ...state,
    actionIds: [...state.actionIds],
    hypothesisHistory: state.hypothesisHistory.map((entry) => ({ ...entry })),
    conclusion: state.conclusion ? { ...state.conclusion } : null,
    ...(state.workflow ? { workflow: JSON.parse(JSON.stringify(state.workflow)) } : {}),
  };
}

function applyActionIds(actionIds, episode) {
  const { actionById } = details(episode);
  const applied = [];
  let elapsedMinutes = 0;
  for (const actionId of actionIds) {
    const action = actionById.get(actionId);
    if (!action || applied.includes(actionId) || action.requires.some((required) => !applied.includes(required))) {
      return null;
    }
    applied.push(actionId);
    elapsedMinutes += action.minutes;
  }
  return { actionIds: applied, elapsedMinutes };
}

function replayHistory(history, actionCount, episode) {
  if (history.length > 256) return null;
  const { hypothesisById } = details(episode);
  let hypothesisId = null;
  const canonical = [];
  for (const entry of history) {
    if (!hasExactKeys(entry, HISTORY_KEYS)
      || !hypothesisById.has(entry.hypothesisId)
      || !isSafeInteger(entry.afterActionCount)
      || entry.afterActionCount > actionCount
      || (canonical.length && entry.afterActionCount < canonical.at(-1).afterActionCount)
      || entry.hypothesisId === hypothesisId) {
      return null;
    }
    hypothesisId = entry.hypothesisId;
    canonical.push({ hypothesisId, afterActionCount: entry.afterActionCount });
  }
  return { hypothesisId, hypothesisHistory: canonical };
}

function resolutionFor(episode) {
  if (episode.resolution) return episode.resolution;
  return {
    hypothesisId: AORTIC_HYPOTHESIS,
    evidenceActionIds: ['aortic-cta'],
    supportedSummary: 'The CTA supplied the decisive fictional clue for acute aortic syndrome; the competing hypotheses remain part of the reasoning record.',
    mismatchSummary: 'The selected hypothesis does not match the decisive fictional CTA clue; the competing hypotheses were intentionally kept visible.',
    provisionalSummary: 'This conclusion remains a provisional working hypothesis: the route ended before CTA, so the fictional diagnosis is not confirmed.',
    decisiveClue: 'The authored fictional CTA report described an intimal flap in the ascending aorta extending into the arch.',
    missingClue: 'No decisive clue was reached because CTA was not completed.',
    nextLearning: 'Treat abrupt tearing pain and a reproducible inter-arm pressure difference as a reason to clarify an aortic process before anchoring on a small ECG change.',
    limitations: [
      'This is a bounded synthetic episode pending human review; measurements, reports, and timing are authored fiction, not source facts.',
      'Action durations are synthetic, non-real-time, and non-prognostic. No deaths, outcomes, dosages, or treatment recommendations are modeled.',
      'The ACC/AHA guideline is cited for educational framing only; this module does not diagnose, prescribe, or replace clinical judgment.',
    ],
  };
}

function canonicalize(raw) {
  if (!isRecord(raw)) return null;
  const episode = getInvestigationEpisode(raw.episodeId, raw.version);
  if (!episode || !hasExactKeys(raw, episode.careWorkflow ? [...STATE_KEYS, 'workflow'] : STATE_KEYS)) return null;
  if (!episode
    || raw.version !== episode.version
    || !VALID_MODES.has(raw.mode)
    || !Array.isArray(raw.actionIds)
    || !Array.isArray(raw.hypothesisHistory)
    || !isSafeInteger(raw.elapsedMinutes)
    || !isSafeInteger(raw.actionIds.length)
    || !raw.actionIds.every((id) => typeof id === 'string')
    || (raw.hypothesisId !== null && !details(episode).hypothesisById.has(raw.hypothesisId))
    || !raw.hypothesisHistory.every(isRecord)
    || (raw.conclusion !== null && !hasExactKeys(raw.conclusion, ['hypothesisId', 'correct', 'evidenceComplete']))) {
    return null;
  }
  const actions = applyActionIds(raw.actionIds, episode);
  if (!actions || actions.elapsedMinutes !== raw.elapsedMinutes) return null;
  const history = replayHistory(raw.hypothesisHistory, actions.actionIds.length, episode);
  if (!history || history.hypothesisId !== raw.hypothesisId) return null;
  const care = episode.careWorkflow ? replayCareWorkflow(raw.workflow, episode) : null;
  if (episode.careWorkflow && (!care
    || JSON.stringify(care.reviewedActionIds) !== JSON.stringify(actions.actionIds)
    || care.hypothesisId !== history.hypothesisId
    || JSON.stringify(care.hypothesisHistory) !== JSON.stringify(history.hypothesisHistory))) return null;
  if (raw.completed !== (raw.conclusion !== null)) return null;

  const resolution = resolutionFor(episode);
  const { hypothesisById } = details(episode);
  if (raw.conclusion
    && (!hypothesisById.has(raw.conclusion.hypothesisId)
      || typeof raw.conclusion.correct !== 'boolean'
      || typeof raw.conclusion.evidenceComplete !== 'boolean'
      || raw.conclusion.hypothesisId !== history.hypothesisId
      || raw.conclusion.correct !== (raw.conclusion.hypothesisId === resolution.hypothesisId)
      || raw.conclusion.evidenceComplete !== resolution.evidenceActionIds.every((id) => actions.actionIds.includes(id)))) {
    return null;
  }
  return {
    ...makeInitialState(raw.mode, episode),
    actionIds: actions.actionIds,
    elapsedMinutes: actions.elapsedMinutes,
    hypothesisId: history.hypothesisId,
    hypothesisHistory: history.hypothesisHistory,
    conclusion: raw.conclusion ? { ...raw.conclusion } : null,
    completed: raw.completed,
    ...(care ? { workflow: care.workflow } : {}),
  };
}

export function createInvestigation(mode = 'guided', episodeId = INVESTIGATION_EPISODE.id, version) {
  const episode = getInvestigationEpisode(episodeId, version);
  return episode && VALID_MODES.has(mode) ? makeInitialState(mode, episode) : null;
}

export function restoreInvestigation(raw) {
  return canonicalize(raw);
}

export function availableActions(state) {
  const canonical = canonicalize(state);
  if (!canonical || canonical.completed) return [];
  const episode = getInvestigationEpisode(canonical.episodeId, canonical.version);
  const care = episode.careWorkflow ? replayCareWorkflow(canonical.workflow, episode) : null;
  return episode.actions
    .filter((action) => care ? care.tasks.some((task) => task.actionId === action.id && task.status === 'available')
      : !canonical.actionIds.includes(action.id) && action.requires.every((required) => canonical.actionIds.includes(required)))
    .map((action) => canonical.mode === 'guided'
      ? { ...action, requires: [...action.requires], sourceIds: [...action.sourceIds] }
      : {
        id: action.id,
        label: action.label,
        category: action.category,
        minutes: action.minutes,
        requires: [...action.requires],
        finding: action.finding,
        sourceIds: [...action.sourceIds],
      });
}

export function investigate(state, actionId) {
  const canonical = canonicalize(state);
  if (!canonical || canonical.completed || typeof actionId !== 'string') return null;
  if (canonical.workflow) return reviewCareTask(canonical, actionId);
  if (canonical.actionIds.includes(actionId)) return copyState(canonical);
  if (!availableActions(canonical).some((action) => action.id === actionId)) return null;
  const action = details(getInvestigationEpisode(canonical.episodeId, canonical.version)).actionById.get(actionId);
  return {
    ...canonical,
    actionIds: [...canonical.actionIds, actionId],
    elapsedMinutes: canonical.elapsedMinutes + action.minutes,
  };
}

export function setHypothesis(state, hypothesisId) {
  const canonical = canonicalize(state);
  if (!canonical || canonical.completed) return null;
  const { hypothesisById } = details(getInvestigationEpisode(canonical.episodeId, canonical.version));
  if (!hypothesisById.has(hypothesisId)) return null;
  if (canonical.hypothesisId === hypothesisId) return copyState(canonical);
  if (canonical.hypothesisHistory.length >= 256) return null;
  if (canonical.workflow) return applyCareEvent(canonical, { type: 'hypothesis', hypothesisId });
  return {
    ...canonical,
    hypothesisId,
    hypothesisHistory: [...canonical.hypothesisHistory, { hypothesisId, afterActionCount: canonical.actionIds.length }],
  };
}

export function concludeInvestigation(state, hypothesisId) {
  const canonical = canonicalize(state);
  if (canonical?.conclusion) return copyState(canonical);
  const selected = setHypothesis(canonical, hypothesisId);
  if (!selected) return null;
  const resolution = resolutionFor(getInvestigationEpisode(selected.episodeId, selected.version));
  return {
    ...selected,
    conclusion: {
      hypothesisId,
      correct: hypothesisId === resolution.hypothesisId,
      evidenceComplete: resolution.evidenceActionIds.every((id) => selected.actionIds.includes(id)),
    },
    completed: true,
  };
}

export function investigationDebrief(state) {
  const canonical = canonicalize(state);
  if (!canonical?.conclusion) return null;
  const episode = getInvestigationEpisode(canonical.episodeId, canonical.version);
  const resolution = resolutionFor(episode);
  const { actionById, hypothesisById } = details(episode);
  const complete = resolution.evidenceActionIds.every((id) => canonical.actionIds.includes(id));
  return {
    correct: canonical.conclusion.correct,
    summary: !complete
      ? resolution.provisionalSummary
      : canonical.conclusion.correct
        ? resolution.supportedSummary
        : resolution.mismatchSummary,
    decisiveClue: complete ? resolution.decisiveClue : resolution.missingClue,
    outcome: investigationOutcome(canonical),
    evidenceSummary: canonical.actionIds.length
      ? `At commitment, you had the opening handoff and ${canonical.actionIds.length} collected finding${canonical.actionIds.length === 1 ? '' : 's'}. Additional teaching below was not part of that evidence.`
      : 'At commitment, you had only the opening handoff and no collected investigation findings. Your conclusion is provisional.',
    nextLearning: episode.reasoning
      ? episode.reasoning.caseLearningText || 'Separate a concerning presentation, a limited finding, and evidence that supports a specific conclusion. State what remains uncertain.'
      : resolution.nextLearning,
    additionalTeaching: episode.actions.filter((action) => !canonical.actionIds.includes(action.id))
      .map((action) => ({ label: action.label, interpretation: action.interpretation })),
    route: canonical.actionIds.map((id) => {
      const action = actionById.get(id);
      return { label: action.label, finding: action.finding, minutes: action.minutes };
    }),
    hypothesisChanges: canonical.hypothesisHistory.map((entry) => ({
      ...entry,
      label: hypothesisById.get(entry.hypothesisId).label,
    })),
    limitations: [...resolution.limitations],
    sources: episode.sources.map((source) => ({ ...source })),
    ...(episode.careWorkflow ? { careWorkflow: getCareWorkflow(canonical).assessment } : {}),
    ...(canonical.version >= 4 ? { kind: resolution.conclusionKind ?? 'diagnostic',
      clinicalConfirmation: investigationOutcome(canonical).clinicalConfirmation,
      patientUpdates: (getCareWorkflow(canonical)?.patientUpdates ?? []).map((update) => ({ id: update.id, text: update.text,
        response: update.response ? { ...update.response } : null, responseAttempts: update.responseAttempts.map((attempt) => ({ ...attempt })) })) } : {}),
  };
}

// These labels describe a bounded fictional conclusion, not clinical competence.
export function investigationOutcome(state) {
  const canonical = canonicalize(state);
  if (canonical?.version >= 4) {
    const resolution = resolutionFor(getInvestigationEpisode(canonical.episodeId, canonical.version));
    const kind = resolution.conclusionKind ?? 'diagnostic';
    const result = !canonical.completed ? { status: 'in-progress', label: 'In progress' }
      : !canonical.conclusion.evidenceComplete ? { status: 'provisional', label: 'Provisional' }
        : !canonical.conclusion.correct ? { status: 'reconsider', label: 'Needs reconsideration' }
          : { status: 'supported', label: kind === 'unresolved' ? 'Uncertainty justified · cause unresolved' : 'Supported' };
    return { ...result, kind, clinicalConfirmation: result.status === 'supported' && kind === 'diagnostic' };
  }
  if (!canonical?.completed) return { status: 'in-progress', label: 'In progress' };
  if (!canonical.conclusion.evidenceComplete) return { status: 'provisional', label: 'Provisional' };
  return canonical.conclusion.correct
    ? { status: 'supported', label: 'Supported' }
    : { status: 'reconsider', label: 'Needs reconsideration' };
}

// v3 care events are replayed against bundled content; earlier editions keep their original state shape.
function applyCareEvent(state, event) {
  const canonical = canonicalize(state);
  if (!canonical?.workflow || canonical.completed) return null;
  const episode = getInvestigationEpisode(canonical.episodeId, canonical.version);
  const care = appendCareEvent(canonical.workflow, event, episode);
  if (!care) return null;
  const actions = applyActionIds(care.reviewedActionIds, episode);
  return canonicalize({ ...canonical, workflow: care.workflow, actionIds: actions.actionIds,
    elapsedMinutes: actions.elapsedMinutes, hypothesisId: care.hypothesisId, hypothesisHistory: care.hypothesisHistory });
}

export function getCareWorkflow(state) {
  const canonical = canonicalize(state);
  if (!canonical?.workflow) return null;
  return replayCareWorkflow(canonical.workflow, getInvestigationEpisode(canonical.episodeId, canonical.version));
}

export const chooseCarePriority = (state, choiceId) => applyCareEvent(state, { type: 'priority', choiceId });
export const requestCareTask = (state, actionId) => applyCareEvent(state, { type: 'request', actionId });
export const advanceCareUpdate = (state) => applyCareEvent(state, { type: 'update' });
export const reviewCareTask = (state, actionId) => applyCareEvent(state, { type: 'review', actionId });
export const reassessCare = (state, choiceId) => applyCareEvent(state, { type: 'reassess', choiceId });
export const sendCareHandoff = (state, selections) => applyCareEvent(state, { type: 'handoff', selections });
export const acknowledgeCareHandoff = (state, handoffId, choiceId) => applyCareEvent(state, { type: 'readback', handoffId, choiceId });

export const respondCareUpdate = (state, updateId, choiceId) => applyCareEvent(state, { type: 'patient-response', updateId, choiceId });
