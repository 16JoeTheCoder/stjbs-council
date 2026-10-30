const L=require('./m3lib.cjs');
const base='http://127.0.0.1:8080/v1/projects/demo-council/databases/(default)/documents/announcements';
const H={Authorization:'Bearer owner','Content-Type':'application/json'};
const patch=(id,f)=>fetch(`${base}/${id}?`+Object.keys(f).map(k=>'updateMask.fieldPaths='+k).join('&'),{method:'PATCH',headers:H,body:JSON.stringify({fields:Object.fromEntries(Object.entries(f).map(([k,v])=>[k,typeof v==='boolean'?{booleanValue:v}:{stringValue:v}]))})}).then(r=>r.status);
const create=(id,f)=>fetch(`${base}?documentId=${id}`,{method:'POST',headers:H,body:JSON.stringify({fields:{termId:{stringValue:'2026-27'},archived:{booleanValue:false},createdByUid:{stringValue:'nadia@stjbs.sch.id'},createdAt:{integerValue:String(Date.now())},...Object.fromEntries(Object.entries(f).map(([k,v])=>[k,{stringValue:v}]))}})}).then(r=>r.status);
const T=async(p,s='main')=>(await p.locator(s).first().innerText()).replace(/\n/g,' | ');
const sections=async(p)=>({ann:await p.locator('.fl-ann').count(), one:await p.locator('.fl-ann--one').count(), cards:await p.locator('.fl-ann-card').count(), red:await p.locator('.fl-panel--red').count(), mission:await p.locator('.fl-mission').count()});
(async()=>{
 const {b,p}=await L.open(1440,900); await L.login(p,'michael');
 console.log('2 anns',JSON.stringify(await sections(p)));
 console.log('archive ann2',await patch('ann2',{archived:true})); await p.waitForTimeout(1500); console.log('1 ann (michael has checkin)',JSON.stringify(await sections(p))); await L.shot(p,'michael-1ann-1440');
 await p.click('.fl-ann-card'); await p.waitForTimeout(400); console.log('sheet',await p.locator('.fl-sheet').count(), (await T(p,'.fl-sheet')).slice(0,200)); await L.shot(p,'michael-annsheet-1440'); await p.keyboard.press('Escape'); await p.waitForTimeout(300); console.log('esc closed',await p.locator('.fl-sheet').count(),'focus',await p.evaluate(()=>document.activeElement.className));
 const p2=await (await b.newContext({viewport:{width:1440,height:900},colorScheme:'dark'})).newPage(); await p2.goto(L.B+'#/week'); await p2.fill('#email','raka@stjbs.sch.id'); await p2.fill('#password','council123'); await p2.click('form button.fl-btn--red'); await p2.waitForSelector('.fl-app'); await p2.waitForTimeout(800);
 console.log('raka 1 ann + checkin due: sections',JSON.stringify(await sections(p2))); await L.shot(p2,'raka-1ann-checkin-1440');
 console.log('archive ann1',await patch('ann1',{archived:true})); await p.waitForTimeout(1500); console.log('0 anns',JSON.stringify(await sections(p)));
 await patch('ann1',{archived:false}); await patch('ann2',{archived:false});
 console.log('create ann4',await create('ann4',{title:'QA third announcement with a very long title that should wrap nicely across lines without clipping text anywhere',body:'Body <b>html</b> & "quotes" 😀 '+'long '.repeat(60),audience:'members',startDate:'2026-10-29',endDate:'2026-11-20'}));
 console.log('create ann5',await create('ann5',{title:'Fourth',body:'x',audience:'everyone',startDate:'2026-10-29',endDate:'2026-11-20'}));
 await p.waitForTimeout(1800); console.log('4 active -> cards',JSON.stringify(await sections(p))); await L.shot(p,'michael-4anns-1440');
 await p.click('.fl-ann-card >> nth=0'); await p.waitForTimeout(300); await L.shot(p,'michael-annsheet-long-1440'); console.log('sheet title', (await T(p,'.fl-sheet')).slice(0,120)); await p.keyboard.press('Escape');
 // mission
 const m=p.locator('.fl-mission'); const txt=async()=>(await m.innerText()).replace(/\n/g,' ');
 const arrow=m.locator('button'); console.log('mission', await txt()); for(let i=0;i<4;i++){await arrow.click(); await p.waitForTimeout(250); console.log('->',await txt());}
 await patch('ann4',{archived:true}); await patch('ann5',{archived:true});
 console.log('LOGS',[...new Set(p.logs)].join(' || ')); await b.close();
})().catch(e=>{console.error(e.message.slice(0,600));process.exit(1)});
