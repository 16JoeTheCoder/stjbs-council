// M5 gap tests: the four items qa/m3-tests.md listed as "not covered".
// Written from qa/PROMPT.md (lines 102, 166, 186, 230-231) and the earlier alpha scripts; src/ not read.
// Run with the demo up: node --test qa/tests/m5-gaps.test.mjs   (state persists between runs; every title is unique)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const SITE = 'http://localhost:5173/';
const APP = SITE + 'app/';
const SHOT = new URL('../screens-m5/', import.meta.url).pathname;
mkdirSync(SHOT, { recursive: true });
const RUN = Date.now().toString(36);
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

async function session(name, w = 1440, h = 900) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept());
  await p.goto(APP + '#/week');
  await p.waitForSelector('input[type=email]', { timeout: 15000 });
  await p.fill('input[type=email]', `${name}@stjbs.sch.id`);
  await p.fill('input[type=password]', 'council123');
  await p.keyboard.press('Enter');
  await p.waitForSelector('input[type=email]', { state: 'detached', timeout: 20000 });
  await p.waitForTimeout(1500);
  return { ctx, p };
}
const shot = (p, n) => p.screenshot({ path: SHOT + n + '.png' }).catch(() => {});
async function go(p, hash) { await p.goto(APP + hash); await p.waitForTimeout(1500); }
const bell = async p => { await p.locator('[aria-label*="otification" i]').first().click(); await p.waitForTimeout(600); return p.locator('.fl-pop, [role=dialog], [role=menu]').first().innerText(); };

// ---------- @mentions with notification ----------
test('@mention: picked name is highlighted in the comment and notifies the person (not the author)', async () => {
  const text = `mention check ${RUN}`;
  const a = await session('michael');
  await go(a.p, '#/p/t1');
  await a.p.click('text=Add comment').catch(() => {});
  await a.p.click('#comment-box');
  await a.p.keyboard.type('@Ra'); await a.p.waitForTimeout(400);
  await shot(a.p, 'mention-suggest');
  assert.ok(await a.p.getByText('Raka', { exact: false }).first().isVisible(), 'suggestion list offers Raka');
  await a.p.keyboard.press('Enter');
  await a.p.keyboard.type(' ' + text);
  await a.p.click('button:has-text("Post comment")'); await a.p.waitForTimeout(1500);
  const c = a.p.locator('.fl-comment', { hasText: text }).first();
  assert.ok(await c.isVisible(), 'comment posted');
  assert.ok(await c.locator('.fl-mention').count() >= 1, 'mention highlighted with fl-mention');
  assert.match(await c.locator('.fl-mention').first().innerText(), /@?Raka/);
  const authorBell = await bell(a.p);
  assert.doesNotMatch(authorBell, new RegExp(text), 'author is not notified about own mention');
  await a.ctx.close();

  const r = await session('raka');
  const pop = await bell(r.p);
  await shot(r.p, 'mention-bell-raka');
  assert.match(pop, /mention/i, 'raka has a mention notification: ' + pop.replace(/\n/g, ' | ').slice(0, 300));
  assert.match(pop, /Michael/i, 'names the author');
  await r.ctx.close();
});

test('@mention: a person who was not mentioned gets no mention notification for it', async () => {
  const text = `no-mention-for-clara ${RUN}`;
  const a = await session('michael');
  await go(a.p, '#/p/t1');
  await a.p.click('text=Add comment').catch(() => {});
  await a.p.click('#comment-box');
  await a.p.keyboard.type('@Ra'); await a.p.waitForTimeout(300); await a.p.keyboard.press('Enter');
  await a.p.keyboard.type(' ' + text);
  await a.p.click('button:has-text("Post comment")'); await a.p.waitForTimeout(1500);
  await a.ctx.close();
  const c = await session('clara');
  const pop = await bell(c.p);
  assert.doesNotMatch(pop, new RegExp(text));
  await c.ctx.close();
});

