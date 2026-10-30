const { chromium } = require('playwright'); const B='http://localhost:5173/app/';
const common=['week','tasks','calendar','projects','p/t1','committees','ideas','resources','settings','activity','checkin','digest'];
const admin=['admin','admin/announcements','admin/members','admin/workload','admin/public','admin/approvals'];
const lum=c=>{const [r,g,b]=c.map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4});return .2126*r+.7152*g+.0722*b};
(async()=>{const b=await chromium.launch(); const bad={};
for(const [w,h] of [[1440,900],[390,844]]) for(const r of ['raka','ariel','budi','sarah']){
 const ctx=await b.newContext({viewport:{width:w,height:h}}); await ctx.addInitScript(()=>localStorage.setItem('council-theme','light')); const p=await ctx.newPage(); p.on('dialog',d=>d.accept());
 await p.goto(B+'#/week'); await p.fill('#email',r+'@stjbs.sch.id'); await p.fill('#password','council123'); await p.click('form button.fl-btn--red'); await p.waitForSelector('.fl-app'); await p.waitForTimeout(1000);
 console.log(r,w,'theme',await p.evaluate(()=>document.documentElement.dataset.theme));
 for(const rt of [...common,...(r==='ariel'?admin:[])]){
  await p.goto(B+'#/'+rt); await p.waitForTimeout(700);
  if(w===1440&&(r==='raka'||r==='ariel')&&['week','projects','calendar','admin','admin/public','p/t1','committees'].includes(rt)||(w===390&&r==='raka'&&['week','calendar','p/t1'].includes(rt))) await p.screenshot({path:`qa/screens-final/L-${w}-${r}-${rt.replace('/','-')}.png`,fullPage:true});
  const res=await p.evaluate(()=>{const out=[];const parse=s=>{const m=s.match(/rgba?\(([^)]+)\)/);if(!m)return null;const a=m[1].split(/[ ,\/]+/).map(Number);return {c:a.slice(0,3),a:a.length>3?a[3]:1}};
   const bg=e=>{let x=e;while(x){const s=parse(getComputedStyle(x).backgroundColor);if(s&&s.a>0.9)return s.c;if(getComputedStyle(x).backgroundImage!=='none'&&x.classList.contains('fl-stage'))return 'stage';x=x.parentElement}return [246,243,239]};
   const L=c=>{const [r,g,b]=c.map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4});return .2126*r+.7152*g+.0722*b};
   for(const e of document.querySelectorAll('main *, aside *, header *, nav *')){if(![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;const r=e.getBoundingClientRect();if(!r.width||!r.height)continue;const cs=getComputedStyle(e);if(cs.visibility==='hidden'||cs.display==='none'||+cs.opacity===0)continue;let x=e,stage=false;while(x){if(x.classList&&(x.classList.contains('fl-stage')||x.classList.contains('fl-panel--red')))stage=true;x=x.parentElement}if(stage)continue;const f=parse(cs.color);const g=bg(e);if(!f||g==='stage')continue;const l1=L(f.c),l2=L(g);const ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);if(ratio<3)out.push(ratio.toFixed(1)+' '+e.tagName+'.'+(e.className||'')+' "'+e.textContent.trim().slice(0,30)+'"')}return out.slice(0,6)});
  if(res.length) bad[`${w} ${r} ${rt}`]=res;
 }
 await ctx.close();}
console.log(JSON.stringify(bad,null,1)); await b.close()})();
