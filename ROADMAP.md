# ROADMAP

## Vision

Make `adocycle` the fastest CLI path from assigned Azure DevOps work item to completed engineering workflow with consistent, team-friendly automation.

## Current Baseline

- `mine` lists active work items assigned to the authenticated user.
- `query` runs WIQL from an argument, file, or stdin and supports JSON or `--table` output.
- `start <workItemId>` creates a branch, links work item context when possible, and moves state to `Committed`.
- `comment <workItemId>` adds a comment to an existing work item from inline text or `--file`.
- `finish <workItemId>` validates context, prepares PR handoff (create/reuse), links PR to the work item, and moves state to `In Review`.
- `repo set/show/clear` manages the default repository path or URL for workflow commands.
- `doctor` validates local/runtime setup and Azure DevOps readiness (Node, git, config, auth, repo, PAT scope) with actionable remediation.
- PAT-based authentication supports environment variables, stored config, interactive prompt, and `--reauth` retry flows.
- CI, npm publishing configuration, and MIT licensing are in place.

## Recent Progress

- Delivered the core `mine -> start -> comment -> finish` workflow in the CLI.
- Added resilient work item relation linking so branch/PR link failures degrade to warnings instead of blocking the primary operation.
- Added diagnostics (`doctor`), arbitrary WIQL access (`query`), and default repo management (`repo`) to reduce setup and discovery friction.
- Standardized command structure around Commander orchestration, shared auth retry, and typed Azure DevOps service helpers.

## Phase: Now

### 1) Output and Automation Consistency

Why:
- Teams need predictable machine-readable output across commands, not only human-readable summaries.

Scope:
- Add or standardize `--json` output for `start`, `comment`, `finish`, and `repo`.
- Define stable JSON response shapes for mutating commands.
- Keep human-readable output as the default interactive experience.

Acceptance Criteria:
- Scripts can rely on a documented JSON schema for core workflow commands.
- Human-readable output remains concise and high-signal when `--json` is not used.

### 2) Config UX Improvements

Why:
- Users need better visibility into what the CLI is currently using without exposing secrets.

Scope:
- Add `adocycle config show` and `adocycle config path`.
- Redact PAT values and clearly label config sources/defaults.

Acceptance Criteria:
- Users can inspect current config safely.
- Common “which org/repo/PAT source am I using?” questions can be answered without reading files manually.

### 3) `mine` Power Filters

Why:
- Users in large orgs need better triage controls than a single default view.

Scope:
- Add filters by project, work item type, and state.
- Add additional sort modes and paging/limit ergonomics.

Acceptance Criteria:
- Users can narrow and prioritize assigned work directly in the CLI without post-processing.

### 4) Workflow Ergonomics Polish

Why:
- The core workflow exists, but the highest-usage commands can be smoother for both humans and automation.

Scope:
- Standardize success/failure messaging and next-step guidance across `start`, `comment`, and `finish`.
- Consider stdin support for `comment` and other low-friction text input improvements.
- Improve direct-link output where it reduces copy/paste friction.

Acceptance Criteria:
- Core workflow commands feel consistent in tone, structure, and follow-up guidance.
- Common “add a quick update” or “jump back to the artifact” flows require fewer manual steps.

## Phase: Next

### 1) Profiles for Multi-Org Work

Why:
- Many users switch between orgs, PATs, and repositories.

Scope:
- Add named profiles and context switching (`--profile`).

Acceptance Criteria:
- Users can switch org context without editing config or env vars manually.

### 2) Policy Templates

Why:
- Teams need consistent naming/state conventions enforced by default.

Scope:
- Configurable templates for branch naming, state transitions, and command defaults.

Acceptance Criteria:
- Team policies can be applied with minimal per-user setup.

### 3) Distribution and Supply-Chain Hardening

Why:
- Easier installation and higher trust in releases improve adoption.

Scope:
- Add release artifacts and provenance/signing improvements.

Acceptance Criteria:
- The release process is reproducible and verifiable for distributed packages/binaries.

### 4) Optional Guided Interactive Mode

Why:
- First-time users may need help discovering the happy path.

Scope:
- Add an optional wizard-like mode for core workflows while preserving scriptable defaults.

Acceptance Criteria:
- New users can complete common flows with minimal prior knowledge.

## Release Milestones

- `v0.2`: polish the current workflow baseline, add safe config inspection, and broaden JSON support.
- `v0.3`: add `mine` filters, workflow ergonomics improvements, and stronger automation contracts.
- `v0.4`: add profiles and team policy support.
- `v1.0`: deliver a stable workflow platform with hardened UX, docs, and release process.

## Success Metrics

- `start`, `comment`, and `finish` success rates.
- Median time from work item selection to ready branch.
- Median time from active work item to review handoff.
- First-run setup failure rate.
- Frequency of auth/config support issues.
- Adoption of the core `mine -> start -> comment -> finish` flow.

## Risks and Mitigations

### Azure DevOps API and permission variability

Mitigation:
- Keep capability checks, resilient fallbacks, and explicit remediation messages close to failing operations.

### Repository naming ambiguity across projects

Mitigation:
- Preserve deterministic resolution rules and clear repo-selection guidance.

### PAT scope confusion

Mitigation:
- Expand `doctor` checks and keep in-command guidance tied to the failing operation.

## Out of Scope

- OAuth or device-flow authentication.
- Non-Azure work tracker support as an active implementation target.
- Background daemons or long-running local services.

## Contribution Notes

- Keep roadmap entries specific and testable.
- Update the roadmap in the same PR when current state or milestone direction changes.
