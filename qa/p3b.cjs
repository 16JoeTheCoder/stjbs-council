const { chromium } = require('playwright'); const B='http://localhost:5173/app/';
(async()=>{const b=await chromium.launch();
for(const [r,rts] of [['budi',['week','projects','p/t1','ideas']],['ariel',['week','checkin','admin/members']],['sarah',['week','p/t1','templates']]]){
 const ctx=await b.newContext({viewport:{width:1440,height:900}}); const p=await ctx.newPage(); p.on('dialog',d=>d.accept());
 await p.goto(B+'#/week'); await p.fill('#email',r+'@stjbs.sch.id'); await p.fill('#password','council123'); await p.click('form button.fl-btn--red'); await p.waitForSelector('.fl-app'); await p.waitForTimeout(1000);
 for(const rt of rts){ await p.goto(B+'#/'+rt); await p.waitForTimeout(900); console.log('##',r,rt,'\n',(await p.locator('main').innerText()).replace(/\n+/g,' | ').slice(0,900)); console.log('buttons:',(await p.locator('main button').allInnerTexts()).slice(0,14).join(' / '));}
 await ctx.close();}
await b.close()})();
