const { chromium } = require('playwright');
const B='http://localhost:5173/app/';
const roles=['raka','sarah','nadia','kevin','ariel','budi','dimas'];
const common=['week','tasks','calendar','projects','committees','resources','ideas','settings','activity'];
const admin=['admin','admin/announcements','admin/members','admin/workload','admin/public','admin/approvals','admin/digest'];
(async()=>{
 const b=await chromium.launch(); const out=[];
 for(const scheme of ['dark','light']) for(const [w,h] of [[1440,900],[390,844]]) for(const r of roles){
  const ctx=await b.newContext({viewport:{width:w,height:h},colorScheme:scheme}); const p=await ctx.newPage(); const errs=[];
  p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto(B+'#/week'); await p.waitForSelector('#email'); await p.fill('#email',r+'@stjbs.sch.id'); await p.fill('#password','council123'); await p.click('form button.fl-btn--red');
  await p.waitForSelector('.fl-app',{timeout:15000}); await p.waitForTimeout(1200);
  const routes=[...common,...(['nadia','kevin','ariel'].includes(r)?admin:['admin'])];
  for(const rt of routes){
   await p.goto(B+'#/'+rt); await p.waitForTimeout(900);
   const m=await p.evaluate(()=>{const d=document.documentElement;const main=document.querySelector('main');return {t:(main?.innerText||'').slice(0,160).replace(/\n/g,' | '),len:(main?.innerText||'').length,h:d.scrollHeight,vh:innerHeight,sw:d.scrollWidth,iw:innerWidth,th:document.documentElement.dataset.theme||''}});
   out.push({scheme,w,r,rt,...m,errs:errs.splice(0)});
   if(rt==='week'||(r==='budi'&&['projects','calendar','resources'].includes(rt))||(r==='sarah'&&rt==='projects')||(r==='ariel'&&rt==='admin')) await p.screenshot({path:`qa/screens-final/${scheme}-${w}-${r}-${rt.replace('/','-')}.png`,fullPage:true});
  }
  await ctx.close();
 }
 require('fs').writeFileSync('qa/pass3.json',JSON.stringify(out,null,1)); await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
