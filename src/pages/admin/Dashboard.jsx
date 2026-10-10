import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Download, Sparkles, CloudRain, Wind, Flame, ArrowUpRight } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Legend } from 'recharts';
import PageHead from './PageHead.jsx';
import FieldDrawer from './FieldDrawer.jsx';
import RiskMap from '../../components/RiskMap.jsx';
import { Panel, Button, Spinner, ErrorBox, LiveDot } from '../../components/ui.jsx';
import { api, download } from '../../lib/api.js';
import { useLoad } from '../../lib/useLoad.js';
import { useAT } from '../../lib/adminI18n.jsx';
import { fmtDate, fmtDay, fmtNum } from '../../lib/format.js';

const AXIS = { fontSize: 11, fill: '#7A857F' };

// Briefing bullets in the officer's language, built from the same facts the server uses.
export function briefingBullets(facts, t, locale) {
  if (!facts) return [];
  const d = (x) => fmtDate(x, undefined, locale);
  return [
    t('b_ontime', { p: facts.onTimePct, n: facts.pending, r: facts.atRisk, h: facts.highRisk }),
    facts.worstBlock ? t('b_block', { b: facts.worstBlock.name, n: facts.worstBlock.atRisk }) : t('b_noblock'),
    t('b_util', { n: facts.utilisationPct }),
    facts.rainDays.length ? t('b_rain', { d: facts.rainDays.map(d).join(', ') }) : t('b_norain'),
    t(facts.firesSource === 'sample' ? 'b_fires_sample' : 'b_fires', { n: facts.firesDistrict7d }),
    facts.openIssues ? t('b_issues', { n: facts.openIssues }) : null,
    facts.topAlert ? t('b_top', { f: facts.topAlert.fieldId, v: facts.topAlert.village, a: facts.topAlert.acres, d: d(facts.topAlert.deadline) }) : null,
  ].filter(Boolean);
}

