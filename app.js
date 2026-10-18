import { getGameStorage, isNativeStorage } from './game_storage.mjs';
import { REVIEW_STATEMENT } from './product_release.mjs';
import { renderEducationalExhibit } from './educational_exhibits.mjs';
import { offlineRequest } from './offline_api.mjs';
async function loadModule(path) {
  try { return await import(path); }
  catch (error) {
    const status = document.getElementById('error');
    status.textContent = 'The game could not start. Reload this page and try again.';
    status.classList.remove('hidden');
    document.getElementById('tierInfo').textContent = 'Game modules unavailable';
    throw error;
  }
}

const {
  reconcileReviewQueue, selectDueReview, nextReviewEntry, summarizeReviewChange,
} = await loadModule('./review_queue.mjs');
const {
  TRANSFER_PRACTICE_PACKS, supportsPractice, createPracticeState,
  answerPractice, nextPractice, practiceTally,
} = await loadModule('./transfer_practice.mjs');
const { savePractice, loadPractice, practiceSummary, clearPracticeHistory } = await loadModule('./practice_history.mjs');
const { mountInvestigation } = await loadModule('./investigation_view.mjs');

const { assessResultConfidence, assessConfidenceRecord } = await loadModule('./confidence_assessment.mjs');
const { loadStoryProfile, saveStoryPreferences, recordStoryCompletion, STORY_REVIEW_ROUTES, storyReviewRoute, CURRENT_STORY_BUILD } = await loadModule('./story_progress.mjs');
const { openStoryHistory } = await loadModule('./story_history_view.mjs');
const { readStoryReviews, writeStoryReviews } = await loadModule('./story_reviews.mjs');

const $ = (id) => document.getElementById(id);
let session = null;
let pending = null;
let transit = false;
let feedbackSubmitted = false;
let coldOpenReturnFocus = null;
let selectedMobileTab = null;
let tierListing = null;
let transferPracticeState = null;
let transferPracticeSessionId = null;
let practiceCaseId = null;
let standalonePractice = false;
const debriefEventsSent = new Set();
const ACTIVE_SESSION_KEY = 'mmActiveSession';
const DRAFT_PREFIX = 'mmDraft:';

function readStorage(key) {
  try { return JSON.parse(getGameStorage()?.getItem(key)); } catch { return null; }
}
function writeStorage(key, value) {
  try { getGameStorage()?.setItem(key, JSON.stringify(value)); } catch { showStoryStorage('Progress could not be saved. Keep this session open and export your history before closing.'); }
}
function activeSessionReference() {
  const ref = readStorage(ACTIVE_SESSION_KEY);
  return ref && typeof ref.session_id === 'string' && typeof ref.case_id === 'string' && typeof ref.tier === 'string' ? ref : null;
}
function saveActiveSessionReference(value) {
  writeStorage(ACTIVE_SESSION_KEY, { session_id: value.session_id, case_id: value.case_id, tier: value.tier,
    build_id: value.build_id, content_version: value.content_version });
}
function draftKey(value) { return value?.session_id && value?.stage_id ? `${DRAFT_PREFIX}${value.session_id}` : null; }
function readDraft(value) {
  const key = draftKey(value);
  if (!key) return null;
  const stored = readStorage(key);
  return stored && typeof stored === 'object' && stored.session_id === value.session_id
    ? stored.stages?.[value.stage_id] || null : null;
}
function saveDraft(value) {
  const key = draftKey(value);
  if (!key || !value?.session_id || !value?.stage_id) return;
  const ranking = {};
  document.querySelectorAll('#rankingRows select').forEach((select) => {
    if (['1', '2', '3'].includes(select.value) && select.dataset.optionId) ranking[select.dataset.optionId] = select.value;
  });
  const current = readStorage(key);
  const stages = current?.session_id === value.session_id && current.stages && typeof current.stages === 'object' ? current.stages : {};
  stages[value.stage_id] = {
    confidence: $('recordConfidence')?.checked ? $('confidenceInput')?.value : null,
    confidenceRecorded: $('recordConfidence')?.checked === true,
    rankAlternatives: $('rankAlternatives')?.checked === true,
    ranking,
  };
  const bounded = Object.fromEntries(Object.entries(stages).slice(-32));
  writeStorage(key, { session_id: value.session_id, stages: bounded });
}

function consumedStageKey(value) { return value?.session_id && value?.stage_id ? `${ACTIVE_SESSION_KEY}:stage:${value.session_id}:${value.stage_id}` : null; }

