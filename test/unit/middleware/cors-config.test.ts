import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { createCorsMiddleware } from '../../../src/canvas/middleware/cors-config.js';
import type { Config } from '../../../src/shared/config.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_API_KEY = 'a'.repeat(32) + 'b'.repeat(32);

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    CANVAS_HOST: '127.0.0.1',
    CANVAS_PORT: 3000,
    EXCALIDRAW_API_KEY: TEST_API_KEY,
    CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
    RATE_LIMIT_WINDOW_MS: 60000,
    RATE_LIMIT_MAX_REQUESTS: 100,
    PERSISTENCE_ENABLED: false,
    PERSISTENCE_DIR: './data',
    CANVAS_SERVER_URL: 'http://127.0.0.1:3000',
    LOG_LEVEL: 'error',
    AUDIT_LOG_ENABLED: false,
    MAX_ELEMENTS: 10000,
    MAX_BATCH_SIZE: 100,
    ...overrides,
  };
}

function mockReq(origin?: string): Partial<Request> {
  const headers: Record<string, string> = {};
  if (origin) headers['origin'] = origin;

  return {
    method: 'GET',
    headers,
    header: vi.fn((name: string) => {
      return headers[name.toLowerCase()];
    }) as unknown as Request['header'],
  };
}

function mockRes(): Partial<Response> & {
  _headers: Record<string, string | undefined>;
  _status: number;
} {
  const res: Partial<Response> & {
    _headers: Record<string, string | undefined>;
    _status: number;
  } = {
    _headers: {},
    _status: 200,
    statusCode: 200,
    setHeader(name: string, value: string) {
      res._headers[name.toLowerCase()] = value;
      return res as Response;
    },
    getHeader(name: string) {
      return res._headers[name.toLowerCase()];
    },
    status(code: number) {
      res._status = code;
      res.statusCode = code;
      return res as Response;
    },
    end() {
      return res as Response;
    },
  } as any;
  return res;
}

/**
 * Runs the cors middleware and returns a promise that resolves when
 * next() is called. If next() receives an error, the promise resolves
 * with that error (not rejected, so we can inspect it).
 */
function runCors(
  middleware: ReturnType<typeof createCorsMiddleware>,
  origin?: string,
): Promise<{ error?: Error }> {
  return new Promise((resolve) => {
    const req = mockReq(origin);
    const res = mockRes();
    middleware(req as Request, res as Response, ((err?: unknown) => {
      resolve({ error: err as Error | undefined });
    }) as NextFunction);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createCorsMiddleware', () => {
  it('allows requests with no origin (e.g. same-origin, curl)', async () => {
    const middleware = createCorsMiddleware(makeConfig());
    const { error } = await runCors(middleware); // no origin
    expect(error).toBeUndefined();
  });

  it('allows a request from an allowed origin', async () => {
    const middleware = createCorsMiddleware(
      makeConfig({ CORS_ALLOWED_ORIGINS: 'http://localhost:3000' }),
    );
    const { error } = await runCors(middleware, 'http://localhost:3000');
    expect(error).toBeUndefined();
  });

  it('blocks a request from a disallowed origin', async () => {
    const middleware = createCorsMiddleware(
      makeConfig({ CORS_ALLOWED_ORIGINS: 'http://localhost:3000' }),
    );
    const { error } = await runCors(middleware, 'http://evil.com');
    expect(error).toBeDefined();
    expect(error!.message).toContain('not allowed by CORS');
  });

  it('allows any of multiple comma-separated origins', async () => {
    const origins = 'http://localhost:3000,http://127.0.0.1:3000,https://app.example.com';
    const middleware = createCorsMiddleware(
      makeConfig({ CORS_ALLOWED_ORIGINS: origins }),
    );
    const { error } = await runCors(middleware, 'https://app.example.com');
    expect(error).toBeUndefined();
  });

  it('trims whitespace around origin entries', async () => {
    const origins = ' http://localhost:3000 , http://127.0.0.1:3000 ';
    const middleware = createCorsMiddleware(
      makeConfig({ CORS_ALLOWED_ORIGINS: origins }),
    );
    const { error } = await runCors(middleware, 'http://127.0.0.1:3000');
    expect(error).toBeUndefined();
  });

  it('filters out empty entries from trailing commas', async () => {
    const origins = 'http://localhost:3000,,';
    const middleware = createCorsMiddleware(
      makeConfig({ CORS_ALLOWED_ORIGINS: origins }),
    );
    const { error } = await runCors(middleware, 'http://localhost:3000');
    expect(error).toBeUndefined();
  });

  it('blocks origin that is a substring of an allowed one but not exact match', async () => {
    const middleware = createCorsMiddleware(
      makeConfig({ CORS_ALLOWED_ORIGINS: 'http://localhost:3000' }),
    );
    const { error } = await runCors(middleware, 'http://localhost:300');
    expect(error).toBeDefined();
    expect(error!.message).toContain('not allowed by CORS');
  });

  it('blocks origin with different protocol', async () => {
    const middleware = createCorsMiddleware(
      makeConfig({ CORS_ALLOWED_ORIGINS: 'http://localhost:3000' }),
    );
    const { error } = await runCors(middleware, 'https://localhost:3000');
    expect(error).toBeDefined();
    expect(error!.message).toContain('not allowed by CORS');
  });

  it('includes the rejected origin in the error message', async () => {
    const middleware = createCorsMiddleware(
      makeConfig({ CORS_ALLOWED_ORIGINS: 'http://localhost:3000' }),
    );
    const { error } = await runCors(middleware, 'http://attacker.com');
    expect(error!.message).toContain('http://attacker.com');
  });

  it('handles a single origin in CORS_ALLOWED_ORIGINS', async () => {
    const middleware = createCorsMiddleware(
      makeConfig({ CORS_ALLOWED_ORIGINS: 'https://only-one.com' }),
    );
    const { error } = await runCors(middleware, 'https://only-one.com');
    expect(error).toBeUndefined();
  });
});
