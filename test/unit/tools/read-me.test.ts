import { describe, it, expect } from 'vitest';
import { handleReadMe } from '../../../src/mcp/tools/read-me.js';

describe('handleReadMe', () => {
  it('returns cheatsheet content', async () => {
    const result = await handleReadMe();

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Excalidraw MCP Quick Reference');
  });

  it('includes element types in output', async () => {
    const result = await handleReadMe();
    const text = result.content[0].text;

    expect(text).toContain('rectangle');
    expect(text).toContain('ellipse');
    expect(text).toContain('arrow');
  });

  it('includes color palettes in output', async () => {
    const result = await handleReadMe();
    const text = result.content[0].text;

    expect(text).toContain('#1971c2');
    expect(text).toContain('Color Palettes');
  });
});
