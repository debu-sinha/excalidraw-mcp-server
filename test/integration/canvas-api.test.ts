import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import express from 'express';
import { createAuthMiddleware } from '../../src/canvas/middleware/auth.js';
import { createElementsRouter } from '../../src/canvas/routes/elements.js';
import { MemoryStore } from '../../src/canvas/store/memory-store.js';
import type { Config } from '../../src/shared/config.js';
import type { WsContext } from '../../src/canvas/ws/handler.js';
import type { ServerElement } from '../../src/shared/types.js';

// ---------------------------------------------------------------------------
// Test configuration
// ---------------------------------------------------------------------------

const TEST_API_KEY = 'test-key-' + 'x'.repeat(56); // 64 chars total, meets min(32)

function makeConfig(): Config {
  return {
    CANVAS_HOST: '127.0.0.1',
    CANVAS_PORT: 0, // will be assigned dynamically
    EXCALIDRAW_API_KEY: TEST_API_KEY,
    CORS_ALLOWED_ORIGINS: '*',
    RATE_LIMIT_WINDOW_MS: 60000,
    RATE_LIMIT_MAX_REQUESTS: 1000,
    PERSISTENCE_ENABLED: false,
    PERSISTENCE_DIR: './data',
    CANVAS_SERVER_URL: 'http://127.0.0.1:0',
    LOG_LEVEL: 'error',
    AUDIT_LOG_ENABLED: false,
    MAX_ELEMENTS: 10000,
    MAX_BATCH_SIZE: 100,
  };
}

