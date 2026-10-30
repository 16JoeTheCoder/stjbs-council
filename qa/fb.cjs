const L=require('./flib.cjs');
(async()=>{
 for (const u of ['#/week','#/p/t1','#/calendar']){ const {b,p}=await L.open(); await p.goto('http://localhost:5173/'+u); await p.waitForTimeout(1500); console.log(u,'->',p.url()); await b.close(); }
 const {b,p}=await L.open(); await p.goto(L.B+'#/week'); await p.waitForSelector('#email');
 await p.fill('#email','raka@stjbs.sch.id'); 
 await p.click('button:has-text("Reset password")'); await p.waitForTimeout(500); console.log('mode1', (await p.innerText('form')).replace(/\n+/g,' | '));
 await p.click('form button.fl-btn--red'); await p.waitForTimeout(1500); console.log('reset sent:', (await p.innerText('form')).replace(/\n+/g,' | ')); await L.shot(p,'signin-reset-sent');
 await p.fill('#email','x'); await p.click('form button.fl-btn--red'); await p.waitForTimeout(700); console.log('reset invalid:', (await p.innerText('form')).replace(/\n+/g,' | '));
 await p.fill('#email','ghost@stjbs.sch.id'); await p.click('form button.fl-btn--red'); await p.waitForTimeout(1200); console.log('reset ghost:', (await p.innerText('form')).replace(/\n+/g,' | '));
 await b.close();
})();
