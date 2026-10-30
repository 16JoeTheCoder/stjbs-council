const L=require('./m4lib.cjs');
(async()=>{
 let {b,p}=await L.open(1440,900); await L.login(p,'raka');
 await p.goto(L.B+'#/ideas'); await p.waitForTimeout(1200); await L.shot(p,'raka-ideas-1440');
 const notes=()=>p.evaluate(()=>[...document.querySelectorAll('.fl-note')].map(n=>n.innerText.replace(/\n/g,' | ')));
 console.log(await notes());
 await p.fill('#idea','Pin test idea'); console.log('help', await p.locator('#idea-help').innerText()); await p.click('button:has-text("Pin idea")'); await p.waitForTimeout(1000);
 console.log('after pin', (await notes()).slice(0,2), 'input', JSON.stringify(await p.inputValue('#idea')));
 await p.fill('#idea','x'.repeat(200)); console.log('len',(await p.inputValue('#idea')).length); await p.fill('#idea','');
 // vote on 'Open mic lunch' (not voted by raka)
 const v=p.locator('.fl-note:has-text("Open mic") .fl-vote'); console.log('vote btn before', await v.getAttribute('aria-pressed'), await v.innerText());
 await v.click(); await p.waitForTimeout(700); console.log('after vote', await v.getAttribute('aria-pressed'), await v.innerText());
 await v.click(); await p.waitForTimeout(700); console.log('after unvote', await v.getAttribute('aria-pressed'), await v.innerText());
 // double click quick
 await v.dblclick(); await p.waitForTimeout(1200); console.log('after dblclick', await v.innerText());
 await p.reload(); await p.waitForTimeout(1500); console.log('reload', (await notes()).join('\n'));
 console.log('admin archive btn raka', await p.locator('button:has-text("Archive")').count());
 await p.goto(L.B+'#/week'); await p.waitForTimeout(1000); console.log('top ideas home', await p.locator('[aria-labelledby=ideas-h]').innerText().then(t=>t.replace(/\n/g,' | ')));
 console.log(p.logs.join('\n')); await b.close();
 ({b,p}=await L.open(1440,900)); await L.login(p,'budi'); await p.goto(L.B+'#/ideas'); await p.waitForTimeout(1200);
 console.log('budi form', await p.locator('#idea').count(), 'vote disabled', await p.locator('.fl-vote:disabled').count(), '/', await p.locator('.fl-vote').count()); await L.shot(p,'budi-ideas-1440'); await b.close();
 ({b,p}=await L.open(1440,900)); await L.login(p,'kevin'); await p.goto(L.B+'#/ideas'); await p.waitForTimeout(1200);
 console.log('kevin archive btns', await p.locator('button:has-text("Archive")').count());
 await p.locator('.fl-note:has-text("Pin test idea") button:has-text("Archive")').click(); await p.waitForTimeout(1000); console.log('after archive', (await notes()).filter(n=>n.includes('Pin test')).length, await p.locator('[role=status]').allInnerTexts());
 console.log(p.logs.join('\n')); await b.close();
 ({b,p}=await L.open(390,844)); await L.login(p,'raka'); await p.goto(L.B+'#/ideas'); await p.waitForTimeout(1200); await L.shot(p,'raka-ideas-390'); console.log('i390',JSON.stringify(await L.overflow(p))); await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
