import bundle from './game-data.mjs';
import { createOfflineAPI } from './offline_engine.mjs';
let storage; try { storage = window.localStorage; } catch {}
export const offlineRequest = createOfflineAPI(bundle, { storage });
