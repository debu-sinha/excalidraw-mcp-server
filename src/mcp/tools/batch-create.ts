import type { CanvasClient } from '../canvas-client.js';
import { BatchCreateSchema } from '../schemas/element.js';

export async function batchCreateTool(
  args: unknown,
  client: CanvasClient
) {
  const { elements } = BatchCreateSchema.parse(args);
  const created = await client.batchCreate(
    elements as unknown as Record<string, unknown>[]
  );
  return { success: true, elements: created, count: created.length };
}
