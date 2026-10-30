const L=require('./m3lib.cjs');
(async()=>{
 let {b,p}=await L.open(1440,900); await L.login(p,'raka');
 await p.click('button[aria-label^="Notifications"]'); await p.waitForTimeout(300);
 await p.mouse.click(700,500); await p.waitForTimeout(300); console.log('outside',await p.locator('.fl-pop').count(), await p.evaluate(()=>document.elementFromPoint(700,500).className));
 await p.mouse.click(700,500); await p.waitForTimeout(300); console.log('outside 2',await p.locator('.fl-pop').count());
 await p.click('button[aria-label^="Notifications"]'); await p.waitForTimeout(300); console.log('open',await p.locator('.fl-pop').count());
 await p.click('.fl-user'); await p.waitForTimeout(300); console.log('open user (bell should close)',await p.locator('.fl-pop').count());
 await p.goto(L.B+'#/activity'); await p.waitForTimeout(500);
 await p.click('button[aria-label^="Notifications"]'); await p.waitForTimeout(300); await p.keyboard.press('Escape'); await p.waitForTimeout(300); console.log('esc on feed page',await p.locator('.fl-pop').count());
 await b.close();
})().catch(e=>{console.error(e.message.slice(0,300));process.exit(1)});
