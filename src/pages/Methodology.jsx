import { Link } from 'react-router-dom';
import { Logo } from '../components/ui.jsx';
import { useLoad } from '../lib/useLoad.js';
import { api } from '../lib/api.js';

export default function Methodology() {
  const { data } = useLoad(() => api('/meta'));
  const types = data ? Object.values(data.machineTypes) : [];
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <Link to="/"><Logo /></Link>
        <Link to="/admin" className="text-sm font-semibold text-ink-soft underline">Officer console</Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-20">
        <h1 className="text-[40px] font-extrabold leading-tight">How StrawSlot decides</h1>
        <p className="mt-3 text-[17px] leading-relaxed text-ink-soft">Every number on screen comes from the rules and data below. Nothing is hidden in a black box, so an officer can explain any slot to a farmer.</p>

        <Sec title="1. Each field gets its own deadline">
          <p><b>Deadline = harvest date + sowing window.</b> The window defaults to {data?.sched.defaultWindowDays ?? 16} days because field studies report 15–18 days between paddy harvest and wheat sowing in Punjab. Farmers can change it when they book.</p>
        </Sec>

        <Sec title="2. The slot optimiser">
          <p>The engine simulates the season day by day from today:</p>
          <ul>
            <li>A day with {data?.sched.rainStopMm ?? 5} mm or more forecast rain is a non-working day (Open-Meteo forecast, refreshed every 30 minutes).</li>
            <li>A field becomes workable the day after harvest. Fields are served in order of <b>slack</b>: days left to the deadline minus days of work still needed. Fields already started finish first.</li>
            <li>Each field only gets machines that match the farmer's straw plan (mix into soil, or bale and sell).</li>
            <li>A machine needs a tractor powerful enough to pull it. If the farmer's own tractor is too small, the machine uses one of its hiring centre's tractors, which are limited per day.</li>
            <li>Among feasible machines the engine picks the one with the least road travel from where it last worked, so nearby fields are naturally clustered. Travel time at {data?.sched.travelKmPerHourOfWork ?? 25} km/h eats into the {data?.sched.workHoursPerDay ?? 8}-hour working day.</li>
            <li>Machines normally serve fields within {data?.sched.serviceRadiusKm ?? 30} km of their centre. When a field is down to a day of slack, the radius grows by 60% so a neighbouring block can help.</li>
            <li>Baled straw is booked onto straw-buyer pickup capacity from the day after baling.</li>
          </ul>
          <p>To show the benefit honestly, the same engine also runs a <b>first-come-first-served baseline</b>: requests served in booking order, only by the nearest centre, no cross-block help. That is how most machine-booking apps behave today.</p>
        </Sec>

        <Sec title="3. Burn-risk score (0–100)">
          <table>
            <tbody>
              <tr><td>Schedule slack</td><td>up to 60</td><td>45 − 7.5 × (days between planned finish and deadline). Unscheduled fields score 60.</td></tr>
              <tr><td>Tractor</td><td>up to 10</td><td>No tractor: 10. Own tractor under 45 HP: 5.</td></tr>
              <tr><td>Distance</td><td>up to 10</td><td>0.5 per km to the nearest hiring centre.</td></tr>
              <tr><td>Nearby fires</td><td>up to 15</td><td>5 per satellite fire hotspot within 5 km in the last 7 days.</td></tr>
            </tbody>
          </table>
          <p>60 and above is high risk, 35–59 is watch. Any field projected to miss its deadline triggers an early warning with ranked fixes.</p>
        </Sec>

        <Sec title="4. Machines">
          <table>
            <thead><tr><th>Machine</th><th>Straw plan</th><th>Tractor</th><th>Acres/day</th></tr></thead>
            <tbody>{types.map((t) => <tr key={t.label}><td>{t.label}</td><td>{t.method === 'in_situ' ? 'Mix into soil' : 'Bale and sell'}</td><td>{t.minHp} HP+</td><td>{t.acresPerDay}</td></tr>)}</tbody>
          </table>
        </Sec>

        <Sec title="5. Impact factors">
          <p>Straw: {data?.factors.strawTonnesPerAcre ?? 2.6} tonnes per acre. Per tonne of paddy straw burnt: 1,460 kg CO₂, 60 kg CO, 3 kg particulate matter, 199 kg ash and 2 kg SO₂; nutrients lost: 5.5 kg N, 2.3 kg P₂O₅, 25 kg K₂O, 1.2 kg S. Source: ICAR figures published by the Government of Goa Department of Information and Publicity, <a href="https://dip.goa.gov.in/burning-crop-residues-harms-environment/" target="_blank" rel="noreferrer">Burning crop residues harms environment</a>.</p>
          <p>"Straw kept from fire" counts fields already cleared plus fields scheduled before their deadline.</p>
        </Sec>

        <Sec title="6. What is live and what is simulated">
          <ul>
            <li><b>Live:</b> rain, temperature and wind (Open-Meteo forecast API), PM2.5 for Sangrur and New Delhi (Open-Meteo air-quality API), satellite fire hotspots (NASA FIRMS VIIRS, when a free map key is configured; otherwise a clearly labelled sample).</li>
            <li><b>Simulated:</b> the farms, farmers, phone numbers, machines and hiring centres of the Sangrur demo season. Block towns use approximate real coordinates. The season is generated around today's date so the demo always shows an active harvest.</li>
            <li><b>Real:</b> anything a farmer books through the app is stored and scheduled alongside the demo data.</li>
          </ul>
        </Sec>

        <Sec title="7. Research behind the problem">
          <ul>
            <li><a href="https://www.ceew.in/blogs/why-stubble-burning-continues-punjab-%E2%80%94-perspectives-ground" target="_blank" rel="noreferrer">CEEW: Why stubble burning continues in Punjab</a>, on machine-availability uncertainty and the 15–18 day window.</li>
            <li><a href="https://ceew.in/blogs/ceew-explains-why-punjab-farmers-are-averse-to-using-happy-super-seeder-machines" target="_blank" rel="noreferrer">CEEW: Why farmers avoid seeder machines</a>, on rental delays and poor app awareness.</li>
            <li><a href="https://www.tribuneindia.com/news/delhi/satellites-miss-majority-of-stubble-fires-delhi-air-pollution-underestimated-report/amp" target="_blank" rel="noreferrer">The Tribune: Satellites miss most stubble fires</a>, on late-afternoon burning outside satellite passes.</li>
          </ul>
        </Sec>
      </main>
    </div>
  );
}

function Sec({ title, children }) {
  return (
    <section className="mt-10 border-t border-line pt-8 text-[15px] leading-relaxed text-ink-soft [&_a]:font-semibold [&_a]:text-sprout-700 [&_a]:underline [&_b]:text-ink [&_li]:mt-1.5 [&_p]:mt-3 [&_table]:mt-4 [&_table]:w-full [&_table]:text-sm [&_td]:border-t [&_td]:border-line [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top [&_th]:pb-2 [&_th]:pr-3 [&_th]:text-left [&_th]:text-xs [&_th]:text-ink-mute [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
      <h2 className="text-2xl font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}
