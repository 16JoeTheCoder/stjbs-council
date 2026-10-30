const L=require('./flib.cjs');
const grid=p=>p.evaluate(()=>[...document.querySelectorAll('.fl-cal__allday > *, .fl-cal__grid .fl-ev, .fl-month .fl-ev')].map(e=>e.innerText.replace(/\n/g,' ')));
(async()=>{
 // 1 Make task
 let {b,p}=await L.open(1440,900); await L.login(p,'michael');
 await p.goto(L.B+'#/p/t1'); await p.waitForTimeout(1500);
 await p.click('text=Add comment').catch(()=>{});
 await p.click('#comment-box'); await p.keyboard.type('@Ra'); await p.keyboard.press('Enter'); await p.keyboard.type('final pass: confirm the ice supplier'); await p.click('button:has-text("Post comment")'); await p.waitForTimeout(1200);
 await p.locator('.fl-comment:has-text("ice supplier") button:has-text("Make task")').click(); await p.waitForTimeout(500);
 console.log('form:', await p.evaluate(()=>[...document.querySelectorAll('form.fl-form input,form.fl-form select')].map(i=>i.type+':'+(i.value||'')+(i.checked?'(chk)':'')).join(' ; ')));
 await L.shot(p,'maketask-form');
 await p.click('button:has-text("Add task")'); await p.waitForTimeout(1500); await b.close();
 ({b,p}=await L.open(1440,900)); await L.login(p,'raka'); await p.goto(L.B+'#/week'); await p.waitForTimeout(1200);
 console.log('Needs you:', await p.evaluate(()=>document.querySelector('main').innerText.slice(0,700).replace(/\n/g,' | '))); await L.shot(p,'raka-home-needsyou'); await b.close();
 // 2 far-month event
 ({b,p}=await L.open(1440,900)); await L.login(p,'kevin');
 await p.goto(L.B+'#/calendar?v=month&d=2027-06-10'); await p.waitForTimeout(1200);
 await p.click('text=Add event'); await p.waitForTimeout(300); await p.fill('#ev-title','June event <b>x</b> & "q"'); await p.fill('#ev-date','2027-06-10'); await p.fill('#ev-start','09:00'); await p.fill('#ev-end','10:00'); await p.click('form button.fl-btn--red'); await p.waitForTimeout(1800);
 console.log('Jun after add:', await grid(p)); await L.shot(p,'kevin-june-added');
 await p.locator('.fl-month .fl-ev').first().click().catch(()=>{}); await p.waitForTimeout(500);
 await p.click('button:has-text("Edit")').catch(()=>console.log('no edit')); await p.waitForTimeout(300); await p.fill('#ev-title','June edited'); await p.click('form button.fl-btn--red'); await p.waitForTimeout(1800);
 console.log('Jun after edit:', await grid(p));
 await p.locator('.fl-month .fl-ev').first().click().catch(()=>{}); await p.waitForTimeout(500);
 await p.click('button:has-text("Archive")').catch(()=>console.log('no archive')); await p.waitForTimeout(1800);
 console.log('Jun after archive:', await grid(p));
 await b.close();
 // 3 phone bell + search
 ({b,p}=await L.open(390,844)); await L.login(p,'raka');
 await p.click('.fl-bell, [aria-label*="otification"]'); await p.waitForTimeout(500); await L.shot(p,'phone-bell');
 console.log('bell box', await p.evaluate(()=>{const e=document.querySelector('.fl-pop');const r=e.getBoundingClientRect();return [r.left,r.right,innerWidth]}));
 await p.keyboard.press('Escape'); await p.goto(L.B+'#/week'); await p.waitForTimeout(500);
 await p.click('input[type=search], .fl-search input'); await p.keyboard.type('carn'); await p.waitForTimeout(600); await L.shot(p,'phone-search');
 console.log('search', await p.evaluate(()=>document.querySelector('.fl-search')?.innerText.replace(/\n/g,' | ').slice(0,400)));
 await p.keyboard.press('Escape'); await p.goto(L.B+'#/projects'); await p.waitForTimeout(800);
 console.log('projects head', await p.evaluate(()=>document.querySelector('main').innerText.slice(0,200).replace(/\n/g,' | ')));
 console.log(p.logs.filter(l=>!/Write|aborted/.test(l)));
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
