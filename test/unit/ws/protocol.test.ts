import { describe, it, expect } from 'vitest';
import {
  ServerMessageSchema,
  ClientMessageSchema,
} from '../../../src/canvas/ws/protocol.js';

// ---------------------------------------------------------------------------
// ServerMessageSchema
// ---------------------------------------------------------------------------

describe('ServerMessageSchema', () => {
  describe('initial_elements', () => {
    it('accepts valid initial_elements message', () => {
      const msg = {
        type: 'initial_elements',
        elements: [
          { id: 'el-1', type: 'rectangle', x: 0, y: 0 },
          { id: 'el-2', type: 'ellipse', x: 10, y: 20 },
        ],
      };
      const result = ServerMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });

    it('accepts initial_elements with empty array', () => {
      const msg = { type: 'initial_elements', elements: [] };
      const result = ServerMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });

    it('rejects initial_elements with non-array elements', () => {
      const msg = { type: 'initial_elements', elements: 'not-array' };
      const result = ServerMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });
  });

  describe('element_created', () => {
    it('accepts valid element_created message', () => {
      const msg = {
        type: 'element_created',
        element: { id: 'el-1', type: 'rectangle', x: 0, y: 0 },
      };
      const result = ServerMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });

    it('rejects element_created without element field', () => {
      const msg = { type: 'element_created' };
      const result = ServerMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });
  });

  describe('element_updated', () => {
    it('accepts valid element_updated message', () => {
      const msg = {
        type: 'element_updated',
        element: { id: 'el-1', type: 'rectangle', x: 10, y: 20, version: 2 },
      };
      const result = ServerMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });
  });

  describe('element_deleted', () => {
    it('accepts valid element_deleted message', () => {
      const msg = { type: 'element_deleted', elementId: 'el-1' };
      const result = ServerMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });

    it('rejects element_deleted with overly long elementId', () => {
      const msg = { type: 'element_deleted', elementId: 'x'.repeat(65) };
      const result = ServerMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });

    it('rejects element_deleted without elementId', () => {
      const msg = { type: 'element_deleted' };
      const result = ServerMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });
  });

  describe('elements_batch_created', () => {
    it('accepts valid batch created message', () => {
      const msg = {
        type: 'elements_batch_created',
        elements: [
          { id: 'a', type: 'rectangle' },
          { id: 'b', type: 'ellipse' },
        ],
      };
      const result = ServerMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });

    it('accepts batch created with empty elements', () => {
      const msg = { type: 'elements_batch_created', elements: [] };
      const result = ServerMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });

    it('rejects batch exceeding max size of 100', () => {
      const elements = Array.from({ length: 101 }, (_, i) => ({ id: `el-${i}` }));
      const msg = { type: 'elements_batch_created', elements };
      const result = ServerMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });
  });

  describe('sync_status', () => {
    it('accepts valid sync_status message', () => {
      const msg = {
        type: 'sync_status',
        elementCount: 42,
        timestamp: '2025-01-01T00:00:00.000Z',
      };
      const result = ServerMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });

    it('rejects sync_status with negative elementCount', () => {
      const msg = {
        type: 'sync_status',
        elementCount: -1,
        timestamp: '2025-01-01T00:00:00.000Z',
      };
      const result = ServerMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });

    it('rejects sync_status with non-integer elementCount', () => {
      const msg = {
        type: 'sync_status',
        elementCount: 3.14,
        timestamp: '2025-01-01T00:00:00.000Z',
      };
      const result = ServerMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });

    it('rejects sync_status without timestamp', () => {
      const msg = { type: 'sync_status', elementCount: 0 };
      const result = ServerMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });
  });

  describe('mermaid_convert', () => {
    it('accepts valid mermaid_convert message', () => {
      const msg = {
        type: 'mermaid_convert',
        mermaidDiagram: 'graph TD\n  A --> B',
        timestamp: '2025-01-01T00:00:00.000Z',
      };
      const result = ServerMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });

    it('accepts mermaid_convert with optional config', () => {
      const msg = {
        type: 'mermaid_convert',
        mermaidDiagram: 'graph TD\n  A --> B',
        config: { theme: 'dark', layout: 'horizontal' },
        timestamp: '2025-01-01T00:00:00.000Z',
      };
      const result = ServerMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });

    it('rejects mermaid_convert with overly long diagram', () => {
      const msg = {
        type: 'mermaid_convert',
        mermaidDiagram: 'x'.repeat(50_001),
        timestamp: '2025-01-01T00:00:00.000Z',
      };
      const result = ServerMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });

    it('rejects mermaid_convert without timestamp', () => {
      const msg = {
        type: 'mermaid_convert',
        mermaidDiagram: 'graph TD\n  A --> B',
      };
      const result = ServerMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });
  });

  describe('error', () => {
    it('accepts valid error message', () => {
      const msg = { type: 'error', error: 'Something went wrong' };
      const result = ServerMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });

    it('rejects error with overly long message', () => {
      const msg = { type: 'error', error: 'x'.repeat(501) };
      const result = ServerMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });

    it('rejects error without error field', () => {
      const msg = { type: 'error' };
      const result = ServerMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });
  });

  describe('unknown type', () => {
    it('rejects message with unknown type', () => {
      const msg = { type: 'unknown_type', data: {} };
      const result = ServerMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });

    it('rejects message without type', () => {
      const msg = { data: 'something' };
      const result = ServerMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// ClientMessageSchema
// ---------------------------------------------------------------------------

describe('ClientMessageSchema', () => {
  describe('sync_request', () => {
    it('accepts valid sync_request message', () => {
      const msg = {
        type: 'sync_request',
        elements: [
          { id: 'el-1', type: 'rectangle', x: 0, y: 0 },
        ],
        timestamp: '2025-01-01T00:00:00.000Z',
      };
      const result = ClientMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });

    it('accepts sync_request with empty elements', () => {
      const msg = {
        type: 'sync_request',
        elements: [],
        timestamp: '2025-01-01T00:00:00.000Z',
      };
      const result = ClientMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });

    it('rejects sync_request without timestamp', () => {
      const msg = {
        type: 'sync_request',
        elements: [],
      };
      const result = ClientMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });

    it('rejects sync_request without elements', () => {
      const msg = {
        type: 'sync_request',
        timestamp: '2025-01-01T00:00:00.000Z',
      };
      const result = ClientMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });
  });

  describe('ping', () => {
    it('accepts valid ping message', () => {
      const msg = { type: 'ping' };
      const result = ClientMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });
  });

  describe('unknown type', () => {
    it('rejects client message with unknown type', () => {
      const msg = { type: 'subscribe' };
      const result = ClientMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });

    it('rejects empty object', () => {
      const result = ClientMessageSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('rejects non-object input', () => {
      const result = ClientMessageSchema.safeParse('just a string');
      expect(result.success).toBe(false);
    });

    it('rejects null', () => {
      const result = ClientMessageSchema.safeParse(null);
      expect(result.success).toBe(false);
    });
  });
});
