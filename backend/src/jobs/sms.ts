// SMS providers behind one interface. "console" logs the message, which is what the demo uses.
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from '../core/logger.js';

export interface SmsProvider { name: string; send(to: string, body: string, ref: string): Promise<string | undefined> }

const consoleProvider: SmsProvider = {
  name: 'console',
  async send(to, body, ref) { logger.info({ to: `${to.slice(0, 2)}xxxxxx${to.slice(-2)}`, ref, chars: body.length }, 'sms (console provider)'); return `console-${ref}`; },
};

const webhookProvider: SmsProvider = {
  name: 'webhook',
  async send(to, body, ref) {
    const payload = JSON.stringify({ to: `+91${to}`, body, ref });
    const sig = crypto.createHmac('sha256', env.SMS_WEBHOOK_SECRET || '').update(payload).digest('hex');
    const r = await fetch(env.SMS_WEBHOOK_URL!, { method: 'POST', headers: { 'content-type': 'application/json', 'x-strawslot-signature': sig, 'idempotency-key': ref }, body: payload, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`webhook HTTP ${r.status}`);
    return r.headers.get('x-message-id') || undefined;
  },
};

const twilioProvider: SmsProvider = {
  name: 'twilio',
  async send(to, body) {
    const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: 'POST', headers: { authorization: `Basic ${auth}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: `+91${to}`, From: env.TWILIO_FROM!, Body: body }), signal: AbortSignal.timeout(8000),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`twilio ${r.status}: ${j.message || 'error'}`);
    return j.sid;
  },
};

let override: SmsProvider | null = null;
export const setSmsProviderForTests = (p: SmsProvider | null) => { override = p; };
export const smsProvider = (): SmsProvider => override ?? (env.SMS_PROVIDER === 'webhook' ? webhookProvider : env.SMS_PROVIDER === 'twilio' ? twilioProvider : consoleProvider);
