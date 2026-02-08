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

  // Compute bounding box (account for arrow/line points)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of elements) {
    if (el.points && el.points.length > 0) {
      for (const p of el.points) {
        minX = Math.min(minX, el.x + p.x);
        minY = Math.min(minY, el.y + p.y);
        maxX = Math.max(maxX, el.x + p.x);
        maxY = Math.max(maxY, el.y + p.y);
      }
    } else {
      const ew = el.width ?? 100;
      const eh = el.height ?? (el.type === 'text' ? (el.fontSize ?? 20) * 1.4 : 50);
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + ew);
      maxY = Math.max(maxY, el.y + eh);
    }
  }

  const padding = 20;
  const w = maxX - minX + padding * 2;
  const h = maxY - minY + padding * 2;

  // Collect unique arrow colors for per-color markers
  const arrowColors = new Set<string>();
  for (const el of elements) {
    if (el.type === 'arrow') arrowColors.add(el.strokeColor ?? '#1b1b1f');
  }

  const markers: string[] = [];
  for (const color of arrowColors) {
    const id = 'arrow-' + color.replace(/[^a-zA-Z0-9]/g, '');
    markers.push(`<marker id="${id}" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="${escapeXml(color)}" /></marker>`);
  }

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${minX - padding} ${minY - padding} ${w} ${h}">`,
  ];

  if (markers.length > 0) {
    parts.push(`<defs>${markers.join('')}<style>text { font-family: "Segoe UI", system-ui, -apple-system, sans-serif; }</style></defs>`);
  } else {
    parts.push('<defs><style>text { font-family: "Segoe UI", system-ui, -apple-system, sans-serif; }</style></defs>');
  }

  for (const el of elements) {
    const stroke = el.strokeColor ?? '#1b1b1f';
    const fill = el.backgroundColor ?? 'none';
    const sw = el.strokeWidth ?? 1;

    switch (el.type) {
      case 'rectangle': {
        const rw = el.width ?? 100;
        const rh = el.height ?? 50;
        parts.push(`<rect x="${el.x}" y="${el.y}" width="${rw}" height="${rh}" rx="8" stroke="${stroke}" fill="${fill}" stroke-width="${sw}" />`);
        if (el.text) {
          const fs = el.fontSize ?? 14;
          parts.push(`<text x="${el.x + rw / 2}" y="${el.y + rh / 2}" font-size="${fs}" fill="${stroke}" text-anchor="middle" dominant-baseline="central">${escapeXml(el.text)}</text>`);
        }
        break;
      }
      case 'ellipse': {
        const ew = el.width ?? 100;
        const eh = el.height ?? 50;
        parts.push(`<ellipse cx="${el.x + ew / 2}" cy="${el.y + eh / 2}" rx="${ew / 2}" ry="${eh / 2}" stroke="${stroke}" fill="${fill}" stroke-width="${sw}" />`);
        if (el.text) {
          const fs = el.fontSize ?? 14;
          parts.push(`<text x="${el.x + ew / 2}" y="${el.y + eh / 2}" font-size="${fs}" fill="${stroke}" text-anchor="middle" dominant-baseline="central">${escapeXml(el.text)}</text>`);
        }
        break;
      }
      case 'diamond': {
        const dw = el.width ?? 100;
        const dh = el.height ?? 100;
        const cx = el.x + dw / 2;
        const cy = el.y + dh / 2;
        parts.push(`<polygon points="${cx},${el.y} ${el.x + dw},${cy} ${cx},${el.y + dh} ${el.x},${cy}" stroke="${stroke}" fill="${fill}" stroke-width="${sw}" />`);
        if (el.text) {
          const fs = el.fontSize ?? 14;
          parts.push(`<text x="${cx}" y="${cy}" font-size="${fs}" fill="${stroke}" text-anchor="middle" dominant-baseline="central">${escapeXml(el.text)}</text>`);
        }
        break;
      }
      case 'text': {
        const fs = el.fontSize ?? 20;
        parts.push(`<text x="${el.x}" y="${el.y + fs}" font-size="${fs}" fill="${stroke}">${escapeXml(el.text ?? '')}</text>`);
        break;
      }
      case 'arrow':
      case 'line':
      case 'freedraw': {
        let d: string;
        if (el.points && el.points.length > 0) {
          d = el.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${el.x + p.x} ${el.y + p.y}`).join(' ');
        } else {
          d = `M ${el.x} ${el.y} L ${el.x + (el.width ?? 100)} ${el.y + (el.height ?? 50)}`;
        }
        const markerId = el.type === 'arrow' ? 'arrow-' + (el.strokeColor ?? '#1b1b1f').replace(/[^a-zA-Z0-9]/g, '') : '';
        const marker = markerId ? ` marker-end="url(#${markerId})"` : '';
        parts.push(`<path d="${d}" stroke="${stroke}" fill="none" stroke-width="${sw}"${marker} />`);
        break;
      }
    }
  }

  parts.push('</svg>');
  return parts.join('\n');
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
