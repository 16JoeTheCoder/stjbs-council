const { chromium } = require('playwright');
const {mk,login}=require('./m2c.cjs');
const SD='/home/user/stjbs-council/qa/screens-m2/';
const feed=async()=>{const r=await fetch('http://127.0.0.1:8080/v1/projects/demo-council/databases/(default)/documents/public/feed');const j=await r.json();return j.fields.hash.stringValue+' '+j.fields.updatedAt.integerValue};
(async()=>{const b=await chromium.launch();
 let f=await mk(b,1440); await f.p.goto('http://localhost:5173/'); await f.p.waitForTimeout(1500);
 console.log('fresh public',(await f.p.innerText('#live')).replace(/\n/g,' | ').slice(0,300));
 await f.p.screenshot({path:SD+'pub-after-publish.png'});
 // idempotent republish
 let n=await mk(b); await login(n.p,'nadia'); await n.p.waitForTimeout(6000); console.log('after nadia open',await feed());
 // offline: same ctx
 f.p.on('dialog',d=>d.accept());
 await f.p.evaluate(()=>{const c=JSON.parse(localStorage.getItem('council-feed'));c.fetchedAt=0;localStorage.setItem('council-feed',JSON.stringify(c))});
 await f.ctx.route('**/documents/public/feed*',r=>r.abort());
 await f.p.reload(); await f.p.waitForTimeout(1500);
 console.log('offline w copy',(await f.p.innerText('#live')).replace(/\n/g,' | ').slice(0,200),'| events',(await f.p.innerText('#events')).slice(0,60).replace(/\n/g,' '));
 await f.p.screenshot({path:SD+'pub-offline-copy.png',fullPage:true});
 console.log('logs',f.p.logs);
 // fresh ctx blocked
 let g=await mk(b,390); await g.ctx.route('**/documents/public/feed*',r=>r.abort()); await g.p.goto('http://localhost:5173/'); await g.p.waitForTimeout(1500);
 console.log('fresh blocked',(await g.p.innerText('main')).replace(/\n/g,' | ').slice(0,700)); console.log('overflow',await g.p.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
 await g.p.screenshot({path:SD+'pub-offline-nocopy.png',fullPage:true}); console.log(g.p.logs);
 // 404 feed
 let h=await mk(b,390); await h.ctx.route('**/documents/public/feed*',r=>r.fulfill({status:404,body:'{"error":{"code":404}}'})); await h.p.goto('http://localhost:5173/'); await h.p.waitForTimeout(1500);
 console.log('404',(await h.p.innerText('#live')).replace(/\n/g,' | '));
 await b.close();})();
