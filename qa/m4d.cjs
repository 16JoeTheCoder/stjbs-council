const L=require('./m4lib.cjs');
const grid=p=>p.evaluate(()=>[...document.querySelectorAll('.fl-cal__allday > *, .fl-cal__grid .fl-ev, .fl-month .fl-ev')].map(e=>e.innerText.replace(/\n/g,' ')));
async function add(p,o){ await p.click('text=Add event'); await p.waitForTimeout(300); await p.fill('#ev-title',o.title); await p.fill('#ev-date',o.date); await p.fill('#ev-start',o.start); await p.fill('#ev-end',o.end); if(o.pub){await p.check('text=Show on the public website')} await p.click('form button.fl-btn--red'); await p.waitForTimeout(1200); }
(async()=>{
 let {b,p}=await L.open(1440,900); await L.login(p,'kevin');
 await p.goto(L.B+'#/calendar?d=2026-11-23'); await p.waitForTimeout(1200);
 console.log('wk Nov23 (due marker):', await grid(p)); await L.shot(p,'kevin-cal-nov23-1440');
 await p.goto(L.B+'#/calendar'); await p.waitForTimeout(1000);
 await p.click('text=Add event'); console.log('public cb as vp:', await p.locator('text=Show on the public website').count()); await p.click('button:has-text("Cancel")');
 await add(p,{title:'Kevin public evening',date:'2026-10-31',start:'18:30',end:'20:00',pub:true});
 console.log('wk after add:', await grid(p));
 await L.shot(p,'kevin-cal-evening-1440');
 // sheet shows Public tag
 await p.click('.fl-cal__allday button:has-text("Kevin public")'); await p.waitForTimeout(600); console.log('sheet:', (await p.locator('[role=dialog]').first().innerText()).replace(/\n/g,' | ')); 
 await p.keyboard.press('Escape');
 // year boundary events
 await add(p,{title:'NYE party',date:'2026-12-31',start:'10:00',end:'11:00'});
 await add(p,{title:'NY day',date:'2027-01-01',start:'10:00',end:'11:00'});
 await p.goto(L.B+'#/calendar?v=month&d=2026-12-15'); await p.waitForTimeout(1200);
 console.log('Dec month events:', await grid(p)); await L.shot(p,'kevin-cal-dec-events-1440');
 await p.click('[aria-label="Next month"]'); await p.waitForTimeout(1500);
 console.log('Jan month events:', await grid(p)); await L.shot(p,'kevin-cal-jan-events-1440');
 await p.goto(L.B+'#/calendar?v=week&d=2026-12-28'); await p.waitForTimeout(1200);
 console.log('wk Dec28:', await grid(p)); await L.shot(p,'kevin-cal-wk-dec28-1440');
 // add event in far future month (outside store window) while viewing it
 await p.goto(L.B+'#/calendar?v=month&d=2027-03-10'); await p.waitForTimeout(1200);
 await p.click('text=Add event'); await p.waitForTimeout(300); await p.fill('#ev-title','March event'); await p.fill('#ev-date','2027-03-10'); await p.click('form button.fl-btn--red'); await p.waitForTimeout(1500);
 console.log('Mar month after add (should show):', await grid(p));
 // special-chars month cell
 await p.goto(L.B+'#/calendar?v=month&d=2026-10-15'); await p.waitForTimeout(1000); console.log('oct month:', await grid(p)); await L.shot(p,'kevin-cal-oct-month');
 // edit someone else's event as kevin (creator of seed) => Edit visible; public toggle edit
 console.log(p.logs.join('\n')); await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
