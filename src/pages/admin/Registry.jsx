import { useState } from 'react';
import { Phone, Wrench } from 'lucide-react';
import PageHead from './PageHead.jsx';
import { Panel, Badge, Spinner, ErrorBox, Segmented, useToast } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useLoad } from '../../lib/useLoad.js';

export default function Registry() {
  const toast = useToast();
  const { data, error, loading, reload } = useLoad(() => api('/admin/registry', { auth: true }));
  const [tab, setTab] = useState('machines');
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const chcName = Object.fromEntries(data.chcs.map((c) => [c.id, c.name.replace(' Custom Hiring Centre', '')]));
  const block = Object.fromEntries(data.blocks.map((b) => [b.id, b.name]));

  const toggle = async (m) => {
    const status = m.status === 'maintenance' ? 'active' : 'maintenance';
    try { await api(`/admin/machines/${m.id}`, { method: 'POST', auth: true, body: { status } }); toast(`${m.label} at ${chcName[m.chcId]}: ${status === 'active' ? 'back in service' : 'under maintenance'}`); reload(); } catch (e) { toast(e.message, 'err'); }
  };

  return (
    <div>
      <PageHead title="Machines & centres" sub="Everything the scheduler can assign. Taking a machine off the road reschedules its jobs immediately.">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'machines', label: `Machines (${data.machines.length})` }, { value: 'chcs', label: `Hiring centres (${data.chcs.length})` }, { value: 'vendors', label: `Straw buyers (${data.vendors.length})` }]} />
      </PageHead>

      {tab === 'machines' && (
        <Panel pad={false}>
          <div className="overflow-x-auto">
            <table className="tbl w-full min-w-[760px]">
              <thead><tr><th>Machine</th><th>Hiring centre</th><th>Capacity</th><th>Tractor needed</th><th className="w-[220px]">Booked, next 14 working days</th><th>Status</th></tr></thead>
              <tbody>
                {data.machines.map((m) => (
                  <tr key={m.id}>
                    <td className="font-semibold">{m.label}</td>
                    <td className="text-ink-soft">{chcName[m.chcId]}</td>
                    <td className="num">{m.acresPerDay} ac/day</td>
                    <td className="num">{m.minHp} HP+</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-smoke-100"><div className={`h-2 rounded-full ${m.utilisationPct > 85 ? 'bg-fire-500' : 'bg-stubble-500'}`} style={{ width: `${Math.min(100, m.utilisationPct)}%` }} /></div>
                        <span className="num w-10 text-right text-xs font-semibold">{m.utilisationPct}%</span>
                      </div>
                    </td>
                    <td>
                      <button onClick={() => toggle(m)} className={`chip ${m.status === 'maintenance' ? 'bg-fire-50 text-fire-600' : 'bg-sprout-50 text-sprout-700'} hover:ring-2 hover:ring-line`}>
                        {m.status === 'maintenance' && <Wrench className="h-3 w-3" />}{m.status === 'maintenance' ? 'Maintenance' : 'Active'}
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
            <Panel key={c.id} title={c.name} sub={`${block[c.blockId]} block`}>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-ctl bg-ground px-3 py-2"><dt className="text-xs text-ink-mute">Machines</dt><dd className="num font-bold">{c.machineCount}</dd></div>
                <div className="rounded-ctl bg-ground px-3 py-2"><dt className="text-xs text-ink-mute">Tractors</dt><dd className="num font-bold">{c.tractors.length} <span className="text-xs font-normal text-ink-mute">({c.tractors.map((t) => t.hp).join(', ')} HP)</span></dd></div>
              </dl>
              <p className="mt-3 text-sm">Operator: <span className="font-semibold">{c.operator}</span></p>
              <a href={`tel:${c.phone}`} className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-sprout-700"><Phone className="h-3.5 w-3.5" />{c.phone}</a>
            </Panel>
          ))}
        </div>
      )}

      {tab === 'vendors' && (
        <Panel pad={false}>
          <table className="tbl w-full">
            <thead><tr><th>Straw buyer / aggregator</th><th>Takes straw to</th><th>Pickup capacity</th><th>Contact</th></tr></thead>
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
