import { useState } from 'react';
import { Plus, Trash2, FlaskConical, Wrench, Tractor } from 'lucide-react';
import PageHead from './PageHead';
import { Panel, Button, ErrorBox, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { useLoad } from '../../lib/useLoad';
import { fmtNum } from '../../lib/format';
import { useAT } from '../../lib/adminI18n';

type Metric = [string, string, (v: number) => string, 'up' | 'down' | null];
const METRICS: Metric[] = [
  ['onTimePct', 'm_ontime', (v) => `${v}%`, 'up'],
  ['atRisk', 'm_atrisk', (v) => fmtNum(v), 'down'],
  ['protectedAcres', 'm_acres', (v) => fmtNum(v), 'up'],
  ['co2Tonnes', 'm_co2', (v) => fmtNum(v), 'up'],
  ['utilisationPct', 'm_util', (v) => `${v}%`, null],
  ['machines', 'm_machines', (v) => fmtNum(v), null],
];

export default function WhatIf() {
  const { t } = useAT();
  const meta = useLoad(() => api('/meta'));
  const [rows, setRows] = useState<{ chcId: string; type: string; count: number | string }[]>([]);
  const [fixMaintenance, setFix] = useState(false);
  const [extraTractors, setTractors] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  if (meta.loading) return <Spinner />;
  if (meta.error) return <ErrorBox error={meta.error} onRetry={meta.reload} />;
  const chcs = meta.data.chcs;
  const types = Object.entries(meta.data.machineTypes);

  const addRow = (preset?: { chcId: string; type: string; count: number }) => setRows((r) => [...r, preset || { chcId: chcs[0].id, type: 'super_seeder', count: 1 }]);
  const update = (i: number, k: string, v: unknown) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const run = async () => {
    setBusy(true); setError(null);
    try { setResult(await api('/admin/whatif', { method: 'POST', auth: true, body: { add: rows.map((r) => ({ ...r, count: Number(r.count) })), fixMaintenance, extraTractors: Number(extraTractors) } })); }
    catch (e) { setError(e); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHead title={t('wi_title')} sub={t('wi_sub')} />
      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <Panel title={t('changes')}>
          <div className="space-y-3">
            {rows.length === 0 && <p className="rounded-ctl bg-ground px-4 py-3 text-sm text-ink-soft">{t('none_added')}</p>}
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_64px_36px] items-end gap-2">
                <div>
                  {i === 0 && <label className="label text-xs">{t('centre')}</label>}
                  <select className="input py-2.5 text-sm" value={r.chcId} onChange={(e) => update(i, 'chcId', e.target.value)}>{chcs.map((c) => <option key={c.id} value={c.id}>{c.name.replace(' Custom Hiring Centre', '')}</option>)}</select>
                </div>
                <div>
                  {i === 0 && <label className="label text-xs">{t('machine')}</label>}
                  <select className="input py-2.5 text-sm" value={r.type} onChange={(e) => update(i, 'type', e.target.value)}>{types.map(([k]) => <option key={k} value={k}>{t(`mt_${k}`)}</option>)}</select>
                </div>
                <div>
                  {i === 0 && <label className="label text-xs">{t('count')}</label>}
                  <input className="input num py-2.5 text-sm" type="number" min="1" max="20" value={r.count} onChange={(e) => update(i, 'count', e.target.value)} />
                </div>
                <button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="mb-1 grid h-9 w-9 place-items-center rounded-ctl text-ink-mute hover:bg-fire-50 hover:text-fire-600" aria-label="remove"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" icon={Plus} onClick={() => addRow()}>{t('add_machine')}</Button>
              <Button variant="ghost" size="sm" onClick={() => setRows([{ chcId: 'chc-moonak', type: 'baler', count: 2 }, { chcId: 'chc-lehragaga', type: 'happy_seeder', count: 1 }])}>{t('preset_south')}</Button>
              <Button variant="ghost" size="sm" onClick={() => setRows(chcs.map((c) => ({ chcId: c.id, type: 'super_seeder', count: 1 })))}>{t('preset_each')}</Button>
            </div>

            <div className="space-y-3 border-t border-line pt-4">
              <label className="flex cursor-pointer items-center gap-3">
                <input type="checkbox" checked={fixMaintenance} onChange={(e) => setFix(e.target.checked)} className="h-4 w-4 accent-sprout-600" />
                <Wrench className="h-4 w-4 text-ink-mute" /><span className="text-sm font-medium">{t('repair')}</span>
              </label>
              <div>
                <label className="label flex items-center gap-2 text-sm"><Tractor className="h-4 w-4 text-ink-mute" />{t('rent')}</label>
                <div className="flex items-center gap-3">
                  <input type="range" min="0" max="16" value={extraTractors} onChange={(e) => setTractors(Number(e.target.value))} className="flex-1 accent-sprout-600" />
                  <span className="num w-8 text-right font-bold">{extraTractors}</span>
                </div>
              </div>
            </div>
            <Button size="lg" className="w-full" icon={FlaskConical} loading={busy} onClick={run}>{t('run')}</Button>
            <ErrorBox error={error} />
          </div>
        </Panel>

        <Panel title={t('result')} sub={result ? t('result_sub') : t('result_empty')}>
          {!result ? (
            <div className="grid h-64 place-items-center rounded-ctl border border-dashed border-line text-sm text-ink-mute">{t('result_placeholder')}</div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-ink-mute"><th className="pb-2 font-semibold">{t('metric')}</th><th className="pb-2 text-right font-semibold">{t('now')}</th><th className="pb-2 text-right font-semibold">{t('with_changes')}</th><th className="pb-2 text-right font-semibold">{t('change')}</th></tr></thead>
              <tbody>
                {METRICS.map(([k, label, f, good]) => {
                  const b = result.before[k], a = result.after[k];
                  const d = Math.round((a - b) * 10) / 10;
                  const better = good === 'up' ? d > 0 : good === 'down' ? d < 0 : null;
                  return (
                    <tr key={k} className="border-t border-line">
                      <td className="py-3 font-medium">{t(label)}</td>
                      <td className="num py-3 text-right text-ink-soft">{f(b)}</td>
                      <td className="num py-3 text-right font-display text-lg font-bold">{f(a)}</td>
                      <td className={`num py-3 text-right font-semibold ${better === true ? 'text-sprout-700' : better === false ? 'text-fire-600' : 'text-ink-mute'}`}>{d === 0 ? '±0' : `${d > 0 ? '+' : ''}${fmtNum(d, 1)}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}
