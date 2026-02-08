/**
 * MCP Apps widget - renders Excalidraw diagrams inline in Claude Desktop.
 * Receives streaming tool input via the MCP Apps protocol,
 * progressively renders elements as SVG with draw-on animations,
 * and supports export to excalidraw.com.
 */

import { App, PostMessageTransport } from '@modelcontextprotocol/ext-apps';

interface DiagramElement {
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  backgroundColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  roughness?: number;
  opacity?: number;
  fontSize?: number;
  fontFamily?: number;
  points?: Array<{ x: number; y: number }>;
  angle?: number;
  locked?: boolean;
  groupIds?: string[];
  [key: string]: unknown;
}

const canvasEl = document.getElementById('canvas')!;
const toolbarEl = document.getElementById('toolbar')!;
const exportBtn = document.getElementById('btn-export')!;

const app = new App(
  { name: 'ExcalidrawWidget', version: '2.0.0' },
  {},
);

let elements: DiagramElement[] = [];
let prevCount = 0;
let isFinalized = false;

// Streaming partial input - render progressively
app.ontoolinputpartial = (params) => {
  const args = params.arguments as Record<string, unknown> | undefined;
  if (!args?.elements || !Array.isArray(args.elements)) return;

  const valid = (args.elements as unknown[]).filter(isValidElement) as DiagramElement[];
  if (valid.length > elements.length) {
    elements = valid;
    render();
  }
};

// Final complete input
app.ontoolinput = (params) => {
  const args = params.arguments as Record<string, unknown> | undefined;
  if (!args?.elements || !Array.isArray(args.elements)) return;

  elements = (args.elements as unknown[]).filter(isValidElement) as DiagramElement[];
  render();
};

// Tool result received - finalize and show toolbar
app.ontoolresult = () => {
  isFinalized = true;
  render();
  toolbarEl.style.display = 'flex';
};

// Export to excalidraw.com
exportBtn.addEventListener('click', () => {
  const excalidrawData = buildExcalidrawJson(elements);
  const jsonStr = JSON.stringify(excalidrawData);
  const encoded = btoa(unescape(encodeURIComponent(jsonStr)));
  // Use the hash-based import URL
  const url = `https://excalidraw.com/#json=${encoded}`;
  // Try to open via the host, fall back to window.open
  app.openLink({ url }).catch(() => {
    window.open(url, '_blank');
  });
});

function isValidElement(el: unknown): boolean {
  if (typeof el !== 'object' || el === null) return false;
  const obj = el as Record<string, unknown>;
  return typeof obj.type === 'string' && typeof obj.x === 'number' && typeof obj.y === 'number';
}

