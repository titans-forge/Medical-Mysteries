import assert from 'node:assert/strict';
import fs from 'node:fs';
import original from '../game-data.mjs';
import current from '../story_decisions.mjs';
import { createOfflineAPI } from '../offline_engine.mjs';
import { createNativeStorage, getGameStorage } from '../game_storage.mjs';
import { exportJSON } from '../export_file.mjs';
import { REVIEW_STATEMENT, PRODUCT_RELEASE, releaseLimitation } from '../product_release.mjs';
const values = new Map(); let failure = false, writes = 0;
const transport = (raw) => {
 const { op, key, value } = JSON.parse(raw);
 if (failure) return JSON.stringify({ ok:false, name:'QuotaExceededError', error:'Storage full' });
 let result = null;
 if (op === 'get') result = values.get(key) ?? null;
 else if (op === 'set') { writes++; values.set(key,value); }
 else if (op === 'remove') values.delete(key);
 else if (op === 'clear') values.clear();
 else if (op === 'key') result = [...values.keys()][key] ?? null;
 else if (op === 'length') result = values.size;
 return JSON.stringify({ok:true,value:result});
};
const store = createNativeStorage(transport);
async function req(api,path,body) { const r = await api(path,body?{body:JSON.stringify(body)}:{}); const data=await r.json(); assert.equal(r.ok,true,data.error); return data; }
const api = createOfflineAPI(current,{legacyBundles:[original],storage:store});
const listing = await req(api,'/api/tiers');
assert.equal(listing.release_mode,true); assert.equal(listing.product.version,'1.0.0');
assert.deepEqual(listing.features,{investigations:true,practice:true});
assert.equal(listing.review_status,REVIEW_STATEMENT);
assert.equal(PRODUCT_RELEASE.clinician_review.attestation,'creator_confirmed');
const spec=current.cases[0]; const start=await req(api,'/api/start',{case_id:spec.case_id,tier:spec.tier});
assert.match(start.preview_status,/FICTIONAL/); assert.doesNotMatch(start.preview_status,/BETA|PREVIEW|PENDING/);
const wrong=spec.stages[0].choices.find(x=>!x.result.correct);
await req(api,'/api/answer',{session_id:start.session_id,option_id:wrong.id});
const restored=await req(createOfflineAPI(current,{storage:createNativeStorage(transport)}),`/api/resume?session_id=${start.session_id}`);
assert.equal(restored.last_result.correct,false); assert.ok(writes>0);
const before=[...values]; failure=true;
assert.throws(()=>store.setItem('mmTest','replacement'),{name:'QuotaExceededError'});
assert.deepEqual([...values],before);
failure=false;
assert.equal(store.length,values.size); assert.equal(store.key(0),[...values.keys()][0]);
const credits=fs.readFileSync(new URL('../CREDITS.txt',import.meta.url),'utf8');assert.ok(credits.includes(REVIEW_STATEMENT));
for(const file of ['index.html','app.js','investigation_view.mjs']){
 const text=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
 assert.doesNotMatch(text,/EDUCATIONAL BETA|SYNTHETIC PREVIEW|pending human review|not independently clinically reviewed/);
}
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.match(html,/viewport-fit=cover/);
const css=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');
for(const edge of ['top','right','bottom','left'])assert.ok(css.includes(`safe-area-inset-${edge}`));
const prior = Object.getOwnPropertyDescriptor(globalThis,'localStorage');Object.defineProperty(globalThis,'localStorage',{value:store,configurable:true});assert.equal(getGameStorage(),store);if(prior)Object.defineProperty(globalThis,'localStorage',prior);else delete globalThis.localStorage;
console.log('PASS release features, consistent review wording, native Storage semantics, cold story replay, failed-write preservation and safe-area contract.');

assert.equal(releaseLimitation('Educational fiction pending human medical review.'), REVIEW_STATEMENT);
assert.equal(releaseLimitation('The supplied scan is nondiagnostic.'), 'The supplied scan is nondiagnostic.');
let resolveShare, posted=[];
const oldNative=globalThis.__MM_NATIVE__, oldWebkit=globalThis.webkit;
globalThis.__MM_NATIVE__=true;
globalThis.webkit={messageHandlers:{exportJSON:{postMessage:(body)=>{posted.push(body);return new Promise(resolve=>{resolveShare=resolve;});}}}};
const cyclic={};cyclic.self=cyclic;
const exportOne=exportJSON(()=>{throw new Error('Native backup must not read or serialize web history');},'medical-mysteries-story-history.json');
await exportJSON({},'medical-mysteries-story-history.json');
assert.deepEqual(posted,[{filename:'medical-mysteries-story-history.json',backup:true}]);
resolveShare({completed:false});await exportOne;
globalThis.__MM_NATIVE__=oldNative;globalThis.webkit=oldWebkit;
console.log('PASS historical display notices, native streamed-backup request and duplicate export guard.');
