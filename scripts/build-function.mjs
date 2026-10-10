// Pre-bundles the Netlify Function into one self-contained ES module.
// Netlify's own bundler emits ESM for "type": "module" projects, which breaks
// CommonJS dependencies (serverless-http, express) with "Dynamic require of
// 'http' is not supported" -> HTTP 502. The createRequire banner fixes that.
import { build } from 'esbuild';

await build({
  entryPoints: ['netlify/src/api.ts'],
  outfile: 'netlify/functions/api.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  minify: false,
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
  logLevel: 'info',
});
