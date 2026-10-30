const {open,login}=require('./m1lib.cjs');
const U='http://localhost:5173/#/admin';
const toast=async p=>{await p.waitForTimeout(1200);return (await p.$$eval('[role=status],[role=alert],.jy-toast',e=>e.map(x=>x.innerText.trim()).filter(Boolean))).join(' || ')};
async function edit(p,name){await p.click(`button:has-text("Edit ${name}")`);await p.waitForTimeout(300);}
async function opts(p,label){return p.$$eval(`label:has(.jy-field__label:text-is("${label}")) option`,o=>o.map(x=>x.textContent))}
async function add(p,email,name,role){
  await p.click('button:has-text("Add member")');await p.waitForTimeout(300);
  await p.fill('[name=id]',email);await p.fill('[name=name]',name);
  if(role) await p.selectOption('label:has(.jy-field__label:text-is("Role")) select',{label:role});
  await p.click('button:has-text("Save member")');return toast(p);}
(async()=>{
 // ARIEL
 let {b,p}=await open(); await login(p,'ariel'); await p.goto(U); await p.waitForTimeout(1200);
 await p.click('button:has-text("Add member")'); console.log('ariel add roles',await opts(p,'Role')); await p.click('button:has-text("Cancel")');
 await edit(p,'Ariel Santoso'); console.log('ariel self role disabled?',await p.$eval('label:has(.jy-field__label:text-is("Role")) select',s=>s.disabled)); await p.screenshot({path:'screens-m1/20-ariel-self-edit.png'}); await p.click('button:has-text("Cancel")');
 console.log('ariel add zed(advisor):',await add(p,'zed@stjbs.sch.id','Zed Test','Advisor'));
 await p.reload();await p.waitForTimeout(1500);
 console.log('after reload zed:',await p.$$eval('tbody tr',r=>r.filter(x=>x.innerText.includes('Zed')).map(x=>x.innerText.replace(/\s+/g,' '))));
 await edit(p,'Bryan Hartono'); await p.selectOption('label:has(.jy-field__label:text-is("Role")) select',{label:'Secretary'});
 await p.selectOption('label:has(.jy-field__label:text-is("Reports to")) select',{label:'Nadia Putri'});
 await p.click('button:has-text("Save member")'); console.log('ariel edit bryan:',await toast(p));
 await p.reload();await p.waitForTimeout(1500);
 console.log(await p.$$eval('tbody tr',r=>r.filter(x=>x.innerText.includes('Bryan')).map(x=>x.innerText.replace(/\s+/g,' '))));
 await p.click('button:has-text("Deactivate Bryan")').catch(()=>{});
 await p.locator('tr:has-text("Bryan") button:has-text("Deactivate")').click(); console.log('deactivate bryan:',await toast(p));
 await p.reload();await p.waitForTimeout(1500);
 console.log(await p.$$eval('tbody tr',r=>r.filter(x=>x.innerText.includes('Bryan')).map(x=>x.innerText.replace(/\s+/g,' '))));
 await p.screenshot({path:'screens-m1/21-ariel-after.png',fullPage:true});
 console.log(p.logs.filter(l=>!/400/.test(l))); await b.close();
 // bryan sign in blocked
 ({b,p}=await open()); await login(p,'bryan'); await p.waitForTimeout(1500);
 console.log('bryan deactivated signin:',(await p.innerText('body')).slice(0,250).replace(/\n/g,' | '),p.url()); await p.screenshot({path:'screens-m1/22-bryan-blocked.png'});
 console.log(p.logs); await b.close();
 // reactivate + zed signup
 ({b,p}=await open()); await login(p,'ariel'); await p.goto(U); await p.waitForTimeout(1200);
 await p.locator('tr:has-text("Bryan") button:has-text("Reactivate")').click(); console.log('reactivate:',await toast(p));
 await p.reload();await p.waitForTimeout(1200);
 console.log(await p.$$eval('tbody tr',r=>r.filter(x=>x.innerText.includes('Bryan')).map(x=>x.innerText.replace(/\s+/g,' '))));
 await b.close();
 // restore bryan role: later
})();
