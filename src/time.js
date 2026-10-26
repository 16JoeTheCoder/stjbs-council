// Dates are 'YYYY-MM-DD' strings in Asia/Jakarta (UTC+7, no DST); instants are ms numbers.
const JKT_MS = 7 * 3600e3, DAY_MS = 86400e3;

export const isoDay = (ms = Date.now()) => new Date(ms + JKT_MS).toISOString().slice(0, 10);
export const stamp = (ms) => new Date(ms + JKT_MS).toISOString().slice(0, 16).replace('T', ' ');
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
