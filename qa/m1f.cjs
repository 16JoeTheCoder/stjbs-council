const {open,login}=require('./m1lib.cjs');
(async()=>{const {b,p}=await open(); await login(p,'nadia'); await p.goto('http://localhost:5173/#/admin'); await p.waitForTimeout(1500);
console.log(await p.$$eval('button',e=>e.map(x=>x.innerText)));await p.screenshot({path:'screens-m1/35-dbg.png'});console.log(p.url());await b.close()})()
