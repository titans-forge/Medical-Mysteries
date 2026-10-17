// Pure replay of bundled fictional coordination choices. No wall clock or outcome model.
const MAX_EVENTS = 128;
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const copy = (value) => JSON.parse(JSON.stringify(value));
const fields = ['receiver', 'situation', 'uncertainty', 'nextOwner'];
const selectionKeys = ['receiverId', 'situationId', 'uncertaintyId', 'nextOwnerId'];
const available = (choice, reviewed) => choice && (choice.requires ?? []).every((id) => reviewed.includes(id));
const pick = (section, id, reviewed) => section?.choices?.find((choice) => choice.id === id && available(choice, reviewed));
const reassessmentFor = (profile, reviewed) => profile.reassessment.variants?.find((variant) => available(variant, reviewed)) ?? profile.reassessment;
export const createCareWorkflow = () => ({ version: 1, events: [] });

export function replayCareWorkflow(raw, episode) {
  const profile = episode?.careWorkflow;
  if (!profile || !exact(raw, ['version', 'events']) || raw.version !== 1
    || !Array.isArray(raw.events) || raw.events.length > MAX_EVENTS) return null;
  const actions = new Map(episode.actions.map((action) => [action.id, action]));
  const hypotheses = new Set(episode.hypotheses.map((hypothesis) => hypothesis.id));
  const patientDefinitions = episode.version >= 4 ? profile.patientUpdates ?? [] : [];
  if (!Array.isArray(patientDefinitions) || new Set(patientDefinitions.map((value) => value.id)).size !== patientDefinitions.length
    || patientDefinitions.some((value) => !object(value) || typeof value.id !== 'string' || !value.id
      || !Number.isSafeInteger(value.afterRound) || value.afterRound < 1
      || !Array.isArray(value.requiresReviewed) || !value.requiresReviewed.every((id) => actions.has(id))
      || typeof value.text !== 'string' || !Array.isArray(value.choices))) return null;
  const patientUpdates = new Map();
  const requested = new Map();
  const reviewed = [];
  const events = [];
  const handoffs = [];
  const reassessments = [];
  const priorityAttempts = [];
  const hypothesisHistory = [];
  let hypothesisId = null;
  let round = 0;
  let knowledgeRevision = 0;
  let coordinationRevision = 0;
  let firstUpdate = null;
  const futurePatientUpdate = () => patientDefinitions.some((value) => !patientUpdates.has(value.id)
    && value.afterRound > round && value.requiresReviewed.every((id) => reviewed.includes(id)));
  const releasePatientUpdates = (eventIndex) => {
    for (const definition of patientDefinitions) {
      if (!patientUpdates.has(definition.id) && round >= definition.afterRound
        && definition.requiresReviewed.every((id) => reviewed.includes(id))) {
        knowledgeRevision++;
        coordinationRevision++;
        patientUpdates.set(definition.id, { ...definition, releasedAtEvent: eventIndex, releasedAtRound: round,
          knowledgeRevision, response: null, responseAttempts: [] });
      }
    }
  };
  for (const input of raw.events) {
    if (!object(input) || typeof input.type !== 'string') return null;
    const index = events.length;
    let event;
    if (input.type === 'priority') {
      if (!exact(input, ['type', 'choiceId']) || priorityAttempts.at(-1)?.choiceId === input.choiceId) return null;
      const choice = pick(profile.priority, input.choiceId, reviewed);
      if (!choice) return null;
      priorityAttempts.push({ ...choice, choiceId: choice.id, beforeDispatch: requested.size === 0,
        beforeFirstUpdate: firstUpdate === null, reviewedActionIds: [...reviewed], updateRound: round, eventIndex: index });
      event = { type: 'priority', choiceId: input.choiceId };
    } else if (input.type === 'request') {
      if (!exact(input, ['type', 'actionId']) || requested.has(input.actionId)) return null;
      const action = actions.get(input.actionId);
      const task = profile.tasks?.[input.actionId];
      if (!action || !task || ![1, 2].includes(task.rounds)
        || typeof task.owner !== 'string' || !task.owner
        || !action.requires.every((id) => reviewed.includes(id))) return null;
      requested.set(input.actionId, { actionId: input.actionId, label: task.label || action.label,
        owner: task.owner, requestedRound: round, readyRound: round + task.rounds });
      coordinationRevision++;
      event = { type: 'request', actionId: input.actionId };
    } else if (input.type === 'update') {
      if (!exact(input, ['type']) || (!futurePatientUpdate() && ![...requested.values()].some((task) => !reviewed.includes(task.actionId) && task.readyRound > round))) return null;
      if (firstUpdate === null) firstUpdate = { eventIndex: index, priority: priorityAttempts.at(-1) ?? null };
      round++;
      knowledgeRevision++;
      coordinationRevision++;
      event = { type: 'update' };
    } else if (input.type === 'review') {
      if (!exact(input, ['type', 'actionId'])) return null;
      const task = requested.get(input.actionId);
      const action = actions.get(input.actionId);
      if (!task || task.readyRound > round || reviewed.includes(input.actionId)
        || !action.requires.every((id) => reviewed.includes(id))) return null;
      reviewed.push(input.actionId);
      knowledgeRevision++;
      coordinationRevision++;
      event = { type: 'review', actionId: input.actionId };
    } else if (input.type === 'hypothesis') {
      if (!exact(input, ['type', 'hypothesisId']) || !hypotheses.has(input.hypothesisId) || hypothesisId === input.hypothesisId) return null;
      hypothesisId = input.hypothesisId;
      hypothesisHistory.push({ hypothesisId, afterActionCount: reviewed.length });
      knowledgeRevision++;
      coordinationRevision++;
      event = { type: 'hypothesis', hypothesisId };
    } else if (input.type === 'reassess') {
      if (!exact(input, ['type', 'choiceId']) || reviewed.length < (profile.reassessment.minimumReviewed ?? 1)) return null;
      const previous = reassessments.at(-1);
      if (previous?.knowledgeRevision === knowledgeRevision && previous.choiceId === input.choiceId) return null;
      const question = reassessmentFor(profile, reviewed);
      const choice = pick(question, input.choiceId, reviewed);
      if (!choice) return null;
      reassessments.push({ ...choice, choiceId: choice.id, questionId: question.id ?? 'base', prompt: question.prompt, eventIndex: index, hypothesisId,
        reviewedActionIds: [...reviewed], updateRound: round, knowledgeRevision });
      event = { type: 'reassess', choiceId: input.choiceId };
    } else if (input.type === 'patient-response') {
      if (!exact(input, ['type', 'updateId', 'choiceId'])) return null;
      const update = patientUpdates.get(input.updateId);
      if (!update || update.response?.choiceId === input.choiceId) return null;
      const choice = pick(update, input.choiceId, reviewed);
      if (!choice) return null;
      coordinationRevision++;
      update.response = { ...choice, choiceId: choice.id, eventIndex: index,
        reviewedActionIds: [...reviewed], updateRound: round, knowledgeRevision };
      update.responseAttempts.push(update.response);
      event = { type: 'patient-response', updateId: input.updateId, choiceId: input.choiceId };
    } else if (input.type === 'handoff') {
      if (!exact(input, ['type', 'selections']) || !exact(input.selections, selectionKeys)) return null;
      const choices = {};
      for (const field of fields) {
        const choice = pick(profile.handoff?.[field], input.selections[`${field}Id`], reviewed);
        if (!choice) return null;
        choices[field] = { ...choice };
      }
      const previous = handoffs.at(-1);
      if (previous && previous.coordinationRevision === coordinationRevision
        && JSON.stringify(previous.selections) === JSON.stringify(input.selections)) return null;
      const tasks = [...requested.values()];
      handoffs.push({ id: `handoff-${index}`, eventIndex: index, selections: { ...input.selections }, choices, hypothesisId,
        reviewedActionIds: [...reviewed], pendingTaskIds: tasks.filter((task) => task.readyRound > round).map((task) => task.actionId),
        availableTaskIds: tasks.filter((task) => task.readyRound <= round && !reviewed.includes(task.actionId)).map((task) => task.actionId),
        updateRound: round, knowledgeRevision, coordinationRevision,
        reviewedFindings: reviewed.map((actionId) => { const action = actions.get(actionId); return { actionId, label: action.label, finding: action.finding }; }),
        pendingTasks: tasks.filter((task) => task.readyRound > round).map((task) => ({ ...task })),
        availableTasks: tasks.filter((task) => task.readyRound <= round && !reviewed.includes(task.actionId)).map((task) => ({ ...task })),
        ...(patientDefinitions.length ? { patientUpdates: [...patientUpdates.values()].map((value) => ({ id: value.id, text: value.text,
          releasedAtEvent: value.releasedAtEvent, releasedAtRound: value.releasedAtRound, response: value.response ? copy(value.response) : null })) } : {}),
        readback: null, readbackAttempts: [] });
      event = { type: 'handoff', selections: { ...input.selections } };
    } else if (input.type === 'readback') {
      if (!exact(input, ['type', 'handoffId', 'choiceId'])) return null;
      const handoff = handoffs.at(-1);
      if (!handoff || handoff.id !== input.handoffId || handoff.readback?.choiceId === input.choiceId
        || handoff.coordinationRevision !== coordinationRevision) return null;
      const choice = pick(profile.readback, input.choiceId, handoff.reviewedActionIds);
      if (!choice) return null;
      handoff.readback = { ...choice, choiceId: choice.id, eventIndex: index };
      handoff.readbackAttempts.push(handoff.readback);
      event = { type: 'readback', handoffId: input.handoffId, choiceId: input.choiceId };
    } else return null;
    events.push(event);
    releasePatientUpdates(index);
  }
  const tasks = episode.actions.map((action) => {
    const task = requested.get(action.id);
    const definition = profile.tasks[action.id];
    const status = reviewed.includes(action.id) ? 'reviewed' : !task ? 'unrequested'
      : task.readyRound <= round ? 'available' : 'pending';
    return { actionId: action.id, label: definition?.label || action.label, owner: definition?.owner || '', status,
      ...(task ? { requestedRound: task.requestedRound, readyRound: task.readyRound } : {}),
      canRequest: !task && action.requires.every((id) => reviewed.includes(id)),
      ...(status === 'reviewed' ? { finding: action.finding, interpretation: action.interpretation } : {}) };
  });
  const priority = priorityAttempts.at(-1) ?? null;
  const reassessmentQuestion = reassessmentFor(profile, reviewed);
  const latestReassessment = reassessments.at(-1) ?? null;
  const reassessmentCurrent = !!latestReassessment && latestReassessment.knowledgeRevision === knowledgeRevision;
  const handoff = handoffs.at(-1) ?? null;
  for (const value of handoffs) {
    value.current = value.coordinationRevision === coordinationRevision && value === handoff;
    value.outdated = !value.current;
    value.readbackCurrent = !!value.readback && value.current;
  }
  const missing = [];
  if (!priority) missing.push('Priority not recorded.');
  if (!reassessmentCurrent) missing.push('Reassessment is missing or needs updating after new information or a changed hypothesis.');
  if (!handoff?.current) missing.push('An up-to-date structured handoff is missing.');
  if (!handoff?.readbackCurrent) missing.push('Receiver readback is missing or outdated.');
  for (const update of patientUpdates.values()) if (!update.response) missing.push(`Patient update response not recorded: ${update.text}`);
  const issues = [];
  if (priority && !priority.appropriate) issues.push(priority.feedback);
  for (const update of patientUpdates.values()) if (update.response && !update.response.appropriate) issues.push(update.response.feedback);
  if (reassessmentCurrent && !latestReassessment.appropriate) issues.push(latestReassessment.feedback);
  if (handoff?.current) {
    for (const choice of Object.values(handoff.choices)) if (!choice.appropriate) issues.push(choice.feedback);
    if (handoff.readback && !handoff.readback.appropriate) issues.push(handoff.readback.feedback);
  }
  const historyNotes = [];
  for (const value of priorityAttempts.slice(0, -1)) if (!value.appropriate) historyNotes.push(`Earlier priority: ${value.feedback}`);
  for (const value of reassessments) if ((value !== latestReassessment || !reassessmentCurrent) && !value.appropriate) historyNotes.push(`Earlier reassessment: ${value.feedback}`);
  for (const value of handoffs) {
    if (!value.current) for (const choice of Object.values(value.choices)) if (!choice.appropriate) historyNotes.push(`Earlier handoff: ${choice.feedback}`);
    for (const attempt of value.readbackAttempts) if ((!value.current || attempt !== value.readback) && !attempt.appropriate) historyNotes.push(`Earlier readback: ${attempt.feedback}`);
  }
  for (const update of patientUpdates.values()) for (const attempt of update.responseAttempts.slice(0, -1)) {
    if (!attempt.appropriate) historyNotes.push(`Earlier patient update response: ${attempt.feedback}`);
  }
  if (firstUpdate && !firstUpdate.priority) historyNotes.push('No priority was recorded at the first fictional team update; later choices do not establish recognition at presentation.');
  else if (firstUpdate?.priority && !firstUpdate.priority.appropriate) historyNotes.push(`Priority at the first fictional team update: ${firstUpdate.priority.feedback}`);
  const complete = missing.length === 0;
  const assessment = {
    status: !complete ? 'incomplete' : issues.length ? 'needs-review' : 'recorded', complete,
    label: !complete ? 'Workflow incomplete' : issues.length ? 'Workflow choices need review' : 'Coordination decisions recorded',
    missing, issues, historyNotes,
    caveat: 'Fictional coordination rounds are not clinical minutes, treatment, prognosis or a measure of clinical competence.',
  };
  return { profile, workflow: { version: 1, events }, canAppend: events.length < MAX_EVENTS, round, knowledgeRevision, coordinationRevision,
    reviewedActionIds: reviewed, hypothesisId, hypothesisHistory, tasks, priority, priorityAttempts,
    firstUpdate, reassessmentQuestion, reassessments, latestReassessment, reassessmentCurrent,
    handoffs, handoff, assessment, canUpdate: tasks.some((task) => task.status === 'pending') || futurePatientUpdate(),
    ...(patientDefinitions.length ? { patientUpdates: [...patientUpdates.values()],
      pendingPatientUpdate: [...patientUpdates.values()].find((value) => !value.response?.appropriate) ?? null } : {}),
    canReassess: reviewed.length >= (profile.reassessment.minimumReviewed ?? 1),
    choices: { priority: profile.priority.choices.filter((choice) => available(choice, reviewed)),
      reassessment: reassessmentQuestion.choices.filter((choice) => available(choice, reviewed)),
      handoff: Object.fromEntries(fields.map((field) => [field, { ...profile.handoff[field],
        choices: profile.handoff[field].choices.filter((choice) => available(choice, reviewed)) }])),
      readback: profile.readback.choices.filter((choice) => available(choice, handoff?.reviewedActionIds ?? [])) } };
}

export function appendCareEvent(workflow, event, episode) {
  const previous = replayCareWorkflow(workflow, episode);
  if (!previous || previous.workflow.events.length >= MAX_EVENTS) return null;
  try {
    return replayCareWorkflow({ version: 1, events: [...previous.workflow.events, copy(event)] }, episode);
  } catch { return null; }
}
