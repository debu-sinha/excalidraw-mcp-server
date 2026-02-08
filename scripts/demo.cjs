/**
 * Demo script: builds an architecture diagram element-by-element
 * with delays so you can screen-record the real-time WebSocket sync.
 *
 * Usage: EXCALIDRAW_API_KEY=<key> node scripts/demo.cjs
 */

const API_KEY = process.env.EXCALIDRAW_API_KEY;
const BASE = process.env.CANVAS_SERVER_URL || 'http://127.0.0.1:3000';

if (!API_KEY) {
  console.error('Set EXCALIDRAW_API_KEY env var');
  process.exit(1);
}

const DELAY = 600; // ms between elements

const elements = [
  // Title
  { type: 'text', x: 200, y: -15, text: 'excalidraw-mcp-server v2.0', fontSize: 22, strokeColor: '#1b1b1f' },

  // Row 1: MCP Clients
  { type: 'rectangle', x: 50, y: 40, width: 155, height: 52, backgroundColor: '#dbe4ff', strokeColor: '#364fc7', strokeWidth: 2, text: 'Claude Desktop', fontSize: 13 },
  { type: 'rectangle', x: 230, y: 40, width: 130, height: 52, backgroundColor: '#dbe4ff', strokeColor: '#364fc7', strokeWidth: 2, text: 'ChatGPT', fontSize: 13 },
  { type: 'rectangle', x: 385, y: 40, width: 120, height: 52, backgroundColor: '#dbe4ff', strokeColor: '#364fc7', strokeWidth: 2, text: 'VS Code', fontSize: 13 },
  { type: 'rectangle', x: 530, y: 40, width: 120, height: 52, backgroundColor: '#dbe4ff', strokeColor: '#364fc7', strokeWidth: 2, text: 'Cursor', fontSize: 13 },

  // Protocol label
  { type: 'text', x: 265, y: 103, text: 'MCP Protocol (stdio)', fontSize: 12, strokeColor: '#868e96' },

  // Arrows down
  { type: 'arrow', x: 127, y: 92, points: [{ x: 0, y: 0 }, { x: 0, y: 48 }], strokeColor: '#364fc7', strokeWidth: 1.5 },
  { type: 'arrow', x: 295, y: 92, points: [{ x: 0, y: 0 }, { x: 0, y: 48 }], strokeColor: '#364fc7', strokeWidth: 1.5 },
  { type: 'arrow', x: 445, y: 92, points: [{ x: 0, y: 0 }, { x: 0, y: 48 }], strokeColor: '#364fc7', strokeWidth: 1.5 },
  { type: 'arrow', x: 590, y: 92, points: [{ x: 0, y: 0 }, { x: 0, y: 48 }], strokeColor: '#364fc7', strokeWidth: 1.5 },

  // MCP Server
  { type: 'rectangle', x: 70, y: 140, width: 570, height: 68, backgroundColor: '#fff4e6', strokeColor: '#e8590c', strokeWidth: 2.5, text: 'excalidraw-mcp-server', fontSize: 16 },

  // Feature pills
  { type: 'text', x: 95, y: 185, text: '16 Tools', fontSize: 11, strokeColor: '#c2255c' },
  { type: 'text', x: 170, y: 185, text: 'API Auth', fontSize: 11, strokeColor: '#c2255c' },
  { type: 'text', x: 248, y: 185, text: 'Rate Limit', fontSize: 11, strokeColor: '#c2255c' },
  { type: 'text', x: 336, y: 185, text: 'Zod Schemas', fontSize: 11, strokeColor: '#c2255c' },
  { type: 'text', x: 432, y: 185, text: 'Helmet CSP', fontSize: 11, strokeColor: '#c2255c' },
  { type: 'text', x: 530, y: 185, text: 'MCP Apps', fontSize: 11, strokeColor: '#c2255c' },

  // Mode split
  { type: 'arrow', x: 235, y: 208, points: [{ x: 0, y: 0 }, { x: -60, y: 52 }], strokeColor: '#2b8a3e', strokeWidth: 1.5 },
  { type: 'arrow', x: 475, y: 208, points: [{ x: 0, y: 0 }, { x: 60, y: 52 }], strokeColor: '#7048e8', strokeWidth: 1.5 },
  { type: 'text', x: 128, y: 237, text: 'Standalone Mode', fontSize: 12, strokeColor: '#2b8a3e' },
  { type: 'text', x: 505, y: 237, text: 'Connected Mode', fontSize: 12, strokeColor: '#7048e8' },

  // Standalone side
  { type: 'rectangle', x: 55, y: 267, width: 210, height: 50, backgroundColor: '#d3f9d8', strokeColor: '#2b8a3e', strokeWidth: 2, text: 'In-Process Store', fontSize: 13 },
  { type: 'arrow', x: 160, y: 317, points: [{ x: 0, y: 0 }, { x: 0, y: 40 }], strokeColor: '#2b8a3e', strokeWidth: 1.5 },
  { type: 'rectangle', x: 55, y: 357, width: 210, height: 50, backgroundColor: '#fff4e6', strokeColor: '#e8590c', strokeWidth: 2, text: 'Inline Widget (SVG)', fontSize: 13 },
  { type: 'text', x: 80, y: 395, text: 'streaming + draw-on animations', fontSize: 10, strokeColor: '#868e96' },

  // Connected side
  { type: 'rectangle', x: 440, y: 267, width: 210, height: 50, backgroundColor: '#e5dbff', strokeColor: '#7048e8', strokeWidth: 2, text: 'Canvas Server', fontSize: 13 },
  { type: 'arrow', x: 545, y: 317, points: [{ x: 0, y: 0 }, { x: 0, y: 40 }], strokeColor: '#7048e8', strokeWidth: 1.5 },
  { type: 'text', x: 555, y: 331, text: 'WebSocket', fontSize: 10, strokeColor: '#7048e8' },
  { type: 'rectangle', x: 440, y: 357, width: 210, height: 50, backgroundColor: '#e5dbff', strokeColor: '#7048e8', strokeWidth: 2, text: 'Browser Frontend', fontSize: 13 },
  { type: 'text', x: 473, y: 395, text: 'Excalidraw + real-time sync', fontSize: 10, strokeColor: '#868e96' },

  // File store
  { type: 'arrow', x: 650, y: 292, points: [{ x: 0, y: 0 }, { x: 50, y: 0 }], strokeColor: '#7048e8', strokeWidth: 1 },
  { type: 'rectangle', x: 700, y: 275, width: 90, height: 35, backgroundColor: '#f3f0ff', strokeColor: '#7048e8', strokeWidth: 1.5, text: 'File Store', fontSize: 11 },
];

async function post(el) {
  const res = await fetch(`${BASE}/api/elements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify(el),
  });
  const data = await res.json();
  return data;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log(`\nDemo starting in 3 seconds -- open ${BASE} in your browser and start recording!\n`);
  await sleep(3000);

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const label = el.text || el.type;
    process.stdout.write(`  [${i + 1}/${elements.length}] ${label}`);
    const result = await post(el);
    if (result.success) {
      console.log(' -- ok');
    } else {
      console.log(` -- FAILED: ${result.error}`);
    }
    await sleep(DELAY);
  }

  console.log('\nDone! The diagram should be fully rendered in your browser.\n');
  console.log('You can stop recording now.\n');
}

run().catch(err => {
  console.error('Demo failed:', err.message);
  process.exit(1);
});
