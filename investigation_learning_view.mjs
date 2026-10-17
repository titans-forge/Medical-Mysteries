import { reasoningChoices, assessInvestigationReasoning } from './investigation_reasoning.mjs';
import { getInvestigationEpisode, restoreInvestigation, investigationOutcome, getCareWorkflow } from './investigation.mjs';
import { careSummary } from './care_workflow_view.mjs';
import { getTransferQuestion } from './investigation_transfer.mjs';
import { readJournal, recordCompleted, answerTransfer, clearJournal, exportJournal, journalRecordIdentity, transferPracticeStatus } from './investigation_journal.mjs';

function node(tag, className = '', text = '') {
  const value = document.createElement(tag);
  value.className = className;
  value.textContent = text;
  return value;
}

function button(label, handler, className = 'quiet-button') {
  const value = node('button', className, label);
  value.type = 'button';
  value.addEventListener('click', handler);
  return value;
}

function sourceLink(source) {
  const link = node('a', '', source.title);
  link.href = source.url;
  link.target = '_blank';
  link.rel = 'noreferrer';
  return link;
}

export function journalRecord(state, reflection) {
  const canonical = restoreInvestigation(state);
  if (!canonical) return null;
  if (reflection) {
    const identity = journalRecordIdentity(canonical, reflection);
    return readJournal().records.find((record) => journalRecordIdentity(record.state, record.reflection) === identity) ?? null;
  }
  const matches = readJournal().records.filter((record) => JSON.stringify(record.state) === JSON.stringify(canonical));
  return matches.length === 1 ? matches[0] : null;
}

export function reflectionControls(state, reflection, onChange) {
  const item = getInvestigationEpisode(state.episodeId, state.version);
  const section = node('details', 'investigation-reflection');
  section.open = Boolean(item.reasoning) || reflection.confidence !== null || reflection.keyActionId !== null;
  section.append(node('summary', '', item.reasoning ? 'Explain your conclusion' : 'Your reasoning (optional)'));
  if (item.reasoning) section.append(node('p', 'control-help', item.reasoning.prompt || 'Link a visible fact to your hypothesis and identify a limit. You may finish provisionally without collecting every finding; leaving this blank records no justification.'));
  const choices = reasoningChoices(state);
  const clueLabel = node('label', '', item.reasoning?.supportLabel || 'Key clue');
  const select = node('select');
  select.id = 'investigationKeyClue';
  clueLabel.htmlFor = select.id;
  const unset = node('option', '', 'Not recorded');
  unset.value = '';
  select.append(unset);
  for (const fact of choices.supports) {
    const option = node('option', '', `${fact.label}${fact.origin === 'Opening handoff' ? ' · already in opening' : ''}`);
    option.value = fact.id;
    select.append(option);
  }
  select.value = reflection.keyActionId ?? '';
  const supportNote = node('p', 'control-help reasoning-support-note');
  supportNote.setAttribute('aria-live', 'polite');
  function describeSupport() {
    const selected = choices.supports.find((fact) => fact.id === select.value);
    supportNote.textContent = selected?.origin === 'Combined findings'
      ? `You are citing these findings together: ${selected.requires.map((id) => item.actions.find((action) => action.id === id).label).join('; ')}.`
      : '';
    supportNote.hidden = !supportNote.textContent;
  }
  describeSupport();
  select.addEventListener('change', () => {
    reflection.keyActionId = select.value || null;
    describeSupport();
    onChange({ ...reflection });
  });
  const toggleLabel = node('label', 'reflection-toggle');
  const toggle = node('input');
  toggle.type = 'checkbox';
  toggle.checked = reflection.confidence !== null;
  toggleLabel.append(toggle, document.createTextNode('Record confidence'));
  const fields = node('div', 'reflection-confidence');
  const range = node('input');
  range.type = 'range';
  range.id = 'investigationConfidence';
  range.min = '0';
  range.max = '100';
  range.step = '5';
  range.value = String(reflection.confidence ?? 50);
  const rangeLabel = node('label', '', 'Confidence before conclusion: ');
  rangeLabel.htmlFor = range.id;
  const output = node('output', '', `${range.value}%`);
  output.htmlFor = range.id;
  rangeLabel.append(output);
  fields.append(rangeLabel, range);
  fields.hidden = !toggle.checked;
  toggle.addEventListener('change', () => {
    fields.hidden = !toggle.checked;
    reflection.confidence = toggle.checked ? Number(range.value) : null;
    onChange({ ...reflection });
  });
  range.addEventListener('input', () => {
    reflection.confidence = Number(range.value);
    output.textContent = `${range.value}%`;
    onChange({ ...reflection });
  });
  section.append(clueLabel, select, supportNote);
  if (item.reasoning) {
    const limitationLabel = node('label', '', item.reasoning.limitationLabel || 'What remains uncertain?');
    const limitation = node('select');
    limitation.id = 'investigationUncertainty';
    limitationLabel.htmlFor = limitation.id;
    const unsetLimit = node('option', '', 'Not recorded'); unsetLimit.value = ''; limitation.append(unsetLimit);
    for (const option of choices.uncertainties) {
      const choice = node('option', '', option.label); choice.value = option.id; limitation.append(choice);
    }
    limitation.value = reflection.uncertaintyId || '';
    const limitationNote = node('p', 'control-help reasoning-limit-note');
    limitationNote.setAttribute('aria-live', 'polite');
    function describeLimitation() {
      limitationNote.textContent = choices.uncertainties.find((entry) => entry.id === limitation.value)?.label || '';
      limitationNote.hidden = !limitationNote.textContent;
    }
    describeLimitation();
    limitation.addEventListener('change', () => {
      reflection.uncertaintyId = limitation.value || null;
      describeLimitation();
      onChange({ ...reflection });
    });
    section.append(limitationLabel, limitation, limitationNote);
  }
  section.append(toggleLabel, fields);
  return section;
}