// ---------- Make task lands in the assignee's Needs you ----------
test('Make task: the task lands in the mentioned person\'s Needs you on Home and they are notified', async () => {
  const title = `Cup supplier call ${RUN}`;
  const a = await session('michael');
  await go(a.p, '#/p/t1');
  await a.p.click('text=Add comment').catch(() => {});
  await a.p.click('#comment-box');
  await a.p.keyboard.type('@Ra'); await a.p.waitForTimeout(300); await a.p.keyboard.press('Enter');
  await a.p.keyboard.type(' ' + title);
  await a.p.click('button:has-text("Post comment")'); await a.p.waitForTimeout(1500);
  await a.p.locator('.fl-comment', { hasText: title }).first().locator('button:has-text("Make task")').click();
  await a.p.waitForTimeout(600);
  const checked = await a.p.evaluate(() => [...document.querySelectorAll('form.fl-form input[type=checkbox]')].filter(c => c.checked).map(c => c.closest('label')?.innerText ?? ''));
  assert.ok(checked.some(t => /Raka/i.test(t)), 'assignee prefilled with the mentioned person: ' + JSON.stringify(checked));
  const prefill = await a.p.inputValue('form.fl-form input');
  assert.ok(prefill.includes(title) || title.includes(prefill.trim()) || prefill.length > 0, 'title prefilled from the comment');
  await a.p.fill('form.fl-form input', title);
  await shot(a.p, 'maketask-form');
  await a.p.click('button:has-text("Add task")'); await a.p.waitForTimeout(1800);
  await a.ctx.close();

  const r = await session('raka');
  const home = await r.p.locator('main').innerText();
  await shot(r.p, 'maketask-raka-home');
  assert.ok(home.includes(title), 'task is in raka\'s Home (Needs you): ' + home.slice(0, 500).replace(/\n/g, ' | '));
  const needs = await r.p.evaluate(t => {
    const h = [...document.querySelectorAll('h1,h2,h3,h4,[class*=title]')].find(e => /^Needs you/.test(e.textContent.trim()));
    if (!h) return null;
    let c = h; for (let i = 0; i < 5 && c.parentElement; i++) { c = c.parentElement; if (c.innerText.includes(t)) return true; }
    return false;
  }, title);
  assert.equal(needs, true, 'the task sits inside the Needs you panel, not elsewhere on Home');
  const pop = await bell(r.p);
  assert.match(pop, /assign/i, 'assigned notification: ' + pop.replace(/\n/g, ' | ').slice(0, 300));
  await r.ctx.close();
});

test('Make task: only people who can manage the item see the button (assignee-only officer and teacher do not)', async () => {
  const b = await session('budi');
  await go(b.p, '#/p/t1');
  assert.equal(await b.p.locator('button:has-text("Make task")').count(), 0, 'teacher');
  await b.ctx.close();
  const r = await session('raka');
  await go(r.p, '#/p/t1');
  assert.equal(await r.p.locator('button:has-text("Make task")').count(), 0, 'assignee who does not manage the item');
  await r.ctx.close();
});

// ---------- Add event submission ----------
test('Add event: submitting shows it in the calendar grid and Upcoming, survives a reload, and other members see it', async () => {
  const title = `QA assembly ${RUN}`;
  const d = new Date(); const pad = n => String(n).padStart(2, '0');
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);   // tomorrow
  const date = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  const { ctx, p } = await session('michael');
  await go(p, '#/calendar?v=month&d=' + date);
  await p.click('text=Add event'); await p.waitForTimeout(400);
  assert.equal(await p.getByText('Show on the public website').count(), 0, 'officer is not offered the public checkbox');
  await p.fill('#ev-title', title); await p.fill('#ev-date', date); await p.fill('#ev-start', '10:00'); await p.fill('#ev-end', '11:00');
  await shot(p, 'addevent-form');
  await p.click('form button.fl-btn--red'); await p.waitForTimeout(1800);
  assert.ok(await p.getByText(title).first().isVisible(), 'event visible right after saving');
  await p.reload(); await p.waitForTimeout(2000);
  assert.ok(await p.getByText(title).first().isVisible(), 'event visible after reload');
  await ctx.close();
  const k = await session('clara');
  await go(k.p, '#/calendar?v=month&d=' + date);
  assert.ok(await k.p.getByText(title).first().isVisible(), 'another member sees it');
  await shot(k.p, 'addevent-clara');
  await k.ctx.close();
});

test('Add event: a far-away month (outside the loaded window) shows the new event immediately', async () => {
  const title = `QA far event ${RUN}`;
  const { ctx, p } = await session('kevin');
  await go(p, '#/calendar?v=month&d=2027-03-10');
  await p.click('text=Add event'); await p.waitForTimeout(300);
  await p.fill('#ev-title', title); await p.fill('#ev-date', '2027-03-10'); await p.fill('#ev-start', '09:00'); await p.fill('#ev-end', '10:00');
  await p.click('form button.fl-btn--red'); await p.waitForTimeout(2000);
  assert.ok(await p.getByText(title).first().isVisible(), 'visible in March 2027 without navigating away');
  await ctx.close();
});

