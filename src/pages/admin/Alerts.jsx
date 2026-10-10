import { useState } from 'react';
import { CheckCircle2, Wand2, MessageSquareWarning, Shuffle, ExternalLink } from 'lucide-react';
import PageHead from './PageHead.jsx';
import FieldDrawer, { ReassignForm } from './FieldDrawer.jsx';
import { Panel, Button, Badge, Spinner, ErrorBox, Empty, Segmented, useToast } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useLoad } from '../../lib/useLoad.js';
import { fmtDay, relTime, RISK } from '../../lib/format.js';

export default function Alerts() {
  const toast = useToast();
  const { data, error, loading, reload } = useLoad(() => api('/admin/alerts', { auth: true }));
  const [tab, setTab] = useState('alerts');
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [level, setLevel] = useState('all');
  const [more, setMore] = useState(null);

  if (loading && !data) return <Spinner label="Checking every field against its deadline" />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const alerts = data.alerts.filter((a) => level === 'all' || a.risk.level === level);
  const openIssues = data.issues.filter((i) => i.status === 'open');

  const apply = async (a, s) => {
    setBusy(`${a.fieldId}-${s.machineId}`);
    try {
      const r = await api('/admin/reassign', { method: 'POST', auth: true, body: { fieldId: a.fieldId, machineId: s.machineId, fromDate: s.fromDate } });
      if (r.result.status === 'at_risk') toast(`${a.fieldId}: still short. Try the next suggestion.`, 'err');
      else toast(`${a.fieldId} fixed: machine starts ${fmtDay(r.result.start)}, done ${fmtDay(r.result.completion)}`);
      reload();
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(null); }
  };

  const resolve = async (i) => {
    try { await api(`/admin/issues/${i.id}/resolve`, { method: 'POST', auth: true, body: {} }); toast('Report marked resolved'); reload(); } catch (e) { toast(e.message, 'err'); }
  };

  return (
    <div>
      <PageHead title="Early warnings" sub="Fields projected to miss their sowing deadline, with fixes ranked by distance. Acting here re-runs the schedule instantly.">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'alerts', label: `At-risk fields (${data.alerts.length})` }, { value: 'issues', label: `Farmer reports (${openIssues.length})` }]} />
      </PageHead>

      {tab === 'alerts' && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-mute">Show</span>
            <Segmented value={level} onChange={setLevel} options={[{ value: 'all', label: 'All' }, { value: 'high', label: 'High' }, { value: 'medium', label: 'Watch' }]} />
          </div>
          {alerts.length === 0 ? (
            <Panel><Empty icon={CheckCircle2} title="Every pending field is scheduled before its deadline">New bookings and weather changes are checked each time the schedule runs.</Empty></Panel>
          ) : (
            <div className="space-y-3">
              {alerts.map((a) => (
                <article key={a.fieldId} className="panel overflow-hidden">
                  <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
                    <div className="flex shrink-0 items-center gap-3 sm:w-40 sm:flex-col sm:items-start">
                      <span className="num grid h-12 w-12 place-items-center rounded-full font-display text-lg font-extrabold text-white" style={{ background: RISK[a.risk.level].color }}>{a.risk.score}</span>
                      <div>
                        <p className="text-sm font-bold">{a.leadDays >= 0 ? `${a.leadDays} days to deadline` : `${-a.leadDays} days past`}</p>
                        <p className="text-xs text-ink-mute">Deadline {fmtDay(a.deadline)}</p>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button className="text-left text-[17px] font-bold hover:underline" onClick={() => setDrawer(a.fieldId)}>{a.fieldId} · {a.farmerName}</button>
                        <Badge className="bg-smoke-100 text-ink-soft">{a.village}</Badge>
                        <Badge className="bg-smoke-100 text-ink-soft">{a.acres} ac</Badge>
                      </div>
                      <p className="mt-1 text-sm text-ink-soft">{a.risk.reasons.join('. ')}.</p>
                      {a.unscheduledAcres > 0 && <p className="mt-1 text-xs text-fire-600">{a.unscheduledAcres} acres have no machine before the deadline.</p>}
                      {a.completion && <p className="mt-1 text-xs text-fire-600">Current plan finishes {fmtDay(a.completion)}, after the deadline.</p>}

                      <div className="mt-3 space-y-2">
                        {a.suggestions.filter((s) => s.kind === 'reassign').slice(0, more === a.fieldId ? 3 : 1).map((s) => (
                          <div key={s.machineId} className="flex flex-col gap-2 rounded-ctl border border-line bg-ground px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="flex items-center gap-2 text-sm"><Wand2 className="h-4 w-4 shrink-0 text-stubble-600" />{s.text}</p>
                            <Button size="sm" loading={busy === `${a.fieldId}-${s.machineId}`} onClick={() => apply(a, s)}>Apply fix</Button>
                          </div>
                        ))}
                        {a.suggestions.filter((s) => s.kind === 'reassign').length > 1 && more !== a.fieldId && (
                          <button className="text-xs font-semibold text-ink-soft underline" onClick={() => setMore(a.fieldId)}>Show {a.suggestions.filter((s) => s.kind === 'reassign').length - 1} more machine options</button>
                        )}
                        {a.suggestions.filter((s) => s.kind !== 'reassign').map((s) => (
                          <p key={s.text} className="flex items-center gap-2 text-sm text-ink-soft"><Shuffle className="h-4 w-4 shrink-0 text-ink-mute" />{s.text}</p>
                        ))}
                      </div>
                      <div className="mt-3 flex gap-3">
                        <button className="text-sm font-semibold text-sprout-700" onClick={() => setOpen(open === a.fieldId ? null : a.fieldId)}>{open === a.fieldId ? 'Close' : 'Choose machine manually'}</button>
                        <button className="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft" onClick={() => setDrawer(a.fieldId)}>Open field<ExternalLink className="h-3.5 w-3.5" /></button>
                      </div>
                      {open === a.fieldId && (
                        <div className="mt-3 max-w-md rounded-panel border border-line p-4">
                          <ReassignForm fieldId={a.fieldId} machines={data.machines} chcs={data.chcs} onDone={() => { setOpen(null); reload(); }} />
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'issues' && (
        <Panel pad={false}>
          {data.issues.length === 0 ? <Empty icon={MessageSquareWarning} title="No farmer reports yet">Farmers can report a late machine or changed harvest date from their booking screen.</Empty> : (
            <ul className="divide-y divide-line">
              {data.issues.map((i) => (
                <li key={i.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">{i.type.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())}<span className="font-normal text-ink-mute"> on {i.fieldId}, {i.farmerName}</span></p>
                    {i.note && <p className="text-sm text-ink-soft">{i.note}</p>}
                    <p className="text-xs text-ink-mute">{relTime(i.createdAt)} · {i.phone}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setDrawer(i.fieldId)}>Open field</Button>
                    {i.status === 'open' ? <Button size="sm" icon={CheckCircle2} onClick={() => resolve(i)}>Resolve</Button> : <Badge className="bg-sprout-50 text-sprout-700">Resolved</Badge>}
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
