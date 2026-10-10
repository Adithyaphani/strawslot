import { addDays, diffDays, fmtDate } from '../lib/format';

// The signature visual: a field's harvest-to-sowing window as a strip, with
// today, the booked machine slot and the deadline. Gold = booked slot,
// green = safe window, red hatch = past the sowing deadline.
interface Props { harvestDate: string; deadline: string; today: string; start?: string | null; completion?: string | null; labels?: Record<string, string>; locale?: string; compact?: boolean; animate?: boolean }
export default function SeasonStrip({ harvestDate, deadline, today, start, completion, labels = {}, locale = 'en-IN', compact = false, animate = true }: Props) {
  const from = addDays(harvestDate < today ? harvestDate : today, -1);
  const endCandidates = [deadline, completion, today].filter(Boolean).sort();
  const to = addDays(endCandidates[endCandidates.length - 1], 3);
  const span = Math.max(1, diffDays(to, from));
  const pct = (d: string) => `${Math.min(100, Math.max(0, (diffDays(d, from) / span) * 100))}%`;
  const width = (a: string, b: string) => `${Math.max(1.2, (Math.max(0, diffDays(b, a)) / span) * 100)}%`;
  const late = completion && completion > deadline;
  const L = { harvest: 'Harvest', today: 'Today', slot: 'Booked slot', deadline: 'Sowing deadline', ...labels };
  const h = compact ? 'h-3' : 'h-5';
  const posNum = (d) => Math.min(100, Math.max(0, (diffDays(d, from) / span) * 100));
  // Keep labels inside the strip and stop them colliding.
  const anchor = (p) => (p > 72 ? '-translate-x-full' : p < 18 ? 'translate-x-0' : '-translate-x-1/2');
  const slotMid = start && completion ? (posNum(start) + posNum(addDays(completion, 1))) / 2 : 0;
  const stacked = posNum(deadline) - posNum(harvestDate) < 42;

  return (
    <div className={compact ? 'pt-1' : 'pt-7 pb-6'} aria-label={`${L.harvest} ${harvestDate}, ${L.deadline} ${deadline}${start ? `, ${L.slot} ${start} to ${completion}` : ''}`}>
      <div className={`relative ${h} rounded-full bg-smoke-100`}>
        {/* safe window */}
        <div className={`absolute inset-y-0 rounded-l-full bg-sprout-100 ${animate ? 'origin-left animate-sweep' : ''}`} style={{ left: pct(harvestDate), width: width(harvestDate, deadline) }} />
        {/* past deadline */}
        <div className="absolute inset-y-0 rounded-r-full" style={{ left: pct(deadline), right: 0, backgroundImage: 'repeating-linear-gradient(135deg, #F8D3C9 0 4px, #FCEDE9 4px 8px)' }} />
        {/* booked slot */}
        {start && completion && (
          <div className={`absolute inset-y-0 rounded-full ring-2 ring-white ${late ? 'bg-fire-500' : 'bg-stubble-500'}`} style={{ left: pct(start), width: width(start, addDays(completion, 1)) }}>
            {!compact && (
              <span className={`absolute -top-6 whitespace-nowrap text-[11px] font-semibold ${late ? 'text-fire-600' : 'text-stubble-700'} ${slotMid > 72 ? 'right-0' : slotMid < 18 ? 'left-0' : 'left-1/2 -translate-x-1/2'}`}>
                {L.slot} {fmtDate(start, undefined, locale)}{completion !== start ? `–${fmtDate(completion, undefined, locale)}` : ''}
              </span>
            )}
          </div>
        )}
        {/* deadline tick */}
        <div className="absolute -inset-y-1 w-0.5 bg-fire-500" style={{ left: pct(deadline) }} />
        {/* today marker */}
        <div className="absolute -inset-y-2 w-[3px] rounded bg-ink" style={{ left: pct(today) }}>
          {!compact && <span className={`absolute top-full mt-1 whitespace-nowrap text-[11px] font-bold ${posNum(today) < 8 ? 'left-0' : posNum(today) > 92 ? 'right-0' : '-translate-x-1/2'}`}>{L.today}</span>}
        </div>
      </div>
      {!compact && (
        <div className={`relative mt-6 text-[11px] text-ink-mute ${stacked ? 'h-9' : 'h-4'}`}>
          <span className={`absolute whitespace-nowrap ${anchor(posNum(harvestDate))}`} style={{ left: pct(harvestDate) }}>{L.harvest} {fmtDate(harvestDate, undefined, locale)}</span>
          <span className={`absolute whitespace-nowrap font-semibold text-fire-600 ${stacked ? 'top-4' : ''} ${anchor(posNum(deadline))}`} style={{ left: pct(deadline) }}>{L.deadline} {fmtDate(deadline, undefined, locale)}</span>
        </div>
      )}
    </div>
  );
}