async function api(path, options = {}) {
  const response = await offlineRequest(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  if (data.persistence_status && !['saved', 'available', 'ok'].includes(data.persistence_status)) showStoryStorage(data.persistence_note || 'This play may not survive a reload. Existing records have not been replaced.');
  return data;
}

function showStoryStorage(message) {
  const notice = $('storyStorageStatus');
  if (!notice) return;
  text(notice, message);
  notice.classList.remove('hidden');
}

function text(node, value) {
  node.textContent = value == null ? '' : String(value);
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function resetScrollToTop() {
  const behavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  window.scrollTo({ top: 0, left: 0, behavior });
}

function assetUrl(asset) {
  return `./assets/${String(asset).split('/').map((part) => encodeURIComponent(part)).join('/')}`;
}

function clearMedia(image, { caption = null, wrapper = null } = {}) {
  if (image) {
    for (const attribute of ['src', 'srcset', 'sizes', 'alt']) image.removeAttribute(attribute);
    for (const key of Object.keys(image.dataset)) delete image.dataset[key];
  }
  if (caption) text(caption, '');
  if (wrapper) wrapper.classList.add('hidden');
}

function clearSessionMedia() {
  clearMedia($('scene'));
  clearMedia($('coldOpenMedia'));
  clearMedia($('resultMedia'), { caption: $('resultMediaCaption'), wrapper: $('resultMediaWrap') });
  clearMedia($('mediaViewerImage'), { caption: $('mediaViewerCaption') });
  if ($('mediaViewer')?.open) $('mediaViewer').close();
  clear($('mobileScene'));
  clear($('sceneHotspots'));
}

function applyMedia(image, media, { sizes = '100vw', title = '', caption = '' } = {}) {
  if (!image) return '';
  // Always discard the previous media contract before applying a new one.
  // This also protects stage transitions and the viewer from stale optional
  // data attributes that a new payload does not happen to replace.
  clearMedia(image);
  if (!media) {
    return '';
  }
  const variants = [...(media.variants || [])].sort((a, b) => Number(a.width) - Number(b.width));
  image.src = assetUrl(media.asset);
  image.alt = media.alt || `${title || 'Fictional case'} scene; illustrative only, not diagnostic evidence.`;
  if (variants.length) image.srcset = variants.map((variant) => `${assetUrl(variant.asset)} ${variant.width}w`).join(', ');
  else image.removeAttribute('srcset');
  image.sizes = sizes;
  image.dataset.mediaAsset = String(media.asset);
  image.dataset.safeCaption = caption || `${image.alt} Illustrative only; not diagnostic evidence or a promised outcome.`;
  return image.dataset.safeCaption;
}

function openMediaViewer(image) {
  const dialog = $('mediaViewer');
  if (!dialog || !image?.src) return;
  dialog.returnFocus = image.closest('button') || image;
  applyMedia($('mediaViewerImage'), {
    asset: image.dataset.mediaAsset,
    alt: image.alt,
    variants: image.srcset.split(',').filter(Boolean).map((entry) => {
      const [asset, width] = entry.trim().split(/\s+/);
      return { asset: decodeURIComponent(asset.replace(/^\/assets\//, '')), width: Number.parseInt(width, 10) };
    }).filter((variant) => variant.asset && variant.width),
  }, { sizes: 'min(96vw, 1440px)', caption: image.dataset.safeCaption });
  text($('mediaViewerCaption'), image.dataset.safeCaption);
  dialog.showModal();
  $('mediaViewerClose').focus();
}

function renderConsequenceMedia(media, stageNumber) {
  if (!media) return;
  const wrap = document.createElement('div');
  wrap.className = 'consequence-media-wrap';
  const imageButton = document.createElement('button');
  imageButton.type = 'button';
  imageButton.className = 'image-button';
  imageButton.setAttribute('aria-label', `Open Investigation ${stageNumber} consequence image`);
  const image = document.createElement('img');
  applyMedia(image, media, {
    sizes: '(max-width: 800px) 92vw, 640px',
    title: `Investigation ${stageNumber} consequence`,
    caption: 'Illustrative-only consequence art; not diagnostic evidence or a promised outcome.',
  });
  imageButton.appendChild(image);
  imageButton.addEventListener('click', () => openMediaViewer(image));
  const caption = document.createElement('p');
  caption.className = 'media-caption';
  text(caption, image.dataset.safeCaption);
  wrap.append(imageButton, caption);
  $('feedback').appendChild(wrap);
}

function showError(error) {
  text($('error'), `Could not complete this step: ${error.message}. Your earlier saved routes are kept. Retry the step or return to the case board.`);
  $('error').classList.remove('hidden');
  $('error').tabIndex = -1;
  $('error').focus({ preventScroll: true });
  $('error').scrollIntoView({ block: 'center' });
}

function renderList(data) {
  clear($('tierGrid'));
  const details = {
    public: 'Guided stories · plain-language safety',
    student: 'Workup order · physiology · traps',
    doctor: 'Subtle findings · management calls',
  };
  const labels = { public: 'Public', student: 'Student', doctor: 'Doctor' };
  // Attainable XP per tier drives calibrated rank thresholds.
  const attainable = {};
  for (const tier of ['public', 'student', 'doctor']) {
    attainable[tier] = (data.tiers[tier] || []).reduce((sum, entry) => sum + (entry.attainable_xp || 0), 0);
  }
  renderRankChip(attainable);
  const profile = loadProfile();
  for (const tier of ['public', 'student', 'doctor']) {
    const query = $('caseSearch').value.trim().toLowerCase();
    const filter = $('caseFilter').value;
    if (filter !== 'all' && filter !== tier) continue;
    const entries = (data.tiers[tier] || []).filter((entry) => !query || entry.title.toLowerCase().includes(query));
    if (!entries.length) {
      if ((data.tiers[tier] || []).length) continue;
      const empty = document.createElement('div');
      empty.className = 'tier-empty';
      empty.dataset.tier = tier;
      text(empty, `${labels[tier]} · no cases available`);
      $('tierGrid').appendChild(empty);
      continue;
    }
    for (const entry of entries) {
      const button = document.createElement('article');
      button.className = 'case-card tier-card';
      button.dataset.caseId = entry.case_id;
      button.type = 'button';
      const play = profile.plays?.[entry.case_id];
      const image = document.createElement('img');
      image.className = 'case-cover';
      applyMedia(image, entry.cover, { sizes: '(max-width: 800px) 92vw, 320px', title: entry.title });
      const cover = document.createElement('div'); cover.className = 'case-cover-wrap'; cover.appendChild(image);
      const name = document.createElement('div');
      name.className = 'case-title';
      text(name, entry.title);
      const detail = document.createElement('div');
      detail.className = 'case-meta';
      text(detail, `${labels[tier]} · ${details[tier]}`);
      const count = document.createElement('div');
      count.className = 'case-status';
      text(count, play ? `Best first-try accuracy · ${Math.round((play.best_accuracy || 0) * 100)}% · Complete` : 'Not attempted · New');
      const edition = document.createElement('div'); edition.className = 'case-meta';
      const earlier = profile.legacy_plays?.[entry.case_id];
      text(edition, `Story version ${entry.content_version || 3}${earlier ? ` · Earlier edition summary retained (${Math.round((earlier.best_accuracy ?? earlier.accuracy ?? 0) * 100)}%)` : ''}`);
      const review = document.createElement('div'); review.className = 'case-review'; text(review, nextReviewLabel(entry.case_id, play));
      const open = document.createElement('button'); open.className = 'case-open'; open.type = 'button'; open.setAttribute('aria-label', entry.title); text(open, play ? 'Open case' : 'Start case'); open.addEventListener('click', () => start(tier, entry.case_id, true));
      button.append(cover, name, detail, edition, count, review, open);
      if (supportsPractice(entry.case_id) && data.features.practice) {
        const practice = document.createElement('button'); practice.type = 'button'; practice.className = 'quiet-button case-practice';
        text(practice, 'Practice'); practice.setAttribute('aria-label', `Practice ${entry.title}`);
        practice.addEventListener('click', () => openPractice(entry.case_id)); button.appendChild(practice);
      }
      $('tierGrid').appendChild(button);
    }
  }
  text($('tierInfo'), 'Six stories · Nine investigations · Fictional learning cases');
  tierListing = data;
  const investigations = investigationUI.refresh();
  text($('rankChip'), `${Object.values(data.tiers).flat().length} stories${investigations.totalCount ? ` · ${investigations.totalCount} investigation families` : ''}`);
  $('flagshipEntry').classList.toggle('hidden', !data.features.investigations || !investigations.matchingCount);
  $('openPracticeLibrary').classList.toggle('hidden', !data.features.practice);
  $('caseFilterStatus').classList.toggle('hidden', Boolean($('tierGrid').querySelector('.case-card')) || investigations.matchingCount > 0);
  text($('caseFilterStatus'), 'No matching stories. Try another title or audience.');
  updateBoardActions();
}

async function loadTiers() {
  try {
    text($('tierInfo'), 'Loading case bank…');
    const data = await api('/api/tiers');
    attainableByTier = {};
    for (const tier of ['public', 'student', 'doctor']) {
      attainableByTier[tier] = (data.tiers[tier] || []).reduce((sum, entry) => sum + (entry.attainable_xp || 0), 0);
    }
    renderList(data);
  } catch (error) {
    showError(error);
  }
}

async function start(tier, caseId = '', markStarted = false, buildId = CURRENT_STORY_BUILD) {
  try {
    closeExtraViews();
    // Case cards and New case are always fresh starts; only Board Continue
    // uses the persisted session reference.
    clearSessionMedia();
    $('result').classList.add('hidden');
    $('coldOpen').classList.add('hidden');
    coldOpenReturnFocus = document.activeElement;
    const suffix = caseId ? `&case_id=${encodeURIComponent(caseId)}` : '';
    session = await api(`/api/start?tier=${encodeURIComponent(tier)}${suffix}&build_id=${encodeURIComponent(buildId)}`);
    saveActiveSessionReference(session);
    if (markStarted && caseId && !saveStoryPreferences({ last_started_case_id: caseId, last_started_build_id: buildId, last_started_at: Date.now() })) showStoryStorage('The case is open, but the last-start preference could not be saved.');
    pending = null;
    feedbackSubmitted = false;
    debriefEventsSent.clear();
    $('error').classList.add('hidden');
    $('menu').classList.add('hidden');
    $('game').classList.remove('hidden');
    $('result').classList.add('hidden');
    $('game').classList.remove('hidden');
    if (session.cold_open) showColdOpen(session.cold_open);
    else renderStage(session);
  } catch (error) {
    showError(error);
  }
}

// Replay mapping for the six authored cases; review starts the source case,
// not a newly generated variant.
const reviewVariantCaseMap = STORY_REVIEW_ROUTES;
function nextReviewLabel(caseId, play) {
  const matching = nextReviewEntry(readReviewQueue(), caseId, reviewVariantCaseMap);
  if (matching) return `${matching.due_at <= Date.now() ? 'Next review · Due now' : `Next review · ${new Date(matching.due_at).toLocaleDateString()}`} · Story version ${storyReviewRoute(matching)?.content_version || '?'}`;
  return play?.completed_at ? `Last completed · ${new Date(play.completed_at).toLocaleDateString()}` : 'Next review · Not scheduled';
}
function readReviewQueue() {
  const saved = readStoryReviews();
  if (saved.status === 'invalid') showStoryStorage('Some earlier scheduled-review data could not be read. Its original bytes are preserved; new reviews cannot replace it.');
  return saved.entries;
}
function eligibleEntries() {
  if (!tierListing) return [];
  return ['public', 'student', 'doctor'].flatMap((tier) => (tierListing.tiers[tier] || []).map((entry) => ({ ...entry, tier })));
}
function updateBoardActions() {
  if (!tierListing) return;
  const profile = loadProfile();
  const entries = eligibleEntries();
  const byId = new Map(entries.map((entry) => [entry.case_id, entry]));
  const active = activeSessionReference();
  const started = active && byId.get(active.case_id);
  const completed = entries.filter((entry) => profile.plays?.[entry.case_id]).sort((a, b) => Number(profile.plays[b.case_id].completed_at || 0) - Number(profile.plays[a.case_id].completed_at || 0))[0];
  const continuation = started;
  const fresh = entries.find((entry) => !profile.plays?.[entry.case_id]);
  let due = null;
  const item = selectDueReview(readReviewQueue(), [...byId.keys()], reviewVariantCaseMap);
  const reviewRoute = item && storyReviewRoute(item);
  if (reviewRoute) due = { ...byId.get(reviewRoute.case_id), ...reviewRoute };
  const configure = (id, target, label, enabled) => { const button = $(id); button.disabled = !enabled; button.dataset.caseId = enabled ? target.case_id : ''; text(button, label); };
  configure('boardContinue', continuation, continuation ? `Continue · ${continuation.title} · Story version ${active.content_version || 1} →` : 'Continue · Nothing started', Boolean(continuation));
  configure('boardNew', fresh, fresh ? 'New case' : 'New case · All played', Boolean(fresh));
  configure('boardReview', due, due ? `Review case · ${due.title} · Story version ${due.content_version}` : 'Review case · None due', Boolean(due));
  $('boardContinue').onclick = continuation ? () => resumeActiveSession() : null;
  $('boardNew').onclick = fresh ? () => start(fresh.tier, fresh.case_id, true) : null;
  $('boardReview').onclick = due ? () => start(due.tier, due.case_id, true, due.build_id) : null;
  $('boardContinue').classList.toggle('primary-button', Boolean(continuation));
  $('boardContinue').classList.toggle('quiet-button', !continuation);
  $('boardNew').classList.toggle('primary-button', !continuation && Boolean(fresh));
  $('boardNew').classList.toggle('quiet-button', Boolean(continuation) || !fresh);
}

async function resumeActiveSession(sessionId) {
  const reference = typeof sessionId === 'string' ? { session_id: sessionId } : activeSessionReference();
  if (!reference) return;
  try {
    closeExtraViews();
    clearSessionMedia();
    const restored = await api(`/api/resume?session_id=${encodeURIComponent(reference.session_id)}`);
    session = restored;
    saveActiveSessionReference(restored);
    pending = null;
    feedbackSubmitted = false;
    debriefEventsSent.clear();
    $('error').classList.add('hidden');
    $('menu').classList.add('hidden');
    $('game').classList.remove('hidden');
    if (restored.finished && restored.last_result) {
      finish(restored.last_result, true);
      return;
    }
    const result = restored.last_result;
    const displayed = restored.displayed_stage || restored;
    const consumedThisStage = Boolean(readStorage(consumedStageKey({ session_id: restored.session_id, stage_id: displayed.stage_id })));
    const shouldReplay = result && (!result.correct || (result.correct && result.next && !consumedThisStage));
    if (shouldReplay) {
      session = activeSessionFromStage(displayed);
      renderStage(session);
      renderAnswerFeedback(result, displayed.stage_number);
      if (result.correct && result.next) {
        pending = activeSessionFromStage(result.next);
        stopCodeTimer();
        setOptionsLocked(true);
        $('continueBtn').classList.remove('hidden');
      } else setOptionsLocked(false);
    } else {
      session = activeSessionFromStage(restored);
      renderStage(session);
    }
  } catch (error) {
    showError(error);
  }
}

function showColdOpen(text) {
  $('coldOpenText').textContent = text;
  const coldOpenMedia = $('coldOpenMedia');
  clearMedia(coldOpenMedia);
  applyMedia(coldOpenMedia, session.media, { sizes: '(max-width: 800px) 92vw, 640px', title: session.title });
  $('coldOpenMediaOpen').onclick = () => openMediaViewer(coldOpenMedia);
  $('coldOpen').classList.remove('hidden');
  $('coldOpenBtn').focus();
  const closeColdOpen = () => {
    $('coldOpen').classList.add('hidden');
    renderStage(session);
    (coldOpenReturnFocus || $('stageTitle')).focus?.();
    coldOpenReturnFocus = null;
  };
  $('coldOpenBtn').onclick = closeColdOpen;
}

function renderArray(id, values, kind) {
  const box = $(id);
  if (!box) return;
  clear(box);
  for (const item of values || []) {
    const node = document.createElement('div');
    node.className = kind;
    if (kind === 'vital') {
      const value = document.createElement('b');
      text(value, `${item.value} ${item.unit || ''}`);
      const label = document.createElement('span');
      text(label, item.label);
      node.append(value, label);
    } else {
      const time = document.createElement('b');
      text(time, item.time);
      node.append(time, document.createTextNode(item.event || item.detail || item.label || ''));
    }
    box.appendChild(node);
  }
}

function activeSessionFromStage(stage) {
  return {
    ...stage,
    session_id: session.session_id,
    sandbox: session.sandbox,
    build_id: stage.build_id || session.build_id,
    content_version: stage.content_version || session.content_version,
    edition_label: stage.edition_label || session.edition_label,
  };
}

function renderDecisionControls(stage) {
  const confidence = $('confidenceInput');
  const ranking = $('rankingControls');
  const rows = $('rankingRows');
  const draft = readDraft(stage);
  const recorded = draft?.confidenceRecorded === true && draft?.confidence != null;
  $('recordConfidence').checked = recorded;
  $('confidenceFields').classList.toggle('hidden', !recorded);
  confidence.value = recorded ? String(draft.confidence) : '70';
  text($('confidenceValue'), recorded ? `${confidence.value}%` : 'Not recorded');
  text($('decisionStatus'), '');
  clear(rows);
  const optionalRanking = stage.supports_ranking && !stage.requires_ranking;
  const rankingEnabled = stage.requires_ranking || (optionalRanking && draft?.rankAlternatives === true);
  $('rankToggleLabel').classList.toggle('hidden', !optionalRanking);
  $('rankAlternatives').checked = optionalRanking && draft?.rankAlternatives === true;
  ranking.classList.toggle('hidden', !rankingEnabled);
  if (!rankingEnabled) return;
  for (const option of stage.options || []) {
    const row = document.createElement('label');
    row.className = 'ranking-row';
    const label = document.createElement('span');
    text(label, option.label);
    const select = document.createElement('select');
    select.dataset.optionId = option.id;
    select.setAttribute('aria-label', `Rank for ${option.label}`);
    const placeholder = document.createElement('option');
    placeholder.value = '';
    text(placeholder, 'Choose rank');
    select.appendChild(placeholder);
    for (const rank of (stage.options || []).map((_, index) => index + 1)) {
      const choice = document.createElement('option');
      choice.value = String(rank);
      text(choice, `Rank ${rank}`);
      select.appendChild(choice);
    }
    row.append(label, select);
    if (draft?.ranking && Object.prototype.hasOwnProperty.call(draft.ranking, option.id)) select.value = draft.ranking[option.id];
    select.addEventListener('change', () => { text($('decisionStatus'), ''); saveDraft(stage); });
    rows.appendChild(row);
  }
}

function renderDifferential(stage) {
  const existing = $('differentialBoard');
  if (existing) existing.remove();
  if (!stage.supports_ranking) return;
  const observations = (stage.observations || []).filter((observation) => observation?.id);
  if (!observations.length || !(stage.options || []).length) return;
  const board = document.createElement('section');
  board.id = 'differentialBoard';
  board.className = 'differential-board';
  const heading = document.createElement('div');
  heading.className = 'section-label';
  text(heading, 'DIFFERENTIAL BOARD');
  const help = document.createElement('p');
  help.className = 'control-help';
  text(help, 'Attach examined observations to a visible hypothesis as supporting or opposing. This practice board never changes correctness or XP.');
  board.append(heading, help);
  const grid = document.createElement('div');
  grid.className = 'differential-grid';
  for (const option of stage.options) {
    const column = document.createElement('section');
    column.className = 'differential-column';
    const title = document.createElement('h5');
    text(title, option.label);
    column.appendChild(title);
    for (const observation of observations) {
      const row = document.createElement('div');
      row.className = 'differential-row';
      const label = document.createElement('span');
      text(label, observation.label);
      const controls = document.createElement('div');
      controls.className = 'differential-controls';
      const current = stage.differential?.[stage.stage_id]?.[option.id]?.[observation.id] || '';
      for (const stance of ['supporting', 'opposing']) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'stance-button';
        button.setAttribute('aria-label', `${stance} ${observation.label} for ${option.label}`);
        button.setAttribute('aria-pressed', String(current === stance));
        text(button, stance === 'supporting' ? '+' : '−');
        button.title = stance;
        button.addEventListener('click', () => attachEvidence(stage, option.id, observation.id, stance));
        controls.appendChild(button);
      }
      row.append(label, controls);
      column.appendChild(row);
    }
    grid.appendChild(column);
  }
  board.appendChild(grid);
  $('evidencePanel').appendChild(board);
}

async function attachEvidence(stage, optionId, evidenceId, stance) {
  if (transit || !session) return;
  transit = true;
  try {
    const result = await api('/api/attach-evidence', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session.session_id, stage_id: stage.stage_id, option_id: optionId, evidence_id: evidenceId, stance }) });
    session = activeSessionFromStage({ ...stage, differential: result.differential });
    renderStage(session);
    text($('decisionStatus'), `Observation attached as ${stance}.`);
  } catch (error) { text($('decisionStatus'), `Could not attach observation: ${error.message}`); }
  finally { transit = false; }
}

function commitDetails(optionId, stage) {
  text($('decisionStatus'), '');
  const rawConfidence = $('confidenceInput').value.trim();
  if (!/^\d+$/.test(rawConfidence)) {
    text($('decisionStatus'), 'Enter an integer confidence from 0 to 100 before committing.');
    $('confidenceInput').focus();
    return null;
  }
  const sliderConfidence = Number(rawConfidence);
  if (sliderConfidence < 0 || sliderConfidence > 100 || sliderConfidence % 10 !== 0) {
    text($('decisionStatus'), 'Confidence must be from 0 to 100 in 10-point steps.');
    $('confidenceInput').focus();
    return null;
  }
  const confidence = $('recordConfidence').checked ? sliderConfidence : null;
  if (!stage.requires_ranking && !(stage.supports_ranking && $('rankAlternatives').checked)) return { confidence, ranking: undefined };
  const entries = [...$('rankingRows').querySelectorAll('select')]
    .map((select) => ({ id: select.dataset.optionId, rank: Number(select.value) }));
  const optionCount = (stage.options || []).length;
  if (entries.length !== optionCount || entries.some((entry) => !entry.rank)
      || new Set(entries.map((entry) => entry.rank)).size !== optionCount
      || entries.some((entry) => entry.rank < 1 || entry.rank > optionCount)) {
    text($('decisionStatus'), `Rank all ${optionCount} hypotheses uniquely before committing.`);
    $('rankingRows').querySelector('select')?.focus();
    return null;
  }
  const ranking = entries.sort((left, right) => left.rank - right.rank).map((entry) => entry.id);
  if (ranking[0] !== optionId) {
    text($('decisionStatus'), 'Commit the hypothesis you ranked first.');
    return null;
  }
  return { confidence, ranking };
}

function renderStage(stage) {
  text($('caseTitle'), stage.title);
  text($('mobileCaseTitle'), stage.title);
  text($('caseDisclaimer'), 'Fictional case · educational use only');
  const sandboxPrefix = session && session.sandbox ? 'SANDBOX DRAFT · NO PROGRESSION CREDIT · ' : '';
  text($('previewBanner'), `${sandboxPrefix}${stage.edition_label || 'Earlier story version 1'} · Fictional learning case`);
  $('previewBanner').classList.remove('hidden');
  const activeMedia = stage.active_media || stage.media;
  applyMedia($('scene'), activeMedia, { sizes: '(max-width: 800px) 92vw, 350px', title: stage.title });
  $('sceneOpen').setAttribute('aria-label', `Open ${stage.title} scene image`);
  $('sceneOpen').onclick = () => openMediaViewer($('scene'));
  renderSceneHotspots(stage, activeMedia);
  text($('stageMeta'), `${stage.tier.toUpperCase()} · ${stage.stage_number} OF ${stage.stage_count}`);
  text($('stageTitle'), `Investigation ${stage.stage_number}`);
  startCodeMode(stage);
  clear($('progress'));
  for (let index = 1; index <= stage.stage_count; index += 1) {
    const marker = document.createElement('i');
    if (index < stage.stage_number) marker.className = 'done';
    $('progress').appendChild(marker);
  }
  text($('narrative'), stage.narrative);
  text($('question'), stage.question);
  renderDecisionControls(stage);
  renderArray('vitals', stage.vitals, 'vital');
  renderArray('timeline', stage.timeline, 'time-item');
  clear($('clues'));
  for (const clue of stage.clues || []) {
    const node = document.createElement('span');
    node.className = 'clue';
    text(node, `${clue.label} · ${clue.detail}`);
    $('clues').appendChild(node);
  }
  clear($('hotspots'));
  for (const hotspot of stage.hotspots || []) {
    const node = document.createElement('span');
    node.className = `hotspot ${(stage.examined_hotspots || []).includes(hotspot.id) ? 'examined' : ''}`;
    text(node, `${hotspot.label}${hotspot.id ? ((stage.examined_hotspots || []).includes(hotspot.id) ? ' · examined' : ' · inspect scene') : ''}`);
    $('hotspots').appendChild(node);
  }
  clear($('observations'));
  for (const observation of stage.observations || []) {
    const node = document.createElement('div');
    node.className = 'observation';
    text(node, `Observation recorded · ${observation.label}: ${observation.finding}`);
    $('observations').appendChild(node);
  }
  const pinnedHypothesis = $('pinnedHypothesis');
  const hypothesis = stage.pinned_hypothesis || stage.hypothesis;
  pinnedHypothesis.classList.toggle('hidden', !hypothesis);
  text(pinnedHypothesis, hypothesis ? `Pinned hypothesis · ${hypothesis}` : '');
  clear($('scars'));
  for (const scar of stage.scars || []) {
    const node = document.createElement('div');
    node.className = 'scar';
    text(node, `Scar carried forward · ${scar.consequence}`);
    $('scars').appendChild(node);
  }
  renderDifferential(stage);
  const tray = $('evidencePanel');
  const previous = tray.querySelector('.synthetic-wrap');
  if (previous) previous.remove();
  const wrap = renderEducationalExhibit(stage.visual_spec, stage);
  tray.appendChild(wrap);
  clear($('options'));
  clear($('feedback'));
  $('continueBtn').classList.add('hidden');
  stage.options.forEach((option, index) => {
    const button = document.createElement('button');
    button.className = 'option';
    button.type = 'button';
    const letter = document.createElement('span');
    letter.className = 'letter';
    text(letter, String.fromCharCode(65 + index));
    button.append(letter, document.createTextNode(option.label));
    button.addEventListener('click', () => answer(option.id, button));
    $('options').appendChild(button);
  });
  renderMobile(stage);
  $('stageTitle').focus?.();
}

function renderSceneHotspots(stage, activeMedia = stage.active_media || stage.media) {
  const tray = $('sceneHotspots');
  if (!tray) return;
  clear(tray);
  renderMarkers(tray, stage, activeMedia);
}

function renderMarkers(tray, stage, activeMedia = stage.active_media || stage.media) {
  if (!activeMedia || activeMedia.asset !== stage.media?.asset) return;
  if (!tray.getAttribute('aria-label')) tray.setAttribute('aria-label', 'Scene observation markers');
  for (const hotspot of stage.hotspots || []) {
    if (!hotspot.id || !Number.isFinite(Number(hotspot.x)) || !Number.isFinite(Number(hotspot.y))) continue;
    const examined = (stage.examined_hotspots || []).includes(hotspot.id);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `scene-marker ${examined ? 'examined' : ''}`;
    button.style.setProperty('--marker-x', `${Math.max(0, Math.min(100, Number(hotspot.x)))}%`);
    button.style.setProperty('--marker-y', `${Math.max(0, Math.min(100, Number(hotspot.y)))}%`);
    button.setAttribute('aria-label', `${examined ? 'Examined' : 'Examine'} ${hotspot.label}`);
    text(button, examined ? '✓' : '?');
    button.disabled = examined;
    button.addEventListener('click', () => examine(hotspot.id));
    tray.appendChild(button);
  }
}

async function examine(hotspotId) {
  if (transit || !session) return;
  transit = true;
  try {
    const result = await api('/api/examine', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session.session_id, hotspot_id: hotspotId }) });
    session = activeSessionFromStage(result.stage);
    renderStage(session);
    const finding = document.createElement('div');
    finding.className = 'feedback good';
    text(finding, `Observation recorded · ${result.finding}`);
    $('feedback').prepend(finding);
  } catch (error) { showError(error); }
  finally { transit = false; }
}

