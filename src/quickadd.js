// The quick-add parser. Pure: no DOM, no Firebase, no store. Runs on every keystroke.
// parse('Buy confetti @Brit fri #eoy', ctx) -> { title, assignee, due, event, priority, ambiguous, warnings, spans }
// Grammar and the reasons behind each rule are in decision.md, "Quick add parser".
import { assignable } from './work-model.js';

const JKT_MS = 7 * 3600e3, DAY = 86400e3;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const plus = (day, n) => iso(Date.parse(day) + n * DAY);
const dow = (day) => new Date(Date.parse(day)).getUTCDay(); // Sunday = 0
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const pad = (n) => String(n).padStart(2, '0');

// ---------- Words
const WEEKDAYS = {
  sun: 0, sunday: 0, minggu: 0, ahad: 0,
  mon: 1, monday: 1, senin: 1,
  tue: 2, tues: 2, tuesday: 2, selasa: 2,
  wed: 3, weds: 3, wednesday: 3, rabu: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, kamis: 4,
  fri: 5, friday: 5, jumat: 5, "jum'at": 5,
  sat: 6, saturday: 6, sabtu: 6,
};
const REL = { today: 0, tod: 0, tonight: 0, tomorrow: 1, tmr: 1, tmrw: 1, tom: 1, tmw: 1, yesterday: -1, besok: 1, lusa: 2, kemarin: -1 };
const MONTHS = { jan: 1, january: 1, januari: 1, feb: 2, february: 2, februari: 2, mar: 3, march: 3, maret: 3, apr: 4, april: 4,
  may: 5, mei: 5, jun: 6, june: 6, juni: 6, jul: 7, july: 7, juli: 7, aug: 8, august: 8, agu: 8, agt: 8, agustus: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, okt: 10, oktober: 10, nov: 11, november: 11, dec: 12, december: 12, des: 12, desember: 12 };
// Named times. pagi/siang/sore/malam also bend a "jam N" hour.
const NAMED = { noon: '12:00', midnight: '23:59', morning: '07:00', lunch: '12:00', lunchtime: '12:00', tonight: '19:00',
  pagi: '07:00', siang: '12:00', sore: '15:00', malam: '19:00' };
// Common misspellings, folded to the word they mean.
const TYPO = { tommorow: 'tomorrow', tomorow: 'tomorrow', tommorrow: 'tomorrow', tmrow: 'tomorrow', tomorro: 'tomorrow', tmorrow: 'tomorrow',
  '2moro': 'tomorrow', tdy: 'today', tday: 'today', wensday: 'wednesday', wednsday: 'wednesday', thursady: 'thursday', firday: 'friday',
  fryday: 'friday', saterday: 'saturday', satuday: 'saturday', sunady: 'sunday', mondy: 'monday', tuseday: 'tuesday', jumaat: 'jumat', jum: 'jumat' };
