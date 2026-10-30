// Black-box tests for src/feed.js and the two-entry build. Run: node --test qa/tests/m2-feed.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { feedPayload, feedToday, activeAnnouncements, hash, ago, dateRange } from '../../src/feed.js';

const DAY = '2026-10-30';
const SECRET = ['Budi Santoso', 'budi@stjbs.sch.id', 'private note', 'uid-123', 'taskTitle-secret'];
const json = (x) => JSON.stringify(x);

const project = (o = {}) => ({
  title: 'Fun Run', stage: 'Planning', pct: 40, done: 2, total: 5, blurb: 'Run!', updatedAt: 1000,
  assignees: ['budi@stjbs.sch.id'], assigneeUids: ['uid-123'], createdByUid: 'uid-123', notes: 'private note',
  leadUids: ['budi@stjbs.sch.id'], name: 'Budi Santoso', email: 'budi@stjbs.sch.id', uid: 'uid-123', taskTitle: 'taskTitle-secret', ...o,
});
const event = (o = {}) => ({
  title: 'Carnival', type: 'other', date: DAY, start: '10:00', end: '12:00', location: 'Hall', public: true, archived: false,
  notes: 'private note', createdByUid: 'uid-123', uid: 'uid-123', itemId: 'x', email: 'budi@stjbs.sch.id', name: 'Budi Santoso', ...o,
});
const ann = (o = {}) => ({
  title: 'Notice', body: 'Hello', audience: 'everyone', startDate: DAY, endDate: DAY, archived: false,
  createdByUid: 'uid-123', createdAt: 5, email: 'budi@stjbs.sch.id', notes: 'private note', ...o,
});

test('whitelist: no sensitive value or key survives', () => {
  const p = feedPayload({ projects: [project()], events: [event()], announcements: [ann()], day: DAY });
  const s = json(p);
  for (const v of SECRET) assert.ok(!s.includes(v), `leaked ${v}`);
  for (const k of ['assigneeUids', 'createdByUid', 'uid', 'email', 'notes', 'itemId', 'public', 'archived', 'audience', 'createdAt', 'leadUids', 'assignees'])
    assert.ok(!s.includes(`"${k}"`), `key ${k} leaked`);
  assert.deepEqual(Object.keys(p.projects[0]).sort(), ['blurb', 'done', 'pct', 'stage', 'title', 'total', 'updatedAt']);
  assert.deepEqual(Object.keys(p.events[0]).sort(), ['date', 'end', 'location', 'start', 'title', 'type']);
  assert.deepEqual(Object.keys(p.announcements[0]).sort(), ['body', 'endDate', 'startDate', 'title']);
});

test('events filter: public, not archived, today or later', () => {
  const p = feedPayload({
    projects: [], announcements: [], day: DAY,
    events: [event({ title: 'ok' }), event({ title: 'private', public: false }), event({ title: 'missing flag', public: undefined }),
      event({ title: 'archived', archived: true }), event({ title: 'past', date: '2026-10-29' }), event({ title: 'future', date: '2026-12-01' })],
  });
  assert.deepEqual(p.events.map((e) => e.title), ['ok', 'future']);
});

test('events are sorted by date then start', () => {
  const p = feedPayload({ projects: [], announcements: [], day: DAY, events: [event({ title: 'b', date: '2026-11-02', start: '09:00' }), event({ title: 'a2', start: '11:00' }), event({ title: 'a1', start: '08:00' })] });
  assert.deepEqual(p.events.map((e) => e.title), ['a1', 'a2', 'b']);
});

test('announcements filter: everyone only, endDate >= today, future starts kept, archived out', () => {
  const p = feedPayload({
    projects: [], events: [], day: DAY,
    announcements: [ann({ title: 'ok' }), ann({ title: 'members', audience: 'members' }), ann({ title: 'expired', endDate: '2026-10-29', startDate: '2026-10-20' }),
      ann({ title: 'future', startDate: '2026-11-05', endDate: '2026-11-09' }), ann({ title: 'archived', archived: true }), ann({ title: 'no audience', audience: undefined })],
  });
  assert.deepEqual(p.announcements.map((a) => a.title), ['ok', 'future']);
});

test('payload shape, version and defaults', () => {
  const p = feedPayload({ projects: [project({ blurb: undefined, updatedAt: undefined })], events: [event({ location: undefined })], announcements: [ann({ body: undefined })], day: DAY });
  assert.equal(p.v, 1);
  assert.equal(p.projects[0].blurb, '');
  assert.equal(p.projects[0].updatedAt, 0);
  assert.equal(p.events[0].location, '');
  assert.equal(p.announcements[0].body, '');
  assert.deepEqual(feedPayload({ projects: [], events: [], announcements: [], day: DAY }), { v: 1, projects: [], events: [], announcements: [] });
});

