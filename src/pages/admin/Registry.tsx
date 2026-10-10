import { useState } from 'react';
import { Phone, Wrench } from 'lucide-react';
import PageHead from './PageHead';
import { Panel, Badge, Spinner, ErrorBox, Segmented, useToast } from '../../components/ui';
import { api } from '../../lib/api';
import { useLoad } from '../../lib/useLoad';
import { useAT } from '../../lib/adminI18n';

export default function Registry() {
  const toast = useToast();
  const { t } = useAT();
  const { data, error, loading, reload } = useLoad(() => api('/admin/registry', { auth: true }));
  const [tab, setTab] = useState('machines');
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const chcName = Object.fromEntries(data.chcs.map((c) => [c.id, c.name.replace(' Custom Hiring Centre', '')]));
  const block = Object.fromEntries(data.blocks.map((b) => [b.id, b.name]));

  const toggle = async (m) => {
    const status = m.status === 'maintenance' ? 'active' : 'maintenance';
    try { await api(`/admin/machines/${m.id}`, { method: 'POST', auth: true, body: { status } }); toast(t('toast_machine', { m: m.label, c: chcName[m.chcId], s: status === 'active' ? t('back_service') : t('under_maint') })); reload(); } catch (e) { toast(e.message, 'err'); }
  };

  return (
    <div>
      <PageHead title={t('rg_title')} sub={t('rg_sub')}>
        <Segmented value={tab} onChange={setTab} options={[{ value: 'machines', label: t('tab_machines', { n: data.machines.length }) }, { value: 'chcs', label: t('tab_centres', { n: data.chcs.length }) }, { value: 'vendors', label: t('tab_buyers', { n: data.vendors.length }) }]} />
      </PageHead>

      {tab === 'machines' && (
        <Panel pad={false}>
          <div className="overflow-x-auto">
            <table className="tbl w-full min-w-[760px]">
              <thead><tr><th>{t('col_machine')}</th><th>{t('col_centre')}</th><th>{t('col_capacity')}</th><th>{t('col_tractor_needed')}</th><th className="w-[220px]">{t('col_booked')}</th><th>{t('col_status')}</th></tr></thead>
              <tbody>
                {data.machines.map((m) => (
                  <tr key={m.id}>
                    <td className="font-semibold">{t(`mt_${m.type}`)} #{m.label.split('#')[1]}</td>
                    <td className="text-ink-soft">{chcName[m.chcId]}</td>
                    <td className="num">{m.acresPerDay} {t('acres_u')}/d</td>
                    <td className="num">{m.minHp} HP+</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-smoke-100"><div className={`h-2 rounded-full ${m.utilisationPct > 85 ? 'bg-fire-500' : 'bg-stubble-500'}`} style={{ width: `${Math.min(100, m.utilisationPct)}%` }} /></div>
                        <span className="num w-10 text-right text-xs font-semibold">{m.utilisationPct}%</span>
                      </div>
                    </td>
                    <td>
                      <button onClick={() => toggle(m)} className={`chip ${m.status === 'maintenance' ? 'bg-fire-50 text-fire-600' : 'bg-sprout-50 text-sprout-700'} hover:ring-2 hover:ring-line`}>
                        {m.status === 'maintenance' && <Wrench className="h-3 w-3" />}{m.status === 'maintenance' ? t('maintenance') : t('active')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {tab === 'chcs' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.chcs.map((c) => (
            <Panel key={c.id} title={c.name} sub={t('block_suffix', { b: block[c.blockId] })}>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-ctl bg-ground px-3 py-2"><dt className="text-xs text-ink-mute">{t('machines')}</dt><dd className="num font-bold">{c.machineCount}</dd></div>
                <div className="rounded-ctl bg-ground px-3 py-2"><dt className="text-xs text-ink-mute">{t('tractors_l')}</dt><dd className="num font-bold">{c.tractors.length} <span className="text-xs font-normal text-ink-mute">({c.tractors.map((t) => t.hp).join(', ')} HP)</span></dd></div>
              </dl>
              <p className="mt-3 text-sm">{t('operator')}: <span className="font-semibold">{c.operator}</span></p>
              <a href={`tel:${c.phone}`} className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-sprout-700"><Phone className="h-3.5 w-3.5" />{c.phone}</a>
            </Panel>
          ))}
        </div>
      )}

      {tab === 'vendors' && (
        <Panel pad={false}>
          <table className="tbl w-full">
            <thead><tr><th>{t('col_buyer')}</th><th>{t('col_to')}</th><th>{t('col_pickcap')}</th><th>{t('col_contact')}</th></tr></thead>
            <tbody>
              {data.vendors.map((v) => (
                <tr key={v.id}><td className="font-semibold">{v.name}</td><td className="text-ink-soft">{v.destination}</td><td className="num">{v.capacityTonnesPerDay} t/day</td><td><Badge className="bg-smoke-100 text-ink-soft">{v.phone}</Badge></td></tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
