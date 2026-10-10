import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { LayoutDashboard, BellRing, CalendarRange, Table2, FlaskConical, Warehouse, History, BookOpen, LogOut } from 'lucide-react';
import { Logo } from '../../components/ui.jsx';
import { session } from '../../lib/api.js';

const NAV = [
  ['/admin', LayoutDashboard, 'Overview', true],
  ['/admin/alerts', BellRing, 'Early warnings'],
  ['/admin/dispatch', CalendarRange, 'Dispatch board'],
  ['/admin/fields', Table2, 'Fields'],
  ['/admin/what-if', FlaskConical, 'What-if planner'],
  ['/admin/registry', Warehouse, 'Machines & centres'],
  ['/admin/activity', History, 'Activity log'],
];

export default function AdminLayout() {
  const nav = useNavigate();
  const user = session.user();
  const logout = () => { session.clear(); nav('/admin/login'); };
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-white lg:flex">
        <Link to="/" className="px-5 py-5"><Logo /></Link>
        <p className="px-5 pb-2 text-xs font-semibold text-ink-mute">Sangrur district</p>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map(([to, Icon, label, end]) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex items-center gap-3 rounded-ctl px-3 py-2.5 text-sm font-semibold ${isActive ? 'bg-sprout-900 text-white' : 'text-ink-soft hover:bg-smoke-100'}`}>
              <Icon className="h-4 w-4" />{label}
            </NavLink>
          ))}
          <Link to="/methodology" className="flex items-center gap-3 rounded-ctl px-3 py-2.5 text-sm font-semibold text-ink-soft hover:bg-smoke-100"><BookOpen className="h-4 w-4" />Methodology</Link>
        </nav>
        <div className="border-t border-line p-4">
          <p className="text-sm font-semibold">{user?.name || 'Nodal officer'}</p>
          <p className="text-xs text-ink-mute">@{user?.username}</p>
          <button onClick={logout} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-soft hover:text-fire-600"><LogOut className="h-4 w-4" />Log out</button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Logo />
            <button onClick={logout} aria-label="Log out" className="rounded-ctl p-2 hover:bg-smoke-100"><LogOut className="h-5 w-5" /></button>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
            {NAV.map(([to, Icon, label, end]) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${isActive ? 'bg-sprout-900 text-white' : 'bg-smoke-100 text-ink-soft'}`}>
                <Icon className="h-3.5 w-3.5" />{label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8"><Outlet /></main>
      </div>
    </div>
  );
}
