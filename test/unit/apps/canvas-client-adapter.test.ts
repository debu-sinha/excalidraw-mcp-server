import { describe, it, expect, beforeEach } from 'vitest';
import { StandaloneStore } from '../../../src/mcp/apps/standalone-store.js';
import { CanvasClientAdapter } from '../../../src/mcp/apps/canvas-client-adapter.js';

describe('CanvasClientAdapter', () => {
  let store: StandaloneStore;
  let adapter: CanvasClientAdapter;

  beforeEach(() => {
    store = new StandaloneStore();
    adapter = new CanvasClientAdapter(store);
  });

  describe('createElement', () => {
    it('creates an element with generated id and timestamps', async () => {
      const el = await adapter.createElement({
        type: 'rectangle',
        x: 10,
        y: 20,
        width: 100,
        height: 50,
      });

      expect(el.id).toBeDefined();
      expect(el.id.length).toBe(32); // 16 bytes hex
      expect(el.type).toBe('rectangle');
      expect(el.x).toBe(10);
      expect(el.y).toBe(20);
      expect(el.width).toBe(100);
      expect(el.height).toBe(50);
      expect(el.createdAt).toBeDefined();
      expect(el.updatedAt).toBeDefined();
      expect(el.version).toBe(1);
      expect(el.source).toBe('standalone');
    });

    it('element is persisted in store', async () => {
      const el = await adapter.createElement({ type: 'text', x: 0, y: 0, text: 'hello' });
      const fetched = await store.get(el.id);
      expect(fetched).toEqual(el);
    });

    it('optional fields are preserved when provided', async () => {
      const el = await adapter.createElement({
        type: 'rectangle',
        x: 0,
        y: 0,
        backgroundColor: '#ff0000',
        strokeColor: '#000000',
        opacity: 80,
        locked: true,
      });

      expect(el.backgroundColor).toBe('#ff0000');
      expect(el.strokeColor).toBe('#000000');
      expect(el.opacity).toBe(80);
      expect(el.locked).toBe(true);
    });
  });

  describe('getElement', () => {
    it('returns null for non-existent element', async () => {
      const el = await adapter.getElement('missing');
      expect(el).toBeNull();
    });

    it('returns created element', async () => {
      const created = await adapter.createElement({ type: 'rectangle', x: 5, y: 10 });
      const fetched = await adapter.getElement(created.id);
      expect(fetched).toEqual(created);
    });
  });

  describe('getAllElements', () => {
    it('returns all elements', async () => {
      await adapter.createElement({ type: 'rectangle', x: 0, y: 0 });
      await adapter.createElement({ type: 'ellipse', x: 10, y: 10 });
      await adapter.createElement({ type: 'text', x: 20, y: 20, text: 'hi' });

      const all = await adapter.getAllElements();
      expect(all).toHaveLength(3);
    });
  });

  describe('updateElement', () => {
    it('updates existing element fields', async () => {
      const created = await adapter.createElement({ type: 'rectangle', x: 0, y: 0, width: 100 });
      const updated = await adapter.updateElement(created.id, { x: 50, width: 200 });

      expect(updated.x).toBe(50);
      expect(updated.width).toBe(200);
      expect(updated.version).toBe(2);
      expect(updated.id).toBe(created.id);
      expect(updated.createdAt).toBe(created.createdAt);
    });

    it('throws for non-existent element', async () => {
      await expect(
        adapter.updateElement('missing', { x: 10 })
      ).rejects.toThrow('Element missing not found');
    });
  });

  describe('deleteElement', () => {
    it('deletes an existing element', async () => {
      const el = await adapter.createElement({ type: 'rectangle', x: 0, y: 0 });
      const deleted = await adapter.deleteElement(el.id);
      expect(deleted).toBe(true);

      const fetched = await adapter.getElement(el.id);
      expect(fetched).toBeNull();
    });

    it('returns false for non-existent element', async () => {
      const deleted = await adapter.deleteElement('missing');
      expect(deleted).toBe(false);
    });
  });

  describe('batchCreate', () => {
    it('creates multiple elements at once', async () => {
      const elements = [
        { type: 'rectangle', x: 0, y: 0 },
        { type: 'ellipse', x: 100, y: 100 },
        { type: 'text', x: 200, y: 200, text: 'hello' },
      ];

      const created = await adapter.batchCreate(elements);
      expect(created).toHaveLength(3);
      expect(created[0].type).toBe('rectangle');
      expect(created[1].type).toBe('ellipse');
      expect(created[2].type).toBe('text');

      // All should be in the store
      const all = await adapter.getAllElements();
      expect(all).toHaveLength(3);
    });
  });

  describe('searchElements', () => {
    it('filters by type', async () => {
      await adapter.createElement({ type: 'rectangle', x: 0, y: 0 });
      await adapter.createElement({ type: 'rectangle', x: 10, y: 10 });
      await adapter.createElement({ type: 'ellipse', x: 20, y: 20 });

      const rects = await adapter.searchElements({ type: 'rectangle' });
      expect(rects).toHaveLength(2);
      expect(rects.every(e => e.type === 'rectangle')).toBe(true);
    });

    it('filters by locked status', async () => {
      await adapter.createElement({ type: 'rectangle', x: 0, y: 0, locked: true });
      await adapter.createElement({ type: 'rectangle', x: 10, y: 10, locked: false });

      const locked = await adapter.searchElements({ locked: 'true' });
      expect(locked).toHaveLength(1);
      expect(locked[0].locked).toBe(true);
    });
  });

  describe('sync', () => {
    it('replaces all elements with new set', async () => {
      await adapter.createElement({ type: 'rectangle', x: 0, y: 0 });
      await adapter.createElement({ type: 'ellipse', x: 10, y: 10 });

      const result = await adapter.sync([
        { type: 'text', x: 100, y: 100, text: 'synced' },
      ]);

      expect(result.success).toBe(true);
      expect(result.beforeCount).toBe(2);
      expect(result.afterCount).toBe(1);

      const all = await adapter.getAllElements();
      expect(all).toHaveLength(1);
      expect(all[0].type).toBe('text');
    });
  });

  describe('healthCheck', () => {
    it('always returns true in standalone mode', async () => {
      const healthy = await adapter.healthCheck();
      expect(healthy).toBe(true);
    });
  });

  describe('exportScene', () => {
    it('returns basic SVG for svg format', async () => {
      await adapter.createElement({ type: 'rectangle', x: 0, y: 0, width: 100, height: 50 });
      const result = await adapter.exportScene('svg');

      expect(result.contentType).toBe('image/svg+xml');
      expect(typeof result.data).toBe('string');
      expect(result.data).toContain('<svg');
      expect(result.data).toContain('<rect');
    });

    it('returns message for png format in standalone mode', async () => {
      const result = await adapter.exportScene('png');
      expect(result.contentType).toBe('application/json');
      expect(typeof result.data).toBe('object');
    });

    it('handles empty canvas', async () => {
      const result = await adapter.exportScene('svg');
      expect(result.contentType).toBe('image/svg+xml');
      expect(result.data).toContain('<svg');
    });
  });

  describe('convertMermaid', () => {
    it('does not throw in standalone mode', async () => {
      // Should log a warning but not fail
      await expect(
        adapter.convertMermaid('graph TD\nA --> B')
      ).resolves.toBeUndefined();
    });
  });
});
