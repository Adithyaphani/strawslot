import { migrate } from '../db/migrate.js';
import { closePool } from '../db/pool.js';
const applied = await migrate();
console.log(applied.length ? `applied: ${applied.join(', ')}` : 'already up to date');
await closePool();
