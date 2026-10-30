const {open,login}=require('./m1lib.cjs');
const toast=async p=>{await p.waitForTimeout(1500);return (await p.$$eval('[role=status],[role=alert],.jy-toast',e=>e.map(x=>x.innerText.trim()).filter(Boolean))).join(' || ')};
(async()=>{let {b,p}=await open(); await login(p,'michael');
 await p.goto('http://localhost:5173/#/p/drinks');await p.waitForTimeout(1500);
 await p.click('a:has-text("QA task with detail")'); await p.waitForTimeout(800);
 await p.click('button:has-text("Update task")'); await p.waitForTimeout(500); await p.screenshot({path:'screens-m1/53-update-form.png',fullPage:true}); await p.fill('[name=title]','QA task renamed');
 await p.click('button:has-text("Save changes")'); console.log('update task:',await toast(p));
 await p.reload();await p.waitForTimeout(1200); console.log('renamed ok:',(await p.innerText('main')).includes('QA task renamed'));
 await p.click('button:has-text("Update task")'); await p.waitForTimeout(400);
 await p.click('button:has-text("Archive task")'); console.log('archive task (confirm auto-accepted):',await toast(p)); await p.screenshot({path:'screens-m1/50-task-archived-toast.png'});
 await p.click('button:has-text("Undo")'); console.log('undo:',await toast(p));
 await p.goto('http://localhost:5173/#/p/drinks');await p.waitForTimeout(1500); console.log('back after undo:',(await p.innerText('main')).includes('QA task renamed'));
 await b.close();
 ({b,p}=await open()); await login(p,'nadia'); await p.goto('http://localhost:5173/#/projects');await p.waitForTimeout(1200);
 await p.click('a:has-text("QA Sports Day")'); await p.waitForTimeout(1000);
 await p.click('button:has-text("Edit project")'); await p.waitForTimeout(500);
 await p.screenshot({path:'screens-m1/51-edit-project.png',fullPage:true});
 await p.click('button:has-text("Archive project")'); console.log('archive project:',await toast(p)); await p.screenshot({path:'screens-m1/52-archived.png'});
 console.log(p.url(),(await p.innerText('main')).includes('QA Sports Day'));
 await p.click('button:has-text("Undo")').catch(e=>console.log('no undo btn after nav')); console.log('undo:',await toast(p));
 await p.goto('http://localhost:5173/#/projects');await p.waitForTimeout(1200); console.log('restored:',(await p.innerText('main')).includes('QA Sports Day'));
 // alya assignee ticks own task
 console.log(p.logs.filter(l=>!/400|ABORTED/.test(l)));
 await b.close();
 ({b,p}=await open()); await login(p,'alya'); await p.goto('http://localhost:5173/#/p/drinks');await p.waitForTimeout(1500);
 await p.click('a:has-text("QA task renamed")'); await p.waitForTimeout(800); console.log('alya sees:',await p.$$eval('button,select',e=>e.map(x=>x.innerText.trim().slice(0,20))));
 await p.goto('http://localhost:5173/#/week');await p.waitForTimeout(1200);
 const cb=p.locator('li:has-text("QA task renamed") input[type=checkbox]').first(); console.log('alya cb',await cb.count()); if(await cb.count()){await cb.click(); console.log('alya tick:',await toast(p));}
 console.log(p.logs.filter(l=>!/400|ABORTED/.test(l)));
 await b.close();
})()
