import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import original from '../game-data.mjs';
import previous from '../story_content_v2.mjs';
import current from '../story_decisions.mjs';
import {createOfflineAPI, OfflineSession} from '../offline_engine.mjs';
import {storyReviewRoute, recordStoryCompletion, readStoryCompletions, loadStoryProfile} from '../story_progress.mjs';
import {INVESTIGATION_EPISODES, getInvestigationEpisode, createInvestigation, restoreInvestigation, getCareWorkflow, chooseCarePriority, requestCareTask, advanceCareUpdate, reviewCareTask, respondCareUpdate, setHypothesis, reassessCare, sendCareHandoff, acknowledgeCareHandoff, concludeInvestigation, investigationOutcome} from '../investigation.mjs';
import {V5_INVESTIGATION_CONTENT} from '../investigation_content_versions.mjs';
import {saveInvestigation, loadInvestigation} from '../investigation_history.mjs';
import {recordCompleted, readJournal, journalRecordIdentity, answerTransfer} from '../investigation_journal.mjs';
import {getTransferQuestion} from '../investigation_transfer.mjs';
const tests=[]; const test=(name,run)=>tests.push([name,run]);
const clone=x=>JSON.parse(JSON.stringify(x));
function memory(initial={}) { const values=new Map(Object.entries(initial)); return {values,get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)}; }
const care=s=>getCareWorkflow(s); const good=choices=>choices.find(x=>x.appropriate).id;
function complete(ep,reverse=false) {
 let s=createInvestigation('guided',ep.id,ep.version);s=chooseCarePriority(s,good(care(s).choices.priority));
 while(s.actionIds.length<ep.actions.length){for(const task of care(s).tasks.filter(t=>t.canRequest))s=requestCareTask(s,task.actionId);while(care(s).canUpdate)s=advanceCareUpdate(s);const ready=care(s).tasks.filter(t=>t.status==='available');assert.ok(ready.length);if(reverse)ready.reverse();for(const t of ready)s=reviewCareTask(s,t.actionId);}
 s=setHypothesis(s,ep.resolution.hypothesisId);for(const u of care(s).patientUpdates)s=respondCareUpdate(s,u.id,good(u.choices));s=reassessCare(s,good(care(s).choices.reassessment));
 s=sendCareHandoff(s,Object.fromEntries(Object.entries(care(s).choices.handoff).map(([k,v])=>[`${k}Id`,good(v.choices)])));s=acknowledgeCareHandoff(s,care(s).handoff.id,good(care(s).choices.readback));return concludeInvestigation(s,ep.resolution.hypothesisId);
}
const blank={confidence:null,keyActionId:null,uncertaintyId:null};

test('v5 definitions, ordering and all trusted rules survive exactly in the separate registry',()=>{
 const baseline=JSON.parse(fs.readFileSync(new URL('./fixtures/investigation-v5-before-editorial.json',import.meta.url),'utf8'));
 assert.deepEqual(V5_INVESTIGATION_CONTENT,baseline);
 for(const {episode,transfer} of baseline){assert.equal(JSON.stringify(getInvestigationEpisode(episode.id,5)),JSON.stringify(episode));assert.deepEqual(getTransferQuestion(episode.id,5),transfer);}
});

test('v6 changes only authored strings and episode version, preserving every rule and clinical fact',()=>{
 const allowed=new Set(['label','prompt','message']);
 function check(old,now,path=''){
  if(Array.isArray(old)){assert.equal(now.length,old.length,path);old.forEach((x,i)=>check(x,now[i],`${path}.${i}`));return;}
  if(old&&typeof old==='object'){assert.deepEqual(Object.keys(now),Object.keys(old),path);for(const k of Object.keys(old))check(old[k],now[k],path?`${path}.${k}`:k);return;}
  if(old===now)return;
  if(path==='version'){assert.equal(now,6);return;}
  const last=path.split('.').at(-1);
  assert.ok(typeof old==='string'&&typeof now==='string'&&(allowed.has(last)||/reviewProvenance\.text$/.test(path)||/^resolution\.limitations\.\d+$/.test(path)),`Unexpected rule/fact change ${path}`);
 }
 assert.equal(INVESTIGATION_EPISODES.length,9);
 for(const ep of INVESTIGATION_EPISODES){check(getInvestigationEpisode(ep.id,5),ep);assert.ok(Object.isFrozen(ep.coordination.readbackScenarios));assert.equal(ep.careWorkflow.version,getInvestigationEpisode(ep.id,5).careWorkflow.version);}
});

