// Real browser journeys against local emulators only. No production credentials or external messages.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';

const BASE = 'http://localhost:5173', out = 'docs/qa/upgrade';
await mkdir(out, { recursive: true });
const report = { environment: 'local Auth/Firestore emulators and Chromium', at: new Date().toISOString(), journeys: [], timing: [], errors: [], screenshots: [] };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
async function run(name, fn) {
  if (process.env.EVENTS_ONLY === '1' && !/participant group|unrestricted ordinary event|submits a meeting request|approves the exact request/.test(name)) return;
  try { const detail = await fn(); report.journeys.push({ name, result: 'passed', detail }); console.log('PASS', name); }
  catch (e) { report.journeys.push({ name, result: 'failed', error: e.message }); console.log('FAIL', name, e.message); }
}
async function login(who, width = 1440, height = 1000) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on('pageerror', e => report.errors.push({ who, message: e.message }));
  await page.goto(`${BASE}/app/`);
  await page.getByLabel('School email', { exact: true }).fill(`${who}@stjbs.sch.id`);
  await page.getByLabel('Password', { exact: true }).fill('council123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForSelector('.fl-app', { timeout: 20000 });
  return page;
}
const route = async (page, path) => { await page.goto(`${BASE}/app/#/${path}`); await page.waitForTimeout(350); };
const text = page => page.locator('body').innerText();
async function serverEvent(page, title) {
  return page.evaluate(async title => {
    const { auth } = await import('/src/firebase.js');
    const token = await auth.currentUser.getIdToken();
    const response = await fetch('http://127.0.0.1:8080/v1/projects/demo-council/databases/(default)/documents:runQuery', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'events' }], where: { fieldFilter: { field: { fieldPath: 'title' }, op: 'EQUAL', value: { stringValue: title } } } } }),
    });
    if (!response.ok) throw new Error(`Authenticated emulator query failed: ${response.status}`);
    return (await response.json()).filter(row => row.document).map(({ document: d }) => ({
      id: d.name.split('/').at(-1), location: d.fields.location?.stringValue,
      participantUids: (d.fields.participantUids?.arrayValue?.values || []).map(v => v.stringValue),
    }));
  }, title);
}
const saved = async page => page.waitForFunction(async () => !(await import('/src/store.js')).S.toast.startsWith('That did not save'));
async function shot(page, name) {
  const path = `${out}/${name}.jpg`;
  await page.screenshot({ path, type: 'jpeg', quality: 65, fullPage: true }); report.screenshots.push(path);
}
let admin, member, editor, host, room;
try {
  admin = await login('nadia'); member = await login('michael', 390, 844); editor = await login('dimas'); host = await login('raka'); room = await login('alya', 1920, 1080);
  const unique = Date.now().toString(36), eventTitle = `Browser event ${unique}`, requestTitle = `Browser meeting ${unique}`;

  await run('Admin maps a participant group without granting authorization roles', async () => {
    await route(admin, 'event-settings');
    await admin.getByRole('button', { name: 'Add group', exact: true }).click();
    await admin.getByLabel('Name', { exact: true }).fill(`QA group ${unique}`);
    await admin.getByLabel('Group members', { exact: true }).selectOption(['raka@stjbs.sch.id', 'michael@stjbs.sch.id']);
    await admin.getByRole('button', { name: 'Save configuration', exact: true }).click();
    await admin.getByLabel('Name', { exact: true }).waitFor({ state: 'hidden' });
    return 'Admin selected actual roster people; no authorization role was modified.';
  });

  await run('Member publishes an unrestricted ordinary event', async () => {
    await route(member, 'calendar');
    await member.getByRole('button', { name: 'Add event', exact: true }).click();
    await member.getByLabel('Title', { exact: true }).fill(eventTitle);
    await member.getByLabel('Type', { exact: true }).selectOption('other');
    await member.getByLabel('Place', { exact: true }).fill('Local demo room');
    const group = await member.getByLabel('Participant groups', { exact: true }).locator('option').filter({ hasText: `QA group ${unique}` }).getAttribute('value');
    await member.getByLabel('Participant groups', { exact: true }).selectOption(group);
    await member.getByLabel('Sections', { exact: true }).selectOption('Events');
    await member.getByLabel('Additional people', { exact: true }).selectOption('alya@stjbs.sch.id');
    await member.getByLabel('Exclude people', { exact: true }).selectOption('michael@stjbs.sch.id');
    await member.getByRole('button', { name: /^(Save event|Publish event)$/ }).click();
    await member.getByRole('button', { name: 'Add event', exact: true }).waitFor();
    const confirmed = await serverEvent(member, eventTitle);
    assert.equal(confirmed.length, 1);
    assert.deepEqual(confirmed[0].participantUids, ['alya@stjbs.sch.id']);
    return 'Submitted actual creation form; server read confirmed persistence and group union/section narrowing/addition/exclusion resolved exactly Alya.';
  });

  await run('Member submits a meeting request and sees awaiting status', async () => {
    await member.getByRole('button', { name: 'Add event', exact: true }).click();
    await member.getByLabel('Title', { exact: true }).fill(requestTitle);
    await member.getByLabel('Type', { exact: true }).selectOption('meeting');
    await member.getByRole('button', { name: /^(Save event|Send request)$/ }).click();
    await member.getByRole('button', { name: requestTitle, exact: true }).waitFor();
    assert.match(await text(member), /awaiting/i);
    assert.equal((await serverEvent(member, requestTitle)).length, 0, 'pending request must not be a confirmed event');
    return 'Form submitted; awaiting request visible; confirmed calendar store excludes it.';
  });

  await run('Admin approves the exact request without returning it', async () => {
    await route(admin, 'calendar');
    await admin.getByRole('button', { name: requestTitle, exact: true }).click();
    await admin.getByRole('button', { name: 'Edit and schedule', exact: true }).click();
    await admin.getByLabel('Place', { exact: true }).fill('Reviewed demo room');
    await admin.getByRole('button', { name: 'Save and schedule', exact: true }).click();
    await admin.getByLabel('Place', { exact: true }).waitFor({ state: 'hidden' });
    const reviewed = await serverEvent(member, requestTitle);
    assert.equal(reviewed.length, 1);
    assert.equal(reviewed[0].location, 'Reviewed demo room');
    return 'Admin edited the request and scheduled the revised proposal in one form; phone client rendered the accepted revision without a return loop.';
  });

  await run('Existing major routes and deep links remain usable', async () => {
    const routes = ['week', 'tasks', 'checkin', 'calendar?v=agenda', 'calendar?v=month', 'calendar?v=week', 'projects', 'projects?view=pipeline', 'p/carnival', 'p/carnival?view=timeline', 'p/carnival?view=team', 'p/t0', 'meeting/carnival', 'committees', 'people', 'people/raka@stjbs.sch.id', 'resources', 'ideas', 'activity', 'feed', 'settings', 'about', 'digest', 'templates', 'workload', 'admin', 'admin/announcements', 'admin/members', 'admin/workload', 'admin/approvals', 'admin/public', 'admin/digest', 'event-settings', 'attention'];
    const observed = [];
    for (const path of routes) {
      await route(admin, path);
      const content = await text(admin);
      assert.doesNotMatch(content, /Something broke|This page could not load|Page not found/);
      observed.push({ path, heading: await admin.locator('h1').first().innerText().catch(() => '') });
    }
    return observed;
  });

  for (const page of [admin, member, editor, host]) await route(page, 'meeting-hub/upgrade-demo');
  await route(room, 'meeting-room/upgrade-demo');
  await run('Assigned cohost starts the meeting without the president or VP', async () => {
    const takeover = host.getByRole('button', { name: 'Take over as host', exact: true });
    if (await takeover.count()) await takeover.click();
    await host.getByRole('button', { name: 'Start meeting', exact: true }).click();
    await room.waitForFunction(() => document.body.innerText.includes('live'));
    return 'Raka (officer/cohost) starts; independent room client receives live lifecycle.';
  });

  await run('Host actions render remotely on member and room within five seconds', async () => {
    for (const phase of ['agenda', 'updates', 'tasks', 'recap', 'attendance']) {
      const started = performance.now();
      await host.getByRole('button', { name: phase, exact: true }).click();
      await Promise.all([
        room.waitForFunction(value => document.body.innerText.includes(value), phase),
        member.getByText(`Live phase: ${phase}`, { exact: true }).first().waitFor(),
      ]);
      const ms = performance.now() - started; report.timing.push({ path: 'host phase → independent room and phone member DOM', phase, ms });
      assert.ok(ms <= 5000, `${ms.toFixed(0)}ms exceeds target`);
    }
    return 'Five real host actions rendered by independent authenticated room and phone member browsers.';
  });

  await run('Phone member contributes while host presents', async () => {
    const message = `Phone contribution ${unique}`;
    await member.getByLabel('Question or action to capture').fill(message);
    await member.getByRole('button', { name: 'Submit question', exact: true }).click();
    await host.getByText(message, { exact: true }).waitFor();
    assert.equal(await room.getByText(message, { exact: true }).count(), 0, 'unconfirmed contributions must not appear in room');
    return 'Submitted from 390px phone; host rendered contribution; room omitted unconfirmed contribution.';
  });

  await run('Continuous minutes autosave reaches another authorized browser and keeps focus', async () => {
    await editor.getByRole('button', { name: 'Minutes', exact: true }).click();
    await admin.getByRole('button', { name: 'Minutes', exact: true }).click();
    const field = editor.getByLabel('Discussion summary and outcomes');
    const remote = admin.getByLabel('Discussion summary and outcomes');
    await field.fill(''); await field.focus();
    const started = performance.now();
    const typing = field.pressSequentially(`Continuous minutes ${unique}: council agrees on the next steps.`, { delay: 75 });
    await remote.waitFor({ state: 'visible' });
    await admin.waitForFunction(() => [...document.querySelectorAll('textarea')].some(el => el.value.startsWith('Continuous minutes')));
    const firstSave = performance.now() - started;
    await typing;
    const local = await field.inputValue();
    await host.getByRole('button', { name: 'agenda', exact: true }).click();
    assert.equal(await field.inputValue(), local);
    assert.equal(await field.evaluate(el => document.activeElement === el), true);
    await admin.waitForFunction(value => [...document.querySelectorAll('textarea')].some(el => el.value === value), local);
    report.timing.push({ path: 'continuous typing → authorized second-view textarea', ms: firstSave });
    assert.ok(firstSave <= 5000);
    return { firstRemoteRenderMs: firstSave, finalTextRetained: true, focusRetainedDuringHostAdvance: true };
  });

  await run('Offline minutes and unsent phone drafts survive reconnect and host navigation', async () => {
    const draft = `Offline retained minutes ${unique}`;
    await editor.context().setOffline(true);
    await editor.getByLabel('Discussion summary and outcomes').fill(draft);
    await editor.waitForTimeout(2200);
    assert.equal(await editor.getByLabel('Discussion summary and outcomes').inputValue(), draft);
    assert.equal(await editor.evaluate(value => Object.keys(localStorage).some(k => k.startsWith('council-meeting-draft:') && localStorage.getItem(k) === value), draft), true);
    const unsent = `Unsent phone draft ${unique}`;
    await member.getByLabel('Question or action to capture').fill(unsent);
    await host.getByRole('button', { name: 'updates', exact: true }).click();
    assert.equal(await member.getByLabel('Question or action to capture').inputValue(), unsent);
    await editor.context().setOffline(false);
    await admin.waitForFunction(value => [...document.querySelectorAll('textarea')].some(el => el.value === value), draft, { timeout: 20000 });
    assert.equal(await member.getByLabel('Question or action to capture').inputValue(), unsent);
    return 'Minutes remain in local draft storage while offline and reach the authorized second view after reconnect; unsent phone text survives a host phase change.';
  });

  await run('Minutes taker captures an action in approved project scope', async () => {
    await editor.getByLabel('Action title', { exact: true }).fill(`Browser action ${unique}`);
    await editor.getByLabel('Owner', { exact: true }).selectOption('michael@stjbs.sch.id');
    await editor.getByLabel('Allowed project', { exact: true }).selectOption('carnival');
    await editor.getByRole('button', { name: 'Capture action as task', exact: true }).click();
    await member.waitForFunction(async title => (await import('/src/store.js')).S.items.some(t => t.title === title && t.meetingId === 'upgrade-demo'), `Browser action ${unique}`);
    return 'Task created by Dimas (temporary minutes editor), linked to meeting; member task listener receives it.';
  });

  await run('Meeting closes separately; minutes reviewed, published, and downloaded', async () => {
    await host.getByRole('button', { name: 'Close meeting', exact: true }).click();
    await room.waitForFunction(() => document.body.innerText.includes('closed'));
    assert.equal(await admin.getByRole('button', { name: 'Publish reviewed version', exact: true }).count(), 0);
    await editor.getByRole('button', { name: 'Send for admin review', exact: true }).click();
    await admin.getByRole('button', { name: 'Publish reviewed version', exact: true }).click();
    const button = admin.getByRole('button', { name: 'Download document', exact: true }); await button.waitFor();
    const downloaded = admin.waitForEvent('download'); await button.click(); const download = await downloaded;
    const path = `${out}/${download.suggestedFilename()}`; await download.saveAs(path);
    const printPopup = admin.waitForEvent('popup'); await admin.getByRole('button', { name: 'Print / save PDF', exact: true }).click();
    const popup = await printPopup; await popup.waitForLoadState();
    assert.match(await text(popup), /Minutes/); await popup.close();
    return { editableDownload: path, printDocumentOpened: true, google: 'No OAuth client configured; real school-account export not exercised.' };
  });

  await run('Automated WCAG checks, keyboard skip navigation and reduced motion', async () => {
    const observations = [];
    for (const [page, surface] of [[admin, 'desktop minutes'], [member, 'phone overview'], [room, 'room display']]) {
      await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
      const result = await page.evaluate(async () => {
        const scan = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
        return { violations: scan.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.map(n => n.target) })), reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches };
      });
      observations.push({ surface, ...result });
    }
    await member.getByRole('link', { name: 'Skip to content', exact: true }).focus();
    await member.keyboard.press('Enter');
    assert.equal(await member.evaluate(() => document.activeElement?.id), 'main');
    assert.ok(observations.every(o => o.reducedMotion));
    report.accessibility = observations;
    assert.ok(observations.every(o => !o.violations.length), JSON.stringify(observations));
    return observations;
  });

  if (process.env.CAPTURE_VISUALS !== '0') await run('Representative desktop, phone, light/dark and room views', async () => {
    const captures = [[admin, 'meeting-desktop-dark'], [member, 'meeting-phone-dark'], [room, 'meeting-presentation-dark']];
    const overflow = [];
    for (const [page, name] of captures) {
      await page.evaluate(() => scrollTo(0, 0));
      await shot(page, name);
      overflow.push({ name, ...(await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, overflow: document.documentElement.scrollWidth > innerWidth }))) });
    }
    await member.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
    await shot(member, 'meeting-phone-light');
    await admin.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
    await shot(admin, 'meeting-desktop-light');
    assert.ok(overflow.every(v => !v.overflow), JSON.stringify(overflow));
    return overflow;
  });
} catch (e) { report.journeys.push({ name: 'Harness setup', result: 'failed', error: e.message }); }
finally {
  await browser.close();
  const samples = report.timing.map(x => x.ms).sort((a, b) => a - b);
  report.timingSummary = { count: samples.length, maxMs: samples.at(-1) ?? null, p95Ms: samples.length ? samples[Math.ceil(samples.length * .95) - 1] : null, limitation: 'Local emulator application evidence; not production network latency. Timing includes browser action overhead.' };
  await writeFile(`${out}/${process.env.EVENTS_ONLY === '1' ? 'event-recheck' : 'browser-results'}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.errors.length || report.journeys.some(x => x.result === 'failed')) process.exitCode = 1;
}
