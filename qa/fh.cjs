const L=require('./flib.cjs');
(async()=>{const {b,p}=await L.open(); await p.goto(L.B+'#/week'); await p.waitForTimeout(3000); console.log(await p.innerText('body').then(t=>t.slice(0,200))); console.log(p.logs); await L.shot(p,'dbg'); await b.close();})();
