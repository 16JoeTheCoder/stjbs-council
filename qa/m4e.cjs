const L=require('./m4lib.cjs');
(async()=>{
 // phone calendar
 let {b,p}=await L.open(390,844); await L.login(p,'raka');
 await p.goto(L.B+'#/calendar'); await p.waitForTimeout(1500); await L.shot(p,'raka-cal-week-390'); console.log('wk390',JSON.stringify(await L.overflow(p)));
 await p.click('text=Month'); await p.waitForTimeout(800); await L.shot(p,'raka-cal-month-390'); console.log('mo390',JSON.stringify(await L.overflow(p)));
 await p.goto(L.B+'#/calendar?e=e1'); await p.waitForTimeout(1200); await L.shot(p,'raka-cal-sheet-390'); console.log('sheet390',JSON.stringify(await L.overflow(p)));
 await p.goto(L.B+'#/calendar'); await p.waitForTimeout(800); await p.click('text=Add event'); await p.waitForTimeout(500); await L.shot(p,'raka-cal-form-390'); console.log('form390',JSON.stringify(await L.overflow(p)));
 console.log(p.logs.join('\n')); await b.close();
 // teacher
 ({b,p}=await L.open(1440,900)); await L.login(p,'budi');
 await p.goto(L.B+'#/calendar?e=e1'); await p.waitForTimeout(1500);
 console.log('budi: addevent',await p.locator('text=Add event').count(),'rsvp disabled',await p.locator('[aria-label=RSVP] button:disabled').count(),'edit',await p.locator('button:has-text("Edit event")').count());
 await L.shot(p,'budi-cal-sheet-1440');
 console.log(p.logs.join('\n')); await b.close();
 // michael: not creator of kevin events; creator of own
 ({b,p}=await L.open(1440,900)); await L.login(p,'michael');
 await p.goto(L.B+'#/calendar?e=e1'); await p.waitForTimeout(1500);
 console.log('michael on kevin event: edit',await p.locator('button:has-text("Edit event")').count(), 'cb', 'RSVP', await p.locator('[aria-label=RSVP] button').allInnerTexts());
 await p.click('[aria-label=RSVP] button:has-text("Can\'t go")'); await p.waitForTimeout(800); console.log('michael changes to not', await p.locator('[aria-label=RSVP] button').allInnerTexts());
 await p.click('[aria-label=RSVP] button:has-text("Going")'); await p.waitForTimeout(800); console.log('back', await p.locator('[aria-label=RSVP] button').allInnerTexts());
 console.log(p.logs.join('\n')); await b.close();
 // ariel/nadia: edit public event as admin, sarah view
 ({b,p}=await L.open(1440,900)); await L.login(p,'nadia');
 await p.goto(L.B+'#/calendar?e=e5&d=2026-11-07'); await p.waitForTimeout(1500);
 console.log('nadia on e5 edit', await p.locator('button:has-text("Edit event")').count());
 await p.click('button:has-text("Edit event")'); await p.waitForTimeout(500);
 console.log('title disabled', await p.locator('#ev-title').isDisabled(), 'public cb checked', await p.locator('input.fl-switch').isChecked());
 await p.uncheck('input.fl-switch'); await p.click('form button.fl-btn--red'); await p.waitForTimeout(1000);
 await p.goto(L.B+'#/calendar?e=e5&d=2026-11-07'); await p.waitForTimeout(1200); console.log('sheet tags', (await p.locator('[role=dialog]').first().innerText()).replace(/\n/g,' | '));
 // restore
 await p.click('button:has-text("Edit event")'); await p.check('input.fl-switch'); await p.click('form button.fl-btn--red'); await p.waitForTimeout(800);
 console.log(p.logs.join('\n')); await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
