const L=require('./flib.cjs');
(async()=>{
 let {b,p}=await L.open(1440,900); await L.login(p,'michael');
 await p.goto(L.B+'#/p/t1'); await p.waitForTimeout(1500);
 for (const [d,txt] of [[0,'final pass: x'],[80,'final pass: x'],[0,'hello world again']]) {
  await p.click('#comment-box'); await p.fill('#comment-box',''); await p.keyboard.type('@Ra',{delay:d}); await p.keyboard.press('Enter'); await p.keyboard.type(txt,{delay:d});
  console.log(d, JSON.stringify(await p.inputValue('#comment-box')));
 }
 await p.fill('#comment-box','');
 await b.close();
})();
