const {open,login}=require('./m1lib.cjs');
(async()=>{const {b,p}=await open(); await login(p,'michael');
 console.log((await p.innerText('main')).slice(0,900));
 console.log(await p.$$eval('input[type=checkbox],[role=checkbox],button',e=>e.slice(0,40).map(x=>(x.getAttribute('aria-label')||x.innerText||x.type).slice(0,50))));
 await p.screenshot({path:'screens-m1/40-michael-home.png',fullPage:true});
 await p.goto('http://localhost:5173/#/projects');await p.waitForTimeout(1200);
 console.log((await p.innerText('main')).slice(0,900)); await p.screenshot({path:'screens-m1/41-projects.png',fullPage:true});
 console.log(await p.$$eval('a',e=>e.map(x=>x.innerText.trim().slice(0,30)+'>'+x.getAttribute('href')).join('\n')));
 await b.close()})()
