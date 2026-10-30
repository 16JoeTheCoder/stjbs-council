import { test, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
let env;
const E='a@stjbs.sch.id';
const base={ termId:'T', kind:'project', parentId:null, ancestors:[], title:'x', status:'todo', archived:false, leadUid:null, leadUids:[], assigneeUids:[], createdByUid:E, createdAt:Timestamp.now(), updatedAt:Timestamp.now(), notes:'', link:'', blocked:false, blockedReason:'', blockedOnUid:null, startDate:null,dueDate:null,isDeal:false,dealStage:null,pledgedIdr:0,receivedIdr:0,assignedAt:null,completedAt:null };
const shapes=Object.fromEntries(Object.keys(base).map(k=>{const x={...base};delete x[k];return ['no_'+k.replace(/[^a-z]/gi,''),x]}));
shapes.pAbsent={...base,parentId:''};
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-council',firestore:{host:'127.0.0.1',port:8180,rules:readFileSync('/tmp/claude-0/-home-user-stjbs-council/995d8ccc-f96a-5b98-bedf-04c52c406692/scratchpad/old.rules','utf8')}});
await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();await setDoc(doc(db,'settings/current'),{termId:'T'});
await setDoc(doc(db,'members/'+E),{name:'a',role:'advisor',active:true,termId:'T'});
for (const [k,v] of Object.entries(shapes)) await setDoc(doc(db,'items/'+k),v);});});
after(()=>env.cleanup());
const as=n=>env.authenticatedContext(n+'@stjbs.sch.id',{email:n+'@stjbs.sch.id',email_verified:true}).firestore();
for (const k of Object.keys(shapes)) {
 test.skip('upd '+k, ()=>assertSucceeds(updateDoc(doc(as('a'),'items/'+k),{notes:'a',touchedAt:serverTimestamp()})));
 test('upd-notouch '+k, ()=>assertSucceeds(updateDoc(doc(as('a'),'items/'+k),{notes:'a'})));
 test.skip('create '+k, ()=>assertSucceeds(setDoc(doc(as('a'),'items/new'+k),{...shapes[k],touchedAt:serverTimestamp(),createdAt:serverTimestamp()})));
}
