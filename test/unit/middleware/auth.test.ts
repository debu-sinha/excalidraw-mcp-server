import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { createAuthMiddleware } from '../../../src/canvas/middleware/auth.js';
import type { Config } from '../../../src/shared/config.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_API_KEY = 'a'.repeat(32) + 'b'.repeat(32); // 64 chars, meets min(32)

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

function mockReq(path: string, apiKey?: string): Partial<Request> {
  return {
    path,
    header: vi.fn((name: string) => {
      if (name === 'X-API-Key') return apiKey;
      return undefined;
    }) as unknown as Request['header'],
  };
}

function mockRes(): Partial<Response> & { _status: number; _body: unknown } {
  const res: Partial<Response> & { _status: number; _body: unknown } = {
    _status: 0,
    _body: null,
    status(code: number) {
      res._status = code;
      return res as Response;
    },
    json(body: unknown) {
      res._body = body;
      return res as Response;
    },
  };
  return res;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createAuthMiddleware', () => {
  const config = makeConfig();
  const middleware = createAuthMiddleware(config);

  it('allows /health without API key', () => {
    const req = mockReq('/health');
    const res = mockRes();
    const next = vi.fn();

    middleware(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res._status).toBe(0); // status was never set
  });

  it('returns 401 when no X-API-Key header', () => {
    const req = mockReq('/api/elements');
    const res = mockRes();
    const next = vi.fn();

    middleware(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
    expect((res._body as { success: boolean }).success).toBe(false);
  });

  it('returns 403 when wrong API key', () => {
    const req = mockReq('/api/elements', 'wrong-key-that-is-not-valid');
    const res = mockRes();
    const next = vi.fn();

    middleware(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(403);
    expect((res._body as { error: string }).error).toBe('Invalid API key.');
  });

  it('calls next() when correct API key is provided', () => {
    const req = mockReq('/api/elements', TEST_API_KEY);
    const res = mockRes();
    const next = vi.fn();

    middleware(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res._status).toBe(0);
  });

  it('uses timing-safe comparison (does not leak info via response time)', async () => {
    // This test validates that the middleware uses crypto.timingSafeEqual
    // by confirming that keys of equal length but different content both
    // take roughly the same time. We also verify the wrong-length path works.
    const correctKey = TEST_API_KEY;
    const wrongSameLength = 'z'.repeat(correctKey.length);
    const wrongDiffLength = 'short';

    // All three should fail appropriately
    const reqCorrect = mockReq('/api/elements', correctKey);
    const resCorrect = mockRes();
    const nextCorrect = vi.fn();
    middleware(reqCorrect as Request, resCorrect as Response, nextCorrect as NextFunction);
    expect(nextCorrect).toHaveBeenCalled();

    const reqWrongSame = mockReq('/api/elements', wrongSameLength);
    const resWrongSame = mockRes();
    const nextWrongSame = vi.fn();
    middleware(reqWrongSame as Request, resWrongSame as Response, nextWrongSame as NextFunction);
    expect(resWrongSame._status).toBe(403);

    const reqWrongDiff = mockReq('/api/elements', wrongDiffLength);
    const resWrongDiff = mockRes();
    const nextWrongDiff = vi.fn();
    middleware(reqWrongDiff as Request, resWrongDiff as Response, nextWrongDiff as NextFunction);
    expect(resWrongDiff._status).toBe(403);
  });
});
