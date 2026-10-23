import { migrate } from '../db/migrate.js';
import { closePool } from '../db/pool.js';
import { bootstrap } from '../seed/bootstrap.js';
import { reseedFields } from '../seed/seedDistrict.js';
await migrate();
await bootstrap();
if (process.argv.includes('--reset')) console.log(`reseeded ${await reseedFields()} simulated fields`);
console.log('seed complete');
await closePool();
