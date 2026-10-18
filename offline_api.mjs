import originalBundle from './game-data.mjs';
import currentBundle from './story_decisions.mjs';
import v2Bundle from './story_content_v2.mjs';
import { createOfflineAPI } from './offline_engine.mjs';
let storage; try { storage = window.localStorage; } catch {}
export const offlineRequest = createOfflineAPI(currentBundle, { legacyBundles: [originalBundle, v2Bundle], storage });