test('all nine v6 cases complete, replay and checkpoint with either report order and separate v5 slots',()=>{
 for(const ep of INVESTIGATION_EPISODES)for(const reverse of [false,true]){
  const s=complete(ep,reverse);assert.ok(s?.completed);assert.deepEqual(restoreInvestigation(clone(s)),s);assert.equal(investigationOutcome(s).status,'supported');
  const store=memory();const old=complete(getInvestigationEpisode(ep.id,5),reverse);assert.equal(saveInvestigation(old,store),true);const before=[...store.values];assert.equal(saveInvestigation(s,store),true);assert.deepEqual(loadInvestigation(ep.id,store,5),old);assert.deepEqual(loadInvestigation(ep.id,store,6),s);for(const [k,v]of before)assert.equal(store.getItem(k),v);
  assert.equal(restoreInvestigation({...s,version:7}),null);
 }
});

test('25 mixed historical/v5/v6 journal routes coexist and retain earlier first contrast answers',()=>{
 const v4=JSON.parse(fs.readFileSync(new URL('./fixtures/investigation-upgrade-0.7.0.json',import.meta.url),'utf8'));
 const v3=JSON.parse(fs.readFileSync(new URL('./fixtures/investigation-upgrade-0.6.0.json',import.meta.url),'utf8'));
 const old=[...v4.records,v3.records[0]];const key='mmInvestigationJournal:v1';const store=memory({[key]:JSON.stringify({schema:2,records:old})});
 for(const ep of V5_INVESTIGATION_CONTENT.map(x=>x.episode))assert.equal(recordCompleted(complete(ep),blank,store),true);
 const before=clone(readJournal(store).records);assert.equal(before.length,16);
 for(const ep of INVESTIGATION_EPISODES)assert.equal(recordCompleted(complete(ep),blank,store),true,ep.id);
 const after=readJournal(store);assert.equal(after.status,'ok');assert.equal(after.records.length,25);assert.ok(Buffer.byteLength(store.getItem(key))<=1024*1024);
 for(const record of before){const id=journalRecordIdentity(record.state,record.reflection);assert.deepEqual(after.records.find(r=>journalRecordIdentity(r.state,r.reflection)===id),record);if(record.transfer){const question=getTransferQuestion(record.state.episodeId,record.state.version);const other=question.choices.find(x=>x.id!==record.transfer.answerId);assert.equal(answerTransfer(record.state,other.id,store,record.reflection).transfer.answerId,record.transfer.answerId);}}
});

test('v6 capacity is bounded at 30, without eviction or writes when full',()=>{
 const store=memory();const s=complete(INVESTIGATION_EPISODES[0]);assert.equal(recordCompleted(s,blank,store),true);const old=JSON.parse(fs.readFileSync(new URL('./fixtures/investigation-upgrade-0.6.0.json',import.meta.url),'utf8')).records[0].state;for(let i=0;i<29;i++)assert.equal(recordCompleted(old,{...blank,confidence:i},store),true);
 assert.equal(readJournal(store).records.length,30);const before=[...store.values];assert.equal(recordCompleted(s,{...blank,confidence:30},store),false);assert.deepEqual([...store.values],before);
 const fake=memory({'mmInvestigationJournal:v1':JSON.stringify({schema:2,records:[{state:{version:6}}]})+' '.repeat(530*1024)});assert.equal(readJournal(fake).reason,'oversize-store');
});

