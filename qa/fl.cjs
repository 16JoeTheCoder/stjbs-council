const L=require('./flib.cjs');
const step=async(n,f)=>{try{const r=await f(); console.log('['+n+']',r===undefined?'ok':JSON.stringify(r).slice(0,700))}catch(e){console.log('['+n+'] FAIL',e.message.split('\n')[0].slice(0,160))}};
const toast=p=>p.locator('[role=status]').allInnerTexts();
const btns=p=>p.evaluate(()=>[...document.querySelectorAll('main button,main a.fl-btn')].map(e=>(e.getAttribute('aria-label')||e.innerText).trim().replace(/\n/g,' ')).filter(Boolean).join(' | '));
(async()=>{
 let {b,p}=await L.open(1440,900); p.setDefaultTimeout(3500); await L.login(p,'raka');
 await p.goto(L.B+'#/p/t1'); await p.waitForTimeout(800); console.log('raka t1 btns:',await btns(p)); await L.shot(p,'raka-t1');
 await b.close();
 ({b,p}=await L.open(1440,900)); p.setDefaultTimeout(3500); await L.login(p,'michael');
 await p.goto(L.B+'#/p/drinks'); await p.waitForTimeout(800);
 const href=await p.$$eval('main a',a=>a.filter(x=>x.innerText.includes('Buy ice')).map(x=>x.getAttribute('href'))); console.log(href);
 await p.goto(L.B+'#/p/t1'); await p.waitForTimeout(800); console.log('michael t1:',await btns(p));
 await step('edit btn',async()=>{await p.click('button:has-text("Edit task"), button:has-text("Update task"), a:has-text("Edit")'); await p.waitForTimeout(400); return await p.$$eval('form.fl-form [id^=f-]',e=>e.map(x=>x.id))});
 await b.close();
})();
