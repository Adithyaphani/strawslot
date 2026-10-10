// Deterministic demo dataset for Sangrur district, Punjab.
// Block towns use approximate real coordinates; villages, farmers, machines and
// phone numbers are SIMULATED and labelled as such everywhere in the UI.
// Harvest dates are generated relative to an anchor date so the demo season
// always looks "live" whenever the app is opened.

import { addDays } from '../lib/dates.js';
import { MACHINE_TYPES } from '../lib/constants.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const BLOCKS = [
  { id: 'sangrur', name: 'Sangrur', lat: 30.2458, lon: 75.8421 },
  { id: 'dhuri', name: 'Dhuri', lat: 30.3687, lon: 75.868 },
  { id: 'sunam', name: 'Sunam', lat: 30.1286, lon: 75.7997 },
  { id: 'bhawanigarh', name: 'Bhawanigarh', lat: 30.266, lon: 76.0393 },
  { id: 'lehragaga', name: 'Lehragaga', lat: 29.9447, lon: 75.997 },
  { id: 'moonak', name: 'Moonak', lat: 29.8253, lon: 75.8771 },
  { id: 'longowal', name: 'Longowal', lat: 30.2167, lon: 75.6833 },
  { id: 'sherpur', name: 'Sherpur', lat: 30.3712, lon: 75.7334 },
  { id: 'dirba', name: 'Dirba', lat: 30.0718, lon: 75.9907 },
];

const VILLAGE_NAMES = [
  'Kheri Khurd', 'Balian', 'Ghanaur Kalan', 'Rampura', 'Fatehgarh', 'Bhindran', 'Ugrahan', 'Kanjhla',
  'Chhajli', 'Mehlan', 'Kakra', 'Bhattiwal', 'Ladda', 'Gharachon', 'Balad Kalan', 'Kalajhar',
  'Sohian', 'Jhaloor', 'Nadampur', 'Bakhshiwala', 'Kothala', 'Rogla', 'Dhandoli', 'Haripura',
  'Saron', 'Bhasaur', 'Jakhepal',
];
const FIRST = ['Gurpreet', 'Harjinder', 'Baljit', 'Sukhdev', 'Jaswant', 'Kulwinder', 'Paramjit', 'Manjeet', 'Amarjit', 'Ranjit', 'Balwinder', 'Satnam', 'Jagtar', 'Harpal', 'Davinder', 'Lakhwinder', 'Gurmeet', 'Kuldeep', 'Rajinder', 'Sarabjit', 'Jasbir', 'Nirmal', 'Charanjit', 'Hardeep'];
const LAST = ['Singh', 'Kaur', 'Sidhu', 'Gill', 'Dhillon', 'Sandhu', 'Grewal', 'Brar', 'Mann', 'Virk', 'Cheema', 'Bains'];

const r2 = (x) => Math.round(x * 100) / 100;
const r5 = (x) => Math.round(x * 1e5) / 1e5;

