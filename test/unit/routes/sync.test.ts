import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import http from 'node:http';
import { createSyncRouter } from '../../../src/canvas/routes/sync.js';
import { MemoryStore } from '../../../src/canvas/store/memory-store.js';
import type { WsContext } from '../../../src/canvas/ws/handler.js';
import type { ServerElement } from '../../../src/shared/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeElement(overrides: Partial<ServerElement> = {}): ServerElement {
  return {
    id: overrides.id ?? 'el-1',
    type: 'rectangle',
    x: 0,
    y: 0,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    version: 1,
    ...overrides,
  };
}

function createStubWsContext(): WsContext {
  return {
    wss: {} as WsContext['wss'],
    clients: new Set(),
    broadcast: vi.fn(),
  };
}

let store: MemoryStore;
let wsContext: WsContext;
let server: http.Server;
let baseUrl: string;

function createTestApp(): express.Express {
  store = new MemoryStore();
  wsContext = createStubWsContext();
  const app = express();
  app.use(express.json({ limit: '512kb' }));
  app.use('/api/elements', createSyncRouter(store, wsContext));
  return app;
}

async function startServer(): Promise<void> {
  const app = createTestApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address();
  if (typeof addr === 'object' && addr !== null) {
    baseUrl = `http://127.0.0.1:${addr.port}`;
  }
}

async function stopServer(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Sync route', () => {
  beforeEach(async () => {
    await startServer();
  });

  afterEach(async () => {
    if (server) {
      await stopServer();
    }
  });

  // -----------------------------------------------------------------------
  // Successful sync
  // -----------------------------------------------------------------------

  it('clears existing elements and replaces with synced elements', async () => {
    // Pre-populate store
    await store.set('old-1', makeElement({ id: 'old-1' }));
    await store.set('old-2', makeElement({ id: 'old-2' }));
    expect(await store.count()).toBe(2);

    const res = await fetch(`${baseUrl}/api/elements/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        elements: [
          { id: 'new-1', type: 'rectangle', x: 10, y: 20 },
          { id: 'new-2', type: 'ellipse', x: 30, y: 40 },
          { id: 'new-3', type: 'text', x: 50, y: 60 },
        ],
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as {
      success: boolean;
      count: number;
      syncedAt: string;
      beforeCount: number;
      afterCount: number;
    };
    expect(body.success).toBe(true);
    expect(body.beforeCount).toBe(2);
    expect(body.afterCount).toBe(3);
    expect(body.count).toBe(3);
    expect(body.syncedAt).toBeDefined();

    // Old elements should be gone
    const old1 = await store.get('old-1');
    expect(old1).toBeUndefined();

    // New elements should exist
    const new1 = await store.get('new-1');
    expect(new1).toBeDefined();
    expect(new1!.type).toBe('rectangle');
    expect(new1!.x).toBe(10);
    expect(new1!.source).toBe('sync');
    expect(new1!.version).toBe(1);
  });

  it('generates IDs for elements without valid id', async () => {
    const res = await fetch(`${baseUrl}/api/elements/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        elements: [
          { type: 'rectangle', x: 0, y: 0 }, // no id
          { id: 123, type: 'ellipse', x: 10, y: 10 }, // non-string id
        ],
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; afterCount: number };
    expect(body.success).toBe(true);
    expect(body.afterCount).toBe(2);

    // Elements should exist with generated IDs
    const all = await store.getAll();
    expect(all).toHaveLength(2);
    for (const el of all) {
      expect(typeof el.id).toBe('string');
      expect(el.id.length).toBeGreaterThan(0);
    }
  });

  it('defaults type to rectangle and coordinates to 0 when missing', async () => {
    const res = await fetch(`${baseUrl}/api/elements/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        elements: [{ id: 'minimal' }],
      }),
    });

    expect(res.status).toBe(200);
    const el = await store.get('minimal');
    expect(el).toBeDefined();
    expect(el!.type).toBe('rectangle');
    expect(el!.x).toBe(0);
    expect(el!.y).toBe(0);
  });

  it('broadcasts sync_status via websocket after successful sync', async () => {
    const res = await fetch(`${baseUrl}/api/elements/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        elements: [{ id: 'ws-test', type: 'rectangle', x: 0, y: 0 }],
      }),
    });

    expect(res.status).toBe(200);
    expect(wsContext.broadcast).toHaveBeenCalledTimes(1);

    const broadcastCall = (wsContext.broadcast as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(broadcastCall.type).toBe('sync_status');
    expect(broadcastCall.elementCount).toBe(1);
    expect(broadcastCall.timestamp).toBeDefined();
  });

  it('handles sync with empty elements array (clears all)', async () => {
    await store.set('existing', makeElement({ id: 'existing' }));

    const res = await fetch(`${baseUrl}/api/elements/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ elements: [] }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as {
      success: boolean;
      beforeCount: number;
      afterCount: number;
    };
    expect(body.success).toBe(true);
    expect(body.beforeCount).toBe(1);
    expect(body.afterCount).toBe(0);

    expect(await store.count()).toBe(0);
  });

  it('preserves width and height from synced elements', async () => {
    const res = await fetch(`${baseUrl}/api/elements/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        elements: [
          { id: 'sized', type: 'rectangle', x: 10, y: 20, width: 300, height: 150 },
        ],
      }),
    });

    expect(res.status).toBe(200);
    const el = await store.get('sized');
    expect(el!.width).toBe(300);
    expect(el!.height).toBe(150);
  });

  // -----------------------------------------------------------------------
  // Validation errors
  // -----------------------------------------------------------------------

  it('returns 400 for missing elements field', async () => {
    const res = await fetch(`${baseUrl}/api/elements/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { success: boolean; error: string; details: unknown[] };
    expect(body.success).toBe(false);
    expect(body.error).toBe('Validation failed');
    expect(body.details).toBeDefined();
  });

  it('returns 400 for non-array elements field', async () => {
    const res = await fetch(`${baseUrl}/api/elements/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ elements: 'not-an-array' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toBe('Validation failed');
  });

  it('returns 400 for unknown extra fields (strict schema)', async () => {
    const res = await fetch(`${baseUrl}/api/elements/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        elements: [],
        extraField: true,
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
  });

  it('returns 400 when elements array exceeds max size', async () => {
    // Schema allows max 10,000 elements
    const oversized = Array.from({ length: 10_001 }, (_, i) => ({
      id: `el-${i}`,
      type: 'rectangle',
      x: 0,
      y: 0,
    }));

    const res = await fetch(`${baseUrl}/api/elements/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ elements: oversized }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
  });
});
