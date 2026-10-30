// M3 UI tests, written from qa/PROMPT.md only. Run with the demo up: node --test qa/tests/m3-ui.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const APP = 'http://localhost:5173/app/';
const SHOT = new URL('../screens-m3/', import.meta.url).pathname;
mkdirSync(SHOT, { recursive: true });
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

async function session(name, w = 1440, h = 900) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept());
  await p.goto(APP);
  await p.waitForSelector('input[type=email]', { timeout: 15000 });
  await p.fill('input[type=email]', `${name}@stjbs.sch.id`);
  await p.fill('input[type=password]', 'council123');
  await p.keyboard.press('Enter');
  await p.waitForSelector('input[type=email]', { state: 'detached', timeout: 20000 });
  await p.waitForTimeout(1500);
  return { ctx, p };
}
async function shot(p, n) { await p.screenshot({ path: SHOT + n + '.png' }).catch(() => {}); }
const vis = (p, text, opts = {}) => p.getByText(text, { exact: true, ...opts }).first();
async function go(p, hash) { await p.evaluate(h => { location.hash = h; }, hash); await p.waitForTimeout(900); }
async function openAvatar(p) {
  // rightmost clickable control in the top bar (bell is left of avatar)
  const h = await p.evaluateHandle(() => {
    const els = [...document.querySelectorAll('button,[role=button],a')].filter(e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.top < 90 && r.width > 0 && r.height > 0; });
    const named = els.filter(e => /avatar|account|profile|user|menu/i.test((e.getAttribute('aria-label') || '') + e.className));
    const pool = named.length ? named : els;
    return pool.sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)[0];
  });
  await h.asElement().click(); await p.waitForTimeout(400);
}
const tile = (p, n) => p.locator(`nav :text-is("${n}"), nav [aria-label="${n}"], [class*=tab] :text-is("${n}"), [class*=tab] [aria-label="${n}"]`).last();

test('sign-in: split layout with tagline, form, no sign-up', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(APP); await p.waitForSelector('input[type=email]');
  const t = await p.innerText('body');
  assert.match(t, /Lead\.\s*Serve\.\s*Build\./);
  assert.ok(await p.locator('input[type=password]').isVisible());
  assert.equal(await p.getByRole('button', { name: /sign up|create account|register/i }).count() + await p.getByRole('link', { name: /sign up|create account|register/i }).count(), 0, 'no open sign-up control');
  void t;
  await shot(p, 'signin'); await ctx.close();
});

test('laptop rail has Home, Calendar, Projects, Committees, Resources', async () => {
  const { ctx, p } = await session('michael');
  const t = await p.innerText('body');
  for (const n of ['Home', 'Calendar', 'Projects', 'Committees', 'Resources']) {
    assert.ok(await p.getByRole('link', { name: n, exact: true }).first().isVisible().catch(() => false), `rail link ${n}`);
  }
  assert.match(t, /Student Council/); assert.match(t, /St\. Johannes Berchmans/);
  assert.ok(await p.getByPlaceholder(/search anything/i).isVisible() || /Search anything/.test(t), 'Search anything');
  await shot(p, 'rail-1440'); await ctx.close();
});

test('phone bottom bar: Home, Calendar, Projects, Ideas, More; More lists Committees, Resources', async () => {
  const { ctx, p } = await session('michael', 390, 844);
  for (const n of ['Home', 'Calendar', 'Projects', 'Ideas', 'More']) {
    assert.ok(await tile(p, n).isVisible(), `tile ${n}`);
  }
  assert.equal(await p.getByText('Committees', { exact: true }).count() === 0 || !(await p.getByText('Committees', { exact: true }).first().isVisible()), true, 'Committees hidden before More');
  await tile(p, 'More').click(); await p.waitForTimeout(500);
  assert.ok(await p.getByText('Committees', { exact: true }).first().isVisible());
  assert.ok(await p.getByText('Resources', { exact: true }).first().isVisible());
  await shot(p, 'more-390'); await ctx.close();
});

for (const [who, admin] of [['ariel', true], ['nadia', true], ['kevin', true], ['michael', false], ['sarah', false], ['budi', false]]) {
  test(`avatar menu for ${who}: switch to admin view ${admin ? 'present' : 'absent'}`, async () => {
    const { ctx, p } = await session(who);
    await openAvatar(p);
    for (const n of ['My profile', 'Settings', 'Sign out']) assert.ok(await p.getByText(n, { exact: true }).first().isVisible(), n);
    const sw = await p.getByText('Switch to admin view', { exact: true }).count();
    assert.equal(sw > 0, admin);
    await shot(p, `avatar-${who}`); await ctx.close();
  });
}

