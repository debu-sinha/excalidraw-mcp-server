# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
