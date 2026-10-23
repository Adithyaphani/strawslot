// Domain constants. Every number here is shown on the Methodology page.

import type { MachineType, StrawPlan } from './types.js';

export const MACHINE_TYPES: Record<MachineType, { label: string; method: StrawPlan; minHp: number; acresPerDay: number; note: string }> = {
  super_seeder: {
    label: 'Super Seeder',
    method: 'in_situ',
    minHp: 55,
    acresPerDay: 7,
    note: 'Mulches straw into soil and sows wheat in one pass.',
  },
  happy_seeder: {
    label: 'Happy Seeder',
    method: 'in_situ',
    minHp: 45,
    acresPerDay: 7,
    note: 'Sows wheat directly into standing stubble; straw stays as mulch.',
  },
  mulcher: {
    label: 'Mulcher + RMB Plough',
    method: 'in_situ',
    minHp: 45,
    acresPerDay: 9,
    note: 'Chops straw and ploughs it under before sowing.',
  },
  baler: {
    label: 'Rake + Baler',
    method: 'ex_situ',
    minHp: 35,
    acresPerDay: 12,
    note: 'Collects straw into bales that are picked up for biomass plants.',
  },
};

// Scheduling assumptions (editable in one place).
export const SCHED = {
  defaultWindowDays: 16, // harvest -> sowing window (field studies report 15-18 days)
  rainStopMm: 5, // a day with >= 5 mm forecast rain is treated as a non-working day
  serviceRadiusKm: 30, // a CHC normally serves fields within this distance
  travelKmPerHourOfWork: 25, // tractor road speed used to convert travel into lost work time
  workHoursPerDay: 8,
  alertLeadDays: 7, // warn the officer this many days before a projected miss
};

// Straw and emission factors, per tonne of paddy straw burnt.
// Source: Govt. of Goa DIP note "Burning crop residues harms environment" (ICAR figures),
// also reproduced by Pushpa Gujral Science City, Punjab.
export const FACTORS = {
  strawTonnesPerAcre: 2.6, // ~6.5 t/ha paddy straw yield, Punjab average order of magnitude
  perTonne: { co2Kg: 1460, coKg: 60, pmKg: 3, ashKg: 199, so2Kg: 2 },
  nutrientsPerTonne: { nKg: 5.5, p2o5Kg: 2.3, k2oKg: 25, sKg: 1.2 },
  strawPricePerQuintal: 180, // indicative ex-situ bale price, editable in the farmer calculator
};

export const RISK_LEVELS = [
  { min: 60, level: 'high' },
  { min: 35, level: 'medium' },
  { min: 0, level: 'low' },
];

// Sangrur district bounding box (W, S, E, N) and centre.
export const DISTRICT = {
  name: 'Sangrur',
  state: 'Punjab',
  centre: { lat: 30.2458, lon: 75.8421 },
  bbox: [75.45, 29.75, 76.25, 30.55],
  punjabBbox: [73.85, 29.5, 77.0, 32.55],
};
