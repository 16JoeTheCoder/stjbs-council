const L=require('./flib.cjs');
const routes=['week','tasks','checkin','calendar','projects','meeting','committees','resources','ideas','activity','digest','templates','workload','settings','admin','admin/announcements','admin/members','admin/workload','admin/public','admin/approvals','admin/digest','nonsense'];
(async()=>{
 for (const role of ['raka','michael','sarah','nadia','kevin','ariel','budi']) for (const [w,h] of [[1440,900],[390,844]]) {
  const {b,p}=await L.open(w,h); await L.login(p,role);
  const out=[];
  for (const r of routes){ await p.goto(L.B+'#/'+r); await p.waitForTimeout(700);
   const t=await p.evaluate(()=>document.querySelector('main')?.innerText||'');
   const o=await L.overflow(p); const rail=await p.evaluate(()=>!!document.querySelector('.fl-badge--admin, .fl-admin-badge, [class*=admin-badge]'));
   out.push(`${r}: ${t.replace(/\s+/g,' ').slice(0,60)} ${o.sw>o.iw?'OVERFLOW '+o.bad:''}`);
   if(['week','calendar','projects','admin','committees'].includes(r)&&role=='raka'||(r=='admin'&&role=='nadia')) await L.shot(p,`${role}-${r.replace('/','_')}-${w}`);
  }
  console.log('==',role,w); console.log(out.join('\n')); console.log('logs',[...new Set(p.logs)].filter(l=>!/Write\/channel|aborted/i.test(l)).slice(0,6)); await b.close();
 }
})().catch(e=>{console.error(e);process.exit(1)});
