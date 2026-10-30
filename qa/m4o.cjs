const L=require('./m4lib.cjs');
(async()=>{
 let {b,p}=await L.open(1440,900); await L.login(p,'ariel');
 await p.click('.fl-user'); await p.click('text=Switch to admin view'); await p.waitForTimeout(600);
 await p.goto(L.B+'#/projects'); await p.reload(); await p.waitForTimeout(1500); console.log('cold #/projects with admin pref ->', p.url());
 await p.goto(L.B+'#/admin/members'); await p.waitForTimeout(800); await p.goto(L.B+'#/calendar'); await p.waitForTimeout(800); console.log('in-app nav to calendar, admin badge:', await p.locator('text=ADMIN VIEW').count(), p.url());
 for (const q of ['Carnival night','Budget','volunteer','Open house','Quiet study']){ await p.goto(L.B+'#/week'); await p.keyboard.press('/'); await p.keyboard.type(q); await p.waitForTimeout(500); console.log(q,'->',await p.locator('[role=listbox], .fl-results').first().innerText().then(t=>t.replace(/\n/g,' | ').slice(0,200)).catch(()=>'none')); await p.keyboard.press('Escape'); }
 console.log(p.logs.join('\n')); await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
