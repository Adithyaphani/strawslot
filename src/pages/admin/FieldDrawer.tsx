import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { X, Phone, Tractor, CheckCircle2, Flame, Pin, PinOff, Shuffle } from 'lucide-react';
import SeasonStrip from '../../components/SeasonStrip';
import { Button, Badge, Spinner, ErrorBox, useToast } from '../../components/ui';
import { api } from '../../lib/api';
import { useAT } from '../../lib/adminI18n';
import { fmtDay, RISK, STATUS, todayIST } from '../../lib/format';

export function ReassignForm({ fieldId, machines, chcs, defaultMachine, defaultDate, onDone }: { fieldId: string; machines: any[]; chcs: any[]; defaultMachine?: string; defaultDate?: string; onDone?: (r?: any) => void }) {
  const toast = useToast();
  const { t, locale } = useAT();
  const [machineId, setMachineId] = useState(defaultMachine || '');
  const [fromDate, setFromDate] = useState(defaultDate || todayIST());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const chcName = Object.fromEntries((chcs || []).map((c) => [c.id, c.name.replace(' Custom Hiring Centre', '')]));
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await api('/admin/reassign', { method: 'POST', auth: true, body: { fieldId, machineId, fromDate } });
      const late = r.result.status === 'at_risk';
      toast(late ? t('toast_still', { f: fieldId }) : t('toast_resched', { f: fieldId, d: fmtDay(r.result.start, locale) }), late ? 'err' : 'ok');
      onDone?.(r.result);
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <div>
        <label className="label" htmlFor={`m-${fieldId}`}>{t('machine')}</label>
        <select id={`m-${fieldId}`} className="input" value={machineId} onChange={(e) => setMachineId(e.target.value)}>
          <option value="">{t('choose_machine')}</option>
          {machines.map((m) => <option key={m.id} value={m.id}>{t(`mt_${m.type}`)} #{m.label.split('#')[1]} ({chcName[m.chcId] || m.chcId})</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor={`d-${fieldId}`}>{t('start_after')}</label>
        <input id={`d-${fieldId}`} type="date" className="input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
      </div>
      <ErrorBox error={err} />
      <Button icon={Pin} loading={busy} disabled={!machineId} onClick={save} className="w-full">{t('assign_btn')}</Button>
    </div>
  );
}

export default function FieldDrawer({ fieldId, onClose, onChanged }) {
  const toast = useToast();
  const { t, locale, reason } = useAT();
  const [data, setData] = useState(null);
  const [machines, setMachines] = useState(null);
  const [err, setErr] = useState(null);
  const [showReassign, setShowReassign] = useState(false);

  const load = () => { setErr(null); api(`/admin/fields/${fieldId}`, { auth: true }).then(setData).catch(setErr); };
  useEffect(() => { if (fieldId) { setData(null); setShowReassign(false); load(); } }, [fieldId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (showReassign && !machines) api('/admin/alerts', { auth: true }).then(setMachines).catch(setErr); }, [showReassign, machines]);
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  if (!fieldId) return null;
  const f = data?.field;
  const closed = f && ['cleared', 'burned'].includes(f.status);

  const act = async (path, body, msg) => {
    try { await api(path, { method: body ? 'POST' : 'DELETE', auth: true, body }); toast(msg); load(); onChanged?.(); } catch (e) { toast(e.message, 'err'); }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex justify-end bg-ink/30" onClick={onClose}>
      <aside className="h-full w-full max-w-md overflow-y-auto bg-white shadow-pop animate-drawer" onClick={(e) => e.stopPropagation()} aria-label={`${t('field')} ${fieldId}`}>
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-5 py-4">
          <div>
            <p className="text-xs text-ink-mute">{t('field')}</p>
            <h2 className="text-xl font-bold">{fieldId}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-smoke-100" aria-label={t('close')}><X className="h-5 w-5" /></button>
        </header>
        {err && <div className="p-5"><ErrorBox error={err} onRetry={load} /></div>}
        {!f && !err && <Spinner label={t('loading')} />}
        {f && (
          <div className="space-y-5 p-5">
            <div className="flex flex-wrap gap-2">
              <Badge className={STATUS[f.status]?.cls}>{t(`st_${f.status}`)}</Badge>
              {!closed && <Badge className={RISK[f.risk.level].cls}>{t('risk_n', { n: f.risk.score })}</Badge>}
              {f.pinned && <Badge className="bg-sky-50 text-sky-600"><Pin className="h-3 w-3" />{t('officer_override')}</Badge>}
              {f.source === 'farmer' && <Badge className="bg-stubble-50 text-stubble-700">{t('booked_by_farmer')}</Badge>}
            </div>

            <div>
              <p className="text-lg font-bold">{f.farmerName}</p>
              <p className="text-sm text-ink-soft">{t('village_line', { v: f.village, a: f.acres, p: t(`pref_${f.preference}`) })}</p>
              <a href={`tel:${f.phone}`} className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-sprout-700"><Phone className="h-3.5 w-3.5" />{f.phone}</a>
            </div>

            {!closed && (
              <div className="rounded-panel border border-line px-4">
                <SeasonStrip harvestDate={f.harvestDate} deadline={f.deadline} today={todayIST()} start={f.start} completion={f.completion} animate={false} locale={locale}
                  labels={{ harvest: t('harvest'), today: t('today'), slot: t('slot'), deadline: t('sowing_deadline') }} />
              </div>
            )}

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Item label={t('harvest')} value={fmtDay(f.harvestDate, locale)} />
              <Item label={t('sowing_deadline')} value={fmtDay(f.deadline, locale)} />
              <Item label={t('tractor')} value={f.tractor.owns ? t('tractor_own', { n: f.tractor.hp }) : t('tractor_none')} />
              <Item label={t('nearest')} value={f.nearestChc ? `${f.nearestChc.km} km` : '—'} />
            </dl>

            {!closed && f.risk.codes?.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-bold">{t('why_score')}</p>
                <ul className="space-y-1.5 text-sm text-ink-soft">
                  {f.risk.codes.map((c) => <li key={c.k} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-fire-500" />{reason(c)}</li>)}
                </ul>
                <div className="mt-3 grid grid-cols-4 gap-1 text-center text-[11px]">
                  {Object.entries(f.risk.parts as Record<string, number>).map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-ground px-1 py-1.5"><p className="num font-bold">{v}</p><p className="text-ink-mute">{t(`part_${k}`)}</p></div>
                  ))}
                </div>
              </div>
            )}

            {f.assignments.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-bold">{t('work_plan')}</p>
                <ul className="divide-y divide-line rounded-panel border border-line text-sm">
                  {f.assignments.map((a, i) => (
                    <li key={i} className="flex items-center justify-between px-3 py-2">
                      <span className="font-semibold">{fmtDay(a.date, locale)}</span>
                      <span className="text-ink-soft">{a.acres} {t('acres_u')} · {a.travelKm} km · {a.tractor === 'farmer' ? t('own_tractor') : t('chc_tractor')}</span>
                    </li>
                  ))}
                </ul>
                {f.machine && <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-soft"><Tractor className="h-4 w-4" />{t(`mt_${f.machine.type}`)}, {f.chc?.name}</p>}
                {f.vendor && <p className="mt-1 text-sm text-ink-soft">{t('pickup_line', { v: f.vendor.name, d: fmtDay(f.pickups[0].date, locale) })}</p>}
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-bold">{t('farmer_sms')}</p>
              <p className="rounded-xl bg-ground px-3 py-2.5 text-sm leading-relaxed">{f.message}</p>
            </div>

            {data.issues?.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-bold">{t('farmer_reports')}</p>
                {data.issues.map((i) => <p key={i.id} className="text-sm text-ink-soft">{t(`is_${i.type}`)} ({i.status === 'open' ? '•' : t('resolved')}){i.note ? `: ${i.note}` : ''}</p>)}
              </div>
            )}

            <div className="space-y-2 border-t border-line pt-4">
              {!closed && (
                <>
                  <Button variant="outline" icon={Shuffle} className="w-full" onClick={() => setShowReassign((s) => !s)}>{t('reassign')}</Button>
                  {showReassign && (machines ? <div className="rounded-panel border border-line p-4"><ReassignForm fieldId={f.id} machines={machines.machines} chcs={machines.chcs} onDone={() => { setShowReassign(false); load(); onChanged?.(); }} /></div> : <Spinner label={t('loading')} />)}
                  {f.pinned && <Button variant="ghost" icon={PinOff} className="w-full" onClick={() => act(`/admin/pins/${f.id}`, null, t('toast_override_removed'))}>{t('remove_override')}</Button>}
                  <div className="grid grid-cols-2 gap-2">
                    <Button icon={CheckCircle2} onClick={() => act(`/admin/fields/${f.id}/status`, { status: 'cleared' }, t('toast_cleared', { f: f.id }))}>{t('mark_cleared')}</Button>
                    <Button variant="outline" icon={Flame} onClick={() => act(`/admin/fields/${f.id}/status`, { status: 'burned' }, t('toast_burned', { f: f.id }))}>{t('mark_burned')}</Button>
                  </div>
                </>
              )}
              {closed && <Button variant="outline" className="w-full" onClick={() => act(`/admin/fields/${f.id}/status`, { status: 'pending' }, t('toast_reopened', { f: f.id }))}>{t('reopen')}</Button>}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function Item({ label, value }: { label: ReactNode; value: ReactNode }) {
  return <div className="rounded-xl bg-ground px-3 py-2"><dt className="text-xs text-ink-mute">{label}</dt><dd className="font-semibold">{value}</dd></div>;
}
