const L=require('./m3lib.cjs');
const T=async(p,s='main')=>(await p.locator(s).first().innerText()).replace(/\n/g,' | ');
(async()=>{
 let {b,p}=await L.open(1440,900); await L.login(p,'michael');
 await p.goto(L.B+'#/p/drinks'); await p.waitForTimeout(600); console.log('drinks:',(await T(p)).slice(0,400));
 await p.click('text=Add task'); await p.waitForTimeout(300); await L.shot(p,'michael-addtask-1440');
 await p.click('button:has-text("Add task")'); await p.waitForTimeout(300); console.log('blank title err:',await p.locator('#item-err').innerText());
 await p.fill('#f-title','QA task <b>bold</b> & "quotes" 🎉'); await p.fill('#f-dueDate','2026-11-02'); await p.check('label:has-text("Alya Rahman") input');
 await p.click('form button.fl-btn--red'); await p.waitForTimeout(1200);
 console.log('after add:',(await T(p)).slice(0,900));
 console.log('bold tag rendered as html?', await p.locator('main b:has-text("bold")').count());
 await p.goto(L.B+'#/p/carnival'); await p.waitForTimeout(500); console.log('carnival after add:', (await T(p)).slice(0,330));
 // long title
 await p.goto(L.B+'#/p/drinks'); await p.click('text=Add task'); await p.fill('#f-title','X'.repeat(200)); console.log('maxlen title',(await p.inputValue('#f-title')).length);
 await p.fill('#f-title','Reversed dates'); await p.fill('#f-startDate','2026-12-01'); await p.fill('#f-dueDate','2026-11-01'); await p.click('form button.fl-btn--red'); await p.waitForTimeout(300); console.log('date err:',await p.locator('#item-err').innerText());
 await p.fill('#f-dueDate','2026-12-05'); await p.fill('#f-link','javascript:alert(1)'); await p.click('form button.fl-btn--red'); await p.waitForTimeout(300); console.log('link err:',await p.locator('#item-err').innerText());
 await p.click('text=Cancel');
 // find QA task and archive+undo
 await p.goto(L.B+'#/p/drinks'); await p.waitForTimeout(500);
 await p.click('a:has-text("QA task")'); await p.waitForTimeout(500); console.log('qa task page:',(await T(p)).slice(0,300));
 await p.click('text=Update task'); await p.waitForTimeout(300); await p.click('button:has-text("Archive task")'); await p.waitForTimeout(1000);
 console.log('after archive url',p.url(),'toast:',await p.locator('.fl-toast').innerText().catch(()=>'NO TOAST')); await L.shot(p,'michael-archive-toast-1440');
 await p.click('.fl-toast button:has-text("Undo")'); await p.waitForTimeout(1200); console.log('after undo:',(await T(p)).slice(0,500));
 console.log('LOGS',[...new Set(p.logs)].join(' || '));
 await b.close();
 // assignee limited edit raka t0
 ({b,p}=await L.open(1440,900)); await L.login(p,'raka');
 await p.goto(L.B+'#/p/t0'); await p.waitForTimeout(500); await p.click('text=Update task'); await p.waitForTimeout(300); await L.shot(p,'raka-edit-t0-1440');
 console.log('assignee fields:',await p.locator('form label').allInnerTexts());
 await p.fill('#f-notes','Called <script>alert(1)</script> Monday 😀'); await p.click('form button.fl-btn--red'); await p.waitForTimeout(1000); console.log('saved:',(await T(p)).slice(0,400));
 await p.goto(L.B+'#/p/s1'); await p.click('text=Update task'); console.log('s1 fields:',await p.locator('form label').allInnerTexts());
 await p.goto(L.B+'#/p/t3'); console.log('non-assignee t3 buttons:', await p.locator('main button, main .fl-btn').allInnerTexts());
 await p.goto(L.B+'#/p/carnival'); console.log('raka carnival buttons:', await p.locator('main .fl-actions button, main .fl-actions a').allInnerTexts(), 'switch', await p.locator('.fl-switch').count());
 console.log('LOGS',[...new Set(p.logs)].join(' || '));
 await b.close();
})().catch(e=>{console.error(e.message.slice(0,600));process.exit(1)});