function renderMobile(stage) {
  clear($('mobileScene'));
  const wrap = document.createElement('div');
  wrap.className = 'mobile-scene-wrap';
  const image = document.createElement('img');
  const activeMedia = stage.active_media || stage.media;
  applyMedia(image, activeMedia, { sizes: '92vw', title: stage.title });
  const imageButton = document.createElement('button');
  imageButton.type = 'button';
  imageButton.className = 'image-button';
  imageButton.setAttribute('aria-label', `Open ${stage.title} scene image`);
  imageButton.addEventListener('click', () => openMediaViewer(image));
  const label = document.createElement('span');
  text(label, `${stage.visual_spec.label} · generated scene art is illustrative only`);
  const markers = document.createElement('div');
  markers.className = 'scene-hotspots';
  renderMarkers(markers, stage, activeMedia);
  imageButton.appendChild(image);
  wrap.append(imageButton, markers, label);
  $('mobileScene').appendChild(wrap);
  renderArray('mobileTimeline', stage.timeline, 'time-item');
  setTab(selectedMobileTab || 'evidence');
}

async function answer(optionId, button) {
  if (transit) return;
  const details = commitDetails(optionId, session);
  if (!details) return;
  transit = true;
  // Lock synchronously while the request is in flight. This prevents a second
  // click from racing the server and makes the post-correct state observable
  // immediately; wrong answers explicitly reopen the retry choices below.
  setOptionsLocked(true);
  try {
    const result = await api('/api/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session.session_id, option_id: optionId, ...details }),
    });
    button.classList.add(result.correct ? 'correct' : 'wrong');
    if (result.correct) stopCodeTimer();
    renderAnswerFeedback(result, session.stage_number);
    if (result.correct) saveDraft(session);
    if (result.correct) {
      if (result.finished) finish(result);
      else {
        pending = activeSessionFromStage(result.next);
        $('continueBtn').classList.remove('hidden');
      }
    } else {
      setOptionsLocked(false);
    }
    // Wrong answers intentionally remain enabled so the learner can retry.
  } catch (error) {
    setOptionsLocked(false);
    showError(error);
  } finally {
    transit = false;
  }
}