test('story v3 is deterministic and preserves all clinical instructions, outcomes, timing and media',()=>{
 const {build_id,...payload}=current;assert.equal(current.content_version,3);assert.equal(build_id,createHash('sha256').update(JSON.stringify(payload)).digest('hex'));assert.notEqual(build_id,previous.build_id);
 for(const [i,spec]of current.cases.entries()){
  const old=previous.cases[i];const normalized=clone(spec);
  for(const [j,stage]of spec.stages.entries()){
   const prior=old.stages[j];assert.notEqual(stage.view.question,prior.view.question);assert.equal(stage.choices.find(x=>x.result.correct).label,prior.choices.find(x=>x.result.correct).label);
   normalized.stages[j].view.question=prior.view.question;normalized.stages[j].review_variant_id=prior.review_variant_id;
   normalized.stages[j].choices.forEach((choice,k)=>choice.label=prior.choices[k].label);normalized.stages[j].view.options.forEach((option,k)=>option.label=prior.view.options[k].label);
   for(const key of ['stage_autopsy','reasoning_autopsy']){const rows=key==='stage_autopsy'?normalized.completion[key]:normalized.completion[key]?.stages;const originals=key==='stage_autopsy'?old.completion[key]:old.completion[key]?.stages;rows[j].question=originals[j].question;rows[j].review_variant_id=originals[j].review_variant_id;}
   for(const choice of stage.choices.filter(c=>!c.result.correct))assert.deepEqual(choice.result,prior.choices.find(c=>c.id===choice.id).result);
   for(const bundle of [original,previous,current]){const entry=bundle.cases[i].stages[j];const route=storyReviewRoute({concept_id:entry.view.concept_id,review_variant_id:entry.review_variant_id});assert.equal(route.build_id,bundle.build_id);}
  }
  assert.deepEqual(normalized,old);
 }
});

async function req(api,path,body){const r=await api(path,body===undefined?{}:{method:'POST',body:JSON.stringify(body)});const data=await r.json();assert.equal(r.ok,true,data.error);return data;}
function api(store,bundle=current){return createOfflineAPI(bundle,{legacyBundles:[original,previous].filter(x=>x.build_id!==bundle.build_id),storage:store,clock:()=>1234});}

test('v2 active/completed stories resume with original wording after v3 and read without migration',async()=>{
 const store=memory();const older=api(store,previous);const starts=[];
 for(const spec of previous.cases){let s=await req(older,'/api/start',{tier:spec.tier,case_id:spec.case_id});starts.push(s);if(starts.length%2){for(const stage of spec.stages){const result=await req(older,'/api/answer',{session_id:s.session_id,option_id:stage.choices.find(x=>x.result.correct).id,confidence:60});if(result.finished)break;}}}
 const before=[...store.values];const cold=api(store);for(const start of starts){const resumed=await req(cold,`/api/resume?session_id=${start.session_id}`);assert.equal(resumed.content_version,2);assert.equal(resumed.build_id,previous.build_id);}
 assert.deepEqual([...store.values],before);const listing=await req(cold,'/api/tiers');assert.equal(listing.content_version,3);assert.equal(listing.editions.length,3);
 for(const spec of current.cases){const s=await req(cold,'/api/start',{tier:spec.tier,case_id:spec.case_id});assert.equal(s.content_version,3);assert.equal(s.question,spec.stages[0].view.question);for(const stage of spec.stages){await req(cold,'/api/answer',{session_id:s.session_id,option_id:stage.choices.find(x=>!x.result.correct).id,confidence:80});const result=await req(cold,'/api/answer',{session_id:s.session_id,option_id:stage.choices.find(x=>x.result.correct).id,confidence:60});if(result.finished){assert.equal(result.score.accuracy,0);assert.equal(result.content_version,3);}}const resumed=await req(api(store),`/api/resume?session_id=${s.session_id}`);assert.equal(resumed.content_version,3);assert.equal(resumed.finished,true);}
 for(const[k,v]of before)assert.equal(store.getItem(k),v);
});

test('v2/v3 completion receipts coexist while current XP remains specific to its edition',()=>{
 const store=memory();for(const bundle of [previous,current]){const spec=bundle.cases[0];const session=new OfflineSession(spec,{id:`edition-${bundle.content_version}`,clock:()=>100,content:{build_id:bundle.build_id,content_version:bundle.content_version,edition_label:bundle.edition_label}});let result;for(const stage of spec.stages)result=session.answer(stage.choices.find(x=>x.result.correct).id,60);const snapshot={...session.snapshot(),case_id:spec.case_id,tier:spec.tier,build_id:bundle.build_id,content_version:bundle.content_version};assert.equal(recordStoryCompletion(snapshot,result,store,2000).saved,true);}
 assert.equal(readStoryCompletions(store).records.length,2);assert.equal(loadStoryProfile(store).xp,previous.cases[0].stages.length);assert.equal(loadStoryProfile(store,previous.build_id).xp,previous.cases[0].stages.length);
});
for(const[name,run]of tests){await run();console.log(`PASS ${name}`);}console.log(`Verified ${tests.length} editorial, replay and mixed-history scenarios.`);
