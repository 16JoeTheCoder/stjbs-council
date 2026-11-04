// Pure helpers for bulk roster changes (no Firebase), so node --test can exercise them.
// Pasted format, one member per block, blocks separated by a blank line:
//   email / name / role / section   (section is the grade level, for example "Sec 4" or "JC 2")
const SCHOOL = /^[^@\s]+@stjbs\.sch\.id$/;
const ROLE_WORDS = {
  advisor: 'advisor', president: 'president', 'vice president': 'vp', 'vice-president': 'vp', vp: 'vp',
  treasurer: 'treasurer', secretary: 'secretary', officer: 'officer', member: 'member', 'general member': 'member', teacher: 'teacher',
};

// "Jc 2", "jc2" and "JC 2" are the same grade; "sec 4" becomes "Sec 4". Anything else is kept as typed.
export function normSection(s) {
  const t = String(s || '').trim().replace(/\s+/g, ' ');
  const m = /^(sec|jc)\s*(\d)$/i.exec(t);
  return m ? `${m[1].toLowerCase() === 'jc' ? 'JC' : 'Sec'} ${m[2]}` : t;
}

const cleanName = (s) => String(s || '').trim().replace(/\s+/g, ' ').replace(/[.,;]+$/, '');

// Returns one row per block: { line, email, name, role, section, errors: [] }. `allowed` is the role list the signed-in
// admin may create (rosterPowers(null).roles); `existing` holds the emails already on the roster.
export function parseBulk(text, allowed, existing = []) {
  const blocks = String(text || '').replace(/\r/g, '').split('\n').reduce((acc, raw, i) => {
    const line = raw.trim();
    if (!line) { if (acc.at(-1)?.lines.length) acc.push({ at: 0, lines: [] }); return acc; }
    if (!acc.length) acc.push({ at: 0, lines: [] });
    const cur = acc.at(-1);
    if (!cur.lines.length) cur.at = i + 1;
    cur.lines.push(line);
    return acc;
  }, []).filter((b) => b.lines.length);
  const have = new Set(existing.map((e) => e.toLowerCase())), seen = new Set();
  return blocks.map((b) => {
    const [e = '', n = '', r = '', s = '', ...rest] = b.lines;
    const email = e.toLowerCase(), name = cleanName(n), role = ROLE_WORDS[r.toLowerCase().replace(/\s+/g, ' ')] || null, section = normSection(s);
    const errors = [];
    if (rest.length || b.lines.length < 4) errors.push('Each member needs exactly 4 lines: email, name, role, section.');
    if (!SCHOOL.test(email)) errors.push('Email must end in @stjbs.sch.id.');
    if (!name) errors.push('Name is missing.');
    else if (name.length > 60) errors.push('Name is longer than 60 characters.');
    if (!role) errors.push(`Unknown role "${r}".`);
    else if (!allowed.includes(role)) errors.push('Your role cannot add this role.');
    if (section.length > 60) errors.push('Section is longer than 60 characters.');
    const dupe = have.has(email) ? 'Already on the roster; skipped.' : seen.has(email) ? 'Listed twice; skipped.' : null;
    seen.add(email);
    return { line: b.at, email, name, role, section, errors, skip: dupe };
  });
}

// Rows that will be written: valid and not skipped.
export const importable = (rows) => rows.filter((r) => !r.errors.length && !r.skip);

// Grade levels present in a member list, in a stable order (JC and Sec numerically, others after).
export function sectionsOf(members) {
  return [...new Set(members.map((m) => m.section || ''))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

// The sentence an admin must type before a bulk change. It names the action and the count, so it cannot be reused by habit.
export const confirmPhrase = (verb, n) => `I understand this will ${verb} ${n} member${n === 1 ? '' : 's'} and I want to proceed.`;
export const confirmed = (typed, phrase) => String(typed).trim().replace(/\s+/g, ' ').toLowerCase() === phrase.toLowerCase();