export default function Dashboard() {
  const { t, lang, locale } = useAT();
  const { data, error, loading, reload } = useLoad(() => api('/admin/overview', { auth: true }));
  const brief = useLoad(() => api('/admin/briefing', { auth: true }));
  const [selected, setSelected] = useState(null);

  if (loading && !data) return <Spinner label={t('loading_sched')} />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const { stats, baseline, weather, air, fires } = data;
  const today = stats.today;
  const useAi = brief.data?.source === 'claude' && lang === 'en';
  const bullets = useAi ? brief.data.bullets : briefingBullets(brief.data?.facts, t, locale);
  const statusLabel = (s) => t(`st_${s}`);

  return (
    <div>
      <PageHead title={t('dash_title')} sub={t('dash_sub', { d: fmtDay(today, locale) })}>
        <Button variant="outline" icon={Download} onClick={() => download('/admin/export/schedule.csv', `strawslot-schedule-${today}.csv`)}>{t('export')}</Button>
        <Button variant="dark" icon={RefreshCw} loading={loading} onClick={() => { reload(); brief.reload(); }}>{t('rerun')}</Button>
      </PageHead>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label={t('kpi_ontime')} value={`${stats.onTimePct}%`} note={t('kpi_ontime_note', { n: baseline.onTimePct })} tone="bg-sprout-900 text-white" noteTone="text-sprout-200" bar={stats.onTimePct} />
        <Kpi label={t('kpi_risk')} value={fmtNum(stats.fields.atRisk)} note={t('kpi_risk_note', { h: stats.fields.highRisk, a: fmtNum(stats.acres.atRisk) })} accent="text-fire-600" to="/admin/alerts" />
        <Kpi label={t('kpi_util')} value={`${stats.utilisationPct}%`} note={t('kpi_util_note', { a: stats.machines.active, t: stats.machines.total })} bar={stats.utilisationPct} barTone="bg-stubble-500" />
        <Kpi label={t('kpi_straw')} value={`${fmtNum(stats.impact.strawTonnes)} t`} note={t('kpi_straw_note', { c: fmtNum(stats.impact.co2Tonnes), p: fmtNum(stats.impact.pmKg) })} />
      </section>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1fr_360px]">
        <Panel title={t('map_title')} sub={t('map_sub', { p: fmtNum(stats.fields.pending), c: fmtNum(stats.fields.cleared) })} pad={false}
          action={<LiveDot live={fires.live} label={fires.live ? t('fires_live', { n: fires.districtCount }) : t('fires_sample')} />}>
          <RiskMap fields={data.fields} chcs={data.chcs} fires={fires.points} centre={{ lat: 30.2, lon: 75.88 }} onSelect={setSelected} height={520} t={t} statusLabel={statusLabel} locale={locale} />
        </Panel>

        <div className="space-y-5">
          <section className="rounded-panel bg-sprout-900 p-5 text-white shadow-panel">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[17px] font-bold"><Sparkles className="h-4 w-4 text-stubble-300" />{t('brief_title')}</h2>
              <span className="text-[11px] text-sprout-300">{useAi ? t('brief_ai') : t('brief_auto')}</span>
            </div>
            {brief.loading ? <p className="mt-3 text-sm text-sprout-100">{t('preparing')}</p> : (
              <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-sprout-50">
                {bullets.map((b, i) => <li key={i} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-stubble-300" />{b}</li>)}
              </ul>
            )}
          </section>

          <Panel title={t('weather_title')} sub={weather.live ? t('weather_live') : t('weather_fallback')}>
            <div className="grid grid-cols-7 gap-1">
              {weather.days.filter((d) => d.date >= today).slice(0, 7).map((d) => {
                const stop = d.rainMm >= 5;
                return (
                  <div key={d.date} className={`rounded-xl px-1 py-2 text-center ${stop ? 'bg-sky-50 text-sky-600' : 'bg-ground'}`} title={`${d.rainMm} mm`}>
                    <p className="text-[10px] font-semibold text-ink-mute">{fmtDay(d.date, locale).split(',')[0]}</p>
                    {stop ? <CloudRain className="mx-auto my-1 h-4 w-4" /> : <p className="num my-1 text-sm font-bold">{Math.round(d.tMax)}°</p>}
                    <p className="num text-[10px]">{stop ? t('no_work') : `${d.rainMm || 0} mm`}</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-mute"><Wind className="h-3.5 w-3.5 shrink-0" />{t('wind_note', { n: Math.round(weather.days.find((d) => d.date === today)?.windKmh ?? 0) })}</p>
          </Panel>

          <Panel title={t('air_title')} sub={air.live ? t('air_live') : t('air_off')}>
            <div className="grid grid-cols-2 gap-2">
              {air.spots.map((s) => (
                <div key={s.id} className="rounded-xl bg-ground px-3 py-2.5">
                  <p className="text-xs text-ink-mute">{s.name}</p>
                  <p className="num font-display text-2xl font-bold">{s.pm25 != null ? Math.round(s.pm25) : '—'}<span className="ml-1 text-xs font-normal text-ink-mute">µg/m³</span></p>
                  {s.usAqi != null && <p className="text-[11px] text-ink-soft">US AQI {s.usAqi}</p>}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title={t('load_title')} sub={t('load_sub')}>
          <div className="h-64">
            <ResponsiveContainer>
              <ComposedChart data={stats.load.map((d) => ({ ...d, label: fmtDate(d.date, undefined, locale) }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#E7EBE5" />
                <XAxis dataKey="label" tick={AXIS} interval={2} tickLine={false} axisLine={false} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #DCE2DA', fontSize: 12 }} formatter={(v, n) => [`${v} ${t('acres_u')}`, n]} />
                <Bar dataKey="scheduled" name={t('scheduled')} fill="#D9A93A" radius={[4, 4, 0, 0]} />
                <Line dataKey="capacity" name={t('capacity')} stroke="#14211B" strokeWidth={2} dot={false} type="stepAfter" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title={t('blocks_title')} sub={t('blocks_sub')} action={<Link to="/admin/what-if" className="inline-flex items-center gap-1 text-sm font-semibold text-sprout-700">{t('plan_more')}<ArrowUpRight className="h-4 w-4" /></Link>}>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={stats.byBlock} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }} barSize={14}>
                <CartesianGrid horizontal={false} stroke="#E7EBE5" />
                <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={AXIS} width={80} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #DCE2DA', fontSize: 12 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="onTime" name={t('on_time')} stackId="a" fill="#2F8F4E" />
                <Bar dataKey="atRisk" name={t('at_risk')} stackId="a" fill="#D9482B" />
                <Bar dataKey="cleared" name={t('cleared')} stackId="a" fill="#C9CFCB" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <p className="mt-6 flex items-center gap-1.5 text-xs text-ink-mute"><Flame className="h-3.5 w-3.5 shrink-0" />{t('sim_note')}</p>
      <FieldDrawer fieldId={selected} onClose={() => setSelected(null)} onChanged={reload} />
    </div>
  );
}

function Kpi({ label, value, note, accent = 'text-ink', to, tone = 'bg-white border border-line', noteTone = 'text-ink-soft', bar, barTone = 'bg-sprout-300' }) {
  const body = (
    <div className={`h-full rounded-[18px] p-5 shadow-panel transition ${tone} ${to ? 'hover:-translate-y-0.5 hover:shadow-pop' : ''}`}>
      <p className={`text-sm font-semibold ${tone.includes('text-white') ? 'text-sprout-200' : 'text-ink-mute'}`}>{label}</p>
      <p className={`num mt-2 font-display text-[40px] font-extrabold leading-none ${tone.includes('text-white') ? '' : accent}`}>{value}</p>
      {bar != null && <div className={`mt-3 h-1.5 rounded-full ${tone.includes('text-white') ? 'bg-white/15' : 'bg-smoke-100'}`}><div className={`h-1.5 rounded-full ${barTone}`} style={{ width: `${Math.min(100, bar)}%` }} /></div>}
      <p className={`mt-2 text-xs ${noteTone}`}>{note}</p>
    </div>
  );
  return to ? <Link to={to} className="block">{body}</Link> : body;
}
