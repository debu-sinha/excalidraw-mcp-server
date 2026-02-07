import type { CanvasClient } from '../canvas-client.js';
import { CreateElementSchema } from '../schemas/element.js';

export async function createElementTool(
  args: unknown,
  client: CanvasClient
) {
  const data = CreateElementSchema.parse(args);
  const element = await client.createElement(data as Record<string, unknown>);
  return { success: true, element };
}
