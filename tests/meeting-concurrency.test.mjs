// Dedicated emulator project: never clears demo-council browser data.
// Run from repo root with FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node tests/meeting-concurrency.test.mjs
import { test, before, beforeEach, after } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, collection, getDocs, getDoc, setDoc, updateDoc, runTransaction, writeBatch, serverTimestamp, increment, setLogLevel } from 'firebase/firestore';

setLogLevel('silent');
const projectId = 'demo-council-concurrency', T = '2026-27';
const users = { president:'pres@stjbs.sch.id', vp:'vp@stjbs.sch.id', host:'host@stjbs.sch.id', cohost:'cohost@stjbs.sch.id', editor:'editor@stjbs.sch.id', next:'next@stjbs.sch.id', teacher:'teacher@stjbs.sch.id', room:'room@stjbs.sch.id' };
let env;
const as = (email) => env.authenticatedContext(email.split('@')[0], {email,email_verified:true}).firestore();
const meeting = (patch = {}) => ({termId:T,eventId:'event',createdByUid:users.president,createdAt:1,title:'Council',date:'2026-11-03',startTime:'15:00',endTime:'16:00',venue:'Hall',participantUids:[users.editor,users.host,users.cohost,users.next,users.room,users.teacher],projectIds:['project'],chairUid:users.president,hostUid:users.host,cohostUids:[users.cohost],minutesUid:users.editor,minutesBackupUid:users.next,revision:1,status:'live',actualStart:2,actualEnd:null,...patch});
const session = (patch = {}) => ({termId:T,revision:1,hostUid:users.host,phase:'attendance',activeTopicId:null,presenterUid:null,queue:[],timerStartedAt:null,timerDuration:0,updatedAt:1,sessionId:'session-1',...patch});
const draft = (patch = {}) => ({termId:T,revision:1,editorUid:users.editor,status:'draft',summary:'Private summary',decisions:'',actions:[],closing:'Meeting closed at',nextMeeting:'',preparedBy:users.editor,reviewedBy:'',publishedVersion:0,updatedAt:1,...patch});
const proposal = {title:'Council',type:'meeting',date:'2026-11-03',start:'15:00',end:'16:00',location:'Hall',notes:'',public:false,itemId:null,participantSelection:{groupIds:[],sections:[],includeUids:[],excludeUids:[]},participantUids:[users.editor],configSnapshot:{settingsVersion:0,templateId:null,templateVersion:0,approval:'required'}};
const request = (patch = {}) => ({termId:T,createdByUid:users.editor,state:'awaiting',revision:1,proposal,eventId:null,reviewedByUid:null,reviewNote:'',createdAt:1,updatedAt:1,replacesEventId:null,baseEventRevision:null,...patch});
const task = (patch = {}) => ({termId:T,parentId:'project',ancestors:['project'],leadUids:[],leadUid:null,kind:'task',title:'Original task',notes:'',link:'',assigneeUids:[],createdByUid:users.president,status:'todo',blocked:false,dueDate:'2026-11-06',archived:false,isDeal:false,dealStage:'Lead',pledgedIdr:0,receivedIdr:0,createdAt:1,...patch});
const ref = (db, path) => doc(db,path);
const stale = (actual, expected) => { if(actual !== expected) throw Object.assign(new Error('Stale revision; refresh required'),{code:'stale-revision'}); };
const deferred = () => { let resolve; const promise = new Promise(r=>{resolve=r;}); return {promise,resolve}; };
function barrier(count = 2) { let arrived=0; const all=deferred(); return async () => { if(++arrived===count) all.resolve(); await all.promise; }; }
function oneWinner(results) { assert.equal(results.filter(r=>r.status==='fulfilled').length,1); assert.equal(results.filter(r=>r.status==='rejected').length,1); }

