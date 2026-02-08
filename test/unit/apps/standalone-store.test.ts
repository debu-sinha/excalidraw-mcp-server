import { describe, it, expect, beforeEach } from 'vitest';
import { StandaloneStore } from '../../../src/mcp/apps/standalone-store.js';
import type { ServerElement } from '../../../src/shared/types.js';

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

describe('StandaloneStore', () => {
  let store: StandaloneStore;

  beforeEach(() => {
    store = new StandaloneStore();
  });

  // Inherits all MemoryStore behavior - test the new methods

  describe('replaceAll', () => {
    it('replaces all elements atomically', async () => {
      await store.set('old1', makeElement({ id: 'old1' }));
      await store.set('old2', makeElement({ id: 'old2' }));

      const newElements = [
        makeElement({ id: 'new1', type: 'ellipse' }),
        makeElement({ id: 'new2', type: 'text' }),
        makeElement({ id: 'new3', type: 'arrow' }),
      ];

      await store.replaceAll(newElements);

      const all = await store.getAll();
      expect(all).toHaveLength(3);
      const ids = all.map(e => e.id).sort();
      expect(ids).toEqual(['new1', 'new2', 'new3']);

      // Old elements are gone
      expect(await store.get('old1')).toBeUndefined();
      expect(await store.get('old2')).toBeUndefined();
    });

    it('replaceAll with empty array clears everything', async () => {
      await store.set('a', makeElement({ id: 'a' }));
      await store.replaceAll([]);
      expect(await store.count()).toBe(0);
    });
  });

  describe('checkpoint and restore', () => {
    it('checkpoint saves and restore recovers state', async () => {
      await store.set('a', makeElement({ id: 'a', x: 10 }));
      await store.set('b', makeElement({ id: 'b', x: 20 }));

      const savedCount = await store.checkpoint();
      expect(savedCount).toBe(2);

      // Modify state after checkpoint
      await store.set('c', makeElement({ id: 'c', x: 30 }));
      await store.delete('a');
      expect(await store.count()).toBe(2); // b and c

      // Restore should bring back the checkpoint state
      const restored = await store.restore();
      expect(restored).toBe(true);

      const all = await store.getAll();
      expect(all).toHaveLength(2);
      const ids = all.map(e => e.id).sort();
      expect(ids).toEqual(['a', 'b']);

      // Element a should have its original state
      const a = await store.get('a');
      expect(a?.x).toBe(10);

      // Element c should be gone (wasn't in checkpoint)
      expect(await store.get('c')).toBeUndefined();
    });

    it('restore returns false when no checkpoint exists', async () => {
      const result = await store.restore();
      expect(result).toBe(false);
    });

    it('hasCheckpoint returns correct state', async () => {
      expect(store.hasCheckpoint()).toBe(false);

      await store.set('a', makeElement({ id: 'a' }));
      await store.checkpoint();
      expect(store.hasCheckpoint()).toBe(true);
    });

    it('checkpoint creates a deep copy (mutations do not affect snapshot)', async () => {
      const el = makeElement({ id: 'a', x: 10 });
      await store.set('a', el);
      await store.checkpoint();

      // Update the element after checkpoint
      await store.set('a', makeElement({ id: 'a', x: 999 }));

      // Restore should give original value
      await store.restore();
      const restored = await store.get('a');
      expect(restored?.x).toBe(10);
    });
  });
});
