import { useMemo, useState } from 'react';
import { CloudRain, Wrench, Play, Download } from 'lucide-react';
import PageHead from './PageHead';
import FieldDrawer from './FieldDrawer';
import { Button, Spinner, ErrorBox, useToast } from '../../components/ui';
import { api, download } from '../../lib/api';
import { useLoad } from '../../lib/useLoad';
import { fmtDate, fmtDay, RISK } from '../../lib/format';
import { useAT } from '../../lib/adminI18n';

const COL = 58;

export default function Dispatch() {
  const toast = useToast();
  const { t, locale } = useAT();
  const { data, error, loading, reload } = useLoad(() => api('/admin/dispatch', { auth: true }));
  const [chc, setChc] = useState('all');
  const [drawer, setDrawer] = useState(null);

  const groups = useMemo(() => {
    if (!data) return [];
    return data.chcs
      .filter((c) => chc === 'all' || c.id === chc)
      .map((c) => ({ ...c, machines: data.machines.filter((m) => m.chcId === c.id) }));
  }, [data, chc]);

  if (loading && !data) return <Spinner label={t('building')} />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const days = data.days;
  const toggleMaint = async (m) => {
    const status = m.status === 'maintenance' ? 'active' : 'maintenance';
    try {
      await api(`/admin/machines/${m.id}`, { method: 'POST', auth: true, body: { status } });
      toast(status === 'maintenance' ? t('toast_maint', { m: m.label }) : t('toast_active', { m: m.label }));
      reload();
    } catch (e) { toast(e.message, 'err'); }
  };

  return (
    <div>
      <PageHead title={t('dp_title')} sub={t('dp_sub')}>
        <select className="input h-10 w-56 py-0 text-sm" value={chc} onChange={(e) => setChc(e.target.value)} aria-label={t('all_centres')}>
          <option value="all">{t('all_centres')}</option>
          {data.chcs.map((c) => <option key={c.id} value={c.id}>{c.name.replace(' Custom Hiring Centre', '')}</option>)}
        </select>
        <Button variant="outline" icon={Download} onClick={() => download('/admin/export/schedule.csv', `strawslot-schedule-${data.today}.csv`)}>{t('csv')}</Button>
        <Button variant="dark" icon={Play} loading={loading} onClick={reload}>{t('rerun')}</Button>
      </PageHead>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: 240 + days.length * COL }}>
            {/* day header */}
            <div className="sticky top-0 z-10 flex border-b border-line bg-white">
              <div className="sticky left-0 z-20 w-[240px] shrink-0 border-r border-line bg-white px-4 py-2 text-xs font-semibold text-ink-mute">{t('machine')}</div>
              {days.map((d) => (
                <div key={d.date} style={{ width: COL }} className={`shrink-0 border-r border-line/60 py-2 text-center text-[11px] ${d.date === data.today ? 'bg-stubble-50 font-bold text-ink' : 'text-ink-mute'} ${!d.working ? 'bg-sky-50 text-sky-600' : ''}`}>
                  <p>{fmtDay(d.date, locale).split(',')[0]}</p>
                  <p className="num font-semibold">{d.date.slice(8, 10).replace(/^0/, '')}</p>
                  {!d.working && <CloudRain className="mx-auto mt-0.5 h-3 w-3" />}
                </div>
              ))}
            </div>

            {groups.map((g) => (
              <div key={g.id}>
                <div className="sticky left-0 flex items-center gap-3 border-b border-line bg-ground px-4 py-2 text-xs">
                  <span className="font-bold text-ink">{g.name}</span>
                  <span className="text-ink-mute">{t('tractors_n', { n: g.tractors.length, hp: g.tractors.map((x) => `${x.hp} HP`).join(', ') })}</span>
                </div>
                {g.machines.map((m) => {
                  const byDate = {};
                  m.jobs.forEach((j) => { (byDate[j.date] = byDate[j.date] || []).push(j); });
                  const maint = m.status === 'maintenance';
                  return (
                    <div key={m.id} className="flex border-b border-line/70">
                      <div className="sticky left-0 z-[5] flex w-[240px] shrink-0 items-center justify-between gap-2 border-r border-line bg-white px-4 py-2">
                        <div className="min-w-0">
                          <p className={`truncate text-sm font-semibold ${maint ? 'text-ink-mute line-through' : ''}`}>{t(`mt_${m.type}`)} #{m.label.split('#')[1]}</p>
                          <p className="text-[11px] text-ink-mute">{t('per_day', { a: m.acresPerDay, h: m.minHp })}</p>
                        </div>
                        <button onClick={() => toggleMaint(m)} title={maint ? t('maint_off') : t('maint_on')}
                          className={`shrink-0 rounded-ctl p-1.5 ${maint ? 'bg-fire-50 text-fire-600' : 'text-ink-mute hover:bg-smoke-100'}`} aria-label={`${maint ? t('maint_off') : t('maint_on')}: ${m.label}`}>
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
                              {jobs.length > 2 && <span className="px-1 text-[10px] font-semibold text-ink-soft">{t('more_n', { n: jobs.length - 2 })}</span>}
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
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm bg-[#B88A22]" />{t('lg_booked')}</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm bg-fire-500" />{t('lg_late')}</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm bg-stubble-100" />{t('lg_share')}</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm bg-sky-50" />{t('lg_rain')}</span>
      </div>
      <FieldDrawer fieldId={drawer} onClose={() => setDrawer(null)} onChanged={reload} />
    </div>
  );
}
