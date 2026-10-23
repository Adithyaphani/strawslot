// OpenAPI 3.1 document generated from the route registry, so the docs cannot drift from the code.
import { zodToJsonSchema } from 'zod-to-json-schema';
import { registry } from './route.js';

export function buildOpenApi() {
  const paths: Record<string, any> = {};
  for (const r of registry) {
    const p = r.path.replace(/:([A-Za-z]+)/g, '{$1}');
    const params: any[] = [...(r.path.match(/:([A-Za-z]+)/g) || []).map((m) => ({ name: m.slice(1), in: 'path', required: true, schema: { type: 'string' } }))];
    if (r.query) {
      const js: any = zodToJsonSchema(r.query, { target: 'openApi3', $refStrategy: 'none' });
      for (const [name, schema] of Object.entries<any>(js.properties || {})) params.push({ name, in: 'query', required: (js.required || []).includes(name), schema });
    }
    const op: any = {
      tags: [r.tag], summary: r.summary, parameters: params,
      responses: { 200: { description: 'OK' }, 400: { description: 'Validation failed' }, 429: { description: 'Rate limited' }, ...Object.fromEntries(Object.entries(r.responses || {}).map(([k, v]) => [k, { description: v }])) },
    };
    if (r.body) op.requestBody = { required: true, content: { 'application/json': { schema: zodToJsonSchema(r.body, { target: 'openApi3', $refStrategy: 'none', effectStrategy: 'input' }) } } };
    if (r.auth && r.auth !== 'public') { op.security = [{ bearerAuth: [] }]; op.description = `Requires the **${r.auth}** role or higher.`; op.responses[401] = { description: 'Missing or invalid token' }; op.responses[403] = { description: 'Role not allowed' }; }
    (paths[p] ||= {})[r.method] = op;
  }
  return {
    openapi: '3.0.3',
    info: { title: 'StrawSlot API', version: '2.0.0', description: 'Deadline-aware scheduling of crop-residue machines. `/api/v1/*` is the versioned API; `/api/*` is an alias for the current version.' },
    servers: [{ url: '/api/v1' }],
    tags: ['System', 'Public', 'Farmer', 'Auth', 'Officer', 'Admin'].map((name) => ({ name })),
    paths,
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
  };
}

export const docsHtml = `<!doctype html><html><head><meta charset="utf-8"><title>StrawSlot API</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css"></head>
<body><div id="ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
<script>window.ui = SwaggerUIBundle({ url: '/openapi.json', dom_id: '#ui' });</script></body></html>`;