before(async()=>{
  const address=process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080', split=address.lastIndexOf(':');
  env=await initializeTestEnvironment({projectId,firestore:{host:address.slice(0,split),port:Number(address.slice(split+1)),rules:readFileSync('firestore.rules','utf8')}});
});
after(async()=>{if(env)await env.cleanup();});
beforeEach(async()=>{
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore(), b=writeBatch(db);
    b.set(ref(db,'settings/current'),{termId:T,termName:T});
    for(const [key,email] of Object.entries(users)) b.set(ref(db,`members/${email}`),{name:key,role:['president','vp','teacher'].includes(key)?key:'officer',active:true,termId:T,section:'',reportsTo:null});
    b.set(ref(db,'meetings/m'),meeting()); b.set(ref(db,'meetings/m/session/control'),session()); b.set(ref(db,'meetings/m/minutes/draft'),draft());
    b.set(ref(db,'items/project'),task({parentId:null,ancestors:[],kind:'project',title:'Project'}));b.set(ref(db,'items/task'),task());
    await b.commit();
  });
});

test('two admin approval transactions read the same request; exactly one schedules exactly one event',async()=>{
  const creator=as(users.editor), initial=writeBatch(creator);initial.set(ref(creator,'eventRequests/r'),request());initial.set(ref(creator,'eventRequests/r/proposals/1'),proposal);await assertSucceeds(initial.commit());
  const ready=barrier();let initialReads=0;
  const approve=(email)=>{const db=as(email);let first=true;return runTransaction(db,async tx=>{
    const rr=ref(db,'eventRequests/r'), er=ref(db,'events/r'), r=await tx.get(rr), e=await tx.get(er);
    if(first){first=false;initialReads++;await ready();}stale(r.data().revision,1);assert.equal(r.data().state,'awaiting');assert.equal(e.exists(),false);
    tx.set(er,{...r.data().proposal,termId:T,createdByUid:r.data().createdByUid,archived:false,requestId:'r',revision:1,createdAt:3,updatedAt:3});
    tx.update(rr,{state:'scheduled',eventId:'r',reviewedByUid:email,revision:2,updatedAt:3});tx.set(ref(db,'eventRequests/r/proposals/2'),r.data().proposal);
  });};
  const results=await Promise.allSettled([approve(users.president),approve(users.vp)]);oneWinner(results);assert.equal(initialReads,2);
  const db=as(users.president), events=await getDocs(collection(db,'events')), saved=(await getDoc(ref(db,'eventRequests/r'))).data();
  assert.equal(events.size,1);assert.equal(events.docs[0].id,'r');assert.equal(saved.state,'scheduled');assert.equal(saved.revision,2);assert.equal(events.docs[0].data().requestId,'r');
  await assertFails(setDoc(ref(db,'events/duplicate'),{...events.docs[0].data()}));
});

test('stale owner request snapshots and stale event revisions cannot overwrite newer records',async()=>{
  const owner=as(users.editor),initial=writeBatch(owner);initial.set(ref(owner,'eventRequests/r'),request({state:'draft'}));initial.set(ref(owner,'eventRequests/r/proposals/1'),proposal);await initial.commit();
  const a=as(users.editor),b=as(users.editor),ready=barrier();
  const save=(db,title)=>{let first=true;return runTransaction(db,async tx=>{const r=ref(db,'eventRequests/r'),snap=await tx.get(r);if(first){first=false;await ready();}stale(snap.data().revision,1);tx.update(r,{proposal:{...proposal,title},revision:2,updatedAt:2});tx.set(ref(db,'eventRequests/r/proposals/2'),{...proposal,title});});};
  oneWinner(await Promise.allSettled([save(a,'First owner tab'),save(b,'Second owner tab')]));
  const currentProposal=(await getDoc(ref(owner,'eventRequests/r/proposals/2'))).data();await assertFails(updateDoc(ref(owner,'eventRequests/r'),{proposal:currentProposal,revision:2,updatedAt:3}));
  await env.withSecurityRulesDisabled(ctx=>setDoc(ref(ctx.firestore(),'events/e'),{...proposal,termId:T,createdByUid:users.editor,archived:false,createdAt:1,revision:2,requestId:null}));
  await assertFails(updateDoc(ref(owner,'events/e'),{notes:'Stale event edit',revision:2}));
});

