import {
  getCareWorkflow, requestCareTask, advanceCareUpdate, reviewCareTask,
  chooseCarePriority, reassessCare, sendCareHandoff, acknowledgeCareHandoff, respondCareUpdate,
} from './investigation.mjs';
import { workboardSnapshot } from './investigation_visuals.mjs';

const handoffDrafts = new Map();
function node(tag, className = '', text = '') {
  const value = document.createElement(tag);
  value.className = className;
  value.textContent = text;
  return value;
}
function button(label, run, className = 'quiet-button') {
  const value = node('button', className, label);
  value.type = 'button';
  value.addEventListener('click', run);
  return value;
}
function feedback(choice) {
  const value = node('p', `care-feedback ${choice.appropriate ? 'care-supported' : 'care-reconsider'}`, choice.feedback);
  value.setAttribute('role', 'status');
  return value;
}
function choices(section, available, selected, choose) {
  const group = node('div', 'care-choices');
  group.append(node('p', 'care-prompt', section.prompt));
  for (const choice of available) {
    const control = button(choice.label, () => choose(choice.id), 'care-choice');
    control.dataset.choiceId = choice.id;
    control.setAttribute('aria-pressed', String(choice.id === selected?.choiceId));
    control.disabled = choice.id === selected?.choiceId;
    group.append(control);
  }
  if (selected) group.append(feedback(selected));
  return group;
}
function disclosure(title, open = false) {
  const section = node('details', 'care-section');
  section.open = open;
  section.append(node('summary', '', title));
  return section;
}
function attachedRecord(care, reviewedIds, taskIds, patientUpdates = []) {
  const record = disclosure('Attached record · Reviewed findings and follow-up', true);
  record.append(node('p', 'control-help', 'These findings and named task owners accompany the message. Available or pending reports are not presented as reviewed evidence.'));
  const reviewed = care.tasks.filter((task) => reviewedIds.includes(task.actionId));
  if (!reviewed.length) record.append(node('p', '', 'No investigation reports reviewed. Opening account only.'));
  for (const task of reviewed) record.append(node('h4', '', task.label), node('p', '', task.finding));
  for (const update of patientUpdates) {
    record.append(node('h4', '', 'Patient update'), node('p', '', update.text));
    if (update.response) record.append(node('p', 'control-help', `Response: ${update.response.label}`));
    else record.append(node('p', 'care-stale', 'Response not yet recorded.'));
  }
  const pending = care.tasks.filter((task) => taskIds.includes(task.actionId));
  if (pending.length) {
    record.append(node('h4', '', 'Named follow-up'));
    const list = node('ul');
    for (const task of pending) list.append(node('li', '', `${task.label} · ${task.owner}`));
    record.append(list);
  }
  return record;
}

