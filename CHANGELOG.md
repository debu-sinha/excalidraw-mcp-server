# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-02-07

### Added
- MCP Apps protocol support for inline diagram rendering in Claude Desktop, ChatGPT, and VS Code
- `create_view` tool - streams Excalidraw elements as interactive inline widget with draw-on animations
- `read_me` tool - returns element reference cheatsheet (types, colors, sizing rules, tips)
- Standalone mode - MCP server works without canvas server using in-process store
- Auto mode detection - connects to canvas server if available, falls back to standalone
- Widget with SVG rendering, progressive streaming, and export to excalidraw.com
- StandaloneStore with checkpoint/restore for undo support
- CanvasClientAdapter for transparent standalone/connected switching
- Partial JSON parser for extracting complete elements from streaming input
- Widget build pipeline via vite-plugin-singlefile (single HTML output)
- 52 new unit tests for all Phase 1-3 modules

### Changed
- All 14 existing tools work identically in both standalone and connected modes
- Canvas server is now optional (was required in v1.x)
- Version bumped to 2.0.0

### Migration
- Zero-config upgrade: `npm install excalidraw-mcp-server@2` - all existing tool names and schemas unchanged
- v1.x client configs (stdio, tool names) continue to work without changes

## [1.0.0] - 2026-02-07

### Added
- Security-hardened Excalidraw MCP server with 14 tools
- API key authentication on all endpoints with constant-time comparison
- Origin-restricted CORS (default localhost only)
- WebSocket token authentication and origin validation
- Rate limiting (standard and strict tiers)
- Hardened Zod schemas with .strict() and bounded inputs
- Real align_elements implementation (6 alignment modes)
- Real distribute_elements implementation (horizontal/vertical)
- SVG export via MCP tool
- Optional file-based persistence with atomic writes
- Structured audit logging via pino
- Helmet.js security headers with CSP
- Full test suite (unit + integration)
- GitHub Actions CI with Node 18/20/22 matrix