test('host/cohost racing handoffs have one winner; old host cannot replay even with a fresh revision',async()=>{
  const ready=barrier();
  const transfer=(email,target)=>{const db=as(email);let first=true;return runTransaction(db,async tx=>{const mr=ref(db,'meetings/m'),sr=ref(db,'meetings/m/session/control'),m=await tx.get(mr),s=await tx.get(sr);if(first){first=false;await ready();}stale(m.data().revision,1);stale(s.data().revision,1);tx.update(mr,{hostUid:target,revision:2});tx.update(sr,{hostUid:target,revision:2,updatedAt:3});});};
  oneWinner(await Promise.allSettled([transfer(users.host,users.cohost),transfer(users.cohost,users.cohost)]));
  const m=(await getDoc(ref(as(users.president),'meetings/m'))).data(),s=(await getDoc(ref(as(users.room),'meetings/m/session/control'))).data();assert.equal(m.revision,2);assert.equal(m.hostUid,s.hostUid);
  const old=as(users.host);await assertFails(updateDoc(ref(old,'meetings/m/session/control'),{hostUid:users.host,phase:'tasks',revision:2}));
  await assertFails(updateDoc(ref(old,'meetings/m/session/control'),{phase:'tasks',revision:3}));
  await assertSucceeds(updateDoc(ref(as(m.hostUid),'meetings/m/session/control'),{phase:'agenda',revision:3}));
});

test('two editor handoffs atomically agree on owner; stale former editor cannot save draft/topic/task',async()=>{
  const ready=barrier();
  // An atomic increment advances private draft CAS without exposing private text to the host.
  const transfer=(email,target)=>{const db=as(email);let first=true;return runTransaction(db,async tx=>{const mr=ref(db,'meetings/m'),m=await tx.get(mr);if(first){first=false;await ready();}stale(m.data().revision,1);tx.update(mr,{minutesUid:target,revision:2});tx.update(ref(db,'meetings/m/minutes/draft'),{editorUid:target,revision:increment(1),updatedAt:3});});};
  oneWinner(await Promise.allSettled([transfer(users.host,users.next),transfer(users.host,users.cohost)]));
  const admin=as(users.president),m=(await getDoc(ref(admin,'meetings/m'))).data(),d=(await getDoc(ref(admin,'meetings/m/minutes/draft'))).data();assert.equal(m.minutesUid,d.editorUid);assert.equal(d.revision,2);
  const old=as(users.editor);await assertFails(updateDoc(ref(old,'meetings/m/minutes/draft'),{summary:'Stale private edit',revision:2}));
  await assertFails(updateDoc(ref(old,'meetings/m/minutes/draft'),{summary:'Forged fresh revision',revision:3}));
  await assertFails(setDoc(ref(old,'meetings/m/topicMinutes/a'),{termId:T,revision:1,discussion:'Old editor',outcome:'',updatedAt:4}));
  await assertFails(updateDoc(ref(old,'items/task'),{title:'Old editor task edit',meetingId:'m',touchedAt:serverTimestamp()}));
  await assertSucceeds(updateDoc(ref(as(m.minutesUid),'meetings/m/minutes/draft'),{summary:'New owner private edit',revision:3}));
});

test('same editor in independent tabs cannot commit a stale draft or private topic revision',async()=>{
  const ready=barrier(),a=as(users.editor),b=as(users.editor);
  const save=(db,text)=>{let first=true;return runTransaction(db,async tx=>{const r=ref(db,'meetings/m/minutes/draft'),d=await tx.get(r);if(first){first=false;await ready();}stale(d.data().revision,1);tx.update(r,{summary:text,revision:2,updatedAt:3});});};
  oneWinner(await Promise.allSettled([save(a,'Editor tab A'),save(b,'Editor tab B')]));
  await assertFails(updateDoc(ref(b,'meetings/m/minutes/draft'),{summary:'Queued stale write',revision:2}));
  await setDoc(ref(a,'meetings/m/topicMinutes/a'),{termId:T,revision:1,discussion:'Current',outcome:'',updatedAt:3});
  await updateDoc(ref(a,'meetings/m/topicMinutes/a'),{discussion:'Newer',revision:2});
  await assertFails(updateDoc(ref(b,'meetings/m/topicMinutes/a'),{discussion:'Queued stale topic',revision:2}));
});

