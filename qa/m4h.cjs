const L=require('./m4lib.cjs');
(async()=>{
 let {b,p}=await L.open(1440,900); await L.login(p,'michael');
 await p.goto(L.B+'#/p/t1'); await p.waitForTimeout(1500);
 await p.click('text=Add comment').catch(()=>{});
 await p.click('#comment-box'); await p.keyboard.type('@Ra'); await p.keyboard.press('Enter'); await p.keyboard.type('book the cup supplier today'); await p.click('button:has-text("Post comment")'); await p.waitForTimeout(1200);
 await p.locator('.fl-comment:has-text("supplier") button:has-text("Make task")').click(); await p.waitForTimeout(500);
 console.log('checked:', await p.evaluate(()=>[...document.querySelectorAll('form.fl-form input[type=checkbox]')].filter(c=>c.checked).map(c=>c.closest('label')?.innerText)), 'title', await p.inputValue('form.fl-form input'));
 await p.fill('form.fl-form input', 'Book cup supplier'); await p.click('button:has-text("Add task")'); await p.waitForTimeout(1500);
 console.log('toast', await p.locator('[role=status]').allInnerTexts(), p.url());
 console.log('where: ', await p.evaluate(()=>document.querySelector('main').innerText.slice(0,300).replace(/\n/g,' | ')));
 await b.close();
 ({b,p}=await L.open(1440,900)); await L.login(p,'raka');
 await p.click('[aria-label*="otification"], .fl-bell'); await p.waitForTimeout(500);
 console.log('raka bell:', await p.locator('.fl-pop').first().innerText().then(t=>t.replace(/\n/g,' | ')));
 await p.keyboard.press('Escape'); await p.goto(L.B+'#/week'); await p.waitForTimeout(1000);
 console.log('Needs you:', await p.evaluate(()=>(document.querySelector('[aria-labelledby*=need]')||document.querySelector('main')).innerText.slice(0,600).replace(/\n/g,' | ')));
 await L.shot(p,'raka-home-needsyou-1440');
 // as raka: non-manager sees Make task?
 await p.goto(L.B+'#/p/t1'); await p.waitForTimeout(1200); console.log('raka (assignee only) make task btn:', await p.locator('button:has-text("Make task")').count());
 // teacher
 await b.close();
 ({b,p}=await L.open(1440,900)); await L.login(p,'budi'); await p.goto(L.B+'#/p/t1'); await p.waitForTimeout(1200); console.log('budi make task', await p.locator('button:has-text("Make task")').count(), 'comment box', await p.locator('#comment-box').count(), await p.locator('text=Add comment').count());
 await b.close();
 // 390 mention
 ({b,p}=await L.open(390,844)); await L.login(p,'michael'); await p.goto(L.B+'#/p/t1'); await p.waitForTimeout(1200); await p.click('#comment-box').catch(async()=>{await p.click('text=Add comment')}); await p.keyboard.type('hi @A'); await p.waitForTimeout(400); await L.shot(p,'michael-mention-390'); console.log('390',JSON.stringify(await L.overflow(p))); await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
