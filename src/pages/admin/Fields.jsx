import { useMemo, useState } from 'react';
import { Search, Pin, ArrowDownUp } from 'lucide-react';
import PageHead from './PageHead.jsx';
import FieldDrawer from './FieldDrawer.jsx';
import { Panel, Badge, Spinner, ErrorBox, Empty, Button } from '../../components/ui.jsx';
import SeasonStrip from '../../components/SeasonStrip.jsx';
import { api } from '../../lib/api.js';
import { useLoad } from '../../lib/useLoad.js';
import { fmtDate, RISK, STATUS, PREF, todayIST } from '../../lib/format.js';

const PAGE = 40;

export default function Fields() {
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

  if (loading && !data) return <Spinner label="Loading fields" />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.ceil(rows.length / PAGE);

  return (
    <div>
      <PageHead title="Fields" sub={`${rows.length} of ${data.fields.length} fields. Phone numbers are masked here; open a field to see contact details.`} />
      <div className="mb-4 flex flex-col gap-2 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
          <input className="input pl-9" placeholder="Search by field id, farmer or village" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} aria-label="Search fields" />
        </div>
        <select className="input lg:w-48" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} aria-label="Status">
          <option value="">All statuses</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="input lg:w-44" value={block} onChange={(e) => { setBlock(e.target.value); setPage(0); }} aria-label="Block">
          <option value="">All blocks</option>
          {meta.data?.blocks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <label className="flex items-center gap-2 rounded-ctl border border-line bg-white px-3 text-sm lg:w-52">
          <ArrowDownUp className="h-4 w-4 text-ink-mute" />
          <select className="w-full bg-transparent py-3 focus:outline-none" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
            <option value="risk">Highest risk first</option>
            <option value="deadline">Earliest deadline</option>
            <option value="acres">Largest first</option>
            <option value="newest">Newest bookings</option>
          </select>
        </label>
      </div>

      <Panel pad={false}>
        {shown.length === 0 ? <Empty icon={Search} title="No fields match">Try clearing the search or filters.</Empty> : (
          <div className="overflow-x-auto">
            <table className="tbl w-full min-w-[920px]">
              <thead><tr><th>Field</th><th>Farmer</th><th>Acres</th><th>Straw plan</th><th className="w-[260px]">Window and slot</th><th>Deadline</th><th>Status</th><th>Risk</th></tr></thead>
              <tbody>
                {shown.map((f) => (
                  <tr key={f.id} className="cursor-pointer" onClick={() => setDrawer(f.id)}>
                    <td className="font-semibold">{f.id}{f.pinned && <Pin className="ml-1 inline h-3 w-3 text-sky-600" />}</td>
                    <td><p className="font-medium">{f.farmerName}</p><p className="text-xs text-ink-mute">{f.village}</p></td>
                    <td className="num">{f.acres}</td>
                    <td className="text-ink-soft">{PREF[f.preference]}</td>
                    <td>{['cleared', 'burned'].includes(f.status) ? <span className="text-xs text-ink-mute">{f.clearedOn ? `Cleared ${fmtDate(f.clearedOn)}` : '—'}</span> : <SeasonStrip compact animate={false} harvestDate={f.harvestDate} deadline={f.deadline} today={todayIST()} start={f.start} completion={f.completion} />}</td>
                    <td className="num whitespace-nowrap">{fmtDate(f.deadline)}</td>
                    <td><Badge className={STATUS[f.status]?.cls}>{STATUS[f.status]?.label}</Badge></td>
                    <td>{['cleared', 'burned'].includes(f.status) ? '—' : <Badge className={RISK[f.risk.level].cls} dot={RISK[f.risk.level].color}>{f.risk.score}</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
            <span className="text-ink-mute">Page {page + 1} of {pages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Panel>
      <FieldDrawer fieldId={drawer} onClose={() => setDrawer(null)} onChanged={reload} />
    </div>
  );
}