export function reflectionSummary(state, reflection) {
  const item = getInvestigationEpisode(state.episodeId, state.version);
  const section = node('section', 'learning-reflection-summary');
  section.append(node('h3', '', 'Your reasoning at commitment'));
  section.append(node('p', 'control-help', `Self-reported confidence: ${reflection.confidence === null ? 'not recorded' : `${reflection.confidence}%`}. Not a clinical calibration score.`));
  const clue = reasoningChoices(state).supports.find((action) => action.id === reflection.keyActionId);
  if (clue) {
    section.append(node('p', '', `Your supporting evidence: ${clue.label}`));
    const action = item.actions.find((entry) => entry.id === clue.id);
    if (action) section.append(node('p', 'guided-interpretation', action.interpretation));
    if (clue.origin === 'Combined findings') {
      const cited = node('ul', 'reasoning-cited-findings');
      for (const id of clue.requires) cited.append(node('li', '', item.actions.find((entry) => entry.id === id).finding));
      section.append(cited);
    }
  } else {
    section.append(node('p', 'control-help', 'Key clue: not recorded.'));
  }
  if (item.reasoning) {
    const uncertainty = reasoningChoices(state).uncertainties.find((entry) => entry.id === reflection.uncertaintyId);
    section.append(node('p', '', `${item.reasoning.limitationLabel ? 'Your comparison or limit' : 'Your stated limit'}: ${uncertainty?.label || 'not recorded'}`));
    const assessment = assessInvestigationReasoning(state, reflection);
    const feedback = node('section', 'reasoning-assessment');
    feedback.dataset.status = assessment.status;
    feedback.append(node('h3', '', assessment.label), node('p', '', assessment.feedback));
    if (assessment.status === 'not-recorded' || assessment.status === 'needs-revision') {
      feedback.append(node('p', 'control-help', 'To try a revised explanation, start a new investigation from the case board. This committed reflection stays in the journal.'));
    }
    section.append(feedback);
  }
  return section;
}

