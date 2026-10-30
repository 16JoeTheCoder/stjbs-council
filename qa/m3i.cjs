const L=require('./m3lib.cjs');
const T=async(p,s='main')=>(await p.locator(s).first().innerText()).replace(/\n/g,' | ');
(async()=>{
 let {b,p}=await L.open(1440,900); await L.login(p,'nadia');
 await p.goto(L.B+'#/projects'); await p.waitForTimeout(600);
 await p.click('text=New project'); await p.fill('#f-title','QA project'); await p.fill('#f-dueDate','2026-12-20'); await p.selectOption('#f-lead','raka@stjbs.sch.id'); await p.click('form button.fl-btn--red'); await p.waitForTimeout(1200);
 console.log('after add url',p.url(),(await T(p)).slice(0,200));
 await p.goto(L.B+'#/projects'); await p.waitForTimeout(500); console.log('projects:',(await T(p)).slice(0,300)); await L.shot(p,'nadia-projects-1440');
 await p.goto(L.B+'#/projects?view=pipeline'); await p.waitForTimeout(500); await L.shot(p,'nadia-pipeline-1440');
 const sel=p.locator('select:near(:text("QA project"))').first();
 const card=p.locator('.fl-card:has-text("QA project")'); await card.locator('select').selectOption('doing'); await p.waitForTimeout(1200);
 console.log('cols:', await p.locator('.fl-board__col').evaluateAll(c=>c.map(x=>x.querySelector('h2').textContent+':'+x.querySelectorAll('article').length+' '+[...x.querySelectorAll('article a')].map(a=>a.textContent))));
 await p.reload(); await p.waitForSelector('.fl-app'); await p.waitForTimeout(500);
 console.log('after reload cols:', await p.locator('.fl-board__col').evaluateAll(c=>c.map(x=>x.querySelector('h2').textContent+':'+[...x.querySelectorAll('article a')].map(a=>a.textContent))));
 console.log('toast', await p.locator('.fl-toast').innerText().catch(()=>'none'));
 // empty title
 await p.goto(L.B+'#/projects'); await p.click('text=New project'); await p.click('form button.fl-btn--red'); console.log('blank project err',await p.locator('#item-err').innerText()); await p.click('text=Cancel');
 // Home for nadia: top ideas etc
 console.log('LOGS',[...new Set(p.logs)].join(' || ')); await b.close();
 // kevin public
 ({b,p}=await L.open(1440,900)); await L.login(p,'kevin');
 await p.goto(L.B+'#/projects'); await p.waitForTimeout(600);
 const sw=p.locator('.fl-card:has-text("Canteen survey") .fl-switch'); console.log('kevin switch count', await p.locator('.fl-switch').count(), 'survey checked', await sw.isChecked());
 await sw.click(); await p.waitForTimeout(1200); console.log('toggled', await sw.isChecked(), 'toast', await p.locator('.fl-toast').innerText().catch(()=>'none')); await p.reload(); await p.waitForSelector('.fl-app'); await p.waitForTimeout(800); console.log('after reload', await p.locator('.fl-card:has-text("Canteen survey") .fl-switch').isChecked());
 await p.locator('.fl-card:has-text("Canteen survey") .fl-switch').click(); await p.waitForTimeout(1000);
 await L.shot(p,'kevin-projects-1440');
 await p.goto(L.B+'#/p/survey'); await p.waitForTimeout(500); console.log('project page switch',await p.locator('.fl-switch').count());
 console.log('LOGS',[...new Set(p.logs)].join(' || ')); await b.close();
 for(const r of ['sarah','raka','budi','michael']){ ({b,p}=await L.open(1440,900)); await L.login(p,r); await p.goto(L.B+'#/projects'); await p.waitForTimeout(500); const a=await p.locator('.fl-switch').count(); await p.goto(L.B+'#/projects?view=pipeline'); await p.waitForTimeout(500); console.log(r,'switch progress',a,'pipeline',await p.locator('.fl-switch').count(),'selects',await p.locator('.fl-board select').count()); await b.close(); }
})().catch(e=>{console.error(e.message.slice(0,600));process.exit(1)});
