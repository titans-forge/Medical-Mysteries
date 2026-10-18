import {
  INVESTIGATION_EPISODE,
  INVESTIGATION_EPISODES,
  getInvestigationEpisode,
  getInvestigationPresentation,
  createInvestigation,
  availableActions,
  investigate,
  setHypothesis,
  concludeInvestigation,
  investigationDebrief,
  investigationOutcome,
  getCareWorkflow,
} from './investigation.mjs';
import { loadInvestigation, loadInvestigationVersion, listInvestigationSaves, saveInvestigation } from './investigation_history.mjs';
import { loadReflection, saveReflection, recordCompleted } from './investigation_journal.mjs';
import { reflectionControls, reflectionSummary, transferQuestion, openLearningJournal, journalRecord } from './investigation_learning_view.mjs';
import { careWorkboard, careHandoff, careSummary } from './care_workflow_view.mjs';
import { investigationFamilies, nextInvestigationArrival, rememberInvestigationArrival } from './investigation_arrivals.mjs';
import { investigationVisual, investigationScene, investigationReference } from './investigation_visuals.mjs';

function element(tag, className = '', value = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = value;
  return node;
}

function command(label, handler, className = 'quiet-button') {
  const button = element('button', className, label);
  button.type = 'button';
  button.addEventListener('click', handler);
  return button;
}

