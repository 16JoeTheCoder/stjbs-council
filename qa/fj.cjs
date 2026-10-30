const L=require('./flib.cjs');
const step=async(n,f)=>{try{const r=await f(); console.log('['+n+']',r===undefined?'ok':JSON.stringify(r).slice(0,500))}catch(e){console.log('['+n+'] FAIL',e.message.split('\n')[0].slice(0,160))}};
const btns=p=>p.evaluate(()=>[...document.querySelectorAll('main button,main a.fl-btn')].map(e=>(e.getAttribute('aria-label')||e.innerText).trim().replace(/\n/g,' ')).filter(Boolean).join(' | '));
(async()=>{
 let {b,p}=await L.open(1440,900); p.setDefaultTimeout(3500); await L.login(p,'michael');
 await p.goto(L.B+'#/p/carnival'); await p.waitForTimeout(600);
 await step('drill Drinks',async()=>{await p.click('main a:has-text("Drinks"), main .fl-card:has-text("Drinks")'); await p.waitForTimeout(700); return [p.url(), await btns(p)]});
 await L.shot(p,'michael-drinks');
 await step('add task',async()=>{await p.click('button:has-text("Add task"), a:has-text("Add task")'); await p.waitForTimeout(400); await p.fill('form.fl-form input[type=text], form.fl-form input:not([type])', 'Buy ice <i>"x"</i> & '+'long '.repeat(60)); await L.shot(p,'michael-addtask'); await p.click('form button.fl-btn--red'); await p.waitForTimeout(1200); return [await p.innerText('main').then(t=>t.includes('Buy ice')), await p.locator('[role=status]').allInnerTexts()]});
 await step('blank task',async()=>{await p.click('button:has-text("Add task"), a:has-text("Add task")'); await p.waitForTimeout(300); const dis=await p.locator('form button.fl-btn--red').isDisabled(); await p.keyboard.press('Escape'); return dis});
 await step('archive+undo',async()=>{await p.waitForTimeout(300); const row=p.locator('main li:has-text("Buy ice"), main .fl-row:has-text("Buy ice")').first(); await row.click(); await p.waitForTimeout(600); const bt=await btns(p); await p.click('button:has-text("Archive")'); await p.waitForTimeout(800); const toast=await p.locator('[role=status]').allInnerTexts(); await p.click('button:has-text("Undo")'); await p.waitForTimeout(800); return [bt,toast,p.url()]});
 console.log(p.logs.filter(l=>!/Write|abort/.test(l)));
 await b.close();
})();
