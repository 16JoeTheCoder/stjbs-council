// Parser tests for bulk add. Run: node --test tests/bulk-roster.test.mjs (also part of npm run test:rules).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBulk, importable, normSection, confirmPhrase, confirmed, sectionsOf } from '../src/bulk-roster.js';

const ALL = ['advisor', 'president', 'vp', 'treasurer', 'secretary', 'officer', 'teacher'];
const LIST = `adelyn.liu@stjbs.sch.id
Adelyn Liu
President
Sec 4

josef.yang@stjbs.sch.id
Josef Yang
Vice President
JC 2

Kimberly.himawan@stjbs.sch.id
Kimberly.
Secretary
Jc 2

carlos.wijaya@stjbs.sch.id
Carlos Garnier Fransiskus Jofan Wijaya 
Officer
JC 2

Michael.wijaya@stjbs.sch.id
Michael Alexander Wijaya
Treasurer
JC 2

elliott.sugiarto@stjbs.sch.id
Elliott Sugiarto
Officer 
Sec 4
`;

test('the real list parses with no errors, lowercased emails, normalised sections and roles', () => {
  const rows = parseBulk(LIST, ALL);
  assert.equal(rows.length, 6);
  assert.ok(rows.every((r) => !r.errors.length && !r.skip));
  assert.deepEqual(rows.map((r) => r.role), ['president', 'vp', 'secretary', 'officer', 'treasurer', 'officer']);
  assert.equal(rows[2].email, 'kimberly.himawan@stjbs.sch.id');
  assert.equal(rows[2].name, 'Kimberly');
  assert.equal(rows[2].section, 'JC 2');
  assert.equal(rows[3].name, 'Carlos Garnier Fransiskus Jofan Wijaya');
  assert.equal(rows[5].role, 'officer');
});

test('windows line endings and extra blank lines are fine', () => {
  const rows = parseBulk('\r\n\r\na@stjbs.sch.id\r\nA\r\nOfficer\r\nSec 3\r\n\r\n\r\n\r\nb@stjbs.sch.id\r\nB\r\nOfficer\r\nSec 3\r\n', ALL);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => !r.errors.length));
});

test('bad blocks are flagged, never silently fixed', () => {
  const r = (t, allowed = ALL) => parseBulk(t, allowed)[0].errors;
  assert.ok(r('a@gmail.com\nA\nOfficer\nSec 3').length);
  assert.ok(r('a@stjbs.sch.id\nA\nBoss\nSec 3').length);
  assert.ok(r('a@stjbs.sch.id\nA\nOfficer').length); // 3 lines
  assert.ok(r('a@stjbs.sch.id\nA\nOfficer\nSec 3\nextra').length); // 5 lines
  assert.ok(r('a@stjbs.sch.id\nA\nPresident\nSec 3', ['officer']).length); // role not allowed for this admin
  assert.ok(r(`a@stjbs.sch.id\n${'x'.repeat(61)}\nOfficer\nSec 3`).length);
});

test('existing and repeated emails are skipped, not overwritten', () => {
  const rows = parseBulk('a@stjbs.sch.id\nA\nOfficer\nSec 3\n\nA@stjbs.sch.id\nA2\nOfficer\nSec 3\n\nb@stjbs.sch.id\nB\nOfficer\nSec 3', ALL, ['B@stjbs.sch.id']);
  assert.deepEqual(importable(rows).map((x) => x.email), ['a@stjbs.sch.id']);
  assert.ok(rows[1].skip && rows[2].skip);
});

test('empty input yields nothing', () => { assert.deepEqual(parseBulk('  \n\n ', ALL), []); });

test('section normalising and ordering', () => {
  assert.equal(normSection('jc2'), 'JC 2');
  assert.equal(normSection(' sec   4 '), 'Sec 4');
  assert.equal(normSection('Welfare'), 'Welfare');
  assert.deepEqual(sectionsOf([{ section: 'Sec 4' }, { section: 'JC 2' }, {}, { section: 'Sec 3' }]), ['', 'JC 2', 'Sec 3', 'Sec 4']);
});

test('confirmation sentence includes the count and ignores case and spacing only', () => {
  const p = confirmPhrase('add', 16);
  assert.equal(p, 'I understand this will add 16 members and I want to proceed.');
  assert.ok(confirmed('  i understand  this will add 16 members and i want to proceed. ', p));
  assert.ok(!confirmed('I understand this will add 15 members and I want to proceed.', p));
  assert.ok(!confirmed('', p));
  assert.equal(confirmPhrase('deactivate', 1), 'I understand this will deactivate 1 member and I want to proceed.');
});
