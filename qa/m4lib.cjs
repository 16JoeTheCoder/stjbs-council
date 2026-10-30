const { chromium } = require('playwright');
const B='http://localhost:5173/app/';
exports.B=B;
exports.open = async (w=1440,h=900,scheme='dark')=>{
  const b = await chromium.launch(); const ctx = await b.newContext({viewport:{width:w,height:h},colorScheme:scheme}); const p = await ctx.newPage();
  p.logs=[]; p.on('console',m=>{if(['error','warning'].includes(m.type()))p.logs.push(m.type()+': '+m.text().slice(0,200))});
  p.on('pageerror',e=>p.logs.push('pageerror: '+e.message));
  p.on('requestfailed',r=>p.logs.push('reqfailed: '+r.url().slice(0,100)+' '+(r.failure()||{}).errorText));
  p.on('response',r=>{if(r.status()>=400)p.logs.push('http'+r.status()+': '+r.url().slice(0,100))});
  p.on('dialog',d=>d.accept());
  return {b,ctx,p};
};
exports.login = async (p,name,pw='council123')=>{
  await p.goto(B+'#/week'); await p.waitForSelector('#email');
  await p.fill('#email',name+'@stjbs.sch.id'); await p.fill('#password',pw);
  await p.click('form button.fl-btn--red'); await p.waitForSelector('.fl-app',{timeout:15000}); await p.waitForTimeout(800);
};
exports.shot=(p,n)=>p.screenshot({path:`/home/user/stjbs-council/qa/screens-m4/${n}.png`,fullPage:true});
exports.overflow=(p)=>p.evaluate(()=>{const d=document.documentElement;const bad=[];document.querySelectorAll('body *').forEach(e=>{const r=e.getBoundingClientRect();if(r.width&&r.right>innerWidth+1&&getComputedStyle(e).position!=='fixed'){let a=e,hid=false;while(a=a.parentElement){const o=getComputedStyle(a).overflowX;if(o==='auto'||o==='scroll'||o==='hidden'){hid=true;break}}if(!hid)bad.push(e.className||e.tagName)}});return {sw:d.scrollWidth,iw:innerWidth,h:d.scrollHeight,bad:bad.slice(0,5)}});
