const { chromium } = require('playwright');
const {mk,login}=require('./m2c.cjs');
const SD='/home/user/stjbs-council/qa/screens-m2/';
const feed=async()=>{const r=await fetch('http://127.0.0.1:8080/v1/projects/demo-council/databases/(default)/documents/public/feed');const j=await r.json();const d=JSON.parse(j.fields.json.stringValue);return {hash:j.fields.hash.stringValue,upd:j.fields.updatedAt.integerValue,carnival:d.projects.map(p=>p.title+' '+p.pct+' '+p.done+'/'+p.total).join('; '),ev:d.events.length}};
const tick=async(p,title)=>{await p.goto('http://localhost:5173/app/#/p/carnival');await p.waitForTimeout(1500);const b=p.locator(`label:has-text("Done: ${title}") input`).first();console.log("tick",title,await b.count());await b.evaluate(e=>e.click());await p.waitForTimeout(1500);};
(async()=>{const b=await chromium.launch();
 console.log('start',await feed());
 let {p}=await mk(b); await login(p,'raka'); console.log('raka home',(await p.innerText('body')).slice(0,400).replace(/\n/g,' | '));
 await p.screenshot({path:SD+'app-raka-home.png'});
 await tick(p,'Order 400 cups'); await p.screenshot({path:SD+'app-raka-tick.png'}); console.log('raka ticked; waiting');
 await p.waitForTimeout(8000); console.log('after raka',await feed()); console.log(p.logs);
 // michael ticks
 let m=await mk(b); await login(m.p,'michael'); await tick(m.p,'Secure Pocari Sweat booth contract'); await m.p.waitForTimeout(3000);
 console.log('after michael (no admin)',await feed());
 // kevin opens
 let k=await mk(b); await login(k.p,'kevin'); await k.p.waitForTimeout(8000); console.log('after kevin open',await feed()); console.log('kevin logs',k.p.logs);
 await k.p.screenshot({path:SD+'app-kevin-home.png'});
 await b.close();})();
