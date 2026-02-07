import fs from 'node:fs/promises';
import path from 'node:path';
import type { ServerElement, ElementFilter } from '../../shared/types.js';
import type { ElementStore } from './store.js';
import { MemoryStore } from './memory-store.js';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('file-store');

export class FileStore implements ElementStore {
  private memory: MemoryStore;
  private filePath: string;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly DEBOUNCE_MS = 1000;

  constructor(persistenceDir: string, maxElements: number = 10_000) {
    this.memory = new MemoryStore(maxElements);
    this.filePath = path.resolve(persistenceDir, 'canvas-state.json');
  }

  async initialize(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });

      const data = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(data) as { elements?: ServerElement[] };

      if (Array.isArray(parsed.elements)) {
        let loaded = 0;
        for (const el of parsed.elements) {
          if (el.id && typeof el.id === 'string') {
            await this.memory.set(el.id, el);
            loaded++;
          }
        }
        logger.info({ loaded, path: this.filePath }, 'Loaded elements from disk');
      }
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.info({ path: this.filePath }, 'No persistence file found, starting fresh');
        return;
      }
      throw err;
    }
  }

  async get(id: string): Promise<ServerElement | undefined> {
    return this.memory.get(id);
  }

  async getAll(): Promise<ServerElement[]> {
    return this.memory.getAll();
  }

  async count(): Promise<number> {
    return this.memory.count();
  }

  async query(filter: ElementFilter): Promise<ServerElement[]> {
    return this.memory.query(filter);
  }

  async set(id: string, element: ServerElement): Promise<void> {
    await this.memory.set(id, element);
    this.scheduleSave();
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.memory.delete(id);
    if (result) this.scheduleSave();
    return result;
  }

  async clear(): Promise<void> {
    await this.memory.clear();
    this.scheduleSave();
  }

  private scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.saveToDisk().catch(err => {
        logger.error({ err }, 'Failed to save to disk');
      });
    }, this.DEBOUNCE_MS);
  }

  private async saveToDisk(): Promise<void> {
    const elements = await this.memory.getAll();
    const data = JSON.stringify(
      {
        version: 1,
        savedAt: new Date().toISOString(),
        elements,
      },
      null,
      2
    );

    const tmpPath = this.filePath + '.tmp';
    await fs.writeFile(tmpPath, data, 'utf8');
    await fs.rename(tmpPath, this.filePath);
    logger.debug({ count: elements.length }, 'Saved to disk');
  }
}
