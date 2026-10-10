import type { ReactNode } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { Home, CalendarPlus, Ticket, Calculator, type LucideIcon } from 'lucide-react';
import { Logo } from '../../components/ui';
import { useI18n, LANGS, Dual } from '../../lib/i18n';

export function LangSwitch({ dark = false }: { dark?: boolean }) {
  const { lang, setLang } = useI18n();
  return (
    <div className={`flex rounded-full p-1 ${dark ? 'bg-white/10' : 'border border-line bg-white'}`} role="radiogroup" aria-label="Language">
      {LANGS.map((l) => (
        <button key={l.code} role="radio" aria-checked={lang === l.code} onClick={() => setLang(l.code)}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${lang === l.code ? 'bg-sprout-600 text-white shadow-sm' : dark ? 'text-white/80 hover:text-white' : 'text-ink-soft hover:text-ink'}`}>
          {l.name}
        </button>
      ))}
    </div>
  );
}

export default function FarmerLayout() {
  const { t } = useI18n();
  const nav: [string, LucideIcon, string, boolean?][] = [
    ['/farmer', Home, 'home', true],
    ['/farmer/register', CalendarPlus, 'register'],
    ['/farmer/slot', Ticket, 'mySlot'],
    ['/farmer/calculator', Calculator, 'calc'],
  ];
  return (
    <div className="flex min-h-screen flex-col pb-24 lg:pb-0">
      <header className="sticky top-0 z-40 border-b border-line/80 bg-ground/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/farmer" aria-label="StrawSlot farmer home"><Logo /></Link>
          <nav className="hidden items-center gap-1 lg:flex">
            {nav.map(([to, Icon, label, end]) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${isActive ? 'bg-sprout-900 text-white' : 'text-ink-soft hover:bg-white'}`}>
                <Icon className="h-4 w-4 shrink-0" /><Dual k={label} className="leading-tight" subClassName="text-[0.78em] font-medium opacity-75" />
              </NavLink>
            ))}
          </nav>
          <LangSwitch />
        </div>
      </header>

      <div className="flex-1"><Outlet /></div>

      <footer className="mt-16 border-t border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-ink-mute sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <Logo />
          <p>{t('simulated')}</p>
          <Link to="/admin" className="font-semibold text-ink underline">{t('officerLogin')}</Link>
        </div>
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-2xl grid-cols-4">
          {nav.map(([to, Icon, label, end]) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-semibold leading-tight ${isActive ? 'text-sprout-700' : 'text-ink-mute'}`}>
              {({ isActive }) => (<>
                <span className={`grid h-7 w-12 place-items-center rounded-full ${isActive ? 'bg-sprout-100' : ''}`}><Icon className="h-5 w-5" /></span>
                <span className="line-clamp-1 text-center">{t(label)}</span>
              </>)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function PageWrap({ children, wide = false }: { children?: ReactNode; wide?: boolean }) {
  return <main className={`mx-auto px-4 pt-6 sm:px-6 lg:px-8 lg:pt-10 ${wide ? 'max-w-7xl' : 'max-w-6xl'}`}>{children}</main>;
}