function renderAnswerFeedback(result, stageNumber) {
    clear($('feedback'));
    const feedback = document.createElement('div');
    feedback.className = `feedback ${result.correct ? 'good' : 'bad'}`;
    if (result.consequence) {
      const beat = document.createElement('div');
      beat.className = 'consequence-beat';
      text(beat, result.consequence);
      $('feedback').appendChild(beat);
    }
    renderConsequenceMedia(result.consequence_media, stageNumber);
    text(feedback, `${result.correct ? '✓ Correct · ' : '✕ Not yet · '}${result.teaching}`);
    if (!result.correct && result.error_mode_label) {
      const mode = document.createElement('div');
      mode.className = 'error-mode-tag';
      text(mode, `Error pattern · ${result.error_mode_label}`);
      $('feedback').appendChild(mode);
    }
    if (result.time_expired) {
      const expiry = document.createElement('div');
      expiry.className = 'expiry-note';
      text(expiry, 'Recorded: answered after the server-side window closed.');
      $('feedback').appendChild(expiry);
    }
    $('feedback').appendChild(feedback);
}

function setOptionsLocked(locked) {
  $('options').querySelectorAll('button').forEach((optionButton) => {
    optionButton.disabled = locked;
    optionButton.setAttribute('aria-disabled', String(locked));
  });
}

