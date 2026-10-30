const L=require('./flib.cjs');
const step=async(n,f)=>{try{const r=await f(); console.log('['+n+']',r===undefined?'ok':JSON.stringify(r).slice(0,800))}catch(e){console.log('['+n+'] FAIL',e.message.split('\n')[0].slice(0,160))}};
const txt=async(p,n=500)=>(await p.innerText('main')).replace(/\n+/g,' | ').slice(0,n);
(async()=>{
 for (const role of ['kevin','nadia','ariel']) {
  let {b,p}=await L.open(1440,900); p.setDefaultTimeout(3500); await L.login(p,role);
  console.log('== ',role);
  await step('landing',async()=>[p.url(), await p.locator('.fl-badge--admin,.fl-admin').count()]);
  await step('members page',async()=>{await p.goto(L.B+'#/admin/members'); await p.waitForTimeout(800); await L.shot(p,role+'-members'); return await txt(p,900)});
  await step('member edit form',async()=>{await p.click('main button:has-text("Edit")').catch(()=>{}); await p.waitForTimeout(400); return await p.evaluate(()=>[...document.querySelectorAll('form.fl-form input,form.fl-form select')].map(e=>(e.id||e.name||e.tagName)+(e.disabled?'(disabled)':'')+'='+e.value).join(' ; '))});
  await b.close();
 }
})();
