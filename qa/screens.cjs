// Quality gate 4: screenshots of every screen against `npm run demo`, as compressed JPEGs in docs/qa/screens/.
// Run with the demo running (VS Code terminal, repo root): node qa/screens.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const out = 'docs/qa/screens';
fs.mkdirSync(out, { recursive: true });
const BASE = 'http://localhost:5173';
const MEMBER = ['week', 'tasks', 'checkin', 'calendar', 'calendar?v=month', 'calendar?e=e1', 'projects', 'projects?view=pipeline', 'p/carnival',
  'p/carnival?view=timeline', 'p/carnival?view=team', 'p/t0', 'meeting/carnival', 'committees', 'people/raka@stjbs.sch.id', 'resources', 'ideas', 'activity', 'settings'];
const EXEC = ['digest', 'templates'];
const ADMIN = ['admin', 'admin/announcements', 'admin/members', 'admin/workload', 'admin/public', 'admin/approvals', 'admin/digest'];
const SIZES = [[1440, 900, 'laptop'], [390, 844, 'phone']];
const LIGHT = new Set(['week']);
const name = (r) => r.replace(/[^a-z0-9]+/gi, '-').replace(/-$/, '');
const errors = [];

async function shoot(browser, [w, h, size], theme, who, routes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript((t) => localStorage.setItem('council-theme', t), theme);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${who} ${size}: ${e.message}`));
  await p.goto(`${BASE}/app/`); await p.waitForSelector('#email');
  await p.screenshot({ path: `${out}/sign-in-${size}-${theme}.jpg`, type: 'jpeg', quality: 60, fullPage: true });
  await p.fill('#email', `${who}@stjbs.sch.id`); await p.fill('#password', 'council123'); await p.click('form button');
  await p.waitForSelector('.fl-app', { timeout: 20000 }); await p.waitForTimeout(2500);
  for (const r of routes) {
    if (theme === 'light' && !LIGHT.has(r)) continue;
    await p.goto(`${BASE}/app/#/${r}`); await p.waitForTimeout(1500);
    await p.screenshot({ path: `${out}/${name(r)}-${size}-${theme}.jpg`, type: 'jpeg', quality: 60, fullPage: true });
  }
  await ctx.close();
}

(async () => {
  const b = await chromium.launch();
  for (const size of SIZES) {
    for (const theme of ['dark', 'light']) {
      const pub = await (await b.newContext({ viewport: { width: size[0], height: size[1] } })).newPage();
      await pub.addInitScript((t) => localStorage.setItem('council-theme', t), theme);
      await pub.goto(`${BASE}/`); await pub.waitForTimeout(2500);
      await pub.screenshot({ path: `${out}/public-site-${size[2]}-${theme}.jpg`, type: 'jpeg', quality: 60, fullPage: true });
      await shoot(b, size, theme, 'raka', MEMBER);
    }
    await shoot(b, size, 'dark', 'kevin', [...EXEC, ...ADMIN]);
  }
  await b.close();
  console.log(`ok ${fs.readdirSync(out).length} screenshots in ${out}${errors.length ? `\nPAGE ERRORS:\n${errors.join('\n')}` : ', no page errors'}`);
})();
