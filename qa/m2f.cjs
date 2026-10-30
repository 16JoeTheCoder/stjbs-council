const { chromium } = require('playwright');
const {mk,login}=require('./m2c.cjs');
const SD='/home/user/stjbs-council/qa/screens-m2/';
(async()=>{const b=await chromium.launch();
 for (const w of [1280,390]) {
 let {p}=await mk(b,w); await login(p,'raka');
 const bell=async()=>p.evaluate(()=>{const e=[...document.querySelectorAll('a,button')].find(x=>/notif|bell/i.test((x.getAttribute('aria-label')||'')+x.className));return e?(e.getAttribute('aria-label')+'|'+e.textContent):'nobell'});
 console.log(w,'bell',await bell(),'url',p.url());
 await p.screenshot({path:SD+`app-raka-${w}.png`});
 await p.goto('http://localhost:5173/app/#/projects'); await p.waitForTimeout(1200); console.log('projects',(await p.innerText('main')).replace(/\n/g,' | ').slice(0,200));
 await p.goto('http://localhost:5173/app/#/week'); await p.waitForTimeout(1000);
 const cb=p.locator('label:has-text("Done: Order 400 cups") input').first(); const was=await cb.isChecked(); await cb.evaluate(e=>e.click()); await p.waitForTimeout(1000); console.log('toggle',was,'->',await p.locator('label:has-text("Done: Order 400 cups") input').first().isChecked().catch(()=> 'gone'));
 await p.goto('http://localhost:5173/app/#/people/raka@stjbs.sch.id'); await p.waitForTimeout(1200);
 await p.screenshot({path:SD+`app-raka-profile-${w}.png`});
 await p.click('text=Sign out'); await p.waitForTimeout(1500); console.log('signed out ->',(await p.innerText('body')).slice(0,150).replace(/\n/g,' | '));
 await p.fill('input[type=email]','raka@stjbs.sch.id');await p.fill('input[type=password]','council123');await p.click('form button[type=submit], form button.jy-btn');await p.waitForTimeout(2500);
 console.log('back in',(await p.innerText('body')).slice(0,120).replace(/\n/g,' | '),await bell());
 console.log(w,'logs',p.logs);
 // wrong role route
 await p.goto('http://localhost:5173/app/#/admin'); await p.waitForTimeout(1000); console.log('admin as raka',(await p.innerText('main')).slice(0,100).replace(/\n/g,' '));
 }
 // signed-out
 let s=await mk(b); await s.p.goto('http://localhost:5173/app/#/p/carnival'); await s.p.waitForTimeout(1500); console.log('signed out deep link',(await s.p.innerText('body')).slice(0,100).replace(/\n/g,' | '),s.p.logs);
 await b.close();})();
