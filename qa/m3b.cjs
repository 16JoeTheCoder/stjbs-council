const L=require('./m3lib.cjs');
const roles=['raka','sarah','kevin','nadia','ariel','budi'];
const routes=['week','tasks','projects','committees','ideas','activity','settings','templates','digest','workload','checkin','calendar','resources','admin','admin/members','admin/workload','admin/digest','admin/announcements','admin/public','admin/approvals','meeting'];
(async()=>{
 for(const [w,h] of [[1440,900],[390,844]]){
  for(const r of roles){
   const {b,p}=await L.open(w,h); await L.login(p,r);
   for(const rt of routes){
     await p.goto(L.B+'#/'+rt); await p.waitForTimeout(500);
     const o=await L.overflow(p);
     const t=(await p.locator('main').first().innerText()).slice(0,70).replace(/\n/g,' | ');
     const flag=(o.sw>o.iw||o.bad.length)?' OVERFLOW '+JSON.stringify(o):'';
     console.log(`${w} ${r} ${rt} h=${o.h} [${t}]${flag}`);
     if(['week','projects','committees','ideas','tasks','settings'].includes(rt)||(r==='nadia'&&rt.startsWith('admin'))||(r==='kevin'&&rt.startsWith('admin'))) await L.shot(p,`${r}-${rt.replace('/','-')}-${w}`);
   }
   console.log(r,w,'LOGS',[...new Set(p.logs)].join(' || '));
   await b.close();
  }
 }
})().catch(e=>{console.error(e);process.exit(1)});
