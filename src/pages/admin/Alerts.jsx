import { useState } from 'react';
import { CheckCircle2, Wand2, MessageSquareWarning, Shuffle, ExternalLink } from 'lucide-react';
import PageHead from './PageHead.jsx';
import FieldDrawer, { ReassignForm } from './FieldDrawer.jsx';
import { Panel, Button, Badge, Spinner, ErrorBox, Empty, Segmented, useToast } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useLoad } from '../../lib/useLoad.js';
import { useAT } from '../../lib/adminI18n.jsx';
import { fmtDay, RISK } from '../../lib/format.js';

export function suggestionText(s, t, chcName, locale) {
  if (s.kind === 'reassign') return t('sg_reassign', { m: t(`mt_${s.machineType}`), no: s.machineNo, c: chcName[s.chcId] || s.chcId, km: s.km, d: fmtDay(s.fromDate, locale) });
  if (s.kind === 'switch_method') return t('sg_switch');
  return t('sg_tractor');
}

export default function Alerts() {
  const toast = useToast();
  const { t, locale, reason, relTime } = useAT();
  const { data, error, loading, reload } = useLoad(() => api('/admin/alerts', { auth: true }));
  const [tab, setTab] = useState('alerts');
  const [open, setOpen] = useState(null);
  const [more, setMore] = useState(null);
  const [busy, setBusy] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [level, setLevel] = useState('all');

  if (loading && !data) return <Spinner label={t('al_loading')} />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const chcName = Object.fromEntries(data.chcs.map((c) => [c.id, c.name.replace(' Custom Hiring Centre', '')]));
  const alerts = data.alerts.filter((a) => level === 'all' || a.risk.level === level);
  const openIssues = data.issues.filter((i) => i.status === 'open');

  const apply = async (a, s) => {
    setBusy(`${a.fieldId}-${s.machineId}`);
    try {
      const r = await api('/admin/reassign', { method: 'POST', auth: true, body: { fieldId: a.fieldId, machineId: s.machineId, fromDate: s.fromDate } });
      const net = ` ${t('net_change', { a: data.alerts.length, b: r.atRiskAfter })}`;
      if (r.result.status === 'at_risk') toast(t('still_short', { f: a.fieldId }) + net, 'err');
      else toast(t('fixed_toast', { f: a.fieldId, s: fmtDay(r.result.start, locale), c: fmtDay(r.result.completion, locale) }) + net, r.atRiskAfter > data.alerts.length ? 'err' : 'ok');
      reload();
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(null); }
  };
  const autofix = async (a) => {
    setBusy(`${a.fieldId}-auto`);
    try {
      const r = await api('/admin/autofix', { method: 'POST', auth: true, body: { fieldId: a.fieldId } });
      if (r.fixed && r.result) toast(t('fixed_toast', { f: a.fieldId, s: fmtDay(r.result.start, locale), c: fmtDay(r.result.completion, locale) }));
      else if (!r.fixed) toast(t('autofix_fail', { f: a.fieldId }), 'err');
      reload();
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(null); }
  };
  const autofixAll = async () => {
    setBusy('all');
    try {
      const r = await api('/admin/autofix-all', { method: 'POST', auth: true, body: {} });
      toast(r.fixed ? t('autofix_all_done', { n: r.fixed, t: r.tried, a: r.atRiskBefore, b: r.atRiskAfter }) : t('autofix_all_none'), r.fixed ? 'ok' : 'err');
      reload();
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(null); }
  };
  const resolve = async (i) => {
    try { await api(`/admin/issues/${i.id}/resolve`, { method: 'POST', auth: true, body: {} }); toast(t('resolved_toast')); reload(); } catch (e) { toast(e.message, 'err'); }
  };

  return (
    <div>
      <PageHead title={t('al_title')} sub={t('al_sub')}>
        {tab === 'alerts' && data.alerts.length > 0 && <Button variant="dark" icon={Wand2} loading={busy === 'all'} onClick={autofixAll}>{t('autofix_all')}</Button>}
        <Segmented value={tab} onChange={setTab} options={[{ value: 'alerts', label: t('tab_alerts', { n: data.alerts.length }) }, { value: 'issues', label: t('tab_issues', { n: openIssues.length }) }]} />
      </PageHead>

      {tab === 'alerts' && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-mute">{t('show')}</span>
            <Segmented value={level} onChange={setLevel} options={[{ value: 'all', label: t('all') }, { value: 'high', label: t('high') }, { value: 'medium', label: t('watch') }]} />
          </div>
          {alerts.length === 0 ? (
            <Panel><Empty icon={CheckCircle2} title={t('none_title')}>{t('none_body')}</Empty></Panel>
          ) : (
            <div className="grid gap-4 2xl:grid-cols-2">
              {alerts.map((a) => {
                const reassigns = a.suggestions.filter((s) => s.kind === 'reassign');
                return (
                  <article key={a.fieldId} className="panel overflow-hidden">
                    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
                      <div className="flex shrink-0 items-center gap-3 sm:w-36 sm:flex-col sm:items-start">
                        <span className="num grid h-14 w-14 place-items-center rounded-2xl font-display text-xl font-extrabold text-white shadow-sm" style={{ background: RISK[a.risk.level].color }}>{a.risk.score}</span>
                        <div>
                          <p className="text-sm font-bold">{a.leadDays >= 0 ? t('days_to', { n: a.leadDays }) : t('days_past', { n: -a.leadDays })}</p>
                          <p className="text-xs text-ink-mute">{t('deadline_on', { d: fmtDay(a.deadline, locale) })}</p>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <button className="text-left text-[17px] font-bold hover:underline" onClick={() => setDrawer(a.fieldId)}>{a.fieldId} · {a.farmerName}</button>
                          <Badge className="bg-smoke-100 text-ink-soft">{a.village}</Badge>
                          <Badge className="bg-smoke-100 text-ink-soft">{a.acres} {t('acres_u')}</Badge>
                        </div>
                        <ul className="mt-2 space-y-0.5 text-sm text-ink-soft">
                          {a.risk.codes.map((c) => <li key={c.k} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-fire-500" />{reason(c)}</li>)}
                        </ul>
                        {a.unscheduledAcres > 0 && <p className="mt-1 text-xs font-medium text-fire-600">{t('unsched', { n: a.unscheduledAcres })}</p>}
                        {a.completion && <p className="mt-1 text-xs font-medium text-fire-600">{t('plan_finishes', { d: fmtDay(a.completion, locale) })}</p>}

                        <div className="mt-3 space-y-2">
                          {reassigns.slice(0, more === a.fieldId ? 3 : 1).map((s) => (
                            <div key={s.machineId} className="flex flex-col gap-2 rounded-xl border border-stubble-100 bg-stubble-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                              <p className="flex items-center gap-2 text-sm"><Wand2 className="h-4 w-4 shrink-0 text-stubble-600" />{suggestionText(s, t, chcName, locale)}</p>
                              <Button size="sm" variant="outline" loading={busy === `${a.fieldId}-${s.machineId}`} onClick={() => apply(a, s)}>{t('apply')}</Button>
                            </div>
                          ))}
                          {reassigns.length > 1 && more !== a.fieldId && (
                            <button className="text-xs font-semibold text-ink-soft underline" onClick={() => setMore(a.fieldId)}>{t('more_opts', { n: reassigns.length - 1 })}</button>
                          )}
                          {a.suggestions.filter((s) => s.kind !== 'reassign').map((s) => (
                            <p key={s.kind} className="flex items-center gap-2 text-sm text-ink-soft"><Shuffle className="h-4 w-4 shrink-0 text-ink-mute" />{suggestionText(s, t, chcName, locale)}</p>
                          ))}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-4">
                          {reassigns.length > 0 && <Button size="sm" variant="dark" icon={Wand2} loading={busy === `${a.fieldId}-auto`} onClick={() => autofix(a)}>{t('autofix')}</Button>}
                          <button className="text-sm font-semibold text-sprout-700" onClick={() => setOpen(open === a.fieldId ? null : a.fieldId)}>{open === a.fieldId ? t('close') : t('manual')}</button>
                          <button className="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft" onClick={() => setDrawer(a.fieldId)}>{t('open_field')}<ExternalLink className="h-3.5 w-3.5" /></button>
                        </div>
                        {open === a.fieldId && (
                          <div className="mt-3 max-w-md rounded-panel border border-line p-4">
                            <ReassignForm fieldId={a.fieldId} machines={data.machines} chcs={data.chcs} onDone={() => { setOpen(null); reload(); }} />
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'issues' && (
        <Panel pad={false}>
          {data.issues.length === 0 ? <Empty icon={MessageSquareWarning} title={t('no_reports')}>{t('no_reports_body')}</Empty> : (
            <ul className="divide-y divide-line">
              {data.issues.map((i) => (
                <li key={i.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">{t(`is_${i.type}`)}<span className="font-normal text-ink-mute"> · {t('on_field', { f: i.fieldId, n: i.farmerName })}</span></p>
                    {i.note && <p className="text-sm text-ink-soft">{i.note}</p>}
                    <p className="text-xs text-ink-mute">{relTime(i.createdAt)} · {i.phone}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setDrawer(i.fieldId)}>{t('open_field')}</Button>
                    {i.status === 'open' ? <Button size="sm" icon={CheckCircle2} onClick={() => resolve(i)}>{t('resolve')}</Button> : <Badge className="bg-sprout-50 text-sprout-700">{t('resolved')}</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <FieldDrawer fieldId={drawer} onClose={() => setDrawer(null)} onChanged={reload} />
    </div>
  );
}