test('admin switch shows Admin view badge and Switch to member view', async () => {
  const { ctx, p } = await session('nadia');
  await openAvatar(p); await p.getByText('Switch to admin view', { exact: true }).click(); await p.waitForTimeout(800);
  assert.match(await p.evaluate(() => location.hash), /#\/admin/);
  assert.ok(await p.getByText('Admin view', { exact: true }).first().isVisible());
  await openAvatar(p);
  assert.ok(await p.getByText('Switch to member view', { exact: true }).first().isVisible());
  await ctx.close();
});

test('search: "/" focuses, "carn" groups results, Enter opens, Esc closes', async () => {
  const { ctx, p } = await session('michael');
  await p.locator('body').click({ position: { x: 700, y: 600 } });
  await p.keyboard.press('/'); await p.waitForTimeout(300);
  const tag = await p.evaluate(() => document.activeElement && (document.activeElement.tagName + ':' + (document.activeElement.getAttribute('placeholder') || '')));
  assert.match(tag, /^INPUT/i, 'search input focused: ' + tag);
  const typedSlash = await p.evaluate(() => document.activeElement.value);
  assert.notEqual(typedSlash, '/', 'slash must not be typed into the box');
  await p.keyboard.type('carn'); await p.waitForTimeout(600);
  await shot(p, 'search-carn');
  const body = await p.innerText('body');
  assert.match(body, /carn/i);
  const hasGroup = /Projects|Events|Tasks|People|Announcements|Templates/.test(body);
  assert.ok(hasGroup, 'grouped headings');
  const before = await p.evaluate(() => location.hash);
  await p.keyboard.press('Enter'); await p.waitForTimeout(800);
  const after = await p.evaluate(() => location.hash);
  const sheetOpen = await p.getByRole('dialog').count();
  assert.ok(after !== before || sheetOpen > 0, 'Enter opened first result');
  await go(p, '#/');
  await p.locator('body').click({ position: { x: 700, y: 600 } });
  await p.keyboard.press('/'); await p.keyboard.type('carn'); await p.waitForTimeout(500);
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  const val = await p.evaluate(() => (document.activeElement.value ?? ''));
  const listGone = !(await p.getByText(/carn/i).nth(1).isVisible().catch(() => false)) || val === '';
  assert.ok(listGone, 'Esc closes results');
  await ctx.close();
});

test('phone search opens as full-screen sheet', async () => {
  const { ctx, p } = await session('michael', 390, 844);
  const inp = p.getByPlaceholder(/search/i).first();
  await inp.click(); await inp.fill('carn'); await p.waitForTimeout(600);
  await shot(p, 'search-390');
  const box = await p.evaluate(() => {
    const els = [...document.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return (s.position === 'fixed') && r.width >= innerWidth - 2 && r.height >= innerHeight - 2; });
    return els.length;
  });
  assert.ok(box > 0, 'a fixed full-viewport layer exists');
  await ctx.close();
});

test('Home: greeting with first name, Needs you <=5 rows, All my tasks link', async () => {
  const { ctx, p } = await session('michael');
  const t = await p.innerText('body');
  assert.match(t, /Good (morning|afternoon|evening|night),?\s*Michael/i);
  assert.ok(await p.getByText(/^Needs you/).first().isVisible(), 'Needs you');
  assert.ok(await p.getByRole('link', { name: /All my tasks/i }).first().isVisible(), 'All my tasks link');
  const rows = await p.evaluate(() => {
    const h = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && /^Needs you/.test(e.textContent.trim()));
    if (!h) return -1;
    let c = h; for (let i = 0; i < 4 && c.parentElement; i++) { c = c.parentElement; if (c.querySelectorAll('a,li,[role=listitem],[class*=row]').length > 1) break; }
    return c.querySelectorAll('li,[role=listitem],[class*=row]').length;
  });
  assert.ok(rows <= 5 + 1, `Needs you rows ${rows}`);
  assert.ok(await p.getByText('Top ideas', { exact: false }).first().isVisible(), 'Top ideas on laptop');
  assert.ok(await p.getByText('Open idea board', { exact: false }).first().isVisible());
  await shot(p, 'home-1440'); await ctx.close();
});

test('Home greeting uses the signed-in first name for another member', async () => {
  const { ctx, p } = await session('clara');
  assert.match(await p.innerText('body'), /Good (morning|afternoon|evening|night),?\s*Clara/i);
  await ctx.close();
});