function finish(result, restored = false) {
  const changedPracticeCase = practiceCaseId !== session.case_id;
  standalonePractice = false;
  practiceCaseId = session.case_id;
  $('result').insertBefore($('transferPractice'), $('finalTeaching').nextSibling);
  $('result').insertBefore($('playAgain'), $('transferPractice').nextSibling);
  const attainableTotal = Object.values(attainableByTier).reduce((sum, n) => sum + n, 0) || 1;
  $('game').classList.add('hidden');
  $('result').classList.remove('hidden');
  if (transferPracticeSessionId !== session.session_id || changedPracticeCase) {
    text($('practiceSaveStatus'), '');
    transferPracticeSessionId = session.session_id;
    const matchingPractice = restored && readStorage(`mmPracticeSession:${session.case_id}`) === session.session_id;
    transferPracticeState = supportsPractice(session.case_id)
      ? (matchingPractice ? loadPractice(session.case_id) : null) || createPracticeState(session.case_id) : null;
  }
  renderTransferPractice();
  resetScrollToTop();
  const perfect = result.score.accuracy === 1 && (result.stage_autopsy || []).every((stage) => stage.first_try);
  text($('resultMark'), perfect ? '✓' : '!');
  $('resultMark').classList.toggle('result-warning', !perfect);
  text($('finalTitle'), `Story completed · ${session.title}`);
  text($('storyResultEdition'), session.edition_label || 'Earlier story version 1');
  text($('finalScore'), session.sandbox
    ? `Score ${result.score.earned} / ${result.score.possible} · SANDBOX DRAFT — no progression credit`
    : `Answer score ${result.score.earned} / ${result.score.possible} · first-answer match ${Math.round(result.score.accuracy * 100)}%. This records answers, not demonstrated clinical reasoning.`);
  text($('finalTeaching'), result.key_teaching);
  const resultMediaWrap = $('resultMediaWrap');
  if (result.result_media) {
    applyMedia($('resultMedia'), result.result_media, { sizes: '(max-width: 800px) 92vw, 640px', title: session.title });
    text($('resultMediaCaption'), $('resultMedia').dataset.safeCaption);
    $('resultMediaOpen').onclick = () => openMediaViewer($('resultMedia'));
    resultMediaWrap.classList.remove('hidden');
  } else clearMedia($('resultMedia'), { caption: $('resultMediaCaption'), wrapper: resultMediaWrap });
  text($('reviewStatus'), REVIEW_STATEMENT);
  clear($('sources'));
  for (const source of result.sources || []) {
    const link = document.createElement('a');
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    text(link, source.title);
    $('sources').appendChild(link);
  }
  renderReasoningAutopsy(result.reasoning_autopsy || result.clinical_autopsy, result.stage_autopsy || [], result.path_debrief);
  renderVisualAutopsy(result.visual_autopsy);
  const debrief = $('debrief');
  debrief.classList.toggle('hidden', Boolean(session.sandbox));
  text($('debriefStatus'), '');
  $('debrief').querySelectorAll('.feedback-button').forEach((button) => { button.disabled = false; });
  let progression = null;
  if (!session.sandbox && !restored) {
    try { progression = recordCalibrationTelemetry(result, attainableTotal); } catch { /* local storage is optional */ }
  }
  if (!session.sandbox && !restored) queueReview(result);
  const rankLine = $('rankLine');
  if (!session.sandbox) {
    const confidence = assessResultConfidence(result);
    rankLine.classList.remove('hidden');
    text(rankLine, `${confidence.title} · ${confidence.summary}`);
    rankLine.setAttribute('role', 'status');
    rankLine.setAttribute('aria-live', 'polite');
  } else rankLine.classList.add('hidden');
  const twistBox = $('twistBox');
  if (result.twist) { twistBox.classList.remove('hidden'); text($('finalTwist'), result.twist); }
  else twistBox.classList.add('hidden');
  const epilogueBox = $('epilogueBox');
  if (result.epilogue) { epilogueBox.classList.remove('hidden'); text($('finalEpilogue'), result.epilogue); }
  else epilogueBox.classList.add('hidden');
}

