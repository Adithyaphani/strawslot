import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import PageHead from './PageHead.jsx';
import { Panel, Button, Spinner, ErrorBox, Modal, useToast } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useLoad } from '../../lib/useLoad.js';
import { useAT } from '../../lib/adminI18n.jsx';


export default function Activity() {
  const toast = useToast();
  const { t, relTime } = useAT();
  const { data, error, loading, reload } = useLoad(() => api('/admin/log', { auth: true }));
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const reset = async () => {
    setBusy(true);
    try { await api('/admin/reset', { method: 'POST', auth: true }); toast(t('reset_done')); setConfirm(false); reload(); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHead title={t('ac_title')} sub={t('ac_sub')}>
        <Button variant="outline" icon={RotateCcw} onClick={() => setConfirm(true)}>{t('reset_btn')}</Button>
      </PageHead>
      <Panel pad={false}>
        <ul className="divide-y divide-line">
          {data.log.map((e, i) => (
            <li key={i} className="flex items-start justify-between gap-4 px-5 py-3">
              <div>
                <p className="text-sm font-semibold">{t(`act_${e.action}`)}</p>
                <p className="text-sm text-ink-soft">{e.detail}</p>
              </div>
              <div className="shrink-0 text-right text-xs text-ink-mute"><p>{relTime(e.at)}</p><p>{e.actor}</p></div>
            </li>
          ))}
        </ul>
      </Panel>
      <Modal open={confirm} onClose={() => setConfirm(false)} title={t('reset_q')}>
        <p className="text-sm text-ink-soft">{t('reset_body')}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(false)}>{t('keep')}</Button>
          <Button variant="danger" loading={busy} onClick={reset}>{t('reset_btn')}</Button>
        </div>
      </Modal>
    </div>
  );
}
