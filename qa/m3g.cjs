const L=require('./m3lib.cjs');
const txt=async(p,s)=>(await p.locator(s).first().innerText()).replace(/\n/g,' | ');
(async()=>{
 let {b,p}=await L.open(1440,900); await L.login(p,'raka');
 await p.goto(L.B+'#/tasks'); await p.waitForTimeout(600);
 const chips=async()=>p.locator('.fl-filter').evaluateAll(a=>a.map(x=>x.textContent.trim().replace(/\s+/g,' ')));
 const rows=()=>p.locator('.fl-row--task').count();
 console.log('chips',JSON.stringify(await chips()),'rows',await rows());
 for(const c of ['All','Mine','Due soon','Overdue','Blocked','Done']){ await p.click(`.fl-filter:has-text("${c}")`); await p.waitForTimeout(200); const t=await p.locator(`.fl-filter[aria-pressed=true]`).first().innerText(); console.log(c,'->',t.replace(/\n/g,' '),'rows',await rows()); }
 await p.click('.fl-filter:has-text("Mine")'); 
 await L.shot(p,'raka-tasks-1440');
 await p.click('.fl-filter:has-text("Hide done")'); await p.waitForTimeout(200); console.log('hide done rows',await rows(), await chips().then(c=>c.slice(-2)));
 await p.click('.fl-filter:has-text("Show done")');
 // tick
 const cb=p.locator('input.fl-check[aria-label="Done: Order 400 cups"]');
 await cb.check(); await p.waitForTimeout(1200); console.log('ticked', await cb.isChecked(), JSON.stringify(await chips()));
 await p.goto(L.B+'#/week'); await p.waitForTimeout(700); console.log('home after tick:', await txt(p,'.fl-hero__body'), '| rows', await rows());
 await p.goto(L.B+'#/projects'); await p.waitForTimeout(500); console.log('projects after tick:', (await p.locator('main').innerText()).replace(/\n/g,' | ').slice(0,500));
 await p.goto(L.B+'#/p/carnival'); await p.waitForTimeout(500); console.log('carnival page:', (await p.locator('main').innerText()).replace(/\n/g,' | ').slice(0,700)); await L.shot(p,'raka-carnival-1440');
 await p.goto(L.B+'#/tasks'); await p.waitForTimeout(500);
 await p.click('.fl-filter:has-text("Mine")'); await p.locator('input.fl-check[aria-label="Done: Order 400 cups"]').uncheck(); await p.waitForTimeout(1000); console.log('unticked', JSON.stringify(await chips()));
 console.log('LOGS',[...new Set(p.logs)].join(' || '));
 // task page as assignee
 await p.goto(L.B+'#/p/t1'); await p.waitForTimeout(600); await L.shot(p,'raka-task-t1-1440'); console.log('task page:', (await p.locator('main').innerText()).replace(/\n/g,' | ').slice(0,600));
 console.log('buttons', await p.locator('main button, main a.fl-btn').allInnerTexts());
 await b.close();
})().catch(e=>{console.error(e.message.slice(0,500));process.exit(1)});
