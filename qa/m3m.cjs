const L=require('./m3lib.cjs');
(async()=>{
 for(const r of ['kevin','nadia','ariel']){
 let {b,p}=await L.open(1440,900); await L.login(p,r);
 await p.goto(L.B+'#/admin/members'); await p.waitForTimeout(700);
 const out=await p.locator('tbody tr').evaluateAll(rs=>rs.map(x=>x.children[0].textContent+' ('+x.children[2].textContent+'): '+[...x.querySelectorAll('button')].map(b=>b.textContent).join('/')));
 console.log(r,JSON.stringify(out,null,0)); await b.close();}
 // kevin edits nadia (intended), kevin cannot edit self role
})();
