const L=require('./m4lib.cjs');
(async()=>{
 let {b,p}=await L.open(1440,900); await L.login(p,'raka');
 await p.goto(L.B+'#/resources'); await p.waitForTimeout(1500); await L.shot(p,'raka-resources-1440');
 console.log(await p.evaluate(()=>[...document.querySelectorAll('.fl-row--doc')].map(r=>r.innerText.replace(/\n/g,' | ')+' => '+[...r.querySelectorAll('a')].map(a=>a.href+' '+a.target+' '+a.rel).join(','))));
 // suggest edit
 await p.click('[aria-label="Suggest an edit to Budget sheet"]'); await p.waitForTimeout(400);
 await p.fill('#sub-url','https://evil.example.com/x'); await p.click('form button.fl-btn--red'); console.log('non-google:', await p.locator('#sub-err').innerText());
 await p.fill('#sub-url','http://docs.google.com/document/d/1x'); await p.click('form button.fl-btn--red'); console.log('http:', await p.locator('#sub-err').innerText());
 await p.fill('#sub-url','https://docs.google.com.evil.com/document/d/1x'); await p.click('form button.fl-btn--red'); console.log('lookalike:', await p.locator('#sub-err').innerText(), await p.locator('[role=status]').allInnerTexts());
 await p.fill('#sub-url','javascript:alert(1)'); await p.click('form button.fl-btn--red'); console.log('js:', await p.locator('#sub-err').innerText());
 await p.fill('#sub-name',''); await p.fill('#sub-url','https://docs.google.com/spreadsheets/d/1Raka/edit'); await p.click('form button.fl-btn--red'); console.log('blank name:', await p.locator('#sub-err').innerText());
 await p.fill('#sub-name','Budget v3 <i>x</i>'); await p.click('form button.fl-btn--red'); await p.waitForTimeout(1200);
 console.log('after submit form?', await p.locator('form').count(), await p.locator('[role=status]').allInnerTexts());
 // share archive
 await p.click('text=Share something'); await p.click('text=An archive file'); await p.fill('#sub-name','Welcome week report'); await p.fill('#sub-url','https://drive.google.com/file/d/1abc/view'); await p.selectOption('#sub-proj','welcome'); await p.click('form button.fl-btn--red'); await p.waitForTimeout(1200);
 await p.click('text=Share something'); await p.fill('#sub-name','N'.repeat(120)); console.log('name len',(await p.inputValue('#sub-name')).length); await p.fill('#sub-name','Permission slip 2'); await p.fill('#sub-url','https://docs.google.com/forms/d/1x/edit'); await p.click('form button.fl-btn--red'); await p.waitForTimeout(1200);
 console.log('my subs:', await p.evaluate(()=>[...document.querySelectorAll('[aria-labelledby="subs-h"] .fl-row--doc')].map(r=>r.innerText.replace(/\n/g,' | '))));
 await L.shot(p,'raka-resources-subs-1440');
 await p.reload(); await p.waitForTimeout(1500); console.log('after reload subs count', await p.locator('[aria-labelledby="subs-h"] .fl-row--doc').count());
 console.log('project templates panel raka:', await p.locator('text=Project templates').count());
 console.log(p.logs.join('\n')); await b.close();
 ({b,p}=await L.open(390,844)); await L.login(p,'raka'); await p.goto(L.B+'#/resources'); await p.waitForTimeout(1500); await L.shot(p,'raka-resources-390'); console.log('res390',JSON.stringify(await L.overflow(p))); await b.close();
 for (const n of ['sarah','budi','ariel']){ ({b,p}=await L.open(1440,900)); await L.login(p,n); await p.goto(L.B+'#/resources'); await p.waitForTimeout(1500); console.log(n,'share btn',await p.locator('text=Share something').count(),'suggest',await p.locator('text=Suggest an edit').count(),'my subs',await p.locator('text=My submissions').count(),'ptpl',await p.locator('text=Project templates').count(), 'subs', await p.locator('[aria-labelledby="subs-h"] .fl-row--doc').allInnerTexts()); await L.shot(p,n+'-resources-1440'); console.log(p.logs.join('\n')); await b.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
