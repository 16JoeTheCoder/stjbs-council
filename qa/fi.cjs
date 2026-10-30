const L=require('./flib.cjs');
const step=async(n,f)=>{try{const r=await f(); console.log('['+n+']',r===undefined?'ok':JSON.stringify(r).slice(0,400))}catch(e){console.log('['+n+'] FAIL',e.message.split('\n')[0].slice(0,160))}};
(async()=>{
 let {b,p}=await L.open(1440,900); p.setDefaultTimeout(3500); await L.login(p,'michael');
 await p.goto(L.B+'#/tasks'); await p.waitForTimeout(600);
 for (const c of ['All','Mine','Due soon','Overdue','Blocked','Done']) await step('chip '+c,async()=>{const btn=p.locator('main button',{hasText:new RegExp('^'+c+'\\s*\\d')}).first(); const t=(await btn.innerText()).replace(/\n/g,' '); await btn.click(); await p.waitForTimeout(250); const rows=await p.locator('main li, main .fl-task').count(); return [t,'rows',rows]});
 // tick/untick
 await p.goto(L.B+'#/p/carnival'); await p.waitForTimeout(800);
 await step('tick',async()=>{const cb=p.locator('main input[type=checkbox]').first(); const before=await cb.isChecked(); await cb.click(); await p.waitForTimeout(700); const h1=await p.innerText('main'); await cb.click(); await p.waitForTimeout(700); return [before, (h1.match(/\d+%/)||[])[0], (await p.innerText('main')).match(/\d+%/)[0]]});
 // add task
 await step('add task',async()=>{await p.goto(L.B+'#/p/carnival'); await p.waitForTimeout(500); await p.click('button:has-text("Add task"), a:has-text("Add task")'); await p.waitForTimeout(400); await L.shot(p,'michael-addtask'); return await p.evaluate(()=>[...document.querySelectorAll('form.fl-form label')].map(l=>l.innerText.replace(/\n/g,' ').slice(0,25)).join(' | '))});
 console.log(await p.evaluate(()=>[...document.querySelectorAll('button,a.fl-btn')].map(e=>e.innerText.trim()).filter(x=>x).slice(0,40).join(' | ')));
 await b.close();
})();
