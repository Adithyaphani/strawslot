import crypto from 'node:crypto';
import { one, query, tx } from '../db/pool.js';

export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
export const newOpaqueToken = () => crypto.randomBytes(32).toString('base64url');

export async function issueRefresh(userId: string, ttlDays: number, meta: { ip?: string; ua?: string }, familyId?: string) {
  const token = newOpaqueToken();
  const row = await one<{ id: string; family_id: string }>(
    `insert into refresh_tokens (user_id, family_id, token_hash, expires_at, ip, user_agent)
     values ($1, coalesce($2::uuid, gen_random_uuid()), $3, now() + make_interval(days => $4), $5, $6) returning id, family_id`,
    [userId, familyId ?? null, sha256(token), ttlDays, meta.ip ?? null, (meta.ua ?? '').slice(0, 200)]);
  return { token, id: row!.id, familyId: row!.family_id };
}

export interface RotateResult { ok: boolean; reason?: 'unknown' | 'expired' | 'reused'; userId?: string; familyId?: string; oldId?: string }

/**
 * Rotation with reuse detection: a refresh token works once. If an already-used token shows up again,
 * somebody copied it, so the whole family (every token from that login) is revoked.
 */
export async function consumeRefresh(token: string): Promise<RotateResult> {
  return tx(async (c) => {
    const r = await one<any>('select * from refresh_tokens where token_hash = $1 for update', [sha256(token)], c);
    if (!r) return { ok: false, reason: 'unknown' };
    if (r.revoked_at) {
      await query('update refresh_tokens set revoked_at = coalesce(revoked_at, now()) where family_id = $1', [r.family_id], c);
      return { ok: false, reason: 'reused' };
    }
    if (r.expires_at < new Date()) return { ok: false, reason: 'expired' };
    await query('update refresh_tokens set revoked_at = now() where id = $1', [r.id], c);
    return { ok: true, userId: r.user_id, familyId: r.family_id, oldId: r.id };
  });
}
export const linkReplacement = (oldId: string, newId: string) => query('update refresh_tokens set replaced_by = $2 where id = $1', [oldId, newId]);
export const revokeFamilyByToken = async (token: string) => {
  const r = await one<{ family_id: string }>('select family_id from refresh_tokens where token_hash = $1', [sha256(token)]);
  if (r) await query('update refresh_tokens set revoked_at = coalesce(revoked_at, now()) where family_id = $1', [r.family_id]);
};
export const revokeAllForUser = (userId: string) => query('update refresh_tokens set revoked_at = coalesce(revoked_at, now()) where user_id = $1', [userId]);
