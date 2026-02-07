import { describe, it, expect } from 'vitest';
import {
  ColorSchema,
  CoordinateSchema,
  DimensionSchema,
  CreateElementSchema,
  UpdateElementSchema,
  BatchCreateSchema,
  AlignElementsSchema,
  DistributeElementsSchema,
  MermaidSchema,
  QuerySchema,
} from '../../../src/mcp/schemas/element.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validRect = {
  type: 'rectangle' as const,
  x: 100,
  y: 200,
  width: 300,
  height: 150,
};

const validText = {
  type: 'text' as const,
  x: 50,
  y: 50,
  text: 'Hello world',
  fontSize: 20,
  fontFamily: 1,
};

// ---------------------------------------------------------------------------
// CreateElementSchema
// ---------------------------------------------------------------------------

describe('CreateElementSchema', () => {
  it('accepts a valid rectangle element', () => {
    const result = CreateElementSchema.safeParse(validRect);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('rectangle');
      expect(result.data.x).toBe(100);
      expect(result.data.y).toBe(200);
    }
  });

  it('accepts a valid text element', () => {
    const result = CreateElementSchema.safeParse(validText);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.text).toBe('Hello world');
      expect(result.data.fontSize).toBe(20);
    }
  });

  it('rejects __proto__ key (prototype pollution)', () => {
    const result = CreateElementSchema.safeParse({
      ...validRect,
      __proto__: { admin: true },
    });
    // __proto__ is a special JS property; when spread it doesn't appear as own key,
    // so we explicitly test with Object.create
    const polluted = Object.create(null);
    Object.assign(polluted, validRect);
    polluted['__proto__'] = { admin: true };
    const result2 = CreateElementSchema.safeParse(polluted);
    // strict() should reject the unknown __proto__ key
    expect(result2.success).toBe(false);
  });

  it('rejects constructor key (prototype pollution)', () => {
    const result = CreateElementSchema.safeParse({
      ...validRect,
      constructor: { prototype: {} },
    });
    expect(result.success).toBe(false);
  });

  it('rejects NaN coordinates', () => {
    const result = CreateElementSchema.safeParse({
      ...validRect,
      x: NaN,
    });
    expect(result.success).toBe(false);
  });

  it('rejects Infinity dimensions', () => {
    const result = CreateElementSchema.safeParse({
      ...validRect,
      width: Infinity,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative Infinity dimensions', () => {
    const result = CreateElementSchema.safeParse({
      ...validRect,
      height: -Infinity,
    });
    expect(result.success).toBe(false);
  });

  it('rejects oversized text (10001 chars)', () => {
    const result = CreateElementSchema.safeParse({
      ...validText,
      text: 'a'.repeat(10_001),
    });
    expect(result.success).toBe(false);
  });

  it('accepts text at exactly 10000 chars', () => {
    const result = CreateElementSchema.safeParse({
      ...validText,
      text: 'a'.repeat(10_000),
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid element types', () => {
    const result = CreateElementSchema.safeParse({
      ...validRect,
      type: 'circle',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown element type "image"', () => {
    const result = CreateElementSchema.safeParse({
      ...validRect,
      type: 'image',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// UpdateElementSchema
// ---------------------------------------------------------------------------

describe('UpdateElementSchema', () => {
  it('requires id field', () => {
    const result = UpdateElementSchema.safeParse({ x: 10 });
    expect(result.success).toBe(false);
  });

  it('accepts update with id and partial fields', () => {
    const result = UpdateElementSchema.safeParse({
      id: 'abc123',
      x: 999,
    });
    expect(result.success).toBe(true);
  });

  it('accepts update with only id (no-op update)', () => {
    const result = UpdateElementSchema.safeParse({ id: 'abc123' });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// BatchCreateSchema
// ---------------------------------------------------------------------------

describe('BatchCreateSchema', () => {
  it('rejects more than 100 elements', () => {
    const elements = Array.from({ length: 101 }, () => ({ ...validRect }));
    const result = BatchCreateSchema.safeParse({ elements });
    expect(result.success).toBe(false);
  });

  it('accepts exactly 100 elements', () => {
    const elements = Array.from({ length: 100 }, () => ({ ...validRect }));
    const result = BatchCreateSchema.safeParse({ elements });
    expect(result.success).toBe(true);
  });

  it('rejects empty array', () => {
    const result = BatchCreateSchema.safeParse({ elements: [] });
    expect(result.success).toBe(false);
  });

  it('accepts single element batch', () => {
    const result = BatchCreateSchema.safeParse({ elements: [validRect] });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AlignElementsSchema
// ---------------------------------------------------------------------------

describe('AlignElementsSchema', () => {
  it('requires at least 2 elementIds', () => {
    const result = AlignElementsSchema.safeParse({
      elementIds: ['a'],
      alignment: 'left',
    });
    expect(result.success).toBe(false);
  });

  it('accepts 2 elementIds', () => {
    const result = AlignElementsSchema.safeParse({
      elementIds: ['a', 'b'],
      alignment: 'center',
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DistributeElementsSchema
// ---------------------------------------------------------------------------

describe('DistributeElementsSchema', () => {
  it('requires at least 3 elementIds', () => {
    const result = DistributeElementsSchema.safeParse({
      elementIds: ['a', 'b'],
      direction: 'horizontal',
    });
    expect(result.success).toBe(false);
  });

  it('accepts 3 elementIds', () => {
    const result = DistributeElementsSchema.safeParse({
      elementIds: ['a', 'b', 'c'],
      direction: 'vertical',
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// MermaidSchema
// ---------------------------------------------------------------------------

describe('MermaidSchema', () => {
  it('rejects mermaid diagrams over 50000 chars', () => {
    const result = MermaidSchema.safeParse({
      mermaidDiagram: 'x'.repeat(50_001),
    });
    expect(result.success).toBe(false);
  });

  it('accepts diagram at exactly 50000 chars', () => {
    const result = MermaidSchema.safeParse({
      mermaidDiagram: 'x'.repeat(50_000),
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty mermaid string', () => {
    const result = MermaidSchema.safeParse({
      mermaidDiagram: '',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// QuerySchema
// ---------------------------------------------------------------------------

describe('QuerySchema', () => {
  it('rejects unknown filter keys', () => {
    const result = QuerySchema.safeParse({
      type: 'rectangle',
      unknownField: 'malicious',
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid query with type', () => {
    const result = QuerySchema.safeParse({ type: 'rectangle' });
    expect(result.success).toBe(true);
  });

  it('accepts empty query (no filters)', () => {
    const result = QuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ColorSchema (tested via CreateElementSchema)
// ---------------------------------------------------------------------------

describe('ColorSchema (via CreateElementSchema)', () => {
  const withBg = (bg: string) => ({
    ...validRect,
    backgroundColor: bg,
  });

  it('accepts 3-digit hex #fff', () => {
    const result = CreateElementSchema.safeParse(withBg('#fff'));
    expect(result.success).toBe(true);
  });

  it('accepts 6-digit hex #ffffff', () => {
    const result = CreateElementSchema.safeParse(withBg('#ffffff'));
    expect(result.success).toBe(true);
  });

  it('accepts rgb(0,0,0)', () => {
    const result = CreateElementSchema.safeParse(withBg('rgb(0,0,0)'));
    expect(result.success).toBe(true);
  });

  it('accepts rgba(255,255,255,0.5)', () => {
    const result = CreateElementSchema.safeParse(withBg('rgba(255,255,255,0.5)'));
    expect(result.success).toBe(true);
  });

  it('accepts "transparent"', () => {
    const result = CreateElementSchema.safeParse(withBg('transparent'));
    expect(result.success).toBe(true);
  });

  it('accepts named color "red"', () => {
    const result = CreateElementSchema.safeParse(withBg('red'));
    expect(result.success).toBe(true);
  });

  it('rejects javascript:alert(1)', () => {
    const result = CreateElementSchema.safeParse(withBg('javascript:alert(1)'));
    expect(result.success).toBe(false);
  });

  it('rejects script injection via color', () => {
    const result = CreateElementSchema.safeParse(withBg('<script>alert(1)</script>'));
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Number fields reject NaN and Infinity
// ---------------------------------------------------------------------------

describe('Number fields reject NaN and Infinity', () => {
  it('CoordinateSchema rejects NaN', () => {
    const result = CoordinateSchema.safeParse(NaN);
    expect(result.success).toBe(false);
  });

  it('CoordinateSchema rejects Infinity', () => {
    const result = CoordinateSchema.safeParse(Infinity);
    expect(result.success).toBe(false);
  });

  it('CoordinateSchema rejects -Infinity', () => {
    const result = CoordinateSchema.safeParse(-Infinity);
    expect(result.success).toBe(false);
  });

  it('DimensionSchema rejects NaN', () => {
    const result = DimensionSchema.safeParse(NaN);
    expect(result.success).toBe(false);
  });

  it('DimensionSchema rejects Infinity', () => {
    const result = DimensionSchema.safeParse(Infinity);
    expect(result.success).toBe(false);
  });

  it('strokeWidth rejects NaN via CreateElementSchema', () => {
    const result = CreateElementSchema.safeParse({
      ...validRect,
      strokeWidth: NaN,
    });
    expect(result.success).toBe(false);
  });

  it('opacity rejects Infinity via CreateElementSchema', () => {
    const result = CreateElementSchema.safeParse({
      ...validRect,
      opacity: Infinity,
    });
    expect(result.success).toBe(false);
  });

  it('fontSize rejects NaN via CreateElementSchema', () => {
    const result = CreateElementSchema.safeParse({
      ...validText,
      fontSize: NaN,
    });
    expect(result.success).toBe(false);
  });

  it('angle rejects Infinity via CreateElementSchema', () => {
    const result = CreateElementSchema.safeParse({
      ...validRect,
      angle: Infinity,
    });
    expect(result.success).toBe(false);
  });

  it('roughness rejects NaN via CreateElementSchema', () => {
    const result = CreateElementSchema.safeParse({
      ...validRect,
      roughness: NaN,
    });
    expect(result.success).toBe(false);
  });
});
