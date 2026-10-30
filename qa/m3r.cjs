const L=require('./m3lib.cjs');
(async()=>{
 for(const [w,h] of [[1440,900],[390,844]]){
 const {b,p}=await L.open(w,h); await L.login(p,'nadia');
 const pages=['p/carnival?view=timeline','p/carnival?view=team','meeting/carnival','p/drinks?view=timeline','p/t0','templates','workload','admin/workload','activity','committees','people/raka%40stjbs.sch.id','people/zzz%40x.com','p/nonexistent','digest','checkin','settings'];
 for(const pg of pages){ await p.goto(L.B+'#/'+pg); await p.waitForTimeout(600); const o=await L.overflow(p); console.log(w,pg,'h',o.h,(o.sw>o.iw||o.bad.length)?'OVERFLOW '+JSON.stringify(o):'ok','|',(await p.locator('main').first().innerText()).slice(0,60).replace(/\n/g,' | ')); await L.shot(p,`nadia-${pg.replace(/[\/?=%@.]/g,'_')}-${w}`); }
 // back nav
 await p.goto(L.B+'#/projects'); await p.click('a.fl-h3:has-text("STJBS Carnival")'); await p.waitForTimeout(300); await p.click('a.fl-h3:has-text("Drinks")'); await p.waitForTimeout(300); await p.goBack(); await p.waitForTimeout(300); console.log('back1',p.url()); await p.goBack(); await p.waitForTimeout(300); console.log('back2',p.url()); await p.goForward(); await p.waitForTimeout(300); console.log('fwd',p.url());
 console.log('LOGS',[...new Set(p.logs)].join(' || ')); await b.close();}
})().catch(e=>{console.error(e.message.slice(0,600));process.exit(1)});