const FIX_TARGETS = ['tomorrow', 'yesterday', 'tonight', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
// Bare words that are also ordinary English or names: dates only when the context says so.
const WEAK = new Set(['tom', 'tod', 'sun', 'sat', 'wed', 'mar', 'may', 'morning', 'lunch', 'lunchtime', 'minggu', 'malam', 'pagi', 'siang', 'sore', 'tonight']);
// A date word right before one of these is part of a noun phrase: "sunday school", "friday prayers".
const NOUN_AFTER = new Set(['school', 'service', 'services', 'mass', 'market', 'markets', 'brunch', 'roast', 'best', 'paper', 'papers', 'prayer',
  'prayers', 'club', 'league', 'special', 'specials', 'menu', 'edition', 'session', 'sessions', 'assembly', 'break', 'shift', 'band', 'duty',
  'meeting', 'meetings', 'sale', 'night', 'class', 'classes', 'program', 'programme', 'routine', 'team', 'crew', 'run', 'box', 'boxes']);
// Words that introduce a date and go with it out of the title: "submit by fri" -> "submit".
const PREP = new Set(['on', 'by', 'due', 'before', 'until', 'till', 'til', 'at', 'for', 'sampai', 'tgl', 'tanggal', 'pada', 'hari']);
const ARTICLE = new Set(['the', 'a', 'an', 'my', 'our', 'your', 'his', 'her', 'their', 'every', 'each', 'last']);

function dist1(a, b) { // Damerau distance <= 1, cheaply
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i++;
  if (la === lb) return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
  return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}
const fixWord = (w) => {
  if (TYPO[w]) return TYPO[w];
  if (w.length >= 6 && !(w in WEEKDAYS) && !(w in REL)) for (const t of FIX_TARGETS) if (dist1(w, t)) return t;
  return w;
};

// ---------- Clock
function clockOf(now) {
  const j = new Date(now.getTime() + JKT_MS);
  return { today: j.toISOString().slice(0, 10), mins: j.getUTCHours() * 60 + j.getUTCMinutes() };
}
const weekdayFrom = (today, d) => plus(today, (d - dow(today) + 7) % 7); // next occurrence, today included
const mondayOf = (day) => plus(day, -((dow(day) + 6) % 7));
// School-day guess for an hour with no am/pm: 1 to 6 is afternoon, 7 to 12 is as written.
const hourGuess = (h) => (h >= 1 && h <= 6 ? h + 12 : h);

// ---------- Tokens
// Words with their positions. A word may carry a leading backslash (escaped) or sit inside quotes (protected).
function words(input) {
  const out = [], quoted = [];
  const q = /"[^"]*"?|“[^”]*”?/g;
  let m;
  while ((m = q.exec(input))) quoted.push([m.index, m.index + m[0].length]);
  const inQuote = (i) => quoted.some(([a, b]) => i >= a && i < b);
  const re = /\S+/g;
  while ((m = re.exec(input))) {
    const raw = m[0], start = m.index;
    // Split trailing punctuation off so "fri," still reads as fri.
    const core = raw.replace(/[,.;:!?)]+$/, '');
    out.push({ raw: core || raw, start, end: start + (core || raw).length, w: fold(core || raw), esc: raw[0] === '\\', q: inQuote(start) });
  }
  return { list: out, quoted };
}

// ---------- People
const cache = new WeakMap();
function peopleIndex(members) {
  let idx = cache.get(members);
  if (idx) return idx;
  idx = members.filter((m) => m.active !== false && m.role !== 'teacher').map((m) => {
    const parts = fold(m.name || '').split(/\s+/).filter(Boolean);
    const aliases = (m.aliases || []).map(fold).filter(Boolean);
    return { m, first: parts[0] || '', last: parts.slice(1), full: parts.join(' '), firsts: [parts[0] || '', ...aliases] };
  });
  cache.set(members, idx);
  return idx;
}
// Rank everyone against a query; lower tier is better. tier 9 = no match. Spec 1.3 order.
function tierOf(p, q) {
  if (!q) return 6;
  const qs = q.split(/\s+/);
  if (qs.length === 1) {
    if (p.firsts.includes(q)) return 1;
    if (p.firsts.some((f) => f.startsWith(q))) return 2;
    if (p.full.startsWith(q)) return 3;
    if (p.last.some((l) => l.startsWith(q))) return 4;
    if (q.length >= 4 && p.firsts.concat(p.last).some((n) => dist1(n, q) || dist1(n.slice(0, q.length), q))) return 5;
    return 9;
  }
  // Two or more words: a first name (or alias) prefix, then a last-name prefix.
  const [a, ...rest] = qs, tail = rest.join(' ');
  if (p.full.startsWith(q)) return 3;
  if (p.firsts.some((f) => f.startsWith(a)) && p.last.join(' ').startsWith(tail)) return 3;
  return 9;
}
// For the dropdown and the popover: everyone who matches, best first. Officers see their subteam first.
export function rankPeople(query, ctx) {
  const q = fold(query || '').trim(), idx = peopleIndex(ctx.members), me = ctx.me;
  const dept = isOfficerish(me) ? me.departmentId : null;
  return idx.map((p) => ({ p, t: q === 'me' && p.m.id === me.id ? 0 : tierOf(p, q) }))
    .filter((x) => x.t < 9)
    .sort((a, b) => a.t - b.t || (dept ? (b.p.m.departmentId === dept) - (a.p.m.departmentId === dept) : 0) || a.p.m.name.localeCompare(b.p.m.name))
    .map((x) => x.p.m);
}
const isOfficerish = (m) => m?.role === 'officer' || ['jc_officer', 'sec_officer'].includes(m?.position);

