import { NavLink, Outlet, Link } from 'react-router-dom';
import { Home, CalendarPlus, Ticket, Calculator } from 'lucide-react';
import { Logo } from '../../components/ui.jsx';
import { useI18n, LANGS } from '../../lib/i18n.jsx';

export default function FarmerLayout() {
  const { lang, setLang, t } = useI18n();
  const nav = [
    ['/farmer', Home, t('home'), true],
    ['/farmer/register', CalendarPlus, t('register')],
    ['/farmer/slot', Ticket, t('mySlot')],
    ['/farmer/calculator', Calculator, t('calc')],
  ];
  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-40 border-b border-line bg-ground/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-3">
          <Link to="/farmer" aria-label="StrawSlot farmer home"><Logo /></Link>
          <div className="flex rounded-ctl border border-line bg-white p-0.5" role="radiogroup" aria-label="Language">
            {LANGS.map((l) => (
              <button key={l.code} role="radio" aria-checked={lang === l.code} onClick={() => setLang(l.code)}
                className={`rounded-[6px] px-2.5 py-1.5 text-sm font-semibold ${lang === l.code ? 'bg-sprout-600 text-white' : 'text-ink-soft'}`}>
                {l.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-5">
        <Outlet />
        <p className="mt-10 text-center text-xs text-ink-mute">
          {t('simulated')} · <Link to="/admin" className="underline">{t('officerLogin')}</Link>
        </p>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur">
        <div className="mx-auto grid max-w-2xl grid-cols-4">
          {nav.map(([to, Icon, label, end]) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-semibold leading-tight ${isActive ? 'text-sprout-700' : 'text-ink-mute'}`}>
              {({ isActive }) => (<>
                <span className={`grid h-7 w-12 place-items-center rounded-full ${isActive ? 'bg-sprout-100' : ''}`}><Icon className="h-5 w-5" /></span>
                <span className="line-clamp-1 text-center">{label}</span>
              </>)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