function renderTransferPractice() {
  const section = $('transferPractice');
  const trigger = $('transferPracticeStart');
  if (!section || !trigger) return;
  const supported = Boolean(tierListing?.features.practice) && (standalonePractice || !session?.sandbox) && supportsPractice(practiceCaseId);
  section.classList.toggle('standalone-practice', standalonePractice);
  section.classList.toggle('hidden', !supported);
  trigger.classList.toggle('hidden', !supported || Boolean(transferPracticeState?.started));
  const region = $('transferPracticeRegion');
  if (!supported || !transferPracticeState?.started) { region.classList.add('hidden'); return; }
  region.classList.remove('hidden');
  clear(region);
  const closePractice = () => {
    region.classList.add('hidden');
    trigger.classList.remove('hidden');
    trigger.focus();
  };
  const heading = document.createElement('h3'); heading.id = 'transferPracticeQuestion'; heading.tabIndex = -1;
  text(heading, transferPracticeState.completed ? 'Practice complete' : `New situation · ${transferPracticeState.questionIndex + 1} of ${transferPracticeState.questions.length}`); region.appendChild(heading);
  const label = document.createElement('p'); label.className = 'practice-label'; text(label, TRANSFER_PRACTICE_PACKS[practiceCaseId].title); region.appendChild(label);
  const close = document.createElement('button'); close.type = 'button'; close.className = 'quiet-button'; text(close, 'Close practice'); close.addEventListener('click', closePractice); region.appendChild(close);
  if (transferPracticeState.completed) {
    const tally = document.createElement('p'); tally.className = 'practice-tally'; text(tally, `Practice first-attempt tally: ${practiceTally(transferPracticeState)} / ${transferPracticeState.questions.length}`); region.appendChild(tally);
    return;
  }
  const question = transferPracticeState.questions[transferPracticeState.questionIndex];
  const narrative = document.createElement('p'); narrative.className = 'practice-narrative'; text(narrative, question.narrative); region.appendChild(narrative);
  const prompt = document.createElement('p'); prompt.className = 'practice-prompt'; text(prompt, question.question); region.appendChild(prompt);
  const choices = document.createElement('div'); choices.className = 'practice-choices';
  for (const choice of question.choices) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'option'; text(button, choice.label); button.disabled = question.answer !== null;
    if (question.answer === choice.id) button.classList.add(choice.id === question.correct ? 'correct' : 'wrong');
    button.addEventListener('click', () => { transferPracticeState = answerPractice(transferPracticeState, choice.id); persistPractice(); renderTransferPractice(); $('transferPracticeFeedback')?.focus(); }); choices.appendChild(button);
  }
  region.appendChild(choices);
  if (question.answer !== null) {
    const selected = question.choices.find((choice) => choice.id === question.answer);
    const feedback = document.createElement('div'); feedback.id = 'transferPracticeFeedback'; feedback.tabIndex = -1; feedback.className = `feedback ${question.answer === question.correct ? 'good' : 'bad'}`; feedback.setAttribute('role', 'status'); text(feedback, `${question.answer === question.correct ? 'Correct · ' : 'Review · '}${selected?.rationale || ''} ${question.feedback}`); region.appendChild(feedback);
    const source = document.createElement('p'); source.className = 'practice-source'; const link = document.createElement('a'); link.href = question.source.url; link.target = '_blank'; link.rel = 'noreferrer'; text(link, question.source.title); source.append(link, ` · published ${question.source.published} · checked ${question.source.checked}`); region.appendChild(source);
    const next = document.createElement('button'); next.type = 'button'; next.className = 'primary-button'; text(next, transferPracticeState.questionIndex === transferPracticeState.questions.length - 1 ? 'Finish practice' : 'Next situation'); next.addEventListener('click', () => { transferPracticeState = nextPractice(transferPracticeState); persistPractice(); renderTransferPractice(); $('transferPracticeQuestion')?.focus(); }); region.appendChild(next);
  }
}

function persistPractice() {
  const saved = savePractice(transferPracticeState);
  if (saved && !standalonePractice && session) writeStorage(`mmPracticeSession:${practiceCaseId}`, session.session_id);
  text($('practiceSaveStatus'), saved ? 'Saved on this browser' : 'Progress is temporary: browser storage is unavailable.');
  if (standalonePractice) renderPracticeLibrary();
}

function closeExtraViews() {
  $('investigation').classList.add('hidden');
  $('practiceLibrary').classList.add('hidden');
  if (standalonePractice) {
    $('result').insertBefore($('transferPractice'), $('playAgain'));
    transferPracticeSessionId = null;
  }
  standalonePractice = false;
}

function showBoard() {
  stopCodeTimer();
  closeExtraViews();
  for (const id of ['game', 'result', 'coldOpen', 'error']) $(id).classList.add('hidden');
  $('menu').classList.remove('hidden');
  resetScrollToTop();
  void loadTiers();
  $('menuTitle').tabIndex = -1;
  $('menuTitle').focus({ preventScroll: true });
}

function renderPracticeLibrary() {
  clear($('practicePacks'));
  for (const [caseId, pack] of Object.entries(TRANSFER_PRACTICE_PACKS)) {
    const entry = document.createElement('article'); entry.className = 'practice-pack';
    const heading = document.createElement('h2'); text(heading, pack.title);
    const saved = practiceSummary(caseId);
    const summary = document.createElement('p');
    text(summary, saved ? `${saved.answered} / ${saved.total} answered · ${saved.correct} correct${saved.completed ? ' · Complete' : ''}` : `${pack.questions.length} new situations · Not attempted`);
    const button = document.createElement('button'); button.type = 'button'; button.className = 'quiet-button';
    text(button, saved ? 'Resume practice' : 'Start practice'); button.setAttribute('aria-label', `${saved ? 'Resume' : 'Start'} ${pack.title}`);
    button.addEventListener('click', () => openPractice(caseId));
    entry.append(heading, summary, button); $('practicePacks').appendChild(entry);
  }
}

function openPractice(caseId = null) {
  if (!tierListing?.features.practice) return;
  stopCodeTimer();
  for (const id of ['menu', 'game', 'result', 'investigation', 'coldOpen', 'error']) $(id).classList.add('hidden');
  $('practiceLibrary').classList.remove('hidden');
  $('standalonePractice').appendChild($('transferPractice'));
  standalonePractice = true;
  practiceCaseId = caseId;
  text($('practiceLibraryTitle'), caseId ? TRANSFER_PRACTICE_PACKS[caseId].title : 'Practice library');
  text($('practiceSaveStatus'), '');
  renderPracticeLibrary();
  $('practicePacks').classList.toggle('hidden', Boolean(caseId));
  $('choosePracticePack').classList.toggle('hidden', !caseId);
  transferPracticeState = supportsPractice(caseId) ? Object.freeze({ ...(loadPractice(caseId) || createPracticeState(caseId)), started: true }) : null;
  renderTransferPractice();
  resetScrollToTop();
  (caseId ? $('transferPracticeQuestion') : $('practiceLibraryTitle'))?.focus({ preventScroll: true });
}

function renderVisualAutopsy(autopsy) {
  const box = $('visualAutopsy');
  const timeline = $('visualAutopsyTimeline');
  clear(timeline);
  $('visualAutopsyExpand').setAttribute('aria-expanded', 'false');
  text($('visualAutopsyExpand'), 'Show reasoning details');
  $('reasoningAutopsy').classList.add('hidden');
  if (!autopsy?.timeline?.length) { box.classList.add('hidden'); return; }
  for (const item of autopsy.timeline) {
    const entry = document.createElement('article');
    entry.className = `autopsy-step ${item.correct ? 'correct' : 'missed'}`;
    const icon = document.createElement('span');
    icon.className = 'autopsy-icon';
    icon.setAttribute('aria-hidden', 'true');
    text(icon, item.correct ? '✓' : '↺');
    const copy = document.createElement('div');
    const title = document.createElement('h4');
    text(title, `Investigation ${item.stage_number}`);
    const choice = document.createElement('p');
    text(choice, `${item.choice || 'No recorded choice'} · ${item.correct ? 'supported choice' : 'mistake recorded'}`);
    copy.append(title, choice);
    entry.append(icon, copy);
    if (item.consequence_media) {
      const image = document.createElement('img');
      applyMedia(image, item.consequence_media, { sizes: '(max-width: 800px) 35vw, 180px', title: `Investigation ${item.stage_number}` });
      image.className = 'autopsy-image';
      entry.appendChild(image);
    }
    timeline.appendChild(entry);
  }
  box.classList.remove('hidden');
  const sandbox = Boolean(session?.sandbox);
  $('visualAutopsyExpand').disabled = sandbox;
  $('reviewComplete').disabled = sandbox;
}