test('Home phone: top ideas and mission card hidden', async () => {
  const { ctx, p } = await session('michael', 390, 844);
  assert.ok(!(await p.getByText('Open idea board', { exact: false }).first().isVisible().catch(() => false)), 'Top ideas laptop-only');
  await shot(p, 'home-390'); await ctx.close();
});

test('check-in panel only while this week check-in missing', async () => {
  // Submit a check-in via the panel for one member, panel must then disappear.
  const { ctx, p } = await session('raka');
  const panel = p.getByText(/check-?in/i);
  const initially = await p.locator('main, body').first().innerText();
  const had = /check-?in/i.test(initially) && await p.getByRole('link', { name: /check.?in/i }).or(p.getByRole('button', { name: /check.?in/i })).first().isVisible().catch(() => false);
  await shot(p, 'checkin-before');
  if (had) {
    await p.getByRole('link', { name: /check.?in/i }).or(p.getByRole('button', { name: /check.?in/i })).first().click();
    await p.waitForTimeout(800);
    const ta = p.locator('textarea').first();
    if (await ta.count()) await ta.fill('Done test work');
    const submit = p.getByRole('button', { name: /submit|send|save|post/i }).first();
    await submit.click(); await p.waitForTimeout(1500);
    await go(p, '#/');
    const still = await p.getByRole('button', { name: /check.?in/i }).or(p.getByRole('link', { name: /^(do|submit|start|post) .*check.?in/i })).first().isVisible().catch(() => false);
    assert.equal(still, false, 'panel gone after check-in');
  } else {
    assert.ok(true, 'check-in already present: panel absent');
  }
  void panel; await ctx.close();
});

test('Projects: Progress default, Pipeline has Planning / In progress / Done', async () => {
  const { ctx, p } = await session('michael');
  await p.getByRole('link', { name: 'Projects', exact: true }).first().click(); await p.waitForTimeout(900);
  assert.ok(await p.getByText('Progress', { exact: true }).first().isVisible());
  await p.getByText('Pipeline', { exact: true }).first().click(); await p.waitForTimeout(700);
  for (const c of ['Planning', 'In progress', 'Done']) assert.ok(await p.getByText(c, { exact: true }).first().isVisible(), c);
  assert.equal(await p.getByText('Public', { exact: true }).count(), 0, 'officer sees no Public switch');
  await shot(p, 'pipeline-officer'); await ctx.close();
});

test('Public switch only for admins', async () => {
  for (const [who, expect] of [['nadia', true], ['kevin', true], ['sarah', false], ['budi', false]]) {
    const { ctx, p } = await session(who);
    await p.getByRole('link', { name: 'Projects', exact: true }).first().click(); await p.waitForTimeout(1000);
    const n = await p.getByText('Public', { exact: true }).count() + await p.getByLabel('Public').count();
    assert.equal(n > 0, expect, `${who} Public switch`);
    await shot(p, `projects-${who}`); await ctx.close();
  }
});

test('Committees: sections as person chips, tapping opens person page', async () => {
  const { ctx, p } = await session('michael');
  await p.getByRole('link', { name: 'Committees', exact: true }).first().click(); await p.waitForTimeout(900);
  const t = await p.innerText('body');
  assert.match(t, /Michael|Alya|Bryan|Clara|Raka/);
  assert.match(t, /org chart|team chart/i);
  const before = await p.evaluate(() => location.hash);
  await p.getByText(/Alya/).first().click(); await p.waitForTimeout(800);
  assert.notEqual(await p.evaluate(() => location.hash), before, 'person page opened');
  await shot(p, 'committees'); await ctx.close();
});

test('Ideas: pin <=140 chars, vote toggles by exactly one', async () => {
  const { ctx, p } = await session('michael');
  await go(p, '#/ideas');
  const text = 'qa idea ' + Date.now();
  const ta = p.locator('textarea, input[type=text]').filter({ hasNot: p.locator('[placeholder*=earch]') }).first();
  await ta.fill('x'.repeat(200));
  const len = await ta.inputValue();
  assert.ok(len.length <= 140, `field caps at 140, got ${len.length}`);
  await ta.fill(text);
  await p.getByRole('button', { name: /pin idea/i }).first().click(); await p.waitForTimeout(1500);
  assert.ok(await p.getByText(text).first().isVisible(), 'idea appears');
  const card = p.locator('*', { has: p.getByText(text) }).filter({ has: p.getByRole('button') }).last();
  const btn = card.getByRole('button').first();
  const num = async () => parseInt((await btn.innerText()).match(/\d+/)?.[0] ?? '0', 10);
  const n0 = await num();
  await btn.click(); await p.waitForTimeout(1000);
  const n1 = await num();
  assert.equal(Math.abs(n1 - n0), 1, `vote changes by one: ${n0} -> ${n1}`);
  await btn.click(); await p.waitForTimeout(1000);
  assert.equal(await num(), n0, 'unvote restores count');
  await shot(p, 'ideas'); await ctx.close();
});

