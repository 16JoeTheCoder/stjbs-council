// The public feed and its helpers: plain JavaScript with no Firebase and no JSX, so the public page, the dashboard
// and the seed script all build and read the payload the same way.
import { fmtDay, isoDay } from './time.js';

export const dateRange = (a, b) => (a === b ? fmtDay(a) : `${fmtDay(a)} to ${fmtDay(b)}`);


// Shown while start <= today <= end (Jakarta), newest first, at most 3. 0 renders nothing, 1 a banner, 2 to 3 cards.
export const activeAnnouncements = (list, day = isoDay()) =>
  list.filter((a) => !a.archived && a.startDate <= day && a.endDate >= day)
    .sort((a, b) => b.startDate.localeCompare(a.startDate) || (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 3);

export const STAGE_WORD = { todo: 'Planning', doing: 'In progress', done: 'Done' };

// The payload carries an explicit whitelist of fields per type. Never add names, emails, comments or task titles.
export function feedPayload({ projects, events, announcements, day }) {
  return {
    v: 1,
    projects: projects.map((p) => ({ title: p.title, stage: p.stage, pct: p.pct, done: p.done, total: p.total, blurb: p.blurb || '', updatedAt: p.updatedAt || 0 })),
    events: events.filter((e) => e.public === true && !e.archived && e.date >= day)
      .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
      .map((e) => ({ title: e.title, type: e.type, date: e.date, start: e.start, end: e.end, location: e.location || '' })),
    announcements: announcements.filter((a) => a.audience === 'everyone' && !a.archived && a.endDate >= day)
      .map((a) => ({ title: a.title, body: a.body || '', startDate: a.startDate, endDate: a.endDate })),
  };
}
// The public page re-filters by Jakarta today, so stale items vanish even if nobody republishes.
export const feedToday = (feed, day = isoDay()) => ({
  projects: feed.projects || [],
  events: (feed.events || []).filter((e) => e.date >= day),
  announcements: activeAnnouncements(feed.announcements || [], day),
});

// FNV-1a: a cheap, stable fingerprint of the payload to skip identical writes.
export function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16);
}

export function ago(ms, now = Date.now()) {
  const min = Math.floor((now - ms) / 60e3);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} h ago`;
  return `on ${fmtDay(isoDay(ms))}`;
}