test('closing live meeting while task transaction is paused revokes its temporary task privilege',async()=>{
  const editor=as(users.editor),host=as(users.host),read=deferred(),release=deferred();let attempts=0;
  const save=runTransaction(editor,async tx=>{await tx.get(ref(editor,'meetings/m'));await tx.get(ref(editor,'items/task'));if(++attempts===1){read.resolve();await release.promise;}tx.update(ref(editor,'items/task'),{title:'Late captured action',meetingId:'m',touchedAt:serverTimestamp()});});
  // Attach rejection handling before allowing the other client to close.
  const result=Promise.allSettled([save]);await read.promise;
  await runTransaction(host,async tx=>{const mr=ref(host,'meetings/m'),sr=ref(host,'meetings/m/session/control');await tx.get(mr);await tx.get(sr);tx.update(mr,{status:'closed',actualEnd:5,revision:2});tx.update(sr,{timerStartedAt:null,revision:2,updatedAt:5});});
  release.resolve();assert.equal((await result)[0].status,'rejected');
  assert.equal((await getDoc(ref(as(users.room),'items/task'))).data().title,'Original task');
  await assertFails(updateDoc(ref(editor,'items/task'),{title:'Offline task replay',meetingId:'m',touchedAt:serverTimestamp()}));
  await assertFails(updateDoc(ref(host,'meetings/m/session/control'),{phase:'recap',revision:3}));
});

test('room/teacher/host clients read shared controls but cannot read draft, topic minutes or attendance reasons',async()=>{
  await env.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore();await setDoc(ref(db,'meetings/m/topicMinutes/a'),{termId:T,revision:1,discussion:'Private deliberation',outcome:'Unpublished decision',updatedAt:1});await setDoc(ref(db,`meetings/m/sensitive/${users.editor}`),{termId:T,uid:users.editor,reason:'Private absence',followup:'Contact home',designation:'Officer'});});
  for(const email of [users.room,users.teacher,users.host,users.cohost]){const db=as(email);await assertSucceeds(getDoc(ref(db,'meetings/m/session/control')));for(const path of ['meetings/m/minutes/draft','meetings/m/topicMinutes/a',`meetings/m/sensitive/${users.editor}`])await assertFails(getDoc(ref(db,path)));}
  const anonymous=env.unauthenticatedContext().firestore();await assertFails(getDoc(ref(anonymous,'meetings/m/session/control')));
  for(const path of ['meetings/m/minutes/draft','meetings/m/topicMinutes/a',`meetings/m/sensitive/${users.editor}`])await assertSucceeds(getDoc(ref(as(users.president),path)));
});

test('nonexistent and old-term parents cannot be abused with current-term subdocument payloads',async()=>{
  await env.withSecurityRulesDisabled(ctx=>setDoc(ref(ctx.firestore(),'meetings/old'),meeting({termId:'old-term'})));
  for(const id of ['missing','old']){const admin=as(users.president),editor=as(users.editor),paths=[`meetings/${id}/session/control`,`meetings/${id}/minutes/draft`,`meetings/${id}/topicMinutes/a`];await assertFails(setDoc(ref(admin,paths[0]),session()));await assertFails(setDoc(ref(editor,paths[1]),draft()));await assertFails(setDoc(ref(editor,paths[2]),{termId:T,revision:1,discussion:'Cross term',outcome:'',updatedAt:2}));await assertFails(updateDoc(ref(editor,'items/task'),{title:'Forged parent grant',meetingId:id,touchedAt:serverTimestamp()}));}
});

test('teacher remains read-only for lifecycle/session/editor/task writes even when named host and editor',async()=>{
  await env.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore();await updateDoc(ref(db,'meetings/m'),{hostUid:users.teacher,minutesUid:users.teacher,cohostUids:[users.teacher]});await updateDoc(ref(db,'meetings/m/session/control'),{hostUid:users.teacher});await updateDoc(ref(db,'meetings/m/minutes/draft'),{editorUid:users.teacher});});
  const db=as(users.teacher);await assertSucceeds(getDoc(ref(db,'meetings/m/session/control')));
  await assertFails(updateDoc(ref(db,'meetings/m'),{status:'closed',actualEnd:3,revision:2}));await assertFails(updateDoc(ref(db,'meetings/m/session/control'),{phase:'tasks',revision:2}));await assertFails(updateDoc(ref(db,'meetings/m/minutes/draft'),{summary:'Teacher override',revision:2}));await assertFails(setDoc(ref(db,'meetings/m/topicMinutes/a'),{termId:T,revision:1,discussion:'Teacher override',outcome:'',updatedAt:2}));await assertFails(updateDoc(ref(db,'items/task'),{title:'Teacher task override',meetingId:'m',touchedAt:serverTimestamp()}));
  // Existing bounded teacher contributions remain intentional, separately authorized input.
  await assertSucceeds(setDoc(ref(db,'meetings/m/contributions/suggestion'),{termId:T,authorUid:users.teacher,topicId:null,type:'suggestion',text:'A bounded suggestion',createdAt:3,status:'submitted'}));
});

