const {open,login}=require('./m1lib.cjs');
const toast=async p=>{await p.waitForTimeout(1500);return (await p.$$eval('[role=status],[role=alert],.jy-toast',e=>e.map(x=>x.innerText.trim()).filter(Boolean))).join(' || ')};
(async()=>{let {b,p}=await open(); await login(p,'michael');
 await p.goto('http://localhost:5173/#/p/drinks');await p.waitForTimeout(1500);
 await p.click('button:has-text("Add task")'); await p.waitForTimeout(400);
 await p.fill('[name=title]','QA task with detail'); await p.fill('[name=startDate]','2026-11-02'); await p.fill('[name=dueDate]','2026-11-20');
 const cbs=p.locator('form input[type=checkbox]'); await cbs.nth(0).check(); await cbs.nth(2).check();
 await p.fill('form textarea','Notes with <b>html</b> & "quotes"'); await p.fill('[name=link]','https://example.com/x');
 await p.click('form button:has-text("Add task")'); console.log('add detailed:',await toast(p));
 await p.reload();await p.waitForTimeout(1500); console.log((await p.innerText('main')).includes('QA task with detail'));
 // open and edit it
 await p.click('a:has-text("QA task with detail")'); await p.waitForTimeout(1200); await p.screenshot({path:'screens-m1/47-task-detail.png',fullPage:true});
 console.log(await p.$$eval('a,button',e=>e.map(x=>x.innerText.trim()).filter(x=>/Edit|Archive|Delete/.test(x))));
 await b.close();
 // nadia
 ({b,p}=await open()); await login(p,'nadia'); await p.goto('http://localhost:5173/#/projects');await p.waitForTimeout(1200);
 await p.click('button:has-text("New project")'); await p.waitForTimeout(400); await p.screenshot({path:'screens-m1/48-newproject.png',fullPage:true});
 await p.fill('[name=title]','QA Sports Day'); await p.fill('[name=dueDate]','2027-02-01').catch(()=>{});
 await p.click('form button.jy-btn--accent, form button:has-text("Create"), form button:has-text("Add")'); console.log('create project:',await toast(p));
 await p.reload();await p.waitForTimeout(1500); console.log('proj listed:',(await p.innerText('main')).includes('QA Sports Day'));
 await p.click('a:has-text("QA Sports Day")'); await p.waitForTimeout(1200); console.log(p.url());
 await p.screenshot({path:'screens-m1/49-newproject-page.png',fullPage:true});
 console.log(await p.$$eval('a,button',e=>e.map(x=>x.innerText.trim()).filter(x=>/Edit|Archive|Add/.test(x))));
 console.log(p.logs.filter(l=>!/400|ABORTED/.test(l)));
 await b.close()})()
