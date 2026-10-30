const L=require('./m4lib.cjs');
(async()=>{
 // Part 1 at 390
 let {b,p}=await L.open(390,844); await L.login(p,'raka');
 console.log('search close visible (closed):', await p.evaluate(()=>{const e=document.querySelector('.fl-search__close');if(!e)return 'none';const r=e.getBoundingClientRect();const cs=getComputedStyle(e);return JSON.stringify({d:cs.display,w:r.width,h:r.height,vis:cs.visibility})}));
 await L.shot(p,'raka-home-390');
 await p.click('[aria-label*="otification"], .fl-bell'); await p.waitForTimeout(500);
 console.log('bell pop:', await p.evaluate(()=>{const e=document.querySelector('.fl-pop, [role=dialog], .fl-bellpop');return [...document.querySelectorAll('.fl-pop,.fl-popover,[class*=bell]')].map(e=>{const r=e.getBoundingClientRect();return e.className+' '+Math.round(r.left)+','+Math.round(r.right)}).join(' | ')}));
 await L.shot(p,'raka-bell-390');
 await p.keyboard.press('Escape');
 await p.goto(L.B+'#/projects'); await p.waitForTimeout(800);
 console.log('projects title:', await p.locator('h1').first().innerText(), '|', await p.locator('main').innerText().then(t=>t.slice(0,300)));
 await L.shot(p,'raka-projects-390'); console.log(p.logs.join('\n')); await b.close();
 // (d)
 ({b,p}=await L.open(1440,900)); await L.login(p,'kevin');
 await p.click('.fl-user'); await p.click('text=Switch to admin view'); await p.waitForTimeout(800);
 console.log('admin url',p.url(),'badge',await p.locator('text=Admin view').count());
 await p.goto(L.B+'#/projects'); await p.waitForTimeout(800);
 console.log('member route in admin pref: badge', await p.locator('.fl-badge:has-text("Admin view"), .fl-adminbadge, :text("Admin view")').count(), 'rail', await p.locator('aside, nav').first().innerText().then(t=>t.replace(/\n/g,' | ').slice(0,200)));
 await L.shot(p,'kevin-projects-adminpref-1440');
 await p.goto(L.B+'#/week'); await p.waitForTimeout(800); await p.reload(); await p.waitForTimeout(1500);
 console.log('home url',p.url(), 'rail', await p.locator('aside, nav').first().innerText().then(t=>t.replace(/\n/g,' | ').slice(0,200)));
 await L.shot(p,'kevin-home-adminpref-1440');
 console.log(p.logs.join('\n')); await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
