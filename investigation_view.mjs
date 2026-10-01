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
} from './investigation.mjs';
import { loadInvestigation, saveInvestigation } from './investigation_history.mjs';
import { loadReflection, saveReflection, recordCompleted } from './investigation_journal.mjs';
import { reflectionControls, reflectionSummary, transferQuestion, openLearningJournal, journalRecord } from './investigation_learning_view.mjs';

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
  let reflection = { confidence: null, keyActionId: null };
  const journalButton = document.getElementById('openLearningJournal');
  journalButton?.addEventListener('click', () => { if (isAvailable()) openLearningJournal(); });
  const episodes = () => (Array.isArray(INVESTIGATION_EPISODES) && INVESTIGATION_EPISODES.length ? INVESTIGATION_EPISODES : [INVESTIGATION_EPISODE]);
  const episodeFor = (id) => getInvestigationEpisode(id) || episodes().find((item) => item.id === id) || INVESTIGATION_EPISODE;
  const presentationFor = (id) => getInvestigationPresentation(id) || {};
  const load = (id) => loadInvestigation(id);

  function statusFor(id) {
    const checkpoint = load(id);
    if (!checkpoint) return { label: 'Not started', state: null };
    return checkpoint.completed ? { label: 'Completed', state: checkpoint } : { label: 'In progress', state: checkpoint };
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
    const visibleEpisodes = episodes().filter((item) => {
      const matchesSearch = !search || item.title.toLowerCase().includes(search);
      const itemAudience = String(presentationFor(item.id).audience || '').toLowerCase();
      const matchesAudience = audience === 'all' || itemAudience.includes(audience.toLowerCase());
      return matchesSearch && matchesAudience;
    });
    if (resetRequest && !visibleEpisodes.some((item) => item.id === resetRequest)) resetRequest = null;
    shelf.replaceChildren();
    for (const item of visibleEpisodes) {
      const presentation = presentationFor(item.id);
      const savedCase = statusFor(item.id);
      const card = element('article', 'investigation-card');
      card.dataset.episodeId = item.id;
      const image = element('img');
      image.src = presentation.image || './assets/episodes/doc-002-aorta-escalation-720.webp';
      image.alt = presentation.imageAlt || `${item.title} illustrative scene art. Not diagnostic evidence.`;
      const body = element('div', 'investigation-card-body');
      body.append(element('div', 'eyebrow', item.id === INVESTIGATION_EPISODE.id ? 'FEATURED INVESTIGATION' : 'NEW INVESTIGATION'));
      body.append(element('h2', '', item.title));
      const subtitle = item.id === INVESTIGATION_EPISODE.id
        ? 'Sudden pain. Competing explanations.'
        : (item.subtitle || item.opening || 'Sudden pain. Competing explanations.');
      body.append(element('p', 'investigation-card-subtitle', subtitle));
      body.append(element('p', 'investigation-card-meta', `${presentation.audience || 'All audiences'} · ${presentation.playMinutes || '5–8'} min`));
      const savedMode = savedCase.state ? ` · ${savedCase.state.mode === 'challenge' ? 'Challenge' : 'Guided'}` : '';
      const stateLine = element(
        'p',
        `investigation-card-state ${savedCase.state ? 'has-save' : ''}`,
        `${savedCase.label}${savedMode}`,
      );
      stateLine.setAttribute('aria-live', 'polite');
      body.append(stateLine);
      const actions = element('div', 'investigation-card-actions');
      if (savedCase.state) {
        const resume = command(savedCase.state.completed ? 'View debrief' : 'Resume', () => open(item.id, true), 'primary-button');
        resume.dataset.investigationAction = 'resume';
        resume.dataset.action = 'resume';
        resume.dataset.episodeId = item.id;
        if (item.id === INVESTIGATION_EPISODE.id) resume.id = 'resumeInvestigation';
        actions.append(resume);
        const fresh = command('Start new', () => requestFresh(item.id), 'quiet-button');
        fresh.dataset.investigationAction = 'fresh';
        fresh.dataset.action = 'start';
        fresh.dataset.episodeId = item.id;
        if (item.id === INVESTIGATION_EPISODE.id) fresh.id = 'openInvestigation';
        actions.append(fresh);
      } else {
        const fresh = command('Investigate', () => open(item.id, false), 'primary-button');
        fresh.dataset.investigationAction = 'fresh';
        fresh.dataset.action = 'start';
        fresh.dataset.episodeId = item.id;
        if (item.id === INVESTIGATION_EPISODE.id) fresh.id = 'openInvestigation';
        actions.append(fresh);
      }
      body.append(actions);
      card.append(image, body);
      shelf.append(card);
      if (resetRequest === item.id) renderResetNotice(card);
    }
    return { totalCount: episodes().length, matchingCount: visibleEpisodes.length };
  }

  function renderResetNotice(card) {
    const item = episodeFor(resetRequest);
    const notice = element('div', 'investigation-reset-notice');
    notice.setAttribute('role', 'alert');
    notice.append(element('p', '', `${item.title} already has a saved ${statusFor(item.id).label.toLowerCase()} run. The saved run remains until your first new action.`));
    const confirm = command('Confirm start new', () => {
      const id = resetRequest;
      resetRequest = null;
      open(id, false, true);
    }, 'primary-button');
    confirm.dataset.action = 'confirm-restart';
    const cancel = command('Keep saved run', () => {
      resetRequest = null;
      renderShelf();
      shelf?.querySelector(`[data-episode-id="${CSS.escape(item.id)}"] [data-action="start"]`)?.focus({ preventScroll: false });
    }, 'quiet-button');
    cancel.dataset.action = 'cancel-restart';
    notice.append(confirm, cancel);
    card.append(notice);
  }

  function requestFresh(id) {
    resetRequest = id;
    renderShelf();
    const notice = shelf?.querySelector(`[data-episode-id="${CSS.escape(id)}"] .investigation-reset-notice`);
    notice?.scrollIntoView({ block: 'nearest' });
    notice?.querySelector('[data-action="confirm-restart"]')?.focus({ preventScroll: true });
  }
  function refresh() {
    journalButton?.classList.toggle('hidden', !isAvailable());
    if (!isAvailable()) return { totalCount: 0, matchingCount: 0 };
    return renderShelf();
  }

  function open(id = INVESTIGATION_EPISODE.id, resume = false, confirmedReset = false) {
    if (!isAvailable()) return;
    if (resetRequest && resetRequest !== id) resetRequest = null;
    selectedId = id;
    saved = true;
    storageProblem = '';
    const previous = load(id);
    if (!resume && previous && !confirmedReset) { requestFresh(id); return; }
    if (!resume && previous?.completed && !recordCompleted(previous, loadReflection(previous))) {
      storageProblem = 'The previous debrief could not be archived. Your first new action will replace its case checkpoint.';
    }
    state = resume ? previous : createInvestigation('guided', id);
    if (!state) {
      state = createInvestigation('guided', id);
      storageProblem = 'That saved investigation could not be restored. A fresh case is ready; the old checkpoint has not been overwritten.';
    }
    reflection = resume ? loadReflection(state) : { confidence: null, keyActionId: null };
    onOpen();
    render();
    document.getElementById('investigationTitle')?.focus({ preventScroll: true });
  }

  function apply(next, focusId) {
    if (!next) return;
    state = next;
    storageProblem = '';
    save();
    render();
    refresh();
    if (focusId) document.getElementById(focusId)?.focus({ preventScroll: focusId !== 'latestFinding' });
  }

  function render() {
    const item = episodeFor(selectedId);
    const presentation = presentationFor(selectedId);
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
    const modes = element('div', 'mode-picker');
    modes.setAttribute('role', 'group');
    modes.setAttribute('aria-label', 'Investigation mode');
    for (const [id, label] of [['guided', 'Guided'], ['challenge', 'Challenge']]) {
      const button = command(label, () => apply(createInvestigation(id, selectedId), `mode-${id}`));
      button.id = `mode-${id}`;
      button.title = id === 'guided' ? 'Interpretation after each finding' : 'Interpretation at the debrief';
      button.setAttribute('aria-pressed', String(state.mode === id));
      button.disabled = Boolean(state.actionIds.length || state.hypothesisHistory.length || state.completed);
      modes.append(button);
    }
    header.append(titleGroup);
    if (state.completed) {
      titleGroup.append(element('p', 'control-help', `${state.mode === 'challenge' ? 'Challenge' : 'Guided'} · Complete`));
    } else {
      header.append(modes);
    }
    root.append(header);
    if (!state.completed) {
      const brief = element('div', 'investigation-brief');
      brief.append(element('p', '', item.opening));
      root.append(brief);
    }
    const statusText = saved
      ? `${state.actionIds.length || state.hypothesisHistory.length ? 'Saved locally' : 'Not started'} · Pending human review`
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
    for (const [id, label] of [['investigationActions', 'Actions'], ['investigationEvidence', 'Evidence'], ['investigationNotebook', 'Notebook']]) {
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
    const notebook = element('aside', 'investigation-notebook');
    notebook.id = 'investigationNotebook';
    const scene = element('figure', 'investigation-scene');
    const image = element('img');
    image.src = presentation.image || './assets/episodes/doc-002-aorta-escalation-720.webp';
    image.alt = presentation.imageAlt || `${item.title} illustrative scene art. Not diagnostic evidence.`;
    scene.append(image, element('figcaption', 'control-help', 'Generated scene art · not diagnostic evidence'));
    notebook.append(scene);
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
      element('p', 'investigation-clock', `${state.elapsedMinutes} simulated minutes · ${state.actionIds.length} action${state.actionIds.length === 1 ? '' : 's'}`),
      element('p', 'control-help', 'Authored timing, not a countdown or predicted patient outcome.'),
    );
    if (state.hypothesisHistory.length) {
      const log = element('div', 'investigation-log');
      log.append(element('h3', '', 'Your reasoning trail'));
      const list = element('ol');
      state.hypothesisHistory.forEach((entry) => {
        const hypothesis = item.hypotheses.find((value) => value.id === entry.hypothesisId);
        if (hypothesis) list.append(element('li', '', `${hypothesis.label} · after ${entry.afterActionCount} findings`));
      });
      log.append(list);
      notebook.append(log);
    }
    layout.append(main, notebook);
    root.append(layout);
  }

  function renderDebrief(item) {
    const debrief = investigationDebrief(state);
    const result = element('section', 'investigation-result');
    const titleText = state.conclusion.evidenceComplete
      ? (debrief.correct ? 'Conclusion supported' : 'A finding to reconsider')
      : 'A provisional conclusion';
    const title = element('h2', '', titleText);
    title.id = 'investigationResultTitle';
    title.tabIndex = -1;
    result.append(
      title,
      element('p', '', debrief.summary),
      element('h3', '', 'The decisive clue'),
      element('p', '', debrief.decisiveClue),
      element('h3', '', 'Take into the next case'),
      element('p', '', debrief.nextLearning),
    );
    const next = episodes().find((candidate) => candidate.id !== item.id && !statusFor(candidate.id).state?.completed);
    if (next) {
      const nextSaved = statusFor(next.id).state;
      result.append(command(`${nextSaved ? 'Resume' : 'Investigate'} ${next.title}`, () => open(next.id, Boolean(nextSaved)), 'primary-button'));
    }
    result.append(command('Choose another case', onClose, 'quiet-button'));
    result.append(command('Export investigation', () => {
      const receipt = {
        schema: 'medical_mysteries_investigation_receipt_v1',
        exportedUtc: new Date().toISOString(),
        episodeId: item.id,
        episodeVersion: item.version,
        mode: state.mode,
        state,
        debrief,
        reflection: { ...reflection },
        transfer: journalRecord(state)?.transfer ?? null,
        synthetic: true,
        clinicalUse: false,
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' }));
      const link = element('a');
      link.href = url;
      link.download = item.id === INVESTIGATION_EPISODE.id ? 'night-shift-investigation.json' : `${item.id}-investigation.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }));
    result.append(command('Learning journal', openLearningJournal));
    result.append(reflectionSummary(state, reflection), transferQuestion(state, reflection));
    const route = element('details', 'investigation-log');
    route.append(element('summary', '', `Your investigation · ${debrief.route.length} actions · ${state.elapsedMinutes} simulated minutes`));
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

  refresh();
  return { refresh };
}
