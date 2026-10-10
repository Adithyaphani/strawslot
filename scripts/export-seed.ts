// Writes the demo dataset to data/ as JSON + CSV so judges can inspect it.
import fs from 'node:fs';
import { buildSeed } from '../server/data/seed.js';
import { todayIST } from '../server/lib/dates.js';

const s = buildSeed(process.argv[2] || todayIST());
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/demo-dataset.json', JSON.stringify(s, null, 2));
const cols = ['id', 'farmerName', 'phone', 'villageId', 'lat', 'lon', 'acres', 'harvestDate', 'windowDays', 'preference', 'tractorOwns', 'tractorHp', 'status'];
const rows = s.fields.map((f) => [f.id, f.farmerName, f.phone, f.villageId, f.lat, f.lon, f.acres, f.harvestDate, f.windowDays, f.preference, f.tractor.owns, f.tractor.hp, f.status]);
fs.writeFileSync('data/demo-fields.csv', [cols, ...rows].map((r) => r.join(',')).join('\n'));
console.log(`Exported ${s.fields.length} fields, ${s.machines.length} machines, ${s.chcs.length} CHCs (anchor ${s.meta.anchor})`);