function readAssignee(input, at, ctx) {
  // Longest first: "@mike w" before "@mike". Stop at the next trigger.
  const rest = input.slice(at + 1), m = /^[^\s@#"]+(?:\s[^\s@#"!]+)?/.exec(rest);
  if (!m) return null;
  const idx = peopleIndex(ctx.members), tries = m[0].includes(' ') ? [m[0], m[0].split(' ')[0]] : [m[0]];
  for (const text of tries) {
    const q = fold(text);
    if (q === 'me') return { text, hits: [ctx.me] };
    const pin = ctx.pinned?.[q] && ctx.members.find((m) => m.id === ctx.pinned[q]);
    if (pin) return { text, hits: [pin] };
    let best = 9, hits = [];
    for (const p of idx) {
      const t = tierOf(p, q);
      if (t < best) { best = t; hits = [p.m]; } else if (t === best && t < 9) hits.push(p.m);
    }
    // A second word only counts when it narrows the match; "@aaron besok" is Aaron plus a date.
    if (best < 9 && (text === tries[tries.length - 1] || best === 3)) return { text, hits };
  }
  return null;
}

// ---------- Events (the # token): budgets and calendar events, by name prefix, word prefix or initials.
function eventScore(name, q) {
  const n = fold(name), ws = n.split(/[^a-z0-9]+/).filter(Boolean), qq = q.replace(/[^a-z0-9 ]/g, '');
  if (!qq) return 9;
  if (n === qq) return 0;
  if (n.startsWith(qq)) return 1;
  if (ws.map((w) => w[0]).join('').startsWith(qq.replace(/ /g, '')) && qq.length >= 2) return 2;
  if (ws.some((w) => w.startsWith(qq))) return 3;
  return 9;
}
function readEvent(input, at, ctx) {
  const rest = input.slice(at + 1);
  let m = /^"([^"]*)"?/.exec(rest);
  const list = ctx.events || [];
  const best = (q) => { let s = 9, hit = []; for (const e of list) { const v = eventScore(e.name || e.title || '', fold(q)); if (v < s) { s = v; hit = [e]; } else if (v === s && v < 9) hit.push(e); } return { s, hit }; };
  if (m) { const r = best(m[1]); return { text: m[0], hits: r.hit }; }
  m = /^[^\s@#"]+/.exec(rest);
  if (!m) return null;
  const r = best(m[0]);
  return r.s < 9 ? { text: m[0], hits: r.hit } : { text: m[0], hits: [] };
}

