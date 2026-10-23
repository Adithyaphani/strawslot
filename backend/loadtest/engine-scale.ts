// Measures raw scheduler time as the district grows. Fleet grows with the fields (same machines per field ratio).
import { buildSeed } from '../src/seed/generator.js';
import { runSchedule } from '../src/domain/engine.js';
const anchor = new Date().toISOString().slice(0, 10);
const base = buildSeed(anchor);
const opts = { today: anchor, rain: {}, fires: [] as any[] };
const rows: any[] = [];
for (const k of [1, 2, 4, 8]) {
  const s: any = structuredClone(base);
  const fields: any[] = [], machines: any[] = [];
  for (let i = 0; i < k; i++) {
    for (const f of base.fields) fields.push({ ...f, id: `${f.id}-${i}` });
    for (const m of base.machines) machines.push({ ...m, id: `${m.id}-${i}` });
  }
  s.fields = fields; s.machines = machines;
  runSchedule(s, opts); // warm JIT
  const times: number[] = [];
  for (let r = 0; r < 3; r++) { const t = performance.now(); runSchedule(s, opts); times.push(performance.now() - t); }
  rows.push({ fields: fields.length, machines: machines.length, medianMs: Math.round(times.sort((a, b) => a - b)[1]) });
}
console.table(rows); console.log(JSON.stringify(rows));
