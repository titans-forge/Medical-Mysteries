const EPISODE_VERSION = 1;
const AORTIC_HYPOTHESIS = 'acute-aortic-syndrome';
const VALID_MODES = new Set(['guided', 'challenge']);

const SOURCE = Object.freeze({
  title: '2022 ACC/AHA Guideline for the Diagnosis and Management of Aortic Disease',
  url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10784847/',
});

const HYPOTHESES = Object.freeze([
  Object.freeze({ id: AORTIC_HYPOTHESIS, label: 'Acute aortic syndrome' }),
  Object.freeze({ id: 'acute-coronary-syndrome', label: 'Acute coronary syndrome' }),
  Object.freeze({ id: 'pulmonary-embolism', label: 'Pulmonary embolism' }),
]);

const ACTIONS = Object.freeze([
  Object.freeze({
    id: 'symptom-timeline',
    label: 'Build the symptom timeline',
    category: 'history',
    minutes: 4,
    requires: Object.freeze([]),
    finding: 'Authored fictional history: abrupt chest pain was maximal at onset and moved through to the back.',
    interpretation: 'The onset and radiation are high-risk features, but they do not identify one diagnosis by themselves.',
    sourceIds: Object.freeze([0]),
  }),
  Object.freeze({
    id: 'focused-examination',
    label: 'Perform a focused examination',
    category: 'examination',
    minutes: 6,
    requires: Object.freeze([]),
    finding: 'Authored fictional measurement: arm pressures are 178/105 on the right and 142/88 on the left; the difference is reproducible.',
    interpretation: 'The fictional inter-arm difference increases concern for an aortic process and keeps premature coronary anchoring unsafe.',
    sourceIds: Object.freeze([0]),
  }),
  Object.freeze({
    id: 'ecg',
    label: 'Review the ECG',
    category: 'cardiac',
    minutes: 5,
    requires: Object.freeze([]),
    finding: 'Authored fictional tracing: a small, nonspecific ST change is present in aVL without a complete diagnostic pattern.',
    interpretation: 'This finding keeps acute coronary syndrome in the differential but is not decisive and cannot erase the aortic warning signs.',
    sourceIds: Object.freeze([0]),
  }),
  Object.freeze({
    id: 'chest-radiograph',
    label: 'Review the chest radiograph',
    category: 'imaging',
    minutes: 5,
    requires: Object.freeze([]),
    finding: 'Authored fictional radiograph: the mediastinal contour is described as subtly widened, with no single definitive answer.',
    interpretation: 'A plain chest radiograph cannot exclude acute aortic syndrome; this fictional image is an ambiguity-preserving clue, not a diagnosis.',
    sourceIds: Object.freeze([0]),
  }),
  Object.freeze({
    id: 'aortic-cta',
    label: 'Obtain CT angiography of the aorta',
    category: 'imaging',
    minutes: 12,
    requires: Object.freeze([]),
    finding: 'Authored fictional CTA report: an intimal flap is seen in the ascending aorta and extends into the arch.',
    interpretation: 'In this fictional episode, the CTA is the decisive clue favoring acute aortic syndrome over the competing hypotheses.',
    sourceIds: Object.freeze([0]),
  }),
  Object.freeze({
    id: 'specialist-handoff',
    label: 'Make a specialist handoff',
    category: 'coordination',
    minutes: 8,
    requires: Object.freeze(['aortic-cta']),
    finding: 'The fictional handoff carries the symptom report and CTA finding; it does not imply that other observations were performed.',
    interpretation: 'A structured handoff preserves uncertainty and the decisive clue for human review; it does not model treatment or outcome.',
    sourceIds: Object.freeze([0]),
  }),
]);

// Preserve the legacy episode object and its JSON shape exactly.
export const INVESTIGATION_EPISODE = Object.freeze({
  id: 'doc-002-tearing-back-investigation',
  version: EPISODE_VERSION,
  title: 'The Night Shift',
  subtitle: 'A bounded, synthetic evidence-discovery episode',
  opening: 'A 61-year-old arrives with sudden severe chest discomfort. The team is already arranging urgent assessment. The initial handoff is incomplete.',
  disclaimer: 'Educational game only. All measurements and events in this investigation are authored fictional content pending human review, not clinical advice or source facts.',
  hypotheses: HYPOTHESES,
  sources: Object.freeze([SOURCE]),
  actions: ACTIONS,
});

import { ADDITIONAL_INVESTIGATIONS } from './investigation_cases.mjs';

export const INVESTIGATION_EPISODES = Object.freeze([
  INVESTIGATION_EPISODE,
  ...ADDITIONAL_INVESTIGATIONS,
]);
const EPISODES = new Map(INVESTIGATION_EPISODES.map((episode) => [episode.id, episode]));
const STATE_KEYS = ['version', 'episodeId', 'mode', 'actionIds', 'elapsedMinutes', 'hypothesisId', 'hypothesisHistory', 'conclusion', 'completed'];
const HISTORY_KEYS = ['hypothesisId', 'afterActionCount'];
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasExactKeys = (value, keys) => isRecord(value)
  && Object.keys(value).length === keys.length
  && keys.every((key) => Object.hasOwn(value, key));
const isSafeInteger = (value, minimum = 0) => Number.isSafeInteger(value) && value >= minimum;

export function getInvestigationEpisode(id) {
  return typeof id === 'string' ? EPISODES.get(id) ?? null : null;
}

export function getInvestigationPresentation(id) {
  const episode = getInvestigationEpisode(id);
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
  };
}

function copyState(state) {
  return {
    ...state,
    actionIds: [...state.actionIds],
    hypothesisHistory: state.hypothesisHistory.map((entry) => ({ ...entry })),
    conclusion: state.conclusion ? { ...state.conclusion } : null,
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
  if (!hasExactKeys(raw, STATE_KEYS)) return null;
  const episode = getInvestigationEpisode(raw.episodeId);
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
  };
}

export function createInvestigation(mode = 'guided', episodeId = INVESTIGATION_EPISODE.id) {
  const episode = getInvestigationEpisode(episodeId);
  return episode && VALID_MODES.has(mode) ? makeInitialState(mode, episode) : null;
}

export function restoreInvestigation(raw) {
  return canonicalize(raw);
}

export function availableActions(state) {
  const canonical = canonicalize(state);
  if (!canonical || canonical.completed) return [];
  const episode = getInvestigationEpisode(canonical.episodeId);
  return episode.actions
    .filter((action) => !canonical.actionIds.includes(action.id)
      && action.requires.every((required) => canonical.actionIds.includes(required)))
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
  if (canonical.actionIds.includes(actionId)) return copyState(canonical);
  if (!availableActions(canonical).some((action) => action.id === actionId)) return null;
  const action = details(getInvestigationEpisode(canonical.episodeId)).actionById.get(actionId);
  return {
    ...canonical,
    actionIds: [...canonical.actionIds, actionId],
    elapsedMinutes: canonical.elapsedMinutes + action.minutes,
  };
}

export function setHypothesis(state, hypothesisId) {
  const canonical = canonicalize(state);
  if (!canonical || canonical.completed) return null;
  const { hypothesisById } = details(getInvestigationEpisode(canonical.episodeId));
  if (!hypothesisById.has(hypothesisId)) return null;
  if (canonical.hypothesisId === hypothesisId) return copyState(canonical);
  if (canonical.hypothesisHistory.length >= 256) return null;
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
  const resolution = resolutionFor(getInvestigationEpisode(selected.episodeId));
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
  const episode = getInvestigationEpisode(canonical.episodeId);
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
    nextLearning: resolution.nextLearning,
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
  };
}
