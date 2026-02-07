import type { CanvasClient } from '../canvas-client.js';
import { UpdateElementSchema } from '../schemas/element.js';

export async function updateElementTool(
  args: unknown,
  client: CanvasClient
) {
  const { id, ...data } = UpdateElementSchema.parse(args);
  const element = await client.updateElement(id, data as Record<string, unknown>);
  return { success: true, element };
}
