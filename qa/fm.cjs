const L=require('./flib.cjs');
const step=async(n,f)=>{try{const r=await f(); console.log('['+n+']',r===undefined?'ok':JSON.stringify(r).slice(0,700))}catch(e){console.log('['+n+'] FAIL',e.message.split('\n')[0].slice(0,160))}};
const toast=p=>p.locator('[role=status]').allInnerTexts();
(async()=>{
 let {b,p}=await L.open(1440,900); p.setDefaultTimeout(3500); await L.login(p,'raka');
 await step('raka edit',async()=>{await p.goto(L.B+'#/p/t1'); await p.waitForTimeout(700); await p.click('button:has-text("Update task")'); const ids=await p.$$eval('form.fl-form [id^=f-],form.fl-form input[type=checkbox]',e=>e.map(x=>x.id||'cb')); await L.shot(p,'raka-edit'); await p.selectOption('#f-status','doing'); await p.fill('#f-notes','Working <b>on</b> it'); await p.click('form button.fl-btn--red'); await p.waitForTimeout(1000); return [ids, await toast(p)]});
 await step('raka status after',async()=>{await p.goto(L.B+'#/tasks'); await p.waitForTimeout(600); return (await p.innerText('main')).match(/Order 400 cups[^]{0,80}/)[0].replace(/\n/g,' ')});
 await b.close();
 ({b,p}=await L.open(1440,900)); p.setDefaultTimeout(3500); await L.login(p,'michael');
 await step('archive/undo',async()=>{await p.goto(L.B+'#/p/WWvujtSWaQtHbREa3fop'); await p.waitForTimeout(700); await p.click('button:has-text("Update task")'); await p.click('button:has-text("Archive task")'); await p.waitForTimeout(1000); const t=await toast(p); const html=await p.evaluate(()=>[...document.querySelectorAll('[role=status] button')].map(x=>x.innerText)); const gone=!(await p.innerText('main')).includes('Buy ice'); await L.shot(p,'michael-archived'); await p.click('[role=status] button:has-text("Undo")'); await p.waitForTimeout(1000); await p.goto(L.B+'#/p/drinks'); await p.waitForTimeout(700); return [t,html,gone,(await p.innerText('main')).includes('Buy ice')]});
 await b.close();
 // checkin
 ({b,p}=await L.open(1440,900)); p.setDefaultTimeout(3500); await L.login(p,'raka');
 await step('checkin',async()=>{await p.goto(L.B+'#/week'); await p.waitForTimeout(600); const panel=await p.locator('.fl-panel--red, .fl-checkin, :text("Check in")').first().innerText().catch(()=>'none'); await L.shot(p,'raka-home-1440'); await p.goto(L.B+'#/checkin'); await p.waitForTimeout(500); const ta=p.locator('main textarea'); await ta.nth(0).fill('Did <b>x</b> & "y" '+'z'.repeat(1200)); await ta.nth(1).fill('Next'); await p.click('button:has-text("Submit check-in")'); await p.waitForTimeout(1200); const t=await toast(p); await p.goto(L.B+'#/week'); await p.waitForTimeout(600); const hm=await p.innerText('main'); await p.goto(L.B+'#/checkin'); await p.waitForTimeout(500); const v=await p.locator('main textarea').nth(0).inputValue(); return [panel.slice(0,80),t,hm.includes('Edit check-in'),v.length,p.url()]});
 await step('refresh mid-flow',async()=>{await p.goto(L.B+'#/p/t1'); await p.click('button:has-text("Update task")'); await p.fill('#f-notes','draft'); await p.reload(); await p.waitForTimeout(2000); return [p.url(), await p.locator('form.fl-form').count()]});
 await b.close();
 ({b,p}=await L.open(1440,900)); p.setDefaultTimeout(3500); await L.login(p,'budi');
 await step('budi',async()=>{await p.goto(L.B+'#/p/t1'); await p.waitForTimeout(700); const bt=await p.evaluate(()=>[...document.querySelectorAll('main button,main input,main textarea')].map(e=>e.tagName+':'+(e.innerText||e.id||e.name)).join('|')); await p.goto(L.B+'#/week'); await p.waitForTimeout(600); return [bt,(await p.innerText('main')).slice(0,300).replace(/\n/g,' | ')]});
 await b.close();
})();
