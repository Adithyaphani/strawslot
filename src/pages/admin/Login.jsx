import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { LogIn, Info } from 'lucide-react';
import { Logo, Button, ErrorBox } from '../../components/ui.jsx';
import { api, session } from '../../lib/api.js';

export default function Login() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [user, setUser] = useState('officer');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.get('expired') ? { message: 'Your session expired. Please log in again.' } : null);

  useEffect(() => { if (session.token()) nav('/admin', { replace: true }); }, [nav]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = await api('/auth/login', { method: 'POST', body: { user, password } });
      session.set(r.token, r.user);
      nav('/admin', { replace: true });
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sprout-900 p-10 text-white lg:flex">
        <Link to="/"><Logo light /></Link>
        <div>
          <h1 className="max-w-[16ch] text-[44px] font-extrabold leading-[1.05]">Every field in the district, against its own deadline.</h1>
          <p className="mt-4 max-w-[46ch] text-sprout-100">See which fields will miss their sowing window a week ahead, move machines between blocks, and track fires and air quality from one screen.</p>
        </div>
        <p className="text-xs text-sprout-300">Officer console for district and block crop-residue nodal officers.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm">
          <Link to="/" className="lg:hidden"><Logo /></Link>
          <h2 className="mt-8 text-3xl font-bold lg:mt-0">Officer login</h2>
          <p className="mt-1 text-sm text-ink-mute">Sangrur district console</p>
          <div className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="u">Username</label>
              <input id="u" className="input" value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" />
            </div>
            <div>
              <label className="label" htmlFor="p">Password</label>
              <input id="p" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <ErrorBox error={error} />
            <Button type="submit" size="lg" className="w-full" icon={LogIn} loading={busy}>Log in</Button>
          </div>
          <div className="mt-6 flex gap-2 rounded-ctl border border-stubble-300 bg-stubble-50 p-3 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-stubble-700" />
            <div>
              <p className="font-semibold">Judges and demo access</p>
              <p className="text-ink-soft">Username <b>officer</b>, password <b>sangrur2026</b></p>
              <button type="button" className="mt-1 font-semibold text-sprout-700 underline" onClick={() => { setUser('officer'); setPassword('sangrur2026'); }}>Fill demo login</button>
            </div>
          </div>
          <Link to="/farmer" className="mt-6 block text-center text-sm text-ink-mute underline">Are you a farmer? Book a machine here</Link>
        </form>
      </div>
    </div>
  );
}
