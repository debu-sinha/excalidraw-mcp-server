import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import http from 'node:http';
import { createExportRouter } from '../../../src/canvas/routes/export.js';
import { MemoryStore } from '../../../src/canvas/store/memory-store.js';
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

let store: MemoryStore;
let server: http.Server;
let baseUrl: string;

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  store = new MemoryStore();
  const app = express();
  app.use(express.json());
  app.use('/api/export', createExportRouter(store));

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

describe('Export route', () => {
  beforeEach(async () => {
    await store.clear();
  });

  // -----------------------------------------------------------------------
  // SVG export
  // -----------------------------------------------------------------------

  describe('SVG export', () => {
    it('returns SVG content for a rectangle element', async () => {
      await store.set('r1', makeElement({
        id: 'r1',
        type: 'rectangle',
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        strokeColor: '#ff0000',
        backgroundColor: '#00ff00',
        strokeWidth: 2,
        opacity: 80,
      }));

      const res = await fetch(`${baseUrl}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'svg' }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('image/svg+xml');
      expect(res.headers.get('content-disposition')).toContain('excalidraw-export.svg');

      const svg = await res.text();
      expect(svg).toContain('<?xml version="1.0"');
      expect(svg).toContain('<svg xmlns=');
      expect(svg).toContain('<rect');
      expect(svg).toContain('stroke="#ff0000"');
      expect(svg).toContain('fill="#00ff00"');
      expect(svg).toContain('stroke-width="2"');
      expect(svg).toContain('opacity="0.8"');
      expect(svg).toContain('rx="8"');
    });

    it('renders ellipse elements', async () => {
      await store.set('e1', makeElement({
        id: 'e1',
        type: 'ellipse',
        x: 50,
        y: 50,
        width: 200,
        height: 100,
      }));

      const res = await fetch(`${baseUrl}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'svg' }),
      });

      expect(res.status).toBe(200);
      const svg = await res.text();
      expect(svg).toContain('<ellipse');
      expect(svg).toContain('cx=');
      expect(svg).toContain('cy=');
      expect(svg).toContain('rx=');
      expect(svg).toContain('ry=');
    });

    it('renders diamond elements as polygon', async () => {
      await store.set('d1', makeElement({
        id: 'd1',
        type: 'diamond',
        x: 100,
        y: 100,
        width: 80,
        height: 80,
      }));

      const res = await fetch(`${baseUrl}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'svg' }),
      });

      expect(res.status).toBe(200);
      const svg = await res.text();
      expect(svg).toContain('<polygon');
      expect(svg).toContain('points=');
    });

    it('renders multiline text with tspan elements', async () => {
      await store.set('t1', makeElement({
        id: 't1',
        type: 'text',
        x: 10,
        y: 10,
        text: 'Line one\nLine two\nLine three',
        fontSize: 20,
      }));

      const res = await fetch(`${baseUrl}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'svg' }),
      });

      expect(res.status).toBe(200);
      const svg = await res.text();
      expect(svg).toContain('<text');
      expect(svg).toContain('font-size="20"');

      // Should have 3 tspan elements for the 3 lines
      const tspanCount = (svg.match(/<tspan/g) || []).length;
      expect(tspanCount).toBe(3);
      expect(svg).toContain('Line one');
      expect(svg).toContain('Line two');
      expect(svg).toContain('Line three');

      // First tspan has dy="0", subsequent tspans have dy based on fontSize
      expect(svg).toContain('dy="0"');
      expect(svg).toContain('dy="24"'); // 20 * 1.2 = 24
    });

    it('renders single-line text', async () => {
      await store.set('t1', makeElement({
        id: 't1',
        type: 'text',
        x: 10,
        y: 10,
        text: 'Single line',
        fontSize: 16,
      }));

      const res = await fetch(`${baseUrl}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'svg' }),
      });

      expect(res.status).toBe(200);
      const svg = await res.text();
      const tspanCount = (svg.match(/<tspan/g) || []).length;
      expect(tspanCount).toBe(1);
      expect(svg).toContain('Single line');
    });

    it('renders arrow with arrowhead marker', async () => {
      await store.set('a1', makeElement({
        id: 'a1',
        type: 'arrow',
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        points: [{ x: 0, y: 0 }, { x: 100, y: 50 }, { x: 200, y: 100 }],
      }));

      const res = await fetch(`${baseUrl}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'svg' }),
      });

      expect(res.status).toBe(200);
      const svg = await res.text();
      expect(svg).toContain('<path');
      expect(svg).toContain('marker-end="url(#arrowhead)"');
      expect(svg).toContain('<marker id="arrowhead"');
      // Path should use M and L commands with point coordinates
      expect(svg).toContain('M ');
      expect(svg).toContain('L ');
    });

    it('renders arrow without explicit points using synthesized path', async () => {
      await store.set('a2', makeElement({
        id: 'a2',
        type: 'arrow',
        x: 10,
        y: 20,
        width: 150,
        height: 75,
      }));

      const res = await fetch(`${baseUrl}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'svg' }),
      });

      expect(res.status).toBe(200);
      const svg = await res.text();
      expect(svg).toContain('<path');
      expect(svg).toContain('marker-end="url(#arrowhead)"');
      // Should synthesize M x y L x+w y+h path
      expect(svg).toMatch(/M \d+ \d+ L \d+ \d+/);
    });

    it('renders line without arrowhead marker', async () => {
      await store.set('l1', makeElement({
        id: 'l1',
        type: 'line',
        x: 0,
        y: 0,
        width: 100,
        height: 50,
      }));

      const res = await fetch(`${baseUrl}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'svg' }),
      });

      expect(res.status).toBe(200);
      const svg = await res.text();
      expect(svg).toContain('<path');
      // The path element for this line should not have marker-end
      const pathMatch = svg.match(/<path[^>]*>/);
      expect(pathMatch).toBeTruthy();
      expect(pathMatch![0]).not.toContain('marker-end');
    });

    it('renders freedraw as path without arrowhead', async () => {
      await store.set('f1', makeElement({
        id: 'f1',
        type: 'freedraw',
        x: 0,
        y: 0,
        points: [{ x: 0, y: 0 }, { x: 5, y: 3 }, { x: 10, y: 8 }],
      }));

      const res = await fetch(`${baseUrl}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'svg' }),
      });

      expect(res.status).toBe(200);
      const svg = await res.text();
      expect(svg).toContain('<path');
      const pathMatch = svg.match(/<path[^>]*>/);
      expect(pathMatch).toBeTruthy();
      expect(pathMatch![0]).not.toContain('marker-end');
    });

    it('filters by elementIds when provided', async () => {
      await store.set('r1', makeElement({ id: 'r1', type: 'rectangle', x: 0, y: 0 }));
      await store.set('r2', makeElement({ id: 'r2', type: 'rectangle', x: 100, y: 100 }));
      await store.set('e1', makeElement({ id: 'e1', type: 'ellipse', x: 200, y: 200 }));

      const res = await fetch(`${baseUrl}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'svg', elementIds: ['r1'] }),
      });

      expect(res.status).toBe(200);
      const svg = await res.text();
      // Should not contain ellipse since we only requested r1
      expect(svg).not.toContain('<ellipse');
      // Should contain a rect element (besides the background rect)
      expect(svg).toContain('rx="8"');
    });

    it('applies custom background and padding', async () => {
      await store.set('r1', makeElement({
        id: 'r1',
        type: 'rectangle',
        x: 50,
        y: 50,
        width: 100,
        height: 100,
      }));

      const res = await fetch(`${baseUrl}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: 'svg',
          background: '#f0f0f0',
          padding: 40,
        }),
      });

      expect(res.status).toBe(200);
      const svg = await res.text();
      expect(svg).toContain('fill="#f0f0f0"');
      // With padding=40, viewBox width = 100 + 40*2 = 180
      expect(svg).toContain('width="180"');
      expect(svg).toContain('height="180"');
    });

    it('uses default width/height of 100 when not specified on element', async () => {
      await store.set('r1', makeElement({
        id: 'r1',
        type: 'rectangle',
        x: 0,
        y: 0,
        // no width/height
      }));

      const res = await fetch(`${baseUrl}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'svg' }),
      });

      expect(res.status).toBe(200);
      const svg = await res.text();
      // Default padding=20, element at (0,0) with default w=100 h=100
      // viewBox: width=100+40=140, height=100+40=140
      expect(svg).toContain('width="140"');
      expect(svg).toContain('height="140"');
    });

    it('escapes XML special characters in element properties', async () => {
      await store.set('t1', makeElement({
        id: 't1',
        type: 'text',
        x: 10,
        y: 10,
        text: 'Hello <world> & "friends"',
        fontSize: 16,
      }));

      const res = await fetch(`${baseUrl}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'svg' }),
      });

      expect(res.status).toBe(200);
      const svg = await res.text();
      expect(svg).toContain('&lt;world&gt;');
      expect(svg).toContain('&amp;');
      expect(svg).toContain('&quot;friends&quot;');
    });
  });

  // -----------------------------------------------------------------------
  // Bounding box calculation
  // -----------------------------------------------------------------------

  describe('bounding box calculation', () => {
    it('computes correct SVG dimensions for multiple elements', async () => {
      // Two elements: one at (10,20) 100x50, another at (200,300) 80x60
      // minX=10, minY=20, maxX=280, maxY=360
      // width = 280-10 + 20*2 = 310, height = 360-20 + 20*2 = 380
      await store.set('r1', makeElement({
        id: 'r1', type: 'rectangle', x: 10, y: 20, width: 100, height: 50,
      }));
      await store.set('r2', makeElement({
        id: 'r2', type: 'rectangle', x: 200, y: 300, width: 80, height: 60,
      }));

      const res = await fetch(`${baseUrl}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'svg' }),
      });

      expect(res.status).toBe(200);
      const svg = await res.text();
      expect(svg).toContain('width="310"');
      expect(svg).toContain('height="380"');
      expect(svg).toContain('viewBox="0 0 310 380"');
    });
  });

  // -----------------------------------------------------------------------
  // PNG export
  // -----------------------------------------------------------------------

  describe('PNG export', () => {
    it('returns JSON data with elements for client-side rendering', async () => {
      await store.set('r1', makeElement({
        id: 'r1', type: 'rectangle', x: 10, y: 20, width: 100, height: 50,
      }));

      const res = await fetch(`${baseUrl}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'png' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json() as {
        success: boolean;
        format: string;
        message: string;
        elements: ServerElement[];
        exportConfig: { background: string; padding: number };
      };
      expect(body.success).toBe(true);
      expect(body.format).toBe('png');
      expect(body.elements).toHaveLength(1);
      expect(body.elements[0].id).toBe('r1');
      expect(body.exportConfig.background).toBe('#ffffff');
      expect(body.exportConfig.padding).toBe(20);
    });

    it('applies custom background and padding in PNG export config', async () => {
      await store.set('r1', makeElement({ id: 'r1', type: 'rectangle', x: 0, y: 0 }));

      const res = await fetch(`${baseUrl}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: 'png',
          background: '#333333',
          padding: 50,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json() as {
        success: boolean;
        exportConfig: { background: string; padding: number };
      };
      expect(body.exportConfig.background).toBe('#333333');
      expect(body.exportConfig.padding).toBe(50);
    });
  });

  // -----------------------------------------------------------------------
  // Error cases
  // -----------------------------------------------------------------------

  describe('error handling', () => {
    it('returns 400 when no elements exist', async () => {
      // Store is empty after beforeEach clear
      const res = await fetch(`${baseUrl}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'svg' }),
      });

      expect(res.status).toBe(400);
      const body = await res.json() as { success: boolean; error: string };
      expect(body.success).toBe(false);
      expect(body.error).toBe('No elements to export');
    });

    it('returns 400 when elementIds filter results in no elements', async () => {
      await store.set('r1', makeElement({ id: 'r1', type: 'rectangle', x: 0, y: 0 }));

      const res = await fetch(`${baseUrl}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'svg', elementIds: ['nonexistent'] }),
      });

      expect(res.status).toBe(400);
      const body = await res.json() as { success: boolean; error: string };
      expect(body.success).toBe(false);
      expect(body.error).toBe('No elements to export');
    });

    it('returns validation error for invalid format', async () => {
      const res = await fetch(`${baseUrl}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'gif' }),
      });

      expect(res.status).toBe(400);
      const body = await res.json() as { success: boolean; error: string; details: unknown[] };
      expect(body.success).toBe(false);
      expect(body.error).toBe('Validation failed');
      expect(body.details).toBeDefined();
      expect(body.details.length).toBeGreaterThan(0);
    });

    it('returns validation error for missing format', async () => {
      const res = await fetch(`${baseUrl}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const body = await res.json() as { success: boolean; error: string };
      expect(body.success).toBe(false);
      expect(body.error).toBe('Validation failed');
    });

    it('returns validation error for extra unknown fields (strict schema)', async () => {
      const res = await fetch(`${baseUrl}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'svg', unknownField: true }),
      });

      expect(res.status).toBe(400);
      const body = await res.json() as { success: boolean; error: string };
      expect(body.success).toBe(false);
      expect(body.error).toBe('Validation failed');
    });

    it('returns validation error for negative padding', async () => {
      const res = await fetch(`${baseUrl}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'svg', padding: -10 }),
      });

      expect(res.status).toBe(400);
      const body = await res.json() as { success: boolean; error: string };
      expect(body.success).toBe(false);
    });

    it('returns validation error for padding exceeding max', async () => {
      const res = await fetch(`${baseUrl}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'svg', padding: 999 }),
      });

      expect(res.status).toBe(400);
      const body = await res.json() as { success: boolean; error: string };
      expect(body.success).toBe(false);
    });
  });
});
