import { getInvestigationEpisode, restoreInvestigation, investigationOutcome } from './investigation.mjs';

// Derived from bundled authored evidence relations. Stored labels/verdicts are
// never trusted, and opening facts do not require clicking a hotspot.
export function reasoningChoices(state) {
  const canonical = restoreInvestigation(state);
  const episode = canonical && getInvestigationEpisode(canonical.episodeId, canonical.version);
  if (!episode) return { supports: [], uncertainties: [] };
  return {
    supports: [
      ...(episode.reasoning?.openingFacts || []).map((fact) => ({ ...fact, origin: 'Opening handoff' })),
      ...canonical.actionIds.map((id) => ({ id, label: episode.actions.find((action) => action.id === id).label,
        ...(episode.reasoning?.supportRules?.[id] || {}), origin: 'Collected finding' })),
      ...(episode.reasoning?.supportGroups || [])
        .filter((group) => group.requires.every((id) => canonical.actionIds.includes(id)))
        .map((group) => ({ ...group, origin: 'Combined findings' })),
    ],
    uncertainties: (episode.reasoning?.uncertaintyOptions || [])
      .filter((option) => option.requires.every((id) => canonical.actionIds.includes(id))),
  };
}

export function assessInvestigationReasoning(state, reflection = {}) {
  const canonical = restoreInvestigation(state);
  const episode = canonical && getInvestigationEpisode(canonical.episodeId, canonical.version);
  if (!canonical) return { status: 'invalid', label: 'Reasoning unavailable', feedback: 'This route could not be validated.' };
  if (!canonical.completed) return { status: 'draft', label: 'Conclusion not committed', feedback: 'This reflection is a draft until you commit your conclusion.' };
  if (!episode?.reasoning) return { status: 'legacy', label: 'Reasoning reflection', feedback: 'This version records a reflection without a reasoning assessment.' };
  const choices = reasoningChoices(canonical);
  const support = choices.supports.find((item) => item.id === reflection.keyActionId);
  const uncertainty = choices.uncertainties.find((item) => item.id === reflection.uncertaintyId);
  if (!support || !uncertainty) return {
    status: 'not-recorded', label: 'Reasoning not yet demonstrated',
    feedback: 'The answer and its justification are separate. Record a supporting fact and a limitation to explain this route; opening facts are available without extra actions.',
  };
  const outcome = investigationOutcome(canonical);
  const unresolved = canonical.version >= 4 && outcome.kind === 'unresolved';
  const selected = canonical.hypothesisId;
  const counterevidence = canonical.actionIds.map((id) => episode.reasoning?.supportRules?.[id])
    .find((rule) => rule?.conflictsWith?.includes(selected));
  if (counterevidence) return {
    status: 'needs-revision', label: 'Account for the counterevidence',
    feedback: counterevidence.conflictFeedback || 'A finding you collected weakens this explanation. Reconsider the hypothesis alongside that finding rather than relying only on the earlier concern.',
  };
  if (!support.supports?.includes(selected) || support.strength === 'coordination') return {
    status: 'needs-revision', label: 'Justification needs another look',
    feedback: support.strength === 'coordination'
      ? 'A handoff passes on information; it does not independently establish the cause. Choose the finding that supports your hypothesis.'
      : 'Your selected clue does not establish the chosen explanation. Revisit the relation between that clue, the alternatives and the conclusion.',
  };
  if (uncertainty.scope === 'unsupported' || (outcome.status === 'supported' && uncertainty.scope === 'provisional')) return {
    status: 'needs-revision', label: 'Reconsider the remaining uncertainty',
    feedback: uncertainty.scope === 'unsupported'
      ? 'This route does not establish that every competing explanation has been excluded.'
      : unresolved ? 'Your route includes a report-specific limitation. Explain why that supplied record leaves the cause unresolved, rather than relying only on the opening concern.'
        : 'Your route includes a decisive report. Describe what that report supports and the limits that remain, rather than relying only on the opening symptom.',
  };
  if ((uncertainty.forHypotheses && !uncertainty.forHypotheses.includes(selected))
    || (uncertainty.missingAny && !uncertainty.missingAny.some((id) => !canonical.actionIds.includes(id)))) return {
    status: 'needs-revision', label: 'Match the limitation to this route',
    feedback: 'The selected limitation does not fit your hypothesis and the findings available at commitment. Distinguish what is still missing from a result you have already collected.',
  };
  if (outcome.status === 'supported' && support.strength !== 'decisive') return {
    status: 'needs-revision', label: unresolved ? 'Connect uncertainty to the supplied record' : 'Connect your conclusion to its decisive evidence',
    feedback: episode.reasoning.insufficientCitationFeedback || 'You collected a decisive report, but cited an earlier suggestive clue. Identify the evidence that supports the final conclusion.',
  };
  if (outcome.status === 'reconsider') return { status: 'needs-revision', label: 'Revisit the conclusion', feedback: unresolved
    ? 'The supplied findings justify uncertainty about the cause; they do not establish the diagnosis you selected.'
    : 'Your conclusion does not fit the decisive finding recorded on this route.' };
  return {
    status: outcome.status === 'supported' ? 'explained' : 'bounded',
    label: outcome.status === 'supported' ? (unresolved ? 'Evidence limits and uncertainty connected' : 'Evidence and limitation connected') : 'Provisional reasoning recorded',
    feedback: outcome.status === 'supported'
      ? unresolved ? 'You linked the unresolved conclusion to the limitation in the supplied record. This justifies uncertainty about this fictional cause; it does not confirm a diagnosis or establish clinical competence.'
        : 'You linked the conclusion to the decisive finding and acknowledged a limit. This records reasoning in one fictional case; it is not a measure of clinical competence.'
      : 'You identified a relevant concern and kept uncertainty visible. This is a defensible provisional reflection, not a confirmed diagnosis.',
  };
}
