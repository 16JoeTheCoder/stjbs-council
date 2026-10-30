const { chromium } = require('playwright');
const U='http://localhost:5173/', SD='/home/user/stjbs-council/qa/screens-m2/';
(async()=>{
 const b=await chromium.launch();
 let ctx=await b.newContext({viewport:{width:1440,height:900}}); let p=await ctx.newPage();
 const logs=[]; p.on('console',m=>{if(['error','warning'].includes(m.type()))logs.push(m.text())}); p.on('pageerror',e=>logs.push('pe '+e.message));
 await p.goto(U); await p.waitForTimeout(1200);
 const order=[]; for(let i=0;i<12;i++){await p.keyboard.press('Tab'); order.push(await p.evaluate(()=>{const e=document.activeElement;return (e.tagName+':'+(e.textContent||'').trim().slice(0,22))}));}
 console.log('tab order',order);
 await p.evaluate(()=>{document.activeElement.blur();scrollTo(0,0)});
 const card=p.locator('.fl-ann-card').first(); await card.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(600);
 console.log('sheet open',await p.locator('[role=dialog]').count(),'focus in',await p.evaluate(()=>document.activeElement.className+'|'+document.activeElement.tagName));
 await p.screenshot({path:SD+'pub-d-sheet.png'});
 await p.keyboard.press('Tab'); console.log('tab inside',await p.evaluate(()=>document.activeElement.textContent.slice(0,20)+'|'+!!document.activeElement.closest('[role=dialog]')));
 await p.keyboard.press('Escape'); await p.waitForTimeout(500);
 console.log('after esc dialogs',await p.locator('[role=dialog]').count(),'focus',await p.evaluate(()=>document.activeElement.className));
 // light
 await p.evaluate(()=>localStorage.setItem('council-theme','light')); await p.reload(); await p.waitForTimeout(1200);
 console.log('theme',await p.evaluate(()=>document.documentElement.dataset.theme));
 await p.screenshot({path:SD+'pub-d-light-full.png',fullPage:true});
 await p.setViewportSize({width:390,height:844}); await p.waitForTimeout(300); await p.screenshot({path:SD+'pub-m-light.png',fullPage:true});
 console.log('logs',logs); await ctx.close();
 // redirects
 for (const h of ['#/week','#/p/carnival','#live','#/']) { const c=await b.newContext(); const q=await c.newPage(); await q.goto(U+h); await q.waitForTimeout(1500); console.log(h,'->',q.url()); await c.close(); }
 await b.close();
})();