// ---------- Dates
// Try to read one date or time element starting at word i. Returns { n (words used), date?, time?, strong }.
function readDateAt(ws, i, clock) {
  const w = (k) => (ws[i + k] && !ws[i + k].q && !ws[i + k].esc ? fixWord(ws[i + k].w) : null);
  const a = w(0), b = w(1), c = w(2);
  if (!a) return null;
  const { today } = clock;
  // Two- and three-word phrases first.
  if (a === 'hari' && b === 'ini') return { n: 2, date: today, strong: true };
  if (a === 'nanti' && b === 'malam') return { n: 2, date: today, time: '19:00', strong: true };
  if (a === 'this' && b === 'week') return { n: 2, date: weekdayFromMonday(today, 4), strong: true };
  if (a === 'next' && b === 'week') return { n: 2, date: plus(mondayOf(today), 7), strong: true };
  if (a === 'minggu' && b === 'depan') return { n: 2, date: plus(mondayOf(today), 7), strong: true };
  if (a === 'end' && b === 'of' && c === 'week') return { n: 3, date: eow(today), strong: true };
  if (a === 'eow') return { n: 1, date: eow(today), strong: true };
  if (a === 'weekend' || (a === 'this' && b === 'weekend') || a === 'akhir' && b === 'pekan') {
    const n = a === 'weekend' ? 1 : 2; return { n, date: dow(today) === 0 ? today : weekdayFrom(today, 6), strong: n === 2 };
  }
  if (a === 'after' && b === 'school') return { n: 2, time: '15:00', strong: true };
  if (a === 'pulang' && b === 'sekolah') return { n: 2, time: '15:00', strong: true };
  if ((a === 'next' || a === 'this') && b in WEEKDAYS) {
    const d = weekdayFrom(today, WEEKDAYS[b]);
    return { n: 2, date: a === 'next' ? plus(mondayOf(today), 7 + ((WEEKDAYS[b] + 6) % 7)) : d, strong: true };
  }
  if (a in WEEKDAYS && b === 'depan') return { n: 2, date: plus(mondayOf(today), 7 + ((WEEKDAYS[a] + 6) % 7)), strong: true };
  if ((a === 'in' || a === 'dalam') && b) {
    let m = /^(\d{1,3})([dw])$/.exec(b);
    if (m) return { n: 2, date: plus(today, Number(m[1]) * (m[2] === 'w' ? 7 : 1)), strong: true };
    const k = b === 'a' || b === 'an' || b === 'one' || b === 'se' ? 1 : /^\d{1,3}$/.test(b) ? Number(b) : null;
    if (k != null && c) {
      if (/^(days?|hari)$/.test(c)) return { n: 3, date: plus(today, k), strong: true };
      if (/^(weeks?|minggu)$/.test(c)) return { n: 3, date: plus(today, 7 * k), strong: true };
    }
  }
  if ((a === 'jam' || a === 'pukul' || a === 'at') && b) {
    const t = readClock(b, true);
    if (t) {
      const mod = c && ['pagi', 'siang', 'sore', 'malam'].includes(c) ? c : null;
      return { n: mod ? 3 : 2, time: mod ? bend(t, mod) : t.time, strong: true };
    }
  }
  // Absolute dates: 15 nov, nov 15, 15 november 2026, 15/11, 15/11/2026, 15-11, 15th.
  let m = /^(\d{1,2})(?:st|nd|rd|th)?$/.exec(a);
  if (m && b in MONTHS) {
    const y = c && /^\d{4}$/.test(c) ? Number(c) : null;
    return { n: y ? 3 : 2, date: ymd(Number(m[1]), MONTHS[b], y, today), strong: true };
  }
  if (a in MONTHS && b && (m = /^(\d{1,2})(?:st|nd|rd|th)?$/.exec(b))) {
    const y = c && /^\d{4}$/.test(c) ? Number(c) : null;
    return { n: y ? 3 : 2, date: ymd(Number(m[1]), MONTHS[a], y, today), strong: true };
  }
  if ((m = /^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2}|\d{4}))?$/.exec(a)) && Number(m[2]) <= 12) {
    if (a.includes('.') && !m[3] && Number(m[1]) <= 23) {
      // 15.00 reads as a time (Indonesian clock), not 15 Jan.
      return { n: 1, time: `${pad(Number(m[1]))}:${pad(Number(m[2]))}`, strong: true };
    }
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : null;
    return { n: 1, date: ymd(Number(m[1]), Number(m[2]), y, today), strong: true };
  }
  if ((m = /^(\d{1,2})(st|nd|rd|th)$/.exec(a))) {
    const d = Number(m[1]), [y, mo] = today.split('-').map(Number);
    let date = valid(y, mo, d);
    if (!date || date < today) date = mo === 12 ? valid(y + 1, 1, d) : valid(y, mo + 1, d);
    return date ? { n: 1, date, strong: false } : null;
  }
  // Clock times.
  const t = readClock(a, false);
  if (t) {
    const mod = b && ['pagi', 'siang', 'sore', 'malam'].includes(b) ? b : null;
    return { n: mod ? 2 : 1, time: mod ? bend(t, mod) : t.time, strong: true };
  }
  if (a in NAMED) return { n: 1, time: NAMED[a], date: a === 'tonight' ? today : undefined, strong: !WEAK.has(a) };
  // Single words.
  if (a in REL) return { n: 1, date: plus(today, REL[a]), strong: !WEAK.has(a), past: REL[a] < 0 };
  if (a in WEEKDAYS) return { n: 1, date: weekdayFrom(today, WEEKDAYS[a]), strong: false, weak: WEAK.has(a) };
  return null;
}
const weekdayFromMonday = (today, k) => plus(mondayOf(today), k);
const eow = (today) => { const f = weekdayFromMonday(today, 4); return f < today ? plus(f, 7) : f; };
function valid(y, mo, d) {
  if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
  const s = `${y}-${pad(mo)}-${pad(d)}`;
  return iso(Date.parse(s)) === s ? s : null;
}
function ymd(d, mo, y, today) {
  if (y) return valid(y, mo, d);
  const ty = Number(today.slice(0, 4)), s = valid(ty, mo, d);
  return s && s >= today ? s : valid(ty + 1, mo, d);
}
// "3pm", "3:30pm", "15:00", "3 pm" is two words and handled by the caller via b. loose: a bare "3" (after jam/at).
function readClock(word, loose) {
  let m = /^(\d{1,2})(?::(\d{2}))?(am|pm|a|p)$/.exec(word);
  if (m) {
    let h = Number(m[1]) % 12;
    if (m[3][0] === 'p') h += 12;
    if (h > 23 || Number(m[2] || 0) > 59) return null;
    return { time: `${pad(h)}:${m[2] || '00'}`, h, mm: m[2] || '00', fixed: true };
  }
  m = /^(\d{1,2}):(\d{2})$/.exec(word) || (loose && /^(\d{1,2})(?:[.:](\d{2}))?$/.exec(word));
  if (m) {
    const raw = Number(m[1]), mm = m[2] || '00';
    if (raw > 23 || Number(mm) > 59) return null;
    const fixed = word.includes(':') && raw >= 13 || raw === 0 || word.startsWith('0');
    const h = fixed || raw > 12 ? raw : hourGuess(raw);
    return { time: `${pad(h)}:${mm}`, h: raw, mm, fixed };
  }
  return null;
}
// "jam 3 sore" = 15:00, "jam 9 pagi" = 09:00, "jam 7 malam" = 19:00, "jam 11 siang" = 11:00.
function bend(t, mod) {
  let h = t.h % 12;
  if (mod === 'sore' || mod === 'malam' || (mod === 'siang' && h < 6)) h += 12;
  return `${pad(h)}:${t.mm}`;
}