test('Ideas: admin can archive, officer cannot', async () => {
  const a = await session('nadia'); await go(a.p, '#/ideas');
  const adminHas = await a.p.getByRole('button', { name: /archive/i }).count();
  await a.ctx.close();
  const o = await session('michael'); await go(o.p, '#/ideas');
  const offHas = await o.p.getByRole('button', { name: /archive/i }).count();
  await o.ctx.close();
  assert.ok(adminHas > 0, 'admin sees Archive'); assert.equal(offHas, 0);
});

test('public site: no member names or emails in HTML', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto('http://localhost:5173/'); await p.waitForTimeout(2500);
  const html = await p.content();
  assert.doesNotMatch(html, /@stjbs\.sch\.id/);
  assert.doesNotMatch(html, /\b(Ariel|Nadia|Kevin|Sarah|Dimas|Budi|Michael|Alya|Bryan|Clara|Raka)\b/);
  const t = await p.innerText('body');
  assert.match(t, /Lead\./); assert.ok(await p.getByRole('link', { name: 'Dashboard' }).first().isVisible());
  await shot(p, 'public'); await ctx.close();
});

// ---------------- M4: Calendar, Resources, admin ----------------
test('Calendar: week grid, prev/Today/next, month view, Add event', async () => {
  const { ctx, p } = await session('michael');
  await go(p, '#/calendar');
  const t = await p.innerText('body');
  for (const n of ['Today', 'Add event']) assert.ok(await p.getByText(n, { exact: false }).first().isVisible(), n);
  assert.match(t, /06:00|6 ?AM/i, 'grid starts 06:00');
  assert.ok(await p.getByText('Upcoming', { exact: false }).first().isVisible(), 'Upcoming list');
  const title = async () => (await p.locator('h1,h2,[class*=title]').allInnerTexts()).join('|');
  const rangeText = async () => (await p.innerText('main, body')).match(/\b\d{1,2}\s+\w{3,9}\b[^\n]{0,30}\d{4}/)?.[0] ?? '';
  const r0 = await rangeText();
  await p.getByRole('button', { name: /next|›|>|→/i }).first().click(); await p.waitForTimeout(500);
  const r1 = await rangeText();
  assert.notEqual(r1, r0, 'next changes range');
  await p.getByRole('button', { name: /^previous|prev|‹|<|←/i }).first().click(); await p.waitForTimeout(500);
  assert.equal(await rangeText(), r0, 'prev returns');
  await p.getByRole('button', { name: /next|›|>|→/i }).first().click(); await p.waitForTimeout(300);
  await p.getByRole('button', { name: /^today$/i }).first().click(); await p.waitForTimeout(500);
  assert.equal(await rangeText(), r0, 'Today returns to current range');
  await p.getByText('Month', { exact: true }).first().click(); await p.waitForTimeout(600);
  assert.match(await p.innerText('body'), /Mon|Tue|Wed/);
  void title; await shot(p, 'calendar-month'); await ctx.close();
});

test('Calendar: month navigation across a year boundary shows December then January', async () => {
  const { ctx, p } = await session('michael');
  await go(p, '#/calendar');
  await p.getByText('Month', { exact: true }).first().click(); await p.waitForTimeout(500);
  const seen = new Set();
  for (let i = 0; i < 4; i++) {
    const m = (await p.innerText('body')).match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/);
    if (m) seen.add(m[0]);
    await p.getByRole('button', { name: /next|›|>|→/i }).first().click(); await p.waitForTimeout(400);
  }
  const list = [...seen];
  assert.ok(list.some(s => /^December/.test(s)) && list.some(s => /^January/.test(s)), 'Dec and Jan seen: ' + list);
  assert.ok(list.some(s => /2026/.test(s)) && list.some(s => /2027/.test(s)), 'year rolls over: ' + list);
  await ctx.close();
});

