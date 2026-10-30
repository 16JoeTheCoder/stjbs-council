const L=require('./m4lib.cjs');
(async()=>{
 let {b,p}=await L.open(1440,900); await L.login(p,'raka'); await p.goto(L.B+'#/resources'); await p.waitForTimeout(1500);
 console.log('budget copy href', await p.locator('.fl-row--doc:has-text("Budget sheet") a').getAttribute('href')); await b.close();
 ({b,p}=await L.open(1440,900)); await L.login(p,'nadia'); await p.click('.fl-user'); await p.click('text=Switch to admin view'); await p.goto(L.B+'#/admin/public'); await p.waitForTimeout(1200);
 await p.fill('#blurb-carnival','Carnival <b>blurb</b> & "q"'); await p.click('#blurb-carnival + button'); await p.waitForTimeout(800); console.log(await p.locator('[role=status]').allInnerTexts());
 await p.locator('.fl-proj:has-text("Welcome week") input.fl-switch').uncheck(); await p.waitForTimeout(600);
 await p.click('button:has-text("Publish now")'); await p.waitForTimeout(1500);
 await L.shot(p,'nadia-admin-public-1440'); console.log(await p.locator('[aria-labelledby=pub-prev-h]').innerText().then(t=>t.replace(/\n/g,' | ')));
 const c=await b.newContext({viewport:{width:390,height:844}}); const q=await c.newPage(); await q.goto('http://localhost:5173/'); await q.waitForTimeout(2000); await q.screenshot({path:'qa/screens-m4/public-site-390.png',fullPage:true}); const t=await q.locator('body').innerText(); console.log('public has Welcome:', t.includes('Welcome week'), 'blurb:', t.includes('Carnival <b>blurb</b>'));
 await p.locator('.fl-proj:has-text("Welcome week") input.fl-switch').check(); await p.click('button:has-text("Publish now")'); await p.waitForTimeout(1200);
 await p.goto(L.B+'#/admin/members'); await p.waitForTimeout(800); await L.shot(p,'nadia-admin-members-1440');
 await p.goto(L.B+'#/admin/workload'); await p.waitForTimeout(1500); await L.shot(p,'nadia-admin-workload-1440'); console.log('workload:', await p.locator('main').innerText().then(t=>t.slice(0,700).replace(/\n/g,' | ')));
 await p.goto(L.B+'#/admin/digest'); await p.waitForTimeout(1000); await L.shot(p,'nadia-admin-digest-1440');
 console.log(p.logs.join('\n')); await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