test('feedToday: expired items vanish, future announcement appears on its start day', () => {
  const feed = {
    projects: [{ title: 'P' }],
    events: [{ title: 'old', date: '2026-10-29' }, { title: 'today', date: DAY }, { title: 'later', date: '2026-11-01' }],
    announcements: [
      { title: 'expired', startDate: '2026-10-01', endDate: '2026-10-29', createdAt: 1 },
      { title: 'live', startDate: '2026-10-30', endDate: '2026-11-02', createdAt: 2 },
      { title: 'soon', startDate: '2026-11-03', endDate: '2026-11-05', createdAt: 3 },
    ],
  };
  const a = feedToday(feed, DAY);
  assert.deepEqual(a.events.map((e) => e.title), ['today', 'later']);
  assert.deepEqual(a.announcements.map((x) => x.title), ['live']);
  assert.equal(a.projects.length, 1);
  assert.deepEqual(feedToday(feed, '2026-11-03').announcements.map((x) => x.title), ['soon']);
  assert.deepEqual(feedToday(feed, '2026-11-06').announcements, []);
  assert.deepEqual(feedToday(feed, '2026-11-06').events, []);
});

test('feedToday tolerates missing arrays', () => {
  assert.deepEqual(feedToday({}, DAY), { projects: [], events: [], announcements: [] });
});

test('activeAnnouncements: window inclusive, archived out, newest first, max 3', () => {
  const l = [
    ann({ title: 'a', startDate: '2026-10-01', endDate: '2026-12-01' }), ann({ title: 'b', startDate: '2026-10-10', endDate: '2026-12-01' }),
    ann({ title: 'c', startDate: '2026-10-20', endDate: '2026-12-01' }), ann({ title: 'd', startDate: '2026-10-25', endDate: '2026-12-01' }),
    ann({ title: 'arch', startDate: '2026-10-29', endDate: '2026-12-01', archived: true }), ann({ title: 'edge', startDate: DAY, endDate: DAY }),
    ann({ title: 'notyet', startDate: '2026-10-31', endDate: '2026-12-01' }),
  ];
  assert.deepEqual(activeAnnouncements(l, DAY).map((x) => x.title), ['edge', 'd', 'c']);
  assert.deepEqual(activeAnnouncements([ann({ startDate: DAY, endDate: DAY })], DAY).length, 1);
  assert.deepEqual(activeAnnouncements([ann({ startDate: DAY, endDate: '2026-10-29' })], DAY), []);
});

test('activeAnnouncements ties on startDate break by newer createdAt', () => {
  const l = [ann({ title: 'old', createdAt: 1 }), ann({ title: 'new', createdAt: 9 })];
  assert.deepEqual(activeAnnouncements(l, DAY).map((x) => x.title), ['new', 'old']);
});

test('activeAnnouncements does not mutate its input order', () => {
  const l = [ann({ title: 'x', startDate: '2026-10-01', endDate: '2026-12-01' }), ann({ title: 'y', startDate: '2026-10-20', endDate: '2026-12-01' })];
  const before = l.map((x) => x.title);
  activeAnnouncements(l, DAY);
  assert.deepEqual(l.map((x) => x.title), before);
});

test('Jakarta boundary: 23:30 UTC is already next day in Jakarta (default day)', () => {
  const RealDate = Date, fixed = RealDate.UTC(2026, 9, 30, 23, 30); // 30 Oct 23:30 UTC = 31 Oct 06:30 WIB
  globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [fixed])); } static now() { return fixed; } };
  try {
    const feed = { events: [{ title: 'yesterday', date: '2026-10-30' }, { title: 'today', date: '2026-10-31' }], announcements: [{ title: 'ends 30', startDate: '2026-10-01', endDate: '2026-10-30', createdAt: 1 }, { title: 'ends 31', startDate: '2026-10-01', endDate: '2026-10-31', createdAt: 1 }] };
    const t = feedToday(feed);
    assert.deepEqual(t.events.map((e) => e.title), ['today']);
    assert.deepEqual(t.announcements.map((a) => a.title), ['ends 31']);
  } finally { globalThis.Date = RealDate; }
});

test('Jakarta boundary: 16:59 UTC is still the same day, 17:00 UTC is next', () => {
  const RealDate = Date;
  const at = (ms) => { globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [ms])); } static now() { return ms; } }; };
  const feed = { events: [{ title: 'e30', date: '2026-10-30' }] };
  try {
    at(RealDate.UTC(2026, 9, 30, 16, 59)); assert.equal(feedToday(feed).events.length, 1);
    at(RealDate.UTC(2026, 9, 30, 17, 0)); assert.equal(feedToday(feed).events.length, 0);
  } finally { globalThis.Date = RealDate; }
});

