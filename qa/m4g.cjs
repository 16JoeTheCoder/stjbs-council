const L=require('./m4lib.cjs');
(async()=>{
 let {b,p}=await L.open(1440,900); await L.login(p,'michael');
 await p.goto(L.B+'#/p/t1'); await p.waitForTimeout(1500); // Order 400 cups, raka
 console.log('h1', await p.locator('h1').first().innerText());
 await p.click('text=Add comment').catch(()=>{});
 await p.click('#comment-box'); await p.keyboard.type('Please check @Ra'); await p.waitForTimeout(400);
 console.log('autocomplete:', await p.locator('[role=listbox]').allInnerTexts()); await L.shot(p,'michael-mention-ac-1440');
 await p.keyboard.press('Enter'); console.log('val:', await p.inputValue('#comment-box'));
 await p.keyboard.type('the cups by Monday <b>x</b>'); await p.click('button:has-text("Post comment")'); await p.waitForTimeout(1200);
 console.log('comments:', await p.locator('.fl-comment').allInnerTexts(), 'mention spans', await p.locator('.fl-mention').allInnerTexts());
 // mention someone not picked via typing only (no autocomplete)
 await p.click('#comment-box'); await p.keyboard.type('@Zed nobody and @Sarah'); await p.waitForTimeout(300); console.log('ac2', await p.locator('[role=listbox]').allInnerTexts()); await p.keyboard.press('Escape');
 await p.fill('#comment-box','plain @Raka typed without picking'); await p.click('button:has-text("Post comment")'); await p.waitForTimeout(1000);
 console.log('typed-no-pick spans', await p.locator('.fl-mention').allInnerTexts());
 await L.shot(p,'michael-comments-1440');
 // make task on the first comment (mention raka)
 await p.click('text=Show all').catch(()=>{});
 const btns=await p.locator('button:has-text("Make task")').count(); console.log('make task buttons',btns);
 await p.locator('.fl-comment:has-text("Please check") button:has-text("Make task")').click(); await p.waitForTimeout(600);
 await L.shot(p,'michael-maketask-form-1440');
 console.log('form:', await p.evaluate(()=>{const f=document.querySelector('form.fl-form');return f?f.innerText.slice(0,500).replace(/\n/g,' | '):'none'}), await p.evaluate(()=>[...document.querySelectorAll('form input, form select')].map(e=>(e.name||e.id||e.type)+'='+e.value).join('; ')));
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
