import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { FileStore } from '../../../src/canvas/store/file-store.js';
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

let tmpDir: string;

async function createTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'file-store-test-'));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FileStore', () => {
  beforeEach(async () => {
    tmpDir = await createTmpDir();
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------

  describe('initialize', () => {
    it('creates the persistence directory if it does not exist', async () => {
      const nestedDir = path.join(tmpDir, 'nested', 'deep');
      const store = new FileStore(nestedDir);
      await store.initialize();

      const stat = await fs.stat(nestedDir);
      expect(stat.isDirectory()).toBe(true);
    });

    it('starts fresh when no persistence file exists', async () => {
      const store = new FileStore(tmpDir);
      await store.initialize();

      const count = await store.count();
      expect(count).toBe(0);
    });

    it('loads elements from an existing persistence file', async () => {
      // Write a persistence file manually
      const filePath = path.join(tmpDir, 'canvas-state.json');
      const data = {
        version: 1,
        savedAt: '2025-01-01T00:00:00.000Z',
        elements: [
          makeElement({ id: 'preloaded-1', type: 'rectangle', x: 10, y: 20 }),
          makeElement({ id: 'preloaded-2', type: 'ellipse', x: 30, y: 40 }),
        ],
      };
      await fs.writeFile(filePath, JSON.stringify(data), 'utf8');

      const store = new FileStore(tmpDir);
      await store.initialize();

      expect(await store.count()).toBe(2);

      const el1 = await store.get('preloaded-1');
      expect(el1).toBeDefined();
      expect(el1!.type).toBe('rectangle');
      expect(el1!.x).toBe(10);

      const el2 = await store.get('preloaded-2');
      expect(el2).toBeDefined();
      expect(el2!.type).toBe('ellipse');
    });

    it('skips elements without valid id when loading', async () => {
      const filePath = path.join(tmpDir, 'canvas-state.json');
      const data = {
        version: 1,
        savedAt: '2025-01-01T00:00:00.000Z',
        elements: [
          makeElement({ id: 'valid-1' }),
          { type: 'rectangle', x: 0, y: 0 }, // no id
          { id: 123, type: 'ellipse', x: 0, y: 0 }, // non-string id
        ],
      };
      await fs.writeFile(filePath, JSON.stringify(data), 'utf8');

      const store = new FileStore(tmpDir);
      await store.initialize();

      // Only the element with a valid string id should be loaded
      expect(await store.count()).toBe(1);
      expect(await store.get('valid-1')).toBeDefined();
    });

    it('handles malformed JSON in persistence file by throwing', async () => {
      const filePath = path.join(tmpDir, 'canvas-state.json');
      await fs.writeFile(filePath, '{ this is not valid json }}}', 'utf8');

      const store = new FileStore(tmpDir);
      await expect(store.initialize()).rejects.toThrow();
    });

    it('handles persistence file with no elements array gracefully', async () => {
      const filePath = path.join(tmpDir, 'canvas-state.json');
      await fs.writeFile(filePath, JSON.stringify({ version: 1 }), 'utf8');

      const store = new FileStore(tmpDir);
      await store.initialize();

      expect(await store.count()).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Basic CRUD operations
  // -----------------------------------------------------------------------

  describe('CRUD operations', () => {
    let store: FileStore;

    beforeEach(async () => {
      store = new FileStore(tmpDir);
      await store.initialize();
    });

    it('set and get an element', async () => {
      const el = makeElement({ id: 'crud-1', x: 42, y: 99 });
      await store.set('crud-1', el);

      const fetched = await store.get('crud-1');
      expect(fetched).toEqual(el);
    });

    it('getAll returns all elements', async () => {
      await store.set('a', makeElement({ id: 'a' }));
      await store.set('b', makeElement({ id: 'b' }));
      await store.set('c', makeElement({ id: 'c' }));

      const all = await store.getAll();
      expect(all).toHaveLength(3);
      const ids = all.map(e => e.id).sort();
      expect(ids).toEqual(['a', 'b', 'c']);
    });

    it('count returns the number of elements', async () => {
      expect(await store.count()).toBe(0);

      await store.set('a', makeElement({ id: 'a' }));
      expect(await store.count()).toBe(1);

      await store.set('b', makeElement({ id: 'b' }));
      expect(await store.count()).toBe(2);
    });

    it('delete removes an element', async () => {
      await store.set('del-me', makeElement({ id: 'del-me' }));
      const deleted = await store.delete('del-me');
      expect(deleted).toBe(true);

      const fetched = await store.get('del-me');
      expect(fetched).toBeUndefined();
    });

    it('delete returns false for non-existent element', async () => {
      const deleted = await store.delete('nonexistent');
      expect(deleted).toBe(false);
    });

    it('clear empties the store', async () => {
      await store.set('a', makeElement({ id: 'a' }));
      await store.set('b', makeElement({ id: 'b' }));

      await store.clear();
      expect(await store.count()).toBe(0);
      expect(await store.getAll()).toHaveLength(0);
    });

    it('get returns undefined for missing id', async () => {
      const result = await store.get('does-not-exist');
      expect(result).toBeUndefined();
    });

    it('query delegates to memory store', async () => {
      await store.set('r1', makeElement({ id: 'r1', type: 'rectangle' }));
      await store.set('e1', makeElement({ id: 'e1', type: 'ellipse' }));
      await store.set('r2', makeElement({ id: 'r2', type: 'rectangle' }));

      const rects = await store.query({ type: 'rectangle' });
      expect(rects).toHaveLength(2);
      expect(rects.every(e => e.type === 'rectangle')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // File persistence (write/read cycle)
  // -----------------------------------------------------------------------

  describe('persistence', () => {
    // The FileStore debounce is 1000ms. We wait long enough for the
    // debounce timer to fire and the async file I/O to complete.
    const DEBOUNCE_WAIT = 1500;

    function waitForSave(): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, DEBOUNCE_WAIT));
    }

    it('persists elements to disk after debounce period', async () => {
      const store = new FileStore(tmpDir);
      await store.initialize();

      await store.set('persist-1', makeElement({ id: 'persist-1', x: 100 }));
      await store.set('persist-2', makeElement({ id: 'persist-2', x: 200 }));

      await waitForSave();

      // Read the persistence file directly
      const filePath = path.join(tmpDir, 'canvas-state.json');
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw) as {
        version: number;
        savedAt: string;
        elements: ServerElement[];
      };

      expect(parsed.version).toBe(1);
      expect(parsed.savedAt).toBeDefined();
      expect(parsed.elements).toHaveLength(2);

      const ids = parsed.elements.map(e => e.id).sort();
      expect(ids).toEqual(['persist-1', 'persist-2']);
    });

    it('can read back persisted data after reinitializing', async () => {
      const store1 = new FileStore(tmpDir);
      await store1.initialize();

      await store1.set('round-trip', makeElement({ id: 'round-trip', x: 42, y: 99 }));

      // Wait for debounced save to flush
      await waitForSave();

      // Create a new store instance pointing to the same directory
      const store2 = new FileStore(tmpDir);
      await store2.initialize();

      expect(await store2.count()).toBe(1);
      const el = await store2.get('round-trip');
      expect(el).toBeDefined();
      expect(el!.x).toBe(42);
      expect(el!.y).toBe(99);
    });

    it('debounces multiple rapid saves into one write', async () => {
      const store = new FileStore(tmpDir);
      await store.initialize();

      // Rapid-fire sets within the debounce window
      await store.set('a', makeElement({ id: 'a' }));
      await store.set('b', makeElement({ id: 'b' }));
      await store.set('c', makeElement({ id: 'c' }));

      await waitForSave();

      // File should contain all 3 elements
      const filePath = path.join(tmpDir, 'canvas-state.json');
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw) as { elements: ServerElement[] };
      expect(parsed.elements).toHaveLength(3);
    });

    it('schedules save after delete', async () => {
      const store = new FileStore(tmpDir);
      await store.initialize();

      await store.set('to-delete', makeElement({ id: 'to-delete' }));
      await waitForSave();

      await store.delete('to-delete');
      await waitForSave();

      const filePath = path.join(tmpDir, 'canvas-state.json');
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw) as { elements: ServerElement[] };
      expect(parsed.elements).toHaveLength(0);
    });

    it('schedules save after clear', async () => {
      const store = new FileStore(tmpDir);
      await store.initialize();

      await store.set('a', makeElement({ id: 'a' }));
      await store.set('b', makeElement({ id: 'b' }));
      await waitForSave();

      await store.clear();
      await waitForSave();

      const filePath = path.join(tmpDir, 'canvas-state.json');
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw) as { elements: ServerElement[] };
      expect(parsed.elements).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Max elements limit
  // -----------------------------------------------------------------------

  describe('max elements', () => {
    it('respects maxElements limit from underlying MemoryStore', async () => {
      const store = new FileStore(tmpDir, 2);
      await store.initialize();

      await store.set('a', makeElement({ id: 'a' }));
      await store.set('b', makeElement({ id: 'b' }));

      await expect(
        store.set('c', makeElement({ id: 'c' }))
      ).rejects.toThrow(/Maximum element count/);
    });
  });
});
