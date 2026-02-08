import type { ServerElement, SyncResponse } from '../../shared/types.js';
import type { StandaloneStore } from './standalone-store.js';
import { generateId } from '../../shared/id.js';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('canvas-client-adapter');

/**
 * Adapts StandaloneStore to match the CanvasClient interface so the
 * existing 14 MCP tools can work identically in standalone mode
 * without any code changes.
 */
export class CanvasClientAdapter {
  constructor(private store: StandaloneStore) {}

  async createElement(data: Record<string, unknown>): Promise<ServerElement> {
    const now = new Date().toISOString();
    const element: ServerElement = {
      id: generateId(),
      type: data.type as ServerElement['type'],
      x: data.x as number,
      y: data.y as number,
      ...(data.width !== undefined && { width: data.width as number }),
      ...(data.height !== undefined && { height: data.height as number }),
      ...(data.points !== undefined && { points: data.points as ServerElement['points'] }),
      ...(data.backgroundColor !== undefined && { backgroundColor: data.backgroundColor as string }),
      ...(data.strokeColor !== undefined && { strokeColor: data.strokeColor as string }),
      ...(data.strokeWidth !== undefined && { strokeWidth: data.strokeWidth as number }),
      ...(data.roughness !== undefined && { roughness: data.roughness as number }),
      ...(data.opacity !== undefined && { opacity: data.opacity as number }),
      ...(data.text !== undefined && { text: data.text as string }),
      ...(data.fontSize !== undefined && { fontSize: data.fontSize as number }),
      ...(data.fontFamily !== undefined && { fontFamily: data.fontFamily as number }),
      ...(data.groupIds !== undefined && { groupIds: data.groupIds as string[] }),
      ...(data.locked !== undefined && { locked: data.locked as boolean }),
      ...(data.angle !== undefined && { angle: data.angle as number }),
      ...(data.fillStyle !== undefined && { fillStyle: data.fillStyle as string }),
      ...(data.strokeStyle !== undefined && { strokeStyle: data.strokeStyle as string }),
      createdAt: now,
      updatedAt: now,
      version: 1,
      source: 'standalone',
    };

    await this.store.set(element.id, element);
    logger.debug({ id: element.id, type: element.type }, 'Element created');
    return element;
  }

  async getElement(id: string): Promise<ServerElement | null> {
    const el = await this.store.get(id);
    return el ?? null;
  }

  async getAllElements(): Promise<ServerElement[]> {
    return this.store.getAll();
  }

  async updateElement(
    id: string,
    data: Record<string, unknown>
  ): Promise<ServerElement> {
    const existing = await this.store.get(id);
    if (!existing) throw new Error(`Element ${id} not found`);

    const updated: ServerElement = {
      ...existing,
      ...stripUndefined(data),
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
      version: existing.version + 1,
    };

    await this.store.set(id, updated);
    logger.debug({ id }, 'Element updated');
    return updated;
  }

  async deleteElement(id: string): Promise<boolean> {
    const deleted = await this.store.delete(id);
    if (deleted) logger.debug({ id }, 'Element deleted');
    return deleted;
  }

  async batchCreate(
    elements: Record<string, unknown>[]
  ): Promise<ServerElement[]> {
    const results: ServerElement[] = [];
    for (const data of elements) {
      results.push(await this.createElement(data));
    }
    return results;
  }

  async searchElements(
    filter: Record<string, string>
  ): Promise<ServerElement[]> {
    return this.store.query({
      type: filter.type as ServerElement['type'],
      locked: filter.locked !== undefined ? filter.locked === 'true' : undefined,
      groupId: filter.groupId,
    });
  }

