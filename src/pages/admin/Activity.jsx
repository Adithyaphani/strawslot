import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import PageHead from './PageHead.jsx';
import { Panel, Button, Spinner, ErrorBox, Modal, useToast } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useLoad } from '../../lib/useLoad.js';
import { relTime } from '../../lib/format.js';

const LABEL = { register: 'Farmer booked a field', issue: 'Farmer reported a problem', reassign: 'Machine reassigned', unpin: 'Override removed', status: 'Field status changed', machine: 'Machine status changed', resolve: 'Report resolved', reset: 'Demo data reset', seed: 'Season generated', reseed: 'Season refreshed' };

export default function Activity() {
  const toast = useToast();
  const { data, error, loading, reload } = useLoad(() => api('/admin/log', { auth: true }));
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const reset = async () => {
    setBusy(true);
    try { await api('/admin/reset', { method: 'POST', auth: true }); toast('Demo data reset to a fresh season'); setConfirm(false); reload(); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHead title="Activity log" sub="Every booking, override and status change, newest first.">
        <Button variant="outline" icon={RotateCcw} onClick={() => setConfirm(true)}>Reset demo data</Button>
      </PageHead>
      <Panel pad={false}>
        <ul className="divide-y divide-line">
          {data.log.map((e, i) => (
            <li key={i} className="flex items-start justify-between gap-4 px-5 py-3">
              <div>
                <p className="text-sm font-semibold">{LABEL[e.action] || e.action}</p>
                <p className="text-sm text-ink-soft">{e.detail}</p>
              </div>
              <div className="shrink-0 text-right text-xs text-ink-mute"><p>{relTime(e.at)}</p><p>{e.actor}</p></div>
            </li>
          ))}
        </ul>
      </Panel>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Reset demo data?">
        <p className="text-sm text-ink-soft">This regenerates the simulated Sangrur season around today and removes farmer bookings, reports and overrides made during the demo. It cannot be undone.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(false)}>Keep data</Button>
          <Button variant="danger" loading={busy} onClick={reset}>Reset demo data</Button>
        </div>
      </Modal>
    </div>
  );
}
