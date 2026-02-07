import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { convertMermaidToExcalidraw } from './utils/mermaidConverter';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface WsMessage {
  type: string;
  element?: Record<string, unknown>;
  elements?: Record<string, unknown>[];
  elementId?: string;
  elementCount?: number;
  mermaidDiagram?: string;
  config?: Record<string, unknown>;
  timestamp?: string;
  error?: string;
}

// Read API key from query param or prompt
function getApiKey(): string {
  const params = new URLSearchParams(window.location.search);
  const key = params.get('key');
  if (key) return key;

  const stored = sessionStorage.getItem('excalidraw_api_key');
  if (stored) return stored;

  const prompted = window.prompt('Enter API key:');
  if (prompted) {
    sessionStorage.setItem('excalidraw_api_key', prompted);
    return prompted;
  }

  return '';
}

export default function App() {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [syncStatus, setSyncStatus] = useState<string>('');
  const wsRef = useRef<WebSocket | null>(null);
  const apiKeyRef = useRef<string>('');
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connectWebSocket = useCallback(() => {
    if (!apiKeyRef.current) {
      apiKeyRef.current = getApiKey();
    }
    if (!apiKeyRef.current) {
      setStatus('disconnected');
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/?token=${encodeURIComponent(apiKeyRef.current)}`;

    setStatus('connecting');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      setSyncStatus('Connected');
    };

    ws.onclose = () => {
      setStatus('disconnected');
      setSyncStatus('Disconnected');
      // Reconnect after 3s
      reconnectTimer.current = setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as WsMessage;
        handleMessage(msg);
      } catch {
        console.error('Failed to parse WebSocket message');
      }
    };
  }, []);

  const handleMessage = useCallback(
    (msg: WsMessage) => {
      if (!excalidrawAPI) return;

      const scene = excalidrawAPI.getSceneElements();

      switch (msg.type) {
        case 'initial_elements': {
          if (msg.elements && msg.elements.length > 0) {
            excalidrawAPI.updateScene({
              elements: msg.elements as any[],
            });
            setSyncStatus(`Loaded ${msg.elements.length} elements`);
          }
          break;
        }

        case 'element_created': {
          if (msg.element) {
            const existing = scene.filter(e => e.id !== (msg.element as any).id);
            excalidrawAPI.updateScene({
              elements: [...existing, msg.element as any],
            });
          }
          break;
        }

        case 'element_updated': {
          if (msg.element) {
            const updated = scene.map(e =>
              e.id === (msg.element as any).id ? (msg.element as any) : e
            );
            excalidrawAPI.updateScene({ elements: updated });
          }
          break;
        }

        case 'element_deleted': {
          if (msg.elementId) {
            const filtered = scene.filter(e => e.id !== msg.elementId);
            excalidrawAPI.updateScene({ elements: filtered });
          }
          break;
        }

        case 'elements_batch_created': {
          if (msg.elements) {
            const newIds = new Set(msg.elements.map((e: any) => e.id));
            const existing = scene.filter(e => !newIds.has(e.id));
            excalidrawAPI.updateScene({
              elements: [...existing, ...(msg.elements as any[])],
            });
            setSyncStatus(`Batch: ${msg.elements.length} elements created`);
          }
          break;
        }

        case 'sync_status': {
          setSyncStatus(`Synced: ${msg.elementCount} elements`);
          break;
        }

        case 'mermaid_convert': {
          if (msg.mermaidDiagram) {
            convertMermaidToExcalidraw(msg.mermaidDiagram, msg.config)
              .then(result => {
                if (result.error) {
                  setSyncStatus(`Mermaid error: ${result.error}`);
                  return;
                }
                if (result.elements.length > 0 && excalidrawAPI) {
                  const current = excalidrawAPI.getSceneElements();
                  excalidrawAPI.updateScene({
                    elements: [...current, ...(result.elements as any[])],
                  });
                  setSyncStatus(`Mermaid: ${result.elements.length} elements`);

                  // Sync back to server
                  syncToBackend();
                }
              })
              .catch(err => {
                setSyncStatus(`Mermaid error: ${err}`);
              });
          }
          break;
        }

        case 'error': {
          setSyncStatus(`Error: ${msg.error}`);
          break;
        }
      }
    },
    [excalidrawAPI]
  );

  const syncToBackend = useCallback(async () => {
    if (!excalidrawAPI || !apiKeyRef.current) return;

    setSyncStatus('Syncing...');
    const elements = excalidrawAPI
      .getSceneElements()
      .filter((e: any) => !e.isDeleted);

    try {
      const res = await fetch('/api/elements/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKeyRef.current,
        },
        body: JSON.stringify({ elements }),
      });

      if (res.ok) {
        const data = await res.json();
        setSyncStatus(`Synced: ${data.afterCount} elements`);
      } else {
        setSyncStatus(`Sync failed: ${res.status}`);
      }
    } catch (err) {
      setSyncStatus('Sync failed');
    }
  }, [excalidrawAPI]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWebSocket]);

  const statusColor =
    status === 'connected'
      ? '#4caf50'
      : status === 'connecting'
        ? '#ff9800'
        : '#f44336';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Status bar */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(255,255,255,0.9)',
          padding: '4px 12px',
          borderRadius: 6,
          fontSize: 12,
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: statusColor,
            display: 'inline-block',
          }}
        />
        <span>{status}</span>
        {syncStatus && <span style={{ color: '#666' }}>| {syncStatus}</span>}
        <button
          onClick={syncToBackend}
          style={{
            marginLeft: 8,
            padding: '2px 8px',
            fontSize: 11,
            cursor: 'pointer',
            border: '1px solid #ccc',
            borderRadius: 3,
            background: '#fff',
          }}
        >
          Sync
        </button>
      </div>

      <Excalidraw
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        initialData={{ appState: { viewBackgroundColor: '#ffffff' } }}
      />
    </div>
  );
}
