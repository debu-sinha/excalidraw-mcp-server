# Security Policy

## Reporting vulnerabilities

If you discover a security vulnerability in excalidraw-mcp-server, please report it responsibly.

**Preferred:** Use [GitHub Security Advisories](https://github.com/debu-sinha/excalidraw-mcp-server/security/advisories/new) to report the issue privately.

**Alternative:** Email debu.sinha@outlook.com with the subject line "Security: excalidraw-mcp-server".

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Response timeline

- **Acknowledgment:** Within 48 hours
- **Initial assessment:** Within 5 business days
- **Fix and release:** As soon as practical, typically within 30 days

## Disclosure policy

We follow coordinated disclosure with a 90-day window. If a fix is released before the 90-day deadline, the reporter may disclose after the fix is public. If no fix is available after 90 days, the reporter may disclose at their discretion.

## Security features

This project includes the following security measures:

- API key authentication with constant-time comparison on all endpoints
- Origin-restricted CORS (no wildcard)
- WebSocket token authentication and origin validation
- Rate limiting with standard and strict tiers
- Helmet.js security headers with Content Security Policy
- Bounded Zod schemas with `.strict()` to reject unknown fields
- 512KB request body size limit
- 1MB WebSocket payload limit
- Structured audit logging

## Supported versions

| Version | Supported |
|---------|-----------|
| 1.x     | Yes       |
