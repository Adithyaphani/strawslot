import { useMemo, useState } from 'react';
import { CloudRain, Wrench, Play, Download } from 'lucide-react';
import PageHead from './PageHead.jsx';
import FieldDrawer from './FieldDrawer.jsx';
import { Button, Spinner, ErrorBox, useToast } from '../../components/ui.jsx';
import { api, download } from '../../lib/api.js';
import { useLoad } from '../../lib/useLoad.js';
import { fmtDate, RISK } from '../../lib/format.js';

const COL = 58;

export default function Dispatch() {
  const toast = useToast();
  const { data, error, loading, reload } = useLoad(() => api('/admin/dispatch', { auth: true }));
  const [chc, setChc] = useState('all');
  const [drawer, setDrawer] = useState(null);

  const groups = useMemo(() => {
    if (!data) return [];
    return data.chcs
      .filter((c) => chc === 'all' || c.id === chc)
      .map((c) => ({ ...c, machines: data.machines.filter((m) => m.chcId === c.id) }));
  }, [data, chc]);

  if (loading && !data) return <Spinner label="Building the dispatch board" />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const days = data.days;
  const toggleMaint = async (m) => {
    const status = m.status === 'maintenance' ? 'active' : 'maintenance';
    try {
      await api(`/admin/machines/${m.id}`, { method: 'POST', auth: true, body: { status } });
      toast(status === 'maintenance' ? `${m.label} taken off the road, jobs reshuffled` : `${m.label} back in service`);
      reload();
    } catch (e) { toast(e.message, 'err'); }
  };

  return (
    <div>
      <PageHead title="Dispatch board" sub="Each row is a machine, each column a day. Gold cells are booked work; the fuller the cell, the more of that day's capacity is used. Blue days are blocked by rain.">
        <select className="input h-10 w-56 py-0 text-sm" value={chc} onChange={(e) => setChc(e.target.value)} aria-label="Filter by hiring centre">
          <option value="all">All hiring centres</option>
          {data.chcs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Button variant="outline" icon={Download} onClick={() => download('/admin/export/schedule.csv', `strawslot-schedule-${data.today}.csv`)}>CSV</Button>
        <Button variant="dark" icon={Play} loading={loading} onClick={reload}>Re-run optimiser</Button>
      </PageHead>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: 240 + days.length * COL }}>
            {/* day header */}
            <div className="sticky top-0 z-10 flex border-b border-line bg-white">
              <div className="sticky left-0 z-20 w-[240px] shrink-0 border-r border-line bg-white px-4 py-2 text-xs font-semibold text-ink-mute">Machine</div>
              {days.map((d) => (
                <div key={d.date} style={{ width: COL }} className={`shrink-0 border-r border-line/60 py-2 text-center text-[11px] ${d.date === data.today ? 'bg-stubble-50 font-bold text-ink' : 'text-ink-mute'} ${!d.working ? 'bg-sky-50 text-sky-600' : ''}`}>
                  <p>{fmtDate(d.date, { weekday: 'short' })}</p>
                  <p className="num font-semibold">{fmtDate(d.date, { day: 'numeric' })}</p>
                  {!d.working && <CloudRain className="mx-auto mt-0.5 h-3 w-3" />}
                </div>
              ))}
            </div>

            {groups.map((g) => (
              <div key={g.id}>
                <div className="sticky left-0 flex items-center gap-3 border-b border-line bg-ground px-4 py-2 text-xs">
                  <span className="font-bold text-ink">{g.name}</span>
                  <span className="text-ink-mute">{g.tractors.length} tractor{g.tractors.length === 1 ? '' : 's'} ({g.tractors.map((t) => `${t.hp} HP`).join(', ')})</span>
                </div>
                {g.machines.map((m) => {
                  const byDate = {};
                  m.jobs.forEach((j) => { (byDate[j.date] = byDate[j.date] || []).push(j); });
                  const maint = m.status === 'maintenance';
                  return (
                    <div key={m.id} className="flex border-b border-line/70">
                      <div className="sticky left-0 z-[5] flex w-[240px] shrink-0 items-center justify-between gap-2 border-r border-line bg-white px-4 py-2">
                        <div className="min-w-0">
                          <p className={`truncate text-sm font-semibold ${maint ? 'text-ink-mute line-through' : ''}`}>{m.label}</p>
                          <p className="text-[11px] text-ink-mute">{m.acresPerDay} ac/day · needs {m.minHp} HP</p>
                        </div>
                        <button onClick={() => toggleMaint(m)} title={maint ? 'Return to service' : 'Mark under maintenance'}
                          className={`shrink-0 rounded-ctl p-1.5 ${maint ? 'bg-fire-50 text-fire-600' : 'text-ink-mute hover:bg-smoke-100'}`} aria-label={maint ? `Return ${m.label} to service` : `Mark ${m.label} under maintenance`}>
                          <Wrench className="h-4 w-4" />
                        </button>
                      </div>
                      {days.map((d) => {
                        const jobs = byDate[d.date] || [];
                        const used = m.usage[d.date] || 0;
                        const fill = Math.min(1, used / m.acresPerDay);
                        return (
                          <div key={d.date} style={{ width: COL }} className={`relative shrink-0 border-r border-line/50 p-0.5 ${!d.working ? 'bg-sky-50/70' : ''} ${d.date === data.today ? 'bg-stubble-50/60' : ''} ${maint ? 'bg-[repeating-linear-gradient(135deg,#EEF0EE_0_4px,#fff_4px_8px)]' : ''}`}>
                            {fill > 0 && <div className="absolute inset-x-0.5 bottom-0.5 rounded-sm bg-stubble-100" style={{ height: `${fill * 100}%` }} />}
                            <div className="relative flex flex-col gap-0.5">
                              {jobs.slice(0, 2).map((j) => (
                                <button key={j.fieldId} onClick={() => setDrawer(j.fieldId)} title={`${j.fieldId} ${j.farmerName}, ${j.village}: ${j.acres} ac, ${j.travelKm} km travel, deadline ${j.deadline}`}
                                  className="truncate rounded-sm px-1 py-0.5 text-left text-[10px] font-semibold text-white hover:opacity-90"
                                  style={{ background: j.onTime ? (j.level === 'high' ? RISK.high.color : '#B88A22') : RISK.high.color }}>
                                  {j.fieldId.slice(2)} <span className="font-normal opacity-90">{j.acres}</span>
                                </button>
                              ))}
                              {jobs.length > 2 && <span className="px-1 text-[10px] font-semibold text-ink-soft">+{jobs.length - 2} more</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-mute">
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm bg-[#B88A22]" />Booked, on time (field id, acres)</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm bg-fire-500" />Late or high-risk field</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm bg-stubble-100" />Share of daily capacity used</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm bg-sky-50" />Rain, no field work</span>
      </div>
      <FieldDrawer fieldId={drawer} onClose={() => setDrawer(null)} onChanged={reload} />
    </div>
  );
}
