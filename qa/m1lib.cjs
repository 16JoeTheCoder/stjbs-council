const { chromium } = require('playwright');
exports.open = async (w=1280,h=900)=>{
  const b = await chromium.launch(); const ctx = await b.newContext({viewport:{width:w,height:h}}); const p = await ctx.newPage();
  p.logs=[]; p.on('console',m=>{if(['error','warning'].includes(m.type()))p.logs.push(m.type()+': '+m.text())});
  p.on('pageerror',e=>p.logs.push('pageerror: '+e.message));
  p.on('requestfailed',r=>p.logs.push('reqfailed: '+r.url().slice(0,100)+' '+(r.failure()||{}).errorText));
  p.on('response',r=>{if(r.status()>=400)p.logs.push('http'+r.status()+': '+r.url().slice(0,100))});
  p.on('dialog',d=>d.accept());
  return {b,ctx,p};
};
exports.login = async (p,name,pw='council123')=>{
  await p.goto('http://localhost:5173/#/'); await p.waitForTimeout(800);
  await p.fill('input[type=email]',name+'@stjbs.sch.id'); await p.fill('input[type=password]',pw);
  await p.click('form button.jy-btn'); await p.waitForTimeout(2000);
};
