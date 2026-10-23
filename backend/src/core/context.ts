// Per-request context carried through async calls without passing it around by hand.
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext { requestId: string; actor?: string; districtId?: string }
export const als = new AsyncLocalStorage<RequestContext>();
export const ctx = () => als.getStore();
