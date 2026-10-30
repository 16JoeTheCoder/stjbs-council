const L=require('./m3lib.cjs');
(async()=>{
 for(const [w,h] of [[1440,900],[390,844]]){
  const {b,ctx,p}=await L.open(w,h,'light'); await ctx.addInitScript(()=>{try{localStorage.setItem('council-theme','light')}catch{}});
  await p.goto(L.B); await p.waitForSelector('#email'); await L.shot(p,`signin-light-${w}b`);
  await L.login(p,'clara'); await p.waitForTimeout(800); await L.shot(p,`clara-home-light-${w}`);
  await p.goto(L.B+'#/tasks'); await p.waitForTimeout(500); await L.shot(p,`clara-tasks-light-${w}`);
  console.log(w,'logs',[...new Set(p.logs)].join('|')); await b.close();
 }
 // greeting by Jakarta time
 for(const iso of ['2026-10-30T04:59:00Z','2026-10-30T05:00:00Z','2026-10-30T10:59:00Z','2026-10-30T11:00:00Z','2026-10-30T16:59:00Z','2026-10-30T17:01:00Z','2026-10-30T22:00:00Z']){
  const b=await require('playwright').chromium.launch(); const c=await b.newContext({viewport:{width:1440,height:900}}); const p=await c.newPage(); await p.clock.install({time:new Date(iso)}); await p.goto(L.B); await p.waitForSelector('#email'); await p.fill('#email','raka@stjbs.sch.id'); await p.fill('#password','council123'); await p.click('form button.fl-btn--red'); await p.waitForSelector('.fl-app',{timeout:20000}); await p.clock.resume().catch(()=>{}); await p.waitForTimeout(800);
  console.log(iso,'->',(await p.locator('.fl-hero__body').innerText()).replace(/\n/g,' | ').slice(0,80)); await b.close(); }
})().catch(e=>{console.error(e.message.slice(0,600));process.exit(1)});
