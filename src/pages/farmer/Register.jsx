import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Check, Loader2, Sprout, Package, Shuffle } from 'lucide-react';
import { Button, ErrorBox } from '../../components/ui.jsx';
import SlotCard from './SlotCard.jsx';
import { useI18n, LANGS } from '../../lib/i18n.jsx';
import { api } from '../../lib/api.js';
import { todayIST } from '../../lib/format.js';

const init = (lang) => ({
  farmerName: '', phone: '', language: lang, villageId: '', acres: '', harvestDate: todayIST(), windowDays: 16,
  preference: 'any', tractor: { owns: false, hp: 50 }, location: null,
});

export default function Register() {
  const { t, lang } = useI18n();
  const [meta, setMeta] = useState(null);
  const [step, setStep] = useState(0);
  const [f, setF] = useState(() => init(lang));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [slot, setSlot] = useState(null);
  const [geo, setGeo] = useState('idle');

  useEffect(() => { api('/meta').then(setMeta).catch(setError); }, []);
  useEffect(() => { setF((x) => ({ ...x, language: lang })); }, [lang]);

  const villagesByBlock = useMemo(() => {
    if (!meta) return [];
    return meta.blocks.map((b) => ({ ...b, villages: meta.villages.filter((v) => v.blockId === b.id) }));
  }, [meta]);

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const steps = [t('stepYou'), t('stepField'), t('stepTractor')];

  const validate = (s) => {
    const e = {};
    if (s === 0) {
      if (f.farmerName.trim().length < 2) e.farmerName = true;
      if (!/^[6-9]\d{9}$/.test(f.phone)) e.phone = true;
      if (!f.villageId) e.villageId = true;
    }
    if (s === 1) {
      const a = Number(f.acres);
      if (!(a >= 0.25 && a <= 100)) e.acres = true;
      if (!f.harvestDate) e.harvestDate = true;
    }
    if (s === 2 && f.tractor.owns && !(f.tractor.hp > 0)) e.hp = true;
    setErrors(e);
    return !Object.keys(e).length;
  };

  const next = () => validate(step) && setStep(step + 1);
  const submit = async () => {
    if (!validate(2)) return;
    setBusy(true); setError(null);
    try {
      const body = { ...f, acres: Number(f.acres), windowDays: Number(f.windowDays), tractor: { owns: f.tractor.owns, hp: f.tractor.owns ? Number(f.tractor.hp) : 0 } };
      if (!body.location) delete body.location;
      const r = await api('/farmer/fields', { method: 'POST', body });
      setSlot(r.slot);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { setError(e); } finally { setBusy(false); }
  };

  const locate = () => {
    if (!navigator.geolocation) return setGeo('error');
    setGeo('busy');
    navigator.geolocation.getCurrentPosition(
      (p) => { set('location', { lat: p.coords.latitude, lon: p.coords.longitude }); setGeo('done'); },
      () => setGeo('error'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  if (slot) {
    return (
      <div className="space-y-4">
        <SlotCard slot={slot} />
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => { setSlot(null); setStep(0); setF(init(lang)); }}>{t('bookAnother')}</Button>
          <Link to="/farmer" className="inline-flex h-10 flex-1 items-center justify-center rounded-ctl bg-ink text-sm font-semibold text-white">{t('home')}</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[28px] font-extrabold">{t('register')}</h1>
      <ol className="mt-4 flex gap-2" aria-label="Progress">
        {steps.map((s, i) => (
          <li key={s} className="flex-1">
            <div className={`h-1.5 rounded-full ${i <= step ? 'bg-sprout-500' : 'bg-smoke-200'}`} />
            <p className={`mt-1.5 text-xs font-semibold ${i === step ? 'text-ink' : 'text-ink-mute'}`}>{i + 1}. {s}</p>
          </li>
        ))}
      </ol>

      <div className="panel mt-5 space-y-5 p-5">
        {step === 0 && (<>
          <Field label={t('name')} error={errors.farmerName}>
            <input className="input" value={f.farmerName} onChange={(e) => set('farmerName', e.target.value)} placeholder={t('namePh')} autoComplete="name" />
          </Field>
          <Field label={t('mobile')} error={errors.phone}>
            <input className="input num" inputMode="numeric" maxLength={10} value={f.phone} onChange={(e) => set('phone', e.target.value.replace(/\D/g, ''))} placeholder={t('mobilePh')} autoComplete="tel" />
          </Field>
          <Field label={t('village')} error={errors.villageId}>
            <select className="input" value={f.villageId} onChange={(e) => set('villageId', e.target.value)}>
              <option value="">{meta ? t('villagePh') : '…'}</option>
              {villagesByBlock.map((b) => (
                <optgroup key={b.id} label={`${b.name} block`}>
                  {b.villages.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </optgroup>
              ))}
            </select>
            <button type="button" onClick={locate} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-sprout-700">
              {geo === 'busy' ? <Loader2 className="h-4 w-4 animate-spin" /> : geo === 'done' ? <Check className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
              {geo === 'busy' ? t('locating') : geo === 'done' ? t('located') : t('useLocation')}
            </button>
          </Field>
          <Field label={t('language')}>
            <div className="flex gap-2">
              {LANGS.map((l) => (
                <button key={l.code} type="button" onClick={() => set('language', l.code)}
                  className={`flex-1 rounded-ctl border px-3 py-2.5 text-sm font-semibold ${f.language === l.code ? 'border-sprout-500 bg-sprout-50 text-sprout-700' : 'border-line bg-white'}`}>{l.name}</button>
              ))}
            </div>
          </Field>
        </>)}

        {step === 1 && (<>
          <Field label={t('acres')} error={errors.acres}>
            <input className="input num" type="number" inputMode="decimal" min="0.25" step="0.25" value={f.acres} onChange={(e) => set('acres', e.target.value)} placeholder="4" />
            <div className="mt-2 flex gap-2">{[1, 2.5, 5, 10].map((a) => <Chip key={a} on={Number(f.acres) === a} onClick={() => set('acres', a)}>{a}</Chip>)}</div>
          </Field>
          <Field label={t('harvest')} error={errors.harvestDate}>
            <input className="input" type="date" value={f.harvestDate} onChange={(e) => set('harvestDate', e.target.value)} />
          </Field>
          <Field label={t('window')} hint={t('windowHint')}>
            <div className="flex items-center gap-3">
              <input type="range" min="10" max="25" value={f.windowDays} onChange={(e) => set('windowDays', e.target.value)} className="flex-1 accent-sprout-600" />
              <span className="num w-10 text-right text-lg font-bold">{f.windowDays}</span>
            </div>
          </Field>
          <Field label={t('pref')}>
            <div className="grid gap-2">
              {[['in_situ', Sprout, t('prefIn'), t('prefInSub')], ['ex_situ', Package, t('prefEx'), t('prefExSub')], ['any', Shuffle, t('prefAny'), t('prefAnySub')]].map(([v, Icon, a, b]) => (
                <button key={v} type="button" onClick={() => set('preference', v)}
                  className={`flex items-center gap-3 rounded-ctl border px-4 py-3 text-left ${f.preference === v ? 'border-sprout-500 bg-sprout-50' : 'border-line bg-white'}`}>
                  <Icon className={`h-5 w-5 ${f.preference === v ? 'text-sprout-700' : 'text-ink-mute'}`} />
                  <span><span className="block font-semibold">{a}</span><span className="block text-xs text-ink-mute">{b}</span></span>
                </button>
              ))}
            </div>
          </Field>
        </>)}

        {step === 2 && (<>
          <Field label={t('ownTractor')}>
            <div className="flex gap-2">
              {[[true, t('yes')], [false, t('no')]].map(([v, l]) => (
                <button key={String(v)} type="button" onClick={() => set('tractor', { ...f.tractor, owns: v })}
                  className={`h-12 flex-1 rounded-ctl border text-base font-semibold ${f.tractor.owns === v ? 'border-sprout-500 bg-sprout-50 text-sprout-700' : 'border-line bg-white'}`}>{l}</button>
              ))}
            </div>
          </Field>
          {f.tractor.owns && (
            <Field label={t('hp')} hint={t('hpHint')} error={errors.hp}>
              <div className="flex flex-wrap gap-2">{[35, 40, 45, 50, 55, 60, 75].map((hp) => <Chip key={hp} on={Number(f.tractor.hp) === hp} onClick={() => set('tractor', { ...f.tractor, hp })}>{hp} HP</Chip>)}</div>
            </Field>
          )}
        </>)}

        <ErrorBox error={error} />

        <div className="flex gap-2 pt-1">
          {step > 0 && <Button variant="outline" size="lg" onClick={() => setStep(step - 1)}>{t('back')}</Button>}
          {step < 2
            ? <Button size="lg" className="flex-1" onClick={next}>{t('next')}</Button>
            : <Button size="lg" className="flex-1" loading={busy} onClick={submit}>{busy ? t('submitting') : t('submit')}</Button>}
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, error, children }) {
  return (
    <div>
      <label className={`label ${error ? 'text-fire-600' : ''}`}>{label}</label>
      <div className={error ? '[&_.input]:border-fire-500' : ''}>{children}</div>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

function Chip({ on, children, ...p }) {
  return <button type="button" {...p} className={`num rounded-full border px-3.5 py-1.5 text-sm font-semibold ${on ? 'border-sprout-500 bg-sprout-600 text-white' : 'border-line bg-white'}`}>{children}</button>;
}