// Find the date phrase: clusters of adjacent date words; the last accepted cluster wins.
function findDate(ws, clock, rejected, taken) {
  const clusters = [];
  for (let i = 0; i < ws.length;) {
    if (taken(ws[i])) { i++; continue; }
    const parts = [];
    let j = i;
    while (j < ws.length && !taken(ws[j])) {
      // "at" or "jam" glue: "fri at 3pm"
      const r = readDateAt(ws, j, clock);
      if (!r) break;
      if (parts.some((p) => (r.date && p.date) || (r.time && p.time))) break;
      parts.push({ ...r, i: j }); j += r.n;
    }
    if (!parts.length) { i++; continue; }
    clusters.push({ i, j, parts });
    i = j;
  }
  for (let k = clusters.length - 1; k >= 0; k--) {
    const c = clusters[k], start = ws[c.i].start, end = ws[c.j - 1].end;
    const strong = c.parts.some((p) => p.strong) || c.parts.length > 1;
    const next = ws[c.j], prev = ws[c.i - 1];
    const prevPrep = prev && !taken(prev) && PREP.has(prev.w) && !prev.q;
    if (prev && ARTICLE.has(prev.w)) continue;
    if (next && NOUN_AFTER.has(next.w) && !c.parts.some((p) => p.time)) continue;
    if (!strong) {
      const clean = !next || taken(next) || /^[@#!]|^p[1-4]$/i.test(next.raw) || next.q;
      const weak = c.parts.some((p) => p.weak || WEAK.has(ws[p.i].w));
      if (!(clean && (!weak || !next || taken(next) || prevPrep)) && !(prevPrep && !weak)) continue;
      if (weak && !prevPrep && next && !taken(next)) continue;
    }
    const s0 = prevPrep ? prev.start : start;
    const text = c.parts.map((p) => ws.slice(p.i, p.i + p.n).map((x) => x.raw).join(' ')).join(' ');
    if (rejected.has(`date:${fold(text)}`)) continue;
    let date = c.parts.find((p) => p.date)?.date, time = c.parts.find((p) => p.time)?.time;
    if (!date && time) {
      const [h, m] = time.split(':').map(Number);
      date = h * 60 + m > clock.mins ? clock.today : plus(clock.today, 1);
    }
    return { date, time, matchedText: text, span: [s0, end], past: date < clock.today };
  }
  return null;
}

// ---------- The parse
export function parse(input, ctx) {
  const clock = clockOf(ctx.now || new Date()), rejected = ctx.rejected || new Set(), out = { title: '', warnings: [], spans: [] };
  const { list: ws } = words(input);
  const cut = []; // [start, end] spans removed from the title
  const take = (span) => cut.push(span);
  const taken = (w) => cut.some(([a, b]) => w.start < b && w.end > a);

  // Priority: whole words p1..p4 or !1..!4. The last one wins.
  for (const w of ws) {
    const m = !w.q && !w.esc && /^(?:p|!)([1-4])$/i.exec(w.raw);
    if (m && !rejected.has(`priority:${w.w}`)) out.priority = { value: Number(m[1]), matchedText: w.raw, span: [w.start, w.end] };
  }
  if (out.priority) { take(out.priority.span); out.spans.push({ kind: 'priority', span: out.priority.span, key: `priority:${fold(out.priority.matchedText)}` }); out.priority = out.priority.value; }

  // Assignee and event triggers, outside quotes, at a word start.
  for (const w of ws) {
    if (w.q || w.esc || taken(w)) continue;
    if (w.raw[0] === '@' && !out.assignee && !out.ambiguous) {
      const r = readAssignee(input, w.start, ctx);
      if (!r) continue;
      const span = [w.start, w.start + 1 + r.text.length], key = `assignee:${fold(r.text)}`;
      if (rejected.has(key)) continue;
      if (r.hits.length === 1) out.assignee = { id: r.hits[0].id, name: r.hits[0].name, matchedText: `@${r.text}`, span };
      else if (r.hits.length > 1) out.ambiguous = { kind: 'assignee', options: r.hits, matchedText: `@${r.text}`, span };
      take(span); out.spans.push({ kind: 'assignee', span, pending: r.hits.length > 1, key });
    } else if (w.raw[0] === '#' && !out.event) {
      const r = readEvent(input, w.start, ctx);
      if (!r || !r.hits.length) continue;
      const span = [w.start, w.start + 1 + r.text.length];
      if (rejected.has(`event:${fold(r.text)}`)) continue;
      const e = r.hits[0];
      out.event = { id: e.id, name: e.name || e.title, matchedText: `#${r.text}`, span };
      take(span); out.spans.push({ kind: 'event', span, key: `event:${fold(r.text)}` });
    }
  }

  const due = findDate(ws, clock, rejected, taken);
  if (due) {
    out.due = { date: due.date, ...(due.time ? { time: due.time } : {}), matchedText: due.matchedText, span: due.span };
    take(due.span); out.spans.push({ kind: 'date', span: due.span, key: `date:${fold(due.matchedText)}` });
    if (due.past) out.warnings.push('That date is in the past.');
  }

  // Role limits: never drop the assignee, warn and block instead.
  if (out.assignee && ctx.me?.role) {
    const ok = assignable(ctx.me, ctx.members).some((m) => m.id === out.assignee.id);
    if (!ok) { out.blocked = true; out.warnings.push(isOfficerish(ctx.me) ? 'Officers can only assign their subteam.' : 'You can only give tasks to yourself.'); }
  }

  // Title: input minus consumed spans, escapes unwrapped, whitespace tidied.
  cut.sort((a, b) => a[0] - b[0]);
  let title = '', at = 0;
  for (const [a, b] of cut) { if (a >= at) { title += input.slice(at, a); at = b; } else at = Math.max(at, b); }
  title += input.slice(at);
  out.title = title.replace(/(^|\s)\\(?=\S)/g, '$1').replace(/\s+([,.;:!?])/g, '$1').replace(/\s{2,}/g, ' ').trim().replace(/^[,;:\-–]\s*|\s*[,;:\-–]$/g, '');
  out.spans.sort((a, b) => a.span[0] - b.span[0]);
  return out;
}

// ---------- Small helpers the UI shares
// Parse only a date phrase ("fri", "besok 3pm") for the date field in the edit panel.
export function parseDate(text, now = new Date()) {
  const r = parse(text, { now, members: [], me: {}, events: [] });
  return r.due || null;
}
const DOWN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function dueLabel(due, now = new Date()) {
  if (!due?.date) return '';
  const { today } = clockOf(now), d = new Date(Date.parse(due.date));
  const day = due.date === today ? 'Today' : due.date === plus(today, 1) ? 'Tomorrow'
    : `${DOWN[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}${due.date.slice(0, 4) === today.slice(0, 4) ? '' : ` ${due.date.slice(0, 4)}`}`;
  return due.time ? `${day} ${due.time}` : day;
}
// The plain-words preview under the input: "Aaron · Fri 15 Nov · End of Year Party · P1".
export function preview(r, me, now) {
  return [r.assignee && r.assignee.id !== me?.id ? r.assignee.name.split(' ')[0] : null, r.due && dueLabel(r.due, now), r.event?.name, r.priority && r.priority < 4 ? `P${r.priority}` : null]
    .filter(Boolean).join(' · ');
}