export function buildSeed(anchor, seed = 20261010) {
  const rand = rng(seed);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const between = (a, b) => a + rand() * (b - a);
  const int = (a, b) => Math.floor(between(a, b + 1));
  // triangular distribution, used for harvest timing (peak season bunching)
  const tri = (a, c, b) => {
    const u = rand(); const f = (c - a) / (b - a);
    return u < f ? a + Math.sqrt(u * (b - a) * (c - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - c));
  };

  // Villages: 3 per block, jittered ~2-7 km around the block town.
  const villages = [];
  BLOCKS.forEach((b, bi) => {
    for (let k = 0; k < 3; k++) {
      const name = VILLAGE_NAMES[bi * 3 + k];
      const ang = rand() * Math.PI * 2; const km = between(2, 7);
      villages.push({
        id: `v-${b.id}-${k + 1}`,
        name,
        blockId: b.id,
        lat: r5(b.lat + (km / 111) * Math.sin(ang)),
        lon: r5(b.lon + (km / 96) * Math.cos(ang)),
      });
    }
  });

  // Custom Hiring Centres: one per block except Dirba (served by neighbours).
  const chcBlocks = BLOCKS.filter((b) => b.id !== 'dirba');
  const chcs = chcBlocks.map((b, i) => ({
    id: `chc-${b.id}`,
    name: `${b.name} Custom Hiring Centre`,
    blockId: b.id,
    operator: `${pick(FIRST)} ${pick(LAST)}`,
    phone: `90100000${String(i + 1).padStart(2, '0')}`,
    lat: r5(b.lat + between(-0.01, 0.01)),
    lon: r5(b.lon + between(-0.01, 0.01)),
    tractors: Array.from({ length: int(1, 2) }, (_, t) => ({ id: `tr-${b.id}-${t + 1}`, hp: pick([50, 55, 60, 60, 65]) })),
  }));

  const typeMix = ['super_seeder', 'super_seeder', 'happy_seeder', 'mulcher', 'baler', 'happy_seeder', 'baler'];
  const machines = [];
  chcs.forEach((c) => {
    const n = int(2, 4);
    for (let k = 0; k < n; k++) {
      const type = typeMix[(k + machines.length) % typeMix.length];
      machines.push({
        id: `m-${c.blockId}-${k + 1}`,
        chcId: c.id,
        type,
        label: `${MACHINE_TYPES[type].label} #${k + 1}`,
        acresPerDay: MACHINE_TYPES[type].acresPerDay + pick([-1, 0, 0, 1]),
        status: rand() < 0.06 ? 'maintenance' : 'active',
      });
    }
  });

  const vendors = [
    { id: 'pv-1', name: 'Sangrur Biomass Aggregators', capacityTonnesPerDay: 90, destination: 'Biomass power plant (simulated)', phone: '9020000001' },
    { id: 'pv-2', name: 'Malwa Straw Logistics', capacityTonnesPerDay: 70, destination: 'CBG plant (simulated)', phone: '9020000002' },
    { id: 'pv-3', name: 'Green Bale Collective', capacityTonnesPerDay: 60, destination: 'Paper mill (simulated)', phone: '9020000003' },
  ];

  // Fields
  const fields = [];
  const N = 640;
  for (let i = 0; i < N; i++) {
    const v = pick(villages);
    const sizeRoll = rand();
    const acres = sizeRoll < 0.35 ? between(1, 2.5) : sizeRoll < 0.7 ? between(2.5, 5) : sizeRoll < 0.92 ? between(5, 10) : between(10, 18);
    const harvestOffset = Math.round(tri(-12, 2, 14));
    const harvestDate = addDays(anchor, harvestOffset);
    const ownsTractor = rand() < 0.42;
    const prefRoll = rand();
    const f = {
      id: `F-${String(1001 + i)}`,
      source: 'seed',
      farmerName: `${pick(FIRST)} ${pick(LAST)}`,
      phone: `9000${String(i + 1).padStart(6, '0')}`,
      language: pick(['pa', 'pa', 'pa', 'hi', 'en']),
      villageId: v.id,
      lat: r5(v.lat + between(-0.012, 0.012)),
      lon: r5(v.lon + between(-0.012, 0.012)),
      acres: r2(acres),
      harvestDate,
      windowDays: int(14, 18),
      nextCrop: 'wheat',
      preference: prefRoll < 0.45 ? 'in_situ' : prefRoll < 0.7 ? 'ex_situ' : 'any',
      tractor: ownsTractor ? { owns: true, hp: pick([35, 40, 45, 50, 55, 60]) } : { owns: false, hp: 0 },
      status: 'pending',
      createdAt: addDays(anchor, Math.min(harvestOffset, 0) - int(3, 12)),
    };
    // Fields harvested well before the anchor are partly cleared already.
    if (harvestOffset <= -4 && rand() < 0.6) {
      f.status = 'cleared';
      f.clearedOn = addDays(harvestDate, int(2, Math.min(8, -harvestOffset - 1)));
      f.clearedBy = 'machine';
    }
    fields.push(f);
  }

  return {
    meta: { anchor, seed, generatedAt: new Date().toISOString(), district: 'Sangrur', simulated: true },
    blocks: BLOCKS,
    villages,
    chcs,
    machines,
    vendors,
    fields,
    pins: [],
    issues: [],
    log: [{ at: new Date().toISOString(), actor: 'system', action: 'seed', detail: `Demo season generated around ${anchor}` }],
  };
}
