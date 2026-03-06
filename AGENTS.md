# AGENTS.md

See [.github/copilot-instructions.md](.github/copilot-instructions.md) for full architecture and conventions.

## Quick Reference

```bash
npm run build        # tsc → dist/
npm run typecheck    # tsc --noEmit (fast check)
npm test             # vitest run (all tests)
npx vitest run test/ado.start.test.ts   # single test file
npx vitest run -t "creates safe slug"   # single test by name
npm run dev          # run CLI via tsx without building
```

## Key Conventions

- **ESM-only** — `"type": "module"`. All imports use `.js` extensions even for `.ts` source.
- **Error handling** — Throw `CliError` (from `src/errors.ts`) for user-facing errors. Use `isAuthError()` for 401/403 detection.
- **Strict TypeScript** — `strict: true`, `noUncheckedIndexedAccess: true`. No `any`.
- **Test naming** — `test/<domain>.<unit>.test.ts`. Pure logic only, no API mocking.
- **Command pattern** — Each command in `src/commands/` follows: parse → validate → execute (via `src/ado/`) → print. Commands never call ADO APIs directly.
