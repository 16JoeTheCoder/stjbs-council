const L=require('./flib.cjs');
(async()=>{
 for (const [w,h,s] of [[1440,900,'dark'],[390,844,'dark'],[1440,900,'light'],[390,844,'light']]) {
  const {b,p}=await L.open(w,h,s);
  await p.goto('http://localhost:5173/'); await p.waitForTimeout(1500);
  await L.shot(p,`pub-${w}-${s}`); console.log('pub',w,s,JSON.stringify(await L.overflow(p)), (await p.innerText('body')).replace(/\n+/g,' | ').slice(0,700));
  if(w==1440&&s=='dark'){
   await p.goto('http://localhost:5173/#/week'); await p.waitForTimeout(1500); console.log('old link ->',p.url());
   await p.goto('http://localhost:5173/#/p/t1'); await p.waitForTimeout(1000); console.log('old link2 ->',p.url());
   await p.goto('http://localhost:5173/'); 
   console.log('anchors',await p.$$eval('a',a=>a.map(x=>x.textContent.trim()+'->'+x.getAttribute('href'))));
  }
  console.log('logs',p.logs); await b.close();
 }
 // signin
 for (const [w,h,s] of [[1440,900,'dark'],[390,844,'light']]) {
  const {b,p}=await L.open(w,h,s); await p.goto(L.B+'#/week'); await p.waitForSelector('#email'); await L.shot(p,`signin-${w}-${s}`); console.log('signin',w,JSON.stringify(await L.overflow(p)));
  if(w==1440){
   const sub=()=>p.click('form button.fl-btn--red');
   await p.fill('#email','raka@stjbs.sch.id'); await p.fill('#password','wrong'); await sub(); await p.waitForTimeout(1500); console.log('wrongpw:',(await p.innerText('body')).replace(/\n+/g,' | ').slice(0,500)); await L.shot(p,'signin-wrongpw');
   await p.fill('#email','nobody@stjbs.sch.id'); await p.fill('#password','council123'); await sub(); await p.waitForTimeout(1500); console.log('noroster:',(await p.innerText('body')).replace(/\n+/g,' | ').slice(0,500));
   await p.fill('#email','x'); await p.fill('#password',''); await sub(); await p.waitForTimeout(800); console.log('invalid:',(await p.innerText('body')).replace(/\n+/g,' | ').slice(0,300));
   const btns=await p.$$eval('button,a',a=>a.map(x=>x.textContent.trim()).filter(Boolean)); console.log(btns);
   const reset=p.locator('button:has-text("Forgot"), button:has-text("eset"), a:has-text("eset")').first();
   await p.fill('#email','raka@stjbs.sch.id'); await reset.click().catch(e=>console.log('no reset btn')); await p.waitForTimeout(1500); console.log('reset:',(await p.innerText('body')).replace(/\n+/g,' | ').slice(0,500)); await L.shot(p,'signin-reset');
   await p.fill('#email','ghost@stjbs.sch.id'); await reset.click().catch(()=>{}); await p.waitForTimeout(1500); console.log('reset ghost:',(await p.innerText('body')).replace(/\n+/g,' | ').slice(0,400));
  }
  console.log('logs',p.logs); await b.close();
 }
 // signed out wrong urls
 {const {b,p}=await L.open(); for (const u of ['#/admin','#/admin/members','#/p/t1','#/calendar']){await p.goto(L.B+u);await p.waitForTimeout(800);console.log(u,'->',await p.evaluate(()=>!!document.querySelector('#email')),p.url())} await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});
