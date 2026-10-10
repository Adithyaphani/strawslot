import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { LayoutDashboard, BellRing, CalendarRange, Table2, FlaskConical, Warehouse, History, BookOpen, LogOut } from 'lucide-react';
import { Logo } from '../../components/ui.jsx';
import { session } from '../../lib/api.js';
import { useAT, AdminLangSwitch } from '../../lib/adminI18n.jsx';

export default function AdminLayout() {
  const nav = useNavigate();
  const { t } = useAT();
  const user = session.user();
  const logout = () => { session.clear(); nav('/admin/login'); };
  const NAV = [
    ['/admin', LayoutDashboard, t('nav_overview'), true],
    ['/admin/alerts', BellRing, t('nav_alerts')],
    ['/admin/dispatch', CalendarRange, t('nav_dispatch')],
    ['/admin/fields', Table2, t('nav_fields')],
    ['/admin/what-if', FlaskConical, t('nav_whatif')],
    ['/admin/registry', Warehouse, t('nav_registry')],
    ['/admin/activity', History, t('nav_activity')],
  ];
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col bg-sprout-900 text-white lg:flex">
        <Link to="/" className="px-6 py-6"><Logo light /></Link>
        <p className="px-6 pb-3 text-xs font-semibold text-sprout-300">{t('district')}</p>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(([to, Icon, label, end]) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-white text-sprout-900 shadow-sm' : 'text-sprout-100 hover:bg-white/10'}`}>
              <Icon className="h-4 w-4" />{label}
            </NavLink>
          ))}
          <Link to="/methodology" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-sprout-100 hover:bg-white/10"><BookOpen className="h-4 w-4" />{t('nav_method')}</Link>
        </nav>
        <div className="m-3 rounded-2xl bg-white/10 p-4">
          <p className="text-sm font-semibold">{t('officer')}</p>
          <p className="text-xs text-sprout-300">@{user?.username}</p>
          <button onClick={logout} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-sprout-100 hover:text-white"><LogOut className="h-4 w-4" />{t('logout')}</button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <Link to="/" className="lg:hidden"><Logo /></Link>
            <p className="hidden text-sm text-ink-mute lg:block">{t('district')} · {t('officer')}</p>
            <div className="flex items-center gap-2">
              <AdminLangSwitch />
              <button onClick={logout} aria-label={t('logout')} className="rounded-full p-2 hover:bg-smoke-100 lg:hidden"><LogOut className="h-5 w-5" /></button>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden">
            {NAV.map(([to, Icon, label, end]) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${isActive ? 'bg-sprout-900 text-white' : 'bg-smoke-100 text-ink-soft'}`}>
                <Icon className="h-3.5 w-3.5" />{label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><Outlet /></main>
      </div>
    </div>
  );
}
