const L=require('./m3lib.cjs');
(async()=>{
 const {b,p}=await L.open(1440,900);
 await p.goto(L.B+'#/admin/members'); await p.waitForTimeout(1500);
 console.log('signedout admin:', p.url(), await p.locator('h1').allInnerTexts());
 await L.shot(p,'signin-dark-1440');
 // blank
 await p.click('form button.fl-btn--red'); await p.waitForTimeout(600);
 console.log('blank:', await p.locator('#auth-error').innerText());
 await p.fill('#email','raka@stjbs.sch.id'); await p.click('form button.fl-btn--red'); await p.waitForTimeout(600);
 console.log('blank pw:', await p.locator('#auth-error').innerText());
 await p.fill('#password','wrongwrong'); await p.click('form button.fl-btn--red'); await p.waitForTimeout(1200);
 console.log('wrong:', await p.locator('#auth-error').innerText()); await L.shot(p,'signin-wrong');
 await p.fill('#email','notanemail'); await p.click('form button.fl-btn--red'); await p.waitForTimeout(800);
 console.log('badmail:', await p.locator('#auth-error').innerText());
 await p.fill('#email','stranger@gmail.com'); await p.fill('#password','council123'); await p.click('form button.fl-btn--red'); await p.waitForTimeout(1200);
 console.log('stranger:', await p.locator('#auth-error').innerText());
 await p.click('text=Reset password'); await p.fill('#email','raka@stjbs.sch.id'); await p.click('form button.fl-btn--red'); await p.waitForTimeout(1000);
 console.log('reset:', await p.locator('[role=status]').allInnerTexts()); await L.shot(p,'signin-reset');
 await p.click('text=Sign in instead');
 await p.fill('#email','raka@stjbs.sch.id'); await p.fill('#password','council123'); await p.click('form button.fl-btn--red');
 await p.waitForSelector('.fl-app'); await p.waitForTimeout(1000);
 console.log('after login url', p.url());
 await p.reload(); await p.waitForSelector('.fl-app'); console.log('reload ok', p.url());
 await p.click('.fl-user'); await p.click('text=Sign out'); await p.waitForTimeout(1500);
 console.log('signed out form?', await p.locator('#email').count(), p.url());
 await p.fill('#email','raka@stjbs.sch.id'); await p.fill('#password','council123'); await p.click('form button.fl-btn--red'); await p.waitForSelector('.fl-app'); console.log('re-signin ok');
 await p.goto(L.B+'#/admin/members'); await p.waitForTimeout(1000);
 console.log('raka admin:', await p.locator('main').innerText()); await L.shot(p,'raka-admin-members');
 console.log(p.logs.join('\n'));
 // light sign in
 const c2=await L.open(1440,900,'light'); await c2.p.goto(L.B); await c2.p.waitForSelector('#email'); await L.shot(c2.p,'signin-light-1440');
 const c3=await L.open(390,844,'dark'); await c3.p.goto(L.B); await c3.p.waitForSelector('#email'); await L.shot(c3.p,'signin-dark-390'); console.log('signin390',JSON.stringify(await L.overflow(c3.p)));
 const c4=await L.open(390,844,'light'); await c4.p.goto(L.B); await c4.p.waitForSelector('#email'); await L.shot(c4.p,'signin-light-390');
 await b.close();await c2.b.close();await c3.b.close();await c4.b.close();
})().catch(e=>{console.error(e);process.exit(1)});
