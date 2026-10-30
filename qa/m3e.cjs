const L=require('./m3lib.cjs');
(async()=>{
 let {b,p}=await L.open(390,844); await L.login(p,'raka');
 await p.click('.fl-tabbar [aria-label="More"]'); await p.waitForTimeout(400);
 console.log('open',await p.locator('.fl-sheet').count(),'focus',await p.evaluate(()=>document.activeElement.className));
 await p.keyboard.press('Escape'); await p.waitForTimeout(400); console.log('after esc',await p.locator('.fl-sheet').count());
 await p.click('.fl-tabbar [aria-label="More"]'); await p.waitForTimeout(400);
 await p.click('.fl-sheet__close'); await p.waitForTimeout(400); console.log('after X',await p.locator('.fl-sheet').count());
 // bell esc laptop
 await b.close();
 ({b,p}=await L.open(1440,900)); await L.login(p,'raka');
 await p.click('button[aria-label^="Notifications"]'); await p.waitForTimeout(300); console.log('bell open',await p.locator('.fl-pop').count());
 await p.keyboard.press('Escape'); await p.waitForTimeout(300); console.log('bell after esc',await p.locator('.fl-pop').count());
 await p.click('.fl-user'); await p.waitForTimeout(300); await p.keyboard.press('Escape'); await p.waitForTimeout(300); console.log('menu after esc',await p.locator('.fl-pop').count());
 await p.click('button[aria-label^="Notifications"]'); await p.mouse.click(700,500); await p.waitForTimeout(300); console.log('bell outside click',await p.locator('.fl-pop').count());
 await b.close();
})().catch(e=>{console.error(e.message.slice(0,300));process.exit(1)});
