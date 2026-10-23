import { AppError, conflict, notFound } from '../../core/errors.js';
import { pool, tx } from '../../db/pool.js';
import { audit } from '../../repositories/ops.js';
import * as users from '../../repositories/users.js';
import { revokeAllForUser } from '../../repositories/tokens.js';
import { define } from '../route.js';
import { CreateUserSchema, UpdateUserSchema } from '../schemas.js';

define({ method: 'get', path: '/admin/users', tag: 'Admin', summary: 'List users in the district', auth: 'admin', handler: async (c) => ({ users: (await users.listUsers(c.districtId)).map(users.publicUser) }) });
define({ method: 'post', path: '/admin/users', tag: 'Admin', summary: 'Create a user', auth: 'admin', body: CreateUserSchema,
  handler: async (c) => {
    if (await users.findByUsername(c.body.username)) throw conflict('That username is taken');
    const u = await users.createUser({ ...c.body, districtId: c.districtId });
    await audit(pool, c.districtId, c.user!.username, 'user_create', `${u.username} (${u.role})`);
    c.res.status(201); return { user: users.publicUser(u) };
  } });
define({ method: 'patch', path: '/admin/users/:id', tag: 'Admin', summary: 'Change role, display name, password or disable a user', auth: 'admin', body: UpdateUserSchema,
  handler: async (c) => {
    const target = await users.findById(c.params.id);
    if (!target || target.districtId !== c.districtId) throw notFound('User not found');
    if (target.id === c.user!.sub && (c.body.active === false || (c.body.role && c.body.role !== 'admin'))) throw new AppError(400, 'bad_request', 'You cannot disable or demote your own account');
    const u = await users.updateUser(target.id, c.body);
    if (c.body.active === false || c.body.password) await revokeAllForUser(target.id); // sign them out everywhere
    await audit(pool, c.districtId, c.user!.username, 'user_update', `${target.username}: ${Object.keys(c.body).join(', ')}`);
    return { user: users.publicUser(u!) };
  } });
void tx;