export function transferQuestion(state, reflection) {
  const question = getTransferQuestion(state.episodeId, state.version);
  const section = node('section', 'investigation-transfer');
  section.setAttribute('aria-label', 'One more twist');
  if (!question) return section;
  let chosen = journalRecord(state, reflection)?.transfer?.answerId ?? null;
  let persisted = Boolean(chosen);
  function render() {
    const practice = transferPracticeStatus(state, reflection, readJournal().records);
    if (practice.deferred && !practice.canAnswer && !chosen) {
      section.replaceChildren(node('div', 'eyebrow', 'SPACED CONTRAST PRACTICE'),
        node('h3', '', 'Return after another saved attempt'),
        node('p', '', practice.reason === 'save-this-exact-attempt-first'
          ? 'This attempt could not be added to the journal. Export it before leaving; contrast practice needs this saved attempt.'
          : practice.reason === 'invalid-route-or-reflection'
            ? 'Contrast practice is unavailable for this saved attempt. You can still export your record.'
            : 'Save a new attempt in a different arrival, then return to this entry in your learning journal for a changed situation.'),
        node('p', 'control-help', 'Identical replays keep their original journal record and date. Try a different evidence route or reflection to save a new attempt.'));
      return;
    }
    section.replaceChildren(node('div', 'eyebrow', 'OPTIONAL CONTRAST CASE'), node('h3', '', 'One more twist'), node('p', '', question.prompt));
    const choices = node('div', 'transfer-choices');
    for (const choice of question.choices) {
      const pick = button(choice.label, () => {
        if (chosen) return;
        const recorded = recordCompleted(state, reflection);
        const saved = recorded ? answerTransfer(state, choice.id, undefined, reflection) : null;
        chosen = saved?.transfer?.answerId ?? choice.id;
        persisted = Boolean(saved);
        render();
        section.querySelector('.transfer-feedback')?.focus({ preventScroll: true });
      }, 'transfer-choice');
      pick.disabled = Boolean(chosen);
      pick.dataset.choiceId = choice.id;
      if (chosen === choice.id) pick.classList.add('selected');
      if (chosen && choice.id === question.answerId) pick.classList.add('supported');
      if (chosen === choice.id) pick.append(node('small', 'transfer-choice-status', choice.id === question.answerId ? 'Your answer · supported' : 'Your answer'));
      else if (chosen && choice.id === question.answerId) pick.append(node('small', 'transfer-choice-status', 'Supported answer'));
      choices.append(pick);
    }
    section.append(choices);
    if (chosen) {
      const choice = question.choices.find((entry) => entry.id === chosen);
      const feedback = node('div', 'transfer-feedback');
      feedback.tabIndex = -1;
      feedback.setAttribute('role', 'status');
      feedback.append(node('strong', '', chosen === question.answerId ? 'The changed evidence supports your answer.' : 'A distinction to carry forward.'), node('p', '', choice.feedback));
      if (chosen !== question.answerId) feedback.append(node('p', '', `Best-supported answer: ${question.choices.find((entry) => entry.id === question.answerId).label}`));
      feedback.append(sourceLink(question.source));
      feedback.append(node('p', 'control-help', persisted ? 'First answer saved in your learning journal.' : 'Answer kept for this view only. The local journal could not be updated.'));
      section.append(feedback);
    }
    section.append(node('p', 'control-help', 'Fictional learning question · Review notes are on the case board.'));
  }
  render();
  return section;
}