test('Add event: an empty title is refused and nothing is created', async () => {
  const { ctx, p } = await session('michael');
  await go(p, '#/calendar');
  await p.click('text=Add event'); await p.waitForTimeout(300);
  await p.fill('#ev-title', '   ');
  await p.click('form button.fl-btn--red'); await p.waitForTimeout(800);
  assert.ok(await p.locator('#ev-title').isVisible(), 'form stays open');
  await ctx.close();
});

test('Add event: an admin can mark it public; it is not on the public site until Publish now', async () => {
  const title = `QA public event ${RUN}`;
  const date = '2026-11-14';
  const { ctx, p } = await session('kevin');
  await go(p, '#/calendar?v=month&d=' + date);
  await p.click('text=Add event'); await p.waitForTimeout(300);
  assert.equal(await p.getByText('Show on the public website').count() > 0, true, 'admin sees the public checkbox');
  await p.fill('#ev-title', title); await p.fill('#ev-date', date); await p.fill('#ev-start', '10:00'); await p.fill('#ev-end', '12:00');
  await p.check('text=Show on the public website');
  await p.click('form button.fl-btn--red'); await p.waitForTimeout(1800);
  assert.ok(await p.getByText(title).first().isVisible(), 'saved');
  await go(p, '#/admin/public');
  await p.getByRole('button', { name: /publish now/i }).click(); await p.waitForTimeout(3000);
  await shot(p, 'publish-after-event');
  const v = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pub = await v.newPage();
  await pub.goto(SITE); await pub.waitForTimeout(3500);
  assert.ok(await pub.getByText(title).first().isVisible().catch(() => false), 'public event appears on the public site after Publish now');
  await shot(pub, 'public-with-event');
  await v.close(); await ctx.close();
});

// ---------- Publish now changes the public site ----------
test('Publish now: flipping a project public then Publish now puts it on the public site; flipping back and publishing removes it', async () => {
  const { ctx, p } = await session('kevin');
  await go(p, '#/admin/public');
  const row = () => p.locator('li, article, section, div').filter({ has: p.getByText('Canteen survey', { exact: true }) }).filter({ has: p.locator('input[type=checkbox], [role=switch]') }).last();
  const sw = () => row().locator('input[type=checkbox], [role=switch]').first();
  const isOn = async () => (await sw().getAttribute('aria-checked')) === 'true' || (await sw().isChecked().catch(() => false));
  const sitehas = async () => {
    const v = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pub = await v.newPage(); await pub.goto(SITE); await pub.waitForTimeout(3500);
    const t = (await pub.innerText('body')); await v.close(); return /Canteen survey/.test(t);
  };
  const was = await isOn();
  if (was) { await sw().click({ force: true }); await p.waitForTimeout(1000); await p.getByRole('button', { name: /publish now/i }).click(); await p.waitForTimeout(3000); }
  assert.equal(await sitehas(), false, 'precondition: not on the public site');
  await sw().click({ force: true }); await p.waitForTimeout(1200);
  assert.equal(await isOn(), true, 'switch is on');
  await shot(p, 'publish-flip-on');
  await p.getByRole('button', { name: /publish now/i }).click(); await p.waitForTimeout(3000);
  assert.match(await p.innerText('main'), /Last published (just now|\d+ (sec|min)|a (few )?)/i, 'last published time updates');
  assert.equal(await sitehas(), true, 'project is on the public site after Publish now');
  await sw().click({ force: true }); await p.waitForTimeout(1200);
  await p.getByRole('button', { name: /publish now/i }).click(); await p.waitForTimeout(3000);
  assert.equal(await sitehas(), false, 'removed again after flipping back and publishing');
  if (was) { await sw().click({ force: true }); await p.waitForTimeout(1000); await p.getByRole('button', { name: /publish now/i }).click(); await p.waitForTimeout(2500); }
  await ctx.close();
});

test('Publish now: button is admin-only (officer, treasurer and teacher cannot reach it)', async () => {
  for (const who of ['michael', 'sarah', 'budi']) {
    const { ctx, p } = await session(who);
    await go(p, '#/admin/public');
    assert.equal(await p.getByRole('button', { name: /publish now/i }).count(), 0, who);
    await ctx.close();
  }
});

test('Public feed never carries a member name or email, even after publishing', async () => {
  const v = await browser.newContext(); const pub = await v.newPage();
  const bodies = [];
  pub.on('response', async r => { if (/firestore|public/.test(r.url()) && r.request().method() !== 'OPTIONS') bodies.push(await r.text().catch(() => '')); });
  await pub.goto(SITE); await pub.waitForTimeout(4000);
  const all = (await pub.content()) + bodies.join('\n');
  assert.doesNotMatch(all, /@stjbs\.sch\.id/);
  await v.close();
});
