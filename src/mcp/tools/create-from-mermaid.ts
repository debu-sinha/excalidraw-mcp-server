import type { CanvasClient } from '../canvas-client.js';
import { MermaidSchema } from '../schemas/element.js';

export async function createFromMermaidTool(
  args: unknown,
  client: CanvasClient
) {
  const { mermaidDiagram, config } = MermaidSchema.parse(args);
  await client.convertMermaid(
    mermaidDiagram,
    config as Record<string, unknown> | undefined
  );
  return { success: true, message: 'Mermaid conversion sent to canvas' };
}