  async sync(
    elements: Record<string, unknown>[]
  ): Promise<SyncResponse> {
    const beforeCount = await this.store.count();
    const now = new Date().toISOString();

    const serverElements: ServerElement[] = elements.map(data => ({
      id: (data.id as string) || generateId(),
      type: data.type as ServerElement['type'],
      x: data.x as number,
      y: data.y as number,
      ...(data.width !== undefined && { width: data.width as number }),
      ...(data.height !== undefined && { height: data.height as number }),
      ...(data.points !== undefined && { points: data.points as ServerElement['points'] }),
      ...(data.backgroundColor !== undefined && { backgroundColor: data.backgroundColor as string }),
      ...(data.strokeColor !== undefined && { strokeColor: data.strokeColor as string }),
      ...(data.strokeWidth !== undefined && { strokeWidth: data.strokeWidth as number }),
      ...(data.roughness !== undefined && { roughness: data.roughness as number }),
      ...(data.opacity !== undefined && { opacity: data.opacity as number }),
      ...(data.text !== undefined && { text: data.text as string }),
      ...(data.fontSize !== undefined && { fontSize: data.fontSize as number }),
      ...(data.fontFamily !== undefined && { fontFamily: data.fontFamily as number }),
      ...(data.groupIds !== undefined && { groupIds: data.groupIds as string[] }),
      ...(data.locked !== undefined && { locked: data.locked as boolean }),
      ...(data.angle !== undefined && { angle: data.angle as number }),
      createdAt: now,
      updatedAt: now,
      version: 1,
      source: 'standalone-sync',
    }));

    await this.store.replaceAll(serverElements);
    const afterCount = await this.store.count();

    return {
      success: true,
      count: afterCount,
      syncedAt: now,
      beforeCount,
      afterCount,
    };
  }

  async convertMermaid(
    _mermaidDiagram: string,
    _config?: Record<string, unknown>
  ): Promise<void> {
    // Mermaid conversion requires the canvas server's frontend for rendering.
    // In standalone mode, we log a warning but don't fail.
    logger.warn('Mermaid conversion is not available in standalone mode (requires canvas server)');
  }

  async exportScene(
    format: 'png' | 'svg',
    _options?: { elementIds?: string[]; background?: string; padding?: number }
  ): Promise<{ data: string | Record<string, unknown>; contentType: string }> {
    // Full export requires the canvas server's rendering pipeline.
    // In standalone mode, return a basic SVG representation or a note.
    const elements = await this.store.getAll();
    if (format === 'svg') {
      const svg = buildBasicSvg(elements);
      return { data: svg, contentType: 'image/svg+xml' };
    }
    return {
      data: { message: 'PNG export requires the canvas server. Use SVG or connect to canvas server.' },
      contentType: 'application/json',
    };
  }

  async healthCheck(): Promise<boolean> {
    // Standalone store is always healthy
    return true;
  }
}

function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  );
}

function buildBasicSvg(elements: ServerElement[]): string {
  if (elements.length === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>';
  }

  // Compute bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of elements) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + (el.width ?? 100));
    maxY = Math.max(maxY, el.y + (el.height ?? 50));
  }

  const padding = 20;
  const w = maxX - minX + padding * 2;
  const h = maxY - minY + padding * 2;

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${minX - padding} ${minY - padding} ${w} ${h}">`,
  ];

  for (const el of elements) {
    const stroke = el.strokeColor ?? '#1b1b1f';
    const fill = el.backgroundColor ?? 'none';
    switch (el.type) {
      case 'rectangle':
        parts.push(`<rect x="${el.x}" y="${el.y}" width="${el.width ?? 100}" height="${el.height ?? 50}" stroke="${stroke}" fill="${fill}" stroke-width="${el.strokeWidth ?? 1}" />`);
        break;
      case 'ellipse':
        parts.push(`<ellipse cx="${el.x + (el.width ?? 100) / 2}" cy="${el.y + (el.height ?? 50) / 2}" rx="${(el.width ?? 100) / 2}" ry="${(el.height ?? 50) / 2}" stroke="${stroke}" fill="${fill}" stroke-width="${el.strokeWidth ?? 1}" />`);
        break;
      case 'text':
        parts.push(`<text x="${el.x}" y="${el.y + (el.fontSize ?? 20)}" font-size="${el.fontSize ?? 20}" fill="${stroke}">${escapeXml(el.text ?? '')}</text>`);
        break;
      default:
        // For arrows, lines, diamonds, freedraw - skip in basic SVG
        break;
    }
  }

  parts.push('</svg>');
  return parts.join('\n');
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
