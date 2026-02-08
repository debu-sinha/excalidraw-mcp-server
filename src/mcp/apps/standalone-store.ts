import type { ServerElement } from '../../shared/types.js';
import { MemoryStore } from '../../canvas/store/memory-store.js';

/**
 * In-process element store for standalone mode (no canvas server needed).
 * Extends MemoryStore with replaceAll for sync operations and
 * checkpoint/restore for undo support.
 */
export class StandaloneStore extends MemoryStore {
  private snapshot: Map<string, ServerElement> | null = null;

  /**
   * Replace all elements atomically (used by sync operations).
   */
  async replaceAll(elements: ServerElement[]): Promise<void> {
    await this.clear();
    for (const el of elements) {
      await this.set(el.id, el);
    }
  }

  /**
   * Save a snapshot of the current state that can be restored later.
   */
  async checkpoint(): Promise<number> {
    const all = await this.getAll();
    this.snapshot = new Map(all.map(el => [el.id, structuredClone(el)]));
    return all.length;
  }

  /**
   * Restore the last saved checkpoint. Returns false if no checkpoint exists.
   */
  async restore(): Promise<boolean> {
    if (!this.snapshot) return false;
    await this.clear();
    for (const [id, el] of this.snapshot) {
      await this.set(id, el);
    }
    return true;
  }

  hasCheckpoint(): boolean {
    return this.snapshot !== null;
  }
}
