// Date helpers. All dates are plain 'YYYY-MM-DD' strings in India time (IST),
// so the scheduler never trips over time zones.

const DAY = 86400000;

export function todayIST(now = new Date()): string {
  const ist = new Date(now.getTime() + 5.5 * 3600000);
  return ist.toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00Z');
  return new Date(d.getTime() + n * DAY).toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  // a - b in whole days
  return Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / DAY);
}

export function dateRange(start: string, end: string): string[] {
  const out = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

export const maxDate = (a: string, b: string) => (a > b ? a : b);
export const minDate = (a: string, b: string) => (a < b ? a : b);
