const {open,login}=require('./m1lib.cjs');
const U='http://localhost:5173/#/admin';
const toast=async p=>{await p.waitForTimeout(1200);return (await p.$$eval('[role=status],[role=alert],.jy-toast',e=>e.map(x=>x.innerText.trim()).filter(Boolean))).join(' || ')};
const R='label:has(.jy-field__label:text-is("Role")) select';
async function add(p,email,name,role){
  if(await p.locator('button:has-text("Cancel")').count()) await p.click('button:has-text("Cancel")');
  await p.click('button:has-text("Add member")');await p.waitForTimeout(300);
  await p.fill('[name=id]',email);await p.fill('[name=name]',name);
  if(role) await p.selectOption(R,{label:role});
  await p.click('button:has-text("Save member")');return toast(p);}
const row=(p,n)=>p.$$eval('tbody tr',(r,n)=>r.filter(x=>x.innerText.startsWith(n)).map(x=>x.innerText.replace(/\s+/g,' ')),n);
(async()=>{
 let {b,p}=await open(); await login(p,'nadia'); await p.goto(U); await p.waitForTimeout(1200);

 await add(p,'hiro@stjbs.sch.id','Hiro Test','Teacher');
 console.log('nadia "adds" ariel as Teacher:',await add(p,'ariel@stjbs.sch.id','Ariel Hacked','Teacher'));
 await p.screenshot({path:'screens-m1/33-nadia-denied.png'});
 console.log('nadia "adds" clara (existing officer) as Teacher:',await add(p,'clara@stjbs.sch.id','Clara','Teacher'));
 console.log('nadia "adds" kevin Officer:',await add(p,'kevin@stjbs.sch.id','Kevin','Officer'));
 await p.reload();await p.waitForTimeout(1500); console.log(await row(p,'Kevin'),await row(p,'Ariel'),await row(p,'Clara'));
 await b.close();
 // kevin deactivates nadia (intended) and zed/hiro sign-up flow
 ({b,p}=await open()); await login(p,'kevin'); await p.goto(U); await p.waitForTimeout(1200);
 await p.locator('tr:has-text("Hiro") button:has-text("Deactivate")').click(); console.log('kevin deact hiro',await toast(p));
 await b.close();
 // new member sign-up (hiro deactivated; use hiro)
 ({b,p}=await open()); await p.goto('http://localhost:5173/#/'); await p.waitForTimeout(800);
 await p.click('text=Create account'); await p.fill('input[type=email]','hiro@stjbs.sch.id'); await p.fill('input[type=password]','council123'); await p.click('form button.jy-btn'); await p.waitForTimeout(2500);
 console.log('hiro signup:',(await p.innerText('body')).slice(0,200).replace(/\n/g,' | ')); await p.screenshot({path:'screens-m1/34-hiro-signup.png'});
 await p.goto('http://localhost:5173/#/admin'); await p.waitForTimeout(1200); console.log('hiro(treasurer) admin:',(await p.innerText('main')).slice(0,100).replace(/\n/g,' '));
 console.log(p.logs.filter(l=>!/400|ABORTED/.test(l))); await b.close();
})();
