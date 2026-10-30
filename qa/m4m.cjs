const L=require('./m4lib.cjs');
const rowsT=(p,sel)=>p.locator(sel).allInnerTexts().then(a=>a.map(x=>x.replace(/\n/g,' | ')));
(async()=>{
 let {b,p}=await L.open(1440,900); await L.login(p,'nadia');
 await p.click('.fl-user'); await p.click('text=Switch to admin view'); await p.waitForTimeout(800);
 // ending soon
 await p.goto(L.B+'#/admin/announcements'); await p.waitForTimeout(800);
 await p.click('[aria-label="Edit Alpha edited notice"]'); await p.fill('#an-end','2026-11-02'); await p.click('form button.fl-btn--red'); await p.waitForTimeout(900);
 await p.click('[aria-label="Edit Alpha edited notice"]'); await p.fill('#an-end','2026-10-01'); await p.click('form button.fl-btn--red'); console.log('edit end<start:', await p.locator('form .fl-error').innerText()); await p.click('button:has-text("Cancel")');
 await p.goto(L.B+'#/admin'); await p.waitForTimeout(1000); console.log('overview ending:', await p.locator('main').innerText().then(t=>t.includes('ends Mon 2 Nov')), await p.locator('.fl-row--attn').allInnerTexts().then(a=>a.map(x=>x.replace(/\n/g,' | '))));
 await L.shot(p,'nadia-admin-overview-1440');
 // archive
 await p.goto(L.B+'#/admin/announcements'); await p.waitForTimeout(800); await p.click('[aria-label="Archive Alpha edited notice"]'); await p.waitForTimeout(1000); console.log('after archive', await rowsT(p,'.fl-row--doc'), await p.locator('[role=status]').allInnerTexts());
 // approvals
 await p.goto(L.B+'#/admin/approvals'); await p.waitForTimeout(1200); await L.shot(p,'nadia-admin-approvals-1440'); console.log('pending:', await rowsT(p,'[aria-labelledby=pend-h] .fl-row--doc'));
 console.log('templates before:', await rowsT(p,'[aria-labelledby=tpl-h] .fl-row--doc'));
 await p.click('[aria-label="Approve Volunteer rota"]'); await p.waitForTimeout(1200); console.log('toast', await p.locator('[role=status]').allInnerTexts());
 await p.click('[aria-label="Approve Budget v3 <i>x</i>"]'); await p.waitForTimeout(1200); console.log('toast', await p.locator('[role=status]').allInnerTexts());
 await p.click('[aria-label="Reject Permission slip 2"]'); await p.waitForTimeout(1200);
 console.log('pending after:', await rowsT(p,'[aria-labelledby=pend-h] .fl-row--doc'));
 console.log('templates after:', await rowsT(p,'[aria-labelledby=tpl-h] .fl-row--doc'));
 console.log('archive:', await rowsT(p,'[aria-labelledby=arch-h] .fl-row--doc'));
 await L.shot(p,'nadia-admin-approvals-after-1440');
 // add template
 await p.click('text=Add a template'); await p.fill('#tp-name','Admin added'); await p.fill('#tp-url','https://evil.com/x'); await p.click('form button.fl-btn--red'); console.log('add non-google:', await p.locator('form .fl-error').innerText()); await p.fill('#tp-url','https://docs.google.com/document/d/1Admin/edit'); await p.click('form button.fl-btn--red'); await p.waitForTimeout(1000);
 console.log(p.logs.join('\n')); await b.close();
 ({b,p}=await L.open(1440,900)); await L.login(p,'raka'); await p.goto(L.B+'#/resources'); await p.waitForTimeout(1500);
 console.log('raka templates:', await rowsT(p,'[aria-labelledby=docs-h] .fl-row--doc')); console.log('raka subs:', await rowsT(p,'[aria-labelledby=subs-h] .fl-row--doc'));
 await L.shot(p,'raka-resources-after-1440');
 await p.goto(L.B+'#/week'); await p.click('.fl-bell, [aria-label*="otification"]'); console.log('raka bell has approval notice?', await p.locator('.fl-pop').first().innerText().then(t=>/approv|reject/i.test(t)));
 console.log(p.logs.join('\n')); await b.close();
 // public admin 1440 and blurb
 ({b,p}=await L.open(1440,900)); await L.login(p,'nadia'); await p.click('.fl-user'); await p.click('text=Switch to admin view'); await p.goto(L.B+'#/admin/public'); await p.waitForTimeout(1200);
 await p.fill('#blurb-carnival','x'.repeat(200)); console.log('blurb len',(await p.inputValue('#blurb-carnival')).length);
 await p.fill('#blurb-carnival','Carnival <b>blurb</b> & "q"'); await p.click('[aria-labelledby=pub-proj-h] button:has-text("Save")'); await p.waitForTimeout(800); console.log(await p.locator('[role=status]').allInnerTexts());
 await p.uncheck('input.fl-switch >> nth=1').catch(e=>console.log('uncheck fail')); await p.waitForTimeout(500);
 await p.click('button:has-text("Publish now")'); await p.waitForTimeout(1500);
 await L.shot(p,'nadia-admin-public-1440'); console.log(await p.locator('[aria-labelledby=pub-prev-h]').innerText().then(t=>t.replace(/\n/g,' | ')));
 console.log(p.logs.join('\n')); await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
