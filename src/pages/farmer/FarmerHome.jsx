import { Link } from 'react-router-dom';
import { CalendarPlus, Ticket, Calculator, Sprout, Wind, Gavel } from 'lucide-react';
import { useI18n } from '../../lib/i18n.jsx';

export default function FarmerHome() {
  const { t } = useI18n();
  return (
    <div>
      <section className="rounded-panel bg-sprout-900 px-5 pb-6 pt-7 text-white">
        <h1 className="text-[30px] font-extrabold leading-tight">{t('homeTitle')}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-sprout-100">{t('homeSub')}</p>
        <Link to="/farmer/register" className="mt-6 flex items-center justify-between rounded-ctl bg-stubble-500 px-5 py-4 text-ink shadow-sm hover:bg-stubble-300">
          <span>
            <span className="block text-lg font-bold">{t('register')}</span>
            <span className="block text-sm opacity-80">{t('registerSub')}</span>
          </span>
          <CalendarPlus className="h-7 w-7" />
        </Link>
      </section>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Tile to="/farmer/slot" icon={Ticket} title={t('mySlot')} sub={t('mySlotSub')} />
        <Tile to="/farmer/calculator" icon={Calculator} title={t('calc')} sub={t('calcSub')} />
      </div>

      <section className="panel mt-6 p-5">
        <h2 className="text-xl font-bold">{t('whyTitle')}</h2>
        <ul className="mt-4 space-y-4">
          {[[Sprout, t('why1')], [Wind, t('why2')], [Gavel, t('why3')]].map(([Icon, text]) => (
            <li key={text} className="flex gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-stubble-50"><Icon className="h-5 w-5 text-stubble-700" /></span>
              <p className="pt-1.5 text-[15px] leading-relaxed text-ink-soft">{text}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Tile({ to, icon: Icon, title, sub }) {
  return (
    <Link to={to} className="panel flex items-center gap-4 p-4 hover:border-sprout-300">
      <span className="grid h-12 w-12 place-items-center rounded-ctl bg-sprout-50"><Icon className="h-6 w-6 text-sprout-700" /></span>
      <span>
        <span className="block font-bold">{title}</span>
        <span className="block text-sm text-ink-mute">{sub}</span>
      </span>
    </Link>
  );
}