function downloadJournal(records) {
  const receipt = exportJournal();
  const url = URL.createObjectURL(new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' }));
  const link = node('a');
  link.href = url;
  link.download = 'medical-mysteries-learning-journal.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function openLearningJournal() {
  const origin = document.activeElement;
  const dialog = node('dialog', 'learning-journal');
  dialog.setAttribute('aria-labelledby', 'learningJournalTitle');
  let confirmingClear = false;
  let error = '';
  function render() {
    const journal = readJournal();
    dialog.replaceChildren();
    const header = node('header', 'journal-header');
    const title = node('h2', '', 'Learning journal');
    title.id = 'learningJournalTitle';
    header.append(title, button('Close', () => dialog.close()));
    dialog.append(header);
    const notice = node('p', 'control-help');
    notice.setAttribute('role', 'status');
    notice.textContent = error || ({
      empty: 'No completed investigations saved yet.',
      invalid: 'This journal is incompatible or damaged. It has not been changed. Clear it only if you want to discard its saved entries.',
      unavailable: 'Browser storage is unavailable. The local journal cannot be read.',
      partial: `${journal.records.length} readable routes. ${journal.unreadableEntries?.length || 0} entries need recovery; their original bytes are retained and included in an export.`,
      ok: `${journal.records.length} saved route${journal.records.length === 1 ? '' : 's'} · 20-entry capacity. Earlier routes are never removed to add a new one. Matching routes and reflections keep their first contrast answer.`,
    })[journal.status];
    dialog.append(notice);
    const list = node('div', 'journal-records');
    for (const record of journal.records) {
      const item = getInvestigationEpisode(record.state.episodeId, record.state.version);
      const entry = node('details', 'journal-record');
      const summary = node('summary');
      const verdict = investigationOutcome(record.state).label;
      summary.append(node('strong', '', item.title), node('span', 'journal-mode', `${item.recordLabel ? `${item.recordLabel} · ` : ''}Version ${record.state.version} · ${record.state.mode === 'challenge' ? 'Challenge' : 'Guided'}`), node('span', 'journal-verdict', verdict));
      if (item.reasoning) summary.append(node('small', 'control-help', assessInvestigationReasoning(record.state, record.reflection).label));
      if (getCareWorkflow(record.state)) summary.append(node('small', 'control-help', getCareWorkflow(record.state).assessment.label));
      entry.append(summary);
      const body = node('div', 'journal-record-body');
      const time = node('time', 'control-help', new Date(record.completedUtc).toLocaleString());
      time.dateTime = record.completedUtc;
      body.append(node('p', 'control-help', `${item.recordLabel ? `${item.recordLabel} · ` : ''}Case version ${record.state.version} · historical wording retained`), time, node('p', '', `Conclusion: ${item.hypotheses.find((hypothesis) => hypothesis.id === record.state.hypothesisId).label}`));
      body.append(reflectionSummary(record.state, record.reflection));
      if (getCareWorkflow(record.state)) body.append(careSummary(record.state));
      if (record.transfer) {
        const question = getTransferQuestion(item.id, record.state.version);
        const answer = question.choices.find((choice) => choice.id === record.transfer.answerId);
        body.append(node('h3', '', 'One more twist · first answer'), node('p', '', question.prompt), node('p', '', answer.label), node('p', '', answer.feedback), sourceLink(question.source));
      } else if (getTransferQuestion(record.state.episodeId, record.state.version)?.delivery === 'after-another-arrival') {
        body.append(transferQuestion(record.state, record.reflection));
      } else body.append(node('p', 'control-help', 'Contrast question: not answered.'));
      entry.append(body);
      list.append(entry);
    }
    dialog.append(list);
    const actions = node('footer', 'journal-actions');
    const exportButton = button('Export journal', () => downloadJournal(journal.records));
    exportButton.disabled = !['ok', 'partial', 'invalid'].includes(journal.status) || (journal.status === 'invalid' && typeof journal.rawText !== 'string');
    const clear = button('Clear journal', () => { confirmingClear = true; render(); dialog.querySelector('[data-action="cancel-clear"]')?.focus(); });
    clear.disabled = journal.status === 'empty' || journal.status === 'unavailable';
    actions.append(exportButton, clear);
    dialog.append(actions);
    if (confirmingClear) {
      const confirm = node('section', 'journal-clear-confirm');
      confirm.setAttribute('role', 'alert');
      confirm.append(node('p', '', 'Delete this local journal and its recovery copies? This cannot be undone. Current case saves, scores and practice history will stay.'));
      const cancel = button('Keep journal', () => { confirmingClear = false; render(); dialog.querySelector('.journal-actions button:last-child')?.focus(); });
      cancel.dataset.action = 'cancel-clear';
      const remove = button('Delete journal entries', () => {
        error = clearJournal() ? 'Journal cleared. Other progress was not changed.' : 'The journal could not be cleared.';
        confirmingClear = false;
        render();
        dialog.querySelector('.journal-header button')?.focus();
      });
      confirm.append(cancel, remove);
      dialog.append(confirm);
    }
  }
  dialog.addEventListener('close', () => {
    dialog.remove();
    document.body.classList.remove('journal-open');
    if (origin?.isConnected) origin.focus({ preventScroll: true });
  }, { once: true });
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button:not(:disabled), a[href], summary')]
      .filter((control) => control.getClientRects().length > 0);
    const first = controls[0];
    const last = controls.at(-1);
    if ((event.shiftKey && document.activeElement === first)
      || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    }
  });
  render();
  document.body.append(dialog);
  document.body.classList.add('journal-open');
  dialog.showModal();
}