/** Stub WsContext - we don't need real WebSocket for REST integration tests. */
function createStubWsContext(): WsContext {
  return {
    wss: {} as WsContext['wss'],
    clients: new Set(),
    broadcast: () => {},
  };
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

let server: http.Server;
let baseUrl: string;
let store: MemoryStore;

function createTestApp(): express.Express {
  const config = makeConfig();
  store = new MemoryStore();
  const wsContext = createStubWsContext();

  const app = express();
  app.use(express.json({ limit: '512kb' }));
  app.use(createAuthMiddleware(config));

  // Health endpoint (bypassed by auth middleware via path check)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/elements', createElementsRouter(store, wsContext));

  return app;
}

function authedHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-API-Key': TEST_API_KEY,
  };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  const app = createTestApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address();
  if (typeof addr === 'object' && addr !== null) {
    baseUrl = `http://127.0.0.1:${addr.port}`;
  }
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Canvas API integration', () => {
  // -----------------------------------------------------------------------
  // Auth
  // -----------------------------------------------------------------------

  it('GET /health succeeds without API key', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  it('GET /api/elements returns 401 without API key', async () => {
    const res = await fetch(`${baseUrl}/api/elements`);
    expect(res.status).toBe(401);
  });

  it('GET /api/elements returns 403 with wrong API key', async () => {
    const res = await fetch(`${baseUrl}/api/elements`, {
      headers: { 'X-API-Key': 'wrong-key' },
    });
    expect(res.status).toBe(403);
  });

  // -----------------------------------------------------------------------
  // Full CRUD flow
  // -----------------------------------------------------------------------

  it('full flow: create -> get -> update -> verify -> delete -> 404', async () => {
    // 1. CREATE
    const createRes = await fetch(`${baseUrl}/api/elements`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({
        type: 'rectangle',
        x: 10,
        y: 20,
        width: 100,
        height: 50,
      }),
    });
    expect(createRes.status).toBe(201);
    const createBody = await createRes.json() as { success: boolean; element: ServerElement };
    expect(createBody.success).toBe(true);
    const elementId = createBody.element.id;
    expect(typeof elementId).toBe('string');
    expect(createBody.element.type).toBe('rectangle');
    expect(createBody.element.x).toBe(10);

    // 2. GET by id
    const getRes = await fetch(`${baseUrl}/api/elements/${elementId}`, {
      headers: authedHeaders(),
    });
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json() as { success: boolean; element: ServerElement };
    expect(getBody.element.id).toBe(elementId);
    expect(getBody.element.width).toBe(100);

    // 3. UPDATE (PUT)
    const updateRes = await fetch(`${baseUrl}/api/elements/${elementId}`, {
      method: 'PUT',
      headers: authedHeaders(),
      body: JSON.stringify({ x: 999, width: 200 }),
    });
    expect(updateRes.status).toBe(200);
    const updateBody = await updateRes.json() as { success: boolean; element: ServerElement };
    expect(updateBody.element.x).toBe(999);
    expect(updateBody.element.width).toBe(200);
    expect(updateBody.element.version).toBe(2);

    // 4. Verify update via GET
    const verifyRes = await fetch(`${baseUrl}/api/elements/${elementId}`, {
      headers: authedHeaders(),
    });
    const verifyBody = await verifyRes.json() as { success: boolean; element: ServerElement };
    expect(verifyBody.element.x).toBe(999);

    // 5. DELETE
    const deleteRes = await fetch(`${baseUrl}/api/elements/${elementId}`, {
      method: 'DELETE',
      headers: authedHeaders(),
    });
    expect(deleteRes.status).toBe(200);
    const deleteBody = await deleteRes.json() as { success: boolean };
    expect(deleteBody.success).toBe(true);

    // 6. GET after delete returns 404
    const notFoundRes = await fetch(`${baseUrl}/api/elements/${elementId}`, {
      headers: authedHeaders(),
    });
    expect(notFoundRes.status).toBe(404);
  });

  // -----------------------------------------------------------------------
  // Validation: prototype pollution
  // -----------------------------------------------------------------------

  it('POST with __proto__ key returns 400', async () => {
    const body = JSON.stringify({
      type: 'rectangle',
      x: 10,
      y: 20,
      __proto__: { admin: true },
    });
    // JSON.stringify won't include __proto__ as a regular property.
    // We need to build the raw JSON string manually.
    const rawJson = '{"type":"rectangle","x":10,"y":20,"__proto__":{"admin":true}}';

    const res = await fetch(`${baseUrl}/api/elements`, {
      method: 'POST',
      headers: authedHeaders(),
      body: rawJson,
    });
    expect(res.status).toBe(400);
    const resBody = await res.json() as { success: boolean; error: string };
    expect(resBody.success).toBe(false);
  });

  it('POST with constructor key returns 400', async () => {
    const rawJson = '{"type":"rectangle","x":10,"y":20,"constructor":{"prototype":{}}}';

    const res = await fetch(`${baseUrl}/api/elements`, {
      method: 'POST',
      headers: authedHeaders(),
      body: rawJson,
    });
    expect(res.status).toBe(400);
  });

  // -----------------------------------------------------------------------
  // Batch create
  // -----------------------------------------------------------------------

  it('POST /api/elements/batch creates multiple elements', async () => {
    // Clear store first
    await store.clear();

    const elements = [
      { type: 'rectangle', x: 0, y: 0, width: 50, height: 50 },
      { type: 'ellipse', x: 100, y: 100, width: 80, height: 80 },
      { type: 'text', x: 200, y: 200, text: 'Hello' },
    ];

    const res = await fetch(`${baseUrl}/api/elements/batch`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ elements }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { success: boolean; elements: ServerElement[]; count: number };
    expect(body.success).toBe(true);
    expect(body.count).toBe(3);
    expect(body.elements).toHaveLength(3);

    // Verify they exist in the store
    const allCount = await store.count();
    expect(allCount).toBe(3);
  });

  // -----------------------------------------------------------------------
  // Search
  // -----------------------------------------------------------------------

  it('GET /api/elements/search?type=rectangle returns only rectangles', async () => {
    // Store already has elements from batch test above
    const res = await fetch(`${baseUrl}/api/elements/search?type=rectangle`, {
      headers: authedHeaders(),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; elements: ServerElement[]; count: number };
    expect(body.success).toBe(true);
    expect(body.elements.length).toBeGreaterThanOrEqual(1);
    expect(body.elements.every((e: ServerElement) => e.type === 'rectangle')).toBe(true);
  });

  it('GET /api/elements/search?type=diamond returns empty when none exist', async () => {
    const res = await fetch(`${baseUrl}/api/elements/search?type=diamond`, {
      headers: authedHeaders(),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; elements: ServerElement[]; count: number };
    expect(body.elements).toHaveLength(0);
    expect(body.count).toBe(0);
  });
});
