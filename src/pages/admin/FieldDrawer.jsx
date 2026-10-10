import { useEffect, useState } from 'react';
import { X, Phone, Tractor, CheckCircle2, Flame, Pin, PinOff, Shuffle } from 'lucide-react';
import SeasonStrip from '../../components/SeasonStrip.jsx';
import { Button, Badge, Spinner, ErrorBox, useToast } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { fmtDay, RISK, STATUS, PREF, todayIST } from '../../lib/format.js';

export function ReassignForm({ fieldId, machines, chcs, defaultMachine, defaultDate, onDone }) {
  const toast = useToast();
  const [machineId, setMachineId] = useState(defaultMachine || '');
  const [fromDate, setFromDate] = useState(defaultDate || todayIST());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const chcName = Object.fromEntries((chcs || []).map((c) => [c.id, c.name]));
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await api('/admin/reassign', { method: 'POST', auth: true, body: { fieldId, machineId, fromDate } });
      toast(r.result.status === 'at_risk' ? `${fieldId} reassigned, still at risk. Try another machine.` : `${fieldId} rescheduled: starts ${fmtDay(r.result.start)}`, r.result.status === 'at_risk' ? 'err' : 'ok');
      onDone?.(r.result);
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <div>
        <label className="label" htmlFor={`m-${fieldId}`}>Machine</label>
        <select id={`m-${fieldId}`} className="input" value={machineId} onChange={(e) => setMachineId(e.target.value)}>
          <option value="">Choose a machine</option>
          {machines.map((m) => <option key={m.id} value={m.id}>{m.label} ({chcName[m.chcId] || m.chcId})</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor={`d-${fieldId}`}>Start no earlier than</label>
        <input id={`d-${fieldId}`} type="date" className="input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
      </div>
      <ErrorBox error={err} />
      <Button icon={Pin} loading={busy} disabled={!machineId} onClick={save} className="w-full">Assign and reschedule</Button>
    </div>
  );
}

export default function FieldDrawer({ fieldId, onClose, onChanged }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [machines, setMachines] = useState(null);
  const [err, setErr] = useState(null);
  const [showReassign, setShowReassign] = useState(false);

  const load = () => {
    setErr(null);
    api(`/admin/fields/${fieldId}`, { auth: true }).then(setData).catch(setErr);
  };
  useEffect(() => { if (fieldId) { setData(null); setShowReassign(false); load(); } }, [fieldId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (showReassign && !machines) api('/admin/alerts', { auth: true }).then((r) => setMachines(r)).catch(setErr); }, [showReassign, machines]);
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  if (!fieldId) return null;
  const f = data?.field;

  const act = async (path, body, msg) => {
    try { await api(path, { method: body ? 'POST' : 'DELETE', auth: true, body }); toast(msg); load(); onChanged?.(); } catch (e) { toast(e.message, 'err'); }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex justify-end bg-ink/30" onClick={onClose}>
      <aside className="h-full w-full max-w-md overflow-y-auto bg-white shadow-pop animate-drawer" onClick={(e) => e.stopPropagation()} aria-label={`Field ${fieldId}`}>
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-5 py-4">
          <div>
            <p className="text-xs text-ink-mute">Field</p>
            <h2 className="text-xl font-bold">{fieldId}</h2>
          </div>
          <button onClick={onClose} className="rounded-ctl p-2 hover:bg-smoke-100" aria-label="Close"><X className="h-5 w-5" /></button>
        </header>
        {err && <div className="p-5"><ErrorBox error={err} onRetry={load} /></div>}
        {!f && !err && <Spinner />}
        {f && (
          <div className="space-y-5 p-5">
            <div className="flex flex-wrap gap-2">
              <Badge className={STATUS[f.status]?.cls}>{STATUS[f.status]?.label}</Badge>
              {f.status !== 'cleared' && f.status !== 'burned' && <Badge className={RISK[f.risk.level].cls}>Risk {f.risk.score}</Badge>}
              {f.pinned && <Badge className="bg-sky-50 text-sky-600"><Pin className="h-3 w-3" />Officer override</Badge>}
              {f.source === 'farmer' && <Badge className="bg-stubble-50 text-stubble-700">Booked by farmer</Badge>}
            </div>

            <div>
              <p className="text-lg font-bold">{f.farmerName}</p>
              <p className="text-sm text-ink-soft">{f.village} village, {f.acres} acres, {PREF[f.preference]}</p>
              <a href={`tel:${f.phone}`} className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-sprout-700"><Phone className="h-3.5 w-3.5" />{f.phone}</a>
            </div>

            {f.status !== 'cleared' && (
              <div className="rounded-panel border border-line px-4">
                <SeasonStrip harvestDate={f.harvestDate} deadline={f.deadline} today={todayIST()} start={f.start} completion={f.completion} animate={false} />
              </div>
            )}

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Item label="Harvest" value={fmtDay(f.harvestDate)} />
              <Item label="Sowing deadline" value={fmtDay(f.deadline)} />
              <Item label="Tractor" value={f.tractor.owns ? `Own, ${f.tractor.hp} HP` : 'None (needs CHC tractor)'} />
              <Item label="Nearest centre" value={f.nearestChc ? `${f.nearestChc.km} km` : '—'} />
            </dl>

            {f.status !== 'cleared' && f.risk.reasons.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-bold">Why this risk score</p>
                <ul className="space-y-1.5 text-sm text-ink-soft">
                  {f.risk.reasons.map((r) => <li key={r} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-fire-500" />{r}</li>)}
                </ul>
                <div className="mt-3 grid grid-cols-4 gap-1 text-center text-[11px]">
                  {Object.entries(f.risk.parts).map(([k, v]) => (
                    <div key={k} className="rounded bg-ground px-1 py-1.5"><p className="num font-bold">{v}</p><p className="text-ink-mute">{k}</p></div>
                  ))}
                </div>
              </div>
            )}

            {f.assignments.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-bold">Work plan</p>
                <ul className="divide-y divide-line rounded-panel border border-line text-sm">
                  {f.assignments.map((a, i) => (
                    <li key={i} className="flex items-center justify-between px-3 py-2">
                      <span className="font-semibold">{fmtDay(a.date)}</span>
                      <span className="text-ink-soft">{a.acres} ac · {a.travelKm} km · {a.tractor === 'farmer' ? 'own tractor' : 'CHC tractor'}</span>
                    </li>
                  ))}
                </ul>
                {f.machine && <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-soft"><Tractor className="h-4 w-4" />{f.machine.typeLabel}, {f.chc?.name}</p>}
                {f.vendor && <p className="mt-1 text-sm text-ink-soft">Straw pickup: {f.vendor.name}, {fmtDay(f.pickups[0].date)}</p>}
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-bold">Farmer SMS</p>
              <p className="rounded-ctl bg-ground px-3 py-2.5 text-sm leading-relaxed">{f.message}</p>
            </div>

            {data.issues?.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-bold">Farmer reports</p>
                {data.issues.map((i) => <p key={i.id} className="text-sm text-ink-soft">{i.type.replace(/_/g, ' ')} ({i.status}){i.note ? `: ${i.note}` : ''}</p>)}
              </div>
            )}

            <div className="space-y-2 border-t border-line pt-4">
              {!['cleared', 'burned'].includes(f.status) && (
                <>
                  <Button variant="outline" icon={Shuffle} className="w-full" onClick={() => setShowReassign((s) => !s)}>Assign a different machine</Button>
                  {showReassign && (machines ? <div className="rounded-panel border border-line p-4"><ReassignForm fieldId={f.id} machines={machines.machines} chcs={machines.chcs} onDone={() => { setShowReassign(false); load(); onChanged?.(); }} /></div> : <Spinner />)}
                  {f.pinned && <Button variant="ghost" icon={PinOff} className="w-full" onClick={() => act(`/admin/pins/${f.id}`, null, 'Override removed, optimiser decides again')}>Remove officer override</Button>}
                  <div className="grid grid-cols-2 gap-2">
                    <Button icon={CheckCircle2} onClick={() => act(`/admin/fields/${f.id}/status`, { status: 'cleared' }, `${f.id} marked cleared`)}>Mark cleared</Button>
                    <Button variant="outline" icon={Flame} onClick={() => act(`/admin/fields/${f.id}/status`, { status: 'burned' }, `${f.id} marked burned`)}>Mark burned</Button>
                  </div>
                </>
              )}
              {['cleared', 'burned'].includes(f.status) && <Button variant="outline" className="w-full" onClick={() => act(`/admin/fields/${f.id}/status`, { status: 'pending' }, `${f.id} reopened`)}>Reopen field</Button>}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function Item({ label, value }) {
  return <div className="rounded-ctl bg-ground px-3 py-2"><dt className="text-xs text-ink-mute">{label}</dt><dd className="font-semibold">{value}</dd></div>;
}
