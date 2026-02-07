import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'node:http';
import crypto from 'node:crypto';
import type { Config } from '../../shared/config.js';
import type { ServerMessage } from './protocol.js';
import { ClientMessageSchema } from './protocol.js';
import type { ElementStore } from '../store/store.js';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('websocket');

export interface WsContext {
  wss: WebSocketServer;
  clients: Set<WebSocket>;
  broadcast: (message: ServerMessage, exclude?: WebSocket) => void;
}

export function createWebSocketServer(
  httpServer: HttpServer,
  config: Config,
  store: ElementStore
): WsContext {
  const clients = new Set<WebSocket>();

  const wss = new WebSocketServer({
    server: httpServer,
    verifyClient: (info, callback) => {
      // Origin validation
      const origin = info.origin;
      if (origin) {
        const allowedOrigins = config.CORS_ALLOWED_ORIGINS.split(',').map(o =>
          o.trim()
        );
        if (!allowedOrigins.includes(origin)) {
          logger.warn({ origin }, 'WebSocket connection rejected: origin not allowed');
          callback(false, 403, 'Origin not allowed');
          return;
        }
      }

      // Token auth via query parameter
      const url = new URL(
        info.req.url ?? '/',
        `http://${info.req.headers.host ?? 'localhost'}`
      );
      const token = url.searchParams.get('token');

      if (!token) {
        logger.warn('WebSocket connection rejected: missing token');
        callback(false, 401, 'Missing authentication token');
        return;
      }

      const expected = Buffer.from(config.EXCALIDRAW_API_KEY, 'utf8');
      const provided = Buffer.from(token, 'utf8');

      if (
        expected.length !== provided.length ||
        !crypto.timingSafeEqual(expected, provided)
      ) {
        logger.warn('WebSocket connection rejected: invalid token');
        callback(false, 403, 'Invalid authentication token');
        return;
      }

      callback(true);
    },
    maxPayload: 1024 * 1024, // 1MB
  });

  wss.on('connection', (ws: WebSocket) => {
    clients.add(ws);
    logger.info({ clients: clients.size }, 'WebSocket client connected');

    // Send current elements to new client
    store
      .getAll()
      .then(elements => {
        if (ws.readyState === WebSocket.OPEN) {
          const msg: ServerMessage = {
            type: 'initial_elements',
            elements: elements as unknown as Record<string, unknown>[],
          };
          ws.send(JSON.stringify(msg));
        }
      })
      .catch(err => {
        logger.error({ err }, 'Failed to send initial elements');
      });

    ws.on('message', (raw: Buffer) => {
      try {
        const parsed: unknown = JSON.parse(raw.toString('utf8'));
        const result = ClientMessageSchema.safeParse(parsed);

        if (!result.success) {
          const errMsg: ServerMessage = {
            type: 'error',
            error: 'Invalid message format',
          };
          ws.send(JSON.stringify(errMsg));
          return;
        }

        const message = result.data;
        if (message.type === 'ping') {
          ws.send(JSON.stringify({ type: 'sync_status', elementCount: 0, timestamp: new Date().toISOString() }));
        }
        // sync_request is handled by the canvas routes, not here
      } catch {
        const errMsg: ServerMessage = { type: 'error', error: 'Parse error' };
        ws.send(JSON.stringify(errMsg));
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      logger.info({ clients: clients.size }, 'WebSocket client disconnected');
    });

    ws.on('error', err => {
      clients.delete(ws);
      logger.error({ err }, 'WebSocket client error');
    });
  });

  function broadcast(message: ServerMessage, exclude?: WebSocket): void {
    const data = JSON.stringify(message);
    for (const client of clients) {
      if (client !== exclude && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  return { wss, clients, broadcast };
}
