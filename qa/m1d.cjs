const {open,login}=require('./m1lib.cjs');
const U='http://localhost:5173/#/admin';
const toast=async p=>{await p.waitForTimeout(1200);return (await p.$$eval('[role=status],[role=alert],.jy-toast',e=>e.map(x=>x.innerText.trim()).filter(Boolean))).join(' || ')};
const R='label:has(.jy-field__label:text-is("Role")) select';
async function edit(p,name){await p.click(`button:has-text("Edit ${name}")`);await p.waitForTimeout(300);}
async function opts(p,label){return p.$$eval(`label:has(.jy-field__label:text-is("${label}")) option`,o=>o.map(x=>x.textContent))}
async function add(p,email,name,role){
  await p.click('button:has-text("Add member")');await p.waitForTimeout(300);
  await p.fill('[name=id]',email);await p.fill('[name=name]',name);
  if(role) await p.selectOption(R,{label:role});
  await p.click('button:has-text("Save member")');return toast(p);}
const row=(p,n)=>p.$$eval('tbody tr',(r,n)=>r.filter(x=>x.innerText.includes(n)).map(x=>x.innerText.replace(/\s+/g,' ')),n);
(async()=>{
 let {b,p}=await open(); await login(p,'kevin'); await p.goto(U); await p.waitForTimeout(1200);
 await p.click('button:has-text("Add member")'); console.log('kevin add roles',await opts(p,'Role')); await p.click('button:has-text("Cancel")');
 console.log('kevin add vp-hire yuki as Treasurer:',await add(p,'yuki@stjbs.sch.id','Yuki Test','Treasurer'));
 await p.reload();await p.waitForTimeout(1500); console.log(await row(p,'Yuki'));
 await edit(p,'Raka'); console.log('kevin edit raka roles',await opts(p,'Role'));
 await p.selectOption(R,{label:'Secretary'}); await p.click('button:has-text("Save member")'); console.log('raka->secretary:',await toast(p));
 await p.reload();await p.waitForTimeout(1500); console.log(await row(p,'Raka'));
 await edit(p,'Kevin'); console.log('kevin self role disabled',await p.$eval(R,s=>s.disabled)); await p.click('button:has-text("Cancel")');
 console.log('kevin ariel edit btn count',await p.locator('tr:has-text("Ariel") button').count());
 await p.locator('tr:has-text("Raka") button:has-text("Deactivate")').click(); console.log(await toast(p));
 await p.locator('tr:has-text("Raka") button:has-text("Reactivate")').click(); console.log(await toast(p));
 await p.locator('tr:has-text("Nadia") button:has-text("Deactivate")').count().then(c=>console.log('kevin can deactivate nadia btn:',c));
 // bypass attempts: add existing emails
 console.log('kevin "adds" ariel as Officer:',await add(p,'ariel@stjbs.sch.id','Ariel Hacked','Officer'));
 await p.reload();await p.waitForTimeout(1500); console.log(await row(p,'Ariel'));
 await p.screenshot({path:'screens-m1/30-kevin.png',fullPage:true});
 console.log(p.logs.filter(l=>!/400/.test(l))); await b.close();

 ({b,p}=await open()); await login(p,'nadia'); await p.goto(U); await p.waitForTimeout(1200);
 await p.click('button:has-text("Add member")'); console.log('nadia add roles',await opts(p,'Role')); await p.click('button:has-text("Cancel")');
 console.log('nadia add hiro Teacher:',await add(p,'hiro@stjbs.sch.id','Hiro Test','Teacher'));
 await p.reload();await p.waitForTimeout(1500); console.log(await row(p,'Hiro'));
 await edit(p,'Clara'); console.log('nadia edit clara role disabled',await p.$eval(R,s=>s.disabled));
 await p.fill('[name=section]','Arts, sec 2 to 4'); await p.selectOption('label:has(.jy-field__label:text-is("Reports to")) select',{label:'Dimas Pratama'});
 await p.screenshot({path:'screens-m1/31-nadia-edit.png'});
 await p.click('button:has-text("Save member")'); console.log('nadia edit clara:',await toast(p));
 await p.reload();await p.waitForTimeout(1500); console.log(await row(p,'Clara'));
 console.log('nadia deactivate btns:',await p.locator('button:has-text("Deactivate")').count());
 console.log('nadia ariel btns:',await p.locator('tr:has-text("Ariel") button').count());
 console.log('nadia edit self:'); await edit(p,'Nadia'); console.log(await p.$eval(R,s=>s.disabled)); await p.fill('[name=name]','Nadia Putri'); await p.click('button:has-text("Save member")'); console.log(await toast(p));
 console.log('nadia "adds" kevin as Officer:',await add(p,'kevin@stjbs.sch.id','Kevin Hacked','Officer'));
 console.log('nadia "adds" ariel as Teacher:',await add(p,'ariel@stjbs.sch.id','Ariel Hacked','Teacher'));
 console.log('nadia "adds" clara (existing officer) as Teacher:',await add(p,'clara@stjbs.sch.id','Clara','Teacher'));
 await p.reload();await p.waitForTimeout(1500); console.log(await row(p,'Kevin'),await row(p,'Ariel'),await row(p,'Clara'));
 await p.screenshot({path:'screens-m1/32-nadia.png',fullPage:true});
 console.log(p.logs.filter(l=>!/400/.test(l))); await b.close();
})();
