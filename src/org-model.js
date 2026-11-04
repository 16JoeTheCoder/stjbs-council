// How the council is organised, as pure functions: no store, no Firebase, so node tests and scripts import it.
// role is the permission field. Department and position say where someone sits. section is the year level.

export const ROLE_INFO = {
  advisor: ['Advisor', 'Everything, including the term and the advisor role.'],
  president: ['President', 'Admin view, announcements, publishing and approvals. Cannot change roles.'],
  vp: ['Vice president', 'Admin view, and changes roles and access for everyone except the advisor.'],
  treasurer: ['Treasurer', 'Board: starts projects, edits the digest and project templates.'],
  secretary: ['Secretary', 'Board: starts projects, edits the digest and project templates.'],
  officer: ['Officer', 'Works on tasks, leads teams they are given, adds events, pins ideas.'],
  member: ['Member', 'The same as an officer: tasks, events, ideas and check-ins.'],
  teacher: ['Teacher', 'Reads everything and comments. Changes nothing.'],
};
export const ROLE_ORDER = ['member', 'officer', 'secretary', 'treasurer', 'vp', 'president', 'teacher', 'advisor'];
export const BOARD_ORDER = ['advisor', 'president', 'vp', 'treasurer', 'secretary'];

export const YEAR_LEVELS = ['Sec 1', 'Sec 2', 'Sec 3', 'Sec 4', 'JC 1', 'JC 2'];
// "sec3", "Secondary 3", "jc 2" map to the fixed list; anything else maps to '' (cleared by the migration).
export function yearLevel(s) {
  const t = String(s || '').trim().replace(/\s+/g, ' ');
  const m = /^(sec|jc|s|secondary)\s*-?\s*(\d)$/i.exec(t);
  if (!m) return '';
  const v = `${/^jc$/i.test(m[1]) ? 'JC' : 'Sec'} ${m[2]}`;
  return YEAR_LEVELS.includes(v) ? v : '';
}

export const POSITIONS = [['jc_officer', 'JC officer'], ['sec_officer', 'Sec officer'], ['member', 'General member']];
export const positionName = (p) => POSITIONS.find(([k]) => k === p)?.[1] || 'No position';

export const deptMembers = (d) => [...new Set([d.jcLeadUid, d.secLeadUid, ...(d.memberUids || [])].filter(Boolean))];
export const positionIn = (d, uid) => (d.jcLeadUid === uid ? 'jc_officer' : d.secLeadUid === uid ? 'sec_officer' : 'member');
// reportsTo is derived: general members and the Sec officer report to the JC officer, the JC officer to the president.
export const reportsToIn = (d, uid, presidentUid) => (uid === d.jcLeadUid ? presidentUid || null : d.jcLeadUid || null);

export const RANKS = [['teacher', 'Teachers'], ['exec', 'Executive board'], ['jc', 'JC officers'], ['sec', 'Sec officers'], ['general', 'General members']];
export function rankMembers(rank, members = [], depts = []) {
  const live = depts.filter((d) => d.active !== false), act = members.filter((m) => m.active);
  const jc = new Set(live.map((d) => d.jcLeadUid).filter(Boolean)), sec = new Set(live.map((d) => d.secLeadUid).filter(Boolean));
  const test = {
    teacher: (m) => m.role === 'teacher',
    exec: (m) => BOARD_ORDER.includes(m.role),
    jc: (m) => jc.has(m.id),
    sec: (m) => sec.has(m.id),
    general: (m) => !jc.has(m.id) && !sec.has(m.id) && !BOARD_ORDER.includes(m.role) && m.role !== 'teacher',
  }[rank];
  return test ? act.filter(test).map((m) => m.id) : [];
}

// Special-committee groups are addressed "committeeId:teamId", or "committeeId:*" (all), ":chair", ":leads".
export const teamMembers = (t) => [...new Set([...(t.leadUids || []), ...(t.memberUids || [])])];
export function committeeKeyMembers(key, list = []) {
  const [cid, tid] = String(key).split(':'), c = list.find((x) => x.id === cid);
  if (!c) return [];
  if (tid === '*') return [...new Set([...(c.chairUids || []), ...(c.teams || []).flatMap(teamMembers)])];
  if (tid === 'chair') return c.chairUids || [];
  if (tid === 'leads') return [...new Set((c.teams || []).flatMap((t) => t.leadUids || []))];
  const t = (c.teams || []).find((x) => x.id === tid);
  return t ? teamMembers(t) : [];
}
export function committeeKeyName(key, list = []) {
  const [cid, tid] = String(key).split(':'), c = list.find((x) => x.id === cid);
  if (!c) return 'Removed committee';
  if (tid === '*') return `All of ${c.name}`;
  if (tid === 'chair') return `${c.name} chair`;
  if (tid === 'leads') return `${c.name} leaders`;
  return `${(c.teams || []).find((x) => x.id === tid)?.name || 'Removed team'}, ${c.name}`;
}
export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
