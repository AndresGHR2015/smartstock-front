import { once } from 'node:events';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createViteServer } from 'vite';
import { expect, it, vi } from 'vitest';

it('forwards GraphQL to the configured Gateway and keeps internal routes private', async () => {
  const requests = [];
  const gateway = createHttpServer((request, response) => {
    requests.push([request.method, request.url]);
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ data: { product: { stock: 10 } } }));
  });
  let vite;

  try {
    gateway.listen(0, '127.0.0.1');
    await once(gateway, 'listening');
    vi.stubEnv('GATEWAY_HTTP_PORT', String(gateway.address().port));
    vite = await createViteServer({
      optimizeDeps: { noDiscovery: true, include: [] },
      server: { port: 0, hmr: false },
    });
    await vite.listen();
    const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;

    const response = await fetch(`${origin}/graphql?operationName=Product`, { method: 'POST' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { product: { stock: 10 } } });

    for (const path of ['/internal/purchases/requests', '/graphql-extra']) {
      const unproxied = await fetch(origin + path, { method: 'POST' });
      expect(unproxied.status).toBe(404);
    }
    expect(requests).toEqual([['POST', '/graphql?operationName=Product']]);
  } finally {
    vi.unstubAllEnvs();
    await Promise.all([
      vite?.close(),
      new Promise((resolve) => gateway.close(resolve)),
    ]);
  }
});
