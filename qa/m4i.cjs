const L=require('./m4lib.cjs');
(async()=>{
 let {b,p}=await L.open(1440,900); await L.login(p,'raka');
 await p.goto(L.B+'#/week'); await p.waitForTimeout(1000);
 console.log('home text:', await p.locator('main').innerText().then(t=>t.slice(0,900).replace(/\n/g,' | ')));
 await p.goto(L.B+'#/tasks'); await p.waitForTimeout(1000); console.log('tasks:', await p.locator('main').innerText().then(t=>t.includes('Book cup supplier')));
 await b.close();
})();
