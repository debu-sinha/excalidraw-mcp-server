import { describe, it, expect } from 'vitest';
import { getCheatsheetText, ELEMENT_REFERENCE } from '../../../src/mcp/apps/cheatsheet.js';

describe('cheatsheet', () => {
  describe('ELEMENT_REFERENCE', () => {
    it('contains all 7 element types', () => {
      const types = Object.keys(ELEMENT_REFERENCE.types);
      expect(types).toContain('rectangle');
      expect(types).toContain('ellipse');
      expect(types).toContain('diamond');
      expect(types).toContain('arrow');
      expect(types).toContain('text');
      expect(types).toContain('line');
      expect(types).toContain('freedraw');
      expect(types).toHaveLength(7);
    });

    it('each type has description and requiredFields', () => {
      for (const [name, info] of Object.entries(ELEMENT_REFERENCE.types)) {
        expect(info.description, `${name} missing description`).toBeDefined();
        expect(info.requiredFields, `${name} missing requiredFields`).toBeDefined();
        expect(info.requiredFields.length, `${name} has empty requiredFields`).toBeGreaterThan(0);
      }
    });

    it('has color palettes', () => {
      expect(ELEMENT_REFERENCE.colorPalettes.excalidraw).toBeDefined();
      expect(ELEMENT_REFERENCE.colorPalettes.pastel).toBeDefined();
    });
  });

  describe('getCheatsheetText', () => {
    it('returns non-empty markdown text', () => {
      const text = getCheatsheetText();
      expect(text.length).toBeGreaterThan(100);
    });

    it('includes section headers', () => {
      const text = getCheatsheetText();
      expect(text).toContain('# Excalidraw MCP Quick Reference');
      expect(text).toContain('## Element Types');
      expect(text).toContain('## Color Palettes');
      expect(text).toContain('## Sizing Guidelines');
      expect(text).toContain('## Tips');
    });

    it('includes all element type names', () => {
      const text = getCheatsheetText();
      expect(text).toContain('### rectangle');
      expect(text).toContain('### ellipse');
      expect(text).toContain('### diamond');
      expect(text).toContain('### arrow');
      expect(text).toContain('### text');
    });

    it('includes color hex values', () => {
      const text = getCheatsheetText();
      expect(text).toContain('#1971c2'); // blue
      expect(text).toContain('#c92a2a'); // red
    });
  });
});