function render(): void {
  if (elements.length === 0) {
    canvasEl.innerHTML = '<p class="loading">Waiting for diagram data...</p>';
    return;
  }

  // Compute bounding box, accounting for points on arrows/lines
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
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + (el.width ?? 100));
      maxY = Math.max(maxY, el.y + (el.height ?? 50));
    }
  }

  const pad = 40;
  const w = maxX - minX + pad * 2;
  const h = maxY - minY + pad * 2;

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX - pad} ${minY - pad} ${w} ${h}">`,
    // Arrow marker
    '<defs>',
    '  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">',
    '    <polygon points="0 0, 10 3.5, 0 7" fill="#1b1b1f" />',
    '  </marker>',
    '</defs>',
  ];

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const stroke = el.strokeColor ?? '#1b1b1f';
    const fill = el.backgroundColor ?? 'transparent';
    const sw = el.strokeWidth ?? 1;
    const isNew = i >= prevCount;
    const animClass = isNew ? (el.type === 'text' ? 'fade-on' : 'draw-on') : '';

    switch (el.type) {
      case 'rectangle': {
        const rw = el.width ?? 100;
        const rh = el.height ?? 50;
        const perim = 2 * (rw + rh);
        const style = isNew ? `stroke-dasharray:${perim};--path-length:${perim}` : '';
        parts.push(`<rect class="${animClass}" x="${el.x}" y="${el.y}" width="${rw}" height="${rh}" stroke="${stroke}" fill="${fill}" stroke-width="${sw}" rx="4" style="${style}" />`);
        // Render text inside rectangle if present
        if (el.text) {
          const tx = el.x + rw / 2;
          const ty = el.y + rh / 2;
          const fs = el.fontSize ?? 16;
          parts.push(`<text class="${isNew ? 'fade-on' : ''}" x="${tx}" y="${ty}" font-size="${fs}" fill="${stroke}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif">${esc(el.text)}</text>`);
        }
        break;
      }
      case 'ellipse': {
        const rx = (el.width ?? 100) / 2;
        const ry = (el.height ?? 50) / 2;
        // Approximate perimeter of ellipse
        const perim = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
        const style = isNew ? `stroke-dasharray:${perim};--path-length:${perim}` : '';
        parts.push(`<ellipse class="${animClass}" cx="${el.x + rx}" cy="${el.y + ry}" rx="${rx}" ry="${ry}" stroke="${stroke}" fill="${fill}" stroke-width="${sw}" style="${style}" />`);
        if (el.text) {
          parts.push(`<text class="${isNew ? 'fade-on' : ''}" x="${el.x + rx}" y="${el.y + ry}" font-size="${el.fontSize ?? 16}" fill="${stroke}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif">${esc(el.text)}</text>`);
        }
        break;
      }
      case 'diamond': {
        const dw = el.width ?? 100;
        const dh = el.height ?? 100;
        const cx = el.x + dw / 2;
        const cy = el.y + dh / 2;
        const perim = 2 * Math.sqrt(dw * dw / 4 + dh * dh / 4) * 2;
        const style = isNew ? `stroke-dasharray:${perim};--path-length:${perim}` : '';
        parts.push(`<polygon class="${animClass}" points="${cx},${el.y} ${el.x + dw},${cy} ${cx},${el.y + dh} ${el.x},${cy}" stroke="${stroke}" fill="${fill}" stroke-width="${sw}" style="${style}" />`);
        if (el.text) {
          parts.push(`<text class="${isNew ? 'fade-on' : ''}" x="${cx}" y="${cy}" font-size="${el.fontSize ?? 16}" fill="${stroke}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif">${esc(el.text)}</text>`);
        }
        break;
      }
      case 'text': {
        const fs = el.fontSize ?? 20;
        parts.push(`<text class="${animClass}" x="${el.x}" y="${el.y + fs}" font-size="${fs}" fill="${stroke}" font-family="system-ui, sans-serif">${esc(el.text ?? '')}</text>`);
        break;
      }
      case 'arrow':
      case 'line': {
        if (el.points && el.points.length >= 2) {
          const pathData = el.points.map((p, j) =>
            `${j === 0 ? 'M' : 'L'} ${el.x + p.x} ${el.y + p.y}`
          ).join(' ');
          // Compute path length
          let pathLen = 0;
          for (let j = 1; j < el.points.length; j++) {
            const dx = el.points[j].x - el.points[j - 1].x;
            const dy = el.points[j].y - el.points[j - 1].y;
            pathLen += Math.sqrt(dx * dx + dy * dy);
          }
          const style = isNew ? `stroke-dasharray:${pathLen};--path-length:${pathLen}` : '';
          const marker = el.type === 'arrow' ? 'marker-end="url(#arrowhead)"' : '';
          parts.push(`<path class="${animClass}" d="${pathData}" stroke="${stroke}" fill="none" stroke-width="${sw}" ${marker} style="${style}" />`);
        }
        break;
      }
      case 'freedraw': {
        if (el.points && el.points.length >= 2) {
          const pathData = el.points.map((p, j) =>
            `${j === 0 ? 'M' : 'L'} ${el.x + p.x} ${el.y + p.y}`
          ).join(' ');
          let pathLen = 0;
          for (let j = 1; j < el.points.length; j++) {
            const dx = el.points[j].x - el.points[j - 1].x;
            const dy = el.points[j].y - el.points[j - 1].y;
            pathLen += Math.sqrt(dx * dx + dy * dy);
          }
          const style = isNew ? `stroke-dasharray:${pathLen};--path-length:${pathLen}` : '';
          parts.push(`<path class="${animClass}" d="${pathData}" stroke="${stroke}" fill="none" stroke-width="${sw}" style="${style}" />`);
        }
        break;
      }
    }
  }

  parts.push('</svg>');
  canvasEl.innerHTML = parts.join('\n');
  prevCount = elements.length;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Build an Excalidraw-compatible JSON object for export.
 */
function buildExcalidrawJson(els: DiagramElement[]): Record<string, unknown> {
  return {
    type: 'excalidraw',
    version: 2,
    source: 'excalidraw-mcp-server',
    elements: els.map((el, i) => ({
      id: `el-${i}`,
      type: el.type,
      x: el.x,
      y: el.y,
      width: el.width ?? (el.type === 'text' ? undefined : 100),
      height: el.height ?? (el.type === 'text' ? undefined : 50),
      strokeColor: el.strokeColor ?? '#1b1b1f',
      backgroundColor: el.backgroundColor ?? 'transparent',
      fillStyle: 'solid',
      strokeWidth: el.strokeWidth ?? 1,
      roughness: el.roughness ?? 1,
      opacity: el.opacity ?? 100,
      text: el.text,
      fontSize: el.fontSize ?? 20,
      fontFamily: el.fontFamily ?? 1,
      points: el.points,
      angle: el.angle ?? 0,
      groupIds: el.groupIds ?? [],
      locked: el.locked ?? false,
      seed: Math.floor(Math.random() * 2000000000),
      version: 1,
      versionNonce: Math.floor(Math.random() * 2000000000),
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: null,
    })),
    appState: {
      viewBackgroundColor: '#ffffff',
    },
    files: {},
  };
}

// Connect to host
app.connect(new PostMessageTransport(window.parent, window.parent)).catch(err => {
  canvasEl.innerHTML = `<p class="loading">Connection error: ${err.message}</p>`;
});
