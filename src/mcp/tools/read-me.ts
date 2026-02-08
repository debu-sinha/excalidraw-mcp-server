import { getCheatsheetText } from '../apps/cheatsheet.js';

/**
 * Handle the read_me tool call.
 * Returns the Excalidraw element reference cheatsheet so the LLM
 * knows element types, color palettes, sizing rules, and best practices
 * without needing separate documentation lookups.
 */
export async function handleReadMe(): Promise<{
  content: Array<{ type: 'text'; text: string }>;
}> {
  return {
    content: [{
      type: 'text' as const,
      text: getCheatsheetText(),
    }],
  };
}
