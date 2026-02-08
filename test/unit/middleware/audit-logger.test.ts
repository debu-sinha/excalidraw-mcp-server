import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'node:events';
import type { Config } from '../../../src/shared/config.js';

// ---------------------------------------------------------------------------
// Mock the logger using vi.hoisted so the mock fn is available when
// vi.mock (which is hoisted) runs.
// ---------------------------------------------------------------------------

const { mockLoggerInfo } = vi.hoisted(() => {
  return { mockLoggerInfo: vi.fn() };
});

vi.mock('../../../src/shared/logger.js', () => ({
  createLogger: () => ({
    info: mockLoggerInfo,
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Import after mock setup
import { createAuditLogger } from '../../../src/canvas/middleware/audit-logger.js';

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
    AUDIT_LOG_ENABLED: true,
    MAX_ELEMENTS: 10000,
    MAX_BATCH_SIZE: 100,
    ...overrides,
  };
}

function mockReq(
  method: string,
  path: string,
  apiKey?: string,
): Partial<Request> {
  return {
    method,
    path,
    header: vi.fn((name: string) => {
      if (name === 'X-API-Key') return apiKey;
      return undefined;
    }) as unknown as Request['header'],
  };
}

/**
 * Create a mock response that extends EventEmitter so we can test
 * the 'finish' event handler that the audit logger registers.
 */
function mockRes(statusCode = 200): Response & EventEmitter {
  const emitter = new EventEmitter();
  const res = Object.assign(emitter, {
    statusCode,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      return res;
    },
    send(body: unknown) {
      return res;
    },
  });
  return res as unknown as Response & EventEmitter;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockLoggerInfo.mockClear();
});

describe('createAuditLogger', () => {
  it('returns a middleware function', () => {
    const mw = createAuditLogger(makeConfig());
    expect(typeof mw).toBe('function');
  });

  it('calls next() immediately', () => {
    const mw = createAuditLogger(makeConfig());
    const req = mockReq('GET', '/api/elements');
    const res = mockRes();
    const next = vi.fn();

    mw(req as Request, res as unknown as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('logs request details on response finish', () => {
    const mw = createAuditLogger(makeConfig());
    const req = mockReq('POST', '/api/elements', TEST_API_KEY);
    const res = mockRes(201);
    const next = vi.fn();

    mw(req as Request, res as unknown as Response, next as NextFunction);

    // Simulate response finishing
    res.emit('finish');

    expect(mockLoggerInfo).toHaveBeenCalledTimes(1);
    const logEntry = mockLoggerInfo.mock.calls[0][0];
    expect(logEntry.method).toBe('POST');
    expect(logEntry.path).toBe('/api/elements');
    expect(logEntry.status).toBe(201);
    expect(logEntry.authenticated).toBe(true);
    expect(typeof logEntry.duration).toBe('number');
  });

  it('records authenticated=false when no API key header', () => {
    const mw = createAuditLogger(makeConfig());
    const req = mockReq('GET', '/health'); // no API key
    const res = mockRes(200);
    const next = vi.fn();

    mw(req as Request, res as unknown as Response, next as NextFunction);
    res.emit('finish');

    expect(mockLoggerInfo).toHaveBeenCalledTimes(1);
    const logEntry = mockLoggerInfo.mock.calls[0][0];
    expect(logEntry.authenticated).toBe(false);
  });

  it('records the correct status code', () => {
    const mw = createAuditLogger(makeConfig());
    const req = mockReq('DELETE', '/api/elements/123', TEST_API_KEY);
    const res = mockRes(404);
    const next = vi.fn();

    mw(req as Request, res as unknown as Response, next as NextFunction);
    res.emit('finish');

    const logEntry = mockLoggerInfo.mock.calls[0][0];
    expect(logEntry.status).toBe(404);
  });

  it('records duration as a non-negative number', () => {
    const mw = createAuditLogger(makeConfig());
    const req = mockReq('GET', '/api/elements', TEST_API_KEY);
    const res = mockRes(200);
    const next = vi.fn();

    mw(req as Request, res as unknown as Response, next as NextFunction);
    res.emit('finish');

    const logEntry = mockLoggerInfo.mock.calls[0][0];
    expect(logEntry.duration).toBeGreaterThanOrEqual(0);
  });

  it('does not log before the response finishes', () => {
    const mw = createAuditLogger(makeConfig());
    const req = mockReq('GET', '/api/elements');
    const res = mockRes(200);
    const next = vi.fn();

    mw(req as Request, res as unknown as Response, next as NextFunction);

    // Before finish is emitted, nothing should be logged
    expect(mockLoggerInfo).not.toHaveBeenCalled();
  });

  it('logs each request independently', () => {
    const mw = createAuditLogger(makeConfig());

    const req1 = mockReq('GET', '/api/elements');
    const res1 = mockRes(200);
    mw(req1 as Request, res1 as unknown as Response, vi.fn() as NextFunction);

    const req2 = mockReq('POST', '/api/batch');
    const res2 = mockRes(201);
    mw(req2 as Request, res2 as unknown as Response, vi.fn() as NextFunction);

    res1.emit('finish');
    res2.emit('finish');

    expect(mockLoggerInfo).toHaveBeenCalledTimes(2);
    expect(mockLoggerInfo.mock.calls[0][0].method).toBe('GET');
    expect(mockLoggerInfo.mock.calls[1][0].method).toBe('POST');
  });
});

describe('createAuditLogger - disabled', () => {
  it('returns a pass-through middleware when AUDIT_LOG_ENABLED is false', () => {
    const mw = createAuditLogger(makeConfig({ AUDIT_LOG_ENABLED: false }));
    const req = mockReq('GET', '/api/elements', TEST_API_KEY);
    const res = mockRes(200);
    const next = vi.fn();

    mw(req as Request, res as unknown as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not log when disabled, even after response finishes', () => {
    const mw = createAuditLogger(makeConfig({ AUDIT_LOG_ENABLED: false }));
    const req = mockReq('GET', '/api/elements');
    const res = mockRes(200);
    const next = vi.fn();

    mw(req as Request, res as unknown as Response, next as NextFunction);
    res.emit('finish');

    expect(mockLoggerInfo).not.toHaveBeenCalled();
  });

  it('does not register a finish event listener when disabled', () => {
    const mw = createAuditLogger(makeConfig({ AUDIT_LOG_ENABLED: false }));
    const req = mockReq('GET', '/api/elements');
    const res = mockRes(200);
    const next = vi.fn();

    const listenerCountBefore = res.listenerCount('finish');
    mw(req as Request, res as unknown as Response, next as NextFunction);
    const listenerCountAfter = res.listenerCount('finish');

    expect(listenerCountAfter).toBe(listenerCountBefore);
  });
});