test('hash is stable, deterministic and sensitive', () => {
  const t = json(feedPayload({ projects: [project()], events: [event()], announcements: [ann()], day: DAY }));
  assert.equal(hash(t), hash(t));
  assert.equal(hash(''), '811c9dc5');
  assert.equal(hash('a'), 'e40c292c'); // FNV-1a 32-bit reference value
  assert.notEqual(hash(t), hash(t + ' '));
  assert.match(hash('hello'), /^[0-9a-f]{1,8}$/);
  assert.equal(hash('hello'), hash('hello'));
});

test('hash of the payload ignores irrelevant input fields', () => {
  const a = json(feedPayload({ projects: [project()], events: [], announcements: [], day: DAY }));
  const b = json(feedPayload({ projects: [project({ notes: 'other', uid: 'other', email: 'x@y' })], events: [], announcements: [], day: DAY }));
  assert.equal(hash(a), hash(b));
});

test('ago wording', () => {
  const now = 1e12, m = 60e3;
  assert.equal(ago(now, now), 'just now');
  assert.equal(ago(now - 30e3, now), 'just now');
  assert.equal(ago(now - m, now), '1 min ago');
  assert.equal(ago(now - 3 * m, now), '3 min ago');
  assert.equal(ago(now - 59 * m, now), '59 min ago');
  assert.equal(ago(now - 60 * m, now), '1 h ago');
  assert.equal(ago(now - 5 * 60 * m, now), '5 h ago');
  assert.equal(ago(now - 23 * 60 * m, now), '23 h ago');
  assert.match(ago(now - 24 * 60 * m, now), /^on \w{3} \d{1,2} \w{3}/);
});

test('ago: future timestamps read just now, never negative', () => {
  const now = 1e12;
  for (const d of [1, 1e3, 59e3, 61e3, 3600e3, 86400e3, 30 * 86400e3]) assert.equal(ago(now + d, now), 'just now', `+${d}`);
});

test('ago: old date wording uses the Jakarta day', () => {
  const now = Date.UTC(2026, 10, 30), then = Date.UTC(2026, 9, 29, 20, 0); // 20:00 UTC on 29 Oct = 30 Oct 03:00 WIB
  assert.match(ago(then, now), /^on .*30 Oct/);
});

test('dateRange', () => {
  assert.equal(dateRange('2026-10-30', '2026-10-30'), 'Fri 30 Oct');
  assert.equal(dateRange('2026-10-30', '2026-11-02'), 'Fri 30 Oct to Mon 2 Nov');
});

test('dateRange across a year boundary shows the year', () => {
  const r = dateRange('2026-12-31', '2027-01-02');
  assert.match(r, /31 Dec/); assert.match(r, /2 Jan 2027/);
});

// ---- build test ----
test('vite build: two entry points, manifest, public page has no Firebase SDK', { timeout: 300000 }, () => {
  execSync('npx vite build', { cwd: new URL('../..', import.meta.url).pathname, stdio: 'pipe' });
  const root = new URL('../../dist/', import.meta.url).pathname;
  assert.ok(existsSync(root + 'index.html'), 'dist/index.html');
  assert.ok(existsSync(root + 'app/index.html'), 'dist/app/index.html');
  const m = JSON.parse(readFileSync(root + 'manifest.webmanifest', 'utf8'));
  assert.equal(m.id, '/');
  assert.equal(m.scope, '/app/');
  assert.equal(m.start_url, '/app/#/week');
  assert.equal(m.theme_color.toUpperCase(), '#0A0A0C');

  const pub = readFileSync(root + 'index.html', 'utf8');
  const app = readFileSync(root + 'app/index.html', 'utf8');
  assert.ok(!/rel="manifest"/.test(pub), 'public page must not link the manifest');
  assert.ok(/rel="manifest"/.test(app), 'dashboard links the manifest');
  assert.match(pub, /location\.replace/, 'public head has the legacy hash redirect');

  // Walk the public entry's script and preload graph, including static imports inside chunks.
  const seen = new Set(), queue = [...pub.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((x) => x[1]);
  assert.ok(queue.length > 0, 'public page loads at least one script');
  while (queue.length) {
    const f = queue.pop(); if (seen.has(f)) continue; seen.add(f);
    const code = readFileSync(root + f.slice(1), 'utf8');
    assert.ok(!/firebase/i.test(code), `${f} contains firebase`);
    assert.ok(!/firestore\.googleapis\.com\/google\.firestore/i.test(code), `${f} contains the Firestore SDK channel`);
    for (const x of code.matchAll(/from\s*"\.\/([^"]+\.js)"|import\("\.\/([^"]+\.js)"\)/g)) queue.push('/assets/' + (x[1] || x[2]));
  }
  // The dashboard, by contrast, must still carry Firebase (sanity check that the scan can see it).
  const appJs = [...app.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((x) => readFileSync(root + x[1].slice(1), 'utf8')).join('');
  assert.ok(/firebase|firestore/i.test(appJs), 'dashboard entry should reference firebase');
});
