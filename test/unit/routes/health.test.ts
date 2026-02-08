import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'node:http';
import { createHealthRouter } from '../../../src/canvas/routes/health.js';

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

let server: http.Server;
let baseUrl: string;

function createTestApp(): express.Express {
  const app = express();
  app.use(createHealthRouter());
  return app;
}

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

describe('Health route', () => {
  it('GET /health returns 200 with status ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);

    const body = await res.json() as { status: string; timestamp: string };
    expect(body.status).toBe('ok');
  });

  it('GET /health returns a valid ISO timestamp', async () => {
    const before = new Date().toISOString();
    const res = await fetch(`${baseUrl}/health`);
    const after = new Date().toISOString();

    const body = await res.json() as { status: string; timestamp: string };
    expect(body.timestamp).toBeDefined();

    // Validate it's a parseable ISO date
    const ts = new Date(body.timestamp);
    expect(ts.toISOString()).toBe(body.timestamp);

    // Timestamp should be between before and after
    expect(ts.getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
    expect(ts.getTime()).toBeLessThanOrEqual(new Date(after).getTime());
  });

  it('GET /health returns JSON content type', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('POST /health returns 404 (only GET is defined)', async () => {
    const res = await fetch(`${baseUrl}/health`, { method: 'POST' });
    // Express returns 404 for undefined route methods on a router
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('GET /other-path returns 404', async () => {
    const res = await fetch(`${baseUrl}/other-path`);
    expect(res.status).toBe(404);
  });
});
