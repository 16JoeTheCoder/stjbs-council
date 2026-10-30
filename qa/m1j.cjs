const {open,login}=require('./m1lib.cjs');
const toast=async p=>{await p.waitForTimeout(1500);return (await p.$$eval('[role=status],[role=alert],.jy-toast',e=>e.map(x=>x.innerText.trim()).filter(Boolean))).join(' || ')};
(async()=>{let {b,p}=await open(); await login(p,'michael');
 await p.goto('http://localhost:5173/#/p/drinks');await p.waitForTimeout(1500);
 console.log((await p.innerText('main')).slice(0,300)); 
 await p.click('button:has-text("Add task")'); await p.waitForTimeout(400); await p.screenshot({path:'screens-m1/44-addtask-form.png',fullPage:true});
 console.log(await p.$$eval('form input,form select,form textarea,form button',e=>e.map(x=>(x.name||x.getAttribute('aria-label')||x.innerText||x.type)+':'+x.tagName)));
 await p.fill('form input[name=title], form input[type=text], form input:not([type])','QA drinks task M1'); 
 await p.click('form button:has-text("Save"), form button:has-text("Add task"), form button.jy-btn--accent'); console.log('add:',await toast(p));
 await p.reload();await p.waitForTimeout(1500); console.log('present after reload:',(await p.innerText('main')).includes('QA drinks task M1'));
 await p.screenshot({path:'screens-m1/45-drinks-after.png',fullPage:true});
 // meeting view add
 await p.goto('http://localhost:5173/#/meeting/carnival');await p.waitForTimeout(1500); await p.screenshot({path:'screens-m1/46-meeting.png',fullPage:true});
 console.log(p.logs.filter(l=>!/400|ABORTED/.test(l)));
 await b.close()})()
