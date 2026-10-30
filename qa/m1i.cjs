const {open,login}=require('./m1lib.cjs');
const toast=async p=>{await p.waitForTimeout(1200);return (await p.$$eval('[role=status],[role=alert],.jy-toast',e=>e.map(x=>x.innerText.trim()).filter(Boolean))).join(' || ')};
(async()=>{let {b,p}=await open(); await login(p,'michael');
 const cbs=p.locator('main input[type=checkbox], main [role=checkbox]'); console.log('cbs',await cbs.count());
 const boxes=await p.$$eval('main input[type=checkbox]',e=>e.map(x=>[x.getAttribute('aria-label'),x.checked]));console.log(boxes);
 // uncheck Price list
 const price=p.locator('li:has-text("Price list for drinks stall") input[type=checkbox], tr:has-text("Price list") input[type=checkbox]').first();
 console.log('price count',await price.count());
 await price.click(); console.log('untick:',await toast(p)); await p.screenshot({path:'screens-m1/42-untick.png'});
 await p.reload(); await p.waitForTimeout(1500);
 console.log('after reload', await p.$$eval('main input[type=checkbox]',e=>e.map(x=>[x.getAttribute('aria-label'),x.checked])));
 await p.locator('input[type=checkbox][aria-label*="Price list"]').first().click().catch(async()=>{await p.locator('li:has-text("Price list") input[type=checkbox]').first().click()});
 console.log('tick:',await toast(p));
 await p.reload(); await p.waitForTimeout(1500);
 console.log('after reload2', await p.$$eval('main input[type=checkbox]',e=>e.map(x=>[x.getAttribute('aria-label'),x.checked])));
 // add task in Drinks (lead michael)
 await p.goto('http://localhost:5173/#/p/carnival');await p.waitForTimeout(1500);
 console.log((await p.innerText('main')).slice(0,600)); await p.screenshot({path:'screens-m1/43-carnival.png',fullPage:true});
 console.log(await p.$$eval('a,button',e=>e.map(x=>x.innerText.trim().slice(0,40)+'>'+(x.getAttribute('href')||'')).filter(x=>x.length>2).join('\n')));
 console.log(p.logs.filter(l=>!/400/.test(l)));
 await b.close()})()
