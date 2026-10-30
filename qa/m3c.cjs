const L=require('./m3lib.cjs');
(async()=>{
 // laptop shell as raka
 let {b,p}=await L.open(1440,900); await L.login(p,'raka');
 for(const t of ['Home','Calendar','Projects','Committees','Resources']){ await p.click(`.fl-rail .fl-nav a:has-text("${t}")`); await p.waitForTimeout(400); console.log('rail',t,p.url().split('#')[1], '|', (await p.locator('main h1').first().innerText().catch(()=>'-')).replace(/\n/g,' ')); }
 await p.click('.fl-brand'); await p.waitForTimeout(300);
 // bell
 await p.click('button[aria-label^="Notifications"]'); await p.waitForTimeout(300); await L.shot(p,'raka-bell-1440');
 console.log('bell items', await p.locator('.fl-note-item').count(), 'unread', await p.locator('.fl-note-item.is-unread').count(), await p.locator('button[aria-label^="Notifications"]').getAttribute('aria-label'));
 await p.click('text=See all activity'); await p.waitForTimeout(500); console.log('see all ->',p.url());
 await p.click('button[aria-label^="Notifications"]'); await p.keyboard.press('Escape'); await p.waitForTimeout(200); console.log('esc closes bell', await p.locator('.fl-pop').count(), await p.locator('.fl-pop').first().innerText().then(t=>t.slice(0,40)).catch(()=>''));
 // avatar
 await p.click('.fl-user'); await L.shot(p,'raka-avatar-1440'); console.log('menu', (await p.locator('.fl-pop').innerText()).replace(/\n/g,' | '));
 await p.click('text=My profile'); await p.waitForTimeout(500); console.log('profile', p.url(), (await p.locator('main').innerText()).slice(0,150).replace(/\n/g,' | ')); await L.shot(p,'raka-profile-1440');
 await p.click('.fl-user'); await p.click('.fl-pop >> text=Settings'); await p.waitForTimeout(300); console.log('settings', p.url());
 // search
 await p.goto(L.B+'#/week'); await p.waitForTimeout(500);
 await p.keyboard.press('/'); console.log('slash focus', await p.evaluate(()=>document.activeElement.getAttribute('role')));
 await p.keyboard.type('carn'); await p.waitForTimeout(300); await L.shot(p,'raka-search-1440');
 console.log('results', (await p.locator('.fl-pop--search').innerText()).replace(/\n/g,' | '));
 await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); console.log('sel', await p.locator('[aria-selected=true]').innerText()); await p.keyboard.press('Enter'); await p.waitForTimeout(400); console.log('enter ->', p.url(), 'sheet', await p.locator('.fl-sheet').count()); await p.keyboard.press('Escape'); await p.waitForTimeout(300); console.log('focus after esc', await p.evaluate(()=>document.activeElement.tagName+'.'+document.activeElement.className));
 await p.keyboard.press('/'); await p.keyboard.type('zzzz'); await p.waitForTimeout(200); console.log('none:', await p.locator('.fl-pop--search').innerText()); await p.keyboard.press('Escape'); console.log('esc: q=',await p.inputValue('[role=combobox]'), 'pop', await p.locator('.fl-pop--search').count());
 await p.keyboard.press('/'); await p.keyboard.type('weekly'); await p.waitForTimeout(200); console.log('weekly', (await p.locator('.fl-pop--search').innerText()).replace(/\n/g,' | '));
 await p.keyboard.type('<script>'); await p.waitForTimeout(200); console.log('xss search', (await p.locator('.fl-pop--search').innerText()).replace(/\n/g,' | '));
 await p.keyboard.press('Escape');
 // search an announcement + event + person + template
 for(const q of ['Carnival volunteer','Council weekly','Clara','budget']){ await p.keyboard.press('/'); await p.keyboard.type(q); await p.waitForTimeout(200); console.log('q',q,(await p.locator('.fl-pop--search').innerText()).replace(/\n/g,' | ')); await p.keyboard.press('Escape'); }
 await p.keyboard.press('/'); await p.keyboard.type('Carnival volunteer'); await p.waitForTimeout(200); await p.keyboard.press('Enter'); await p.waitForTimeout(400); console.log('ann sheet', await p.locator('.fl-sheet').count()); await p.keyboard.press('Escape'); await p.waitForTimeout(300); console.log('sheet closed', await p.locator('.fl-sheet').count());
 await p.keyboard.press('/'); await p.keyboard.type('Council weekly'); await p.waitForTimeout(200); await p.keyboard.press('Enter'); await p.waitForTimeout(500); console.log('event hit ->', p.url(), await p.locator('main h1').innerText());
 console.log('LOGS',[...new Set(p.logs)].join(' || ')); await b.close();
 // phone shell
 ({b,p}=await L.open(390,844)); await L.login(p,'raka');
 for(const [n,t] of [['week','Home'],['calendar','Calendar'],['projects','Projects'],['ideas','Ideas']]){ await p.click(`.fl-tabbar [aria-label="${t}"]`); await p.waitForTimeout(400); console.log('tab',t,p.url().split('#')[1],'|',(await p.locator('main h1').first().innerText()).replace(/\n/g,' ')); }
 await p.click('.fl-tabbar [aria-label="More"]'); await p.waitForTimeout(400); await L.shot(p,'raka-more-390'); 
 const links=await p.locator('.fl-more a').evaluateAll(a=>a.map(x=>[x.textContent,x.getAttribute('href')])); console.log('more',JSON.stringify(links));
 for(const [t,h] of links){ await p.goto(L.B+'#/week'); await p.waitForTimeout(300); await p.click('.fl-tabbar [aria-label="More"]'); await p.click(`.fl-more a:has-text("${t}")`); await p.waitForTimeout(400); console.log('more ->',t,p.url().split('#')[1],'sheet',await p.locator('.fl-sheet').count(),'|',(await p.locator('main h1').first().innerText()).replace(/\n/g,' ')); }
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
