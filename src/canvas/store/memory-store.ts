import type { ServerElement, ElementFilter } from '../../shared/types.js';
import type { ElementStore } from './store.js';

export class MemoryStore implements ElementStore {
  private elements = new Map<string, ServerElement>();
  private maxElements: number;

  constructor(maxElements: number = 10_000) {
    this.maxElements = maxElements;
  }

  async get(id: string): Promise<ServerElement | undefined> {
    return this.elements.get(id);
  }

  async getAll(): Promise<ServerElement[]> {
    return Array.from(this.elements.values());
  }

  async set(id: string, element: ServerElement): Promise<void> {
    if (this.elements.size >= this.maxElements && !this.elements.has(id)) {
      throw new Error(
        `Maximum element count (${this.maxElements}) reached. Delete elements before creating new ones.`
      );
    }
    this.elements.set(id, element);
  }

  async delete(id: string): Promise<boolean> {
    return this.elements.delete(id);
  }

  async clear(): Promise<void> {
    this.elements.clear();
  }

  async count(): Promise<number> {
    return this.elements.size;
  }

  async query(filter: ElementFilter): Promise<ServerElement[]> {
    let results = Array.from(this.elements.values());

    if (filter.type) {
      results = results.filter(e => e.type === filter.type);
    }
    if (filter.locked !== undefined) {
      results = results.filter(e => e.locked === filter.locked);
    }
    if (filter.groupId) {
      const gid = filter.groupId;
      results = results.filter(e => e.groupIds?.includes(gid) ?? false);
    }

    return results;
  }
}
