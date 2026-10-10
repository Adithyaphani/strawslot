const MONTHS: Record<string, string[]> = {
  'hi-IN': ['जन', 'फ़र', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुल', 'अग', 'सित', 'अक्टू', 'नव', 'दिस'],
  'pa-IN': ['ਜਨ', 'ਫ਼ਰ', 'ਮਾਰਚ', 'ਅਪ੍ਰੈ', 'ਮਈ', 'ਜੂਨ', 'ਜੁਲਾ', 'ਅਗ', 'ਸਤੰ', 'ਅਕਤੂ', 'ਨਵੰ', 'ਦਸੰ'],
};
const WEEKDAYS: Record<string, string[]> = {
  'hi-IN': ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'],
  'pa-IN': ['ਐਤ', 'ਸੋਮ', 'ਮੰਗਲ', 'ਬੁੱਧ', 'ਵੀਰ', 'ਸ਼ੁੱਕਰ', 'ਸ਼ਨੀ'],
};
// Hindi/Punjabi month names are built in because some browsers ship without that locale data.
export const fmtDate = (d?: string | null, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }, locale = 'en-IN'): string => {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00Z');
  if (MONTHS[locale] && opts.month) return `${dt.getUTCDate()} ${MONTHS[locale][dt.getUTCMonth()]}`;
  return new Intl.DateTimeFormat(locale, { ...opts, timeZone: 'UTC' }).format(dt);
};
export const fmtDay = (d?: string | null, locale = 'en-IN'): string => {
  if (d && WEEKDAYS[locale]) return `${WEEKDAYS[locale][new Date(d + 'T00:00:00Z').getUTCDay()]}, ${fmtDate(d, undefined, locale)}`;
  return fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' }, locale);
};
export const fmtNum = (n?: number | string | null, digits = 0) => (n == null ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: digits }));
export const diffDays = (a: string, b: string) => Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 864e5);
export const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
export const todayIST = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
export const relTime = (iso: string) => {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};
export const RISK = {
  high: { label: 'High risk', color: '#D9482B', cls: 'bg-fire-50 text-fire-600' },
  medium: { label: 'Watch', color: '#D9A93A', cls: 'bg-stubble-50 text-stubble-700' },
  low: { label: 'On track', color: '#2F8F4E', cls: 'bg-sprout-50 text-sprout-700' },
};
export const STATUS = {
  scheduled: { label: 'Scheduled', cls: 'bg-sprout-50 text-sprout-700' },
  awaiting_harvest: { label: 'Booked, awaiting harvest', cls: 'bg-sky-50 text-sky-600' },
  at_risk: { label: 'At risk', cls: 'bg-fire-50 text-fire-600' },
  cleared: { label: 'Cleared', cls: 'bg-smoke-100 text-ink-soft' },
  burned: { label: 'Burned', cls: 'bg-ink text-white' },
};
export const PREF = { in_situ: 'Mix into soil', ex_situ: 'Sell as bales', any: 'Either' };