async function recordDebriefEvent(kind) {
  if (debriefEventsSent.has(kind) || !session || session.sandbox) return;
  try {
    await api('/api/debrief-event', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session.session_id, case_id: session.case_id, tier: session.tier, kind }) });
    debriefEventsSent.add(kind);
  } catch (error) { text($('visualAutopsyStatus'), `Could not record review interaction: ${error.message}`); }
}

function renderReasoningAutopsy(autopsy, stages, path) {
  const box = $('reasoningAutopsy');
  clear(box);
  if (autopsy) {
    const heading = document.createElement('h3');
    text(heading, 'Reasoning review');
    box.appendChild(heading);
    const divergence = document.createElement('p');
    if (autopsy.first_divergence) {
      divergence.className = 'autopsy-alert';
      text(divergence, `First divergence: Investigation ${autopsy.first_divergence.stage_number} — your first choice was ${autopsy.first_divergence.learner_choice}; authored teaching path: ${autopsy.first_divergence.expert_choice}.`);
    } else text(divergence, 'First divergence: none — your first choices matched the authored teaching path.');
    box.appendChild(divergence);
    const expert = document.createElement('p');
    text(expert, `Authored teaching path: ${(autopsy.expert_path || []).map((step) => step.choice).join(' → ') || 'not available'}.`);
    box.appendChild(expert);
    const counterfactual = document.createElement('p');
    text(counterfactual, `Counterfactual: ${autopsy.counterfactual || 'not available'}`);
    box.appendChild(counterfactual);
    const confidence = assessConfidenceRecord({ calibration: autopsy.calibration, stages });
    const confidenceDetail = document.createElement('p');
    text(confidenceDetail, `${confidence.title}: ${confidence.detail}`);
    box.appendChild(confidenceDetail);
    const calibration = document.createElement('p');
    const errors = stages.filter((stage) => stage.confidence_error != null).map((stage) => `I${stage.stage_number}: ${stage.confidence_error}`);
    text(calibration, `Confidence error by investigation: ${errors.join(' · ') || 'not available'}.`);
    box.appendChild(calibration);
    if (autopsy.calibration?.overconfident_first_misses?.length) {
      const over = document.createElement('p');
      over.className = 'autopsy-alert';
      const misses = autopsy.calibration.overconfident_first_misses.map((item) => `I${item.stage_number} at ${item.confidence}`).join(' · ');
      text(over, `High-confidence first misses: ${misses}.`);
      box.appendChild(over);
    }
  }
  if (stages.length) {
    const heading = document.createElement('div');
    heading.className = 'section-label';
    text(heading, 'FIRST-TRY AUTOPSY');
    const list = document.createElement('ul');
    for (const stage of stages) {
      const item = document.createElement('li');
      const calibration = stage.confidence_error == null ? 'confidence not recorded' : `confidence error ${stage.confidence_error}`;
      text(item, `${stage.investigation || `Investigation ${stage.stage_number}`}: ${stage.question} — ${stage.first_try ? 'first-try success' : 'retry required'} · ${stage.attempts} attempt${stage.attempts === 1 ? '' : 's'} · ${stage.assisted ? 'assisted' : 'unassisted'} · ${calibration}${stage.management_error ? ' · management error' : ''}`);
      list.appendChild(item);
    }
    box.append(heading, list);
  }
  if (path) {
    const pathBox = document.createElement('div');
    pathBox.className = 'path-debrief';
    const addPathList = (label, items, formatter, className = '') => {
      const heading = document.createElement('div');
      heading.className = 'section-label';
      text(heading, label);
      const list = document.createElement('ol');
      list.className = className;
      items.forEach((value) => { const item = document.createElement('li'); text(item, formatter(value)); list.appendChild(item); });
      pathBox.append(heading, list);
    };
    addPathList('YOUR ATTEMPTS', path.learner_path || [], (attempt) => `${attempt.choice} — ${attempt.correct ? 'correct' : 'wrong attempt'}${attempt.error_mode_label ? ` · ${attempt.error_mode_label}` : ''}${attempt.consequence ? ` · consequence: ${attempt.consequence}` : ''}`);
    addPathList('FIRST ANSWER VS AUTHORED ANSWER', path.comparison || [], (row) => row.matched ? `Investigation ${row.stage_number}: first try matched · ${row.expert_choice}` : `Investigation ${row.stage_number}: you chose ${row.first_try_choice}; authored teaching path: ${row.expert_choice}${row.error_mode_label ? ` · ${row.error_mode_label}` : ''}`, 'path-compare');
    addPathList('AUTHORED TEACHING PATH', path.expert_path || [], (choice) => choice);
    if (path.scars?.length) addPathList('SCARS CARRIED FORWARD', path.scars, (scar) => `${scar.option_label || 'Wrong choice'} · ${scar.consequence}`);
    const activeErrors = (path.comparison || []).filter((row) => row.error_mode);
    if (activeErrors.length) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'cognitive-bias-matrix';
      const matrixHead = document.createElement('div');
      matrixHead.className = 'section-label';
      text(matrixHead, 'COGNITIVE BIAS & ERROR PATTERN MATRIX');
      errorDiv.appendChild(matrixHead);
      const errList = document.createElement('ul');
      activeErrors.forEach((row) => {
        const li = document.createElement('li');
        text(li, `Investigation ${row.stage_number} · ${row.error_mode_label || row.error_mode}: chose "${row.first_try_choice}" instead of "${row.expert_choice}".`);
        errList.appendChild(li);
      });
      errorDiv.appendChild(errList);
      pathBox.append(errorDiv);
    }
    box.appendChild(pathBox);
  }
  box.classList.toggle('hidden', !autopsy && !stages.length && !path);
}

