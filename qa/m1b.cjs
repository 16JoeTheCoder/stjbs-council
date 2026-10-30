const {open,login}=require('./m1lib.cjs');
(async()=>{
 for (const n of ['ariel','kevin','nadia','sarah','raka','budi']) {
  const {b,p}=await open(); await login(p,n);
  await p.goto('http://localhost:5173/#/admin'); await p.waitForTimeout(1500);
  console.log('==',n, 'nav:', await p.$$eval('nav a, header a',e=>e.map(x=>x.innerText.trim()).join('/')));
  await p.screenshot({path:`screens-m1/10-roster-${n}.png`,fullPage:true});
  const rows=await p.$$eval('tbody tr',r=>r.map(x=>[...x.children].map(c=>c.innerText.trim()).join(' | ')));
  console.log(rows.length? rows.join('\n') : (await p.innerText('main, body')).slice(0,200));
  console.log(p.logs.filter(l=>!/400/.test(l)));
  await b.close();
 }
})();
