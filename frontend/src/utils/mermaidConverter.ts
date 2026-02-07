import { parseMermaidToExcalidraw } from '@excalidraw/mermaid-to-excalidraw';

export interface MermaidConversionResult {
  elements: readonly Record<string, unknown>[];
  error?: string;
}

const DEFAULT_CONFIG = {
  startOnLoad: false,
  flowchart: { curve: 'linear' as const },
  themeVariables: { fontSize: '20px' },
  maxEdges: 500,
  maxTextSize: 50000,
};

export async function convertMermaidToExcalidraw(
  definition: string,
  config?: Record<string, unknown>
): Promise<MermaidConversionResult> {
  try {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    const result = await parseMermaidToExcalidraw(definition, mergedConfig);

    if (!result || !result.elements) {
      return { elements: [], error: 'Mermaid conversion returned no elements' };
    }

    return {
      elements: result.elements as readonly Record<string, unknown>[],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { elements: [], error: `Mermaid conversion failed: ${message}` };
  }
}
