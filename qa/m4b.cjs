const L=require('./m4lib.cjs');
(async()=>{
 let {b,p}=await L.open(1440,900); await L.login(p,'raka');
 await p.goto(L.B+'#/calendar'); await p.waitForTimeout(1500);
 await L.shot(p,'raka-cal-week-1440');
 const info=await p.evaluate(()=>({h1:document.querySelector('h1').innerText, allday:[...document.querySelectorAll('.fl-cal__allday > *')].map(e=>e.innerText.replace(/\n/g,' ')), grid:[...document.querySelectorAll('.fl-cal__grid .fl-ev')].map(e=>e.innerText.replace(/\n/g,' ')), hours:[...document.querySelectorAll('.fl-cal__hour')].map(e=>e.innerText).join(','), days:[...document.querySelectorAll('.fl-cal__day')].map(e=>e.innerText.replace(/\n/g,'')).join(','), up:[...document.querySelectorAll('.fl-up')].map(e=>e.innerText.replace(/\n/g,' / ')) }));
 console.log(JSON.stringify(info,null,1));
 console.log(await p.locator('.fl-hero.fl-stage').innerText().catch(()=>'no featured'));
 // next week
 await p.click('[aria-label="Next week"]'); await p.waitForTimeout(800);
 console.log('next week:', await p.locator('h1').innerText(), await p.evaluate(()=>[...document.querySelectorAll('.fl-cal__allday > *, .fl-cal__grid .fl-ev')].map(e=>e.innerText.replace(/\n/g,' '))));
 await L.shot(p,'raka-cal-nextweek-1440');
 // Month
 await p.click('text=Month'); await p.waitForTimeout(800);
 console.log('month:', await p.locator('h1').innerText()); await L.shot(p,'raka-cal-month-1440');
 console.log(await p.evaluate(()=>[...document.querySelectorAll('.fl-month:not(.fl-month--head) > div')].filter(d=>d.querySelector('button,a')).map(d=>d.innerText.replace(/\n/g,' ; '))));
 // navigate months: forward to Dec, Jan
 const lab=async()=>(await p.locator('h1').innerText()).replace(/\n/g,' ');
 await p.click('[aria-label="Next month"]'); await p.waitForTimeout(500); console.log('->',await lab(), p.url());
 await L.shot(p,'raka-cal-nov-1440');
 await p.click('[aria-label="Next month"]'); await p.waitForTimeout(500); console.log('->',await lab());
 await L.shot(p,'raka-cal-dec-1440');
 console.log('dec cells', await p.evaluate(()=>[...document.querySelectorAll('.fl-month:not(.fl-month--head) > div')].map(d=>d.querySelector('b').innerText+(d.classList.contains('is-other')?'o':'')).join(' ')));
 await p.click('[aria-label="Next month"]'); await p.waitForTimeout(500); console.log('->',await lab());
 console.log('jan cells', await p.evaluate(()=>[...document.querySelectorAll('.fl-month:not(.fl-month--head) > div')].map(d=>d.querySelector('b').innerText+(d.classList.contains('is-other')?'o':'')).join(' ')));
 await L.shot(p,'raka-cal-jan-1440');
 await p.click('[aria-label="Previous month"]');await p.click('[aria-label="Previous month"]');await p.click('[aria-label="Previous month"]'); await p.waitForTimeout(500); console.log('back 3 ->',await lab());
 await p.click('text=Today'); await p.waitForTimeout(500); console.log('today ->',await lab());
 // week across boundary
 await p.click('text=Week'); await p.goto(L.B+'#/calendar?v=week&d=2026-12-28'); await p.waitForTimeout(1200);
 console.log('wk dec28:', await lab(), await p.evaluate(()=>[...document.querySelectorAll('.fl-cal__day')].map(e=>e.innerText.replace(/\n/g,'')).join(',')));
 await L.shot(p,'raka-cal-dec28wk-1440');
 await p.click('[aria-label="Next week"]'); await p.waitForTimeout(800);
 console.log('wk jan4:', await lab(), await p.evaluate(()=>[...document.querySelectorAll('.fl-cal__day')].map(e=>e.innerText.replace(/\n/g,'')).join(',')));
 // week across Oct/Nov boundary: 2026-10-26 week -> Mon 26..Sun 1 Nov
 await p.goto(L.B+'#/calendar?v=week&d=2026-10-30'); await p.waitForTimeout(800);
 console.log('this week days:', await p.evaluate(()=>[...document.querySelectorAll('.fl-cal__day')].map(e=>e.innerText.replace(/\n/g,'')).join(',')), await lab());
 console.log(p.logs.join('\n')); await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
