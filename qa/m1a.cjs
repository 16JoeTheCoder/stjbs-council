const {open,login}=require('./m1lib.cjs');
(async()=>{
 const {b,p}=await open();
 await p.goto('http://localhost:5173/#/admin'); await p.waitForTimeout(1500);
 console.log('SIGNED OUT admin:', (await p.innerText('body')).slice(0,200).replace(/\n/g,' | '));
 await p.screenshot({path:'screens-m1/01-signedout-admin.png'});
 await login(p,'ariel','wrongpass');
 console.log('WRONG PW:', (await p.innerText('body')).slice(0,300).replace(/\n/g,' | '));
 await p.screenshot({path:'screens-m1/02-wrongpw.png'});
 await login(p,'ariel');
 console.log('URL',p.url()); await p.screenshot({path:'screens-m1/03-ariel-home.png'});
 console.log((await p.innerText('body')).slice(0,400).replace(/\n/g,' | '));
 console.log(await p.$$eval('a,button',e=>e.map(x=>x.innerText.trim()).filter(Boolean).join(' / ')));
 console.log(p.logs);
 await b.close();
})();
