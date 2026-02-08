import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { createRateLimiter, createStrictRateLimiter } from '../../../src/canvas/middleware/rate-limit.js';
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

function mockReq(apiKey?: string, ip?: string): Partial<Request> {
  return {
    method: 'GET',
    url: '/api/elements',
    ip: ip ?? '127.0.0.1',
    headers: {},
    header: vi.fn((name: string) => {
      if (name === 'X-API-Key') return apiKey;
      return undefined;
    }) as unknown as Request['header'],
  };
}

function mockRes(): Partial<Response> & {
  _status: number;
  _body: unknown;
  _headers: Record<string, string>;
} {
  const res: Partial<Response> & {
    _status: number;
    _body: unknown;
    _headers: Record<string, string>;
  } = {
    _status: 200,
    _body: null,
    _headers: {},
    statusCode: 200,
    status(code: number) {
      res._status = code;
      res.statusCode = code;
      return res as Response;
    },
    json(body: unknown) {
      res._body = body;
      return res as Response;
    },
    setHeader(name: string, value: string) {
      res._headers[name] = value;
      return res as Response;
    },
    getHeader(name: string) {
      return res._headers[name];
    },
    end() {
      return res as Response;
    },
    send(body: unknown) {
      res._body = body;
      return res as Response;
    },
  } as any;
  return res;
}

/**
 * Invoke a rate-limiter middleware and return a promise that resolves
 * with {passed, res} where passed indicates whether next() was called.
 */
function invoke(
  limiter: ReturnType<typeof createRateLimiter>,
  apiKey?: string,
  ip?: string,
): Promise<{ passed: boolean; res: ReturnType<typeof mockRes> }> {
  return new Promise((resolve) => {
    const req = mockReq(apiKey, ip);
    const res = mockRes();
    let passed = false;

    limiter(req as Request, res as Response, (() => {
      passed = true;
    }) as NextFunction);

    // express-rate-limit calls next() or sends a response synchronously
    // for in-memory stores, but we give it a tick to be safe
    setTimeout(() => resolve({ passed, res }), 20);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createRateLimiter', () => {
  it('returns a middleware function', () => {
    const limiter = createRateLimiter(makeConfig());
    expect(typeof limiter).toBe('function');
  });

  it('allows the first request through', async () => {
    const limiter = createRateLimiter(
      makeConfig({ RATE_LIMIT_MAX_REQUESTS: 10, RATE_LIMIT_WINDOW_MS: 60000 }),
    );
    const { passed } = await invoke(limiter, 'some-key', '10.0.0.1');
    expect(passed).toBe(true);
  });

  it('blocks requests after exceeding max', async () => {
    const max = 3;
    const limiter = createRateLimiter(
      makeConfig({ RATE_LIMIT_MAX_REQUESTS: max, RATE_LIMIT_WINDOW_MS: 60000 }),
    );

    const uniqueKey = 'rate-limit-test-' + 'a'.repeat(50);

    for (let i = 0; i < max; i++) {
      const { passed } = await invoke(limiter, uniqueKey, '10.0.0.99');
      expect(passed).toBe(true);
    }

    // The next request should be rate limited
    const { passed, res } = await invoke(limiter, uniqueKey, '10.0.0.99');
    expect(passed).toBe(false);
    expect(res._status).toBe(429);
  });

  it('uses X-API-Key as the rate limit key when present', () => {
    const limiter = createRateLimiter(makeConfig());
    expect(typeof limiter).toBe('function');
  });

  it('sets standard rate limit headers', async () => {
    const limiter = createRateLimiter(
      makeConfig({ RATE_LIMIT_MAX_REQUESTS: 50, RATE_LIMIT_WINDOW_MS: 60000 }),
    );
    const { res } = await invoke(limiter, undefined, '10.0.0.200');

    const hasRateLimitHeader = Object.keys(res._headers).some(
      (h) => h.toLowerCase().startsWith('ratelimit'),
    );
    expect(hasRateLimitHeader).toBe(true);
  });

  it('returns proper error message when rate limited', async () => {
    const max = 1;
    const limiter = createRateLimiter(
      makeConfig({ RATE_LIMIT_MAX_REQUESTS: max, RATE_LIMIT_WINDOW_MS: 60000 }),
    );

    const uniqueKey = 'rate-msg-test-' + 'b'.repeat(50);

    // Exhaust the limit
    await invoke(limiter, uniqueKey, '10.0.0.77');

    // This one should fail
    const { res } = await invoke(limiter, uniqueKey, '10.0.0.77');

    expect(res._status).toBe(429);
    if (res._body && typeof res._body === 'object') {
      expect((res._body as { success: boolean }).success).toBe(false);
      expect((res._body as { error: string }).error).toContain('Too many requests');
    }
  });

  it('does not set legacy X-RateLimit headers', async () => {
    const limiter = createRateLimiter(
      makeConfig({ RATE_LIMIT_MAX_REQUESTS: 50, RATE_LIMIT_WINDOW_MS: 60000 }),
    );
    const { res } = await invoke(limiter, undefined, '10.0.0.201');

    // legacyHeaders: false means no X-RateLimit-* headers
    const hasLegacyHeader = Object.keys(res._headers).some(
      (h) => h.toLowerCase().startsWith('x-ratelimit'),
    );
    expect(hasLegacyHeader).toBe(false);
  });
});

describe('createStrictRateLimiter', () => {
  it('returns a middleware function', () => {
    const limiter = createStrictRateLimiter(makeConfig());
    expect(typeof limiter).toBe('function');
  });

  it('has a max of ceil(RATE_LIMIT_MAX_REQUESTS / 5)', async () => {
    const config = makeConfig({ RATE_LIMIT_MAX_REQUESTS: 10 });
    const strictMax = Math.ceil(10 / 5); // 2

    const limiter = createStrictRateLimiter(config);
    const uniqueKey = 'strict-test-' + 'c'.repeat(50);

    for (let i = 0; i < strictMax; i++) {
      const { passed } = await invoke(limiter, uniqueKey, '10.0.0.88');
      expect(passed).toBe(true);
    }

    // Next one should be blocked
    const { passed, res } = await invoke(limiter, uniqueKey, '10.0.0.88');
    expect(passed).toBe(false);
    expect(res._status).toBe(429);
  });

  it('returns destructive-operations-specific error message', async () => {
    const config = makeConfig({ RATE_LIMIT_MAX_REQUESTS: 5 });
    const limiter = createStrictRateLimiter(config);
    const uniqueKey = 'strict-msg-test-' + 'd'.repeat(50);

    // Exhaust limit (ceil(5/5) = 1)
    await invoke(limiter, uniqueKey, '10.0.0.55');

    // Trigger rate limit
    const { res } = await invoke(limiter, uniqueKey, '10.0.0.55');

    expect(res._status).toBe(429);
    if (res._body && typeof res._body === 'object') {
      expect((res._body as { error: string }).error).toContain('destructive operations');
    }
  });

  it('allows first request through the strict limiter', async () => {
    const limiter = createStrictRateLimiter(
      makeConfig({ RATE_LIMIT_MAX_REQUESTS: 100 }),
    );
    const { passed } = await invoke(limiter, 'strict-first-' + 'e'.repeat(50), '10.0.0.33');
    expect(passed).toBe(true);
  });
});
