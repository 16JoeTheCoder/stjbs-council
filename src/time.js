// Dates are 'YYYY-MM-DD' strings in Asia/Jakarta (UTC+7, no DST); instants are ms numbers.
const JKT_MS = 7 * 3600e3, DAY_MS = 86400e3;

export const isoDay = (ms = Date.now()) => new Date(ms + JKT_MS).toISOString().slice(0, 10);
// "Thu 29 Oct, 15:30" in Jakarta time; a missing or damaged value renders as nothing rather than breaking the page.
export const stamp = (ms) => (Number.isFinite(ms) ? `${fmtDay(isoDay(ms))}, ${new Date(ms + JKT_MS).toISOString().slice(11, 16)}` : '');
export const addDays = (day, n) => new Date(Date.parse(day) + n * DAY_MS).toISOString().slice(0, 10);
export const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);
const dow = (day) => (new Date(Date.parse(day)).getUTCDay() + 6) % 7; // Monday = 0
export const monday = (day) => addDays(day, -dow(day));
// Instant at which a Jakarta day starts.
export const dayStartMs = (day) => Date.parse(day) - JKT_MS;

export function weekId(day) {
  const thu = addDays(day, 3 - dow(day)), year = thu.slice(0, 4);
  const firstThu = addDays(`${year}-01-04`, 3 - dow(`${year}-01-04`));
  return `${year}-W${String(1 + daysBetween(firstThu, thu) / 7).padStart(2, '0')}`;
}

export function week(now = Date.now()) {
  const start = monday(isoDay(now));
  return { id: weekId(start), start, end: addDays(start, 6), due: addDays(start, 4), lastId: weekId(addDays(start, -7)) };
}

export const idr = (n) => `${String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} IDR`;

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// On screen a date reads "Thu 29 Oct", with the year only when it is not this year. Data keeps ISO.
export function fmtDay(day, thisYear = isoDay().slice(0, 4)) {
  const d = new Date(Date.parse(day));
  return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}${day.slice(0, 4) === thisYear ? '' : ` ${day.slice(0, 4)}`}`;
}
export const monthName = (day) => `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)}`;
export const jktHour = (ms = Date.now()) => new Date(ms + JKT_MS).getUTCHours();
// Month arithmetic on 'YYYY-MM-DD' strings; the day clamps to the first of the month.
export const monthStart = (day) => `${day.slice(0, 7)}-01`;
export function addMonths(day, n) {
  const y = Number(day.slice(0, 4)), m = Number(day.slice(5, 7)) - 1 + n;
  return `${y + Math.floor(m / 12)}-${String(((m % 12) + 12) % 12 + 1).padStart(2, '0')}-01`;
}
export const toMin = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
