import { useMemo, useState } from 'react';
import { Search, Pin, ArrowDownUp } from 'lucide-react';
import PageHead from './PageHead.jsx';
import FieldDrawer from './FieldDrawer.jsx';
import { Panel, Badge, Spinner, ErrorBox, Empty, Button } from '../../components/ui.jsx';
import SeasonStrip from '../../components/SeasonStrip.jsx';
import { api } from '../../lib/api.js';
import { useLoad } from '../../lib/useLoad.js';
import { fmtDate, RISK, STATUS, todayIST } from '../../lib/format.js';
import { useAT } from '../../lib/adminI18n.jsx';

const PAGE = 40;

export default function Fields() {
  const { t, locale } = useAT();
  const { data, error, loading, reload } = useLoad(() => api('/admin/fields', { auth: true }));
  const meta = useLoad(() => api('/meta'));
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [block, setBlock] = useState('');
  const [sort, setSort] = useState('risk');
  const [page, setPage] = useState(0);
  const [drawer, setDrawer] = useState(null);

  const rows = useMemo(() => {
    if (!data) return [];
    const ql = q.toLowerCase();
    let list = data.fields.filter((f) =>
      (!ql || [f.id, f.farmerName, f.village].some((s) => s?.toLowerCase().includes(ql))) &&
      (!status || f.status === status) && (!block || f.blockId === block));
    const by = {
      risk: (a, b) => b.risk.score - a.risk.score,
      deadline: (a, b) => a.deadline.localeCompare(b.deadline),
      acres: (a, b) => b.acres - a.acres,
      newest: (a, b) => b.id.localeCompare(a.id),
    }[sort];
    return list.sort(by);
  }, [data, q, status, block, sort]);

  if (loading && !data) return <Spinner label={t('loading')} />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.ceil(rows.length / PAGE);

  return (
    <div>
      <PageHead title={t('fl_title')} sub={t('fl_sub', { a: rows.length, b: data.fields.length })} />
      <div className="mb-4 flex flex-col gap-2 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
          <input className="input pl-9" placeholder={t('search')} value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} aria-label={t('search')} />
        </div>
        <select className="input lg:w-48" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} aria-label={t('col_status')}>
          <option value="">{t('all_status')}</option>
          {Object.keys(STATUS).map((k) => <option key={k} value={k}>{t(`st_${k}`)}</option>)}
        </select>
        <select className="input lg:w-44" value={block} onChange={(e) => { setBlock(e.target.value); setPage(0); }} aria-label={t('blocks_title')}>
          <option value="">{t('all_blocks')}</option>
          {meta.data?.blocks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <label className="flex items-center gap-2 rounded-ctl border border-line bg-white px-3 text-sm lg:w-52">
          <ArrowDownUp className="h-4 w-4 text-ink-mute" />
          <select className="w-full bg-transparent py-3 focus:outline-none" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="sort">
            <option value="risk">{t('sort_risk')}</option>
            <option value="deadline">{t('sort_deadline')}</option>
            <option value="acres">{t('sort_acres')}</option>
            <option value="newest">{t('sort_new')}</option>
          </select>
        </label>
      </div>

      <Panel pad={false}>
        {shown.length === 0 ? <Empty icon={Search} title={t('no_match')}>{t('no_match_body')}</Empty> : (
          <div className="overflow-x-auto">
            <table className="tbl w-full min-w-[920px]">
              <thead><tr><th>{t('col_field')}</th><th>{t('col_farmer')}</th><th>{t('col_acres')}</th><th>{t('col_plan')}</th><th className="w-[260px]">{t('col_window')}</th><th>{t('col_deadline')}</th><th>{t('col_status')}</th><th>{t('col_risk')}</th></tr></thead>
              <tbody>
                {shown.map((f) => (
                  <tr key={f.id} className="cursor-pointer" onClick={() => setDrawer(f.id)}>
                    <td className="font-semibold">{f.id}{f.pinned && <Pin className="ml-1 inline h-3 w-3 text-sky-600" />}</td>
                    <td><p className="font-medium">{f.farmerName}</p><p className="text-xs text-ink-mute">{f.village}</p></td>
                    <td className="num">{f.acres}</td>
                    <td className="text-ink-soft">{t(`pref_${f.preference}`)}</td>
                    <td>{['cleared', 'burned'].includes(f.status) ? <span className="text-xs text-ink-mute">{f.clearedOn ? t('cleared_on', { d: fmtDate(f.clearedOn, undefined, locale) }) : '—'}</span> : <SeasonStrip compact animate={false} harvestDate={f.harvestDate} deadline={f.deadline} today={todayIST()} start={f.start} completion={f.completion} />}</td>
                    <td className="num whitespace-nowrap">{fmtDate(f.deadline, undefined, locale)}</td>
                    <td><Badge className={STATUS[f.status]?.cls}>{t(`st_${f.status}`)}</Badge></td>
                    <td>{['cleared', 'burned'].includes(f.status) ? '—' : <Badge className={RISK[f.risk.level].cls} dot={RISK[f.risk.level].color}>{f.risk.score}</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
            <span className="text-ink-mute">{t('page', { a: page + 1, b: pages })}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>{t('prev')}</Button>
              <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>{t('next')}</Button>
            </div>
          </div>
        )}
      </Panel>
      <FieldDrawer fieldId={drawer} onClose={() => setDrawer(null)} onChanged={reload} />
    </div>
  );
}
