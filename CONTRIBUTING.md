# Contributing

Thanks for your interest in contributing to excalidraw-mcp-server.

## Getting started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/<your-username>/excalidraw-mcp-server.git`
3. Create a branch: `git checkout -b my-feature`
4. Install dependencies: `npm ci`
5. Make your changes
6. Run checks:
   ```bash
   npm run lint
   npm run type-check
   npm test
   ```
7. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat: add new tool for frame elements
   fix: correct alignment calculation for rotated elements
   ```
8. Push and open a pull request against `main`

## Code style

- TypeScript strict mode (`strict: true` in tsconfig)
- Use `.strict()` on all Zod schemas to reject unknown fields
- Use `.js` extensions in all import paths (ESM requirement)
- Run `npm run lint` before committing

## PR expectations

- Tests pass on all supported Node versions (18, 20, 22)
- Lint and type-check clean
- Focused scope -- one logical change per PR
- Update documentation if behavior changes
- No secrets, tokens, or credentials in committed files

## Reporting issues

Open a GitHub issue with:
- Steps to reproduce
- Expected vs actual behavior
- Node version and OS

## Security vulnerabilities

See [SECURITY.md](SECURITY.md) for the vulnerability reporting process. Do not open public issues for security bugs.
