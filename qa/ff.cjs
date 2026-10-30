const L=require('./flib.cjs');
const btns=(p)=>p.evaluate(()=>[...document.querySelectorAll('main button, main a')].map(e=>(e.getAttribute('aria-label')||e.innerText||'').trim().replace(/\n/g,' ').slice(0,30)).filter(Boolean).join(' | '));
(async()=>{
 let {b,p}=await L.open(1440,900); await L.login(p,'michael');
 await p.goto(L.B+'#/projects'); await p.waitForTimeout(800); console.log('projects:',await btns(p));
 const hrefs=await p.$$eval('main a[href^="#/p/"]',a=>a.map(x=>x.getAttribute('href')+' '+x.innerText.slice(0,20).replace(/\n/g,' '))); console.log(hrefs);
 await p.goto(L.B+'#/p/'+(hrefs[0]||'').split(' ')[0].replace('#/p/','')); await p.waitForTimeout(1000); console.log('root:',await btns(p)); await L.shot(p,'michael-root'); 
 await p.goto(L.B+'#/p/t1'); await p.waitForTimeout(1000); console.log('t1:',await btns(p));
 await p.goto(L.B+'#/week'); await p.waitForTimeout(800); console.log('home:',await btns(p));
 await p.goto(L.B+'#/tasks'); await p.waitForTimeout(800); console.log('tasks:',await btns(p));
 await p.goto(L.B+'#/checkin'); await p.waitForTimeout(800); console.log('checkin:',await p.evaluate(()=>document.querySelector('main').innerText.slice(0,500).replace(/\n/g,' | ')));
 await b.close();
})();
