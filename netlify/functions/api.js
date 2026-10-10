// Netlify Function entry: wraps the Express app.
import serverless from 'serverless-http';
import { connectLambda } from '@netlify/blobs';
import { createApp } from '../../server/app.js';

// Read lazily by the store on first request, so setting it here is enough.
process.env.STRAWSLOT_RUNTIME = 'netlify';

const app = serverless(createApp());

export async function handler(event, context) {
  try { connectLambda(event); } catch { /* not running on Netlify */ }
  return app(event, context);
}
