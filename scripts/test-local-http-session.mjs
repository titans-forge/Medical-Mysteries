import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import bundle from '../story_decisions.mjs';
import {createOfflineAPI} from '../offline_engine.mjs';
const original=Object.getOwnPropertyDescriptor(globalThis,'crypto');
try {
 Object.defineProperty(globalThis,'crypto',{configurable:true,value:{getRandomValues:webcrypto.getRandomValues.bind(webcrypto)}});
 const values=new Map(); const storage={get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const api=()=>createOfflineAPI(bundle,{storage});const client=api();const started=[];
 for(let i=0;i<20;i++){const r=await client('/api/start',{method:'POST',body:JSON.stringify({tier:bundle.cases[0].tier,case_id:bundle.cases[0].case_id})});const data=await r.json();assert.equal(r.ok,true,data.error);assert.match(data.session_id,/^mm-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);started.push(data);}
 assert.equal(new Set(started.map(s=>s.session_id)).size,20);
 const cold=api();for(const start of started){const r=await cold(`/api/resume?session_id=${start.session_id}`);assert.equal(r.ok,true);assert.equal((await r.json()).session_id,start.session_id);}
 console.log('PASS local HTTP Safari can start 20 distinct sessions and cold-resume each without randomUUID');
 Object.defineProperty(globalThis,'crypto',{configurable:true,value:{}});const before=[...values];const response=await client('/api/start',{method:'POST',body:JSON.stringify({tier:bundle.cases[0].tier,case_id:bundle.cases[0].case_id})});assert.equal(response.ok,false);assert.match((await response.json()).error,/cannot create a local session ID/);assert.deepEqual([...values],before);
 console.log('PASS unavailable secure randomness fails without overwriting any stored session');
} finally {Object.defineProperty(globalThis,'crypto',original);}
