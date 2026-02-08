import { describe, it, expect, vi } from 'vitest';
import { handleCreateView } from '../../../src/mcp/tools/create-view.js';

describe('handleCreateView', () => {
  const baseElements = [
    { type: 'rectangle' as const, x: 0, y: 0, width: 100, height: 50 },
    { type: 'text' as const, x: 50, y: 50, text: 'hello' },
  ];

  it('returns element data as JSON content', async () => {
    const result = await handleCreateView({ elements: baseElements });

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.elementCount).toBe(2);
    expect(parsed.elements).toHaveLength(2);
    expect(parsed.title).toBe('Excalidraw Diagram');
  });

  it('uses provided title', async () => {
    const result = await handleCreateView({
      elements: baseElements,
      title: 'My Architecture',
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.title).toBe('My Architecture');
  });

  it('calls persistToStore when provided', async () => {
    const persistFn = vi.fn();
    await handleCreateView({ elements: baseElements }, persistFn);

    expect(persistFn).toHaveBeenCalledTimes(1);
    expect(persistFn).toHaveBeenCalledWith(baseElements);
  });

  it('works without persistToStore callback', async () => {
    const result = await handleCreateView({ elements: baseElements });
    expect(result.content).toHaveLength(1);
  });
});
