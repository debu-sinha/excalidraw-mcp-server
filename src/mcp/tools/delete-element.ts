import type { CanvasClient } from '../canvas-client.js';
import { ElementIdSchema } from '../schemas/element.js';

export async function deleteElementTool(
  args: unknown,
  client: CanvasClient
) {
  const { id } = ElementIdSchema.parse(args);
  const deleted = await client.deleteElement(id);
  if (!deleted) throw new Error(`Element ${id} not found`);
  return { success: true, message: `Element ${id} deleted` };
}
