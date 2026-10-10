import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Button, ErrorBox, Spinner } from '../../components/ui.jsx';
import SlotCard from './SlotCard.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { api } from '../../lib/api.js';

export default function MySlot() {
  const { t, lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const [phone, setPhone] = useState(params.get('phone') || '');
  const [demo, setDemo] = useState(null);
  const [slots, setSlots] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { api('/meta').then((m) => setDemo(m.demo?.farmerPhone)).catch(() => {}); }, []);

  const find = async (p = phone) => {
    if (!/^[6-9]\d{9}$/.test(p)) { setError({ message: t('mobilePh') }); return; }
    setBusy(true); setError(null);
    try {
      const r = await api(`/farmer/lookup?phone=${p}&lang=${lang}`);
      setSlots(r.slots); setParams({ phone: p }, { replace: true });
    } catch (e) {
      setSlots(null);
      setError(e.status === 404 ? { message: t('notFound') } : e);
    } finally { setBusy(false); }
  };

  // Re-fetch in the new language when the farmer switches language.
  useEffect(() => { if (slots && phone) find(phone); }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (params.get('phone')) find(params.get('phone')); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <h1 className="text-[28px] font-extrabold">{t('lookupTitle')}</h1>
      <p className="mt-1 text-ink-soft">{t('lookupSub')}</p>
      <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); find(); }}>
        <input className="input num flex-1 text-lg" inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} placeholder={t('mobilePh')} aria-label={t('mobile')} />
        <Button type="submit" size="lg" icon={Search} loading={busy}>{t('find')}</Button>
      </form>
      {demo && !slots && (
        <button className="mt-2 text-sm font-semibold text-sprout-700 underline" onClick={() => { setPhone(demo); find(demo); }}>
          {t('tryDemo')}: {demo}
        </button>
      )}
      <div className="mt-4"><ErrorBox error={error} /></div>
      {error?.message === t('notFound') && <Link to="/farmer/register" className="mt-3 inline-block font-semibold text-sprout-700 underline">{t('register')}</Link>}
      {busy && !slots && <Spinner />}
      <div className="mt-5 space-y-4">{slots?.map((s) => <SlotCard key={s.id} slot={s} />)}</div>
    </div>
  );
}
