// First-boot setup: the demo district and the initial users. Idempotent, safe on every start.
import { env, isProd } from '../config/env.js';
import { logger } from '../core/logger.js';
import { countUsers, createUser } from '../repositories/users.js';
import { districtExists, seedDistrict } from './seedDistrict.js';

export async function bootstrap() {
  if (!(await districtExists())) await seedDistrict();
  if ((await countUsers()) === 0) {
    const officerPw = env.BOOTSTRAP_OFFICER_PASSWORD ?? (isProd ? undefined : 'sangrur2026');
    const adminPw = env.BOOTSTRAP_ADMIN_PASSWORD ?? (isProd ? undefined : 'admin-sangrur-2026');
    if (!officerPw || !adminPw) throw new Error('Bootstrap passwords are required in production');
    await createUser({ username: env.BOOTSTRAP_OFFICER_USER ?? 'officer', displayName: 'District Nodal Officer', password: officerPw, role: 'officer', districtId: 'sangrur' });
    await createUser({ username: env.BOOTSTRAP_ADMIN_USER ?? 'admin', displayName: 'System Administrator', password: adminPw, role: 'admin', districtId: 'sangrur' });
    logger.info({ dev: !isProd }, 'bootstrap users created');
  }
}
