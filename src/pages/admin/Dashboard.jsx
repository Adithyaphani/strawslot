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
import { fmtDate, fmtDay, fmtNum } from '../../lib/format.js';

const AXIS = { fontSize: 11, fill: '#7A857F' };

export default function Dashboard() {
  const { data, error, loading, reload } = useLoad(() => api('/admin/overview', { auth: true }));
  const brief = useLoad(() => api('/admin/briefing', { auth: true }));
  const [selected, setSelected] = useState(null);

  if (loading && !data) return <Spinner label="Running today's schedule" />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const { stats, baseline, weather, air, fires } = data;
  const today = stats.today;

  return (
    <div>
      <PageHead title="District overview" sub={`${fmtDay(today)}. Schedule recalculated just now against live rain forecast and fire activity.`}>
        <Button variant="outline" icon={Download} onClick={() => download('/admin/export/schedule.csv', `strawslot-schedule-${today}.csv`)}>Export schedule</Button>
        <Button variant="dark" icon={RefreshCw} loading={loading} onClick={() => { reload(); brief.reload(); }}>Re-run optimiser</Button>
      </PageHead>

      {/* Headline numbers: one strip, not four identical cards */}
      <section className="panel grid grid-cols-2 divide-line lg:grid-cols-4 lg:divide-x">
        <Kpi label="Fields on time" value={`${stats.onTimePct}%`} note={`vs ${baseline.onTimePct}% with first-come booking`} accent="text-sprout-700" />
        <Kpi label="Fields at risk" value={fmtNum(stats.fields.atRisk)} note={`${stats.fields.highRisk} high risk, ${fmtNum(stats.acres.atRisk)} acres`} accent="text-fire-600" to="/admin/alerts" />
        <Kpi label="Machine use, next 14 days" value={`${stats.utilisationPct}%`} note={`${stats.machines.active} of ${stats.machines.total} machines active`} />
        <Kpi label="Straw kept from fire" value={`${fmtNum(stats.impact.strawTonnes)} t`} note={`${fmtNum(stats.impact.co2Tonnes)} t CO₂, ${fmtNum(stats.impact.pmKg)} kg PM avoided`} />
      </section>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1fr_340px]">
        <Panel title="Fields by burn risk" sub={`${fmtNum(stats.fields.pending)} pending, ${fmtNum(stats.fields.cleared)} cleared. Click a field to act on it.`} pad={false}
          action={<LiveDot live={fires.live} label={fires.live ? `FIRMS live: ${fires.districtCount} fires, 7 days` : 'Fires: sample data'} />}>
          <RiskMap fields={data.fields} chcs={data.chcs} fires={fires.points} centre={{ lat: 30.2, lon: 75.88 }} onSelect={setSelected} height={480} />
        </Panel>

        <div className="space-y-5">
          <section className="rounded-panel bg-sprout-900 p-5 text-white shadow-panel">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[17px] font-bold"><Sparkles className="h-4 w-4 text-stubble-300" />Today's briefing</h2>
              <span className="text-[11px] text-sprout-300">{brief.data?.source === 'claude' ? 'AI summary' : 'Auto summary'}</span>
            </div>
            {brief.loading ? <p className="mt-3 text-sm text-sprout-100">Preparing…</p> : (
              <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-sprout-50">
                {brief.data?.bullets?.map((b, i) => <li key={i} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-stubble-300" />{b}</li>)}
              </ul>
            )}
          </section>

          <Panel title="Field-work weather" sub={weather.live ? 'Open-Meteo forecast, Sangrur' : 'Forecast unavailable, assuming dry days'}>
            <div className="grid grid-cols-7 gap-1">
              {weather.days.filter((d) => d.date >= today).slice(0, 7).map((d) => {
                const stop = d.rainMm >= 5;
                return (
                  <div key={d.date} className={`rounded-ctl px-1 py-2 text-center ${stop ? 'bg-sky-50 text-sky-600' : 'bg-ground'}`} title={`${d.rainMm} mm rain`}>
                    <p className="text-[10px] font-semibold text-ink-mute">{fmtDate(d.date, { weekday: 'short' })}</p>
                    {stop ? <CloudRain className="mx-auto my-1 h-4 w-4" /> : <p className="num my-1 text-sm font-bold">{Math.round(d.tMax)}°</p>}
                    <p className="num text-[10px]">{stop ? 'No work' : `${d.rainMm || 0} mm`}</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-mute"><Wind className="h-3.5 w-3.5" />Wind today {Math.round(weather.days.find((d) => d.date === today)?.windKmh ?? 0)} km/h. Calm days trap smoke near villages.</p>
          </Panel>

          <Panel title="Air right now" sub={air.live ? 'PM2.5, Open-Meteo air quality' : 'Air quality feed unavailable'}>
            <div className="grid grid-cols-2 gap-2">
              {air.spots.map((s) => (
                <div key={s.id} className="rounded-ctl bg-ground px-3 py-2.5">
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
        <Panel title="Daily machine load" sub="Acres scheduled vs total machine capacity, next 3 weeks">
          <div className="h-64">
            <ResponsiveContainer>
              <ComposedChart data={stats.load.map((d) => ({ ...d, label: fmtDate(d.date) }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#E7EBE5" />
                <XAxis dataKey="label" tick={AXIS} interval={2} tickLine={false} axisLine={false} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #DCE2DA', fontSize: 12 }} formatter={(v, n) => [`${v} ac`, n]} />
                <Bar dataKey="scheduled" name="Scheduled" fill="#D9A93A" radius={[4, 4, 0, 0]} />
                <Line dataKey="capacity" name="Capacity" stroke="#14211B" strokeWidth={2} dot={false} type="stepAfter" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Blocks" sub="Where the pressure is" action={<Link to="/admin/what-if" className="inline-flex items-center gap-1 text-sm font-semibold text-sprout-700">Plan more machines<ArrowUpRight className="h-4 w-4" /></Link>}>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={stats.byBlock} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }} barSize={14}>
                <CartesianGrid horizontal={false} stroke="#E7EBE5" />
                <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={AXIS} width={80} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #DCE2DA', fontSize: 12 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="onTime" name="On time" stackId="a" fill="#2F8F4E" />
                <Bar dataKey="atRisk" name="At risk" stackId="a" fill="#D9482B" />
                <Bar dataKey="cleared" name="Cleared" stackId="a" fill="#C9CFCB" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <p className="mt-6 flex items-center gap-1.5 text-xs text-ink-mute"><Flame className="h-3.5 w-3.5" />Farms, machines and phone numbers are a simulated Sangrur season. Weather, air quality and (with a key) fire hotspots are live.</p>

      <FieldDrawer fieldId={selected} onClose={() => setSelected(null)} onChanged={reload} />
    </div>
  );
}

function Kpi({ label, value, note, accent = 'text-ink', to }) {
  const body = (
    <div className="px-5 py-4">
      <p className="text-xs font-semibold text-ink-mute">{label}</p>
      <p className={`num mt-1 font-display text-[32px] font-extrabold leading-none ${accent}`}>{value}</p>
      <p className="mt-1.5 text-xs text-ink-soft">{note}</p>
    </div>
  );
  return to ? <Link to={to} className="block border-b border-line hover:bg-ground lg:border-b-0">{body}</Link> : <div className="border-b border-line lg:border-b-0">{body}</div>;
}
