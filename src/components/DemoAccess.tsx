import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, LayoutDashboard, Smartphone, Loader2 } from 'lucide-react';
import { api, session } from '../lib/api';

export const DEMO = { user: 'officer', password: 'sangrur2026', farmerPhone: '9000000001' };

export async function loginAsDemoOfficer() {
  const r = await api<{ token: string; refreshToken?: string; user: any }>('/auth/login', { method: 'POST', body: { user: DEMO.user, password: DEMO.password } });
  session.set(r.token, r.user, r.refreshToken);
}

/** Built-in demo credentials with one-click entry, so judges never need to type anything. */
export default function DemoAccess({ className = '' }: { className?: string }) {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const enterOfficer = async () => {
    setBusy(true); setErr('');
    try { await loginAsDemoOfficer(); nav('/admin'); } catch (e: any) { setErr(e?.message || 'Could not sign in'); } finally { setBusy(false); }
  };
  return (
    <div className={`rounded-2xl border border-stubble-300 bg-white p-5 shadow-sm ${className}`}>
      <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-stubble-700"><KeyRound className="h-4 w-4" /> Judges and demo access</div>
      <p className="mt-1 text-sm text-ink-soft">Everything is pre-loaded with a simulated Sangrur season. No sign-up needed.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-sprout-50 p-4">
          <p className="font-semibold">Officer console</p>
          <p className="mt-1 font-mono text-xs text-ink-soft">{DEMO.user} / {DEMO.password}</p>
          <button onClick={enterOfficer} disabled={busy} className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-white hover:bg-ink-soft disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LayoutDashboard className="h-4 w-4" />} Open demo dashboard
          </button>
        </div>
        <div className="rounded-xl bg-sprout-50 p-4">
          <p className="font-semibold">Farmer side</p>
          <p className="mt-1 font-mono text-xs text-ink-soft">No login · demo phone {DEMO.farmerPhone}</p>
          <button onClick={() => nav('/farmer/slot')} className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-sprout-600 px-4 text-sm font-semibold text-white hover:bg-sprout-700">
            <Smartphone className="h-4 w-4" /> Open farmer app
          </button>
        </div>
      </div>
      {err && <p className="mt-3 text-sm text-red-700">{err}</p>}
    </div>
  );
}
