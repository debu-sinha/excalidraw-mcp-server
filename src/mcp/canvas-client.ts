import type { Config } from '../shared/config.js';
import type { ServerElement, ApiResponse, ElementsResponse, SyncResponse } from '../shared/types.js';
import { createLogger } from '../shared/logger.js';

const logger = createLogger('canvas-client');

export class CanvasClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: Config) {
    this.baseUrl = config.CANVAS_SERVER_URL.replace(/\/$/, '');
    this.apiKey = config.EXCALIDRAW_API_KEY;
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
    };
  }

  private safePath(id: string): string {
    return encodeURIComponent(id);
  }

  async createElement(data: Record<string, unknown>): Promise<ServerElement> {
    const res = await fetch(`${this.baseUrl}/api/elements`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as ApiResponse;
      throw new Error(body.error ?? `Canvas error: ${res.status}`);
    }

    const body = await res.json() as ApiResponse<ServerElement> & { element?: ServerElement };
    return body.element ?? body.data!;
  }

  async getElement(id: string): Promise<ServerElement | null> {
    const res = await fetch(
      `${this.baseUrl}/api/elements/${this.safePath(id)}`,
      { headers: this.headers() }
    );

    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Canvas error: ${res.status}`);

    const body = await res.json() as { element?: ServerElement };
    return body.element ?? null;
  }

  async getAllElements(): Promise<ServerElement[]> {
    const res = await fetch(`${this.baseUrl}/api/elements`, {
      headers: this.headers(),
    });

    if (!res.ok) throw new Error(`Canvas error: ${res.status}`);

    const body = await res.json() as ElementsResponse;
    return body.elements;
  }

  async updateElement(
    id: string,
    data: Record<string, unknown>
  ): Promise<ServerElement> {
    const res = await fetch(
      `${this.baseUrl}/api/elements/${this.safePath(id)}`,
      {
        method: 'PUT',
        headers: this.headers(),
        body: JSON.stringify(data),
      }
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as ApiResponse;
      throw new Error(body.error ?? `Canvas error: ${res.status}`);
    }

    const body = await res.json() as { element?: ServerElement };
    return body.element!;
  }

  async deleteElement(id: string): Promise<boolean> {
    const res = await fetch(
      `${this.baseUrl}/api/elements/${this.safePath(id)}`,
      { method: 'DELETE', headers: this.headers() }
    );

    if (res.status === 404) return false;
    if (!res.ok) throw new Error(`Canvas error: ${res.status}`);
    return true;
  }

  async batchCreate(
    elements: Record<string, unknown>[]
  ): Promise<ServerElement[]> {
    const res = await fetch(`${this.baseUrl}/api/elements/batch`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ elements }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as ApiResponse;
      throw new Error(body.error ?? `Canvas error: ${res.status}`);
    }

    const body = await res.json() as { elements?: ServerElement[] };
    return body.elements ?? [];
  }

  async searchElements(
    filter: Record<string, string>
  ): Promise<ServerElement[]> {
    const params = new URLSearchParams(filter);
    const res = await fetch(
      `${this.baseUrl}/api/elements/search?${params.toString()}`,
      { headers: this.headers() }
    );

    if (!res.ok) throw new Error(`Canvas error: ${res.status}`);

    const body = await res.json() as ElementsResponse;
    return body.elements;
  }

  async sync(elements: Record<string, unknown>[]): Promise<SyncResponse> {
    const res = await fetch(`${this.baseUrl}/api/elements/sync`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ elements }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as ApiResponse;
      throw new Error(body.error ?? `Canvas error: ${res.status}`);
    }

    return (await res.json()) as SyncResponse;
  }

  async convertMermaid(
    mermaidDiagram: string,
    config?: Record<string, unknown>
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/elements/from-mermaid`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ mermaidDiagram, config }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as ApiResponse;
      throw new Error(body.error ?? `Canvas error: ${res.status}`);
    }
  }

  async exportScene(
    format: 'png' | 'svg',
    options?: { elementIds?: string[]; background?: string; padding?: number }
  ): Promise<{ data: string | Record<string, unknown>; contentType: string }> {
    const res = await fetch(`${this.baseUrl}/api/export`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ format, ...options }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as ApiResponse;
      throw new Error(body.error ?? `Canvas error: ${res.status}`);
    }

    if (format === 'svg') {
      return { data: await res.text(), contentType: 'image/svg+xml' };
    }

    return { data: await res.json() as Record<string, unknown>, contentType: 'application/json' };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      return res.ok;
    } catch {
      logger.warn('Canvas server health check failed');
      return false;
    }
  }
}
