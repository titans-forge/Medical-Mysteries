// Selection preferences never identify a saved clinical-learning route.
// Checkpoints and journal records continue to use exact episodeId + version.
const PREFIX = 'mmInvestigationArrival:v1:';
const getStore = (storage) => storage === undefined ? globalThis.localStorage : storage;

export function investigationFamilies(episodes) {
  const groups = new Map();
  for (const episode of episodes) {
    const id = episode.familyId || episode.id;
    if (!groups.has(id)) groups.set(id, { id, title: episode.familyTitle || episode.title, records: [] });
    groups.get(id).records.push(episode);
  }
  return [...groups.values()];
}

function preference(family, storage) {
  const key = `${PREFIX}${family.id}`;
  try {
    const store = getStore(storage);
    const raw = store.getItem(key);
    if (raw === null) return { store, key, raw, last: null, valid: true };
    if (typeof raw !== 'string' || raw.length > 4096) return { key, raw, valid: false };
    const value = JSON.parse(raw);
    const valid = value !== null && typeof value === 'object' && !Array.isArray(value)
      && Object.keys(value).length === 2 && value.schema === 1
      && family.records.some((episode) => episode.id === value.lastEpisodeId);
    return { store, key, raw, last: valid ? value.lastEpisodeId : null, valid };
  } catch { return { key, valid: false, last: null }; }
}

export function nextInvestigationArrival(family, storage) {
  if (!family?.records?.length) return null;
  const prior = preference(family, storage);
  const index = family.records.findIndex((episode) => episode.id === prior.last);
  return family.records[(index + 1) % family.records.length];
}

export function rememberInvestigationArrival(family, episodeId, storage) {
  if (!family?.records?.some((episode) => episode.id === episodeId)) return false;
  const prior = preference(family, storage);
  if (!prior.valid) return false;
  try {
    if (prior.store.getItem(prior.key) !== prior.raw) return false;
    prior.store.setItem(prior.key, JSON.stringify({ schema: 1, lastEpisodeId: episodeId }));
    return true;
  } catch { return false; }
}
