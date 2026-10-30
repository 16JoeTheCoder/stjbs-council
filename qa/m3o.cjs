const L=require('./m3lib.cjs');
const T=async(p,s='main')=>(await p.locator(s).first().innerText()).replace(/\n/g,' | ');
(async()=>{
 let {b,p}=await L.open(1440,900); await L.login(p,'kevin');
 await p.click('.fl-user'); await p.click('text=Switch to admin view'); await p.waitForTimeout(600); console.log('admin url',p.url(),'badge',await p.locator('.fl-badge-admin').count(),'rail',await p.locator('.fl-rail .fl-nav a').allInnerTexts()); await L.shot(p,'kevin-adminview-1440');
 await p.reload(); await p.waitForSelector('.fl-app'); console.log('after reload badge',await p.locator('.fl-badge-admin').count(),p.url());
 await p.goto(L.B+'#/week'); await p.waitForTimeout(500); console.log('member route while admin view: badge',await p.locator('.fl-badge-admin').count(),'rail',await p.locator('.fl-rail .fl-nav a').allInnerTexts());
 await p.goto(L.B+'#/projects'); await p.waitForTimeout(300); console.log('projects in admin pref: badge',await p.locator('.fl-badge-admin').count());
 for(const t of ['Overview','Announcements','Members and roles','Check-ins and workload','Public site','Approvals and archive','Digest']){ await p.click(`.fl-rail .fl-nav a:has-text("${t}")`); await p.waitForTimeout(400); console.log('admin rail',t,p.url().split('#')[1],'|',(await T(p,'main h1')).slice(0,40)); }
 await p.click('.fl-user'); await p.click('text=Switch to member view'); await p.waitForTimeout(500); console.log('back to member',p.url(),'badge',await p.locator('.fl-badge-admin').count()); await p.reload(); await p.waitForSelector('.fl-app'); console.log('after reload badge',await p.locator('.fl-badge-admin').count(),p.url());
 console.log('LOGS',[...new Set(p.logs)].join(' || ')); await b.close();
 for(const r of ['sarah','raka']){ ({b,p}=await L.open(1440,900)); await L.login(p,r); await p.click('.fl-user'); console.log(r,'menu', (await T(p,'.fl-pop'))); await b.close(); }
 // phone admin
 ({b,p}=await L.open(390,844)); await L.login(p,'nadia'); await p.click('.fl-tabbar [aria-label="More"]'); await p.waitForTimeout(300); await L.shot(p,'nadia-more-390'); console.log('nadia more',await p.locator('.fl-more a, .fl-more button').allInnerTexts());
 await p.click('.fl-more >> text=Switch to admin view'); await p.waitForTimeout(500); console.log('phone admin',p.url(),await T(p,'main h1')); await L.shot(p,'nadia-admin-390');
 await p.click('.fl-tabbar [aria-label="More"]'); await p.waitForTimeout(300); console.log('more in admin',await p.locator('.fl-more a, .fl-more button').allInnerTexts());
 console.log('tabbar in admin view', await p.locator('.fl-tabbar a').evaluateAll(a=>a.map(x=>x.getAttribute('href')))); 
 await b.close();
 // sarah needs you, kevin digest
 ({b,p}=await L.open(1440,900)); await L.login(p,'sarah'); console.log('sarah home',(await T(p)).slice(0,500)); await b.close();
})().catch(e=>{console.error(e.message.slice(0,600));process.exit(1)});
