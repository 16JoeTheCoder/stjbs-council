const L=require('./m3lib.cjs');
const T=async(p,s='main')=>(await p.locator(s).first().innerText()).replace(/\n/g,' | ');
(async()=>{
 let {b,p}=await L.open(1440,900); await L.login(p,'raka');
 await p.goto(L.B+'#/checkin'); await p.waitForTimeout(500); await L.shot(p,'raka-checkin-1440');
 await p.click('button:has-text("Submit check-in")'); await p.waitForTimeout(1200); console.log('blank submit ->',p.url(),await p.locator('.fl-toast').innerText().catch(()=>'no toast'));
 await p.goto(L.B+'#/week'); await p.waitForTimeout(800); console.log('home after blank:', (await T(p,'.fl-hero__body')), 'panel', await p.locator('.fl-panel--red').count());
 await p.goto(L.B+'#/checkin'); const ta=p.locator('textarea'); await ta.nth(0).fill('Did <b>x</b> & "y" 😀'); await ta.nth(1).fill('Z'.repeat(600)); console.log('len',(await ta.nth(1).inputValue()).length);
 await p.click('button:has-text("Submit check-in")'); await p.waitForTimeout(1200); console.log('submit ->',p.url(),await p.locator('.fl-toast').innerText().catch(()=>'no toast'));
 console.log('home:', await T(p,'.fl-hero__body'), 'panel', await p.locator('.fl-panel--red').count(), 'mission', await p.locator('.fl-mission').count());
 await p.click('text=Edit check-in'); await p.waitForTimeout(500); console.log('prefilled', (await p.locator('textarea').nth(0).inputValue()), (await p.locator('textarea').nth(1).inputValue()).length);
 await p.locator('textarea').nth(2).fill('Nothing'); await p.click('button:has-text("Submit check-in")'); await p.waitForTimeout(1000);
 await p.goto(L.B+'#/checkin'); console.log('edit persisted', await p.locator('textarea').nth(2).inputValue());
 await p.goto(L.B+'#/people/raka%40stjbs.sch.id'); await p.waitForTimeout(600); console.log('profile:', (await T(p)).slice(0,500));
 await p.goto(L.B+'#/admin'); 
 console.log('LOGS',[...new Set(p.logs)].join(' || ')); await b.close();
 for(const r of ['budi','ariel']){ ({b,p}=await L.open(1440,900)); await L.login(p,r); await p.goto(L.B+'#/checkin'); await p.waitForTimeout(500); await p.locator('textarea').nth(0).fill('x'); await p.click('button:has-text("Submit check-in")'); await p.waitForTimeout(1200); console.log(r,'checkin ->',p.url(),await p.locator('.fl-toast').innerText().catch(()=>'no toast')); console.log([...new Set(p.logs)].join(' || ')); await b.close(); }
 // michael has check-in
 ({b,p}=await L.open(1440,900)); await L.login(p,'michael'); console.log('michael home:', await T(p,'.fl-hero__body'), 'panel', await p.locator('.fl-panel--red').count(),'mission',await p.locator('.fl-mission').count()); await L.shot(p,'michael-week-1440'); await b.close();
})().catch(e=>{console.error(e.message.slice(0,600));process.exit(1)});
