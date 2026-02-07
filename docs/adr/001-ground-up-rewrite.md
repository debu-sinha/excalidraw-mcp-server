# ADR 001: Ground-up rewrite instead of forking mcp_excalidraw

## Status

Accepted

## Context

The existing `mcp_excalidraw` project has 7 HIGH/CRITICAL security vulnerabilities that are architectural in nature:

1. **No authentication** - Any process on the network can control the canvas
2. **CORS wildcard (`*`)** - Any origin can make API requests
3. **No rate limiting** - Trivially DoS-able
4. **No input validation** - Raw user input passed directly to element creation
5. **No WebSocket authentication** - Any client can connect and receive real-time updates
6. **No security headers** - Missing CSP, HSTS, X-Frame-Options
7. **Unbounded inputs** - No limits on text length, batch size, coordinate ranges

These are not bugs that can be patched individually. The server architecture assumes a trusted local environment and was not designed with an adversarial model in mind.

## Decision

Build a new server from scratch with security as a foundational requirement rather than attempting to patch the existing codebase.

Key architectural choices:
- API key authentication on every endpoint (constant-time comparison)
- Origin-restricted CORS with explicit allowlist
- WebSocket token authentication and origin validation
- Two-tier rate limiting (standard for reads, strict for mutations)
- Zod schemas with `.strict()` and bounded ranges on all inputs
- Helmet.js for security headers with Content Security Policy
- Structured audit logging via pino

## Consequences

**Positive:**
- Clean security architecture from the ground up
- Every layer enforces defense in depth
- Bounded inputs prevent resource exhaustion
- Audit trail for all operations

**Negative:**
- No backwards compatibility with existing `mcp_excalidraw` configurations
- Clients must supply an API key for all requests
- Additional setup step (key generation) compared to the original zero-config approach

**Neutral:**
- Same MCP tool interface (14 tools), so MCP client configurations need only minor changes (adding the API key environment variable)
