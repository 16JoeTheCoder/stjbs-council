const L=require('./m3lib.cjs');
const T=async(p,s='main')=>(await p.locator(s).first().innerText()).replace(/\n/g,' | ');
(async()=>{
 let {b,ctx,p}=await L.open(1440,900); await ctx.grantPermissions(['clipboard-read','clipboard-write']); await L.login(p,'sarah');
 await p.goto(L.B+'#/digest'); await p.waitForTimeout(600);
 const pre=await p.locator('.fl-digest').innerText(); console.log(pre);
 await p.click('button:has-text("Copy digest")'); await p.waitForTimeout(500); console.log('toast',await p.locator('.fl-toast').innerText().catch(()=>'none')); const clip=await p.evaluate(()=>navigator.clipboard.readText()); console.log('clip matches preview', clip===pre);
 const href=await p.locator('a:has-text("Open in WhatsApp")').getAttribute('href'); console.log('wa',href.slice(0,60), decodeURIComponent(href.split('text=')[1])===pre, await p.locator('a:has-text("Open in WhatsApp")').getAttribute('rel'));
 await L.shot(p,'sarah-digest-1440');
 console.log('template editor', await p.locator('#tpl-h').count());
 await p.goto(L.B+'#/week'); await p.waitForTimeout(500);
 console.log('sarah needs you rows', await p.locator('.fl-row--task').allInnerTexts().then(a=>a.map(x=>x.replace(/\n/g,' '))));
 console.log('LOGS',[...new Set(p.logs)].join(' || ')); await b.close();
 // clara: check-in missing + 1 banner => mission hidden
 const base='http://127.0.0.1:8080/v1/projects/demo-council/databases/(default)/documents/announcements/ann1?updateMask.fieldPaths=archived';
 const H={Authorization:'Bearer owner','Content-Type':'application/json'};
 await fetch(base.replace('ann1','ann2'),{method:'PATCH',headers:H,body:JSON.stringify({fields:{archived:{booleanValue:true}}})});
 ({b,ctx,p}=await L.open(1440,900)); await L.login(p,'clara'); await p.waitForTimeout(800);
 console.log('clara 1 banner + checkin panel: red panels',await p.locator('.fl-panel--red').count(),'one',await p.locator('.fl-ann--one').count(),'mission',await p.locator('.fl-mission').count()); await L.shot(p,'clara-home-1ann-1440');
 await b.close();
 ({b,ctx,p}=await L.open(390,844)); await L.login(p,'clara'); await p.waitForTimeout(800); await L.shot(p,'clara-home-1ann-390'); console.log('phone order', await p.locator('main > *').evaluateAll(a=>a.map(x=>(x.querySelector('h1,h2')||x).textContent.slice(0,25)))); await b.close();
 await fetch(base.replace('ann1','ann2'),{method:'PATCH',headers:H,body:JSON.stringify({fields:{archived:{booleanValue:false}}})});
})().catch(e=>{console.error(e.message.slice(0,600));process.exit(1)});