export function careWorkboard(state, apply) {
  const care = getCareWorkflow(state);
  if (!care) return null;
  const profile = care.profile;
  const board = node('section', 'care-workboard');
  board.id = 'investigationActions';
  board.append(node('div', 'eyebrow', `CARE TEAM · CASE VERSION ${state.version}`), node('h2', '', 'Coordinate the next step'));
  const role = node('div', 'care-role');
  role.append(node('strong', '', profile.role.label));
  if (state.version >= 4) {
    const scope = disclosure('Your role');
    scope.append(node('p', '', profile.role.boundary));
    role.append(scope);
  } else role.append(node('p', '', profile.role.boundary));
  board.append(role);
  const rail = node('ol', 'care-progress');
  for (const [label, done] of [
    ['Priority', Boolean(care.priority?.appropriate)],
    ['Reassessment', Boolean(care.reassessmentCurrent && care.latestReassessment?.appropriate)],
    ['Handoff', Boolean(care.handoff && !care.handoff.outdated && care.handoff.readback?.appropriate
      && Object.values(care.handoff.choices).every((choice) => choice.appropriate))],
  ]) {
    const item = node('li', done ? 'complete' : '', `${done ? '✓' : '○'} ${label}`);
    rail.append(item);
  }
  board.append(rail);
  if (state.version >= 5) board.append(workboardSnapshot(care));
  const priority = disclosure('Priority while the cause is uncertain', !care.priority || !care.priority.appropriate);
  priority.id = 'carePriority';
  priority.tabIndex = -1;
  priority.append(choices(profile.priority, care.choices.priority, care.priority,
    (id) => apply(chooseCarePriority(state, id), 'carePriority')));
  board.append(priority);
  for (const update of care.patientUpdates || []) {
    const section = disclosure('Patient update', !update.response?.appropriate);
    section.classList.add('care-patient-update');
    section.id = `care-patient-${update.id}`;
    section.tabIndex = -1;
    section.append(node('blockquote', '', update.text), choices(update, update.choices, update.response,
      (choiceId) => apply(respondCareUpdate(state, update.id, choiceId), section.id)));
    board.append(section);
  }
  const work = node('section', 'care-tasks');
  work.append(node('h3', '', 'Team workboard'), node('p', 'control-help', profile.workboardPrompt || 'Track more than one task, then receive a team update. Available reports only enter your evidence after you review them.'));
  const grid = node('div', 'care-task-grid');
  const moreGrid = node('div', 'care-task-grid');
  const compact = state.version >= 4 && care.tasks.some((task) => task.status !== 'unrequested');
  for (const task of care.tasks) {
    const card = node('article', `care-task care-task-${task.status}`);
    card.dataset.taskId = task.actionId;
    card.dataset.status = task.status;
    card.append(node('span', 'care-task-status', {
      unrequested: 'Not tracked', pending: 'In progress', available: 'Report available', reviewed: 'Reviewed',
    }[task.status]), node('h4', '', task.label), node('p', 'care-owner', `Owner · ${task.owner}`));
    if (task.status === 'unrequested') {
      const request = button('Track task', () => apply(requestCareTask(state, task.actionId), 'careUpdate'));
      request.setAttribute('aria-label', `Track: ${task.label}`);
      request.disabled = !task.canRequest;
      card.append(request);
      if (!task.canRequest) card.append(node('small', '', 'Review the linked finding first.'));
    } else if (task.status === 'available') {
      const review = button('Review report', () => apply(reviewCareTask(state, task.actionId), 'latestFinding'), 'primary-button');
      review.setAttribute('aria-label', `Review: ${task.label}`);
      card.append(review);
    }
    if (compact && task.status === 'reviewed') continue;
    (compact && task.status === 'unrequested' ? moreGrid : grid).append(card);
  }
  work.append(grid);
  if (compact && !grid.childElementCount) work.append(node('p', 'control-help', 'No reports waiting for review. Your collected findings are below.'));
  if (moreGrid.childElementCount) {
    const more = disclosure('Track another task');
    more.append(moreGrid);
    work.append(more);
  }
  const update = button('Receive team update', () => {
    const next = advanceCareUpdate(state);
    const patient = next && getCareWorkflow(next)?.pendingPatientUpdate;
    apply(next, patient ? `care-patient-${patient.id}` : 'careTeamUpdate');
  }, 'primary-button');
  update.id = 'careUpdate';
  update.disabled = !care.canUpdate;
  const controls = node('div', 'care-update-controls');
  controls.append(update, node('span', '', `Update ${care.round} · ${care.reviewedActionIds.length} report${care.reviewedActionIds.length === 1 ? '' : 's'} reviewed`));
  work.append(controls, node('p', 'control-help', 'Updates advance this fictional record together. There is no countdown or speed bonus.'));
  board.append(work);
  if (care.round > 0) {
    const updateText = node('p', 'care-team-update', profile.reassessment.update);
    updateText.id = 'careTeamUpdate';
    updateText.tabIndex = -1;
    board.append(updateText);
  }
  const reassessment = disclosure('Reassess with the team', care.canReassess);
  reassessment.id = 'careReassessment';
  reassessment.tabIndex = -1;
  if (care.canReassess || care.latestReassessment) {
    reassessment.append(node('p', 'control-help', `Working explanation: ${care.hypothesisId
      ? care.profile.hypothesisLabels?.[care.hypothesisId] || care.hypothesisId.replaceAll('-', ' ')
      : state.hypothesisId ? state.hypothesisId.replaceAll('-', ' ') : 'Not recorded'}. Keep or revise it in the reasoning panel, using findings you actually reviewed.`));
    const reassessmentQuestion = care.reassessmentQuestion || profile.reassessment;
    if (state.version >= 5 && reassessmentQuestion.message) reassessment.append(node('p', 'care-reassessment-context', reassessmentQuestion.message));
    if (state.version >= 5 && reassessmentQuestion.contextSummary) {
      const context = disclosure('Information for this reassessment');
      const facts = Array.isArray(reassessmentQuestion.contextSummary) ? reassessmentQuestion.contextSummary : [reassessmentQuestion.contextSummary];
      for (const text of facts) context.append(node('p', '', text));
      reassessment.append(context);
    }
    reassessment.append(choices(reassessmentQuestion, care.choices.reassessment,
      care.reassessmentCurrent ? care.latestReassessment : null,
      (id) => apply(reassessCare(state, id), 'careReassessment')));
    if (!care.reassessmentCurrent) reassessment.append(node('p', 'control-help', care.latestReassessment
      ? 'Your reviewed information has changed. An earlier reassessment remains in the record; update it for this point in the case.'
      : 'Compare the reviewed information with your working explanation and confirm who owns the next review.'));
  } else reassessment.append(node('p', 'control-help', 'Review a report, then revisit the concern and the next review owner.'));
  board.append(reassessment);
  return board;
}

