// Explicit local emulator fixtures. Run after npm run demo; never reads production configuration.
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { isoDay } from '../src/time.js';

const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw new Error('Only a local Firestore emulator may be seeded.');
const [hostname, port] = host.split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-council', firestore: { host: hostname, port: Number(port) } });
const T = '2026-27', id = 'upgrade-demo', at = Date.now();
const email = name => `${name}@stjbs.sch.id`;
const invitees = ['nadia', 'kevin', 'dimas', 'sarah', 'raka', 'michael', 'alya', 'bryan', 'clara'].map(email);
await env.withSecurityRulesDisabled(async ctx => {
  const db = ctx.firestore(), put = (path, data) => setDoc(doc(db, path), { termId: T, ...data });
  await put(`events/${id}`, { title: 'Demo council planning meeting', type: 'meeting', date: isoDay(), start: '15:00', end: '16:00', location: 'Assembly Room, third floor', notes: 'Local demo only. Not an actual invitation or historic approval.', public: false, createdByUid: email('nadia'), archived: false, createdAt: at, participantUids: invitees, itemId: 'carnival' });
  await put(`meetings/${id}`, { eventId: id, createdByUid: email('nadia'), createdAt: at, title: 'Demo council planning meeting', date: isoDay(), startTime: '15:00', endTime: '16:00', venue: 'Assembly Room, third floor', participantUids: invitees, projectIds: ['carnival'], chairUid: email('nadia'), hostUid: email('nadia'), cohostUids: [email('raka')], minutesUid: email('dimas'), minutesBackupUid: email('sarah'), revision: 1, status: 'prepared', actualStart: null, actualEnd: null });
  await put(`meetings/${id}/session/control`, { revision: 1, hostUid: email('nadia'), phase: 'attendance', activeTopicId: 'welcome', presenterUid: email('nadia'), queue: [], timerStartedAt: null, timerDuration: 5, updatedAt: at, sessionId: 'local-demo-session' });
  await put(`meetings/${id}/minutes/draft`, { revision: 1, editorUid: email('dimas'), status: 'draft', summary: '', decisions: '', actions: [], closing: 'Meeting closed at', nextMeeting: '', preparedBy: email('dimas'), reviewedBy: '', publishedVersion: 0, updatedAt: at });
  for (const [topic, title, presenter, order] of [['welcome', 'Attendance and priorities', 'nadia', 0], ['project-review', 'Carnival project review', 'michael', 1]]) {
    await put(`meetings/${id}/agenda/${topic}`, { title, presenterUid: email(presenter), duration: 5, order, status: 'queued', projectIds: ['carnival'], taskIds: [], discussion: '', outcome: '' });
  }
});
await env.cleanup();
console.log('ok local upgrade-demo meeting seeded; no production data or actual approval was created');