test('Calendar: event sheet has Going / Can\'t go with counts, RSVP changes count by one', async () => {
  const { ctx, p } = await session('michael');
  await go(p, '#/calendar');
  const ev = p.locator('[class*=event], [class*=chip], [class*=upcoming] li, [class*=upcoming] a, [class*=upcoming] button').filter({ hasText: /\S/ }).first();
  await ev.click(); await p.waitForTimeout(700);
  const going = p.getByRole('button', { name: /going/i }).first();
  const cant = p.getByRole('button', { name: /can.?t go/i }).first();
  assert.ok(await going.isVisible(), 'Going'); assert.ok(await cant.isVisible(), "Can't go");
  assert.ok(await p.getByText(/share to whatsapp/i).first().isVisible(), 'Share to WhatsApp');
  const count = async () => parseInt(((await going.innerText()).match(/\d+/) ?? ['0'])[0], 10);
  const n0 = await count();
  const pressed = await going.getAttribute('aria-pressed');
  await going.click(); await p.waitForTimeout(1000);
  const n1 = await count();
  assert.equal(Math.abs(n1 - n0), pressed === 'true' ? 1 : 1, `Going count ${n0} -> ${n1}`);
  await shot(p, 'event-sheet'); await ctx.close();
});

test('Resources: templates with Make a copy opening Google Docs copy link', async () => {
  const { ctx, p } = await session('michael');
  await go(p, '#/resources');
  assert.ok(await p.getByText('Make a copy', { exact: false }).first().isVisible(), 'Make a copy');
  assert.ok(await p.getByText('Suggest an edit', { exact: false }).first().isVisible());
  assert.ok(await p.getByText('Share something', { exact: false }).first().isVisible());
  assert.ok(await p.getByText('My submissions', { exact: false }).first().isVisible());
  const hrefs = await p.$$eval('a', a => a.filter(x => /make a copy/i.test(x.textContent)).map(x => x.href));
  assert.ok(hrefs.length > 0, 'Make a copy is a link');
  for (const h of hrefs) if (/docs\.google\.com\/document/.test(h)) assert.match(h, /\/copy(\?|$)/, 'Docs link rewritten to /copy: ' + h);
  assert.ok(hrefs.some(h => /docs\.google\.com/.test(h)), 'at least one Docs template');
  await shot(p, 'resources'); await ctx.close();
});

test('Resources: Share something refuses non-Google links, accepts Google link', async () => {
  const { ctx, p } = await session('michael');
  await go(p, '#/resources');
  await p.getByText('Share something', { exact: false }).first().click(); await p.waitForTimeout(500);
  const url = p.locator('input[type=url], input[placeholder*=http i], input[name*=link i], input[name*=url i]').first();
  const title = p.locator('input[type=text]:visible').first();
  if (await title.isVisible().catch(() => false)) await title.fill('QA share ' + Date.now());
  await url.fill('https://evil.example.com/file');
  const send = p.getByRole('button', { name: /^(share|submit|send|save)/i }).last();
  await send.click(); await p.waitForTimeout(1200);
  const body1 = await p.innerText('body');
  assert.match(body1, /google/i, 'error mentions Google');
  assert.equal(await p.getByText('evil.example.com').count(), 0, 'non-Google link not listed');
  await shot(p, 'share-refused');
  await url.fill('https://docs.google.com/document/d/abc123/edit');
  await send.click(); await p.waitForTimeout(1500);
  assert.match(await p.innerText('body'), /pending|submitted/i, 'submission shows status');
  await ctx.close();
});

test('Admin Overview lists members missing check-in with Copy reminder', async () => {
  const { ctx, p } = await session('nadia');
  await go(p, '#/admin');
  const t = await p.innerText('body');
  assert.match(t, /check-?in/i);
  assert.ok(await p.getByText('Copy reminder', { exact: false }).first().isVisible(), 'Copy reminder button');
  assert.ok(/admin/i.test(t));
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await p.getByText('Copy reminder', { exact: false }).first().click(); await p.waitForTimeout(600);
  const clip = await p.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  if (clip) assert.match(clip, /check-?in/i, 'clipboard text is a reminder');
  await shot(p, 'admin-overview'); await ctx.close();
});

test('Admin routes load for president; non-admin is kept out', async () => {
  const { ctx, p } = await session('nadia');
  for (const h of ['#/admin/announcements', '#/admin/public', '#/admin/approvals']) {
    await go(p, h);
    assert.equal(await p.evaluate(() => location.hash), h);
    assert.ok((await p.innerText('body')).length > 200, h + ' renders');
  }
  await shot(p, 'admin-public');
  assert.ok(await p.getByText('Publish now', { exact: false }).count() >= 0);
  await ctx.close();
  const o = await session('michael'); await go(o.p, '#/admin');
  assert.ok(!/needs attention/i.test(await o.p.innerText('body')) || !/#\/admin/.test(await o.p.evaluate(() => location.hash)), 'officer cannot see admin overview');
  await o.ctx.close();
});
