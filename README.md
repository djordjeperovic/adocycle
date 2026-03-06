# adocycle

`adocycle` is a TypeScript CLI for Azure DevOps work tracking.

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for planned improvements.

### Installation
You must install this package globally to use the CLI:

```bash
npm install -g adocycle
```

## PAT Prerequisites

Before first use, create an Azure DevOps PAT with:

- `Code (Read & write)` (`vso.code_write`)
- `Work Items (Read & write)` (`vso.work_write`)

Without these scopes, `adocycle start` cannot create branches or update work items.
`adocycle finish` also requires these scopes to create/reuse pull requests and move state to review.
`adocycle comment` uses `Work Items (Read & write)` to add comments to existing work items.

## Requirements

- Node.js `>=20.20.0`

## Install

```bash
npm install
```

## Build

```bash
npm run build
```

## Usage

### Show work assigned to you

```bash
adocycle mine
```

### Start working on a work item

```bash
adocycle start 12345 --repo "D:\\repos\\my-service"
```

```bash
adocycle start 12345 --repo "https://dev.azure.com/myorg/MyProject/_git/MyRepo"
```

### Add a comment to a work item

```bash
adocycle comment 12345 "Started investigation and captured repro steps."
adocycle comment 12345 --file work-note.md
```

### Finish work and hand off to review

```bash
adocycle finish 12345 --repo "D:\\repos\\my-service"
adocycle finish 12345 --repo "https://dev.azure.com/myorg/MyProject/_git/MyRepo" --target main
adocycle finish 12345 --draft
```

### Run an arbitrary WIQL query

```bash
adocycle query "SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.AssignedTo] = @Me AND [System.State] <> 'Closed'"
```

```bash
adocycle query --file team-work.wiql --table
```

```bash
echo "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'New'" | adocycle query
```

Queries run across all projects by default (like the ADO web UI with "Query across projects" checked). Use `--project` to scope to a single project.

### Set default repository for `start` and `finish`

```bash
adocycle repo set "D:\\repos\\my-service"
adocycle repo show
adocycle repo clear
```

### Diagnose setup and PAT scopes

```bash
adocycle doctor
adocycle doctor --offline
adocycle doctor --json
adocycle doctor --org myorg --repo "https://dev.azure.com/myorg/MyProject/_git/MyRepo"
```

### Options

```bash
adocycle mine --org myorg --limit 100
adocycle mine --json
adocycle mine --reauth

adocycle start 12345 --base main
adocycle start 12345 --repo "https://dev.azure.com/myorg/MyProject/_git/MyRepo"
adocycle start 12345 --reauth

adocycle comment 12345 "Shared an update for the team"
adocycle comment 12345 --file update.md
adocycle comment 12345 "Shared an update for the team" --reauth

adocycle finish 12345 --target develop
adocycle finish 12345 --draft
adocycle finish 12345 --repo "https://dev.azure.com/myorg/MyProject/_git/MyRepo"

adocycle doctor --offline
adocycle doctor --json

adocycle query "SELECT ..." --org myorg --project MyProject --top 500
adocycle query "SELECT ..." --table
adocycle query --file my-query.wiql
```

## Doctor Exit Behavior

- `adocycle doctor` returns exit code `1` when blocking checks fail.
- Blocking checks include Node version, git availability, org/PAT presence, Azure DevOps auth, and PAT scope probes.
- Repository default configuration issues are warnings and do not force non-zero exit code.
- `--offline` skips Azure DevOps auth/scope checks and reports them as skipped.

## Output Style

- Compact single-line rows using `cli-table3`
- Aggressive title truncation with ellipsis
- Short type labels (`Product Backlog Item` -> `PBI`)
- Human-friendly updated timestamps (`5m ago`, `2h ago`, `Feb 27`)
- Color cues via `chalk` (for supported terminals):
  - `Bug` in red
  - `PBI`/`Story` in cyan
  - `Approved` in green
  - `New` in yellow/dim

## Authentication

`adocycle` supports PAT-based auth in this order:

1. Environment variables (`ADO_ORG`/`ADO_ORG_URL`, `ADO_PAT`)
2. Local config file
3. Interactive prompt (first run)

On first run, if org/PAT are missing, the CLI prompts in terminal and stores values in:

- Windows: `%APPDATA%\\adocycle\\config.json`
- Linux/macOS: standard user config directory from `env-paths`

If the PAT expires, `adocycle mine` prompts for a new PAT and updates local config. You can also force this with:

```bash
adocycle mine --reauth
adocycle start 12345 --reauth
adocycle comment 12345 "Following up after PAT refresh" --reauth
```

## Publish Notes

Publishing is configured via:

- `bin` mapping to `dist/cli.js`
- `files` includes `dist`
- `prepublishOnly` runs `npm run build`

## License

MIT
