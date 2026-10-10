import { useState } from 'react';
import { Phone, Copy, Check, MessageCircle, Tractor, Truck, AlertTriangle, CheckCircle2, Clock, Flag } from 'lucide-react';
import SeasonStrip from '../../components/SeasonStrip.jsx';
import { Button, Modal, useToast } from '../../components/ui.jsx';
import { useI18n, Dual } from '../../lib/i18n.jsx';
import { api } from '../../lib/api.js';
import { fmtDay, todayIST } from '../../lib/format.js';

export default function SlotCard({ slot }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [reporting, setReporting] = useState(false);
  const today = todayIST();
  const atRisk = slot.status === 'at_risk';
  const cleared = slot.status === 'cleared';

  const head = cleared
    ? { icon: CheckCircle2, k: 'clearedTitle', cls: 'bg-smoke-100 text-ink', sub: null }
    : atRisk
      ? { icon: AlertTriangle, k: 'atRiskTitle', cls: 'bg-fire-50 text-fire-600', sub: t('atRiskSub') }
      : { icon: CheckCircle2, k: 'bookedTitle', cls: 'bg-sprout-50 text-sprout-700', sub: null };

  const copy = async () => {
    try { await navigator.clipboard.writeText(slot.message); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };

  return (
    <article className="panel overflow-hidden">
      <div className={`flex items-start gap-3 px-5 py-4 ${head.cls}`}>
        <head.icon className="mt-0.5 h-6 w-6 shrink-0" />
        <div>
          <Dual k={head.k} as="h2" className="text-xl font-bold" subClassName="text-[0.72em] font-semibold opacity-75" />
          {head.sub && <p className="mt-1 text-sm leading-relaxed">{head.sub}</p>}
        </div>
        <span className="ml-auto shrink-0 rounded-full bg-white/70 px-2.5 py-1 text-xs font-bold text-ink">{slot.id}</span>
      </div>

      <div className="px-5">
        {!cleared && (
          <SeasonStrip harvestDate={slot.harvestDate} deadline={slot.deadline} today={today} start={slot.start} completion={slot.completion} locale={locale}
            labels={{ harvest: t('harvested'), today: t('today'), slot: t('slot'), deadline: t('deadline') }} />
        )}

        <dl className="grid grid-cols-2 gap-3 pb-4 pt-1">
          {!cleared && slot.start && <Fact icon={Tractor} k="machineComes" value={fmtDay(slot.start, locale)} strong />}
          {!cleared && slot.completion && slot.completion !== slot.start && <Fact icon={CheckCircle2} k="finishes" value={fmtDay(slot.completion, locale)} />}
          <Fact icon={Clock} k="deadline" value={fmtDay(slot.deadline, locale)} sub={!cleared && slot.daysLeft >= 0 ? `${slot.daysLeft} ${t('daysLeft')}` : null} />
          {slot.pickups?.[0] && <Fact icon={Truck} k="pickup" value={fmtDay(slot.pickups[0].date, locale)} sub={slot.vendor?.name} />}
        </dl>

        {slot.machine && slot.chc && !cleared && (
          <div className="flex items-center justify-between gap-3 border-t border-line py-4">
            <div>
              <p className="text-xs text-ink-mute">{t('machine')}</p>
              <p className="font-bold">{slot.machine.typeLabel}</p>
              <p className="text-sm text-ink-soft">{t('from')}: {slot.chc.name}</p>
            </div>
            <a href={`tel:${slot.chc.phone}`} className="inline-flex h-11 items-center gap-2 rounded-ctl bg-ink px-4 text-sm font-semibold text-white"><Phone className="h-4 w-4" />{t('call')}</a>
          </div>
        )}

        <div className="border-t border-line py-4">
          <p className="mb-2 text-xs font-semibold text-ink-mute">{t('message')}</p>
          <p className="rounded-ctl bg-ground px-4 py-3 text-[15px] leading-relaxed">{slot.message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(slot.message)}`} target="_blank" rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-ctl bg-[#1F8A4C] px-4 text-sm font-semibold text-white"><MessageCircle className="h-4 w-4" />{t('shareWA')}</a>
            <Button variant="outline" icon={copied ? Check : Copy} onClick={copy}>{copied ? t('copied') : t('copy')}</Button>
            {!cleared && <Button variant="ghost" icon={Flag} onClick={() => setReporting(true)}>{t('report')}</Button>}
          </div>
        </div>
      </div>

      <ReportModal open={reporting} onClose={() => setReporting(false)} slot={slot} onSent={() => { setReporting(false); toast(t('sent')); }} />
    </article>
  );
}

function Fact({ icon: Icon, k, value, sub, strong }) {
  return (
    <div className={`rounded-ctl px-3 py-2.5 ${strong ? 'bg-stubble-50' : 'bg-ground'}`}>
      <dt className="flex items-start gap-1.5 text-xs text-ink-mute"><Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" /><Dual k={k} subClassName="text-[11px] opacity-80" /></dt>
      <dd className="mt-0.5 font-bold">{value}</dd>
      {sub && <dd className="text-xs text-ink-soft">{sub}</dd>}
    </div>
  );
}

function ReportModal({ open, onClose, slot, onSent }) {
  const { t } = useI18n();
  const [type, setType] = useState('machine_late');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const send = async () => {
    setBusy(true); setErr(null);
    try { await api('/farmer/issues', { method: 'POST', body: { fieldId: slot.id, phone: slot.phone, type, note } }); onSent(); setNote(''); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={t('reportTitle')}>
      <div className="space-y-2">
        {['machine_late', 'harvest_changed', 'machine_not_needed', 'other'].map((k) => (
          <label key={k} className={`flex cursor-pointer items-center gap-3 rounded-ctl border px-4 py-3 ${type === k ? 'border-sprout-500 bg-sprout-50' : 'border-line'}`}>
            <input type="radio" name="issue" checked={type === k} onChange={() => setType(k)} className="accent-sprout-600" />
            <span className="font-medium">{t(`issue_${k}`)}</span>
          </label>
        ))}
        <textarea className="input mt-2" rows={3} placeholder={t('notePh')} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        {err && <p className="text-sm text-fire-600">{err}</p>}
        <Button className="mt-2 w-full" size="lg" loading={busy} onClick={send}>{t('send')}</Button>
      </div>
    </Modal>
  );
}
