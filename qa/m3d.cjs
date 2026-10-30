const L=require('./m3lib.cjs');
(async()=>{
 let b,p;
 // phone shell
 ({b,p}=await L.open(390,844)); await L.login(p,'raka');
 for(const [n,t] of [['week','Home'],['calendar','Calendar'],['projects','Projects'],['ideas','Ideas']]){ await p.click(`.fl-tabbar [aria-label="${t}"]`); await p.waitForTimeout(400); console.log('tab',t,p.url().split('#')[1],'|',(await p.locator('main h1').first().innerText()).replace(/\n/g,' ')); }
 await p.click('.fl-tabbar [aria-label="More"]'); await p.waitForTimeout(400); await L.shot(p,'raka-more-390'); 
 const links=await p.locator('.fl-more a').evaluateAll(a=>a.map(x=>[x.textContent,x.getAttribute('href')])); console.log('more',JSON.stringify(links));
 for(const [t,h] of links){ await p.goto(L.B+'#/week'); await p.reload(); await p.waitForSelector('.fl-app'); await p.click('.fl-tabbar [aria-label="More"]'); await p.click(`.fl-more a:has-text("${t}")`); await p.waitForTimeout(400); console.log('more ->',t,p.url().split('#')[1],'sheet',await p.locator('.fl-sheet').count(),'|',(await p.locator('main h1').first().innerText()).replace(/\n/g,' ')); }
 await p.click('.fl-tabbar [aria-label="More"]'); await p.keyboard.press('Escape'); await p.waitForTimeout(300); console.log('esc closes more', await p.locator('.fl-sheet').count());
 // phone search
 await p.goto(L.B+'#/week'); await p.waitForTimeout(400); await p.click('[role=combobox]'); await p.keyboard.type('car'); await p.waitForTimeout(300); await L.shot(p,'raka-search-390');
 const bb=await p.locator('.fl-search').boundingBox(); console.log('search box',JSON.stringify(bb));
 await p.click('.fl-search__close'); await p.waitForTimeout(200); console.log('closed', await p.locator('.fl-search.is-open').count());
 // bell on phone
 await p.click('button[aria-label^="Notifications"]'); await p.waitForTimeout(300); await L.shot(p,'raka-bell-390'); console.log('pop box', JSON.stringify(await p.locator('.fl-pop').boundingBox()));
 await p.keyboard.press('Escape');
 await p.click('.fl-user'); await L.shot(p,'raka-avatar-390'); console.log('pop box', JSON.stringify(await p.locator('.fl-pop').boundingBox()));
 console.log('LOGS',[...new Set(p.logs)].join(' || ')); await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