export function mountInvestigation({ onOpen, onClose, isAvailable }) {
  const root = document.getElementById('investigation');
  const shelf = document.getElementById('investigationShelf');
  let state = null;
  let selectedId = INVESTIGATION_EPISODE.id;
  let saved = true;
  let storageProblem = '';
  let resetRequest = null;
  let reflection = { confidence: null, keyActionId: null, uncertaintyId: null };
  const journalButton = document.getElementById('openLearningJournal');
  journalButton?.addEventListener('click', () => { if (isAvailable()) openLearningJournal(); });
  const episodes = () => (Array.isArray(INVESTIGATION_EPISODES) && INVESTIGATION_EPISODES.length ? INVESTIGATION_EPISODES : [INVESTIGATION_EPISODE]);
  const families = () => investigationFamilies(episodes());
  const episodeFor = (id, version) => getInvestigationEpisode(id, version) || episodes().find((item) => item.id === id) || INVESTIGATION_EPISODE;
  const presentationFor = (id, version) => investigationVisual(getInvestigationEpisode(id, version), getInvestigationPresentation(id, version) || {});
  const load = (id, version) => version === undefined ? loadInvestigation(id) : loadInvestigationVersion(id, version);

  function statusFor(id) {
    const checkpoint = load(id);
    if (!checkpoint) return { label: 'Not started', state: null };
    return checkpoint.completed ? { label: `Finished · ${investigationOutcome(checkpoint).label}`, state: checkpoint } : { label: 'In progress', state: checkpoint };
  }

  function save() {
    saved = Boolean(state && saveInvestigation(state));
    if (!saved) storageProblem = 'Storage unavailable. Progress will last only while this page stays open.';
    if (!saveReflection(state, reflection) && saved) storageProblem = 'Case saved, but your optional reasoning could not be saved.';
    if (state.completed && !recordCompleted(state, reflection)) storageProblem = 'This debrief is available, but the learning journal could not be updated.';
  }

  function renderShelf() {
    if (!shelf || !isAvailable()) return { totalCount: 0, matchingCount: 0 };
    const search = document.getElementById('caseSearch')?.value.trim().toLowerCase() || '';
    const audience = document.getElementById('caseFilter')?.value || 'all';
    const visibleFamilies = families().filter((family) => {
      const matchesSearch = !search || family.title.toLowerCase().includes(search);
      const itemAudience = String(presentationFor(family.records[0].id).audience || '').toLowerCase();
      const matchesAudience = audience === 'all' || itemAudience.includes(audience.toLowerCase());
      return matchesSearch && matchesAudience;
    });
    if (resetRequest && !visibleFamilies.some((family) => family.records.some((item) => item.id === resetRequest))) resetRequest = null;
    shelf.replaceChildren();
    for (const family of visibleFamilies) {
      const item = family.records[0];
      const presentation = presentationFor(item.id);
      const card = element('article', 'investigation-card');
      card.dataset.episodeId = family.id;
      card.dataset.familyId = family.id;
      const image = element('img');
      image.src = presentation.image || './assets/episodes/doc-002-aorta-escalation-720.webp';
      image.alt = presentation.imageAlt || `${item.title} illustrative scene art. Not diagnostic evidence.`;
      image.loading = 'lazy';
      image.decoding = 'async';
      const body = element('div', 'investigation-card-body');
      body.append(element('div', 'eyebrow', item.id === INVESTIGATION_EPISODE.id ? 'FEATURED INVESTIGATION' : 'NEW INVESTIGATION'));
      body.append(element('h2', '', family.title));
      const subtitle = item.id === INVESTIGATION_EPISODE.id
        ? 'Sudden pain. Competing explanations.'
        : (item.subtitle || item.opening || 'Sudden pain. Competing explanations.');
      body.append(element('p', 'investigation-card-subtitle', subtitle));
      body.append(element('p', 'investigation-card-meta', `${presentation.audience || 'All audiences'} · ${presentation.playMinutes || '5–8'} min`));
      if (item.careWorkflow) body.append(element('p', 'care-shelf-label', `${family.records.length} arrivals · Evolving observations · Team care`));
      const actions = element('div', 'investigation-card-actions');
      const earlierSaves = [];
      for (const record of family.records) {
        for (const checkpoint of listInvestigationSaves(record.id)) {
        const savedCase = { state: checkpoint, label: checkpoint.completed ? `Finished · ${investigationOutcome(checkpoint).label}` : 'In progress' };
        const row = element('div', 'arrival-save');
        const savedCare = getCareWorkflow(savedCase.state);
        const savedEpisode = episodeFor(record.id, checkpoint.version);
        const label = checkpoint.version === record.version ? record.recordLabel || 'Saved arrival'
          : savedEpisode.recordLabel ? `${savedEpisode.recordLabel} · earlier v${checkpoint.version}` : `Earlier case v${checkpoint.version}`;
        row.append(element('p', 'investigation-card-state has-save', `${label} · ${savedCase.label}${savedCare ? ` · ${savedCare.assessment.label}` : ''}`));
        const resume = command(`${savedCase.state.completed ? 'View' : 'Resume'} ${label}`, () => open(record.id, true, false, checkpoint.version), 'quiet-button');
        resume.dataset.investigationAction = 'resume';
        resume.dataset.action = 'resume';
        resume.dataset.episodeId = record.id;
        resume.dataset.contentVersion = String(checkpoint.version);
        if (record.id === INVESTIGATION_EPISODE.id && checkpoint.version === record.version) resume.id = 'resumeInvestigation';
        row.append(resume);
        if (checkpoint.version === record.version) body.append(row);
        else earlierSaves.push(row);
        }
      }
      if (earlierSaves.length) {
        const earlier = element('details', 'arrival-earlier-saves');
        earlier.append(element('summary', '', `Earlier saved editions · ${earlierSaves.length}`), ...earlierSaves);
        body.append(earlier);
      }
      const next = nextInvestigationArrival(family);
      const fresh = command('New arrival', () => open(next.id, false), 'primary-button');
      fresh.dataset.investigationAction = 'fresh';
      fresh.dataset.action = 'start';
      fresh.dataset.episodeId = next.id;
      if (item.id === INVESTIGATION_EPISODE.id) fresh.id = 'openInvestigation';
      actions.append(fresh);
      body.append(actions);
      card.append(image, body);
      shelf.append(card);
      if (family.records.some((record) => record.id === resetRequest)) renderResetNotice(card);
    }
    return { totalCount: families().length, matchingCount: visibleFamilies.length };
  }

  function renderResetNotice(card) {
    const item = episodeFor(resetRequest);
    const notice = element('div', 'investigation-reset-notice');
    notice.setAttribute('role', 'alert');
    notice.append(element('p', '', `${item.title} · ${item.recordLabel || 'this arrival'} already has a saved ${statusFor(item.id).label.toLowerCase()} run. The saved run remains until your first new action.`));
    const confirm = command('Confirm start new', () => {
      const id = resetRequest;
      resetRequest = null;
      open(id, false, true);
    }, 'primary-button');
    confirm.dataset.action = 'confirm-restart';
    const cancel = command('Keep saved run', () => {
      resetRequest = null;
      renderShelf();
      shelf?.querySelector(`[data-family-id="${CSS.escape(item.familyId || item.id)}"] [data-action="start"]`)?.focus({ preventScroll: false });
    }, 'quiet-button');
    cancel.dataset.action = 'cancel-restart';
    notice.append(confirm, cancel);
    card.append(notice);
  }

  function requestFresh(id) {
    resetRequest = id;
    renderShelf();
    const item = episodeFor(id);
    const notice = shelf?.querySelector(`[data-family-id="${CSS.escape(item.familyId || item.id)}"] .investigation-reset-notice`);
    notice?.scrollIntoView({ block: 'nearest' });
    notice?.querySelector('[data-action="confirm-restart"]')?.focus({ preventScroll: true });
  }
  function refresh() {
    journalButton?.classList.toggle('hidden', !isAvailable());
    if (!isAvailable()) return { totalCount: 0, matchingCount: 0 };
    return renderShelf();
  }

  function open(id = INVESTIGATION_EPISODE.id, resume = false, confirmedReset = false, resumeVersion) {
    if (!isAvailable()) return;
    if (resetRequest && resetRequest !== id) resetRequest = null;
    selectedId = id;
    saved = true;
    storageProblem = '';
    const previous = load(id, resume ? resumeVersion : episodeFor(id).version);
    if (!resume && previous && !confirmedReset) { onClose(); requestFresh(id); return; }
    if (!resume && previous?.completed && !recordCompleted(previous, loadReflection(previous))) {
      storageProblem = 'The previous debrief could not be archived. Your first new action will replace its case checkpoint.';
    }
    state = resume ? previous : createInvestigation('guided', id);
    if (!state) {
      state = createInvestigation('guided', id);
      storageProblem = 'That saved investigation could not be restored. A fresh case is ready; the old checkpoint has not been overwritten.';
    }
    reflection = resume ? loadReflection(state) : { confidence: null, keyActionId: null, uncertaintyId: null };
    if (!resume) {
      const family = families().find((group) => group.records.some((record) => record.id === id));
      if (family) rememberInvestigationArrival(family, id);
    }
    onOpen();
    render();
    document.getElementById('investigationTitle')?.focus({ preventScroll: true });
  }

  function apply(next, focusId) {
    if (!next) {
      if (getCareWorkflow(state)?.canAppend === false) {
        const status = document.getElementById('investigationStatus');
        if (status) status.textContent = 'This run reached its event limit. Export it before starting a new investigation; its saved record has not been cleared.';
      }
      return;
    }
    state = next;
    storageProblem = '';
    save();
    render();
    refresh();
    if (focusId) {
      const target = document.getElementById(focusId);
      if (['latestFinding', 'careReadback', 'careReassessment'].includes(focusId) || focusId.startsWith('care-patient-')) target?.scrollIntoView({ block: 'start' });
      target?.focus({ preventScroll: true });
    }
  }

  function render() {
    const item = episodeFor(selectedId, state.version);
    const presentation = presentationFor(selectedId, state.version);
    const care = getCareWorkflow(state);
    root.replaceChildren();
    const header = element('header', 'investigation-header');
    const titleGroup = element('div');
    titleGroup.append(command('Back to case board', onClose, 'investigation-back'));
    titleGroup.append(element(
      'div',
      'eyebrow',
      `${presentation.audience || 'ALL AUDIENCES'} · ${presentation.playMinutes || '5–8'} MIN · SYNTHETIC PREVIEW`,
    ));
    const title = element('h1', '', item.title);
    title.id = 'investigationTitle';
    title.tabIndex = -1;
    titleGroup.append(title);
    if (item.recordLabel) titleGroup.append(element('p', 'arrival-label', item.recordLabel));
    const modes = element('div', 'mode-picker');
    modes.setAttribute('role', 'group');
    modes.setAttribute('aria-label', 'Investigation mode');
    for (const [id, label] of [['guided', 'Guided'], ['challenge', 'Challenge']]) {
      const button = command(label, () => apply(createInvestigation(id, selectedId, state.version), `mode-${id}`));
      button.id = `mode-${id}`;
      button.title = id === 'guided' ? 'Interpretation after each finding' : 'Interpretation at the debrief';
      button.setAttribute('aria-pressed', String(state.mode === id));
      button.disabled = Boolean(state.actionIds.length || state.hypothesisHistory.length || state.workflow?.events.length || state.completed);
      modes.append(button);
    }
    header.append(titleGroup);
    if (state.completed) {
      titleGroup.append(element('p', 'control-help', `${state.mode === 'challenge' ? 'Challenge' : 'Guided'} · Finished · ${investigationOutcome(state).label}`));
    } else {
      header.append(modes);
    }
    root.append(header);
    if (item.version !== getInvestigationEpisode(item.id)?.version) {
      root.append(element('p', 'control-help', 'Earlier case version — this saved route retains the wording and findings you originally saw. Start a new investigation from the board to use the current case.'));
    }
    if (!state.completed) {
      const brief = element('div', 'investigation-brief');
      brief.append(element('p', '', item.opening));
      root.append(brief);
    }
    const statusText = saved
      ? `${state.actionIds.length || state.hypothesisHistory.length || state.workflow?.events.length ? 'Saved locally' : 'Not started'} · Fictional learning case`
      : 'Storage unavailable. Progress will last only while this page stays open.';
    const status = element('p', 'control-help', storageProblem || statusText);
    status.id = 'investigationStatus';
    status.setAttribute('role', 'status');
    root.append(status);
    if (state.completed) {
      renderDebrief(item);
      return;
    }
    const anchors = element('nav', 'investigation-mobile-nav');
    anchors.setAttribute('aria-label', 'Investigation sections');
    const destinations = care
      ? [['investigationActions', 'Workboard'], ['investigationEvidence', 'Findings'], ['careHandoff', 'Handoff'], ['investigationNotebook', 'Notes']]
      : [['investigationActions', 'Actions'], ['investigationEvidence', 'Evidence'], ['investigationNotebook', 'Notebook']];
    for (const [id, label] of destinations) {
      const anchor = command(label, () => {
        const destination = document.getElementById(id);
        destination?.setAttribute('tabindex', '-1');
        destination?.scrollIntoView({ block: 'start' });
        destination?.focus({ preventScroll: true });
      }, 'quiet-button');
      anchor.setAttribute('aria-label', `Jump to ${label.toLowerCase()}`);
      anchors.append(anchor);
    }
    root.append(anchors);
    const layout = element('div', 'investigation-layout');
    const main = element('section', 'investigation-main');
    main.id = 'investigationMain';
    if (care) main.append(careWorkboard(state, apply));
    else {
    main.append(element('h2', '', 'Choose your next step'));
    const actions = element('div', 'investigation-actions');
    actions.id = 'investigationActions';
    for (const action of availableActions(state)) {
      const button = command('', () => apply(investigate(state, action.id), 'latestFinding'), 'investigation-action');
      button.id = `action-${action.id}`;
      button.setAttribute('aria-label', action.label);
      button.append(element('span', '', action.label), element('small', '', `${action.category} · +${action.minutes} min`));
      actions.append(button);
    }
    if (!actions.childElementCount) actions.append(element('p', '', 'All available findings collected. Your conclusion is next.'));
    main.append(actions);
    }
    const evidence = element('section', 'investigation-evidence');
    evidence.id = 'investigationEvidence';
    evidence.append(element('h2', '', `Evidence collected · ${state.actionIds.length}`));
    if (!state.actionIds.length) evidence.append(element('p', 'control-help', 'No investigation findings recorded.'));
    [...state.actionIds].reverse().forEach((actionId, index) => {
      const action = item.actions.find((entry) => entry.id === actionId);
      if (!action) return;
      const disclosure = document.createElement('details');
      disclosure.open = index === 0;
      const summary = element('summary', '', action.label);
      if (index === 0) {
        summary.id = 'latestFinding';
        summary.tabIndex = -1;
      }
      const entry = element('div', 'evidence-entry');
      entry.append(element('p', '', action.finding));
      if (state.mode === 'guided') entry.append(element('p', 'guided-interpretation', action.interpretation));
      if (state.mode === 'guided' && action.sourceIds?.length) {
        const sourceDetails = document.createElement('details');
        sourceDetails.className = 'investigation-finding-sources';
        sourceDetails.append(element('summary', '', 'Sources'));
        action.sourceIds.forEach((sourceId) => {
          const source = item.sources?.[sourceId];
          if (!source) return;
          const link = element('a', '', source.title);
          link.href = source.url;
          link.target = '_blank';
          link.rel = 'noreferrer';
          sourceDetails.append(link);
        });
        entry.append(sourceDetails);
      }
      disclosure.append(summary, entry);
      evidence.append(disclosure);
    });
    main.append(evidence);
    if (care) main.append(careHandoff(state, apply));
    const notebook = element('aside', 'investigation-notebook');
    notebook.id = 'investigationNotebook';
    notebook.append(investigationScene(presentation, item.title));
    const reference = investigationReference(presentation);
    if (reference) notebook.append(reference);
    const hypotheses = element('fieldset', 'investigation-hypotheses');
    hypotheses.append(element('legend', '', 'Working hypothesis'));
    item.hypotheses.forEach((hypothesis) => {
      const label = element('label');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'investigation-hypothesis';
      radio.value = hypothesis.id;
      radio.id = `hypothesis-${hypothesis.id}`;
      radio.checked = state.hypothesisId === hypothesis.id;
      radio.addEventListener('change', () => apply(setHypothesis(state, hypothesis.id), radio.id));
      label.append(radio, document.createTextNode(hypothesis.label));
      hypotheses.append(label);
    });
    notebook.append(hypotheses);
    notebook.append(reflectionControls(state, reflection, (value) => {
      reflection = value;
      if (!saveReflection(state, reflection)) {
        status.textContent = 'Your optional reasoning could not be saved. It remains in this view.';
      }
    }));
    const commit = command('Commit conclusion', () => {
      if (!state.hypothesisId) {
        status.textContent = 'Choose a working hypothesis before committing.';
        hypotheses.querySelector('input')?.focus();
        return;
      }
      apply(concludeInvestigation(state, state.hypothesisId), 'investigationResultTitle');
      window.scrollTo({ top: 0, behavior: 'instant' });
    }, 'primary-button');
    notebook.append(
      commit,
      element('p', 'investigation-clock', care
        ? `${care.round} team updates · ${state.actionIds.length} reviewed findings`
        : `${state.elapsedMinutes} simulated minutes · ${state.actionIds.length} action${state.actionIds.length === 1 ? '' : 's'}`),
      element('p', 'control-help', care
        ? 'You may finish with uncertainty. The debrief keeps diagnostic support, reasoning and team coordination separate.'
        : 'Authored timing, not a countdown or predicted patient outcome.'),
    );
    if (care) {
      const coordination = element('p', 'care-notebook-status', care.assessment.label);
      coordination.setAttribute('role', 'status');
      notebook.append(coordination);
      if (!care.canAppend) {
        notebook.append(element('p', 'care-stale', 'This run reached its event limit. Export it, then use the case board to start another run. A new run keeps completed journal records.'));
        notebook.append(command('Export current investigation', exportCurrent));
      }
      const review = element('details', 'investigation-sources');
      review.append(element('summary', '', 'Workflow sources and review scope'));
      review.append(element('p', '', care.profile.reviewProvenance.text), element('p', '', care.profile.timingNote));
      for (const source of care.profile.sources) {
        const link = element('a', '', source.title);
        link.href = source.url; link.target = '_blank'; link.rel = 'noreferrer';
        review.append(link, element('p', 'source-scope', source.scope));
      }
      notebook.append(review);
    }
    if (state.hypothesisHistory.length) {
      const log = element('div', 'investigation-log');
      log.append(element('h3', '', 'Your reasoning trail'));
      const list = element('ol');
      state.hypothesisHistory.forEach((entry) => {
        const hypothesis = item.hypotheses.find((value) => value.id === entry.hypothesisId);
        if (hypothesis) list.append(element('li', '', `${hypothesis.label} · after ${entry.afterActionCount} finding${entry.afterActionCount === 1 ? '' : 's'}`));
      });
      log.append(list);
      notebook.append(log);
    }
    layout.append(main, notebook);
    root.append(layout);
  }

  function renderDebrief(item) {
    const debrief = investigationDebrief(state);
    const care = getCareWorkflow(state);
    const result = element('section', 'investigation-result');
    const verdict = investigationOutcome(state);
    const titleText = verdict.status === 'supported'
      ? verdict.kind === 'unresolved' ? 'Cause remains unresolved' : 'Conclusion supported'
      : verdict.status === 'reconsider' ? 'A finding to reconsider' : 'A provisional conclusion';
    const title = element('h2', '', titleText);
    title.id = 'investigationResultTitle';
    title.tabIndex = -1;
    result.append(
      title,
      ...(item.reasoning ? [element('p', '', debrief.summary)] : []),
      element('p', 'route-evidence-summary', debrief.evidenceSummary),
      element('h3', '', verdict.kind === 'unresolved' ? 'What the record establishes' : 'The decisive clue'),
      element('p', '', debrief.decisiveClue),
      element('h3', '', 'Take into the next case'),
      element('p', '', debrief.nextLearning),
    );
    if (care) {
      const workflowStatus = element('p', 'care-debrief-status', `Team coordination · ${care.assessment.label}`);
      title.after(workflowStatus);
    }
    const currentFamily = families().find((family) => family.records.some((record) => record.id === item.id));
    if (currentFamily?.records.length > 1) {
      const another = nextInvestigationArrival(currentFamily);
      result.append(command('Try another arrival', () => open(another.id, false), 'primary-button'));
    }
    const next = families().find((family) => family.id !== (item.familyId || item.id)
      && family.records.some((record) => {
        const savedState = statusFor(record.id).state;
        return !savedState?.completed || savedState.version !== record.version;
      }));
    if (next) {
      const arrival = nextInvestigationArrival(next);
      result.append(command(`New arrival · ${next.title}`, () => open(arrival.id, false), 'quiet-button'));
    }
    result.append(command('Choose another case', onClose, 'quiet-button'));
    result.append(command('Export investigation', exportCurrent));
    result.append(command('Learning journal', openLearningJournal));
    result.append(reflectionSummary(state, reflection));
    if (care) result.append(careSummary(state));
    result.append(transferQuestion(state, reflection));
    const route = element('details', 'investigation-log');
    route.append(element('summary', '', care
      ? `Your investigation · ${debrief.route.length} reviewed findings · ${care.round} team updates`
      : `Your investigation · ${debrief.route.length} action${debrief.route.length === 1 ? '' : 's'} · ${state.elapsedMinutes} simulated minutes`));
    const list = element('ol');
    debrief.route.forEach((step, index) => {
      const action = item.actions.find((entry) => entry.id === state.actionIds[index]);
      const entry = element('li');
      entry.append(
        element('strong', '', step.label),
        element('p', '', step.finding),
        action ? element('p', '', action.interpretation) : element('p'),
      );
      list.append(entry);
    });
    route.append(list);
    result.append(route);
    if (!item.reasoning) {
      const context = element('details', 'investigation-additional-teaching');
      context.append(element('summary', '', 'Authored case context — teaching beyond your route'));
      context.append(element('p', 'control-help', 'This original case explanation may discuss findings you did not collect. Your saved evidence is listed separately above.'));
      context.append(element('p', '', debrief.summary));
      result.append(context);
    }
    if (debrief.additionalTeaching?.length) {
      const later = element('details', 'investigation-additional-teaching');
      later.append(element('summary', '', 'Additional teaching — findings you did not collect'));
      later.append(element('p', 'control-help', 'These explanations are offered after your commitment. They were not evidence used on your saved route.'));
      for (const teaching of debrief.additionalTeaching) later.append(element('h4', '', teaching.label), element('p', '', teaching.interpretation));
      result.append(later);
    }
    const sources = element('details', 'investigation-sources');
    sources.append(element('summary', '', 'Sources and limitations'));
    debrief.sources.forEach((source) => {
      const link = element('a', '', source.title);
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noreferrer';
      sources.append(link);
      if (source.scope) sources.append(element('p', 'source-scope', `Scope: ${source.scope}`));
    });
    debrief.limitations.forEach((limitation) => sources.append(element('p', '', limitation)));
    result.append(sources);
    root.append(result);
  }

  function exportCurrent() {
      const item = episodeFor(selectedId, state.version);
      const receipt = {
        schema: 'medical_mysteries_investigation_receipt_v1',
        exportedUtc: new Date().toISOString(),
        episodeId: item.id,
        episodeVersion: item.version,
        mode: state.mode,
        state,
        debrief: state.completed ? investigationDebrief(state) : null,
        reflection: { ...reflection },
        transfer: state.completed ? journalRecord(state, reflection)?.transfer ?? null : null,
        synthetic: true,
        clinicalUse: false,
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' }));
      const link = element('a');
      link.href = url;
      link.download = item.id === INVESTIGATION_EPISODE.id ? 'night-shift-investigation.json' : `${item.id}-investigation.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  refresh();
  return { refresh };
}
