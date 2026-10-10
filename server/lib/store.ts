// Storage adapter: Netlify Blobs in production, a JSON file locally,
// in-memory as the last resort. The whole state is one small JSON document.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSeed } from '../data/seed.js';
import { todayIST, diffDays } from './dates.js';
import type { State } from '../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_FILE = path.join(__dirname, '..', 'data', 'local-state.json');
const KEY = 'state-v1';
const RESEED_AFTER_DAYS = 10;

type Backend = { kind: string; get: () => Promise<State | null>; set: (v: State) => Promise<unknown> };
let memory: State | null = null;
let blobStore: Backend | null = null;

async function backend(): Promise<Backend> {
  if (blobStore !== null) return blobStore;
  const onNetlify = process.env.STRAWSLOT_RUNTIME === 'netlify' || process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT || process.env.AWS_LAMBDA_FUNCTION_NAME;
  if (onNetlify) {
    try {
      const { getStore } = await import('@netlify/blobs');
      const store = getStore({ name: 'strawslot', consistency: 'strong' });
      blobStore = {
        kind: 'netlify-blobs',
        get: () => store.get(KEY, { type: 'json' }),
        set: (v) => store.setJSON(KEY, v),
      };
      return blobStore;
    } catch (e) {
      console.warn('[store] Netlify Blobs unavailable, using memory:', e.message);
    }
  }
  if (onNetlify || process.env.STRAWSLOT_STORE === 'memory') {
    blobStore = { kind: 'memory', get: async () => memory, set: async (v) => { memory = v; } };
    return blobStore;
  }
  blobStore = {
    kind: 'file',
    get: async () => {
      if (memory) return memory;
      try { memory = JSON.parse(await fs.readFile(LOCAL_FILE, 'utf8')); } catch { memory = null; }
      return memory;
    },
    set: async (v) => { memory = v; await fs.writeFile(LOCAL_FILE, JSON.stringify(v)); },
  };
  return blobStore;
}

export function freshState(today = todayIST()): State {
  return buildSeed(today);
}

// Keep the demo season "live": if the seeded season is stale, regenerate seeded
// fields around today while keeping everything real users added.
function refreshIfStale(state: State, today: string): State | null {
  if (diffDays(today, state.meta.anchor) <= RESEED_AFTER_DAYS) return null;
  const next = buildSeed(today);
  const userFields = state.fields.filter((f) => f.source !== 'seed');
  next.fields.push(...userFields);
  next.issues = state.issues || [];
  next.log = [...(state.log || []).slice(-200), { at: new Date().toISOString(), actor: 'system', action: 'reseed', detail: `Demo season refreshed around ${today}` }];
  return next;
}

export async function loadState(): Promise<State> {
  const b = await backend();
  let state: State | null = null;
  try { state = await b.get(); } catch (e) { console.warn('[store] read failed:', e.message); }
  const today = todayIST();
  if (!state) {
    state = freshState(today);
    await saveState(state);
  } else {
    const refreshed = refreshIfStale(state, today);
    if (refreshed) { state = refreshed; await saveState(state); }
  }
  return state;
}

export async function saveState(state: State) {
  const b = await backend();
  try { await b.set(state); } catch (e) { console.warn('[store] write failed:', e.message); memory = state; }
}

export async function storeKind() { return (await backend()).kind; }

export function logEvent(state: State, actor: string, action: string, detail: string) {
  state.log = state.log || [];
  state.log.push({ at: new Date().toISOString(), actor, action, detail });
  if (state.log.length > 300) state.log = state.log.slice(-300);
}
