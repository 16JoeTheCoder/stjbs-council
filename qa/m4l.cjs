const L=require('./m4lib.cjs');
const {chromium}=require('playwright');
const pub=async(b)=>{const c=await b.newContext({viewport:{width:1440,height:900}});const q=await c.newPage();await q.goto('http://localhost:5173/');await q.waitForTimeout(2000);const t=await q.locator('body').innerText();await q.screenshot({path:'qa/screens-m4/public-site.png',fullPage:true});await c.close();return t;};
(async()=>{
 let {b,p}=await L.open(1440,900); await L.login(p,'kevin');
 await p.click('.fl-user'); await p.click('text=Switch to admin view'); await p.waitForTimeout(800);
 await p.goto(L.B+'#/admin/announcements'); await p.waitForTimeout(1000); await L.shot(p,'kevin-admin-ann-1440');
 console.log('list:', await p.locator('.fl-row--doc').allInnerTexts().then(a=>a.map(x=>x.replace(/\n/g,' | '))));
 await p.click('text=New announcement'); await p.waitForTimeout(300);
 await p.click('form button.fl-btn--red'); console.log('blank:', await p.locator('form .fl-error').innerText());
 await p.fill('#an-title','Alpha everyone notice'); await p.fill('#an-start','2026-11-05'); await p.fill('#an-end','2026-11-01'); await p.click('form button.fl-btn--red'); console.log('end<start:', await p.locator('form .fl-error').innerText());
 console.log('audience default checked:', await p.locator('input[name=aud]:checked').evaluate(e=>e.parentElement.innerText));
 await p.check('text=Everyone (also shown on the public website)'); await p.fill('#an-start','2026-10-30'); await p.fill('#an-end','2026-11-03'); await p.fill('#an-body','Line one\n\nLine <b>two</b> & more 😀'); await p.click('form button.fl-btn--red'); await p.waitForTimeout(1200);
 console.log('after post', await p.locator('[role=status]').allInnerTexts()); await L.shot(p,'kevin-admin-ann-after-1440');
 // overview ending soon
 await p.goto(L.B+'#/admin'); await p.waitForTimeout(1000); console.log('overview:', await p.locator('main').innerText().then(t=>t.replace(/\n/g,' | ').slice(0,700)));
 // public before publish
 let t=await pub(b); console.log('public before publish has notice:', t.includes('Alpha everyone notice'));
 await p.goto(L.B+'#/admin/public'); await p.waitForTimeout(1200); console.log('public admin:', await p.locator('main').innerText().then(t=>t.replace(/\n/g,' | ').slice(0,900)));
 await L.shot(p,'kevin-admin-public-1440');
 await p.click('button:has-text("Publish now")'); await p.waitForTimeout(1500); console.log('toast', await p.locator('[role=status]').allInnerTexts());
 console.log('last published:', await p.locator('main p').first().innerText());
 t=await pub(b); console.log('public after publish has notice:', t.includes('Alpha everyone notice')); console.log(t.slice(0,1500).replace(/\n/g,' | '));
 // home as member shows it
 await p.goto(L.B+'#/week'); await p.waitForTimeout(1000);
 console.log('home banner:', (await p.locator('main').innerText()).includes('Alpha everyone notice'), await p.locator('main').innerText().then(t=>t.slice(0,500).replace(/\n/g,' | ')));
 await L.shot(p,'kevin-home-3ann-1440');
 // edit
 await p.goto(L.B+'#/admin/announcements'); await p.waitForTimeout(800);
 await p.click('[aria-label="Edit Alpha everyone notice"]'); await p.fill('#an-title','Alpha edited notice'); await p.click('form button.fl-btn--red'); await p.waitForTimeout(1000);
 console.log('after edit list', await p.locator('.fl-row--doc').allInnerTexts().then(a=>a.map(x=>x.replace(/\n/g,' | '))));
 console.log(p.logs.join('\n')); await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
