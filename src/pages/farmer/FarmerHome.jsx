import { Link } from 'react-router-dom';
import { CalendarPlus, Ticket, Calculator, Sprout, Wind, Gavel, Phone, BadgeCheck, Smartphone, Languages, MapPin } from 'lucide-react';
import FieldScene from '../../components/FieldScene.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { useLoad } from '../../lib/useLoad.js';
import { api } from '../../lib/api.js';

export default function FarmerHome() {
  const { t } = useI18n();
  const meta = useLoad(() => api('/meta'));
  const blockName = Object.fromEntries((meta.data?.blocks || []).map((b) => [b.id, b.name]));

  return (
    <div>
      {/* Hero: full-bleed field scene */}
      <section className="relative overflow-hidden border-b border-line bg-[#FBF3DC]">
        <div className="mx-auto grid max-w-7xl items-center gap-6 px-4 pt-8 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:gap-10 lg:px-8 lg:pt-14">
          <div className="relative z-10 pb-4 lg:pb-16">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-sm font-semibold text-stubble-700 shadow-sm"><MapPin className="h-4 w-4" />{t('kicker')}</p>
            <h1 className="mt-4 text-[38px] font-extrabold leading-[1.05] text-sprout-900 sm:text-[52px] lg:text-[60px]">{t('homeTitle')}</h1>
            <p className="mt-4 max-w-[46ch] text-[17px] leading-relaxed text-ink-soft lg:text-lg">{t('homeSub')}</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link to="/farmer/register" className="inline-flex h-14 items-center justify-center gap-3 rounded-full bg-sprout-600 px-7 text-lg font-bold text-white shadow-lg shadow-sprout-600/25 transition hover:bg-sprout-700">
                <CalendarPlus className="h-5 w-5" />{t('bookCta')}
              </Link>
              <Link to="/farmer/slot" className="inline-flex h-14 items-center justify-center gap-3 rounded-full border border-ink/15 bg-white px-7 text-lg font-semibold text-ink transition hover:border-ink/40">
                <Ticket className="h-5 w-5" />{t('mySlot')}
              </Link>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-ink-soft">
              <li className="flex items-center gap-1.5"><BadgeCheck className="h-4 w-4 text-sprout-600" />{t('free')}</li>
              <li className="flex items-center gap-1.5"><Smartphone className="h-4 w-4 text-sprout-600" />{t('noLogin')}</li>
              <li className="flex items-center gap-1.5"><Languages className="h-4 w-4 text-sprout-600" />{t('inYourLang')}</li>
            </ul>
          </div>
          <div className="relative -mx-4 sm:-mx-6 lg:mx-0 lg:mb-12 lg:overflow-hidden lg:rounded-[28px] lg:shadow-pop">
            <FieldScene className="block h-[260px] w-full sm:h-[340px] lg:h-[440px]" />
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Steps: a real sequence, so numbered */}
        <section className="py-12 lg:py-16">
          <h2 className="text-[28px] font-extrabold sm:text-[34px]">{t('stepsTitle')}</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[['s1', 's1d'], ['s2', 's2d'], ['s3', 's3d'], ['s4', 's4d']].map(([a, b], i) => (
              <li key={a} className="relative">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-stubble-500 font-display text-lg font-extrabold text-ink">{i + 1}</span>
                  {i < 3 && <span className="hidden h-0.5 flex-1 bg-gradient-to-r from-stubble-300 to-transparent lg:block" />}
                </div>
                <h3 className="mt-4 text-lg font-bold">{t(a)}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">{t(b)}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Tools */}
        <section className="grid gap-4 md:grid-cols-3">
          <Tile to="/farmer/register" icon={CalendarPlus} title={t('register')} sub={t('registerSub')} tone="bg-sprout-900 text-white" iconTone="bg-white/10 text-stubble-300" />
          <Tile to="/farmer/slot" icon={Ticket} title={t('mySlot')} sub={t('mySlotSub')} />
          <Tile to="/farmer/calculator" icon={Calculator} title={t('calc')} sub={t('calcSub')} />
        </section>

        {/* Why + centres */}
        <section className="mt-12 grid items-start gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="rounded-[20px] bg-sprout-900 p-6 text-white sm:p-8">
            <h2 className="text-[26px] font-extrabold">{t('whyTitle')}</h2>
            <ul className="mt-6 space-y-5">
              {[[Sprout, t('why1')], [Wind, t('why2')], [Gavel, t('why3')]].map(([Icon, text]) => (
                <li key={text} className="flex gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10"><Icon className="h-5 w-5 text-stubble-300" /></span>
                  <p className="pt-2 text-[16px] leading-relaxed text-sprout-50">{text}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="panel p-6 sm:p-7">
            <h2 className="text-xl font-bold">{t('centresTitle')}</h2>
            <p className="mt-1 text-sm text-ink-mute">{t('centresSub')}</p>
            <ul className="mt-4 divide-y divide-line">
              {(meta.data?.chcs || []).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.name.replace(' Custom Hiring Centre', '')}</p>
                    <p className="text-xs text-ink-mute">{blockName[c.blockId]} block</p>
                  </div>
                  <a href={`tel:${c.phone}`} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sprout-50 px-3 py-1.5 text-sm font-semibold text-sprout-700 hover:bg-sprout-100"><Phone className="h-3.5 w-3.5" />{c.phone}</a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}

function Tile({ to, icon: Icon, title, sub, tone = 'bg-white text-ink border border-line', iconTone = 'bg-sprout-50 text-sprout-700' }) {
  return (
    <Link to={to} className={`group flex items-center gap-4 rounded-[18px] p-5 shadow-panel transition hover:-translate-y-0.5 hover:shadow-pop ${tone}`}>
      <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${iconTone}`}><Icon className="h-7 w-7" /></span>
      <span>
        <span className="block text-lg font-bold">{title}</span>
        <span className="block text-sm opacity-75">{sub}</span>
      </span>
    </Link>
  );
}
