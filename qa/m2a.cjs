const { chromium } = require('playwright');
const U='http://localhost:5173/';
const SD='/home/user/stjbs-council/qa/screens-m2/';
(async()=>{
 const b=await chromium.launch();
 for (const [w,h,tag] of [[1440,900,'d'],[390,844,'m']]) {
  const ctx=await b.newContext({viewport:{width:w,height:h}}); const p=await ctx.newPage();
  const logs=[]; p.on('console',m=>{if(['error','warning'].includes(m.type()))logs.push(m.type()+': '+m.text())});
  p.on('pageerror',e=>logs.push('pageerror '+e.message)); p.on('requestfailed',r=>logs.push('reqfailed '+r.url()));
  p.on('response',r=>{if(r.status()>=400)logs.push('http'+r.status()+' '+r.url())});
  let feedBody=''; p.on('response',async r=>{if(r.url().includes('public/feed')){try{feedBody=await r.text()}catch{}}});
  await p.goto(U); await p.waitForTimeout(1500);
  await p.screenshot({path:SD+`pub-${tag}-top.png`});
  await p.screenshot({path:SD+`pub-${tag}-full.png`,fullPage:true});
  const text=await p.innerText('body');
  console.log(tag,'TEXT\n',text.slice(0,2500));
  // anchors
  const y0=()=>p.evaluate(()=>scrollY);
  await p.click('text=Explore our work'); await p.waitForTimeout(800);
  console.log(tag,'explore hash',await p.evaluate(()=>location.hash), 'liveTop', await p.evaluate(()=>Math.round(document.getElementById('live').getBoundingClientRect().top)));
  await p.evaluate(()=>scrollTo(0,0)); await p.waitForTimeout(300);
  await p.click('text=Join us'); await p.waitForTimeout(800);
  console.log(tag,'join hash',await p.evaluate(()=>location.hash),'joinTop',await p.evaluate(()=>Math.round(document.getElementById('join').getBoundingClientRect().top)), 'vh',h);
  await p.screenshot({path:SD+`pub-${tag}-join.png`});
  await p.evaluate(()=>scrollTo(0,0));
  const nav=await p.$$eval('.fl-site-nav a',a=>a.map(x=>[x.textContent,x.getAttribute('href'),getComputedStyle(x).display, x.getBoundingClientRect().width]));
  console.log(tag,'nav',JSON.stringify(nav));
  for (const t of ['Events','Projects','About']) { const l=p.locator('.fl-site-nav a',{hasText:t}); if(await l.isVisible()){await l.click();await p.waitForTimeout(600);console.log(tag,t,'->',await p.evaluate(()=>location.hash),await p.evaluate(()=>scrollY));} else console.log(tag,t,'nav link hidden'); }
  const bad=/@|stjbs\.sch|Michael|Alya|Kevin|Nadia|Raka|Sarah|Dimas|Budi|Ariel|Bryan|Clara/;
  console.log(tag,'name leak in page text?',bad.test(text), 'in feed?',bad.test(feedBody));
  console.log(tag,'feed body',feedBody.slice(0,1500));
  console.log(tag,'overflowX',await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
  await p.evaluate(()=>scrollTo(0,0));
  await p.click('text=Dashboard'); await p.waitForTimeout(1500); console.log(tag,'dashboard url',p.url());
  console.log(tag,'LOGS',logs);
  await ctx.close();
 }
 await b.close();
})();