export function careHandoff(state, apply) {
  const care = getCareWorkflow(state);
  if (!care) return null;
  const profile = care.profile;
  const section = node('section', 'care-handoff');
  section.id = 'careHandoff';
  section.tabIndex = -1;
  section.append(node('div', 'eyebrow', 'KEEP THE TEAM CONNECTED'), node('h2', '', 'Hand over the concern'));
  section.append(node('p', 'control-help', 'You can communicate before the diagnosis is settled. Choose a receiver, a known fact, a limit, and who owns follow-up.'));
  const latest = care.handoff;
  if (latest) {
    section.append(node('p', latest.outdated ? 'care-stale' : 'care-handoff-status', latest.outdated
      ? 'New information arrived after this message. Update the handoff and verify a new reply.'
      : latest.readback?.appropriate && Object.values(latest.choices).every((choice) => choice.appropriate)
        ? 'Communication loop recorded for the current information.'
        : 'Message recorded — check its content and the receiver’s reply.'));
    const specific = state.version >= 5 && latest.readbackQuestion;
    const sent = disclosure(`${specific ? 'Compare with your sent handoff' : 'Last message'} · update ${latest.updateRound}`, !specific);
    for (const field of ['receiver', 'situation', 'uncertainty', 'nextOwner']) {
      const chosen = latest.choices[field];
      sent.append(node('p', '', chosen.label));
      if (!chosen.appropriate) sent.append(feedback(chosen));
    }
    sent.append(attachedRecord(care, latest.reviewedActionIds, [...latest.pendingTaskIds, ...latest.availableTaskIds], latest.patientUpdates));
    if (!specific || latest.outdated) section.append(sent);
    if (!latest.outdated) {
      const readback = node('div', 'care-readback');
      readback.id = 'careReadback';
      readback.tabIndex = -1;
      const question = care.readbackQuestion || latest.readbackQuestion || profile.readback;
      if (specific) {
        readback.classList.add('care-readback-check');
        readback.append(node('h3', '', 'Check the receiver’s understanding'),
          node('p', 'control-help', 'Compare these words with the information you sent. A reply may be accurate or need a specific correction.'),
          node('div', 'eyebrow', 'RECEIVER SAYS'), node('blockquote', 'care-receiver-message', question.message));
        readback.append(sent);
      }
      readback.append(choices(question, care.choices.readback, latest.readback,
        (id) => apply(acknowledgeCareHandoff(state, latest.id, id), 'careReadback')));
      section.append(readback);
    }
  }
  const compose = disclosure(latest ? 'Revise the handoff' : 'Compose an early handoff', !latest || latest.outdated);
  const routeKey = `${state.episodeId}:${state.version}`;
  const draft = handoffDrafts.get(routeKey) || {};
  const controls = {};
  for (const field of ['receiver', 'situation', 'uncertainty', 'nextOwner']) {
    const spec = care.choices.handoff[field];
    const label = node('label', 'care-handoff-field');
    label.append(node('span', '', spec.prompt));
    const select = node('select');
    const statement = node('p', 'care-selected-statement');
    select.id = `care-handoff-${field}`;
    select.setAttribute('aria-label', spec.prompt);
    select.append(new Option('Choose a statement…', ''));
    for (const choice of spec.choices) select.append(new Option(choice.label, choice.id));
    select.value = spec.choices.some((choice) => choice.id === draft[`${field}Id`]) ? draft[`${field}Id`] : '';
    statement.textContent = spec.choices.find((choice) => choice.id === select.value)?.label || '';
    select.addEventListener('change', () => {
      draft[`${field}Id`] = select.value;
      statement.textContent = spec.choices.find((choice) => choice.id === select.value)?.label || '';
      handoffDrafts.set(routeKey, draft);
    });
    controls[`${field}Id`] = select;
    label.append(select, statement);
    compose.append(label);
  }
  compose.append(attachedRecord(care, care.reviewedActionIds,
    care.tasks.filter((task) => ['pending', 'available'].includes(task.status)).map((task) => task.actionId), care.patientUpdates));
  const notice = node('p', 'control-help');
  notice.setAttribute('role', 'status');
  compose.append(button('Send team handoff', () => {
    const selection = Object.fromEntries(Object.entries(controls).map(([id, control]) => [id, control.value]));
    if (Object.values(selection).some((id) => !id)) {
      notice.textContent = 'Choose a statement in all four parts before sending.';
      Object.values(controls).find((control) => !control.value)?.focus();
      return;
    }
    const next = sendCareHandoff(state, selection);
    if (!next) { notice.textContent = 'That exact message is already recorded for this information. Check the receiver reply or revise a statement.'; return; }
    apply(next, 'careReadback');
  }, 'primary-button'), notice);
  section.append(compose);
  return section;
}

