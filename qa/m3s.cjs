const L=require('./m3lib.cjs');
const fn=()=>{
 const parse=c=>{const m=c.match(/rgba?\(([^)]+)\)/);if(!m)return null;const a=m[1].split(/[ ,\/]+/).map(Number);return {r:a[0],g:a[1],b:a[2],a:a[3]===undefined?1:a[3]}};
 const lum=({r,g,b})=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(r)+.7152*f(g)+.0722*f(b)};
 const over=(f,b)=>({r:f.r*f.a+b.r*(1-f.a),g:f.g*f.a+b.g*(1-f.a),b:f.b*f.a+b.b*(1-f.a),a:1});
 const bgOf=e=>{let stack=[];let x=e;let img=false;while(x){const cs=getComputedStyle(x);if(cs.backgroundImage!=='none')img=true;const c=parse(cs.backgroundColor);if(c&&c.a>0){stack.push(c);if(c.a===1)break}x=x.parentElement}let base={r:0,g:0,b:0,a:1};for(let i=stack.length-1;i>=0;i--)base=over(stack[i],base);return {base,img}};
 const out=[];const seen=new Set();
 document.querySelectorAll('main *, .fl-rail *, .fl-top *').forEach(e=>{
  if(![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))return;
  const r=e.getBoundingClientRect();if(!r.width||!r.height)return;const cs=getComputedStyle(e);if(cs.visibility==='hidden'||cs.opacity==='0')return;
  const fg=parse(cs.color);const {base,img}=bgOf(e);const f=over({...fg,a:fg.a*(+cs.opacity||1)},base);
  const L1=lum(f),L2=lum(base);const ratio=(Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05);const size=parseFloat(cs.fontSize),bold=+cs.fontWeight>=700;const large=size>=24||(size>=18.66&&bold);
  const need=large?3:4.5;if(ratio<need){const k=e.className+'|'+e.textContent.trim().slice(0,30);if(!seen.has(k)){seen.add(k);out.push({t:e.textContent.trim().slice(0,40),cls:String(e.className).slice(0,30),ratio:+ratio.toFixed(2),need,img,size})}}
 });return out};
(async()=>{
 for(const theme of ['dark','light']){ for(const [w,h] of [[1440,900],[390,844]]){
  const {b,ctx,p}=await L.open(w,h,'light'); await ctx.addInitScript(t=>{try{localStorage.setItem('council-theme',t)}catch{}},theme);
  await p.goto(L.B); await p.waitForSelector('#email'); 
  await L.login(p,'raka');
  for(const rt of ['week','tasks','projects','projects?view=pipeline','ideas','committees','settings','activity','p/t0','checkin']){ await p.goto(L.B+'#/'+rt); await p.waitForTimeout(500); const r=await p.evaluate(fn); if(r.length) console.log(theme,w,rt,JSON.stringify(r)); }
  await b.close(); }}
})().catch(e=>{console.error(e.message.slice(0,600));process.exit(1)});
