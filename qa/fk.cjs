const L=require('./flib.cjs');
const step=async(n,f)=>{try{const r=await f(); console.log('['+n+']',r===undefined?'ok':JSON.stringify(r).slice(0,600))}catch(e){console.log('['+n+'] FAIL',e.message.split('\n')[0].slice(0,160))}};
const toast=p=>p.locator('[role=status]').allInnerTexts();
(async()=>{
 let {b,p}=await L.open(1440,900); p.setDefaultTimeout(3500); await L.login(p,'michael');
 await p.goto(L.B+'#/p/carnival'); await p.waitForTimeout(600);
 await step('drill',async()=>{await p.click('main a.fl-h3:has-text("Drinks")'); await p.waitForTimeout(700); return [p.url(), await p.innerText('main').then(t=>t.slice(0,200).replace(/\n/g,' | '))]});
 await step('blank task',async()=>{await p.click('button:has-text("Add task")'); await p.click('form button.fl-btn--red'); await p.waitForTimeout(300); return await p.locator('.fl-error').first().innerText()});
 await step('add task',async()=>{await p.fill('#f-title','Buy ice <i>"x"</i> & '+'long '.repeat(40)); await p.fill('#f-link','javascript:alert(1)'); await p.click('form button.fl-btn--red'); const e=await p.locator('.fl-error').first().innerText(); await p.fill('#f-link',''); await p.fill('#f-startDate','2026-11-10'); await p.fill('#f-dueDate','2026-11-05'); await p.click('form button.fl-btn--red'); const e2=await p.locator('.fl-error').first().innerText(); await p.fill('#f-dueDate','2026-11-12'); await p.click('form button.fl-btn--red'); await p.waitForTimeout(1200); return [e,e2,await p.innerText('main').then(t=>t.includes('Buy ice')), await toast(p)]});
 await L.shot(p,'michael-drinks-after');
 await step('archive+undo',async()=>{await p.click('main :text("Buy ice")'); await p.waitForTimeout(600); await L.shot(p,'michael-task'); const bt=await p.evaluate(()=>[...document.querySelectorAll('main button')].map(e=>e.innerText.trim()).filter(Boolean).join('|')); await p.click('button:has-text("Archive")'); await p.waitForTimeout(800); const t=await toast(p); const gone=!(await p.innerText('main')).includes('Buy ice'); await p.click('button:has-text("Undo")'); await p.waitForTimeout(900); return [bt,t,gone,p.url()]});
 await step('Edit task',async()=>{await p.goto(L.B+'#/p/carnival'); await p.waitForTimeout(700); return p.url()});
 await b.close();
 // nadia: subteam, lead change
 ({b,p}=await L.open(1440,900)); p.setDefaultTimeout(3500); await L.login(p,'nadia');
 await p.goto(L.B+'#/p/carnival'); await p.waitForTimeout(700);
 await step('add subteam',async()=>{await p.click('button:has-text("Add subteam")'); await p.fill('#f-title','Photography <script>alert(1)</script>'); await p.selectOption('#f-lead',{label:'Clara Gunawan'}).catch(async()=>{const o=await p.$$eval('#f-lead option',o=>o.map(x=>x.textContent)); console.log(o)}); await p.click('form button.fl-btn--red'); await p.waitForTimeout(1200); return [await p.innerText('main').then(t=>t.includes('Photography')), await toast(p)]});
 await step('lead change',async()=>{await p.click('main a.fl-h3:has-text("Photography")'); await p.waitForTimeout(600); await p.click('button:has-text("Edit subteam")'); const cur=await p.inputValue('#f-lead'); await p.selectOption('#f-lead',{index:3}); await p.click('form button.fl-btn--red'); await p.waitForTimeout(1200); return [cur, await p.innerText('main').then(t=>t.match(/Lead: [A-Za-z ]+/)?.[0]), await toast(p)]});
 await step('timeline',async()=>{await p.goto(L.B+'#/p/carnival?view=timeline'); await p.waitForTimeout(800); await L.shot(p,'nadia-timeline'); return await p.locator('.fl-tl, [class*=timeline]').count()});
 await step('team',async()=>{await p.goto(L.B+'#/p/carnival?view=team'); await p.waitForTimeout(800); await L.shot(p,'nadia-team'); return (await p.innerText('main')).slice(200,500).replace(/\n/g,' | ')});
 await step('deal edit',async()=>{await p.goto(L.B+'#/p/carnival'); await p.waitForTimeout(600); await p.click('main table a:has-text("Pocari")'); await p.waitForTimeout(500); await p.click('button:has-text("Edit task")'); await p.fill('#f-pledgedIdr','20000000'); await p.fill('#f-receivedIdr','5000000'); await p.selectOption('#f-stage','Committed').catch(()=>{}); await p.click('form button.fl-btn--red'); await p.waitForTimeout(1000); await p.goto(L.B+'#/p/carnival'); await p.waitForTimeout(700); return (await p.innerText('main')).match(/Total[^]{0,80}/)[0].replace(/\s+/g,' ')});
 await step('meeting',async()=>{await p.goto(L.B+'#/meeting/carnival'); await p.waitForTimeout(900); await L.shot(p,'nadia-meeting'); return (await p.innerText('main')).slice(0,300).replace(/\n/g,' | ')});
 await b.close();
 // raka: assignee edit
 ({b,p}=await L.open(1440,900)); p.setDefaultTimeout(3500); await L.login(p,'raka');
 await p.goto(L.B+'#/tasks'); await p.waitForTimeout(600);
 await step('raka edit',async()=>{await p.click('main :text("Order 400 cups")'); await p.waitForTimeout(600); await p.click('button:has-text("Edit task")'); const ids=await p.$$eval('form.fl-form [id^=f-]',e=>e.map(x=>x.id)); await L.shot(p,'raka-edit'); await p.selectOption('#f-status','doing'); await p.fill('#f-notes','Working on it <b>'); await p.click('form button.fl-btn--red'); await p.waitForTimeout(1000); return [ids, p.url()]});
 console.log(p.logs.filter(l=>!/Write|abort/.test(l)));
 await b.close();
})();
