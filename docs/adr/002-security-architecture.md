# ADR 002: Security architecture decisions

## Status

Accepted

## Context

This server bridges an MCP client (e.g., Claude Desktop, Cursor) with a browser-based Excalidraw canvas. The communication path is: MCP Client -> MCP Server (stdio) -> Canvas Server (HTTP/WS) -> Frontend. Each boundary needs its own authentication and authorization model.

## Decisions

### API key authentication (not OAuth)

OAuth is overkill for a locally-run MCP tool server. The typical deployment is a single user on localhost. An API key provides sufficient security:

- 256-bit random key generated via `crypto.randomBytes(32)`
- Constant-time comparison (`crypto.timingSafeEqual`) to prevent timing attacks
- Sent via `X-API-Key` header on HTTP, query parameter `?token=` on WebSocket
- Auto-generated on startup if not explicitly set, logged once for convenience

We considered mutual TLS but rejected it -- the setup burden is disproportionate for a local dev tool.

### CORS origin allowlist (not wildcard)

The default `Access-Control-Allow-Origin: *` in the original project allows any website to make credentialed requests to the canvas server. This is a cross-site request forgery vector.

Our approach:
- Explicit comma-separated origin list via `CORS_ALLOWED_ORIGINS`
- Default: `http://localhost:3000,http://127.0.0.1:3000`
- The `cors` middleware rejects requests from unlisted origins with an error
- `credentials: false` since we use API keys, not cookies

### WebSocket token via query parameter (not header)

The browser WebSocket API (`new WebSocket(url)`) does not support custom headers. This is a well-known limitation of the WebSocket specification. The only reliable option for browser-initiated connections is the query parameter.

Mitigations for token-in-URL risks:
- Connections restricted to localhost by default
- Origin validation on WebSocket upgrade
- Token is the same API key used for HTTP, so no separate credential to manage
- HTTPS (when configured) prevents network sniffing

### Rate limiting tiers

Two tiers prevent abuse at different levels:

| Tier     | Window | Max requests | Applied to                  |
|----------|--------|--------------|-----------------------------|
| Standard | 60s    | 100          | All endpoints               |
| Strict   | 60s    | 20           | DELETE, batch, mermaid, export |

The strict tier is 1/5 of the standard limit. Rate limit keying uses the API key (not IP) so that multiple clients sharing an IP are tracked independently.

### Bounded Zod schemas with .strict()

Every input schema uses:
- `.strict()` to reject payloads with unknown fields (prevents prototype pollution and data injection)
- Numeric bounds on coordinates (`-1M to +1M`), dimensions (`0 to 100K`), text length (`10K chars`), batch size (`100 elements`)
- `.finite()` on all numbers to reject `Infinity` and `NaN`
- Array length limits on points (`10K`), element IDs (`500`), group IDs (`50`)

This prevents memory exhaustion from unbounded arrays and ensures the server rejects malformed input at the boundary.

## Consequences

**Positive:**
- Defense in depth across HTTP, WebSocket, and input validation layers
- No single security bypass compromises the entire system
- Configuration-driven: all security parameters are tunable via environment variables

**Negative:**
- Slightly more setup than a zero-config server (must generate or accept an API key)
- WebSocket token in query parameter appears in server access logs (mitigated by localhost-only default)
- `.strict()` schemas may reject payloads from clients that add extra fields (this is intentional)
