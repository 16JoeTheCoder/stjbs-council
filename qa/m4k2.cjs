const L=require('./m4lib.cjs');
(async()=>{
 let b,p;
 // phone
 ({b,p}=await L.open(390,844)); await L.login(p,'nadia'); await p.click('.fl-user').catch(()=>{}); await p.click('text=Switch to admin view'); await p.waitForTimeout(1000);
 await L.shot(p,'nadia-admin-overview-390'); console.log('ov390',JSON.stringify(await L.overflow(p)));
 console.log('link list', await p.evaluate(()=>[...document.querySelectorAll('nav.fl-more a')].map(a=>a.innerText+'>'+a.getAttribute('href'))));
 console.log('tabbar', await p.evaluate(()=>[...document.querySelectorAll('.fl-tabbar a, .fl-tabbar button, nav[aria-label*=Main] *')].map(a=>a.innerText||a.getAttribute('aria-label')).filter(Boolean)));
 const more=p.locator('button[aria-label=More]'); await more.click(); await p.waitForTimeout(500); await L.shot(p,'nadia-more-admin-390');
 console.log('more sheet', await p.locator('[role=dialog]').first().innerText().then(t=>t.replace(/\n/g,' | ')));
 for (const s of ['Announcements','Public site','Approvals and archive','Check-ins and workload','Digest','Members and roles']) { await p.locator('[role=dialog] a:has-text("'+s+'")').first().click().catch(e=>console.log('click fail',s)); await p.waitForTimeout(900); console.log(s,'->',p.url(), await p.locator('h1').first().innerText().catch(()=>'')); await L.shot(p,'nadia-admin-'+s.replace(/\W+/g,'')+'-390'); console.log(JSON.stringify(await L.overflow(p))); await p.locator('button[aria-label=More]').click(); await p.waitForTimeout(400); }
 console.log(p.logs.join('\n')); await b.close();
 for (const n of ['raka','budi','sarah']) { ({b,p}=await L.open(1440,900)); await L.login(p,n); await p.goto(L.B+'#/admin'); await p.waitForTimeout(1000); const t=await p.locator('main').innerText(); console.log(n,'#/admin:',t.slice(0,80).replace(/\n/g,' '),'| rail', await p.locator('text=Admin view').count()); for (const r of ['announcements','public','approvals','members','workload','digest']){ await p.goto(L.B+'#/admin/'+r); await p.waitForTimeout(500); console.log('  ',r, (await p.locator('main').innerText()).slice(0,50).replace(/\n/g,' ')); } console.log(p.logs.join('\n')); await b.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
