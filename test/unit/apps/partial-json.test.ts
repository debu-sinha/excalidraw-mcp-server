import { describe, it, expect } from 'vitest';
import {
  extractCompleteElements,
  extractFinalElements,
  diffElements,
} from '../../../src/mcp/apps/partial-json.js';

describe('partial-json', () => {
  describe('extractCompleteElements', () => {
    it('returns empty for null input', () => {
      const result = extractCompleteElements(null);
      expect(result.complete).toEqual([]);
      expect(result.hasMore).toBe(false);
    });

    it('returns empty when elements is not an array', () => {
      const result = extractCompleteElements({ elements: 'not-an-array' });
      expect(result.complete).toEqual([]);
    });

    it('returns empty for empty elements array', () => {
      const result = extractCompleteElements({ elements: [] });
      expect(result.complete).toEqual([]);
    });

    it('extracts valid elements with type, x, y', () => {
      const result = extractCompleteElements({
        elements: [
          { type: 'rectangle', x: 0, y: 0, width: 100, height: 50 },
          { type: 'text', x: 50, y: 50, text: 'hello' },
        ],
      });
      expect(result.complete).toHaveLength(2);
      expect(result.complete[0].type).toBe('rectangle');
      expect(result.complete[1].type).toBe('text');
    });

    it('skips elements missing required fields', () => {
      const result = extractCompleteElements({
        elements: [
          { type: 'rectangle', x: 0, y: 0 },       // valid
          { type: 'rectangle', x: 0 },               // missing y
          { x: 0, y: 0 },                            // missing type
          { type: 'text' },                           // missing x and y
          null,                                       // null
          'string',                                   // not an object
        ],
      });
      expect(result.complete).toHaveLength(1);
      expect(result.complete[0].type).toBe('rectangle');
    });

    it('flags hasMore as true when valid elements exist', () => {
      const result = extractCompleteElements({
        elements: [{ type: 'rectangle', x: 0, y: 0 }],
      });
      expect(result.hasMore).toBe(true);
    });
  });

  describe('extractFinalElements', () => {
    it('extracts all valid elements from final input', () => {
      const result = extractFinalElements({
        elements: [
          { type: 'rectangle', x: 0, y: 0 },
          { type: 'ellipse', x: 100, y: 100 },
        ],
      });
      expect(result).toHaveLength(2);
    });

    it('returns empty for non-array elements', () => {
      const result = extractFinalElements({ something: 'else' });
      expect(result).toEqual([]);
    });

    it('filters out incomplete elements', () => {
      const result = extractFinalElements({
        elements: [
          { type: 'rectangle', x: 0, y: 0 },
          { incomplete: true },
        ],
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('diffElements', () => {
    it('returns empty when current is same length as previous', () => {
      const prev = [{ type: 'rectangle', x: 0, y: 0 }];
      const curr = [{ type: 'rectangle', x: 0, y: 0 }];
      expect(diffElements(prev, curr)).toEqual([]);
    });

    it('returns empty when current is shorter than previous', () => {
      const prev = [
        { type: 'rectangle', x: 0, y: 0 },
        { type: 'text', x: 10, y: 10 },
      ];
      const curr = [{ type: 'rectangle', x: 0, y: 0 }];
      expect(diffElements(prev, curr)).toEqual([]);
    });

    it('returns new elements appended to current', () => {
      const prev = [{ type: 'rectangle', x: 0, y: 0 }];
      const curr = [
        { type: 'rectangle', x: 0, y: 0 },
        { type: 'text', x: 10, y: 10 },
        { type: 'ellipse', x: 20, y: 20 },
      ];
      const diff = diffElements(prev, curr);
      expect(diff).toHaveLength(2);
      expect(diff[0].type).toBe('text');
      expect(diff[1].type).toBe('ellipse');
    });

    it('handles empty previous array', () => {
      const curr = [{ type: 'rectangle', x: 0, y: 0 }];
      expect(diffElements([], curr)).toHaveLength(1);
    });
  });
});
