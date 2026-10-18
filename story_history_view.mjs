import { getGameStorage, isNativeStorage } from './game_storage.mjs';
import { exportJSON } from './export_file.mjs';
import { loadStoryProfile, exportStoryProgress } from './story_progress.mjs';

function node(tag, className = '', text = '') {
  const value = document.createElement(tag);
  value.className = className;
  value.textContent = text;
  return value;
}

function button(label, action) {
  const value = node('button', 'quiet-button', label);
  value.type = 'button'; value.addEventListener('click', action);
  return value;
}

function download(value) {
  void exportJSON(value, 'medical-mysteries-story-history.json');
}

function rawStoryStorage() {
  const records = [];
  try {
    for (let index = 0; index < getGameStorage().length; index += 1) {
      const key = getGameStorage().key(index);
      if (key === 'mmBetaSessions:v1' || key === 'mmReviewQueue' || key?.startsWith('mmStorySession:v2:')
        || key?.startsWith('mmStoryFeedback:')) records.push({ key, raw: getGameStorage().getItem(key) });
    }
    return { status: 'ok', records };
  } catch { return { status: 'unavailable', records }; }
}

export async function openStoryHistory({ api, onResume }) {
  const origin = document.activeElement;
  const dialog = node('dialog', 'learning-journal story-history');
  dialog.setAttribute('aria-labelledby', 'storyHistoryTitle');
  const heading = node('header', 'journal-header');
  const title = node('h2', '', 'Story history'); title.id = 'storyHistoryTitle';
  const close = button('Close', () => dialog.close());
  heading.append(title, close); dialog.append(heading);
  const status = node('p', 'control-help', 'Reading saved routes…'); status.setAttribute('role', 'status'); dialog.append(status);
  dialog.addEventListener('close', () => { dialog.remove(); origin?.focus?.(); });
  document.body.append(dialog); dialog.showModal(); close.focus();
  try {
    const history = await api('/api/history');
    if (!dialog.isConnected) return;
    const runs = history.runs || [];
    const saved = runs.filter((run) => run.persistence_status === 'saved').length;
    const unsaved = runs.length - saved;
    status.textContent = `${saved} saved route${saved === 1 ? '' : 's'}.${unsaved ? ` ${unsaved} additional run${unsaved === 1 ? ' is' : 's are'} available in this tab for now but not saved.` : ''}${history.unreadable_count ? ` ${history.unreadable_count} unreadable record${history.unreadable_count === 1 ? '' : 's'} retained in storage.` : ''}`;
    dialog.append(node('p', 'control-help', 'Saved routes reopen with their original wording, choices and results. Earlier editions are separate from the revised stories. The older app retained at most twelve sessions; records it already discarded cannot be reconstructed.'));
    const list = node('div', 'story-history-runs');
    for (const run of [...runs].sort((a, b) => b.started - a.started)) {
      const item = node('article', 'story-history-run');
      item.append(node('h3', '', run.title), node('p', 'control-help', `${run.edition_label || `Story version ${run.content_version}`} · ${run.finished ? 'Completed' : 'In progress'}`));
      if (Number.isFinite(run.started)) item.append(node('p', 'control-help', `Started ${new Date(run.started * 1000).toLocaleString()}`));
      if (run.score) item.append(node('p', '', `First-answer match ${Math.round(run.score.accuracy * 100)}% · ${run.score.earned}/${run.score.possible} answer points`));
      if (run.persistence_status !== 'saved') item.append(node('p', 'control-help', `Not saved — this tab only for now. ${run.persistence_note || 'This route may be unavailable after reload.'} ${isNativeStorage() ? 'The app backup includes committed records only; this unsaved route is not included.' : 'Export includes its summary, not a recoverable action log.'}`));
      item.append(button(run.finished ? 'Open saved result' : 'Resume saved route', () => { dialog.close(); void onResume(run.session_id); }));
      list.append(item);
    }
    dialog.append(list);
    const profile = loadStoryProfile();
    const summaries = Object.entries(profile.legacy_plays || {});
    if (summaries.length) {
      const prior = node('details', 'journal-record'); prior.append(node('summary', '', 'Earlier edition score summaries'));
      prior.append(node('p', 'control-help', 'These original profile summaries are retained separately. A summary alone cannot reconstruct the choices or observations of a missing session.'));
      for (const [caseId, play] of summaries) prior.append(node('p', '', `${caseId} · earlier best first-answer match ${Math.round((play.best_accuracy ?? play.accuracy) * 100)}%`));
      dialog.append(prior);
    }
    if (profile.unreadable_count || ['invalid', 'unavailable'].includes(profile.legacy_status)) dialog.append(node('p', 'control-help', 'Some local profile records could not be read. They have not been replaced; export includes the bytes available to this browser.'));
    dialog.append(button('Export story history', () => download(() => ({
      schema: 1, exported_utc: new Date().toISOString(), listed_routes: runs,
      progress: exportStoryProgress(), saved_storage: rawStoryStorage(), clinical_use: false,
    }))));
  } catch (error) {
    status.textContent = `Story history could not be read: ${error.message}. Existing saved data has not been replaced.`;
    dialog.append(button('Export available history', () => download(() => ({ schema: 1, progress: exportStoryProgress(), saved_storage: rawStoryStorage(), clinical_use: false }))));
  }
}
