# Copilot Instructions for adocycle

## Rules

Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.

## Build & Test

```bash
npm run build        # tsc → dist/
npm run typecheck    # tsc --noEmit (no emit, fast check)
npm test             # vitest run (all tests)
npx vitest run test/ado.start.test.ts   # single test file
npx vitest run -t "creates safe slug"   # single test by name
npm run dev          # run CLI via tsx without building
```

CI runs: typecheck → test → build (see `.github/workflows/ci.yml`).

## Architecture

`adocycle` is a CLI tool that automates Azure DevOps work-item workflows. It uses Commander for command registration, the `azure-devops-node-api` SDK for all ADO interactions, and Zod for config validation.

### Layered structure

- **`src/commands/`** — Commander command registration + orchestration logic. Each file registers one top-level command (`mine`, `show`, `start`, `finish`, `comment`, `assign`, `query`, `repo`, `doctor`). Commands coordinate between layers but contain no ADO API calls directly.
- **`src/ado/`** — Azure DevOps API interaction. `client.ts` handles connection/URL normalization. `myWork.ts` and `wiqlFallback.ts` fetch work items (with automatic fallback). `workItem.ts` fetches a single work item with all fields, relations, and paginated comments. `start.ts` contains branch creation, work-item linking, and state transition logic. `finish.ts` creates/reuses pull requests and transitions state. `comment.ts` adds comments to work items. `assign.ts` handles work item assignment. `identity.ts` resolves email addresses to ADO identities via the IdentityPicker API. `normalize.ts` converts raw API responses into typed `MineWorkItem` objects.
- **`src/auth/`** — Credential resolution with a priority chain: CLI flag → env var (`ADO_ORG`/`ADO_PAT`) → config file → interactive prompt. On auth failure, commands auto-retry with a fresh PAT prompt when running in a TTY.
- **`src/config/`** — Zod-validated JSON config stored at the platform-specific path from `env-paths`. Config file is `chmod 0o600` on write.
- **`src/repo/`** — Parses Azure Repos URLs (dev.azure.com, visualstudio.com, SSH) and resolves local git paths by reading the `origin` remote.
- **`src/output/`** — Table rendering (`cli-table3` + `chalk`) and JSON output. Terminal width is adaptive.
- **`src/doctor/`** — Health check probes (`probes.ts`) and check orchestration (`checks.ts`) for `adocycle doctor`.
- **`src/commands/shared.ts`** — Shared argument parsers (e.g., `parseWorkItemId`) used by multiple commands.

### Data flow for `show`

`commands/show.ts` → resolves credentials → `ado/workItem.ts` fetches work item with `WorkItemExpand.All` + paginated comments via `getComments` → renders table or JSON output.

### Data flow for `start`

`commands/start.ts` → resolves credentials → resolves repo target (URL or local path) → `ado/start.ts` fetches work item, resolves base branch (with fallback chain: `--base` → repo default → `main` → `master`), creates remote branch, links branch to work item (non-fatal on failure), transitions state to "Committed".

## Conventions

- **ESM-only** — `"type": "module"` in package.json. All internal imports use `.js` extensions (`import { foo } from "./bar.js"`), even for `.ts` source files.
- **Error handling** — Throw `CliError` (from `src/errors.ts`) for user-facing errors. It carries an `exitCode`. Use `isAuthError()` to detect 401/403 responses for automatic PAT re-prompt.
- **Non-fatal fallbacks** — Operations like branch-to-work-item linking use try/catch and return warnings rather than throwing, so partial success doesn't block the user.
- **Strict TypeScript** — `strict: true` and `noUncheckedIndexedAccess: true`. Avoid `any`; use type guards and narrow with runtime checks.
- **Test files** — Flat in `test/` with naming pattern `<domain>.<unit>.test.ts` (e.g., `ado.start.test.ts`). Tests use Vitest with `describe`/`it`/`expect`. Tests cover pure logic only; no mocking of the Azure DevOps API client.
- **Config validation** — All stored config goes through `storedConfigSchema` (Zod). Config is always validated on both read and write.
- **Branch naming** — `start` generates branches as `bug/<id>-<slug>` or `feature/<id>-<slug>`. The slug is Unicode-normalized, lowercased, and capped at 60 chars.
