# StrawSlot

**A deadline-aware scheduler that books crop-residue machines, tractors and straw pickups before each farmer's sowing deadline, so small farmers don't burn paddy straw for lack of time.**

Social Impact Hackathon 2026 (Cloud Counselage x DTI) · Theme: **Climate & Sustainability**

---

## The problem

Small farmers burn paddy straw because no one schedules machines, tractors and pickups before each field's sowing deadline; apps only list machines.

- After paddy harvest a farmer has roughly **15–18 days** to clear straw and sow wheat.
- Clearing needs a machine, a tractor powerful enough to pull it (Super Seeder: 55 HP+), and, for baling, a straw pickup.
- Booking apps show that machines exist, not whether one will reach *your* field *before your deadline*. Field studies (CEEW) report rental delays, poor logistics and uncertainty as the reasons farmers fall back on fire.

## What StrawSlot does

| | Farmer side (no login) | Officer side (login) |
|---|---|---|
| Who | Small and marginal paddy farmers | District / block crop-residue nodal officers |
| Language | English by default with Punjabi shown alongside; full Punjabi or Hindi on tap | English, Punjabi |
| Key screens | Book a machine (3-step wizard), check my booking, straw value calculator | District overview, early warnings, dispatch board, fields, what-if planner, machines & centres, activity log |

**Core engine**

1. **Deadline per field** = harvest date + sowing window.
2. **Slot optimiser**: day-by-day simulation, least-slack-first, matches machine type to the farmer's straw plan, enforces tractor horsepower and hiring-centre tractor limits, clusters nearby fields by travel distance, blocks rain days from the live forecast, books straw pickups for baled fields.
3. **Burn-risk score (0–100)** from schedule slack, tractor access, distance to a hiring centre and nearby satellite fire hotspots.
4. **Early warnings** a week ahead with ranked one-click fixes (borrow a machine from another centre, switch to baling, pair a tractor).
5. **Honest benefit measurement**: the same engine also runs a first-come-first-served baseline (how booking apps behave today) and shows both.

**Extra features**

- Farmer SMS text in Punjabi / Hindi / English with WhatsApp share
- Farmer "report a problem" flows straight into the officer's queue
- Officer AI briefing (Claude API if a key is set, rule-based otherwise), shown in English or Punjabi
- One-click **Auto-fix** per field and **Auto-fix district** sweep: only applies a reassignment if it gets the field in on time *and* lowers the district's total at-risk count
- Live booking preview for farmers: sowing window, days left and which machines their tractor can pull
- Illustrated, responsive farmer and landing pages; bilingual officer console (risk reasons, fixes and briefing are localised too)
- What-if planner: add machines, repair idle ones or rent tractors, and see the change in on-time %
- Officer overrides (pin a field to a machine), machine maintenance toggle, CSV export
- Live weather, PM2.5 (Sangrur vs Delhi) and NASA FIRMS fire hotspots

## Data: live vs simulated

| Data | Source | Status |
|---|---|---|
| Rain, temperature, wind (16-day) | Open-Meteo forecast API | **Live**, no key |
| PM2.5 / US AQI | Open-Meteo air-quality API | **Live**, no key |
| Satellite fire hotspots (VIIRS, 7 days) | NASA FIRMS | **Live** with a free `FIRMS_MAP_KEY`; labelled sample otherwise |
| Farms, farmers, machines, hiring centres | Generated for Sangrur district | **Simulated** (block towns use approximate real coordinates) |
| Fields booked through the app | Users | **Real**, stored and scheduled |

Impact factors per tonne of paddy straw burnt (ICAR figures, Govt. of Goa DIP): 1,460 kg CO₂, 60 kg CO, 3 kg PM, 5.5 kg N, 25 kg K₂O. Straw yield: 2.6 t/acre.

The demo season is generated around today's date so the app always shows an active harvest. Export it with `npm run seed:export` (writes `data/demo-dataset.json` and `data/demo-fields.csv`).

## Judge access

- **Live app**: *(add your Netlify link here)*
- **Farmer side**: open `/farmer`. No login. Use "Try a demo number" on *Check my booking*.
- **Officer side**: open `/admin`. Username `officer`, password `sangrur2026` (a "Fill demo login" button is on the login page).

## Architecture

```
Browser (React + Vite + Tailwind, Leaflet, Recharts)
   │  /api/*
   ▼
Netlify Function  ──  Express app (server/app.js)
   │                    ├─ middleware: helmet, CORS, rate limits, Zod validation, signed officer tokens, error handler
   │                    ├─ engine.js: deadlines, slot optimiser, risk, alerts, KPIs, baseline
   │                    ├─ live.js: Open-Meteo + FIRMS with 30-min cache and fallbacks
   │                    └─ messages.js: farmer SMS in pa / hi / en
   ▼
Netlify Blobs (state JSON)   ·   local: server/data/local-state.json
```

## Run locally

```bash
npm install
npm run build
npm start            # http://localhost:8787 (API + built frontend)
```

For development with hot reload: `npm run dev` (API on 8787, Vite on 5173).

Tests: `npm test` (11 engine tests: capacity, harvest dates, tractor HP, rain blocking, officer pins, alerts, optimiser beats baseline).

## Deploy to Netlify

1. Push this folder to a GitHub repo.
2. In Netlify: **Add new site → Import from Git**, pick the repo. Build command and publish folder are read from `netlify.toml`.
3. In **Site configuration → Environment variables**, set `AUTH_SECRET` (any long random string) and optionally `FIRMS_MAP_KEY` and `ANTHROPIC_API_KEY`.
4. Deploy. Netlify Blobs needs no extra setup.

## API (selection)

| Method | Path | Auth |
|---|---|---|
| GET | `/api/health`, `/api/meta`, `/api/public/stats` | public |
| GET | `/api/live/weather`, `/api/live/air`, `/api/live/fires` | public |
| POST | `/api/farmer/fields` (book), `/api/farmer/issues` (report) | public, rate-limited |
| GET | `/api/farmer/lookup?phone=` | public |
| POST | `/api/auth/login` | — |
| GET | `/api/admin/overview`, `/alerts`, `/dispatch`, `/fields`, `/registry`, `/briefing`, `/log`, `/export/schedule.csv` | officer |
| POST | `/api/admin/reassign`, `/whatif`, `/machines/:id`, `/fields/:id/status`, `/issues/:id/resolve`, `/reset` | officer |

## Research

- CEEW, *Why stubble burning continues in Punjab: perspectives from the ground*
- CEEW, *Why Punjab farmers are averse to using Happy/Super Seeder machines*
- The Tribune, *Satellites miss majority of stubble fires* (iFOREST report)

Built with AI assistance (Claude).
