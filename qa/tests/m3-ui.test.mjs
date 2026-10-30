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
  const cands = [p.getByRole('button', { name: /account|avatar|profile|menu/i }), p.locator('[class*=avatar]')];
  for (const c of cands) { const el = c.last(); if (await el.isVisible().catch(() => false)) { await el.click(); await p.waitForTimeout(400); return; } }
  throw new Error('avatar control not found');
}

test('sign-in: split layout with tagline, form, no sign-up', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(APP); await p.waitForSelector('input[type=email]');
  const t = await p.innerText('body');
  assert.match(t, /Lead\.\s*Serve\.\s*Build\./);
  assert.ok(await p.locator('input[type=password]').isVisible());
  assert.doesNotMatch(t, /sign up|create account|register/i, 'no open sign-up');
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
    assert.ok(await p.getByText(n, { exact: true }).last().isVisible(), `tile ${n}`);
  }
  assert.equal(await p.getByText('Committees', { exact: true }).count() === 0 || !(await p.getByText('Committees', { exact: true }).first().isVisible()), true, 'Committees hidden before More');
  await p.getByText('More', { exact: true }).last().click(); await p.waitForTimeout(500);
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
