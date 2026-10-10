import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Tractor, ShieldCheck, Clock3, Wheat, CalendarClock, Flame, CloudRain, BellRing, Smartphone, LayoutDashboard } from 'lucide-react';
import { Logo, LiveDot } from '../components/ui.jsx';
import SeasonStrip from '../components/SeasonStrip.jsx';
import { api } from '../lib/api.js';
import { addDays, fmtNum, todayIST } from '../lib/format.js';

export default function Landing() {
  const [data, setData] = useState(null);
  useEffect(() => { api('/public/stats').then(setData).catch(() => {}); }, []);
  const today = todayIST();
  const s = data?.stats;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 text-sm font-semibold">
          <Link to="/methodology" className="hidden rounded-ctl px-3 py-2 text-ink-soft hover:bg-white sm:block">How it works</Link>
          <Link to="/farmer" className="rounded-ctl px-3 py-2 text-ink-soft hover:bg-white">Farmers</Link>
          <Link to="/admin" className="rounded-ctl bg-ink px-3 py-2 text-white hover:bg-ink-soft">Officer login</Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-6 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-12">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink-soft shadow-panel">
              <Flame className="h-3.5 w-3.5 text-fire-500" /> Paddy harvest season is on in Punjab
            </p>
            <h1 className="text-[42px] font-extrabold leading-[1.02] sm:text-[60px]">
              Book the machine<br />before the fire.
            </h1>
            <p className="mt-5 max-w-[52ch] text-[17px] leading-relaxed text-ink-soft">
              Small farmers burn paddy straw when no machine reaches them before wheat sowing.
              StrawSlot schedules every field against its own deadline, books the tractor and straw pickup,
              and warns block officers a week before a field is about to miss.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/farmer" className="inline-flex h-12 items-center justify-center gap-2 rounded-ctl bg-sprout-600 px-6 font-semibold text-white shadow-sm hover:bg-sprout-700">
                <Smartphone className="h-4 w-4" /> I'm a farmer
              </Link>
              <Link to="/admin" className="inline-flex h-12 items-center justify-center gap-2 rounded-ctl border border-line bg-white px-6 font-semibold hover:border-ink-mute">
                <LayoutDashboard className="h-4 w-4" /> I'm a block or district officer
              </Link>
            </div>
            <p className="mt-4 text-xs text-ink-mute">Farmer side works in Punjabi, Hindi and English. No login needed to book.</p>
          </div>

          <div className="panel p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Field F-1042, Ugrahan village</p>
              <span className="chip bg-stubble-50 text-stubble-700">4.5 acres</span>
            </div>
            <SeasonStrip harvestDate={addDays(today, -3)} deadline={addDays(today, 13)} today={today} start={addDays(today, 4)} completion={addDays(today, 4)} />
            <div className="border-t border-line pt-5">
              <p className="text-sm font-semibold">Fields cleared before their sowing deadline</p>
              <p className="mb-4 text-xs text-ink-mute">Sangrur demo season, live schedule run against today's weather</p>
              <Bar label="With StrawSlot" value={s?.onTimePct} tone="bg-sprout-500" />
              <Bar label="First-come booking (today's apps)" value={data?.baseline?.onTimePct} tone="bg-smoke-400" />
              <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                <Mini icon={Wheat} value={s ? fmtNum(s.acres.protected) : '…'} label="acres cleared or booked" />
                <Mini icon={Flame} value={s ? `${fmtNum(s.impact.co2Tonnes)} t` : '…'} label="CO₂ not burnt" />
                <Mini icon={Tractor} value={s ? `${s.utilisationPct}%` : '…'} label="machine use, 14 days" />
              </div>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
                <LiveDot live={data?.weather?.live} label={data?.weather?.live ? 'Live weather, Open-Meteo' : 'Weather fallback'} />
                <LiveDot live={data?.fires?.live} label={data?.fires?.live ? `NASA FIRMS: ${data.fires.districtCount} fires this week` : 'Fire data: sample'} />
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="text-3xl font-bold">Why fields still burn</h2>
            <p className="mt-2 max-w-[60ch] text-ink-soft">Farmers already know burning is harmful. The gap is timing and coordination, not awareness.</p>
            <div className="mt-8 grid gap-8 md:grid-cols-3">
              <Cause icon={Clock3} title="A 15–18 day window">
                After paddy harvest there are only about two weeks to clear straw and sow wheat. When the machine is late, fire is the only option that always works on time.
              </Cause>
              <Cause icon={CalendarClock} title="Apps list machines, nobody schedules them">
                Booking apps show that machines exist, not whether one will reach your field before your deadline. Delays and paperwork add uncertainty.
              </Cause>
              <Cause icon={Tractor} title="Small farmers lack big tractors">
                Super Seeders need 55 HP or more. Farmers without one depend on a hiring centre's few tractors, which are booked first by larger farms.
              </Cause>
            </div>
            <p className="mt-6 text-xs text-ink-mute">
              Based on field studies by <a className="underline" href="https://www.ceew.in/blogs/why-stubble-burning-continues-punjab-%E2%80%94-perspectives-ground" target="_blank" rel="noreferrer">CEEW</a> and
              {' '}<a className="underline" href="https://ceew.in/blogs/ceew-explains-why-punjab-farmers-are-averse-to-using-happy-super-seeder-machines" target="_blank" rel="noreferrer">CEEW on seeder adoption</a>.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-3xl font-bold">How a field gets cleared on time</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-4">
            {[
              [Smartphone, 'Farmer books', 'Village, acres, harvest date and tractor, in Punjabi, Hindi or English.'],
              [CloudRain, 'Engine schedules', 'Each field is slotted before its deadline, using live rain forecasts and machine capacity.'],
              [BellRing, 'Officer acts early', 'Fields that will miss are flagged with a ready fix, like borrowing a machine from the next block.'],
              [ShieldCheck, 'Straw cleared or sold', 'Seeded into soil, or baled and picked up for a biomass plant. No fire.'],
            ].map(([Icon, title, text], i) => (
              <li key={title} className="panel p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-ink font-display text-sm font-bold text-white">{i + 1}</span>
                  <Icon className="h-5 w-5 text-sprout-600" />
                </div>
                <p className="mt-4 font-bold">{title}</p>
                <p className="mt-1 text-sm text-ink-soft">{text}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-ink-mute sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo className="opacity-80" />
          <p className="max-w-[70ch]">
            Demo season: farms, machines and phone numbers in Sangrur district are simulated. Weather, air quality and fire hotspots come from live public APIs when available.
            {' '}<Link to="/methodology" className="font-semibold text-ink underline">Methodology and data sources</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}

function Bar({ label, value, tone }) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-sm"><span>{label}</span><span className="num font-bold">{value != null ? `${value}%` : '…'}</span></div>
      <div className="h-3 rounded-full bg-smoke-100">
        <div className={`h-3 rounded-full ${tone} transition-all duration-700`} style={{ width: `${value || 0}%` }} />
      </div>
    </div>
  );
}

function Mini({ icon: Icon, value, label }) {
  return (
    <div className="rounded-ctl bg-ground px-2 py-3">
      <Icon className="mx-auto h-4 w-4 text-ink-mute" />
      <p className="num mt-1 font-display text-lg font-bold">{value}</p>
      <p className="text-[11px] leading-tight text-ink-mute">{label}</p>
    </div>
  );
}

function Cause({ icon: Icon, title, children }) {
  return (
    <div>
      <Icon className="h-6 w-6 text-stubble-600" />
      <h3 className="mt-3 text-lg font-bold">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">{children}</p>
    </div>
  );
}
