import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// We need to isolate the module between tests because loadConfig() reads
// process.env at call time. We use dynamic import after setting env vars.
// ---------------------------------------------------------------------------

// Store original env so we can restore it
let envBackup: NodeJS.ProcessEnv;

beforeEach(() => {
  envBackup = { ...process.env };
  vi.resetModules();
});

afterEach(() => {
  process.env = envBackup;
});

async function importConfig() {
  const mod = await import('../../../src/shared/config.js');
  return mod;
}

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

describe('loadConfig - defaults', () => {
  it('returns default CANVAS_HOST when env is unset', async () => {
    delete process.env['CANVAS_HOST'];
    const { loadConfig } = await importConfig();
    const config = loadConfig();
    expect(config.CANVAS_HOST).toBe('127.0.0.1');
  });

  it('returns default CANVAS_PORT of 3000', async () => {
    delete process.env['CANVAS_PORT'];
    const { loadConfig } = await importConfig();
    const config = loadConfig();
    expect(config.CANVAS_PORT).toBe(3000);
  });

  it('returns default CORS_ALLOWED_ORIGINS', async () => {
    delete process.env['CORS_ALLOWED_ORIGINS'];
    const { loadConfig } = await importConfig();
    const config = loadConfig();
    expect(config.CORS_ALLOWED_ORIGINS).toBe(
      'http://localhost:3000,http://127.0.0.1:3000',
    );
  });

  it('returns default RATE_LIMIT_WINDOW_MS of 60000', async () => {
    delete process.env['RATE_LIMIT_WINDOW_MS'];
    const { loadConfig } = await importConfig();
    const config = loadConfig();
    expect(config.RATE_LIMIT_WINDOW_MS).toBe(60000);
  });

  it('returns default RATE_LIMIT_MAX_REQUESTS of 100', async () => {
    delete process.env['RATE_LIMIT_MAX_REQUESTS'];
    const { loadConfig } = await importConfig();
    const config = loadConfig();
    expect(config.RATE_LIMIT_MAX_REQUESTS).toBe(100);
  });

  it('returns default PERSISTENCE_ENABLED as false', async () => {
    delete process.env['PERSISTENCE_ENABLED'];
    const { loadConfig } = await importConfig();
    const config = loadConfig();
    expect(config.PERSISTENCE_ENABLED).toBe(false);
  });

  it('returns default LOG_LEVEL of info', async () => {
    delete process.env['LOG_LEVEL'];
    const { loadConfig } = await importConfig();
    const config = loadConfig();
    expect(config.LOG_LEVEL).toBe('info');
  });

  it('returns default AUDIT_LOG_ENABLED as true', async () => {
    delete process.env['AUDIT_LOG_ENABLED'];
    const { loadConfig } = await importConfig();
    const config = loadConfig();
    expect(config.AUDIT_LOG_ENABLED).toBe(true);
  });

  it('returns default MAX_ELEMENTS of 10000', async () => {
    delete process.env['MAX_ELEMENTS'];
    const { loadConfig } = await importConfig();
    const config = loadConfig();
    expect(config.MAX_ELEMENTS).toBe(10000);
  });

  it('returns default MAX_BATCH_SIZE of 100', async () => {
    delete process.env['MAX_BATCH_SIZE'];
    const { loadConfig } = await importConfig();
    const config = loadConfig();
    expect(config.MAX_BATCH_SIZE).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// API key auto-generation
// ---------------------------------------------------------------------------

describe('loadConfig - API key auto-generation', () => {
  it('generates a 64-character hex API key when env var is unset', async () => {
    delete process.env['EXCALIDRAW_API_KEY'];
    const { loadConfig } = await importConfig();
    const config = loadConfig();
    // 32 random bytes => 64 hex chars
    expect(config.EXCALIDRAW_API_KEY).toHaveLength(64);
    expect(config.EXCALIDRAW_API_KEY).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates a different key each time the module is freshly loaded', async () => {
    delete process.env['EXCALIDRAW_API_KEY'];
    const mod1 = await importConfig();
    const key1 = mod1.loadConfig().EXCALIDRAW_API_KEY;

    vi.resetModules();

    const mod2 = await importConfig();
    const key2 = mod2.loadConfig().EXCALIDRAW_API_KEY;

    // Extremely unlikely to collide
    expect(key1).not.toBe(key2);
  });
});

// ---------------------------------------------------------------------------
// Custom env var overrides
// ---------------------------------------------------------------------------

describe('loadConfig - env overrides', () => {
  it('uses CANVAS_PORT from env', async () => {
    process.env['CANVAS_PORT'] = '8080';
    const { loadConfig } = await importConfig();
    expect(loadConfig().CANVAS_PORT).toBe(8080);
  });

  it('coerces string CANVAS_PORT to number', async () => {
    process.env['CANVAS_PORT'] = '9999';
    const { loadConfig } = await importConfig();
    const config = loadConfig();
    expect(typeof config.CANVAS_PORT).toBe('number');
    expect(config.CANVAS_PORT).toBe(9999);
  });

  it('uses custom EXCALIDRAW_API_KEY from env', async () => {
    const customKey = 'x'.repeat(64);
    process.env['EXCALIDRAW_API_KEY'] = customKey;
    const { loadConfig } = await importConfig();
    expect(loadConfig().EXCALIDRAW_API_KEY).toBe(customKey);
  });

  it('uses custom CORS_ALLOWED_ORIGINS from env', async () => {
    process.env['CORS_ALLOWED_ORIGINS'] = 'https://example.com';
    const { loadConfig } = await importConfig();
    expect(loadConfig().CORS_ALLOWED_ORIGINS).toBe('https://example.com');
  });

  it('uses custom LOG_LEVEL from env', async () => {
    process.env['LOG_LEVEL'] = 'debug';
    const { loadConfig } = await importConfig();
    expect(loadConfig().LOG_LEVEL).toBe('debug');
  });

  it('coerces PERSISTENCE_ENABLED string "true" to boolean', async () => {
    process.env['PERSISTENCE_ENABLED'] = 'true';
    const { loadConfig } = await importConfig();
    expect(loadConfig().PERSISTENCE_ENABLED).toBe(true);
  });

  it('uses custom CANVAS_SERVER_URL', async () => {
    process.env['CANVAS_SERVER_URL'] = 'http://192.168.1.10:4000';
    const { loadConfig } = await importConfig();
    expect(loadConfig().CANVAS_SERVER_URL).toBe('http://192.168.1.10:4000');
  });
});

// ---------------------------------------------------------------------------
// Invalid values
// ---------------------------------------------------------------------------

describe('loadConfig - invalid values', () => {
  it('throws for CANVAS_PORT below 1', async () => {
    process.env['CANVAS_PORT'] = '0';
    const { loadConfig } = await importConfig();
    expect(() => loadConfig()).toThrow();
  });

  it('throws for CANVAS_PORT above 65535', async () => {
    process.env['CANVAS_PORT'] = '70000';
    const { loadConfig } = await importConfig();
    expect(() => loadConfig()).toThrow();
  });

  it('throws for non-integer CANVAS_PORT', async () => {
    process.env['CANVAS_PORT'] = '3000.5';
    const { loadConfig } = await importConfig();
    expect(() => loadConfig()).toThrow();
  });

  it('throws for non-numeric CANVAS_PORT', async () => {
    process.env['CANVAS_PORT'] = 'abc';
    const { loadConfig } = await importConfig();
    expect(() => loadConfig()).toThrow();
  });

  it('throws for EXCALIDRAW_API_KEY shorter than 32 chars', async () => {
    process.env['EXCALIDRAW_API_KEY'] = 'short';
    const { loadConfig } = await importConfig();
    expect(() => loadConfig()).toThrow();
  });

  it('throws for invalid LOG_LEVEL', async () => {
    process.env['LOG_LEVEL'] = 'trace';
    const { loadConfig } = await importConfig();
    expect(() => loadConfig()).toThrow();
  });

  it('throws for negative RATE_LIMIT_WINDOW_MS', async () => {
    process.env['RATE_LIMIT_WINDOW_MS'] = '-1';
    const { loadConfig } = await importConfig();
    expect(() => loadConfig()).toThrow();
  });

  it('throws for zero RATE_LIMIT_MAX_REQUESTS', async () => {
    process.env['RATE_LIMIT_MAX_REQUESTS'] = '0';
    const { loadConfig } = await importConfig();
    expect(() => loadConfig()).toThrow();
  });

  it('throws for invalid CANVAS_SERVER_URL', async () => {
    process.env['CANVAS_SERVER_URL'] = 'not-a-url';
    const { loadConfig } = await importConfig();
    expect(() => loadConfig()).toThrow();
  });
});