async function submitFeedback(rating) {
  if (feedbackSubmitted || !session || session.sandbox) return;
  try {
    await api('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session.session_id, case_id: session.case_id, tier: session.tier, rating }) });
    feedbackSubmitted = true;
    $('debrief').querySelectorAll('.feedback-button').forEach((button) => { button.disabled = true; });
    text($('debriefStatus'), 'Thanks. Share feedback in the itch.io comments; this button does not send it.');
  } catch (error) { text($('debriefStatus'), `Could not record rating: ${error.message}`); }
}

// Completion receipts are immutable and edition-specific; legacy mmProfile is read-only.
function loadProfile() { return loadStoryProfile(); }

function recordCalibrationTelemetry(result, attainableTotal) {
  const before = loadStoryProfile(undefined, session.build_id);
  const receipt = recordStoryCompletion(session, result);
  if (!receipt.saved) showStoryStorage('This result is available here, but its completion receipt could not be saved. Earlier records are preserved.');
  const profile = loadStoryProfile(undefined, session.build_id);
  updateBoardActions();
  return {
    gained: Math.max(0, profile.xp - before.xp),
    brier_score: result.score?.brier_score ?? null,
    accuracy: result.score?.accuracy ?? 0,
    overconfident_misses: result.clinical_autopsy?.calibration?.overconfident_first_misses?.length || 0,
    calibration: profile.calibration,
    rank: { name: profile.rank, xp: profile.xp, index: 0 },
    leveledUp: false,
  };
}

function awardXp(result, attainableTotal) {
  return recordCalibrationTelemetry(result, attainableTotal);
}

function queueReview(result) {
  const saved = readStoryReviews();
  const before = saved.entries;
  const after = reconcileReviewQueue(before, result, Date.now());
  if (writeStoryReviews(saved, after)) text($('visualAutopsyStatus'), summarizeReviewChange(before, after).text);
  else { text($('visualAutopsyStatus'), 'Review scheduling could not be saved. Earlier review data is preserved.'); showStoryStorage('Scheduled reviews could not be updated. Earlier saved data has not been replaced.'); }
}

function renderRankChip() {
  const profile = loadProfile();
  const chip = document.getElementById('rankChip');
  if (!chip) return;
  const cal = profile.calibration;
  if (!cal || !cal.cases_completed) {
    text(chip, 'Confidence record · Ready');
    return;
  }
  const brierText = cal.brier_score != null ? `Brier ${cal.brier_score.toFixed(2)}` : 'Not recorded';
  const flagText = cal.overconfident_count ? ` · ${cal.overconfident_count} overconfident miss${cal.overconfident_count === 1 ? '' : 'es'}` : '';
  text(chip, `Confidence record · ${brierText} · descriptive only${flagText}`);
}

let attainableByTier = {};

// ── pressure mode (opt-in display; the server owns the real deadline) ───────
let codeTimerHandle = null;
function pressureModeEnabled() {
  return loadProfile().pressure === true;
}

function startCodeMode(stage) {
  stopCodeTimer();
  const display = document.getElementById('codeTimer');
  if (!stage.code) { display.classList.add('hidden'); return; }
  document.body.classList.add('code-mode');
  if (!pressureModeEnabled() || !stage.pressure_deadline) {
    // Honest default: the deadline exists server-side; we just don't perform it.
    display.classList.remove('hidden');
    display.classList.remove('countdown');
    display.textContent = 'Code stage · pressure mode off — no countdown';
    return;
  }
  display.classList.remove('hidden');
  display.classList.add('countdown');
  const paint = () => {
    const remaining = Math.max(0, Math.ceil(stage.pressure_deadline - Date.now() / 1000));
    display.textContent = remaining > 0
      ? `PATIENT DETERIORATING — DECIDE WITHIN ${remaining}s`
      : 'The window closed — decide now.';
  };
  paint();
  codeTimerHandle = setInterval(paint, 1000);
}

function stopCodeTimer() {
  if (codeTimerHandle) { clearInterval(codeTimerHandle); codeTimerHandle = null; }
  document.body.classList.remove('code-mode');
}

function setTab(name) {
  selectedMobileTab = name;
  document.querySelectorAll('.tab').forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  $('evidencePanel').classList.toggle('hidden', name !== 'evidence');
  $('mobileScene').classList.toggle('hidden', name !== 'scene');
  $('mobileTimeline').classList.toggle('hidden', name !== 'timeline');
}

$('continueBtn').addEventListener('click', () => {
  if (!pending) return;
  writeStorage(consumedStageKey(session), true);
  session = pending;
  pending = null;
  renderStage(session);
  $('stageTitle').focus?.();
});
$('restartBtn').addEventListener('click', () => start(session.tier, session.case_id));
$('playAgain').addEventListener('click', showBoard);
$('practiceBack').addEventListener('click', showBoard);
$('choosePracticePack').addEventListener('click', () => openPractice());
$('openPracticeLibrary').addEventListener('click', () => openPractice());
$('caseSearch').addEventListener('input', () => { if (tierListing) renderList(tierListing); });
$('caseFilter').addEventListener('change', () => { if (tierListing) renderList(tierListing); });
$('clearPracticeHistory').addEventListener('click', () => {
  const cleared = clearPracticeHistory();
  text($('practiceStorageStatus'), cleared ? 'Practice history cleared. Case scores and reviews were preserved.' : 'Could not clear history. Browser storage is unavailable.');
  if (cleared) {
    transferPracticeState = null;
    practiceCaseId = null;
    transferPracticeSessionId = null;
    renderTransferPractice();
    renderPracticeLibrary();
    text($('practiceLibraryTitle'), 'Practice library');
    $('practicePacks').classList.remove('hidden');
    $('choosePracticePack').classList.add('hidden');
  }
});
// Keep reading and keyboard order aligned with the primary decision surface.
$('evidencePanel').before(document.querySelector('.decision-card'));
document.querySelector('.board-header').after(document.querySelector('.board-filters'));
const investigationUI = mountInvestigation({
  isAvailable: () => Boolean(tierListing?.features.investigations),
  onOpen: () => {
    stopCodeTimer();
    closeExtraViews();
    for (const id of ['menu', 'game', 'result', 'coldOpen', 'error']) $(id).classList.add('hidden');
    $('investigation').classList.remove('hidden');
    resetScrollToTop();
  },
  onClose: showBoard,
});
$('debrief').querySelectorAll('.feedback-button').forEach((button) => {
  button.addEventListener('click', () => submitFeedback(button.dataset.rating));
});
$('transferPracticeStart').addEventListener('click', () => {
  if (!transferPracticeState) return;
  transferPracticeState = Object.freeze({ ...transferPracticeState, started: true });
  renderTransferPractice(); $('transferPracticeQuestion')?.focus();
});
$('confidenceInput').addEventListener('input', () => {
  if ($('recordConfidence')) $('recordConfidence').checked = true;
  text($('confidenceValue'), `${$('confidenceInput').value}%`);
  if (session) saveDraft(session);
});
$('recordConfidence').addEventListener('change', () => {
  $('confidenceFields').classList.toggle('hidden', !$('recordConfidence').checked);
  text($('confidenceValue'), $('recordConfidence').checked ? `${$('confidenceInput').value}%` : 'Not recorded');
  if (session) saveDraft(session);
});
$('rankAlternatives').addEventListener('change', () => { if (session) { saveDraft(session); renderDecisionControls(session); } });
$('visualAutopsyExpand').addEventListener('click', () => {
  const expanded = $('visualAutopsyExpand').getAttribute('aria-expanded') === 'true';
  $('visualAutopsyExpand').setAttribute('aria-expanded', String(!expanded));
  $('reasoningAutopsy').classList.toggle('hidden', expanded);
  text($('visualAutopsyExpand'), expanded ? 'Show reasoning details' : 'Hide reasoning details');
  if (!expanded) void recordDebriefEvent('debrief_expanded');
});
$('reviewComplete').addEventListener('click', async () => {
  await recordDebriefEvent('review_completed');
  if (debriefEventsSent.has('review_completed')) {
    $('reviewComplete').disabled = true;
    text($('visualAutopsyStatus'), 'Debrief marked as read');
  }
});

function setupPressureToggle() {
  const pressureToggle = document.getElementById('pressureToggle');
  if (!pressureToggle) return;
  pressureToggle.checked = loadProfile().pressure === true;
  pressureToggle.addEventListener('change', () => {
    if (!saveStoryPreferences({ pressure: pressureToggle.checked })) showStoryStorage('The pressure preference could not be saved. Earlier profile data is preserved.');
  });
}
document.querySelectorAll('.tab').forEach((tab, index, tabs) => {
  tab.setAttribute('aria-selected', String(tab.classList.contains('active')));
  tab.tabIndex = tab.classList.contains('active') ? 0 : -1;
  tab.addEventListener('click', () => setTab(tab.dataset.tab));
  tab.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].focus();
    setTab(tabs[next].dataset.tab);
  });
});
$('mediaViewerClose').addEventListener('click', () => $('mediaViewer').close());
$('mediaViewer').addEventListener('close', () => {
  const target = $('mediaViewer').returnFocus;
  $('mediaViewer').returnFocus = null;
  target?.focus?.();
});
document.addEventListener('keydown', (event) => {
  if ($('mediaViewer').open) {
    if (event.key === 'Escape') {
      event.preventDefault();
      $('mediaViewer').close();
    }
    return;
  }
  if (document.querySelector('dialog[open]')) return;
  if (!$('coldOpen').classList.contains('hidden')) {
    if (event.key === 'Escape') {
      event.preventDefault();
      $('coldOpenBtn').click();
    }
    if (event.key === 'Tab') {
      const focusable = [...$('coldOpen').querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    return;
  }
  if ($('game').classList.contains('hidden') || transit || pending) return;
  if (event.target.closest?.('input, select, textarea, [contenteditable="true"]')) return;
  const index = Number(event.key) - 1;
  if (index < 0 || index > 3) return;
  const option = $('options').querySelectorAll('button')[index];
  if (option && !option.disabled) { event.preventDefault(); option.click(); }
});
setupPressureToggle();
$('openStoryHistory').addEventListener('click', () => openStoryHistory({ api, onResume: resumeActiveSession }));
loadTiers();

window.addEventListener('mm-storage-error', () => showStoryStorage('Progress could not be saved on this device. Keep the app open and export your history before closing.'));
if (isNativeStorage()) {
  $('saveLocation').textContent = 'Progress is saved in this app on your device. Export your story history or learning journal through the share sheet for a complete backup of committed app saves. Deleting the app removes its local saves.';
}

window.addEventListener('mm-export-error', () => {
  const message = 'The export could not be opened. Saved history has not changed. Please try again.';
  const dialog = document.querySelector('dialog[open]');
  if (!dialog) { showStoryStorage(message); return; }
  let status = dialog.querySelector('.export-status');
  if (!status) { status = document.createElement('p'); status.className = 'export-status control-help'; status.setAttribute('role', 'alert'); status.tabIndex = -1; dialog.appendChild(status); }
  status.textContent = message; status.focus();
});
