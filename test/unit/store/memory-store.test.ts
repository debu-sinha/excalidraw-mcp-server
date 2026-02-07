import { describe, it, expect, beforeEach } from 'vitest';
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MemoryStore', () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
  });

  it('set and get an element', async () => {
    const el = makeElement({ id: 'a' });
    await store.set('a', el);
    const fetched = await store.get('a');
    expect(fetched).toEqual(el);
  });

  it('get returns undefined for missing id', async () => {
    const fetched = await store.get('nonexistent');
    expect(fetched).toBeUndefined();
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

  it('delete removes an element', async () => {
    await store.set('a', makeElement({ id: 'a' }));
    const deleted = await store.delete('a');
    expect(deleted).toBe(true);

    const fetched = await store.get('a');
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

    const count = await store.count();
    expect(count).toBe(0);

    const all = await store.getAll();
    expect(all).toHaveLength(0);
  });

  it('count returns correct count', async () => {
    expect(await store.count()).toBe(0);

    await store.set('a', makeElement({ id: 'a' }));
    expect(await store.count()).toBe(1);

    await store.set('b', makeElement({ id: 'b' }));
    expect(await store.count()).toBe(2);

    await store.delete('a');
    expect(await store.count()).toBe(1);
  });

  // -----------------------------------------------------------------------
  // Query tests
  // -----------------------------------------------------------------------

  it('query by type filters correctly', async () => {
    await store.set('r1', makeElement({ id: 'r1', type: 'rectangle' }));
    await store.set('r2', makeElement({ id: 'r2', type: 'rectangle' }));
    await store.set('e1', makeElement({ id: 'e1', type: 'ellipse' }));
    await store.set('t1', makeElement({ id: 't1', type: 'text' }));

    const rects = await store.query({ type: 'rectangle' });
    expect(rects).toHaveLength(2);
    expect(rects.every(e => e.type === 'rectangle')).toBe(true);

    const ellipses = await store.query({ type: 'ellipse' });
    expect(ellipses).toHaveLength(1);
    expect(ellipses[0].id).toBe('e1');
  });

  it('query by locked filters correctly', async () => {
    await store.set('locked1', makeElement({ id: 'locked1', locked: true }));
    await store.set('locked2', makeElement({ id: 'locked2', locked: true }));
    await store.set('unlocked1', makeElement({ id: 'unlocked1', locked: false }));
    await store.set('nolock', makeElement({ id: 'nolock' }));

    const lockedElements = await store.query({ locked: true });
    expect(lockedElements).toHaveLength(2);
    expect(lockedElements.every(e => e.locked === true)).toBe(true);

    const unlockedElements = await store.query({ locked: false });
    // locked: false matches elements where locked === false, not undefined
    expect(unlockedElements).toHaveLength(1);
    expect(unlockedElements[0].id).toBe('unlocked1');
  });

  it('query by groupId filters correctly', async () => {
    await store.set('g1', makeElement({ id: 'g1', groupIds: ['groupA'] }));
    await store.set('g2', makeElement({ id: 'g2', groupIds: ['groupA', 'groupB'] }));
    await store.set('g3', makeElement({ id: 'g3', groupIds: ['groupB'] }));
    await store.set('g4', makeElement({ id: 'g4' }));

    const groupA = await store.query({ groupId: 'groupA' });
    expect(groupA).toHaveLength(2);
    const ids = groupA.map(e => e.id).sort();
    expect(ids).toEqual(['g1', 'g2']);

    const groupB = await store.query({ groupId: 'groupB' });
    expect(groupB).toHaveLength(2);

    const groupC = await store.query({ groupId: 'groupC' });
    expect(groupC).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Max elements limit
  // -----------------------------------------------------------------------

  it('set throws when MAX_ELEMENTS reached', async () => {
    const smallStore = new MemoryStore(2);

    await smallStore.set('a', makeElement({ id: 'a' }));
    await smallStore.set('b', makeElement({ id: 'b' }));

    // Third element should throw
    await expect(
      smallStore.set('c', makeElement({ id: 'c' }))
    ).rejects.toThrow(/Maximum element count/);
  });

  it('set allows overwriting existing element at max capacity', async () => {
    const smallStore = new MemoryStore(2);

    await smallStore.set('a', makeElement({ id: 'a', x: 0 }));
    await smallStore.set('b', makeElement({ id: 'b' }));

    // Overwriting existing key should succeed even at capacity
    const updated = makeElement({ id: 'a', x: 999 });
    await smallStore.set('a', updated);
    const fetched = await smallStore.get('a');
    expect(fetched?.x).toBe(999);
  });
});
