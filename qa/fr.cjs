const L=require('./flib.cjs');
const step=async(n,f)=>{try{const r=await f(); console.log('['+n+']',r===undefined?'ok':JSON.stringify(r).slice(0,600))}catch(e){console.log('['+n+'] FAIL',e.message.split('\n')[0].slice(0,160))}};
(async()=>{
 let {b,p}=await L.open(1440,900); p.setDefaultTimeout(3500); await L.login(p,'raka');
 await step('ideas',async()=>{await p.goto(L.B+'#/ideas'); await p.waitForTimeout(800); await p.fill('#idea','Longer <b>lunch</b> & "fun" '+'x'.repeat(200)); const v=(await p.inputValue('#idea')).length; await p.click('button:has-text("Pin idea")'); await p.waitForTimeout(900); await L.shot(p,'raka-ideas'); return [v,(await p.innerText('main')).includes('Longer <b>lunch')]});
 await step('vote',async()=>{const btn=p.locator('button[aria-label^="Vote for"]').first(); const l=await btn.getAttribute('aria-label'); await btn.click(); await p.waitForTimeout(800); const a=await p.locator(`button[aria-label^="Remove your vote"]`).count(); await p.locator('button[aria-label^="Remove your vote"]').first().click(); await p.waitForTimeout(800); return [l,a,await p.locator('button[aria-label^="Remove your vote"]').count()]});
 await b.close();
 ({b,p}=await L.open(1440,900)); p.setDefaultTimeout(3500); await L.login(p,'nadia');
 await step('menu admin',async()=>{await p.click('button.fl-user'); await p.click('[role=menuitem]:has-text("admin view")'); await p.waitForTimeout(700); await p.click('button.fl-user'); const m=await p.locator('[role=menu]').innerText(); await p.click('[role=menuitem]:has-text("member view")'); await p.waitForTimeout(600); return [m.replace(/\n/g,'|'),p.url()]});
 await step('signout',async()=>{await p.click('button.fl-user'); await p.click('[role=menuitem]:has-text("Sign out")'); await p.waitForTimeout(1500); const a=[await p.locator('#email').count()]; await p.goBack(); await p.waitForTimeout(1000); a.push(await p.locator('#email').count(),p.url()); await p.reload(); await p.waitForTimeout(1500); a.push(await p.locator('#email').count()); return a});
 await b.close();
})();
