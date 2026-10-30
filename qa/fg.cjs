const L=require('./flib.cjs');
(async()=>{
 let {b,p}=await L.open(1440,900); await L.login(p,'michael');
 await p.goto(L.B+'#/p/carnival'); await p.waitForTimeout(1200);
 console.log((await p.innerText('main')).replace(/\n+/g,' | ').slice(0,2500));
 const hs=await p.evaluate(()=>[...document.querySelectorAll('main h2,main h3,main summary,main [role=tab],main .fl-seg button')].map(e=>e.innerText.slice(0,30)));console.log(hs);
 await L.shot(p,'michael-carnival');
 // filter chips counts match
 for (const c of ['Mine','Due soon','Overdue','Blocked','Done']) { await p.goto(L.B+'#/tasks'); await p.waitForTimeout(500); const lab=await p.locator(`.fl-chip:has-text("${c}")`).first().innerText().catch(()=>'?'); await p.click(`button:has-text("${c}")`); await p.waitForTimeout(300); const rows=await p.locator('main .fl-task, main li.fl-row, main .fl-row').count(); console.log(c,'chip',lab.replace(/\n/g,' '),'rows',rows);} 
 await b.close();
})();