test('publication rejects top-level private payloads without advancing the draft or creating a version',async()=>{
  const admin=as(users.president);await env.withSecurityRulesDisabled(ctx=>updateDoc(ref(ctx.firestore(),'meetings/m/minutes/draft'),{status:'review'}));
  const m=meeting(),record={id:'m',termId:T,status:'published',revision:1,publishedVersion:1,publishedAt:5,name:m.title,date:m.date,startTime:m.startTime,endTime:m.endTime,actualStart:m.actualStart,actualEnd:m.actualEnd,venue:m.venue,chairUid:m.chairUid,editorUid:m.minutesUid,attendance:{},agenda:[],summary:'Private summary',decisions:'',actions:[],closing:'Meeting closed at',nextMeeting:'',preparedBy:users.editor,reviewedBy:users.president,absenceReasons:'MUST_NOT_PUBLISH'};
  const b=writeBatch(admin);b.update(ref(admin,'meetings/m/minutes/draft'),{status:'published',revision:2,publishedVersion:1,reviewedBy:users.president});b.set(ref(admin,'meetings/m/versions/1'),{termId:T,revision:1,draftRevision:2,publishedAt:5,publishedByUid:users.president,record});b.set(ref(admin,'meetings/m/versions/1/sections/agenda-0'),{entries:[]});b.set(ref(admin,'meetings/m/versions/1/sections/agenda-1'),{entries:[]});await assertFails(b.commit());assert.equal((await getDoc(ref(admin,'meetings/m/minutes/draft'))).data().status,'review');assert.equal((await getDoc(ref(admin,'meetings/m/versions/1'))).exists(),false);
});

test('publication rejects nested attendance reason fields instead of making them readable to room clients',async()=>{
  const admin=as(users.president);await env.withSecurityRulesDisabled(ctx=>updateDoc(ref(ctx.firestore(),'meetings/m/minutes/draft'),{status:'review'}));
  const m=meeting(),record={id:'m',termId:T,status:'published',revision:1,publishedVersion:1,publishedAt:5,name:m.title,date:m.date,startTime:m.startTime,endTime:m.endTime,actualStart:m.actualStart,actualEnd:m.actualEnd,venue:m.venue,chairUid:m.chairUid,editorUid:m.minutesUid,attendance:{[users.editor]:{status:'absent',reason:'PRIVATE_REASON_DO_NOT_PUBLISH'}},agenda:[],summary:'Private summary',decisions:'',actions:[],closing:'Meeting closed at',nextMeeting:'',preparedBy:users.editor,reviewedBy:users.president};
  const b=writeBatch(admin);b.update(ref(admin,'meetings/m/minutes/draft'),{status:'published',revision:2,publishedVersion:1,reviewedBy:users.president});b.set(ref(admin,'meetings/m/versions/1'),{termId:T,revision:1,draftRevision:2,publishedAt:5,publishedByUid:users.president,record});b.set(ref(admin,'meetings/m/versions/1/sections/agenda-0'),{entries:[]});b.set(ref(admin,'meetings/m/versions/1/sections/agenda-1'),{entries:[]});await assertFails(b.commit());
  const safe=writeBatch(admin);safe.update(ref(admin,'meetings/m/minutes/draft'),{status:'published',revision:2,publishedVersion:1,reviewedBy:users.president});safe.set(ref(admin,'meetings/m/versions/1'),{termId:T,revision:1,draftRevision:2,publishedAt:5,publishedByUid:users.president,record:{...record,attendance:{[users.editor]:'absent'}}});safe.set(ref(admin,'meetings/m/versions/1/sections/agenda-0'),{entries:[]});safe.set(ref(admin,'meetings/m/versions/1/sections/agenda-1'),{entries:[]});await assertSucceeds(safe.commit());assert.equal((await getDoc(ref(as(users.room),'meetings/m/versions/1'))).data().record.attendance[users.editor],'absent');
});
