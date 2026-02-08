import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { createSecurityHeaders } from '../../../src/canvas/middleware/security-headers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockReq(): Partial<Request> {
  return {
    method: 'GET',
    url: '/',
    headers: {},
  };
}

/**
 * Build a mock response that captures header writes the way helmet
 * sets them. Helmet calls res.setHeader() directly.
 */
function mockRes(): Partial<Response> & {
  _headers: Record<string, string | string[]>;
} {
  const headers: Record<string, string | string[]> = {};
  const res: Partial<Response> & {
    _headers: Record<string, string | string[]>;
  } = {
    _headers: headers,
    setHeader(name: string, value: string | string[]) {
      headers[name.toLowerCase()] = value;
      return res as Response;
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()];
    },
    removeHeader(name: string) {
      delete headers[name.toLowerCase()];
    },
  } as any;
  return res;
}

function runMiddleware(
  mw: (req: Request, res: Response, next: NextFunction) => void,
): Record<string, string | string[]> {
  const req = mockReq();
  const res = mockRes();
  const next = vi.fn();
  mw(req as Request, res as Response, next as NextFunction);
  return res._headers;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createSecurityHeaders', () => {
  it('returns a middleware function', () => {
    const mw = createSecurityHeaders();
    expect(typeof mw).toBe('function');
  });

  it('calls next() to continue the middleware chain', () => {
    const mw = createSecurityHeaders();
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    mw(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('sets Content-Security-Policy header', () => {
    const mw = createSecurityHeaders();
    const headers = runMiddleware(mw);

    const csp = headers['content-security-policy'];
    expect(csp).toBeDefined();
    expect(String(csp)).toContain("default-src 'self'");
  });

  it('CSP includes script-src with unsafe-inline', () => {
    const mw = createSecurityHeaders();
    const headers = runMiddleware(mw);

    const csp = String(headers['content-security-policy']);
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
  });

  it('CSP includes img-src with data: and blob:', () => {
    const mw = createSecurityHeaders();
    const headers = runMiddleware(mw);

    const csp = String(headers['content-security-policy']);
    expect(csp).toContain('img-src');
    expect(csp).toContain('data:');
    expect(csp).toContain('blob:');
  });

  it('CSP includes connect-src with websocket origins', () => {
    const mw = createSecurityHeaders();
    const headers = runMiddleware(mw);

    const csp = String(headers['content-security-policy']);
    expect(csp).toContain('connect-src');
    expect(csp).toContain('ws://localhost:*');
    expect(csp).toContain('ws://127.0.0.1:*');
  });

  it('CSP blocks object-src', () => {
    const mw = createSecurityHeaders();
    const headers = runMiddleware(mw);

    const csp = String(headers['content-security-policy']);
    expect(csp).toContain("object-src 'none'");
  });

  it('CSP blocks frame-ancestors', () => {
    const mw = createSecurityHeaders();
    const headers = runMiddleware(mw);

    const csp = String(headers['content-security-policy']);
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('sets Strict-Transport-Security header with max-age', () => {
    const mw = createSecurityHeaders();
    const headers = runMiddleware(mw);

    const hsts = String(headers['strict-transport-security']);
    expect(hsts).toBeDefined();
    expect(hsts).toContain('max-age=31536000');
    expect(hsts).toContain('includeSubDomains');
  });

  it('sets Referrer-Policy to strict-origin-when-cross-origin', () => {
    const mw = createSecurityHeaders();
    const headers = runMiddleware(mw);

    const referrer = String(headers['referrer-policy']);
    expect(referrer).toBeDefined();
    expect(referrer).toContain('strict-origin-when-cross-origin');
  });

  it('sets X-Content-Type-Options to nosniff', () => {
    const mw = createSecurityHeaders();
    const headers = runMiddleware(mw);

    // helmet sets this by default
    const xcto = String(headers['x-content-type-options']);
    expect(xcto).toContain('nosniff');
  });

  it('does not set X-Powered-By header (helmet removes it)', () => {
    const mw = createSecurityHeaders();
    const headers = runMiddleware(mw);

    // helmet's hidePoweredBy removes X-Powered-By.
    // Since we never set it in our mock, it should remain absent.
    expect(headers['x-powered-by']).toBeUndefined();
  });

  it('CSP restricts form-action to self', () => {
    const mw = createSecurityHeaders();
    const headers = runMiddleware(mw);

    const csp = String(headers['content-security-policy']);
    expect(csp).toContain("form-action 'self'");
  });

  it('CSP restricts base-uri to self', () => {
    const mw = createSecurityHeaders();
    const headers = runMiddleware(mw);

    const csp = String(headers['content-security-policy']);
    expect(csp).toContain("base-uri 'self'");
  });
});