export function careSummary(state) {
  const care = getCareWorkflow(state);
  if (!care) return null;
  const section = node('section', 'care-summary');
  section.append(node('h3', '', care.assessment.label), node('p', '', 'Diagnostic support, reasoning and coordination are assessed separately. A supported diagnosis does not complete a handoff.'));
  const rows = node('dl', 'care-summary-grid');
  for (const [label, text] of [
    ['Priority', care.priority ? care.priority.label : 'Not recorded'],
    ['Reassessment', care.latestReassessment ? care.latestReassessment.label : 'Not recorded'],
    ['Handoff', care.handoff ? `${care.handoff.outdated ? 'Outdated' : 'Current'} · ${care.handoff.readback ? 'reply recorded' : 'reply not verified'}` : 'Not recorded'],
    ['Team record', `${care.round} updates · ${care.reviewedActionIds.length} reviewed finding${care.reviewedActionIds.length === 1 ? '' : 's'} · ${care.tasks.filter((task) => ['pending', 'available'].includes(task.status)).length} tasks still need follow-up`],
  ]) rows.append(node('dt', '', label), node('dd', '', text));
  section.append(rows);
  for (const text of [...care.assessment.missing, ...care.assessment.issues]) section.append(node('p', 'care-stale', text));
  for (const text of care.assessment.historyNotes || []) section.append(node('p', 'control-help', text));
  for (const update of care.patientUpdates || []) {
    section.append(node('h4', '', 'Patient update'), node('p', '', update.text),
      node('p', '', update.response ? `Your response: ${update.response.label}` : 'Response not recorded.'));
  }
  if (state.version >= 5 && care.handoff?.readbackQuestion) {
    const verification = disclosure('Receiver message and your check');
    verification.append(node('blockquote', 'care-receiver-message', care.handoff.readbackQuestion.message));
    if (care.handoff.readback) verification.append(node('p', '', care.handoff.readback.label), feedback(care.handoff.readback));
    else verification.append(node('p', 'control-help', 'No verification response recorded.'));
    section.append(verification);
  }
  const trail = disclosure(`Coordination record · ${state.workflow.events.length} decisions and events`);
  trail.append(node('p', 'control-help', 'The exported investigation includes every workflow attempt, report request, update, reviewed finding and handoff snapshot.'));
  for (const handoff of care.handoffs) trail.append(node('p', '', `Update ${handoff.updateRound}: ${handoff.choices.situation.label} Receiver: ${handoff.choices.receiver.label} ${handoff.outdated ? 'Later superseded.' : 'Latest message.'}`));
  section.append(trail);
  return section;
}
