# ROADMAP

## Vision

Make `adocycle` the fastest CLI path from assigned Azure DevOps work item to completed engineering workflow with consistent, team-friendly automation.

## Current Baseline

- `mine` lists active items assigned to the authenticated user.
- `start <workItemId>` creates a branch, links work item context, and moves state to `Committed`.
- `repo set/show/clear` manages default repository path or URL for `start`.
- PAT-based authentication with config + environment variable support.
- CI, npm publishing configuration, and MIT licensing are in place.

## Phase: Now

### 1) `start` Reliability Hardening

Why:
- Reduce command failures caused by repository URL variations, branch resolution, and project/repo lookup edge cases.

Scope:
- Improve base branch detection and fallback behavior.
- Strengthen support for org-root repository URLs.
- Standardize high-signal error messages with actionable fixes.

Acceptance Criteria:
- Known recurring `start` failures return a clear remediation path.
- Branch resolution and repository detection are stable across common org setups.

### 2) Work Item Linking Robustness

Why:
- Branch relation linking can fail in some process/customization setups.

Scope:
- Keep branch creation + state transition successful when non-critical linking fails.
- Improve warning messages and include explicit manual fallback instructions.

Acceptance Criteria:
- Non-fatal linking issues never block `start`.
- User receives clear follow-up instructions when link creation is skipped.

### 3) `doctor` Command

Why:
- Users need a one-command diagnosis for setup and permissions.

Scope:
- Add `adocycle doctor` to validate Node version, git availability, auth config, repo config, and required PAT scopes.

Acceptance Criteria:
- `doctor` reports pass/fail checks with concrete next actions.
- Blocking issues return non-zero exit code.

### 4) Config UX Improvements

Why:
- Better visibility and control over local CLI configuration.

Scope:
- Add `adocycle config show` and `adocycle config path`.
- Redact secrets in printed config output.

Acceptance Criteria:
- Users can inspect current config safely without exposing PAT values.

## Phase: Next

### 1) `finish` Command (paired with `start`)

Why:
- The workflow should include a clear “complete implementation / handoff to review” command, not only `start`.

Scope:
- Add `adocycle finish <workItemId> [--repo <path-or-url>] [--target <branch>] [--draft]`.
- Validate branch/work item context before proceeding.
- Prepare review handoff flow and transition work item to a review-ready state.

Acceptance Criteria:
- `start -> finish` forms a complete, repeatable workflow in the CLI.
- `finish` prints clear next actions and preserves auditability.

### 2) Output and Automation Consistency

Why:
- Teams need predictable machine-readable output across commands.

Scope:
- Add/standardize `--json` outputs for `start`, `repo`, and upcoming commands.
- Document stable JSON output contracts.

Acceptance Criteria:
- Scripts can rely on stable output schema for core commands.

### 3) `mine` Power Filters

Why:
- Users need better triage controls in large organizations.

Scope:
- Add filters by project, type, and state.
- Add additional sort modes and paging options.

Acceptance Criteria:
- Users can narrow and prioritize results directly in CLI without post-processing.

## Phase: Later

### 1) Profiles for Multi-Org Work

Why:
- Many users switch between orgs, PATs, and repositories.

Scope:
- Add named profiles and context switching (`--profile`).

Acceptance Criteria:
- Users can switch org context without editing config/env manually.

### 2) Policy Templates

Why:
- Teams need consistent naming/state conventions enforced by default.

Scope:
- Configurable templates for branch naming, state transitions, and command defaults.

Acceptance Criteria:
- Team policies can be applied with minimal per-user setup.

### 3) Distribution and Supply-Chain Hardening

Why:
- Easier installation and higher trust in releases.

Scope:
- Add release artifacts and provenance/signing improvements.

Acceptance Criteria:
- Reproducible, verifiable release process for distributed binaries/packages.

### 4) Optional Guided Interactive Mode

Why:
- Lower learning curve for first-time users.

Scope:
- Optional wizard-like mode for core workflows while preserving scriptable non-interactive defaults.

Acceptance Criteria:
- New users can complete common flows with minimal prior knowledge.

## Release Milestones

- `v0.2`: reliability, diagnostics (`doctor`), and config UX polish.
- `v0.3`: workflow completion with `finish`, plus output schema consistency.
- `v0.4`: profiles, filters, and team policy support.
- `v1.0`: stable workflow platform with hardened UX, docs, and release process.

## Success Metrics

- `start` success rate.
- Median time from work item selection to ready branch.
- First-run setup failure rate.
- Frequency of auth/config support issues.
- Adoption of `start -> finish` flow.

## Risks and Mitigations

### Azure DevOps API/permission variability

Mitigation:
- Capability checks, resilient fallbacks, and explicit remediation messages.

### Repository naming ambiguity across projects

Mitigation:
- Deterministic resolution rules and clear user prompts/errors.

### PAT scope confusion

Mitigation:
- `doctor` checks and in-command guidance tied to failing operations.

## Out of Scope

- OAuth/device-flow authentication.
- Non-Azure work tracker support as active implementation.
- Background daemon services.

## Contribution Notes

- Keep roadmap entries specific and testable.
- Update roadmap in the same PR when milestone direction changes.
