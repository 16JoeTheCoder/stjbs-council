const {open,login}=require('./m1lib.cjs');
(async()=>{const {b,p}=await open(); await login(p,'nadia');console.log(p.logs, await p.innerText('body').then(t=>t.slice(0,150)));await b.close()})()
