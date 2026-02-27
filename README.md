# adocycle

`adocycle` is a TypeScript CLI for Azure DevOps work tracking.

### Installation
You must install this package globally to use the CLI:

```bash
npm install -g adocycle
```

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

### Set default repository for `start`

```bash
adocycle repo set "D:\\repos\\my-service"
adocycle repo show
adocycle repo clear
```

### Options

```bash
adocycle mine --org myorg --limit 100
adocycle mine --json
adocycle mine --reauth

adocycle start 12345 --base main
adocycle start 12345 --repo "https://dev.azure.com/myorg/MyProject/_git/MyRepo"
adocycle start 12345 --reauth
```

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
```

### Required PAT permissions for `start`

To create remote branches and update work items, your PAT must include:

- `Code (Read & write)` (`vso.code_write`)
- `Work Items (Read & write)` (`vso.work_write`)

Without these scopes, `adocycle start` cannot create branch/update state.

## Publish Notes

Publishing is configured via:

- `bin` mapping to `dist/cli.js`
- `files` includes `dist`
- `prepublishOnly` runs `npm run build`

## License

MIT
